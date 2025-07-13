import os from "os"
import { getShell } from "../../../utils/shell"
import { ToolArgs } from "./types"

function getPlatformSpecificExamples(): string {
	const platform = os.platform()
	const shell = getShell()

	if (platform === "win32") {
		if (shell.toLowerCase().includes("powershell") || shell.toLowerCase().includes("pwsh")) {
			return `
**Platform-Specific Examples (Windows PowerShell):**
<execute_command>
<command>Get-ChildItem -Path . -Recurse -Name "*.js"</command>
</execute_command>

<execute_command>
<command>Copy-Item -Path "./source.txt" -Destination "./backup.txt"</command>
</execute_command>

<execute_command>
<command>npm install; npm run build</command>
</execute_command>`
		} else {
			return `
**Platform-Specific Examples (Windows Command Prompt):**
<execute_command>
<command>dir /s /b *.js</command>
</execute_command>

<execute_command>
<command>copy ".\\source.txt" ".\\backup.txt"</command>
</execute_command>

<execute_command>
<command>npm install && npm run build</command>
</execute_command>`
		}
	} else {
		// Unix-like systems (macOS, Linux)
		return `
**Platform-Specific Examples (Unix/Linux):**
<execute_command>
<command>find . -name "*.js" -type f</command>
</execute_command>

<execute_command>
<command>cp ./source.txt ./backup.txt</command>
</execute_command>

<execute_command>
<command>npm install && npm run build</command>
</execute_command>`
	}
}

export function getExecuteCommandDescription(args: ToolArgs): string | undefined {
	const platformExamples = getPlatformSpecificExamples()

	return `## execute_command
Description: Request to execute a CLI command on the system. Use this when you need to perform system operations or run specific commands to accomplish any step in the user's task. You must tailor your command to the user's system and provide a clear explanation of what the command does. For command chaining, use the appropriate chaining syntax for the user's shell. Prefer to execute complex CLI commands over creating executable scripts, as they are more flexible and easier to run. Prefer relative commands and paths that avoid location sensitivity for terminal consistency, e.g: \`touch ./testdata/example.file\`, \`dir ./examples/model1/data/yaml\`, or \`go test ./cmd/front --config ./cmd/front/config.yml\`. If directed by the user, you may open a terminal in a different directory by using the \`cwd\` parameter.

**IMPORTANT:** Always use commands appropriate for the current platform and shell. Refer to the Platform-Specific Terminal Context in the SYSTEM INFORMATION section for guidance on the correct syntax, commands, and conventions for your environment.

Parameters:
- command: (required) The CLI command to execute. This should be valid for the current operating system and shell. Ensure the command is properly formatted and does not contain any harmful instructions.
- cwd: (optional) The working directory to execute the command in (default: ${args.cwd})
Usage:
<execute_command>
<command>Your command here</command>
<cwd>Working directory path (optional)</cwd>
</execute_command>

Example: Requesting to execute npm run dev
<execute_command>
<command>npm run dev</command>
</execute_command>

Example: Requesting to execute directory listing in a specific directory
<execute_command>
<command>ls -la</command>
<cwd>/home/user/projects</cwd>
</execute_command>
${platformExamples}`
}
