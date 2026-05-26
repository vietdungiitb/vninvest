export function resolveDemoTopbarStatusBadge(params) {
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
