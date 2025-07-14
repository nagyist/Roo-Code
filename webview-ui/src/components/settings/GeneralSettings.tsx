import React from "react"
import { VSCodeCheckbox } from "@vscode/webview-ui-toolkit/react"
import { useExtensionState } from "@/context/ExtensionStateContext"
import { useAppTranslation } from "@/i18n/TranslationContext"
import { vscode } from "@/utils/vscode"

export const GeneralSettings: React.FC = () => {
	const { t } = useAppTranslation()
	const { codebaseIndexConfig } = useExtensionState()

	const updateSetting = (key: string, value: any) => {
		vscode.postMessage({
			type: "saveCodeIndexSettingsAtomic",
			codeIndexSettings: {
				codebaseIndexEnabled: codebaseIndexConfig?.codebaseIndexEnabled ?? true,
				codebaseIndexQdrantUrl: codebaseIndexConfig?.codebaseIndexQdrantUrl ?? "",
				codebaseIndexEmbedderProvider: codebaseIndexConfig?.codebaseIndexEmbedderProvider ?? "openai",
				codebaseIndexEmbedderBaseUrl: codebaseIndexConfig?.codebaseIndexEmbedderBaseUrl,
				codebaseIndexEmbedderModelId: codebaseIndexConfig?.codebaseIndexEmbedderModelId ?? "",
				codebaseIndexEmbedderModelDimension: codebaseIndexConfig?.codebaseIndexEmbedderModelDimension,
				codebaseIndexSearchMaxResults: codebaseIndexConfig?.codebaseIndexSearchMaxResults,
				codebaseIndexSearchMinScore: codebaseIndexConfig?.codebaseIndexSearchMinScore,
				codebaseIndexOpenAiCompatibleBaseUrl: codebaseIndexConfig?.codebaseIndexOpenAiCompatibleBaseUrl,
				...codebaseIndexConfig,
				[key]: value,
			},
		})
	}

	return (
		<div className="space-y-4">
			<div className="space-y-2">
				<h3 className="text-lg font-medium text-vscode-foreground">
					{t("settings:general.codebaseIndexing.title")}
				</h3>
				<p className="text-sm text-vscode-descriptionForeground">
					{t("settings:general.codebaseIndexing.description")}
				</p>
				<VSCodeCheckbox
					checked={codebaseIndexConfig?.codebaseIndexEnabled ?? true}
					onChange={(e: any) => updateSetting("codebaseIndexEnabled", e.target.checked)}>
					{t("settings:general.codebaseIndexing.enabled")}
				</VSCodeCheckbox>
			</div>
		</div>
	)
}
