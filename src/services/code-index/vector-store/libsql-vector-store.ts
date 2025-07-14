import { LibSQLVector } from "@mastra/libsql"
import { createHash } from "crypto"
import * as path from "path"
import * as fs from "fs"
import { IVectorStore, PointStruct, VectorStoreSearchResult, Payload } from "../interfaces/vector-store"
import { DEFAULT_MAX_SEARCH_RESULTS, DEFAULT_SEARCH_MIN_SCORE } from "../constants"
import { t } from "../../../i18n"

/**
 * LibSQL implementation of the vector store interface for local file-based vector storage
 */
export class LibSQLVectorStore implements IVectorStore {
	private vectorStore: LibSQLVector
	private readonly collectionName: string
	private readonly vectorSize: number
	private readonly databasePath: string

	/**
	 * Creates a new LibSQL vector store
	 * @param workspacePath Path to the workspace
	 * @param databasePath Path to the SQLite database file
	 * @param vectorSize Size of the vectors to store
	 */
	constructor(workspacePath: string, databasePath: string, vectorSize: number) {
		this.vectorSize = vectorSize
		this.databasePath = databasePath

		// Ensure the directory exists
		const dbDir = path.dirname(databasePath)
		if (!fs.existsSync(dbDir)) {
			fs.mkdirSync(dbDir, { recursive: true })
		}

		// Initialize LibSQL vector store
		this.vectorStore = new LibSQLVector({
			connectionUrl: `file:${databasePath}`,
		})

		// Generate collection name from workspace path
		const hash = createHash("sha256").update(workspacePath).digest("hex")
		this.collectionName = `ws_${hash.substring(0, 16)}`
	}

