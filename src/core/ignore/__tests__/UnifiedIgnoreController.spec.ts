// npx vitest core/ignore/__tests__/UnifiedIgnoreController.spec.ts

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { UnifiedIgnoreController } from "../UnifiedIgnoreController"
import * as fs from "fs/promises"
import * as path from "path"
import { fileExistsAtPath } from "../../../utils/fs"

// Mock dependencies
vi.mock("../../../utils/fs")
vi.mock("fs/promises")
vi.mock("vscode", () => ({
	workspace: {
		createFileSystemWatcher: vi.fn(() => ({
			onDidChange: vi.fn(() => ({ dispose: vi.fn() })),
			onDidCreate: vi.fn(() => ({ dispose: vi.fn() })),
			onDidDelete: vi.fn(() => ({ dispose: vi.fn() })),
			dispose: vi.fn(),
		})),
	},
	RelativePattern: vi.fn(),
}))

const mockFileExists = vi.mocked(fileExistsAtPath)
const mockReadFile = vi.mocked(fs.readFile)
const mockAccess = vi.mocked(fs.access)

const TEST_CWD = "/test/workspace"

describe("UnifiedIgnoreController", () => {
	let controller: UnifiedIgnoreController
	let consoleSpy: ReturnType<typeof vi.spyOn>

	beforeEach(() => {
		vi.clearAllMocks()
		consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})
	})

	afterEach(() => {
		if (controller) {
			controller.dispose()
		}
		consoleSpy.mockRestore()
	})

	describe("Initialization", () => {
		it("should initialize with .rooignore when it exists and has content", async () => {
			// Setup mocks for .rooignore
			mockFileExists.mockResolvedValueOnce(true) // .rooignore exists
			mockReadFile.mockResolvedValueOnce("node_modules/\n*.log\n")

			controller = new UnifiedIgnoreController(TEST_CWD)
			await controller.initialize()

			expect(controller.isUsingRooIgnore()).toBe(true)
			expect(controller.validateAccess("node_modules/package.json")).toBe(false)
			expect(controller.validateAccess("src/index.ts")).toBe(true)
		})

		it("should fallback to .gitignore when .rooignore is missing", async () => {
			// Setup mocks for missing .rooignore but existing .gitignore
			mockFileExists.mockResolvedValueOnce(false) // .rooignore doesn't exist
			mockAccess.mockResolvedValueOnce(undefined) // .gitignore exists
			mockReadFile.mockResolvedValueOnce("dist/\nbuild/\n")

			controller = new UnifiedIgnoreController(TEST_CWD)
			await controller.initialize()

			expect(controller.isUsingRooIgnore()).toBe(false)
			expect(controller.validateAccess("dist/main.js")).toBe(false)
			expect(controller.validateAccess("src/index.ts")).toBe(true)
		})

		it("should fallback to .gitignore when .rooignore is empty", async () => {
			// Setup mocks for empty .rooignore
			mockFileExists.mockResolvedValueOnce(true) // .rooignore exists
			mockReadFile.mockResolvedValueOnce("   \n\n  ") // but is empty/whitespace
			mockAccess.mockResolvedValueOnce(undefined) // .gitignore exists
			mockReadFile.mockResolvedValueOnce("temp/\n*.tmp\n")

			controller = new UnifiedIgnoreController(TEST_CWD)
			await controller.initialize()

			expect(controller.isUsingRooIgnore()).toBe(false)
			expect(controller.validateAccess("temp/file.txt")).toBe(false)
			expect(controller.validateAccess("test.tmp")).toBe(false)
			expect(controller.validateAccess("src/index.ts")).toBe(true)
		})

		it("should handle hierarchical .gitignore files", async () => {
			// Setup mocks for missing .rooignore and hierarchical .gitignore
			mockFileExists.mockResolvedValueOnce(false) // .rooignore doesn't exist

			// Mock hierarchical .gitignore discovery
			mockAccess
				.mockResolvedValueOnce(undefined) // /test/workspace/.gitignore exists
				.mockRejectedValueOnce(new Error("not found")) // /test/.gitignore doesn't exist
				.mockRejectedValueOnce(new Error("not found")) // /.gitignore doesn't exist

			mockReadFile.mockResolvedValueOnce("node_modules/\n*.log\n") // workspace .gitignore

			controller = new UnifiedIgnoreController(TEST_CWD)
			await controller.initialize()

			expect(controller.validateAccess("node_modules/package.json")).toBe(false)
			expect(controller.validateAccess("debug.log")).toBe(false)
			expect(controller.validateAccess("src/index.ts")).toBe(true)
		})
	})

	describe("File Access Validation", () => {
		beforeEach(async () => {
			// Setup with .rooignore content
			mockFileExists.mockResolvedValue(true)
			mockReadFile.mockResolvedValue("node_modules/\n*.log\nsecrets/\n")

			controller = new UnifiedIgnoreController(TEST_CWD)
			await controller.initialize()
		})

		it("should block access to ignored files", () => {
			expect(controller.validateAccess("node_modules/package.json")).toBe(false)
			expect(controller.validateAccess("debug.log")).toBe(false)
			expect(controller.validateAccess("secrets/api-key.txt")).toBe(false)
		})

		it("should allow access to non-ignored files", () => {
			expect(controller.validateAccess("src/index.ts")).toBe(true)
			expect(controller.validateAccess("README.md")).toBe(true)
			expect(controller.validateAccess("package.json")).toBe(true)
		})

		it("should handle relative paths correctly", () => {
			expect(controller.validateAccess("./src/index.ts")).toBe(true)
			expect(controller.validateAccess("../outside/file.txt")).toBe(true) // Outside cwd
		})

		it("should handle absolute paths by converting to relative", () => {
			const absolutePath = path.join(TEST_CWD, "node_modules", "package.json")
			expect(controller.validateAccess(absolutePath)).toBe(false)
		})
	})

	describe("Command Validation", () => {
		beforeEach(async () => {
			// Setup with .rooignore content
			mockFileExists.mockResolvedValue(true)
			mockReadFile.mockResolvedValue("secrets/\n*.env\n")

			controller = new UnifiedIgnoreController(TEST_CWD)
			await controller.initialize()
		})

		it("should block commands accessing ignored files", () => {
			expect(controller.validateCommand("cat secrets/api-key.txt")).toBe("secrets/api-key.txt")
			expect(controller.validateCommand("head .env")).toBe(".env")
			expect(controller.validateCommand("grep password secrets/config.txt")).toBe("secrets/config.txt")
		})

		it("should allow commands accessing non-ignored files", () => {
			expect(controller.validateCommand("cat src/index.ts")).toBeUndefined()
			expect(controller.validateCommand("head README.md")).toBeUndefined()
		})

		it("should handle command flags correctly", () => {
			expect(controller.validateCommand("cat -n src/index.ts")).toBeUndefined()
			expect(controller.validateCommand("grep -r pattern src/")).toBeUndefined()
		})

		it("should allow non-file-reading commands", () => {
			expect(controller.validateCommand("ls -la")).toBeUndefined()
			expect(controller.validateCommand("mkdir new-dir")).toBeUndefined()
			expect(controller.validateCommand("echo hello")).toBeUndefined()
		})
	})

	describe("Path Filtering", () => {
		beforeEach(async () => {
			// Setup with .rooignore content
			mockFileExists.mockResolvedValue(true)
			mockReadFile.mockResolvedValue("node_modules/\n*.log\ntemp/\n")

			controller = new UnifiedIgnoreController(TEST_CWD)
			await controller.initialize()
		})

		it("should filter out ignored paths", () => {
			const paths = [
				"src/index.ts",
				"node_modules/package.json",
				"README.md",
				"debug.log",
				"temp/cache.txt",
				"package.json",
			]

			const filtered = controller.filterPaths(paths)

			expect(filtered).toEqual(["src/index.ts", "README.md", "package.json"])
		})

		it("should handle empty path arrays", () => {
			expect(controller.filterPaths([])).toEqual([])
		})
	})

	describe("Instructions Generation", () => {
		it("should generate .rooignore instructions when using .rooignore", async () => {
			mockFileExists.mockResolvedValue(true)
			mockReadFile.mockResolvedValue("node_modules/\n*.log\n")

			controller = new UnifiedIgnoreController(TEST_CWD)
			await controller.initialize()

			const instructions = controller.getInstructions()

			expect(instructions).toContain("# .rooignore")
			expect(instructions).toContain("node_modules/")
			expect(instructions).toContain("*.log")
			expect(instructions).toContain("🔒")
		})

		it("should generate .gitignore fallback instructions when using .gitignore", async () => {
			mockFileExists.mockResolvedValue(false) // no .rooignore
			mockAccess.mockResolvedValue(undefined) // .gitignore exists
			mockReadFile.mockResolvedValue("dist/\nbuild/\n")

			controller = new UnifiedIgnoreController(TEST_CWD)
			await controller.initialize()

			const instructions = controller.getInstructions()

			expect(instructions).toContain("# .gitignore (fallback)")
			expect(instructions).toContain("dist/")
			expect(instructions).toContain("build/")
			expect(instructions).toContain("🔒")
		})

		it("should return undefined when no ignore files exist", async () => {
			mockFileExists.mockResolvedValue(false) // no .rooignore
			mockAccess.mockRejectedValue(new Error("not found")) // no .gitignore

			controller = new UnifiedIgnoreController(TEST_CWD)
			await controller.initialize()

			expect(controller.getInstructions()).toBeUndefined()
		})
	})

	describe("Error Handling", () => {
		it("should handle .rooignore read errors gracefully", async () => {
			mockFileExists.mockResolvedValue(true)
			mockReadFile.mockRejectedValueOnce(new Error("Permission denied"))
			mockAccess.mockResolvedValue(undefined) // fallback to .gitignore
			mockReadFile.mockResolvedValueOnce("dist/\n")

			controller = new UnifiedIgnoreController(TEST_CWD)
			await controller.initialize()

			// Should fallback to .gitignore
			expect(controller.isUsingRooIgnore()).toBe(false)
			expect(controller.validateAccess("dist/main.js")).toBe(false)
		})

		it("should handle .gitignore read errors gracefully", async () => {
			mockFileExists.mockResolvedValue(false) // no .rooignore
			mockAccess.mockResolvedValue(undefined) // .gitignore exists
			mockReadFile.mockRejectedValue(new Error("Permission denied"))

			controller = new UnifiedIgnoreController(TEST_CWD)
			await controller.initialize()

			// Should allow all access when both files fail
			expect(controller.validateAccess("any/file.txt")).toBe(true)
		})

		it("should handle path filtering errors gracefully", async () => {
			mockFileExists.mockResolvedValue(true)
			mockReadFile.mockResolvedValue("valid/pattern\n")

			controller = new UnifiedIgnoreController(TEST_CWD)
			await controller.initialize()

			// Mock an error in the filtering process
			const originalValidateAccess = controller.validateAccess
			vi.spyOn(controller, "validateAccess").mockImplementation(() => {
				throw new Error("Validation error")
			})

			const result = controller.filterPaths(["test.txt"])

			// Should return empty array on error (fail closed)
			expect(result).toEqual([])

			// Restore original method
			controller.validateAccess = originalValidateAccess
		})
	})

	describe("Fallback Behavior", () => {
		it("should prioritize .rooignore over .gitignore when both exist", async () => {
			// Setup both files existing
			mockFileExists.mockResolvedValue(true) // .rooignore exists
			mockReadFile.mockResolvedValueOnce("roo-specific/\n") // .rooignore content
			// .gitignore should not be read when .rooignore has content

			controller = new UnifiedIgnoreController(TEST_CWD)
			await controller.initialize()

			expect(controller.isUsingRooIgnore()).toBe(true)
			expect(controller.validateAccess("roo-specific/file.txt")).toBe(false)
		})

		it("should use .gitignore when .rooignore exists but is empty", async () => {
			mockFileExists.mockResolvedValue(true) // .rooignore exists
			mockReadFile.mockResolvedValueOnce("") // but is empty
			mockAccess.mockResolvedValue(undefined) // .gitignore exists
			mockReadFile.mockResolvedValueOnce("git-ignored/\n")

			controller = new UnifiedIgnoreController(TEST_CWD)
			await controller.initialize()

			expect(controller.isUsingRooIgnore()).toBe(false)
			expect(controller.validateAccess("git-ignored/file.txt")).toBe(false)
		})

		it("should allow all access when neither file exists", async () => {
			mockFileExists.mockResolvedValue(false) // no .rooignore
			mockAccess.mockRejectedValue(new Error("not found")) // no .gitignore

			controller = new UnifiedIgnoreController(TEST_CWD)
			await controller.initialize()

			expect(controller.validateAccess("any/file.txt")).toBe(true)
			expect(controller.validateCommand("cat any/file.txt")).toBeUndefined()
		})
	})
})
