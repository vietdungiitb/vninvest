import type { ContextType, ErrorInfo, ReactNode } from "react";
import { Component } from "react";
import { WidgetI18nContext } from "./context/WidgetI18nContext";

export interface WidgetErrorBoundaryProps {
	children: ReactNode;
	onError?: (error: Error, info: ErrorInfo) => void;
}

interface WidgetErrorBoundaryState {
	hasError: boolean;
	error: Error | null;
}

export class WidgetErrorBoundary extends Component<WidgetErrorBoundaryProps, WidgetErrorBoundaryState> {
	static contextType = WidgetI18nContext;
	declare context: ContextType<typeof WidgetI18nContext>;

	state: WidgetErrorBoundaryState = {
		hasError: false,
		error: null,
	};

	static getDerivedStateFromError(error: Error) {
		return { hasError: true, error };
	}

	componentDidCatch(error: Error, info: ErrorInfo) {
		this.props.onError?.(error, info);
	}

	render() {
		if (this.state.hasError) {
			return (
				<div
					role="alert"
					style={{
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
						minHeight: 240,
						padding: 24,
						borderRadius: 16,
						background: "rgba(15, 23, 42, 0.04)",
						color: "#b91c1c",
						fontSize: 14,
						fontWeight: 600,
						textAlign: "center",
					}}
				>
					{this.context.t("widget.error")}
				</div>
			);
		}

		return this.props.children;
	}
}
