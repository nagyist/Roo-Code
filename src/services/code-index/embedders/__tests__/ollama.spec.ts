import { vitest, describe, it, expect, beforeEach, afterEach } from "vitest"
import type { MockedFunction } from "vitest"
import { CodeIndexOllamaEmbedder } from "../ollama"

// Mock fetch
global.fetch = vitest.fn() as MockedFunction<typeof fetch>

// Mock console methods
const consoleMocks = {
	error: vitest.spyOn(console, "error").mockImplementation(() => {}),
}

describe("CodeIndexOllamaEmbedder", () => {
	let embedder: CodeIndexOllamaEmbedder
	let mockFetch: MockedFunction<typeof fetch>

	beforeEach(() => {
		vitest.clearAllMocks()
		consoleMocks.error.mockClear()

		mockFetch = global.fetch as MockedFunction<typeof fetch>

		embedder = new CodeIndexOllamaEmbedder({
			ollamaModelId: "nomic-embed-text",
			ollamaBaseUrl: "http://localhost:11434",
		})
	})

	afterEach(() => {
		vitest.clearAllMocks()
	})

	describe("constructor", () => {
		it("should initialize with provided options", () => {
			expect(embedder.embedderInfo.name).toBe("ollama")
		})

		it("should use default values when not provided", () => {
			const embedderWithDefaults = new CodeIndexOllamaEmbedder({})
			expect(embedderWithDefaults.embedderInfo.name).toBe("ollama")
		})
	})

	describe("validateConfiguration", () => {
		it("should validate successfully when service is available and model exists", async () => {
			// Mock successful /api/tags call
			mockFetch.mockImplementationOnce(() =>
				Promise.resolve({
					ok: true,
					status: 200,
					json: () =>
						Promise.resolve({
							models: [{ name: "nomic-embed-text:latest" }, { name: "llama2:latest" }],
						}),
				} as Response),
			)

			// Mock successful /api/embed test call
			mockFetch.mockImplementationOnce(() =>
				Promise.resolve({
					ok: true,
					status: 200,
					json: () =>
						Promise.resolve({
							embeddings: [[0.1, 0.2, 0.3]],
						}),
				} as Response),
			)

			const result = await embedder.validateConfiguration()

			expect(result.valid).toBe(true)
			expect(result.error).toBeUndefined()
			expect(mockFetch).toHaveBeenCalledTimes(2)

			// Check first call (GET /api/tags)
			const firstCall = mockFetch.mock.calls[0]
			expect(firstCall[0]).toBe("http://localhost:11434/api/tags")
			expect(firstCall[1]?.method).toBe("GET")
			expect(firstCall[1]?.headers).toEqual({ "Content-Type": "application/json" })
			expect(firstCall[1]?.signal).toBeDefined() // AbortSignal for timeout

			// Check second call (POST /api/embed)
			const secondCall = mockFetch.mock.calls[1]
			expect(secondCall[0]).toBe("http://localhost:11434/api/embed")
			expect(secondCall[1]?.method).toBe("POST")
			expect(secondCall[1]?.headers).toEqual({ "Content-Type": "application/json" })
			expect(secondCall[1]?.body).toBe(JSON.stringify({ model: "nomic-embed-text", input: ["test"] }))
			expect(secondCall[1]?.signal).toBeDefined() // AbortSignal for timeout
		})

		it("should fail validation when service is not available", async () => {
			mockFetch.mockRejectedValueOnce(new Error("ECONNREFUSED"))

			const result = await embedder.validateConfiguration()

			expect(result.valid).toBe(false)
			expect(result.error).toBe("ollama.serviceNotRunning")
		})

		it("should fail validation when tags endpoint returns 404", async () => {
			mockFetch.mockImplementationOnce(() =>
				Promise.resolve({
					ok: false,
					status: 404,
				} as Response),
			)

			const result = await embedder.validateConfiguration()

			expect(result.valid).toBe(false)
			expect(result.error).toBe("ollama.serviceNotRunning")
		})

		it("should fail validation when tags endpoint returns other error", async () => {
			mockFetch.mockImplementationOnce(() =>
				Promise.resolve({
					ok: false,
					status: 500,
				} as Response),
			)

			const result = await embedder.validateConfiguration()

			expect(result.valid).toBe(false)
			expect(result.error).toBe("ollama.serviceUnavailable")
		})

		it("should fail validation when model does not exist", async () => {
			// Mock successful /api/tags call with different models
			mockFetch.mockImplementationOnce(() =>
				Promise.resolve({
					ok: true,
					status: 200,
					json: () =>
						Promise.resolve({
							models: [{ name: "llama2:latest" }, { name: "mistral:latest" }],
						}),
				} as Response),
			)

			const result = await embedder.validateConfiguration()

			expect(result.valid).toBe(false)
			expect(result.error).toBe("ollama.modelNotFound")
		})

		it("should fail validation when model exists but doesn't support embeddings", async () => {
			// Mock successful /api/tags call
			mockFetch.mockImplementationOnce(() =>
				Promise.resolve({
					ok: true,
					status: 200,
					json: () =>
						Promise.resolve({
							models: [{ name: "nomic-embed-text" }],
						}),
				} as Response),
			)

			// Mock failed /api/embed test call
			mockFetch.mockImplementationOnce(() =>
				Promise.resolve({
					ok: false,
					status: 400,
				} as Response),
			)

			const result = await embedder.validateConfiguration()

			expect(result.valid).toBe(false)
			expect(result.error).toBe("ollama.modelNotEmbeddingCapable")
		})

		it("should handle ECONNREFUSED errors", async () => {
			mockFetch.mockRejectedValueOnce(new Error("ECONNREFUSED"))

			const result = await embedder.validateConfiguration()

			expect(result.valid).toBe(false)
			expect(result.error).toBe("ollama.serviceNotRunning")
		})

		it("should handle ENOTFOUND errors", async () => {
			mockFetch.mockRejectedValueOnce(new Error("ENOTFOUND"))

			const result = await embedder.validateConfiguration()

			expect(result.valid).toBe(false)
			expect(result.error).toBe("ollama.hostNotFound")
		})

		it("should handle generic network errors", async () => {
			mockFetch.mockRejectedValueOnce(new Error("Network timeout"))

			const result = await embedder.validateConfiguration()

			expect(result.valid).toBe(false)
			expect(result.error).toBe("embeddings:validation.configurationError")
		})
	})
})
