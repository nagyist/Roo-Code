import React, { useState } from "react"
import { useAppTranslation } from "@src/i18n/TranslationContext"
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	Checkbox,
} from "@src/components/ui"

interface MessageModificationConfirmationDialogProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	onConfirm: (dontShowAgain: boolean) => void
	type: "edit" | "delete"
}

export const MessageModificationConfirmationDialog: React.FC<MessageModificationConfirmationDialogProps> = ({
	open,
	onOpenChange,
	onConfirm,
	type,
}) => {
	const { t } = useAppTranslation()
	const [dontShowAgain, setDontShowAgain] = useState(false)

	const isEdit = type === "edit"
	const title = isEdit ? t("common:confirmation.edit_message") : t("common:confirmation.delete_message")
	const description = isEdit ? t("common:confirmation.edit_warning") : t("common:confirmation.delete_warning")

	const handleConfirm = () => {
		onConfirm(dontShowAgain)
		setDontShowAgain(false) // Reset for next time
	}

	const handleOpenChange = (open: boolean) => {
		if (!open) {
			setDontShowAgain(false) // Reset when dialog closes
		}
		onOpenChange(open)
	}

	return (
		<AlertDialog open={open} onOpenChange={handleOpenChange}>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle className="text-lg">{title}</AlertDialogTitle>
					<AlertDialogDescription className="text-base">{description}</AlertDialogDescription>
				</AlertDialogHeader>
				<div className="flex items-center space-x-2 px-6 py-1">
					<Checkbox
						id="dont-show-again"
						checked={dontShowAgain}
						onCheckedChange={(checked) => setDontShowAgain(checked as boolean)}
					/>
					<label
						htmlFor="dont-show-again"
						className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer">
						{t("common:confirmation.dont_show_again")}
					</label>
				</div>
				<AlertDialogFooter className="flex-col gap-2">
					<AlertDialogCancel className="bg-vscode-button-secondaryBackground hover:bg-vscode-button-secondaryHoverBackground text-vscode-button-secondaryForeground border-vscode-button-border">
						{t("common:answers.cancel")}
					</AlertDialogCancel>
					<AlertDialogAction
						onClick={handleConfirm}
						className="bg-vscode-button-background hover:bg-vscode-button-hoverBackground text-vscode-button-foreground border-vscode-button-border">
						{t("common:confirmation.proceed")}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	)
}

// Export convenience components for backward compatibility
export const EditMessageDialog: React.FC<Omit<MessageModificationConfirmationDialogProps, "type">> = (props) => (
	<MessageModificationConfirmationDialog {...props} type="edit" />
)

export const DeleteMessageDialog: React.FC<Omit<MessageModificationConfirmationDialogProps, "type">> = (props) => (
	<MessageModificationConfirmationDialog {...props} type="delete" />
)
