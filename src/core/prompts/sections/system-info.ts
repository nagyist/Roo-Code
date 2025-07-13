import os from "os"
import osName from "os-name"

import { getShell } from "../../../utils/shell"

function getPlatformSpecificTerminalGuidance(): string {
	const platform = os.platform()
	const shell = getShell()

	if (platform === "win32") {
		// Windows-specific guidance
		if (shell.toLowerCase().includes("powershell") || shell.toLowerCase().includes("pwsh")) {
			return `
**Platform-Specific Terminal Context (Windows PowerShell):**
- Use PowerShell cmdlets and syntax (e.g., Get-ChildItem instead of ls, Set-Location instead of cd)
- Use PowerShell operators: -eq, -ne, -like, -match for comparisons
- Use PowerShell path separators: backslashes or forward slashes (both work)
- For file operations: Copy-Item, Move-Item, Remove-Item, New-Item
- For process management: Get-Process, Stop-Process, Start-Process
- Use PowerShell variables with $ prefix: $env:PATH, $PSVersionTable
- Chain commands with semicolons (;) or pipeline operators (|)
- Use PowerShell-specific redirection: > for output, 2>&1 for error redirection`
		} else {
			return `
**Platform-Specific Terminal Context (Windows Command Prompt):**
- Use Windows CMD commands: dir, copy, move, del, md, rd
- Use Windows path separators: backslashes (\\)
- Use Windows environment variables: %PATH%, %USERPROFILE%, %TEMP%
- Chain commands with && (success) or || (failure) or & (always)
- Use Windows-specific tools: where, findstr, tasklist, taskkill
- For file operations: copy, xcopy, robocopy, del, ren
- Use CMD redirection: > for output, 2>nul for error suppression`
		}
	} else if (platform === "darwin") {
		// macOS-specific guidance
		if (shell.includes("zsh")) {
			return `
**Platform-Specific Terminal Context (macOS Zsh):**
- Use Unix/POSIX commands: ls, cp, mv, rm, mkdir, rmdir
- Use forward slashes (/) for path separators
- Use Zsh-specific features: extended globbing, parameter expansion
- Use macOS-specific commands: open, pbcopy, pbpaste, say, osascript
- Use Homebrew package manager commands: brew install, brew update
- Chain commands with && (success) or || (failure) or ; (always)
- Use Unix environment variables: $PATH, $HOME, $USER
- Use Zsh redirection: > for output, 2>/dev/null for error suppression`
		} else {
			return `
**Platform-Specific Terminal Context (macOS Bash):**
- Use Unix/POSIX commands: ls, cp, mv, rm, mkdir, rmdir
- Use forward slashes (/) for path separators
- Use Bash-specific features: arrays, functions, conditionals
- Use macOS-specific commands: open, pbcopy, pbpaste, say, osascript
- Use package managers: brew (Homebrew), port (MacPorts)
- Chain commands with && (success) or || (failure) or ; (always)
- Use Unix environment variables: $PATH, $HOME, $USER
- Use Bash redirection: > for output, 2>/dev/null for error suppression`
		}
	} else {
		// Linux and other Unix-like systems
		if (shell.includes("zsh")) {
			return `
**Platform-Specific Terminal Context (Linux Zsh):**
- Use Unix/POSIX commands: ls, cp, mv, rm, mkdir, rmdir
- Use forward slashes (/) for path separators
- Use Zsh-specific features: extended globbing, parameter expansion
- Use Linux-specific commands: systemctl, journalctl, ps, top, htop
- Use package managers: apt, yum, dnf, pacman, zypper (distribution-specific)
- Chain commands with && (success) or || (failure) or ; (always)
- Use Unix environment variables: $PATH, $HOME, $USER
- Use Zsh redirection: > for output, 2>/dev/null for error suppression`
		} else {
			return `
**Platform-Specific Terminal Context (Linux Bash):**
- Use Unix/POSIX commands: ls, cp, mv, rm, mkdir, rmdir
- Use forward slashes (/) for path separators
- Use Bash-specific features: arrays, functions, conditionals
- Use Linux-specific commands: systemctl, journalctl, ps, top, htop
- Use package managers: apt, yum, dnf, pacman, zypper (distribution-specific)
- Chain commands with && (success) or || (failure) or ; (always)
- Use Unix environment variables: $PATH, $HOME, $USER
- Use Bash redirection: > for output, 2>/dev/null for error suppression`
		}
	}
}

export function getSystemInfoSection(cwd: string): string {
	const platformGuidance = getPlatformSpecificTerminalGuidance()

	let details = `====

SYSTEM INFORMATION

Operating System: ${osName()}
Default Shell: ${getShell()}
Home Directory: ${os.homedir().toPosix()}
Current Workspace Directory: ${cwd.toPosix()}
${platformGuidance}

The Current Workspace Directory is the active VS Code project directory, and is therefore the default directory for all tool operations. New terminals will be created in the current workspace directory, however if you change directories in a terminal it will then have a different working directory; changing directories in a terminal does not modify the workspace directory, because you do not have access to change the workspace directory. When the user initially gives you a task, a recursive list of all filepaths in the current workspace directory ('/test/path') will be included in environment_details. This provides an overview of the project's file structure, offering key insights into the project from directory/file names (how developers conceptualize and organize their code) and file extensions (the language used). This can also guide decision-making on which files to explore further. If you need to further explore directories such as outside the current workspace directory, you can use the list_files tool. If you pass 'true' for the recursive parameter, it will list files recursively. Otherwise, it will list files at the top level, which is better suited for generic directories where you don't necessarily need the nested structure, like the Desktop.`

	return details
}
