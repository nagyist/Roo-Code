import React from "react"
import { VSCodeButton } from "@vscode/webview-ui-toolkit/react"
import { formatLargeNumber } from "@src/utils/format"
import type { ClineMessage } from "@roo-code/types"

interface TaskActivityBarProps {
	task: ClineMessage
	tokensIn: number
	tokensOut: number
	cacheWrites: number
	cacheReads: number
	totalCost: number
	onClose: () => void
}

export const TaskActivityBar: React.FC<TaskActivityBarProps> = ({
	task,
	tokensIn,
	tokensOut,
	cacheWrites,
	cacheReads,
	totalCost,
	onClose,
}) => {
	if (!task) {
		return null
	}

	const totalTokens = tokensIn + tokensOut + cacheWrites + cacheReads
	const taskText = task.text || ""

	return (
		<div className="bg-vscode-editor-background border-b border-vscode-panel-border p-3">
			<div className="flex items-center justify-between gap-4">
				{/* Task Text */}
				<div className="flex-1 min-w-0">
					<div className="text-sm text-vscode-foreground font-medium truncate" title={taskText}>
						{taskText}
					</div>
				</div>

				{/* Metrics */}
				<div className="flex items-center gap-4 text-xs text-vscode-descriptionForeground">
					{/* Tokens */}
					{totalTokens > 0 && (
						<div className="flex items-center gap-2">
							<span>Tokens: {formatLargeNumber(totalTokens)}</span>
							{(cacheWrites > 0 || cacheReads > 0) && (
								<span className="text-vscode-charts-blue">
									(Cache: {formatLargeNumber(cacheWrites + cacheReads)})
								</span>
							)}
						</div>
					)}

					{/* Cost */}
					{totalCost !== undefined && totalCost > 0 && (
						<div className="text-vscode-charts-green">Cost: ${totalCost.toFixed(2)}</div>
					)}
				</div>

				{/* Actions */}
				<div className="flex items-center gap-2">
					<VSCodeButton appearance="icon" onClick={onClose} title="Close Task" className="!p-1">
						<span className="codicon codicon-close"></span>
					</VSCodeButton>
				</div>
			</div>
		</div>
	)
}
