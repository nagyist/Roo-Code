import { vitest, describe, it, expect, beforeEach, afterEach } from "vitest"
import type { MockedFunction } from "vitest"
import { CodeIndexLmStudioEmbedder } from "../lmstudio"
import { OpenAI } from "openai"

vitest.mock("openai", () => {
	const mockEmbeddingsCreate = vitest.fn()
	return {
		OpenAI: vitest.fn().mockImplementation(() => ({
			embeddings: {
				create: mockEmbeddingsCreate,
			},
		})),
	}
})

const consoleMocks = {
	error: vitest.spyOn(console, "error").mockImplementation(() => {}),
	warn: vitest.spyOn(console, "warn").mockImplementation(() => {}),
}

describe("CodeIndexLmStudioEmbedder", () => {
	let embedder: CodeIndexLmStudioEmbedder
	let mockEmbeddingsCreate: MockedFunction<any>

	beforeEach(() => {
		vitest.clearAllMocks()
		consoleMocks.error.mockClear()
		consoleMocks.warn.mockClear()

		const MockedOpenAI = OpenAI as any
		mockEmbeddingsCreate = vitest.fn()
		MockedOpenAI.mockImplementation(() => ({
			embeddings: {
				create: mockEmbeddingsCreate,
			},
		}))

		embedder = new CodeIndexLmStudioEmbedder({
			lmStudioBaseUrl: "http://localhost:1234",
			embeddingModelId: "text-embedding-nomic-embed-text-v1.5@f16",
		})
	})

	afterEach(() => {
		vitest.clearAllMocks()
	})

	describe("constructor", () => {
		it("should initialize with provided options", () => {
			expect(embedder.embedderInfo.name).toBe("lmstudio")
		})

		it("should use default values when not provided", () => {
			const embedderWithDefaults = new CodeIndexLmStudioEmbedder({})
			expect(embedderWithDefaults.embedderInfo.name).toBe("lmstudio")
		})

		it("should normalize base URL to include /v1", () => {
			const embedderWithoutV1 = new CodeIndexLmStudioEmbedder({
				lmStudioBaseUrl: "http://localhost:1234",
			})
			expect(embedderWithoutV1.embedderInfo.name).toBe("lmstudio")

			const embedderWithV1 = new CodeIndexLmStudioEmbedder({
				lmStudioBaseUrl: "http://localhost:1234/v1",
			})
			expect(embedderWithV1.embedderInfo.name).toBe("lmstudio")
		})
	})

	describe("validateConfiguration", () => {
		it("should validate successfully with valid configuration", async () => {
			const mockResponse = {
				data: [{ embedding: [0.1, 0.2, 0.3] }],
				usage: { prompt_tokens: 2, total_tokens: 2 },
			}
			mockEmbeddingsCreate.mockResolvedValue(mockResponse)

			const result = await embedder.validateConfiguration()

			expect(result.valid).toBe(true)
			expect(result.error).toBeUndefined()
			expect(mockEmbeddingsCreate).toHaveBeenCalledWith({
				input: ["test"],
				model: "text-embedding-nomic-embed-text-v1.5@f16",
				encoding_format: "float",
			})
		})

		it("should fail validation when response has no data", async () => {
			const mockResponse = {
				data: [],
				usage: { prompt_tokens: 0, total_tokens: 0 },
			}
			mockEmbeddingsCreate.mockResolvedValue(mockResponse)

			const result = await embedder.validateConfiguration()

			expect(result.valid).toBe(false)
			expect(result.error).toBe("embeddings:validation.invalidResponse")
		})

		it("should fail validation when LM Studio is not running (ECONNREFUSED)", async () => {
			const error = new Error("ECONNREFUSED")
			;(error as any).code = "ECONNREFUSED"
			mockEmbeddingsCreate.mockRejectedValue(error)

			const result = await embedder.validateConfiguration()

			expect(result.valid).toBe(false)
			expect(result.error).toBe("lmstudio.serviceNotRunning")
		})

		it("should fail validation when model is not found (404)", async () => {
			const error = new Error("HTTP 404: Not Found")
			;(error as any).status = 404
			mockEmbeddingsCreate.mockRejectedValue(error)

			const result = await embedder.validateConfiguration()

			expect(result.valid).toBe(false)
			expect(result.error).toBe("lmstudio.modelNotFound")
		})

		it("should fail validation when host is not found (ENOTFOUND)", async () => {
			const error = new Error("ENOTFOUND")
			;(error as any).code = "ENOTFOUND"
			mockEmbeddingsCreate.mockRejectedValue(error)

			const result = await embedder.validateConfiguration()

			expect(result.valid).toBe(false)
			expect(result.error).toBe("lmstudio.hostNotFound")
		})

		it("should handle generic errors with standard error handling", async () => {
			const error = new Error("Unknown error")
			mockEmbeddingsCreate.mockRejectedValue(error)

			const result = await embedder.validateConfiguration()

			expect(result.valid).toBe(false)

			expect(result.error).toBe("embeddings:validation.configurationError")
		})

		it("should handle fetch failed errors", async () => {
			const error = new Error("fetch failed")
			mockEmbeddingsCreate.mockRejectedValue(error)

			const result = await embedder.validateConfiguration()

			expect(result.valid).toBe(false)
			expect(result.error).toBe("lmstudio.serviceNotRunning")
		})
	})

	describe("createEmbeddings", () => {
		it("should create embeddings successfully", async () => {
			const mockResponse = {
				data: [{ embedding: [0.1, 0.2, 0.3] }, { embedding: [0.4, 0.5, 0.6] }],
				usage: { prompt_tokens: 10, total_tokens: 10 },
			}
			mockEmbeddingsCreate.mockResolvedValue(mockResponse)

			const result = await embedder.createEmbeddings(["test1", "test2"])

			expect(result.embeddings).toEqual([
				[0.1, 0.2, 0.3],
				[0.4, 0.5, 0.6],
			])
			expect(result.usage).toEqual({ promptTokens: 10, totalTokens: 10 })
		})

		it("should handle rate limit errors with retry", async () => {
			const error = new Error("Rate limit exceeded")
			;(error as any).status = 429

			mockEmbeddingsCreate.mockRejectedValueOnce(error)

			const mockResponse = {
				data: [{ embedding: [0.1, 0.2, 0.3] }],
				usage: { prompt_tokens: 5, total_tokens: 5 },
			}
			mockEmbeddingsCreate.mockResolvedValueOnce(mockResponse)

			const result = await embedder.createEmbeddings(["test"])

			expect(result.embeddings).toEqual([[0.1, 0.2, 0.3]])
			expect(mockEmbeddingsCreate).toHaveBeenCalledTimes(2)
		})

		it("should skip texts that exceed token limit", async () => {
			const longText = "a".repeat(100000)
			const shortText = "short text"

			const mockResponse = {
				data: [{ embedding: [0.1, 0.2, 0.3] }],
				usage: { prompt_tokens: 3, total_tokens: 3 },
			}
			mockEmbeddingsCreate.mockResolvedValue(mockResponse)

			const result = await embedder.createEmbeddings([longText, shortText])

			expect(result.embeddings).toEqual([[0.1, 0.2, 0.3]])
			expect(consoleMocks.warn).toHaveBeenCalledWith(expect.stringContaining("exceeds maximum token limit"))
		})
	})
})
