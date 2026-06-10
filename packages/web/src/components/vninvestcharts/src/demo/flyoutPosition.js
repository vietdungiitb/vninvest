export function resolveFlyoutPosition(input) {
    const { rect, itemCount, isCompactViewport, viewportMetrics, flyoutMargin, flyoutPadding, flyoutGap, flyoutButtonSize, compactFlyoutButtonSize, flyoutWidth, } = input;
    const viewportLeft = viewportMetrics.offsetLeft;
    const viewportTop = viewportMetrics.offsetTop;
    const viewportWidth = viewportMetrics.width || window.innerWidth;
    const viewportHeight = viewportMetrics.height || window.innerHeight;
    const minLeft = viewportLeft + flyoutMargin;
    const maxLeft = viewportLeft + viewportWidth - flyoutMargin;
    const minTop = viewportTop + flyoutMargin;
    const maxTop = viewportTop + viewportHeight - flyoutMargin;
    if (isCompactViewport) {
        const estimatedFlyoutWidth = Math.min(viewportWidth - flyoutMargin * 2, itemCount * compactFlyoutButtonSize + Math.max(itemCount - 1, 0) * flyoutGap + flyoutPadding);
        const estimatedFlyoutHeight = Math.min(viewportHeight - flyoutMargin * 2, 320);
        const nextLeft = Math.max(minLeft, Math.min(rect.left, maxLeft - estimatedFlyoutWidth));
        const preferredTop = rect.bottom + 6;
        const nextTop = preferredTop + estimatedFlyoutHeight <= maxTop
            ? preferredTop
            : Math.max(minTop, rect.top - estimatedFlyoutHeight - 6);
        return { x: nextLeft, y: nextTop };
    }
    const estimatedFlyoutHeight = Math.min(viewportHeight - flyoutMargin * 2, itemCount * flyoutButtonSize + Math.max(itemCount - 1, 0) * flyoutGap + flyoutPadding);
    const nextLeft = rect.right + 6 + flyoutWidth <= maxLeft
        ? rect.right + 6
        : Math.max(minLeft, rect.left - flyoutWidth - 6);
    const nextTop = Math.max(minTop, Math.min(rect.top, maxTop - estimatedFlyoutHeight));
    return { x: nextLeft, y: nextTop };
}