	/**
	 * Initializes the vector store by creating necessary indexes
	 * @returns Promise resolving to boolean indicating if a new collection was created
	 */
	async initialize(): Promise<boolean> {
		try {
			// Check if the index already exists
			const existingIndexes = await this.vectorStore.listIndexes()
			const indexExists = existingIndexes.some((index: any) => index.name === this.collectionName)

			if (!indexExists) {
				// Create the vector index
				await this.vectorStore.createIndex({
					indexName: this.collectionName,
					dimension: this.vectorSize,
				})
				return true // New collection created
			}

			return false // Collection already existed
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)
			console.error(`[LibSQLVectorStore] Failed to initialize collection "${this.collectionName}":`, errorMessage)
			throw new Error(
				t("embeddings:vectorStore.libsqlInitializationFailed", {
					databasePath: this.databasePath,
					errorMessage,
				}),
			)
		}
	}

	/**
	 * Upserts points into the vector store
	 * @param points Array of points to upsert
	 */
	async upsertPoints(points: PointStruct[]): Promise<void> {
		if (points.length === 0) return

		try {
			// Extract vectors and metadata separately
			const vectors = points.map((point) => point.vector)
			const ids = points.map((point) => point.id)
			const metadata = points.map((point) => ({
				filePath: point.payload.filePath || "",
				codeChunk: point.payload.codeChunk || "",
				startLine: point.payload.startLine || 0,
				endLine: point.payload.endLine || 0,
				pathSegments: point.payload.filePath ? point.payload.filePath.split(path.sep).filter(Boolean) : [],
			}))

			// Upsert all points to the index
			await this.vectorStore.upsert({
				indexName: this.collectionName,
				vectors: vectors,
				ids: ids,
				metadata: metadata,
			})
		} catch (error) {
			console.error("[LibSQLVectorStore] Failed to upsert points:", error)
			throw error
		}
	}

	/**
	 * Searches for similar vectors using the LibSQL vector search
	 * @param queryVector Vector to search for
	 * @param directoryPrefix Optional directory prefix to filter results
	 * @param minScore Optional minimum score threshold
	 * @param maxResults Optional maximum number of results to return
	 * @returns Promise resolving to search results
	 */
	async search(
		queryVector: number[],
		directoryPrefix?: string,
		minScore?: number,
		maxResults?: number,
	): Promise<VectorStoreSearchResult[]> {
		try {
			const actualMinScore = minScore ?? DEFAULT_SEARCH_MIN_SCORE
			const actualMaxResults = maxResults ?? DEFAULT_MAX_SEARCH_RESULTS

			// Build filter for directory prefix if provided
			let filter: any = undefined
			if (directoryPrefix) {
				const segments = directoryPrefix.split(path.sep).filter(Boolean)
				// Create a filter that checks if pathSegments starts with the directory segments
				filter = {
					pathSegments: {
						$in: segments,
					},
				}
			}

			// Perform vector search
			const searchResults = await this.vectorStore.query({
				indexName: this.collectionName,
				queryVector: queryVector,
				topK: actualMaxResults,
				filter,
				includeVector: false,
				minScore: actualMinScore,
			})

			// Transform results to our format
			const results: VectorStoreSearchResult[] = []
			for (const result of searchResults) {
				if (result.metadata) {
					results.push({
						id: result.id,
						score: result.score || 0,
						payload: {
							filePath: result.metadata.filePath as string,
							codeChunk: result.metadata.codeChunk as string,
							startLine: result.metadata.startLine as number,
							endLine: result.metadata.endLine as number,
						},
					})
				}
			}

			// Sort by similarity score (descending)
			results.sort((a, b) => b.score - a.score)
			return results
		} catch (error) {
			console.error("[LibSQLVectorStore] Failed to search points:", error)
			throw error
		}
	}

	/**
	 * Deletes points by file path
	 * @param filePath Path of the file to delete points for
	 */
	async deletePointsByFilePath(filePath: string): Promise<void> {
		return this.deletePointsByMultipleFilePaths([filePath])
	}

	/**
	 * Deletes points by multiple file paths
	 * @param filePaths Array of file paths to delete points for
	 */
	async deletePointsByMultipleFilePaths(filePaths: string[]): Promise<void> {
		if (filePaths.length === 0) return

		try {
			// LibSQL vector store doesn't have bulk delete by metadata filter
			// We need to query first to get the IDs, then delete them
			for (const filePath of filePaths) {
				// Query to find vectors with this file path
				const searchResults = await this.vectorStore.query({
					indexName: this.collectionName,
					queryVector: new Array(this.vectorSize).fill(0), // Dummy vector for metadata search
					topK: 10000, // Large number to get all matches
					filter: {
						filePath: { $eq: filePath },
					},
					includeVector: false,
				})

				// Delete each found vector by ID
				for (const result of searchResults) {
					await this.vectorStore.deleteVector({
						indexName: this.collectionName,
						id: result.id,
					})
				}
			}
		} catch (error) {
			console.error("[LibSQLVectorStore] Failed to delete points by file paths:", error)
			throw error
		}
	}

	/**
	 * Clears all points from the collection
	 */
	async clearCollection(): Promise<void> {
		try {
			// LibSQL doesn't have a direct clear method, so we truncate the index
			await this.vectorStore.truncateIndex({
				indexName: this.collectionName,
			})
		} catch (error) {
			console.error("[LibSQLVectorStore] Failed to clear collection:", error)
			throw error
		}
	}

	/**
	 * Deletes the entire collection (drops the index)
	 */
	async deleteCollection(): Promise<void> {
		try {
			if (await this.collectionExists()) {
				await this.vectorStore.deleteIndex({
					indexName: this.collectionName,
				})
			}
		} catch (error) {
			console.error(`[LibSQLVectorStore] Failed to delete collection ${this.collectionName}:`, error)
			throw error
		}
	}

	/**
	 * Checks if the collection exists
	 * @returns Promise resolving to boolean indicating if the collection exists
	 */
	async collectionExists(): Promise<boolean> {
		try {
			const indexes = await this.vectorStore.listIndexes()
			return indexes.some((index: any) => index.name === this.collectionName)
		} catch (error) {
			console.error("[LibSQLVectorStore] Failed to check collection existence:", error)
			return false
		}
	}
}
