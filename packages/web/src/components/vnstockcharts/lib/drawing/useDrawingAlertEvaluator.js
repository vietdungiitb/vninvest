/**
 * DT-10-T09: Hook to evaluate drawing alerts on each new price bar.
 *
 * Usage:
 *   useDrawingAlertEvaluator({ drawings, plotData, updateDrawing, onDrawingAlert });
 *
 * Fires onDrawingAlert whenever a price cross is detected and cooldown has elapsed.
 * Persists the updated triggeredAt via updateDrawing so cooldown survives re-renders.
 */
import { useEffect, useRef } from "react";
import { evaluateDrawingAlerts } from "./evaluateDrawingAlerts.js";
export function useDrawingAlertEvaluator({ drawings, plotData, updateDrawing, onDrawingAlert, }) {
    const prevPriceRef = useRef(null);
    useEffect(() => {
        if (!onDrawingAlert || plotData.length < 2)
            return;
        const lastBar = plotData[plotData.length - 1];
        const prevBar = plotData[plotData.length - 2];
        const currentPrice = lastBar.close;
        const previousPrice = prevBar.close;
        if (currentPrice == null || previousPrice == null)
            return;
        if (prevPriceRef.current === currentPrice)
            return;
        prevPriceRef.current = currentPrice;
        const fired = evaluateDrawingAlerts(drawings, previousPrice, currentPrice);
        for (const event of fired) {
            // Persist the updated triggeredAt so cooldown is durable
            if (event.drawing.alertCondition) {
                updateDrawing(event.drawing.id, {
                    alertCondition: { ...event.drawing.alertCondition, triggeredAt: event.triggeredAt },
                });
            }
            onDrawingAlert(event.drawing, event.drawing.alertCondition, event.currentPrice);
        }
    }, [plotData, drawings, updateDrawing, onDrawingAlert]);
}
