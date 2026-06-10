const PANE_KIND_BY_ID = {
    price: "price",
    volume: "volume",
    orderflow: "orderflow",
};
function createScaleSlotId(paneId, side) {
    return `${paneId}-${side}`;
}
function inferPaneKind(pane) {
    return PANE_KIND_BY_ID[pane.id] ?? "indicator";
}
function buildScaleSlots(pane) {
    const activeSeries = pane.series.filter((series) => series.visible !== false);
    const hasLeftAxis = activeSeries.some((series) => series.yAxis === "left");
    const hasRightAxis = activeSeries.some((series) => series.yAxis === "right");
    const slotSides = [];
    if (hasLeftAxis) {
        slotSides.push("left");
    }
    if (hasRightAxis) {
        slotSides.push("right");
    }
    if (slotSides.length === 0) {
        slotSides.push("right");
    }
    return slotSides.map((side) => ({
        id: createScaleSlotId(pane.id, side),
        side,
        mode: "auto",
        visible: true,
    }));
}
function buildSeriesSpecs(pane, scaleSlots) {
    const slotBySide = new Map(scaleSlots.map((slot) => [slot.side, slot.id]));
    const fallbackScaleSlotId = scaleSlots[0]?.id ?? createScaleSlotId(pane.id, "right");
    return pane.series.map((series, index) => {
        const style = {};
        if (typeof series.color === "string") {
            style.color = series.color;
        }
        if (typeof series.lineWidth === "number" && Number.isFinite(series.lineWidth)) {
            style.lineWidth = series.lineWidth;
        }
        if (series.subColors) {
            style.subColors = { ...series.subColors };
        }
        return {
            id: series.id ?? `${pane.id}-series-${index}`,
            type: series.type,
            scaleSlotId: slotBySide.get(series.yAxis) ?? fallbackScaleSlotId,
            overlay: series.overlay,
            visible: series.visible !== false,
            params: series.params ? { ...series.params } : undefined,
            style: Object.keys(style).length > 0 ? style : undefined,
        };
    });
}
export function createPaneSpecFromDescriptor(pane) {
    const scaleSlots = buildScaleSlots(pane);
    return {
        id: pane.id,
        kind: inferPaneKind(pane),
        labelKey: pane.label,
        pinned: pane.pinned,
        visible: pane.visible,
        heightRatio: pane.heightRatio,
        scaleSlots,
        series: buildSeriesSpecs(pane, scaleSlots),
        tooltipMode: pane.tooltip,
    };
}
export function createPaneSpecsFromDescriptors(panes) {
    return panes.map(createPaneSpecFromDescriptor);
}
