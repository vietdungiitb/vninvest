function normalizeDomain(domain) {
    if (!domain) {
        return null;
    }
    const [rawMin, rawMax] = domain;
    if (!Number.isFinite(rawMin) || !Number.isFinite(rawMax)) {
        return null;
    }
    if (rawMin === rawMax) {
        const delta = Math.max(1, Math.abs(rawMin) * 0.01);
        return [rawMin - delta, rawMax + delta];
    }
    return rawMin < rawMax ? [rawMin, rawMax] : [rawMax, rawMin];
}
function resolveThemePalette(mode) {
    if (mode === "dark") {
        return {
            grid: "rgba(130, 139, 168, 0.28)",
            axisBorder: "rgba(130, 139, 168, 0.5)",
            label: "#d7dde9",
        };
    }
    return {
        grid: "rgba(36, 47, 66, 0.14)",
        axisBorder: "rgba(36, 47, 66, 0.28)",
        label: "#2f3a52",
    };
}
function formatAxisLabel(value) {
    const abs = Math.abs(value);
    if (abs >= 1_000_000) {
        return `${(value / 1_000_000).toFixed(2)}M`;
    }
    if (abs >= 1_000) {
        return `${(value / 1_000).toFixed(2)}K`;
    }
    return value.toFixed(2);
}
function calculateTicks(domain, height) {
    const [min, max] = domain;
    if (min >= max || !Number.isFinite(min) || !Number.isFinite(max)) {
        return [];
    }
    const range = max - min;
    const targetTickCount = Math.max(2, Math.floor(height / 60));
    const rawInterval = range / targetTickCount;
    if (rawInterval <= 0) {
        return [];
    }
    const power = Math.floor(Math.log10(rawInterval));
    const base = Math.pow(10, power);
    const ratio = rawInterval / base;
    let step = base;
    if (ratio < 1.5) {
        step = base;
    }
    else if (ratio < 3.5) {
        step = 2 * base;
    }
    else if (ratio < 7.5) {
        step = 5 * base;
    }
    else {
        step = 10 * base;
    }
    const firstTick = Math.ceil(min / step) * step;
    const ticks = [];
    const epsilon = step * 1e-9;
    for (let val = firstTick; val <= max + epsilon; val += step) {
        if (ticks.length > 50) {
            break;
        }
        ticks.push(val);
    }
    return ticks;
}
function yForValue(value, domain, bounds) {
    const [min, max] = domain;
    const range = max - min;
    if (range <= 0) {
        return bounds.top + bounds.height / 2;
    }
    const ratio = (value - min) / range;
    return Math.round(bounds.top + bounds.height - ratio * bounds.height);
}
function renderAxisLabels(ctx, side, axis, palette) {
    const domain = normalizeDomain(axis.domain);
    if (!domain) {
        return;
    }
    const ticks = calculateTicks(domain, axis.bounds.height);
    ctx.save();
    ctx.fillStyle = palette.label;
    ctx.font = "11px sans-serif";
    ctx.textBaseline = "middle";
    ctx.textAlign = side === "left" ? "left" : "right";
    for (const val of ticks) {
        const y = yForValue(val, domain, axis.bounds);
        if (y < axis.bounds.top + 4 || y > axis.bounds.top + axis.bounds.height - 4) {
            continue;
        }
        const label = formatAxisLabel(val);
        const x = side === "left"
            ? axis.bounds.left + 6
            : axis.bounds.left + axis.bounds.width - 6;
        ctx.fillText(label, x, y);
    }
    ctx.restore();
}
export class AxisGridRenderer {
    render(ctx, options) {
        const themeMode = options.themeMode ?? "light";
        const palette = resolveThemePalette(themeMode);
        const plotBounds = options.plotBounds;
        const gridDomain = normalizeDomain(options.rightAxis?.domain) ?? normalizeDomain(options.leftAxis?.domain);
        ctx.save();
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.strokeStyle = palette.grid;
        if (gridDomain) {
            const ticks = calculateTicks(gridDomain, plotBounds.height);
            for (const val of ticks) {
                const y = yForValue(val, gridDomain, plotBounds);
                if (y < plotBounds.top + 2 || y > plotBounds.top + plotBounds.height - 2) {
                    continue;
                }
                ctx.beginPath();
                ctx.moveTo(plotBounds.left, y);
                ctx.lineTo(plotBounds.left + plotBounds.width, y);
                ctx.stroke();
            }
        }
        ctx.restore();
        ctx.save();
        ctx.lineWidth = 1;
        ctx.setLineDash([]);
        ctx.strokeStyle = palette.axisBorder;
        if (options.leftAxis) {
            const x = options.leftAxis.bounds.left + options.leftAxis.bounds.width - 0.5;
            ctx.beginPath();
            ctx.moveTo(x, options.leftAxis.bounds.top);
            ctx.lineTo(x, options.leftAxis.bounds.top + options.leftAxis.bounds.height);
            ctx.stroke();
        }
        if (options.rightAxis) {
            const x = options.rightAxis.bounds.left + 0.5;
            ctx.beginPath();
            ctx.moveTo(x, options.rightAxis.bounds.top);
            ctx.lineTo(x, options.rightAxis.bounds.top + options.rightAxis.bounds.height);
            ctx.stroke();
        }
        ctx.restore();
        if (options.leftAxis) {
            renderAxisLabels(ctx, "left", options.leftAxis, palette);
        }
        if (options.rightAxis) {
            renderAxisLabels(ctx, "right", options.rightAxis, palette);
        }
    }
}
