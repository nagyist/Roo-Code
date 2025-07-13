import { getToolDescriptionsForMode } from "../index"
import type { CodeIndexManager } from "../../../../services/code-index/manager"

describe("getToolDescriptionsForMode", () => {
	const mockCwd = "/test/workspace"
	const mockSupportsComputerUse = false

	// Mock CodeIndexManager with codebase search available (indexed state)
	const mockCodeIndexManagerIndexed = {
		isFeatureEnabled: true,
		isFeatureConfigured: true,
		isInitialized: true,
		state: "Indexed",
	} as CodeIndexManager

	// Mock CodeIndexManager with codebase search unavailable (disabled)
	const mockCodeIndexManagerDisabled = {
		isFeatureEnabled: false,
		isFeatureConfigured: false,
		isInitialized: false,
		state: "Standby",
	} as CodeIndexManager

	// Mock CodeIndexManager with indexing in progress
	const mockCodeIndexManagerIndexing = {
		isFeatureEnabled: true,
		isFeatureConfigured: true,
		isInitialized: true,
		state: "Indexing",
	} as CodeIndexManager

	// Mock CodeIndexManager in error state
	const mockCodeIndexManagerError = {
		isFeatureEnabled: true,
		isFeatureConfigured: true,
		isInitialized: true,
		state: "Error",
	} as CodeIndexManager

	describe("codebase_search tool availability", () => {
		it("should include codebase_search when manager is indexed", () => {
			const tools = getToolDescriptionsForMode(
				"code",
				mockCwd,
				mockSupportsComputerUse,
				mockCodeIndexManagerIndexed,
			)

			expect(tools).toContain("## codebase_search")
			expect(tools).toContain("Find files most relevant to the search query")
		})

		it("should exclude codebase_search when feature is disabled", () => {
			const tools = getToolDescriptionsForMode(
				"code",
				mockCwd,
				mockSupportsComputerUse,
				mockCodeIndexManagerDisabled,
			)

			expect(tools).not.toContain("## codebase_search")
		})

		it("should exclude codebase_search when indexing is in progress", () => {
			const tools = getToolDescriptionsForMode(
				"code",
				mockCwd,
				mockSupportsComputerUse,
				mockCodeIndexManagerIndexing,
			)

			expect(tools).not.toContain("## codebase_search")
		})

		it("should exclude codebase_search when manager is in error state", () => {
			const tools = getToolDescriptionsForMode(
				"code",
				mockCwd,
				mockSupportsComputerUse,
				mockCodeIndexManagerError,
			)

			expect(tools).not.toContain("## codebase_search")
		})

		it("should exclude codebase_search when manager is undefined", () => {
			const tools = getToolDescriptionsForMode("code", mockCwd, mockSupportsComputerUse, undefined)

			expect(tools).not.toContain("## codebase_search")
		})

		it("should exclude codebase_search when feature is enabled but not configured", () => {
			const mockCodeIndexManagerNotConfigured = {
				isFeatureEnabled: true,
				isFeatureConfigured: false,
				isInitialized: true,
				state: "Standby",
			} as CodeIndexManager

			const tools = getToolDescriptionsForMode(
				"code",
				mockCwd,
				mockSupportsComputerUse,
				mockCodeIndexManagerNotConfigured,
			)

			expect(tools).not.toContain("## codebase_search")
		})

		it("should exclude codebase_search when feature is configured but not initialized", () => {
			const mockCodeIndexManagerNotInitialized = {
				isFeatureEnabled: true,
				isFeatureConfigured: true,
				isInitialized: false,
				state: "Standby",
			} as CodeIndexManager

			const tools = getToolDescriptionsForMode(
				"code",
				mockCwd,
				mockSupportsComputerUse,
				mockCodeIndexManagerNotInitialized,
			)

			expect(tools).not.toContain("## codebase_search")
		})
	})

	describe("other tools availability", () => {
		it("should always include basic tools regardless of codebase_search availability", () => {
			const toolsWithCodebaseSearch = getToolDescriptionsForMode(
				"code",
				mockCwd,
				mockSupportsComputerUse,
				mockCodeIndexManagerIndexed,
			)

			const toolsWithoutCodebaseSearch = getToolDescriptionsForMode(
				"code",
				mockCwd,
				mockSupportsComputerUse,
				mockCodeIndexManagerDisabled,
			)

			// Check that basic tools are present in both cases
			for (const tools of [toolsWithCodebaseSearch, toolsWithoutCodebaseSearch]) {
				expect(tools).toContain("## read_file")
				expect(tools).toContain("## write_to_file")
				expect(tools).toContain("## search_files")
				expect(tools).toContain("## list_files")
			}
		})
	})
})
