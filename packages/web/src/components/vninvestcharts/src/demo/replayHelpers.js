export function resolveReplayStartIndexOnDataSync({ currentIndex, previousTotal, nextTotal, }) {
    if (nextTotal <= 0) {
        return 0;
    }
    if (currentIndex >= previousTotal) {
        return nextTotal;
    }
    return Math.min(Math.max(currentIndex, 1), nextTotal);
}
export function shouldOpenReplayContextMenu({ showReplayBar, hasCurrentItemDate, hasShellNode, hasDrawingContextMenu, isAltRightClick, isTouchLongPress, }) {
    if (!isAltRightClick && !isTouchLongPress) {
        return false;
    }
    if (!showReplayBar) {
        return false;
    }
    if (!hasCurrentItemDate || !hasShellNode) {
        return false;
    }
    if (hasDrawingContextMenu) {
        return false;
    }
    return true;
}
