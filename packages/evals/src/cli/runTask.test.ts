import { describe, it, expect, vi, beforeEach } from "vitest"
import { processTaskInContainer, processTaskInDocker, processTaskInAzureContainerApps } from "./runTask.js"
import { Logger } from "./utils.js"

// Mock dependencies
vi.mock("./azureContainerApps.js", () => ({
	AzureContainerAppsExecutor: vi.fn().mockImplementation(() => ({
		executeJob: vi.fn().mockResolvedValue(undefined),
	})),
	getAzureContainerAppsConfig: vi.fn().mockReturnValue({
		subscriptionId: "test-subscription",
		resourceGroupName: "test-rg",
		containerAppEnvironmentName: "test-env",
		containerAppName: "test-app",
		containerRegistryServer: "test.azurecr.io",
		containerImage: "test.azurecr.io/app:latest",
		location: "East US",
	}),
}))

vi.mock("execa", () => ({
	execa: vi.fn().mockResolvedValue({ exitCode: 0 } as { exitCode: number }),
}))

describe("runTask execution methods", () => {
	let mockLogger: Logger

	beforeEach(async () => {
		mockLogger = {
			info: vi.fn(),
			error: vi.fn(),
			warn: vi.fn(),
			debug: vi.fn(),
			log: vi.fn(),
			close: vi.fn(),
		} as unknown as Logger

		// Reset environment variables
		delete process.env.HOST_EXECUTION_METHOD
		delete process.env.DATABASE_URL
		delete process.env.REDIS_URL
		delete process.env.OPENROUTER_API_KEY

		// Clear all mocks
		vi.clearAllMocks()
	})

	describe("processTaskInContainer", () => {
		it("should use Docker execution by default", async () => {
			const execaMock = vi.mocked(await import("execa")).execa

			await processTaskInContainer({
				taskId: 123,
				logger: mockLogger,
				maxRetries: 1,
			})

			expect(mockLogger.info).toHaveBeenCalledWith("Using execution method: docker")
			expect(execaMock).toHaveBeenCalled()
		})

		it("should use Docker execution when HOST_EXECUTION_METHOD=docker", async () => {
			process.env.HOST_EXECUTION_METHOD = "docker"
			const execaMock = vi.mocked(await import("execa")).execa

			await processTaskInContainer({
				taskId: 123,
				logger: mockLogger,
				maxRetries: 1,
			})

			expect(mockLogger.info).toHaveBeenCalledWith("Using execution method: docker")
			expect(execaMock).toHaveBeenCalled()
		})

		it("should use Azure Container Apps execution when HOST_EXECUTION_METHOD=azure-container-apps", async () => {
			process.env.HOST_EXECUTION_METHOD = "azure-container-apps"
			process.env.DATABASE_URL = "postgres://test"
			process.env.REDIS_URL = "redis://test"
			process.env.OPENROUTER_API_KEY = "test-key"

			const { AzureContainerAppsExecutor } = await import("./azureContainerApps.js")
			const mockExecutor = vi.mocked(AzureContainerAppsExecutor)

			await processTaskInContainer({
				taskId: 123,
				logger: mockLogger,
				maxRetries: 1,
			})

			expect(mockLogger.info).toHaveBeenCalledWith("Using execution method: azure-container-apps")
			expect(mockExecutor).toHaveBeenCalled()
		})
	})

	describe("processTaskInDocker", () => {
		it("should execute Docker command with correct parameters", async () => {
			const execaMock = vi.mocked(await import("execa")).execa

			await processTaskInDocker({
				taskId: 123,
				logger: mockLogger,
				maxRetries: 1,
			})

			expect(mockLogger.info).toHaveBeenCalledWith("pnpm --filter @roo-code/evals cli --taskId 123")
			expect(execaMock).toHaveBeenCalledWith(expect.stringContaining("docker run"), { shell: true })
		})

		it("should retry on failure", async () => {
			const execaMock = vi.mocked(await import("execa")).execa
			execaMock.mockClear()
			execaMock.mockRejectedValueOnce(new Error("Container failed")).mockResolvedValueOnce({ exitCode: 0 } as any) // eslint-disable-line @typescript-eslint/no-explicit-any

			await processTaskInDocker({
				taskId: 123,
				logger: mockLogger,
				maxRetries: 2,
			})

			expect(execaMock).toHaveBeenCalledTimes(2)
			expect(mockLogger.error).toHaveBeenCalledWith(
				expect.stringContaining("container process failed with error"),
			)
		})

		it("should give up after max retries", async () => {
			const execaMock = vi.mocked(await import("execa")).execa
			execaMock.mockClear()
			execaMock.mockRejectedValue(new Error("Container failed"))

			await processTaskInDocker({
				taskId: 123,
				logger: mockLogger,
				maxRetries: 1,
			})

			expect(execaMock).toHaveBeenCalledTimes(2) // Initial attempt + 1 retry
			expect(mockLogger.error).toHaveBeenCalledWith("all 2 attempts failed, giving up")
		})
	})

	describe("processTaskInAzureContainerApps", () => {
		it("should execute Azure Container Apps job with correct parameters", async () => {
			process.env.DATABASE_URL = "postgres://test"
			process.env.REDIS_URL = "redis://test"
			process.env.OPENROUTER_API_KEY = "test-key"

			const { AzureContainerAppsExecutor } = await import("./azureContainerApps.js")
			const mockExecutor = vi.mocked(AzureContainerAppsExecutor)
			const mockExecuteJob = vi.fn().mockResolvedValue(undefined)
			mockExecutor.mockImplementation(() => ({ executeJob: mockExecuteJob }) as any) // eslint-disable-line @typescript-eslint/no-explicit-any

			await processTaskInAzureContainerApps({
				taskId: 123,
				logger: mockLogger,
				maxRetries: 3,
			})

			expect(mockLogger.info).toHaveBeenCalledWith("Processing task 123 using Azure Container Apps")
			expect(mockExecuteJob).toHaveBeenCalledWith({
				jobName: expect.stringMatching(/^evals-task-123-\d+$/),
				command: ["sh", "-c", "pnpm --filter @roo-code/evals cli --taskId 123"],
				environmentVariables: {
					HOST_EXECUTION_METHOD: "azure-container-apps",
					DATABASE_URL: "postgres://test",
					REDIS_URL: "redis://test",
					OPENROUTER_API_KEY: "test-key",
				},
				cpu: 1.0,
				memory: "2Gi",
				maxRetries: 3,
			})
			expect(mockLogger.info).toHaveBeenCalledWith("Azure Container Apps job completed successfully for task 123")
		})

		it("should handle Azure Container Apps execution errors", async () => {
			const { AzureContainerAppsExecutor } = await import("./azureContainerApps.js")
			const mockExecutor = vi.mocked(AzureContainerAppsExecutor)
			const mockExecuteJob = vi.fn().mockRejectedValue(new Error("Azure execution failed"))
			mockExecutor.mockImplementation(() => ({ executeJob: mockExecuteJob }) as any) // eslint-disable-line @typescript-eslint/no-explicit-any

			await expect(
				processTaskInAzureContainerApps({
					taskId: 123,
					logger: mockLogger,
					maxRetries: 1,
				}),
			).rejects.toThrow("Azure execution failed")

			expect(mockLogger.error).toHaveBeenCalledWith(
				"Azure Container Apps execution failed for task 123: Error: Azure execution failed",
			)
		})
	})
})
