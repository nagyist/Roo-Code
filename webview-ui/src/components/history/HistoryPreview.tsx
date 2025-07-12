import { memo } from "react"

import { vscode } from "@/utils/vscode"
import { useTaskSearch } from "./useTaskSearch"
import TaskItem from "./TaskItem"

const HistoryPreview = () => {
	const { tasks } = useTaskSearch()

	const handleViewAllHistory = () => {
		vscode.postMessage({ type: "switchTab", tab: "history" })
	}

	return (
		<div className="flex flex-col gap-3">
			{tasks.length !== 0 && (
				<>
					{tasks.slice(0, 3).map((item) => (
						<TaskItem key={item.id} item={item} variant="compact" />
					))}
					<div className="flex justify-center mt-2">
						<button
							onClick={handleViewAllHistory}
							className="text-vscode-descriptionForeground hover:text-vscode-foreground text-sm cursor-pointer transition-colors duration-200 flex items-center gap-1">
							View all history →
						</button>
					</div>
				</>
			)}
		</div>
	)
}

export default memo(HistoryPreview)
