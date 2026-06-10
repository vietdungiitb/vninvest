/**
 * DT-10-T03/T04: Drawing Alert Engine
 *
 * Evaluates drawing alert conditions against the current price.
 * Returns fired alerts and mutates `triggeredAt` on the condition in-place
 * (caller is responsible for persisting the updated condition via updateDrawing).
 */
import type { DrawingObject, DrawingAlertCondition } from "./types";

export interface DrawingAlertEvent {
	/** The drawing that triggered the alert */
	drawing: DrawingObject;
	/** The reference price level of the drawing */
	referencePrice: number;
	/** Current price at the time of trigger */
	currentPrice: number;
	/** Direction that triggered (crossAbove | crossBelow) */
	direction: "crossAbove" | "crossBelow";
	/** Timestamp (ms) of the trigger */
	triggeredAt: number;
	/** The specific condition that triggered */
	condition?: DrawingAlertCondition;
}

/**
 * Resolve the reference price for alert evaluation.
 * For horizontal drawings (hLine, trendLine at flat, etc.) use the first point's y (price).
 * For diagonal drawings (trendLine, channel, ray, extendedLine), do linear interpolation at nowMs.
 * Guard dx === 0: return p1.y (vertical line).
 */
export function resolveReferencePriceForAlert(drawing: DrawingObject, nowMs: number = Date.now()): number | null {
	if (drawing.points.length === 0) return null;
	// All y values in DrawingObject are in data (price) coordinates
	if (drawing.type === "hLine") {
		return drawing.points[0].y;
	}
	// For trendLine and similar: linear interpolation at nowMs
	if (drawing.points.length >= 2) {
		const p1 = drawing.points[0];
		const p2 = drawing.points[1];
		const dx = p2.x - p1.x;
		if (dx === 0) {
			return p1.y;
		}
		// Linear interpolation: y1 + ((nowMs - x1) / (x2 - x1)) * (y2 - y1)
		return p1.y + ((nowMs - p1.x) / dx) * (p2.y - p1.y);
	}
	return drawing.points[0].y;
}

/** Default cooldown: 60 seconds */
const DEFAULT_COOLDOWN_MS = 60_000;

/**
 * Check if cooldown has elapsed since last trigger.
 * DT-10-T04: cooldown logic.
 */
export function isCooldownElapsed(condition: DrawingAlertCondition, nowMs: number): boolean {
	if (!condition.triggeredAt) return true;
	const cooldown = condition.cooldownMs ?? DEFAULT_COOLDOWN_MS;
	return nowMs - condition.triggeredAt >= cooldown;
}

/**
 * Determine if a price cross has occurred.
 * previousPrice → currentPrice crossing referencePrice in the specified direction.
 */
export function detectPriceCross(
	previousPrice: number,
	currentPrice: number,
	referencePrice: number,
	direction: DrawingAlertCondition["direction"],
): boolean {
	const crossedAbove = previousPrice <= referencePrice && currentPrice > referencePrice;
	const crossedBelow = previousPrice >= referencePrice && currentPrice < referencePrice;
	switch (direction) {
		case "crossAbove":
			return crossedAbove;
		case "crossBelow":
			return crossedBelow;
		case "either":
			return crossedAbove || crossedBelow;
	}
}

/**
 * DT-10-T03: Evaluate all drawings with alert conditions.
 * Mutates `condition.triggeredAt` on each fired alert.
 * Returns the list of fired alert events.
 */
export function evaluateDrawingAlerts(
	drawings: DrawingObject[],
	previousPrice: number,
	currentPrice: number,
	nowMs: number = Date.now(),
): DrawingAlertEvent[] {
	const fired: DrawingAlertEvent[] = [];

	for (const drawing of drawings) {
		// Collect active alert conditions (GAP-14 support for both single and multiple alerts)
		const activeConditions: DrawingAlertCondition[] = [];
		if (drawing.alertConditions && drawing.alertConditions.length > 0) {
			activeConditions.push(...drawing.alertConditions);
		} else if (drawing.alertCondition) {
			activeConditions.push(drawing.alertCondition);
		}

		for (const condition of activeConditions) {
			if (!condition || !condition.enabled) continue;

			const refPrice = resolveReferencePriceForAlert(drawing, nowMs);
			if (refPrice === null) continue;

			if (!isCooldownElapsed(condition, nowMs)) continue;

			const triggered = detectPriceCross(previousPrice, currentPrice, refPrice, condition.direction);
			if (!triggered) continue;

			const actualDirection: "crossAbove" | "crossBelow" =
				currentPrice > previousPrice ? "crossAbove" : "crossBelow";

			// Mutate triggeredAt so caller can persist update
			condition.triggeredAt = nowMs;

			fired.push({
				drawing,
				referencePrice: refPrice,
				currentPrice,
				direction: actualDirection,
				triggeredAt: nowMs,
				condition,
			});
		}
	}

	return fired;
}
