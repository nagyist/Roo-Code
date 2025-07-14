import React, { type HTMLAttributes } from "react"
import { Settings } from "lucide-react"
import { VSCodeCheckbox } from "@vscode/webview-ui-toolkit/react"
import { useAppTranslation } from "@src/i18n/TranslationContext"
import { SectionHeader } from "./SectionHeader"
import { Section } from "./Section"
import { StandardTooltip } from "@src/components/ui"
import { cn } from "@src/lib/utils"

type GeneralSettingsProps = HTMLAttributes<HTMLDivElement> & {
	codebaseIndexEnabled: boolean
	setCodebaseIndexEnabled: (enabled: boolean) => void
}

export const GeneralSettings = ({
	codebaseIndexEnabled,
	setCodebaseIndexEnabled,
	className,
	...props
}: GeneralSettingsProps) => {
	const { t } = useAppTranslation()

	return (
		<div className={cn("flex flex-col gap-2", className)} {...props}>
			<SectionHeader description={t("settings:general.description")}>
				<div className="flex items-center gap-2">
					<Settings className="w-4" />
					<div>{t("settings:sections.general")}</div>
				</div>
			</SectionHeader>

			<Section>
				{/* Codebase Indexing Enable/Disable */}
				<div className="flex flex-col gap-3">
					<div className="flex items-center gap-2 font-bold">
						<span className="codicon codicon-database" />
						<div>{t("settings:general.codebaseIndexing.label")}</div>
					</div>

					<div className="flex items-center gap-2">
						<VSCodeCheckbox
							checked={codebaseIndexEnabled}
							onChange={(e: any) => setCodebaseIndexEnabled(e.target.checked)}
							data-testid="codebase-indexing-enabled-checkbox">
							<span className="font-medium">{t("settings:general.codebaseIndexing.enableLabel")}</span>
						</VSCodeCheckbox>
						<StandardTooltip content={t("settings:general.codebaseIndexing.enableDescription")}>
							<span className="codicon codicon-info text-xs text-vscode-descriptionForeground cursor-help" />
						</StandardTooltip>
					</div>

					<div className="text-vscode-descriptionForeground text-sm">
						{t("settings:general.codebaseIndexing.description")}
					</div>
				</div>
			</Section>
		</div>
	)
}
