import { jsx as _jsx } from "react/jsx-runtime";
/**
 * Whale Bubble Overlay — visualizes large orders as colored bubbles on price chart
 * Uses IC-GAP OverlayCanvas for efficient rendering
 */
import { useCallback } from "react";
import { OverlayCanvas } from "../../core/canvas/OverlayCanvas.js";
import { getBubbleColor, getBubbleRadius, getBubbleStrokeColor, } from "./whaleDetector.js";
/**
 * Render whale bubbles on canvas overlay
 * Bubbles appear above/below candles based on order dominance
 *
 * @example
 * <WhaleMarketBubbleOverlay
 *   events={whaleEvents}
 *   visibleRange={visibleRange}
 *   showPriceLevel={true}
 * />
 */
export function WhaleMarketBubbleOverlay({ events, visibleRange, showPriceLevel = true, }) {
    const drawBubbles = useCallback((context) => {
        const { ctx, xScale, yScale, plotData, devicePixelRatio } = context;
        // No-op if no visible range or no events
        if (!visibleRange || events.length === 0) {
            return;
        }
        // Filter to visible events
        const visibleEvents = events.filter((e) => e.index >= visibleRange.startIndex && e.index <= visibleRange.endIndex);
        visibleEvents.forEach((event) => {
            // Get bar data for this index
            const bar = plotData[event.index];
            if (!bar || typeof bar !== "object") {
                return;
            }
            // Compute bubble position
            const candleX = xScale(event.index);
            const close = bar["close"] ?? 0;
            const candleY = yScale(close);
            // Compute bubble size
            const radius = getBubbleRadius(event.sizeCategory) * devicePixelRatio;
            // Position bubble: above for buy, below for sell
            const bubbleY = event.dominance === "buy" ? candleY - radius * 1.5 : candleY + radius * 1.5;
            // Draw bubble fill
            ctx.fillStyle = getBubbleColor(event.dominance, 0.4);
            ctx.beginPath();
            ctx.arc(candleX, bubbleY, radius, 0, 2 * Math.PI);
            ctx.fill();
            // Draw bubble stroke
            ctx.strokeStyle = getBubbleStrokeColor(event.dominance);
            ctx.lineWidth = 2 * devicePixelRatio;
            ctx.stroke();
            // Draw label: volume delta
            const volumeLabel = formatBubbleLabel(event);
            ctx.fillStyle = getBubbleStrokeColor(event.dominance);
            ctx.font = `12px sans-serif`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(volumeLabel, candleX, bubbleY);
        });
    }, [events, visibleRange]);
    return _jsx(OverlayCanvas, { draw: drawBubbles });
}
/**
 * Format volume for bubble label
 */
function formatBubbleLabel(event) {
    const abs = Math.abs(event.netDelta);
    if (abs >= 1_000_000) {
        return `${(abs / 1_000_000).toFixed(1)}M`;
    }
    if (abs >= 1_000) {
        return `${(abs / 1_000).toFixed(0)}K`;
    }
    return abs.toString();
}
