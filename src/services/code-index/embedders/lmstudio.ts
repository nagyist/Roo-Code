import { OpenAI } from "openai"
import { ApiHandlerOptions } from "../../../shared/api"
import { IEmbedder, EmbeddingResponse, EmbedderInfo } from "../interfaces"
import {
	MAX_BATCH_TOKENS,
	MAX_ITEM_TOKENS,
	MAX_BATCH_RETRIES as MAX_RETRIES,
	INITIAL_RETRY_DELAY_MS as INITIAL_DELAY_MS,
} from "../constants"
import { withValidationErrorHandling, formatEmbeddingError, HttpError } from "../shared/validation-helpers"
import { t } from "../../../i18n"

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
				const batchResult = await this._embedBatchWithRetries(currentBatch, modelToUse)
				allEmbeddings.push(...batchResult.embeddings)
				usage.promptTokens += batchResult.usage.promptTokens
				usage.totalTokens += batchResult.usage.totalTokens
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
				})

				return {
					embeddings: response.data.map((item) => item.embedding),
					usage: {
						promptTokens: response.usage?.prompt_tokens || 0,
						totalTokens: response.usage?.total_tokens || 0,
					},
				}
			} catch (error: any) {
				const hasMoreAttempts = attempts < MAX_RETRIES - 1

				// Check if it's a rate limit error
				const httpError = error as HttpError
				if (httpError?.status === 429 && hasMoreAttempts) {
					const delayMs = INITIAL_DELAY_MS * Math.pow(2, attempts)
					await new Promise((resolve) => setTimeout(resolve, delayMs))
					continue
				}

				throw error
			}
		}

		throw new Error(t("embeddings:failedMaxAttempts", { attempts: MAX_RETRIES }))
	}

	/**
	 * Validates the LM Studio embedder configuration by testing connectivity and model availability
	 * @returns Promise resolving to validation result with success status and optional error message
	 */
	async validateConfiguration(): Promise<{ valid: boolean; error?: string }> {
		return withValidationErrorHandling(
			async () => {
				// Test with a minimal embedding request
				const testTexts = ["test"]
				const modelToUse = this.defaultModelId

				try {
					const response = await this.embeddingsClient.embeddings.create({
						input: testTexts,
						model: modelToUse,
					})

					// Check if we got a valid response
					if (!response.data || response.data.length === 0) {
						return {
							valid: false,
							error: t("embeddings:validation.invalidResponse"),
						}
					}

					return { valid: true }
				} catch (error: any) {
					// Handle LM Studio specific errors
					if (error?.message?.includes("ECONNREFUSED") || error?.code === "ECONNREFUSED") {
						return {
							valid: false,
							error: t("embeddings:lmstudio.serviceNotRunning", {
								baseUrl: this.options.lmStudioBaseUrl,
							}),
						}
					}

					if (error?.status === 404 || error?.message?.includes("404")) {
						return {
							valid: false,
							error: t("embeddings:lmstudio.modelNotFound", { modelId: modelToUse }),
						}
					}

					// Re-throw to let standard error handling take over
					throw error
				}
			},
			"lmstudio",
			{
				beforeStandardHandling: (error: any) => {
					// Handle LM Studio-specific connection errors
					if (
						error?.message?.includes("fetch failed") ||
						error?.code === "ECONNREFUSED" ||
						error?.message?.includes("ECONNREFUSED")
					) {
						return {
							valid: false,
							error: t("embeddings:lmstudio.serviceNotRunning", {
								baseUrl: this.options.lmStudioBaseUrl,
							}),
						}
					}

					if (error?.code === "ENOTFOUND" || error?.message?.includes("ENOTFOUND")) {
						return {
							valid: false,
							error: t("embeddings:lmstudio.hostNotFound", { baseUrl: this.options.lmStudioBaseUrl }),
						}
					}

					// Let standard handling take over
					return undefined
				},
			},
		)
	}

	get embedderInfo(): EmbedderInfo {
		return {
			name: "lmstudio",
		}
	}
}
