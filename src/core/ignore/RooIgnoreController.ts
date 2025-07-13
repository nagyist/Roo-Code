import path from "path"
import { fileExistsAtPath } from "../../utils/fs"
import fs from "fs/promises"
import ignore, { Ignore } from "ignore"
import * as vscode from "vscode"

export const LOCK_TEXT_SYMBOL = "\u{1F512}"

/**
 * Controls LLM access to files by enforcing ignore patterns.
 * Designed to be instantiated once in Cline.ts and passed to file manipulation services.
 * Uses the 'ignore' library to support standard .gitignore syntax in .rooignore files.
 */
export class RooIgnoreController {
	private cwd: string
	private ignoreInstance: Ignore
	private disposables: vscode.Disposable[] = []
	rooIgnoreContent: string | undefined
	private gitIgnoreContent: string | undefined
	private currentIgnoreSource: "rooignore" | "gitignore" | "default" | "none" = "none"

	constructor(cwd: string) {
		this.cwd = cwd
		this.ignoreInstance = ignore()
		this.rooIgnoreContent = undefined
		// Set up file watchers for both .rooignore and .gitignore
		this.setupFileWatchers()
	}

	/**
	 * Initialize the controller by loading custom patterns
	 * Must be called after construction and before using the controller
	 */
	async initialize(): Promise<void> {
		await this.loadIgnorePatterns()
	}

	/**
	 * Set up file watchers for both .rooignore and .gitignore changes
	 */
	private setupFileWatchers(): void {
		// Watch .rooignore
		const rooignorePattern = new vscode.RelativePattern(this.cwd, ".rooignore")
		const rooignoreWatcher = vscode.workspace.createFileSystemWatcher(rooignorePattern)

		// Watch .gitignore
		const gitignorePattern = new vscode.RelativePattern(this.cwd, ".gitignore")
		const gitignoreWatcher = vscode.workspace.createFileSystemWatcher(gitignorePattern)

		// Watch for changes and updates to both files
		this.disposables.push(
			rooignoreWatcher.onDidChange(() => {
				this.loadIgnorePatterns()
			}),
			rooignoreWatcher.onDidCreate(() => {
				this.loadIgnorePatterns()
			}),
			rooignoreWatcher.onDidDelete(() => {
				this.loadIgnorePatterns()
			}),
			gitignoreWatcher.onDidChange(() => {
				this.loadIgnorePatterns()
			}),
			gitignoreWatcher.onDidCreate(() => {
				this.loadIgnorePatterns()
			}),
			gitignoreWatcher.onDidDelete(() => {
				this.loadIgnorePatterns()
			}),
		)

		// Add fileWatchers themselves to disposables
		this.disposables.push(rooignoreWatcher, gitignoreWatcher)
	}

	/**
	 * Load ignore patterns with .gitignore fallback support
	 */
	private async loadIgnorePatterns(): Promise<void> {
		try {
			// Reset ignore instance to prevent duplicate patterns
			this.ignoreInstance = ignore()

			// Try to load .rooignore first
			const rooIgnorePath = path.join(this.cwd, ".rooignore")
			const rooIgnoreExists = await fileExistsAtPath(rooIgnorePath)

			if (rooIgnoreExists) {
				const content = await fs.readFile(rooIgnorePath, "utf8")
				const trimmedContent = content.trim()

				if (trimmedContent) {
					// .rooignore exists and has content - use it exclusively
					this.rooIgnoreContent = content
					this.gitIgnoreContent = undefined
					this.currentIgnoreSource = "rooignore"
					this.ignoreInstance.add(content)
					this.ignoreInstance.add(".rooignore")
					return
				} else {
					// .rooignore exists but is empty - fall back to .gitignore
					this.rooIgnoreContent = content
				}
			} else {
				this.rooIgnoreContent = undefined
			}

			// Try to load .gitignore as fallback
			const gitIgnorePath = path.join(this.cwd, ".gitignore")
			const gitIgnoreExists = await fileExistsAtPath(gitIgnorePath)

			if (gitIgnoreExists) {
				const content = await fs.readFile(gitIgnorePath, "utf8")
				this.gitIgnoreContent = content
				this.currentIgnoreSource = "gitignore"
				this.ignoreInstance.add(content)
				this.ignoreInstance.add(".gitignore")
			} else {
				// Neither file exists - use default patterns for common directories
				this.gitIgnoreContent = undefined
				this.currentIgnoreSource = "default"
				this.addDefaultIgnorePatterns()
			}
		} catch (error) {
			console.error("Unexpected error loading ignore patterns:", error)
			// Fallback to default patterns on error
			this.currentIgnoreSource = "default"
			this.addDefaultIgnorePatterns()
		}
	}

