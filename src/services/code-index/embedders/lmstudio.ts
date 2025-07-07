import { OpenAI } from "openai"
import { ApiHandlerOptions } from "../../../shared/api"
import { IEmbedder, EmbeddingResponse, EmbedderInfo } from "../interfaces"
import {
	MAX_BATCH_TOKENS,
	MAX_ITEM_TOKENS,
	MAX_BATCH_RETRIES as MAX_RETRIES,
	INITIAL_RETRY_DELAY_MS as INITIAL_DELAY_MS,
} from "../constants"

/**
 * LM Studio implementation of the embedder interface with batching and rate limiting.
 * Uses OpenAI-compatible API endpoints with a custom base URL.
 */
export class CodeIndexLmStudioEmbedder implements IEmbedder {
	protected options: ApiHandlerOptions
	private embeddingsClient: OpenAI
	private readonly defaultModelId: string

	/**
	 * Creates a new LM Studio embedder
	 * @param options API handler options including lmStudioBaseUrl
	 */
	constructor(options: ApiHandlerOptions & { embeddingModelId?: string }) {
		this.options = options

		// Normalize base URL to prevent duplicate /v1 if user already provided it
		let baseUrl = this.options.lmStudioBaseUrl || "http://localhost:1234"
		if (!baseUrl.endsWith("/v1")) {
			baseUrl = baseUrl + "/v1"
		}

		this.embeddingsClient = new OpenAI({
			baseURL: baseUrl,
			apiKey: "noop", // API key is intentionally hardcoded to "noop" because LM Studio does not require authentication
		})
		this.defaultModelId = options.embeddingModelId || "text-embedding-nomic-embed-text-v1.5@f16"
	}

	/**
	 * Creates embeddings for the given texts with batching and rate limiting
	 * @param texts Array of text strings to embed
	 * @param model Optional model identifier
	 * @returns Promise resolving to embedding response
	 */
	async createEmbeddings(texts: string[], model?: string): Promise<EmbeddingResponse> {
		const modelToUse = model || this.defaultModelId
		const allEmbeddings: number[][] = []
		const usage = { promptTokens: 0, totalTokens: 0 }
		const remainingTexts = [...texts]

		while (remainingTexts.length > 0) {
			const currentBatch: string[] = []
			let currentBatchTokens = 0
			const processedIndices: number[] = []

			for (let i = 0; i < remainingTexts.length; i++) {
				const text = remainingTexts[i]
				const itemTokens = Math.ceil(text.length / 4)

				if (itemTokens > MAX_ITEM_TOKENS) {
					console.warn(
						`Text at index ${i} exceeds maximum token limit (${itemTokens} > ${MAX_ITEM_TOKENS}). Skipping.`,
					)
					processedIndices.push(i)
					continue
				}

				if (currentBatchTokens + itemTokens <= MAX_BATCH_TOKENS) {
					currentBatch.push(text)
					currentBatchTokens += itemTokens
					processedIndices.push(i)
				} else {
					break
				}
			}

			// Remove processed items from remainingTexts (in reverse order to maintain correct indices)
			for (let i = processedIndices.length - 1; i >= 0; i--) {
				remainingTexts.splice(processedIndices[i], 1)
			}

			if (currentBatch.length > 0) {
				try {
					const batchResult = await this._embedBatchWithRetries(currentBatch, modelToUse)

					allEmbeddings.push(...batchResult.embeddings)
					usage.promptTokens += batchResult.usage.promptTokens
					usage.totalTokens += batchResult.usage.totalTokens
				} catch (error) {
					const batchInfo = `batch of ${currentBatch.length} documents (indices: ${processedIndices.join(", ")})`
					console.error(`Failed to process ${batchInfo}:`, error)
					throw new Error(
						`Failed to create embeddings for ${batchInfo}: ${error instanceof Error ? error.message : "batch processing error"}`,
					)
				}
			}
		}

		return { embeddings: allEmbeddings, usage }
	}

	/**
	 * Helper method to handle batch embedding with retries and exponential backoff
	 * @param batchTexts Array of texts to embed in this batch
	 * @param model Model identifier to use
	 * @returns Promise resolving to embeddings and usage statistics
	 */
	private async _embedBatchWithRetries(
		batchTexts: string[],
		model: string,
	): Promise<{ embeddings: number[][]; usage: { promptTokens: number; totalTokens: number } }> {
		for (let attempts = 0; attempts < MAX_RETRIES; attempts++) {
			try {
				const response = await this.embeddingsClient.embeddings.create({
					input: batchTexts,
					model: model,
					encoding_format: "float",
				})

				return {
					embeddings: response.data.map((item) => item.embedding),
					usage: {
						promptTokens: response.usage?.prompt_tokens || 0,
						totalTokens: response.usage?.total_tokens || 0,
					},
				}
			} catch (error: any) {
				const isRateLimitError = error?.status === 429
				const hasMoreAttempts = attempts < MAX_RETRIES - 1

				if (isRateLimitError && hasMoreAttempts) {
					const delayMs = INITIAL_DELAY_MS * Math.pow(2, attempts)
					await new Promise((resolve) => setTimeout(resolve, delayMs))
					continue
				}

				throw error
			}
		}

		throw new Error(`Failed to create embeddings after ${MAX_RETRIES} attempts`)
	}

	get embedderInfo(): EmbedderInfo {
		return {
			name: "lmstudio",
		}
	}
}
