import { memo } from "react"
import { useTranslation } from "react-i18next"
import { FoldVertical } from "lucide-react"

import type { ClineMessage } from "@roo-code/types"

import { getModelMaxOutputTokens } from "@roo/api"

import { StandardTooltip } from "@src/components/ui"
import { useExtensionState } from "@src/context/ExtensionStateContext"
import { useSelectedModel } from "@/components/ui/hooks/useSelectedModel"

import { ContextWindowProgress } from "./ContextWindowProgress"
import { TodoListDisplay } from "./TodoListDisplay"

export interface TaskHeaderProps {
	task: ClineMessage
	contextTokens: number
	buttonsDisabled: boolean
	handleCondenseContext: (taskId: string) => void
	todos?: any[]
}

const TaskHeader = ({ task, contextTokens, buttonsDisabled, handleCondenseContext, todos }: TaskHeaderProps) => {
	const { t } = useTranslation()
	const { apiConfiguration, currentTaskItem } = useExtensionState()
	const { id: modelId, info: model } = useSelectedModel(apiConfiguration)

	const contextWindow = model?.contextWindow || 1

	const condenseButton = (
		<StandardTooltip content={t("chat:task.condenseContext")}>
			<button
				disabled={buttonsDisabled}
				onClick={() => currentTaskItem && handleCondenseContext(currentTaskItem.id)}
				className="shrink-0 min-h-[20px] min-w-[20px] p-[2px] cursor-pointer disabled:cursor-not-allowed opacity-85 hover:opacity-100 bg-transparent border-none rounded-md">
				<FoldVertical size={16} />
			</button>
		</StandardTooltip>
	)

	return (
		<div className="py-2 px-3">
			{/* Context Window Progress */}
			{contextWindow > 0 && (
				<div className="p-2.5 flex flex-col gap-1.5 relative z-1 border border-vscode-panel-border/80 rounded-xs mb-2">
					<div className="flex items-center gap-1 flex-shrink-0">
						<span className="font-bold text-sm text-vscode-foreground/80">
							{t("chat:task.contextWindow")}
						</span>
					</div>
					<div className="w-full flex flex-row items-center gap-1 h-auto">
						<ContextWindowProgress
							contextWindow={contextWindow}
							contextTokens={contextTokens || 0}
							maxTokens={
								model
									? getModelMaxOutputTokens({ modelId, model, settings: apiConfiguration })
									: undefined
							}
						/>
						{condenseButton}
					</div>
				</div>
			)}

			{/* Todo List */}
			<TodoListDisplay todos={todos ?? (task as any)?.tool?.todos ?? []} />
		</div>
	)
}

export default memo(TaskHeader)
