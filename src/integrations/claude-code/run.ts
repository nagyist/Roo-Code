import * as vscode from "vscode"
import Anthropic from "@anthropic-ai/sdk"
import { execa } from "execa"

export function runClaudeCode({
	systemPrompt,
	messages,
	path,
	modelId,
	maxOutputTokens,
}: {
	systemPrompt: string
	messages: Anthropic.Messages.MessageParam[]
	path?: string
	modelId?: string
	maxOutputTokens?: number
}) {
	const claudePath = path || "claude"

	// TODO: Is it worh using sessions? Where do we store the session ID?
	const args = [
		"-p",
		JSON.stringify(messages),
		"--system-prompt",
		systemPrompt,
		"--verbose",
		"--output-format",
		"stream-json",
		// Cline will handle recursive calls
		"--max-turns",
		"1",
	]

	if (modelId) {
		args.push("--model", modelId)
	}

	const cwd = vscode.workspace.workspaceFolders?.map((folder) => folder.uri.fsPath).at(0)
	return execa(claudePath, args, {
		stdin: "ignore",
		stdout: "pipe",
		stderr: "pipe",
		env: {
			...process.env,
			// Use the configured value, or the environment variable, or default to 8000
			CLAUDE_CODE_MAX_OUTPUT_TOKENS:
				maxOutputTokens?.toString() || process.env.CLAUDE_CODE_MAX_OUTPUT_TOKENS || "8000",
		},
		cwd,
	})
}
