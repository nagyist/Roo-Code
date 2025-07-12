import React, { useState } from "react"
import { useAppTranslation } from "@/i18n/TranslationContext"
import { VSCodeButton } from "@vscode/webview-ui-toolkit/react"
import { DiffSettingsControl } from "./DiffSettingsControl"
import { TodoListSettingsControl } from "./TodoListSettingsControl"

interface AdvancedSettingsSectionProps {
	diffEnabled?: boolean
	fuzzyMatchThreshold?: number
	todoListEnabled?: boolean
	onChange: (field: "diffEnabled" | "fuzzyMatchThreshold" | "todoListEnabled", value: any) => void
	children?: React.ReactNode
}

export const AdvancedSettingsSection: React.FC<AdvancedSettingsSectionProps> = ({
	diffEnabled,
	fuzzyMatchThreshold,
	todoListEnabled,
	onChange,
	children,
}) => {
	const { t } = useAppTranslation()
	const [isExpanded, setIsExpanded] = useState(false)

	const toggleExpanded = () => {
		setIsExpanded(!isExpanded)
	}

	return (
		<div className="flex flex-col gap-3">
			<VSCodeButton
				appearance="secondary"
				onClick={toggleExpanded}
				className="flex items-center justify-between w-full text-left">
				<span className="font-medium whitespace-nowrap">{t("settings:advanced.section.label")}</span>
				<span className="ml-2">{isExpanded ? "▼" : "▶"}</span>
			</VSCodeButton>

			{isExpanded && (
				<div className="flex flex-col gap-4 pl-4 border-l-2 border-vscode-button-background">
					<DiffSettingsControl
						diffEnabled={diffEnabled}
						fuzzyMatchThreshold={fuzzyMatchThreshold}
						onChange={onChange}
					/>
					<TodoListSettingsControl todoListEnabled={todoListEnabled} onChange={onChange} />
					{children}
				</div>
			)}
		</div>
	)
}
