import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { CodeIndexManager } from "../manager"
import { CodeIndexServiceFactory } from "../service-factory"
import type { MockedClass } from "vitest"
import fs from "fs/promises"
import path from "path"

// Mock vscode module
vi.mock("vscode", () => ({
	workspace: {
		workspaceFolders: [
			{
				uri: { fsPath: "/test/workspace" },
				name: "test",
				index: 0,
			},
		],
		createFileSystemWatcher: vi.fn(() => ({
			onDidCreate: vi.fn(),
			onDidChange: vi.fn(),
			onDidDelete: vi.fn(),
			dispose: vi.fn(),
		})),
	},
	RelativePattern: vi.fn().mockImplementation((base, pattern) => ({
		base,
		pattern,
	})),
}))

// Mock path utilities
vi.mock("../../../utils/path", () => ({
	getWorkspacePath: vi.fn(() => "/test/workspace"),
}))

// Mock fs operations
vi.mock("fs/promises")
const mockFs = fs as any

// Mock file existence check
vi.mock("../../../utils/fs", () => ({
	fileExistsAtPath: vi.fn(),
}))

// Mock glob utilities
vi.mock("../../glob/list-files", () => ({
	findGitignoreFiles: vi.fn(),
}))

// Mock state manager
vi.mock("../state-manager", () => ({
	CodeIndexStateManager: vi.fn().mockImplementation(() => ({
		onProgressUpdate: vi.fn(),
		getCurrentStatus: vi.fn(),
		dispose: vi.fn(),
		setSystemState: vi.fn(),
	})),
}))

// Mock telemetry
vi.mock("@roo-code/telemetry", () => ({
	TelemetryService: {
		instance: {
			captureEvent: vi.fn(),
		},
	},
}))

// Mock service factory
vi.mock("../service-factory")
const MockedCodeIndexServiceFactory = CodeIndexServiceFactory as MockedClass<typeof CodeIndexServiceFactory>

