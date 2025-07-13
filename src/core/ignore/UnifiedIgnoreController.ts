import path from "path"
import { fileExistsAtPath } from "../../utils/fs"
import fs from "fs/promises"
import ignore, { Ignore } from "ignore"
import * as vscode from "vscode"

export const LOCK_TEXT_SYMBOL = "\u{1F512}"

/**
 * Unified controller that handles both .gitignore and .rooignore patterns
 * with proper fallback behavior. When .rooignore is missing or empty,
 * falls back to .gitignore patterns for consistent file filtering.
 */
export class UnifiedIgnoreController {
	private cwd: string
	private ignoreInstance: Ignore
	private disposables: vscode.Disposable[] = []
	private rooIgnoreContent: string | undefined
	private gitIgnoreContent: string | undefined
	private hasRooIgnore: boolean = false

	constructor(cwd: string) {
		this.cwd = cwd
		this.ignoreInstance = ignore()
		this.rooIgnoreContent = undefined
		this.gitIgnoreContent = undefined
		this.setupFileWatchers()
	}

	/**
	 * Initialize the controller by loading both .gitignore and .rooignore patterns
	 * Must be called after construction and before using the controller
	 */
	async initialize(): Promise<void> {
		await this.loadIgnorePatterns()
	}

	/**
	 * Set up file watchers for both .gitignore and .rooignore changes
	 */
	private setupFileWatchers(): void {
		// Watch .rooignore
		const rooignorePattern = new vscode.RelativePattern(this.cwd, ".rooignore")
		const rooIgnoreWatcher = vscode.workspace.createFileSystemWatcher(rooignorePattern)

		// Watch .gitignore
		const gitignorePattern = new vscode.RelativePattern(this.cwd, ".gitignore")
		const gitIgnoreWatcher = vscode.workspace.createFileSystemWatcher(gitignorePattern)

		// Set up event handlers for .rooignore
		this.disposables.push(
			rooIgnoreWatcher.onDidChange(() => this.loadIgnorePatterns()),
			rooIgnoreWatcher.onDidCreate(() => this.loadIgnorePatterns()),
			rooIgnoreWatcher.onDidDelete(() => this.loadIgnorePatterns()),
			rooIgnoreWatcher,
		)

		// Set up event handlers for .gitignore
		this.disposables.push(
			gitIgnoreWatcher.onDidChange(() => this.loadIgnorePatterns()),
			gitIgnoreWatcher.onDidCreate(() => this.loadIgnorePatterns()),
			gitIgnoreWatcher.onDidDelete(() => this.loadIgnorePatterns()),
			gitIgnoreWatcher,
		)
	}

	/**
	 * Load patterns from both .gitignore and .rooignore files with proper fallback logic
	 */
	private async loadIgnorePatterns(): Promise<void> {
		try {
			// Reset ignore instance to prevent duplicate patterns
			this.ignoreInstance = ignore()

			// Load .rooignore first (higher priority)
			const rooIgnorePath = path.join(this.cwd, ".rooignore")
			this.hasRooIgnore = await fileExistsAtPath(rooIgnorePath)

			if (this.hasRooIgnore) {
				try {
					this.rooIgnoreContent = await fs.readFile(rooIgnorePath, "utf8")
					// Only use .rooignore if it has actual content (not just whitespace)
					const hasContent = this.rooIgnoreContent.trim().length > 0
					if (hasContent) {
						this.ignoreInstance.add(this.rooIgnoreContent)
						this.ignoreInstance.add(".rooignore")
						return // Use .rooignore exclusively when it exists and has content
					}
				} catch (error) {
					console.error("Error reading .rooignore:", error)
					this.rooIgnoreContent = undefined
					this.hasRooIgnore = false
				}
			} else {
				this.rooIgnoreContent = undefined
			}

			// Fallback to .gitignore when .rooignore is missing or empty
			await this.loadGitIgnorePatterns()
		} catch (error) {
			console.error("Unexpected error loading ignore patterns:", error)
		}
	}

	/**
	 * Load .gitignore patterns hierarchically (from workspace root up to current directory)
	 */
	private async loadGitIgnorePatterns(): Promise<void> {
		try {
			// Find all .gitignore files from the current directory up to the workspace root
			const gitignoreFiles = await this.findGitignoreFiles(this.cwd)

			let hasGitIgnoreContent = false
			let combinedGitIgnoreContent = ""

			// Add patterns from all .gitignore files (root first, then more specific ones)
			for (const gitignoreFile of gitignoreFiles) {
				try {
					const content = await fs.readFile(gitignoreFile, "utf8")
					if (content.trim().length > 0) {
						this.ignoreInstance.add(content)
						hasGitIgnoreContent = true
						combinedGitIgnoreContent += content + "\n"
						// Store content from the most specific .gitignore (usually the one in cwd)
						if (path.dirname(gitignoreFile) === this.cwd) {
							this.gitIgnoreContent = content
						}
					}
				} catch (err) {
					console.warn(`Error reading .gitignore at ${gitignoreFile}: ${err}`)
				}
			}

			// If we found .gitignore content but no specific one in cwd, use combined content
			if (hasGitIgnoreContent && !this.gitIgnoreContent) {
				this.gitIgnoreContent = combinedGitIgnoreContent.trim()
			}

			// Always ignore .gitignore files themselves
			if (hasGitIgnoreContent) {
				this.ignoreInstance.add(".gitignore")
			}
		} catch (error) {
			console.error("Error loading .gitignore patterns:", error)
		}
	}

