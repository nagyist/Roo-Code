import { render } from "@testing-library/react"

import TranslationProvider, { useAppTranslation } from "../TranslationContext"

vi.mock("@/context/ExtensionStateContext", () => ({
	useExtensionState: () => ({
		language: "en",
	}),
}))

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		i18n: {
			t: (key: string, options?: Record<string, any>) => {
				// Mock specific translations used in tests
				if (key === "settings.autoApprove.title") return "Auto-Approve"
				if (key === "notifications.error") {
					return options?.message ? `Operation failed: ${options.message}` : "Operation failed"
				}
				return key
			},
			changeLanguage: vi.fn(),
		},
	}),
}))

vi.mock("../setup", () => ({
	default: {
		t: (key: string, options?: Record<string, any>) => {
			// Mock specific translations used in tests
			if (key === "settings.autoApprove.title") return "Auto-Approve"
			if (key === "notifications.error") {
				return options?.message ? `Operation failed: ${options.message}` : "Operation failed"
			}
			if (key === "common:errors.claudeCodeProcessExited") {
				return `Claude Code process exited with code ${options?.exitCode}.`
			}
			if (key === "common:errors.errorOutput") {
				return `Error output: ${options?.output}`
			}
			if (key === "common:errors.claudeCodeStoppedWithReason") {
				return `Claude Code stopped with reason: ${options?.reason}`
			}
			if (key === "common:errors.apiKeyModelPlanMismatch") {
				return "API keys and subscription plans allow different models. Make sure the selected model is included in your plan."
			}
			return key
		},
		changeLanguage: vi.fn(),
	},
	loadTranslations: vi.fn(),
}))

const TestComponent = () => {
	const { t } = useAppTranslation()
	return (
		<div>
			<h1 data-testid="translation-test">{t("settings.autoApprove.title")}</h1>
			<p data-testid="translation-interpolation">{t("notifications.error", { message: "Test error" })}</p>
		</div>
	)
}

describe("TranslationContext", () => {
	it("should provide translations via context", () => {
		const { getByTestId } = render(
			<TranslationProvider>
				<TestComponent />
			</TranslationProvider>,
		)

		// Check if translation is provided correctly
		expect(getByTestId("translation-test")).toHaveTextContent("Auto-Approve")
	})

	it("should handle interpolation correctly", () => {
		const { getByTestId } = render(
			<TranslationProvider>
				<TestComponent />
			</TranslationProvider>,
		)

		// Check if interpolation works
		expect(getByTestId("translation-interpolation")).toHaveTextContent("Operation failed: Test error")
	})
})
