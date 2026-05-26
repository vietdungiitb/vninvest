/**
 * Resolve the reference price for alert evaluation.
 * For horizontal drawings (hLine, trendLine at flat, etc.) use the first point's y (price).
 * For multi-point drawings, use the lowest y among all points.
 */
export function resolveReferencePriceForAlert(drawing) {
    if (drawing.points.length === 0)
        return null;
    // All y values in DrawingObject are in data (price) coordinates
    if (drawing.type === "hLine") {
        return drawing.points[0].y;
    }
    // For trendLine and similar: take average of first two points' y
    if (drawing.points.length >= 2) {
        return (drawing.points[0].y + drawing.points[1].y) / 2;
    }
    return drawing.points[0].y;
}
/** Default cooldown: 60 seconds */
const DEFAULT_COOLDOWN_MS = 60_000;
/**
 * Check if cooldown has elapsed since last trigger.
 * DT-10-T04: cooldown logic.
 */
export function isCooldownElapsed(condition, nowMs) {
    if (!condition.triggeredAt)
        return true;
    const cooldown = condition.cooldownMs ?? DEFAULT_COOLDOWN_MS;
    return nowMs - condition.triggeredAt >= cooldown;
}
/**
 * Determine if a price cross has occurred.
 * previousPrice → currentPrice crossing referencePrice in the specified direction.
 */
export function detectPriceCross(previousPrice, currentPrice, referencePrice, direction) {
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
export function evaluateDrawingAlerts(drawings, previousPrice, currentPrice, nowMs = Date.now()) {
    const fired = [];
    for (const drawing of drawings) {
        const condition = drawing.alertCondition;
        if (!condition || !condition.enabled)
            continue;
        const refPrice = resolveReferencePriceForAlert(drawing);
        if (refPrice === null)
            continue;
        if (!isCooldownElapsed(condition, nowMs))
            continue;
        const triggered = detectPriceCross(previousPrice, currentPrice, refPrice, condition.direction);
        if (!triggered)
            continue;
        const actualDirection = currentPrice > previousPrice ? "crossAbove" : "crossBelow";
        // Mutate triggeredAt so caller can persist update
        condition.triggeredAt = nowMs;
        fired.push({
            drawing,
            referencePrice: refPrice,
            currentPrice,
            direction: actualDirection,
            triggeredAt: nowMs,
        });
    }
    return fired;
}