	/**
	 * Find all .gitignore files from the given directory up to the workspace root
	 */
	private async findGitignoreFiles(startPath: string): Promise<string[]> {
		const gitignoreFiles: string[] = []
		let currentPath = startPath

		// Walk up the directory tree looking for .gitignore files
		while (currentPath && currentPath !== path.dirname(currentPath)) {
			const gitignorePath = path.join(currentPath, ".gitignore")

			try {
				await fs.access(gitignorePath)
				gitignoreFiles.push(gitignorePath)
			} catch {
				// .gitignore doesn't exist at this level, continue
			}

			// Move up one directory
			const parentPath = path.dirname(currentPath)
			if (parentPath === currentPath) {
				break // Reached root
			}
			currentPath = parentPath
		}

		// Return in reverse order (root .gitignore first, then more specific ones)
		return gitignoreFiles.reverse()
	}

	/**
	 * Check if a file should be accessible to the LLM
	 * @param filePath - Path to check (relative to cwd)
	 * @returns true if file is accessible, false if ignored
	 */
	validateAccess(filePath: string): boolean {
		try {
			// Normalize path to be relative to cwd and use forward slashes
			const absolutePath = path.resolve(this.cwd, filePath)
			const relativePath = path.relative(this.cwd, absolutePath).replace(/\\/g, "/")

			// Use the unified ignore instance which contains either .rooignore or .gitignore patterns
			return !this.ignoreInstance.ignores(relativePath)
		} catch (error) {
			// Ignore is designed to work with relative file paths, so will throw error for paths outside cwd.
			// We are allowing access to all files outside cwd.
			return true
		}
	}

	/**
	 * Check if a terminal command should be allowed to execute based on file access patterns
	 * @param command - Terminal command to validate
	 * @returns path of file that is being accessed if it is being accessed, undefined if command is allowed
	 */
	validateCommand(command: string): string | undefined {
		// Always allow if no ignore patterns are loaded
		if (!this.rooIgnoreContent && !this.gitIgnoreContent) {
			return undefined
		}

		// Split command into parts and get the base command
		const parts = command.trim().split(/\s+/)
		const baseCommand = parts[0].toLowerCase()

		// Commands that read file contents
		const fileReadingCommands = [
			// Unix commands
			"cat",
			"less",
			"more",
			"head",
			"tail",
			"grep",
			"awk",
			"sed",
			// PowerShell commands and aliases
			"get-content",
			"gc",
			"type",
			"select-string",
			"sls",
		]

		if (fileReadingCommands.includes(baseCommand)) {
			// Check each argument that could be a file path
			for (let i = 1; i < parts.length; i++) {
				const arg = parts[i]
				// Skip command flags/options (both Unix and PowerShell style)
				if (arg.startsWith("-") || arg.startsWith("/")) {
					continue
				}
				// Ignore PowerShell parameter names
				if (arg.includes(":")) {
					continue
				}
				// Validate file access
				if (!this.validateAccess(arg)) {
					return arg
				}
			}
		}

		return undefined
	}

	/**
	 * Filter an array of paths, removing those that should be ignored
	 * @param paths - Array of paths to filter (relative to cwd)
	 * @returns Array of allowed paths
	 */
	filterPaths(paths: string[]): string[] {
		try {
			return paths
				.map((p) => ({
					path: p,
					allowed: this.validateAccess(p),
				}))
				.filter((x) => x.allowed)
				.map((x) => x.path)
		} catch (error) {
			console.error("Error filtering paths:", error)
			return [] // Fail closed for security
		}
	}

	/**
	 * Get the current ignore instance for external use
	 * @returns The ignore instance containing the current patterns
	 */
	getIgnoreInstance(): Ignore {
		return this.ignoreInstance
	}

	/**
	 * Check if .rooignore file exists and has content
	 * @returns true if .rooignore is being used, false if falling back to .gitignore
	 */
	isUsingRooIgnore(): boolean {
		return this.hasRooIgnore && !!this.rooIgnoreContent?.trim()
	}

	/**
	 * Get formatted instructions about the ignore files for the LLM
	 * @returns Formatted instructions or undefined if no ignore files exist
	 */
	getInstructions(): string | undefined {
		if (this.isUsingRooIgnore()) {
			return `# .rooignore\n\n(The following is provided by a root-level .rooignore file where the user has specified files and directories that should not be accessed. When using list_files, you'll notice a ${LOCK_TEXT_SYMBOL} next to files that are blocked. Attempting to access the file's contents e.g. through read_file will result in an error.)\n\n${this.rooIgnoreContent}\n.rooignore`
		} else if (this.gitIgnoreContent) {
			return `# .gitignore (fallback)\n\n(The following patterns are being used from .gitignore since no .rooignore file was found. Files matching these patterns will be excluded from indexing and file operations. When using list_files, you'll notice a ${LOCK_TEXT_SYMBOL} next to files that are blocked.)\n\n${this.gitIgnoreContent}`
		}

		return undefined
	}

	/**
	 * Clean up resources when the controller is no longer needed
	 */
	dispose(): void {
		this.disposables.forEach((d) => d.dispose())
		this.disposables = []
	}
}
