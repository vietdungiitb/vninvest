import { useWidgetI18n } from "./context/WidgetI18nContext";

export interface WidgetEmptyStateProps {
	loading: boolean;
}

export function WidgetEmptyState({ loading }: WidgetEmptyStateProps) {
	const { t } = useWidgetI18n();
	const copy = loading ? t("widget.loading") : t("widget.noData");

	return (
		<div
			role="status"
			aria-live="polite"
			style={{
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				gap: 12,
				minHeight: 320,
				padding: 24,
				borderRadius: 16,
				background: "linear-gradient(180deg, rgba(2, 6, 23, 0.03), rgba(2, 6, 23, 0.06))",
				color: "#334155",
				fontSize: 14,
				fontWeight: 600,
			}}
		>
			<style>{"@keyframes rsc-widget-spin { to { transform: rotate(360deg); } }"}</style>
			{loading ? (
				<span
					aria-hidden="true"
					style={{
						width: 16,
						height: 16,
						borderRadius: "50%",
						border: "2px solid currentColor",
						borderTopColor: "transparent",
						animation: "rsc-widget-spin 1s linear infinite",
					}}
				/>
			) : null}
			<span>{copy}</span>
		</div>
	);
}
