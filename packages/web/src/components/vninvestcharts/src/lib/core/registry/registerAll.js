import { registerPhaseOneSeries, attachRenderer } from "./SeriesRegistry.js";
import { seriesRendererRegistry } from "./seriesRenderers.js";
export function initRegistry() {
    registerPhaseOneSeries();
    for (const [type, renderer] of Object.entries(seriesRendererRegistry)) {
        attachRenderer(type, renderer);
    }
}
initRegistry();
