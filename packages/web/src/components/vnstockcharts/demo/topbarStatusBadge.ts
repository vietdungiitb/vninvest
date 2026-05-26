import type { ActiveSource } from "./components/DataSourceSwitcher";
import type { useDemoI18n } from "./i18n";

export type DemoDataStatus = "loading" | "live" | "offline" | "error";

export interface DemoTopbarStatusBadge {
	className: string;
	label: string;
	title?: string;
}

export type DemoTranslator = ReturnType<typeof useDemoI18n>["t"];

export function resolveDemoTopbarStatusBadge(params: {
	activeSource: ActiveSource;
	dataStatus: DemoDataStatus;
	dataError: string;
	vniError: string | null;
	t: DemoTranslator;
}): DemoTopbarStatusBadge | null {
	if (params.dataStatus === "live") {
		return {
			className: "gc-live-badge",
			label: params.activeSource === "vninvest" ? params.t("dataSource.vninvest") : params.t("common.liveBinance"),
		};
	}

	if (params.activeSource === "binance" && params.dataStatus === "offline") {
		return {
			className: "gc-offline-badge",
			label: params.t("common.offlineFallback"),
			title: params.dataError,
		};
	}

	if (params.activeSource === "vninvest" && params.dataStatus === "error") {
		const message = params.vniError ?? params.t("vninvest.status.error");
		return {
			className: "gc-offline-badge",
			label: message,
			title: params.vniError ?? params.dataError,
		};
	}

	if (params.dataStatus === "loading") {
		return {
			className: "gc-loading-badge",
			label: params.activeSource === "vninvest" ? params.t("vninvest.loading") : params.t("common.loading"),
		};
	}

	return null;
}
