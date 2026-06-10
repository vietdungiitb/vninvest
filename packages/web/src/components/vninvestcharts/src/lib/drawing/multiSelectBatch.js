/**
 * Removes all drawings whose IDs are in selectedIds.
 * Locked drawings are preserved (not deleted).
 */
export function applyBatchDelete(drawings, selectedIds) {
    const idSet = new Set(selectedIds);
    return drawings.filter((d) => !idSet.has(d.id) || d.locked === true);
}
/**
 * Sets the `locked` property for all selected drawings (respects immutability).
 */
export function applyBatchLock(drawings, selectedIds, locked) {
    const idSet = new Set(selectedIds);
    return drawings.map((d) => (idSet.has(d.id) ? { ...d, locked } : d));
}
/**
 * Sets the `visible` property for all selected drawings.
 */
export function applyBatchVisible(drawings, selectedIds, visible) {
    const idSet = new Set(selectedIds);
    return drawings.map((d) => (idSet.has(d.id) ? { ...d, visible } : d));
}
/**
 * Applies a stroke color to all selected drawings (batch color change).
 */
export function applyBatchColor(drawings, selectedIds, color) {
    const idSet = new Set(selectedIds);
    return drawings.map((d) => idSet.has(d.id) ? { ...d, style: { ...d.style, stroke: color } } : d);
}
/**
 * Computes whether any selected drawing is currently unlocked.
 * Used to determine the toggle direction for "Lock all":
 *   - If ANY is unlocked → lock all
 *   - If ALL are locked → unlock all
 */
export function resolveNextLockState(drawings, selectedIds) {
    const idSet = new Set(selectedIds);
    const selected = drawings.filter((d) => idSet.has(d.id));
    return selected.some((d) => d.locked !== true); // true = lock all
}
/**
 * Computes whether any selected drawing is currently visible.
 * Used to determine the toggle direction for "Hide/Show all":
 *   - If ANY is visible → hide all
 *   - If ALL are hidden → show all
 */
export function resolveNextVisibleState(drawings, selectedIds) {
    const idSet = new Set(selectedIds);
    const selected = drawings.filter((d) => idSet.has(d.id));
    return !selected.some((d) => d.visible !== false); // true = show all (all currently hidden)
}
