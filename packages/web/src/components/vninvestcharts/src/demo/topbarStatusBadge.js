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
export function resolveDemoRuntimeStatusBadge(params) {
    const title = params.chartCanvasOverlays
        ? params.t("library.runtimeLane.chartCanvasReady")
        : params.drawingOverlays
            ? params.t("library.runtimeLane.drawingOverlayReady")
            : params.t("library.runtimeLane.awaitingWidget");
    if (params.requestedLane === "auto") {
        if (params.resolvedRuntime === "fork") {
            return {
                className: "gc-loading-badge",
                label: params.t("library.runtimeLane.autoToFork"),
                title,
            };
        }
        if (params.resolvedRuntime === "legacy") {
            return {
                className: "gc-loading-badge",
                label: params.t("library.runtimeLane.autoToLegacy"),
                title,
            };
        }
        return {
            className: "gc-loading-badge",
            label: params.t("library.runtimeLane.pending"),
            title,
        };
    }
    return {
        className: params.requestedLane === "fork" ? "gc-live-badge" : "gc-offline-badge",
        label: params.requestedLane === "fork"
            ? params.t("library.runtimeLane.fork")
            : params.t("library.runtimeLane.legacy"),
        title,
    };
}