	/**
	 * Add default ignore patterns for common directories that should typically be excluded
	 */
	private addDefaultIgnorePatterns(): void {
		const defaultPatterns = [
			"node_modules/",
			"vendor/",
			".git/",
			".svn/",
			".hg/",
			"dist/",
			"build/",
			"out/",
			"target/",
			"*.log",
			".DS_Store",
			"Thumbs.db",
		]

		this.ignoreInstance.add(defaultPatterns)
	}

	/**
	 * Load custom patterns from .rooignore if it exists
	 * @deprecated Use loadIgnorePatterns() instead
	 */
	private async loadRooIgnore(): Promise<void> {
		await this.loadIgnorePatterns()
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
			const relativePath = path.relative(this.cwd, absolutePath).toPosix()

			// Use the unified ignore instance which now handles .rooignore, .gitignore, or default patterns
			return !this.ignoreInstance.ignores(relativePath)
		} catch (error) {
			// console.error(`Error validating access for ${filePath}:`, error)
			// Ignore is designed to work with relative file paths, so will throw error for paths outside cwd. We are allowing access to all files outside cwd.
			return true
		}
	}

	/**
	 * Check if a terminal command should be allowed to execute based on file access patterns
	 * @param command - Terminal command to validate
	 * @returns path of file that is being accessed if it is being accessed, undefined if command is allowed
	 */
	validateCommand(command: string): string | undefined {
		// Use unified ignore patterns (rooignore, gitignore, or defaults)

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
	 * Clean up resources when the controller is no longer needed
	 */
	dispose(): void {
		this.disposables.forEach((d) => d.dispose())
		this.disposables = []
	}

	/**
	 * Get the current ignore source being used
	 * @returns The source of ignore patterns currently in use
	 */
	getIgnoreSource(): "rooignore" | "gitignore" | "default" | "none" {
		return this.currentIgnoreSource
	}

	/**
	 * Get formatted instructions about the ignore patterns for the LLM
	 * @returns Formatted instructions or undefined if no patterns are active
	 */
	getInstructions(): string | undefined {
		switch (this.currentIgnoreSource) {
			case "rooignore":
				return `# .rooignore\n\n(The following is provided by a root-level .rooignore file where the user has specified files and directories that should not be accessed. When using list_files, you'll notice a ${LOCK_TEXT_SYMBOL} next to files that are blocked. Attempting to access the file's contents e.g. through read_file will result in an error.)\n\n${this.rooIgnoreContent}\n.rooignore`

			case "gitignore":
				return `# .gitignore (fallback)\n\n(The following is provided by a root-level .gitignore file being used as fallback since no .rooignore file was found or it was empty. When using list_files, you'll notice a ${LOCK_TEXT_SYMBOL} next to files that are blocked. Attempting to access the file's contents e.g. through read_file will result in an error.)\n\n${this.gitIgnoreContent}\n.gitignore`

			case "default":
				return `# Default ignore patterns\n\n(The following default ignore patterns are being used since neither .rooignore nor .gitignore files were found. These patterns exclude common directories that are typically not needed for code analysis. When using list_files, you'll notice a ${LOCK_TEXT_SYMBOL} next to files that are blocked.)\n\nnode_modules/\nvendor/\n.git/\n.svn/\n.hg/\ndist/\nbuild/\nout/\ntarget/\n*.log\n.DS_Store\nThumbs.db`

			default:
				return undefined
		}
	}
}