describe("CodeIndexManager - Ignore Integration Tests", () => {
	let mockContext: any
	let manager: CodeIndexManager

	beforeEach(() => {
		// Clear all instances before each test
		CodeIndexManager.disposeAll()

		mockContext = {
			subscriptions: [],
			workspaceState: {} as any,
			globalState: {} as any,
			extensionUri: {} as any,
			extensionPath: "/test/extension",
			asAbsolutePath: vi.fn(),
			storageUri: {} as any,
			storagePath: "/test/storage",
			globalStorageUri: {} as any,
			globalStoragePath: "/test/global-storage",
			logUri: {} as any,
			logPath: "/test/log",
			extensionMode: 3, // vscode.ExtensionMode.Test
			secrets: {} as any,
			environmentVariableCollection: {} as any,
			extension: {} as any,
			languageModelAccessInformation: {} as any,
		}

		manager = CodeIndexManager.getInstance(mockContext)!
	})

	afterEach(() => {
		CodeIndexManager.disposeAll()
		vi.clearAllMocks()
	})

	describe("gitignore integration", () => {
		it("should load and apply .gitignore patterns during service recreation", async () => {
			// Mock .gitignore file discovery and content
			const { findGitignoreFiles } = await import("../../glob/list-files")
			const mockFindGitignoreFiles = findGitignoreFiles as any
			mockFindGitignoreFiles.mockResolvedValue(["/test/workspace/.gitignore"])

			// Mock .gitignore content
			mockFs.readFile.mockResolvedValue("node_modules/\n*.log\n.env")

			// Mock config manager
			const mockConfigManager = {
				loadConfiguration: vi.fn().mockResolvedValue({ requiresRestart: false }),
				isFeatureConfigured: true,
				isFeatureEnabled: true,
				getConfig: vi.fn().mockReturnValue({
					isConfigured: true,
					embedderProvider: "openai",
					modelId: "text-embedding-3-small",
					openAiOptions: { openAiNativeApiKey: "test-key" },
					qdrantUrl: "http://localhost:6333",
					qdrantApiKey: "test-key",
					searchMinScore: 0.4,
				}),
			}
			;(manager as any)._configManager = mockConfigManager

			// Mock cache manager
			const mockCacheManager = {
				initialize: vi.fn(),
				clearCacheFile: vi.fn(),
			}
			;(manager as any)._cacheManager = mockCacheManager

			// Mock service factory
			const mockServiceFactoryInstance = {
				createServices: vi.fn().mockReturnValue({
					embedder: { embedderInfo: { name: "openai" } },
					vectorStore: {},
					scanner: {},
					fileWatcher: {
						onDidStartBatchProcessing: vi.fn(),
						onBatchProgressUpdate: vi.fn(),
						watch: vi.fn(),
						stopWatcher: vi.fn(),
						dispose: vi.fn(),
					},
				}),
				validateEmbedder: vi.fn().mockResolvedValue({ valid: true }),
			}
			MockedCodeIndexServiceFactory.mockImplementation(() => mockServiceFactoryInstance as any)

			// Act - call _recreateServices which should load .gitignore
			await (manager as any)._recreateServices()

			// Assert
			expect(mockFindGitignoreFiles).toHaveBeenCalledWith("/test/workspace")
			expect(mockFs.readFile).toHaveBeenCalledWith("/test/workspace/.gitignore", "utf8")
			expect(mockServiceFactoryInstance.createServices).toHaveBeenCalled()

			// Verify that the ignore instance was passed to createServices with .gitignore patterns
			const createServicesCall = mockServiceFactoryInstance.createServices.mock.calls[0]
			const ignoreInstance = createServicesCall[2] // Third parameter is the ignore instance

			// Test that the ignore instance has the expected patterns
			expect(ignoreInstance.ignores("node_modules/package.json")).toBe(true)
			expect(ignoreInstance.ignores("debug.log")).toBe(true)
			expect(ignoreInstance.ignores(".env")).toBe(true)
			expect(ignoreInstance.ignores(".gitignore")).toBe(true) // Should always ignore .gitignore files
			expect(ignoreInstance.ignores("src/main.ts")).toBe(false)
		})

		it("should handle missing .gitignore files gracefully", async () => {
			// Mock no .gitignore files found
			const { findGitignoreFiles } = await import("../../glob/list-files")
			const mockFindGitignoreFiles = findGitignoreFiles as any
			mockFindGitignoreFiles.mockResolvedValue([])

			// Mock config manager
			const mockConfigManager = {
				loadConfiguration: vi.fn().mockResolvedValue({ requiresRestart: false }),
				isFeatureConfigured: true,
				isFeatureEnabled: true,
				getConfig: vi.fn().mockReturnValue({
					isConfigured: true,
					embedderProvider: "openai",
					modelId: "text-embedding-3-small",
					openAiOptions: { openAiNativeApiKey: "test-key" },
					qdrantUrl: "http://localhost:6333",
					qdrantApiKey: "test-key",
					searchMinScore: 0.4,
				}),
			}
			;(manager as any)._configManager = mockConfigManager

			// Mock cache manager
			const mockCacheManager = {
				initialize: vi.fn(),
				clearCacheFile: vi.fn(),
			}
			;(manager as any)._cacheManager = mockCacheManager

			// Mock service factory
			const mockServiceFactoryInstance = {
				createServices: vi.fn().mockReturnValue({
					embedder: { embedderInfo: { name: "openai" } },
					vectorStore: {},
					scanner: {},
					fileWatcher: {
						onDidStartBatchProcessing: vi.fn(),
						onBatchProgressUpdate: vi.fn(),
						watch: vi.fn(),
						stopWatcher: vi.fn(),
						dispose: vi.fn(),
					},
				}),
				validateEmbedder: vi.fn().mockResolvedValue({ valid: true }),
			}
			MockedCodeIndexServiceFactory.mockImplementation(() => mockServiceFactoryInstance as any)

			// Act - should not throw even with no .gitignore files
			await expect((manager as any)._recreateServices()).resolves.not.toThrow()

			// Assert
			expect(mockFindGitignoreFiles).toHaveBeenCalledWith("/test/workspace")
			expect(mockFs.readFile).not.toHaveBeenCalled()
			expect(mockServiceFactoryInstance.createServices).toHaveBeenCalled()

			// Verify that an ignore instance was still created (even if empty)
			const createServicesCall = mockServiceFactoryInstance.createServices.mock.calls[0]
			const ignoreInstance = createServicesCall[2]

			// Should still ignore .gitignore files themselves
			expect(ignoreInstance.ignores(".gitignore")).toBe(true)
			expect(ignoreInstance.ignores("src/main.ts")).toBe(false)
		})
	})

	describe("rooignore integration", () => {
		it("should preserve RooIgnoreController instance across service recreations", async () => {
			// Mock file existence check
			const { fileExistsAtPath } = await import("../../../utils/fs")
			const mockFileExistsAtPath = fileExistsAtPath as any
			mockFileExistsAtPath.mockResolvedValue(true)

			// Mock .rooignore content
			mockFs.readFile.mockResolvedValue("*.secret\ntemp/")

			// Mock config manager
			const mockConfigManager = {
				loadConfiguration: vi.fn().mockResolvedValue({ requiresRestart: false }),
				isFeatureConfigured: true,
				isFeatureEnabled: true,
				getConfig: vi.fn().mockReturnValue({
					isConfigured: true,
					embedderProvider: "openai",
					modelId: "text-embedding-3-small",
					openAiOptions: { openAiNativeApiKey: "test-key" },
					qdrantUrl: "http://localhost:6333",
					qdrantApiKey: "test-key",
					searchMinScore: 0.4,
				}),
			}
			;(manager as any)._configManager = mockConfigManager

			// Mock cache manager
			const mockCacheManager = {
				initialize: vi.fn(),
				clearCacheFile: vi.fn(),
			}
			;(manager as any)._cacheManager = mockCacheManager

			// Mock .gitignore discovery
			const { findGitignoreFiles } = await import("../../glob/list-files")
			const mockFindGitignoreFiles = findGitignoreFiles as any
			mockFindGitignoreFiles.mockResolvedValue([])

			// Mock service factory
			const mockServiceFactoryInstance = {
				createServices: vi.fn().mockReturnValue({
					embedder: { embedderInfo: { name: "openai" } },
					vectorStore: {},
					scanner: {},
					fileWatcher: {
						onDidStartBatchProcessing: vi.fn(),
						onBatchProgressUpdate: vi.fn(),
						watch: vi.fn(),
						stopWatcher: vi.fn(),
						dispose: vi.fn(),
					},
				}),
				validateEmbedder: vi.fn().mockResolvedValue({ valid: true }),
			}
			MockedCodeIndexServiceFactory.mockImplementation(() => mockServiceFactoryInstance as any)

			// Act - call _recreateServices twice to simulate "Clear Index Data" scenario
			await (manager as any)._recreateServices()
			const firstRooIgnoreController = (manager as any)._rooIgnoreController

			await (manager as any)._recreateServices()
			const secondRooIgnoreController = (manager as any)._rooIgnoreController

			// Assert - should be the same instance (preserved across recreations)
			expect(firstRooIgnoreController).toBe(secondRooIgnoreController)
			expect(firstRooIgnoreController).toBeDefined()

			// Verify that loadRooIgnore was called on both recreations
			expect(mockFileExistsAtPath).toHaveBeenCalledWith("/test/workspace/.rooignore")
			expect(mockFs.readFile).toHaveBeenCalledWith("/test/workspace/.rooignore", "utf8")

			// Verify that the RooIgnoreController was passed to createServices
			expect(mockServiceFactoryInstance.createServices).toHaveBeenCalledTimes(2)
			const firstCall = mockServiceFactoryInstance.createServices.mock.calls[0]
			const secondCall = mockServiceFactoryInstance.createServices.mock.calls[1]

			// Fourth parameter should be the RooIgnoreController
			expect(firstCall[3]).toBe(firstRooIgnoreController)
			expect(secondCall[3]).toBe(secondRooIgnoreController)
			expect(firstCall[3]).toBe(secondCall[3]) // Same instance
		})

		it("should reload .rooignore patterns on each service recreation", async () => {
			// Mock file existence check
			const { fileExistsAtPath } = await import("../../../utils/fs")
			const mockFileExistsAtPath = fileExistsAtPath as any
			mockFileExistsAtPath.mockResolvedValue(true)

			// Mock .rooignore content
			mockFs.readFile.mockResolvedValue("*.secret\ntemp/")

			// Create a spy on the RooIgnoreController's loadRooIgnore method
			const mockLoadRooIgnore = vi.fn().mockResolvedValue(undefined)

			// Mock config manager
			const mockConfigManager = {
				loadConfiguration: vi.fn().mockResolvedValue({ requiresRestart: false }),
				isFeatureConfigured: true,
				isFeatureEnabled: true,
				getConfig: vi.fn().mockReturnValue({
					isConfigured: true,
					embedderProvider: "openai",
					modelId: "text-embedding-3-small",
					openAiOptions: { openAiNativeApiKey: "test-key" },
					qdrantUrl: "http://localhost:6333",
					qdrantApiKey: "test-key",
					searchMinScore: 0.4,
				}),
			}
			;(manager as any)._configManager = mockConfigManager

			// Mock cache manager
			const mockCacheManager = {
				initialize: vi.fn(),
				clearCacheFile: vi.fn(),
			}
			;(manager as any)._cacheManager = mockCacheManager

			// Mock .gitignore discovery
			const { findGitignoreFiles } = await import("../../glob/list-files")
			const mockFindGitignoreFiles = findGitignoreFiles as any
			mockFindGitignoreFiles.mockResolvedValue([])

			// Pre-set a mock RooIgnoreController to test reloading
			;(manager as any)._rooIgnoreController = {
				loadRooIgnore: mockLoadRooIgnore,
				dispose: vi.fn(),
			}

			// Mock service factory
			const mockServiceFactoryInstance = {
				createServices: vi.fn().mockReturnValue({
					embedder: { embedderInfo: { name: "openai" } },
					vectorStore: {},
					scanner: {},
					fileWatcher: {
						onDidStartBatchProcessing: vi.fn(),
						onBatchProgressUpdate: vi.fn(),
						watch: vi.fn(),
						stopWatcher: vi.fn(),
						dispose: vi.fn(),
					},
				}),
				validateEmbedder: vi.fn().mockResolvedValue({ valid: true }),
			}
			MockedCodeIndexServiceFactory.mockImplementation(() => mockServiceFactoryInstance as any)

			// Act - call _recreateServices
			await (manager as any)._recreateServices()

			// Assert - loadRooIgnore should have been called to reload patterns
			expect(mockLoadRooIgnore).toHaveBeenCalledTimes(1)
		})
	})

	describe("integration with service factory", () => {
		it("should pass both gitignore and rooignore controllers to service factory", async () => {
			// Mock .gitignore discovery
			const { findGitignoreFiles } = await import("../../glob/list-files")
			const mockFindGitignoreFiles = findGitignoreFiles as any
			mockFindGitignoreFiles.mockResolvedValue(["/test/workspace/.gitignore"])

			// Mock .gitignore content
			mockFs.readFile.mockImplementation((filePath: string) => {
				if (filePath === "/test/workspace/.gitignore") {
					return Promise.resolve("node_modules/\n*.log")
				}
				if (filePath === "/test/workspace/.rooignore") {
					return Promise.resolve("*.secret\ntemp/")
				}
				return Promise.reject(new Error("File not found"))
			})

			// Mock file existence for .rooignore
			const { fileExistsAtPath } = await import("../../../utils/fs")
			const mockFileExistsAtPath = fileExistsAtPath as any
			mockFileExistsAtPath.mockResolvedValue(true)

			// Mock config manager
			const mockConfigManager = {
				loadConfiguration: vi.fn().mockResolvedValue({ requiresRestart: false }),
				isFeatureConfigured: true,
				isFeatureEnabled: true,
				getConfig: vi.fn().mockReturnValue({
					isConfigured: true,
					embedderProvider: "openai",
					modelId: "text-embedding-3-small",
					openAiOptions: { openAiNativeApiKey: "test-key" },
					qdrantUrl: "http://localhost:6333",
					qdrantApiKey: "test-key",
					searchMinScore: 0.4,
				}),
			}
			;(manager as any)._configManager = mockConfigManager

			// Mock cache manager
			const mockCacheManager = {
				initialize: vi.fn(),
				clearCacheFile: vi.fn(),
			}
			;(manager as any)._cacheManager = mockCacheManager

			// Mock service factory
			const mockServiceFactoryInstance = {
				createServices: vi.fn().mockReturnValue({
					embedder: { embedderInfo: { name: "openai" } },
					vectorStore: {},
					scanner: {},
					fileWatcher: {
						onDidStartBatchProcessing: vi.fn(),
						onBatchProgressUpdate: vi.fn(),
						watch: vi.fn(),
						stopWatcher: vi.fn(),
						dispose: vi.fn(),
					},
				}),
				validateEmbedder: vi.fn().mockResolvedValue({ valid: true }),
			}
			MockedCodeIndexServiceFactory.mockImplementation(() => mockServiceFactoryInstance as any)

			// Act
			await (manager as any)._recreateServices()

			// Assert
			expect(mockServiceFactoryInstance.createServices).toHaveBeenCalledTimes(1)
			const createServicesCall = mockServiceFactoryInstance.createServices.mock.calls[0]

			// Verify parameters: context, cacheManager, ignoreInstance, rooIgnoreController
			expect(createServicesCall).toHaveLength(4)
			expect(createServicesCall[0]).toBe(mockContext) // context
			expect(createServicesCall[1]).toBe(mockCacheManager) // cacheManager

			// Third parameter should be ignore instance with .gitignore patterns
			const ignoreInstance = createServicesCall[2]
			expect(ignoreInstance.ignores("node_modules/package.json")).toBe(true)
			expect(ignoreInstance.ignores("debug.log")).toBe(true)
			expect(ignoreInstance.ignores(".gitignore")).toBe(true)

			// Fourth parameter should be RooIgnoreController
			const rooIgnoreController = createServicesCall[3]
			expect(rooIgnoreController).toBeDefined()
			expect(rooIgnoreController).toBe((manager as any)._rooIgnoreController)
		})
	})
})
