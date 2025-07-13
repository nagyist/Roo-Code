// Integration tests for command execution timeout functionality
// npx vitest run src/core/tools/__tests__/executeCommandTimeout.integration.spec.ts

import * as vscode from "vscode"
import { executeCommand, ExecuteCommandOptions } from "../executeCommandTool"
import { Task } from "../../task/Task"
import { TerminalRegistry } from "../../../integrations/terminal/TerminalRegistry"

// Mock dependencies
vitest.mock("vscode", () => ({
	workspace: {
		getConfiguration: vitest.fn(),
	},
}))

vitest.mock("../../../integrations/terminal/TerminalRegistry")
vitest.mock("../../task/Task")

describe("Command Execution Timeout Integration", () => {
	let mockTask: any
	let mockTerminal: any
	let mockProcess: any

	beforeEach(() => {
		vitest.clearAllMocks()

		// Mock task
		mockTask = {
			cwd: "/test/directory",
			terminalProcess: undefined,
			providerRef: {
				deref: vitest.fn().mockResolvedValue({
					postMessageToWebview: vitest.fn(),
				}),
			},
		}

		// Mock terminal process
		mockProcess = {
			abort: vitest.fn(),
			then: vitest.fn(),
			catch: vitest.fn(),
		}

		// Mock terminal
		mockTerminal = {
			runCommand: vitest.fn().mockReturnValue(mockProcess),
			getCurrentWorkingDirectory: vitest.fn().mockReturnValue("/test/directory"),
		}

		// Mock TerminalRegistry
		;(TerminalRegistry.getOrCreateTerminal as any).mockResolvedValue(mockTerminal)

		// Mock VSCode configuration
		const mockGetConfiguration = vitest.fn().mockReturnValue({
			get: vitest.fn().mockReturnValue(30000), // Default 30 second timeout
		})
		;(vscode.workspace.getConfiguration as any).mockReturnValue(mockGetConfiguration())
	})

	it("should pass timeout configuration to executeCommand", async () => {
		const customTimeout = 15000
		const options: ExecuteCommandOptions = {
			executionId: "test-execution",
			command: "echo test",
			commandExecutionTimeout: customTimeout,
		}

		// Mock a quick-completing process
		const quickProcess = Promise.resolve()
		mockTerminal.runCommand.mockReturnValue(quickProcess)

		await executeCommand(mockTask as Task, options)

		// Verify that the terminal was called with the command
		expect(mockTerminal.runCommand).toHaveBeenCalledWith("echo test", expect.any(Object))
	})

	it("should handle timeout scenario", async () => {
		const shortTimeout = 100 // Very short timeout
		const options: ExecuteCommandOptions = {
			executionId: "test-execution",
			command: "sleep 10",
			commandExecutionTimeout: shortTimeout,
		}

		// Mock a long-running process that never resolves
		const longRunningProcess = new Promise(() => {
			// Never resolves to simulate a hanging command
		})
		mockTerminal.runCommand.mockReturnValue(longRunningProcess)

		// Execute with timeout
		const result = await executeCommand(mockTask as Task, options)

		// Should return timeout error
		expect(result[0]).toBe(false) // Not rejected by user
		expect(result[1]).toContain("timed out")
		expect(result[1]).toContain(`${shortTimeout}ms`)
	})

	it("should abort process on timeout", async () => {
		const shortTimeout = 50
		const options: ExecuteCommandOptions = {
			executionId: "test-execution",
			command: "sleep 10",
			commandExecutionTimeout: shortTimeout,
		}

		// Create a process that can be aborted
		let abortCalled = false
		const mockAbortableProcess = {
			abort: () => {
				abortCalled = true
			},
			then: vitest.fn(),
			catch: vitest.fn(),
		}

		// Mock the process to never resolve but be abortable
		const neverResolvingPromise = new Promise(() => {})
		Object.assign(neverResolvingPromise, mockAbortableProcess)

		mockTerminal.runCommand.mockReturnValue(neverResolvingPromise)

		// Set the task's terminal process so it can be aborted
		mockTask.terminalProcess = mockAbortableProcess

		await executeCommand(mockTask as Task, options)

		// Verify abort was called
		expect(abortCalled).toBe(true)
	})

	it("should clean up timeout on successful completion", async () => {
		const options: ExecuteCommandOptions = {
			executionId: "test-execution",
			command: "echo test",
			commandExecutionTimeout: 5000,
		}

		// Mock a process that completes quickly
		const quickProcess = Promise.resolve()
		mockTerminal.runCommand.mockReturnValue(quickProcess)

		const result = await executeCommand(mockTask as Task, options)

		// Should complete successfully without timeout
		expect(result[0]).toBe(false) // Not rejected
		expect(result[1]).not.toContain("timed out")
	})

	it("should use default timeout when not specified", async () => {
		const options: ExecuteCommandOptions = {
			executionId: "test-execution",
			command: "echo test",
			// commandExecutionTimeout not specified, should use default
		}

		const quickProcess = Promise.resolve()
		mockTerminal.runCommand.mockReturnValue(quickProcess)

		await executeCommand(mockTask as Task, options)

		// Should complete without issues using default timeout
		expect(mockTerminal.runCommand).toHaveBeenCalled()
	})
})
