export class CrosshairRenderer {
    render(ctx, options) {
        const { plotBounds, position, themeMode } = options;
        if (!position) {
            return;
        }
        const x = Math.max(plotBounds.left, Math.min(position.x, plotBounds.left + plotBounds.width));
        const y = Math.max(plotBounds.top, Math.min(position.y, plotBounds.top + plotBounds.height));
        const strokeColor = themeMode === "dark" ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.3)";
        ctx.save();
        ctx.setLineDash([4, 4]);
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, plotBounds.top);
        ctx.lineTo(x, plotBounds.top + plotBounds.height);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(plotBounds.left, y);
        ctx.lineTo(plotBounds.left + plotBounds.width, y);
        ctx.stroke();
        ctx.restore();
    }
}
