import { chartPointToPixel } from "./coordinateUtils.js";
import { renderOverlayPrimitiveToCanvas, } from "@vninvestcharts/vn-kline-engine-core";
import { resolveDrawingStyle } from "./drawingStyleRegistry.js";
import { toOverlayPrimitive } from "./overlayPrimitiveAdapter.js";
import { SEGMENT_KEYS_BY_TYPE, resolveSegmentStyle, isSegmentVisible } from "./segmentRegistry.js";
import { calculateParallelChannelGeometry } from "./builtin/parallelChannel.js";
import { calculatePitchforkGeometry } from "./builtin/pitchfork.js";
import { calculateAbcdPatternMetrics } from "./builtin/abcdPattern.js";
import { calculateFibArcGeometry } from "./builtin/fibArc.js";
import { calculateFibTimeZoneGeometry } from "./builtin/fibTimeZone.js";
import { calculateRegressionChannelMetrics } from "./builtin/regressionChannel.js";
import { calculateGannFanGeometry } from "./builtin/gannFan.js";
import { calculateElliottWaveGeometry, ELLIOTT_LABELS } from "./builtin/elliottWaves.js";
import { calculateHarmonicPatternGeometry } from "./builtin/harmonicPatterns.js";
import { PATTERN_POINT_LABELS } from "./builtin/harmonicPatterns.js";
import { calculateFibExtendedGeometry, FIB_EXTENDED_LEVELS, FIB_FAN_RATIOS } from "./builtin/fibExtended.js";
import { calculateGannAdvancedGeometry, GANN_FRACTIONS } from "./builtin/gannAdvanced.js";
import { computeHarmonicRatioLabels, formatHarmonicRatioLabel } from "./harmonicRatioValidation.js";
import { calculateCycleGeometry } from "./builtin/cycles.js";
export const DEFAULT_FIB_LEVELS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1, 1.618, 2.618];
export const DEFAULT_FIB_EXTENSION_LEVELS = [1.272, 1.414, 1.618, 2, 2.618];
function numberFormatter(value) {
    return new Intl.NumberFormat("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(value);
}
function strokeDasharrayForStyle(style) {
    switch (style.strokeDasharray) {
        case "dashed":
            return [6, 4];
        case "dotted":
            return [2, 4];
        case "solid":
        case undefined:
        default:
            return [];
    }
}
function applyLineStyle(ctx, style) {
    ctx.strokeStyle = style.stroke;
    ctx.lineWidth = style.strokeWidth;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.setLineDash(strokeDasharrayForStyle(style));
    ctx.globalAlpha = style.opacity ?? 1;
}
function toPixel(point, scales) {
    return chartPointToPixel(point, scales);
}
function drawSelectionHandles(ctx, points, color) {
    if (points.length === 0) {
        return;
    }
    ctx.save();
    ctx.globalAlpha = 1;
    ctx.setLineDash([]);
    ctx.lineWidth = 1;
    points.forEach((point) => {
        ctx.beginPath();
        ctx.arc(point.x, point.y, 4, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.strokeStyle = "#ffffff";
        ctx.fill();
        ctx.stroke();
    });
    ctx.restore();
}
function drawSemanticPointAffordance(ctx, label, position, style, isSelected, isFocused) {
    const fontSize = Math.max(10, Math.min(12, style.fontSize ?? 11));
    ctx.save();
    ctx.globalAlpha = 1;
    ctx.font = `700 ${fontSize}px ${style.fontFamily ?? "sans-serif"}`;
    const textWidth = ctx.measureText(label).width;
    const badgeWidth = Math.max(20, textWidth + 10);
    const badgeHeight = fontSize + 6;
    const badgeX = position.x + 10;
    const badgeY = position.y - badgeHeight - 10;
    const ringRadius = isFocused ? 10 : isSelected ? 8 : 6;
    ctx.fillStyle = isFocused ? "rgba(15, 23, 42, 0.98)" : isSelected ? "rgba(15, 23, 42, 0.94)" : "rgba(15, 23, 42, 0.88)";
    ctx.strokeStyle = style.stroke;
    ctx.lineWidth = isFocused ? 1.5 : 1;
    ctx.beginPath();
    ctx.roundRect(badgeX, badgeY, badgeWidth, badgeHeight, 999);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#f8fafc";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, badgeX + (badgeWidth / 2), badgeY + (badgeHeight / 2) + 0.5);
    ctx.beginPath();
    ctx.arc(position.x, position.y, ringRadius, 0, Math.PI * 2);
    ctx.fillStyle = style.stroke;
    ctx.globalAlpha = isFocused ? 0.38 : isSelected ? 0.28 : 0.18;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = isFocused ? 2.5 : isSelected ? 2 : 1.5;
    ctx.stroke();
    ctx.restore();
}
export function resolveSemanticPointLabels(drawing) {
    switch (drawing.type) {
        case "elliottImpulse":
            return drawing.waveLabels ?? ELLIOTT_LABELS.elliottImpulse;
        case "elliottCorrection":
            return drawing.waveLabels ?? ELLIOTT_LABELS.elliottCorrection;
        case "elliottTriangle":
            return drawing.waveLabels ?? ELLIOTT_LABELS.elliottTriangle;
        case "elliottDoubleCombo":
            return drawing.waveLabels ?? ELLIOTT_LABELS.elliottDoubleCombo;
        case "elliottTripleCombo":
            return drawing.waveLabels ?? ELLIOTT_LABELS.elliottTripleCombo;
        case "xabcdPattern":
            return PATTERN_POINT_LABELS.xabcdPattern;
        case "cypherPattern":
            return PATTERN_POINT_LABELS.cypherPattern;
        case "headAndShoulders":
            return PATTERN_POINT_LABELS.headAndShoulders;
        case "trianglePattern":
            return PATTERN_POINT_LABELS.trianglePattern;
        case "threeDrivesPattern":
            return PATTERN_POINT_LABELS.threeDrivesPattern;
        default:
            return null;
    }
}
export function clipSegmentToBox(start, end, chartWidth, chartHeight) {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    let t0 = 0;
    let t1 = 1;
    const edges = [
        [-dx, start.x],
        [dx, chartWidth - start.x],
        [-dy, start.y],
        [dy, chartHeight - start.y],
    ];
    for (const [p, q] of edges) {
        if (p === 0) {
            if (q < 0) {
                return null;
            }
            continue;
        }
        const r = q / p;
        if (p < 0) {
            if (r > t1) {
                return null;
            }
            if (r > t0) {
                t0 = r;
            }
        }
        else {
            if (r < t0) {
                return null;
            }
            if (r < t1) {
                t1 = r;
            }
        }
    }
    if (t1 < t0) {
        return null;
    }
    return [
        { x: start.x + dx * t0, y: start.y + dy * t0 },
        { x: start.x + dx * t1, y: start.y + dy * t1 },
    ];
}
function extendLineThroughBox(point, direction, chartWidth, chartHeight) {
    return clipSegmentToBox({ x: point.x - direction.x * 10_000, y: point.y - direction.y * 10_000 }, { x: point.x + direction.x * 10_000, y: point.y + direction.y * 10_000 }, chartWidth, chartHeight);
}
function drawLine(ctx, start, end, style) {
    ctx.save();
    applyLineStyle(ctx, style);
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();
    ctx.restore();
}
function drawPolyline(ctx, points, style) {
    if (points.length < 2) {
        return;
    }
    ctx.save();
    applyLineStyle(ctx, style);
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let index = 1; index < points.length; index += 1) {
        ctx.lineTo(points[index].x, points[index].y);
    }
    ctx.stroke();
    ctx.restore();
}
function drawTextLabel(ctx, text, position, style, options) {
    ctx.save();
    ctx.globalAlpha = style.opacity ?? 1;
    ctx.fillStyle = options.fillStyle ?? style.stroke;
    ctx.font = `${options.weight ? `${options.weight} ` : ""}${options.fontSize ?? style.fontSize ?? 11}px ${style.fontFamily ?? "sans-serif"}`;
    ctx.textAlign = options.align ?? "left";
    ctx.textBaseline = options.baseline ?? "alphabetic";
    ctx.fillText(text, position.x, position.y);
    ctx.restore();
}
function drawFilledRect(ctx, rect, fill, fillAlpha) {
    ctx.save();
    ctx.globalAlpha = fillAlpha;
    ctx.fillStyle = fill;
    ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
    ctx.restore();
}
function drawStrokedRect(ctx, rect, style) {
    ctx.save();
    applyLineStyle(ctx, style);
    ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);
    ctx.restore();
}
function drawPolygonFill(ctx, points, fill, fillAlpha) {
    if (points.length < 3) {
        return;
    }
    ctx.save();
    ctx.globalAlpha = fillAlpha;
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let index = 1; index < points.length; index += 1) {
        ctx.lineTo(points[index].x, points[index].y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
}
/** GAP-16: Renders a small filled price tag on the right Y-axis edge */
function drawYAxisPriceTag(ctx, price, y, chartWidth, color) {
    const label = numberFormatter(price);
    const fontSize = 11;
    ctx.save();
    ctx.font = `700 ${fontSize}px sans-serif`;
    const textWidth = ctx.measureText(label).width;
    const padX = 5;
    const padY = 3;
    const tagW = textWidth + padX * 2;
    const tagH = fontSize + padY * 2;
    const tagX = chartWidth - tagW - 1;
    const tagY = y - tagH / 2;
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    ctx.roundRect(tagX, tagY, tagW, tagH, 3);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(label, tagX + padX, tagY + padY);
    ctx.restore();
}
function drawTrendLine(drawing, scales, ctx, isSelected) {
    const [startPoint, endPoint] = drawing.points;
    if (!startPoint || !endPoint) {
        return;
    }
    const start = toPixel(startPoint, scales);
    const end = toPixel(endPoint, scales);
    drawLine(ctx, start, end, drawing.style);
    // GAP-15: persistent measurement overlay
    if (drawing.showMeasurement) {
        const percent = startPoint.y === 0 ? 0 : ((endPoint.y - startPoint.y) / Math.abs(startPoint.y)) * 100;
        const priceDiff = endPoint.y - startPoint.y;
        const bars = Math.max(1, Math.round(Math.abs(end.x - start.x) / 6));
        const badge = `Δ ${priceDiff >= 0 ? "+" : ""}${priceDiff.toFixed(2)} (${percent >= 0 ? "+" : ""}${percent.toFixed(2)}%) · ${bars} bars`;
        const midX = (start.x + end.x) / 2;
        const midY = (start.y + end.y) / 2;
        drawTextLabel(ctx, badge, { x: midX, y: midY - 10 }, drawing.style, {
            align: "center",
            weight: 700,
            fontSize: drawing.style.fontSize ?? 11,
        });
    }
    if (isSelected) {
        drawSelectionHandles(ctx, [start, end], drawing.style.stroke);
    }
}
function drawHLine(drawing, scales, chartWidth, ctx, isSelected) {
    const point = drawing.points[0];
    if (!point) {
        return;
    }
    const y = toPixel(point, scales).y;
    const left = { x: 0, y };
    const right = { x: chartWidth, y };
    drawLine(ctx, left, right, drawing.style);
    // GAP-16: Y-axis price tag for hLine (always extends full width)
    drawYAxisPriceTag(ctx, point.y, y, chartWidth, drawing.style.stroke);
    if (isSelected) {
        drawSelectionHandles(ctx, [left, right], drawing.style.stroke);
    }
}
function drawVLine(drawing, scales, chartHeight, ctx, isSelected) {
    const point = drawing.points[0];
    if (!point) {
        return;
    }
    const x = toPixel(point, scales).x;
    const top = { x, y: 0 };
    const bottom = { x, y: chartHeight };
    drawLine(ctx, top, bottom, drawing.style);
    if (isSelected) {
        drawSelectionHandles(ctx, [top, bottom], drawing.style.stroke);
    }
}
function drawFibonacci(drawing, scales, chartWidth, ctx, isSelected) {
    const [startPoint, endPoint] = drawing.points;
    if (!startPoint || !endPoint) {
        return;
    }
    const start = toPixel(startPoint, scales);
    const end = toPixel(endPoint, scales);
    const priceDelta = endPoint.y - startPoint.y;
    const pixelDelta = end.y - start.y;
    if (drawing.fibLevelConfigs && drawing.fibLevelConfigs.length > 0) {
        // DT-7: per-level config (visible + per-level color)
        drawing.fibLevelConfigs.forEach((cfg) => {
            if (!cfg.visible)
                return;
            const y = start.y + pixelDelta * cfg.ratio;
            const price = startPoint.y + priceDelta * cfg.ratio;
            const levelStyle = cfg.color ? { ...drawing.style, stroke: cfg.color } : drawing.style;
            drawLine(ctx, { x: 0, y }, { x: chartWidth, y }, levelStyle);
            drawTextLabel(ctx, `${(cfg.ratio * 100).toFixed(1)}% — ${numberFormatter(price)}`, { x: chartWidth - 6, y: y - 4 }, levelStyle, {
                align: "right",
                baseline: "alphabetic",
                fontSize: drawing.style.fontSize ?? 11,
            });
        });
    }
    else {
        // Legacy: plain fibLevels array or defaults
        const levels = drawing.fibLevels ?? DEFAULT_FIB_LEVELS;
        levels.forEach((level) => {
            const y = start.y + pixelDelta * level;
            const price = startPoint.y + priceDelta * level;
            drawLine(ctx, { x: 0, y }, { x: chartWidth, y }, drawing.style);
            drawTextLabel(ctx, `${(level * 100).toFixed(1)}% — ${numberFormatter(price)}`, { x: chartWidth - 6, y: y - 4 }, drawing.style, {
                align: "right",
                baseline: "alphabetic",
                fontSize: drawing.style.fontSize ?? 11,
            });
        });
    }
    if (isSelected) {
        drawSelectionHandles(ctx, [start, end], drawing.style.stroke);
    }
}
function drawChannel(drawing, scales, ctx, isSelected) {
    const [startPoint, endPoint, offsetPoint] = drawing.points;
    if (!startPoint || !endPoint || !offsetPoint) {
        return;
    }
    const start = toPixel(startPoint, scales);
    const end = toPixel(endPoint, scales);
    const offsetAnchor = toPixel(offsetPoint, scales);
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const length = Math.hypot(dx, dy);
    const offsetVector = length === 0
        ? { x: offsetAnchor.x - start.x, y: offsetAnchor.y - start.y }
        : (() => {
            const normal = { x: -dy / length, y: dx / length };
            const distance = (offsetAnchor.x - start.x) * normal.x + (offsetAnchor.y - start.y) * normal.y;
            return { x: normal.x * distance, y: normal.y * distance };
        })();
    const offsetStart = { x: start.x + offsetVector.x, y: start.y + offsetVector.y };
    const offsetEnd = { x: end.x + offsetVector.x, y: end.y + offsetVector.y };
    if (isSegmentVisible(drawing, "primary")) {
        drawLine(ctx, start, end, resolveSegmentStyle(drawing, "primary"));
    }
    if (isSegmentVisible(drawing, "secondary")) {
        drawLine(ctx, offsetStart, offsetEnd, resolveSegmentStyle(drawing, "secondary"));
    }
    // GAP-15: persistent measurement overlay for channel
    if (drawing.showMeasurement && startPoint && endPoint) {
        const percent = startPoint.y === 0 ? 0 : ((endPoint.y - startPoint.y) / Math.abs(startPoint.y)) * 100;
        const priceDiff = endPoint.y - startPoint.y;
        const bars = Math.max(1, Math.round(Math.abs(end.x - start.x) / 6));
        const badge = `Δ ${priceDiff >= 0 ? "+" : ""}${priceDiff.toFixed(2)} (${percent >= 0 ? "+" : ""}${percent.toFixed(2)}%) · ${bars} bars`;
        drawTextLabel(ctx, badge, { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 - 10 }, drawing.style, {
            align: "center",
            weight: 700,
            fontSize: drawing.style.fontSize ?? 11,
        });
    }
    if (isSelected) {
        drawSelectionHandles(ctx, [start, end, offsetAnchor], drawing.style.stroke);
    }
}
function drawParallelChannel(drawing, scales, chartWidth, chartHeight, ctx, isSelected) {
    const geometry = calculateParallelChannelGeometry(drawing, scales);
    if (!geometry) {
        return;
    }
    const upper = clipSegmentToBox({ x: geometry.start.x + geometry.offsetVector.x, y: geometry.start.y + geometry.offsetVector.y }, { x: geometry.end.x + geometry.offsetVector.x, y: geometry.end.y + geometry.offsetVector.y }, chartWidth, chartHeight);
    const middle = clipSegmentToBox(geometry.start, geometry.end, chartWidth, chartHeight);
    const lower = clipSegmentToBox({ x: geometry.start.x - geometry.offsetVector.x, y: geometry.start.y - geometry.offsetVector.y }, { x: geometry.end.x - geometry.offsetVector.x, y: geometry.end.y - geometry.offsetVector.y }, chartWidth, chartHeight);
    if (upper && isSegmentVisible(drawing, "upper")) {
        drawLine(ctx, upper[0], upper[1], resolveSegmentStyle(drawing, "upper"));
    }
    if (middle && isSegmentVisible(drawing, "middle")) {
        drawLine(ctx, middle[0], middle[1], resolveSegmentStyle(drawing, "middle"));
    }
    if (lower && isSegmentVisible(drawing, "lower")) {
        drawLine(ctx, lower[0], lower[1], resolveSegmentStyle(drawing, "lower"));
    }
    if (isSelected) {
        drawSelectionHandles(ctx, [geometry.start, geometry.end, geometry.offsetAnchor], drawing.style.stroke);
    }
}
function drawPitchfork(drawing, scales, chartWidth, chartHeight, ctx, isSelected) {
    const geometry = calculatePitchforkGeometry(drawing, scales);
    if (!geometry || (geometry.direction.x === 0 && geometry.direction.y === 0)) {
        return;
    }
    const median = extendLineThroughBox(geometry.pivot, geometry.direction, chartWidth, chartHeight);
    const leftFork = extendLineThroughBox(geometry.leftSwing, geometry.direction, chartWidth, chartHeight);
    const rightFork = extendLineThroughBox(geometry.rightSwing, geometry.direction, chartWidth, chartHeight);
    if (!median || !leftFork || !rightFork) {
        return;
    }
    if (isSegmentVisible(drawing, "median")) {
        drawLine(ctx, median[0], median[1], resolveSegmentStyle(drawing, "median"));
    }
    if (isSegmentVisible(drawing, "leftFork")) {
        drawLine(ctx, leftFork[0], leftFork[1], resolveSegmentStyle(drawing, "leftFork"));
    }
    if (isSegmentVisible(drawing, "rightFork")) {
        drawLine(ctx, rightFork[0], rightFork[1], resolveSegmentStyle(drawing, "rightFork"));
    }
    drawTextLabel(ctx, "A", { x: geometry.pivot.x + 6, y: geometry.pivot.y - 6 }, drawing.style, { weight: 700, fontSize: drawing.style.fontSize ?? 11 });
    drawTextLabel(ctx, "B", { x: geometry.leftSwing.x + 6, y: geometry.leftSwing.y - 6 }, drawing.style, { weight: 700, fontSize: drawing.style.fontSize ?? 11 });
    drawTextLabel(ctx, "C", { x: geometry.rightSwing.x + 6, y: geometry.rightSwing.y - 6 }, drawing.style, { weight: 700, fontSize: drawing.style.fontSize ?? 11 });
    if (isSelected) {
        drawSelectionHandles(ctx, [geometry.pivot, geometry.leftSwing, geometry.rightSwing], drawing.style.stroke);
    }
}
function drawAbcdPattern(drawing, scales, ctx, isSelected) {
    const metrics = calculateAbcdPatternMetrics(drawing, scales);
    if (!metrics) {
        return;
    }
    const [a, b, c, d] = metrics.points;
    const abcdSegKeys = SEGMENT_KEYS_BY_TYPE[drawing.type] ?? [];
    const abcdPts = [a, b, c, d];
    for (let i = 0; i < abcdSegKeys.length && i + 1 < abcdPts.length; i++) {
        const key = abcdSegKeys[i];
        if (!isSegmentVisible(drawing, key))
            continue;
        drawLine(ctx, abcdPts[i], abcdPts[i + 1], resolveSegmentStyle(drawing, key));
    }
    const badgeStyle = { weight: 700, fontSize: drawing.style.fontSize ?? 11 };
    const labels = drawing.waveLabels ?? ["A", "B", "C", "D"];
    drawTextLabel(ctx, labels[0] || "A", { x: a.x + 6, y: a.y - 6 }, drawing.style, badgeStyle);
    drawTextLabel(ctx, labels[1] || "B", { x: b.x + 6, y: b.y - 6 }, drawing.style, badgeStyle);
    drawTextLabel(ctx, labels[2] || "C", { x: c.x + 6, y: c.y - 6 }, drawing.style, badgeStyle);
    drawTextLabel(ctx, labels[3] || "D", { x: d.x + 6, y: d.y - 6 }, drawing.style, badgeStyle);
    const ratioLabelStyle = { align: "center", baseline: "alphabetic", weight: 700, fontSize: drawing.style.fontSize ?? 11 };
    // GAP-11: colored ratio validation labels when targetRatios is configured
    const harmonicLabels = computeHarmonicRatioLabels(drawing);
    if (harmonicLabels.length >= 2) {
        // Ratio 0 = BC/AB, displayed at segment midpoint 1 (B→C)
        // Ratio 1 = CD/BC, displayed at segment midpoint 2 (C→D)
        const posBC = metrics.segmentMidpoints[1];
        const posCD = metrics.segmentMidpoints[2];
        drawTextLabel(ctx, formatHarmonicRatioLabel(harmonicLabels[0]), { x: posBC.x, y: posBC.y - 10 }, { ...drawing.style, stroke: harmonicLabels[0].color }, ratioLabelStyle);
        drawTextLabel(ctx, formatHarmonicRatioLabel(harmonicLabels[1]), { x: posCD.x, y: posCD.y - 10 }, { ...drawing.style, stroke: harmonicLabels[1].color }, ratioLabelStyle);
    }
    else {
        const ratioAB = metrics.bcToAb == null ? "BC/AB n/a" : `BC/AB ${metrics.bcToAb.toFixed(2)}`;
        const ratioBC = metrics.cdToBc == null ? "CD/BC n/a" : `CD/BC ${metrics.cdToBc.toFixed(2)}`;
        drawTextLabel(ctx, ratioAB, { x: metrics.segmentMidpoints[1].x, y: metrics.segmentMidpoints[1].y - 10 }, drawing.style, ratioLabelStyle);
        drawTextLabel(ctx, ratioBC, { x: metrics.segmentMidpoints[2].x, y: metrics.segmentMidpoints[2].y - 10 }, drawing.style, ratioLabelStyle);
    }
    if (isSelected) {
        drawSelectionHandles(ctx, metrics.points, drawing.style.stroke);
    }
}
function drawFibArc(drawing, scales, ctx, isSelected) {
    const geometry = calculateFibArcGeometry(drawing, scales);
    if (!geometry) {
        return;
    }
    geometry.radii.forEach((radius, index) => {
        ctx.save();
        applyLineStyle(ctx, drawing.style);
        ctx.beginPath();
        ctx.arc(geometry.center.x, geometry.center.y, radius, Math.PI, 0);
        ctx.stroke();
        ctx.restore();
        drawTextLabel(ctx, `${(geometry.levels[index] * 100).toFixed(1)}%`, {
            x: geometry.center.x + radius + 4,
            y: geometry.center.y - radius - 4,
        }, drawing.style, {
            baseline: "alphabetic",
            fontSize: drawing.style.fontSize ?? 11,
        });
    });
    if (isSelected) {
        drawSelectionHandles(ctx, [geometry.center, geometry.reference], drawing.style.stroke);
    }
}
function drawFibTimeZone(drawing, scales, chartHeight, ctx, isSelected) {
    const geometry = calculateFibTimeZoneGeometry(drawing, scales);
    if (!geometry) {
        return;
    }
    geometry.positions.forEach((x, index) => {
        drawLine(ctx, { x, y: 0 }, { x, y: chartHeight }, drawing.style);
        drawTextLabel(ctx, `${geometry.levels[index]}`, { x: x + 4, y: 12 }, drawing.style, {
            baseline: "alphabetic",
            fontSize: drawing.style.fontSize ?? 11,
        });
    });
    if (isSelected) {
        drawSelectionHandles(ctx, [geometry.start, geometry.end], drawing.style.stroke);
    }
}
function drawRegressionChannel(drawing, scales, options, ctx, isSelected) {
    const metrics = calculateRegressionChannelMetrics(drawing, scales, options.plotData ?? []);
    if (!metrics) {
        return;
    }
    const fill = drawing.style.fill && drawing.style.fill !== "transparent" ? drawing.style.fill : "rgba(100,149,237,0.08)";
    const fillAlpha = (drawing.style.fillOpacity ?? 1) * (drawing.style.opacity ?? 1);
    drawPolygonFill(ctx, [
        { x: metrics.startX, y: metrics.upperStartY },
        { x: metrics.endX, y: metrics.upperEndY },
        { x: metrics.endX, y: metrics.lowerEndY },
        { x: metrics.startX, y: metrics.lowerStartY },
    ], fill, fillAlpha);
    if (isSegmentVisible(drawing, "upper")) {
        drawLine(ctx, { x: metrics.startX, y: metrics.upperStartY }, { x: metrics.endX, y: metrics.upperEndY }, { ...resolveSegmentStyle(drawing, "upper"), strokeDasharray: "dashed" });
    }
    if (isSegmentVisible(drawing, "lower")) {
        drawLine(ctx, { x: metrics.startX, y: metrics.lowerStartY }, { x: metrics.endX, y: metrics.lowerEndY }, { ...resolveSegmentStyle(drawing, "lower"), strokeDasharray: "dashed" });
    }
    if (isSegmentVisible(drawing, "center")) {
        drawLine(ctx, { x: metrics.startX, y: metrics.startY }, { x: metrics.endX, y: metrics.endY }, resolveSegmentStyle(drawing, "center"));
    }
    drawTextLabel(ctx, `R² ${metrics.rSquared.toFixed(2)}`, { x: metrics.endX - 4, y: Math.min(metrics.upperEndY, metrics.lowerEndY, metrics.endY) - 6 }, drawing.style, {
        align: "right",
        baseline: "alphabetic",
        weight: 700,
        fontSize: drawing.style.fontSize ?? 11,
    });
    if (isSelected) {
        const handles = drawing.points
            .filter((point) => Boolean(point))
            .map((point) => toPixel(point, scales));
        drawSelectionHandles(ctx, handles, drawing.style.stroke);
    }
}
function drawText(drawing, scales, ctx, isSelected) {
    const point = drawing.points[0];
    if (!point) {
        return;
    }
    const pixel = toPixel(point, scales);
    const text = drawing.text?.trim().length ? drawing.text : "Text";
    drawTextLabel(ctx, text, pixel, drawing.style, {
        baseline: "middle",
        fontSize: drawing.style.fontSize ?? 12,
    });
    if (isSelected) {
        drawSelectionHandles(ctx, [pixel], drawing.style.stroke);
    }
}
function drawRay(drawing, scales, chartWidth, chartHeight, ctx, isSelected) {
    const [startPoint, endPoint] = drawing.points;
    if (!startPoint || !endPoint) {
        return;
    }
    const start = toPixel(startPoint, scales);
    const end = toPixel(endPoint, scales);
    const clipped = clipSegmentToBox(start, { x: start.x + (end.x - start.x) * 10_000, y: start.y + (end.y - start.y) * 10_000 }, chartWidth, chartHeight);
    if (!clipped) {
        return;
    }
    drawLine(ctx, clipped[0], clipped[1], drawing.style);
    // GAP-16: Y-axis price tag at right edge when extendRight
    if (drawing.extendRight !== false) {
        const price = endPoint.y + ((clipped[1].x - end.x) / (end.x - start.x || 1)) * (endPoint.y - startPoint.y);
        drawYAxisPriceTag(ctx, price, clipped[1].y, chartWidth, drawing.style.stroke);
    }
    if (isSelected) {
        drawSelectionHandles(ctx, [clipped[0], clipped[1]], drawing.style.stroke);
    }
}
function drawExtendedLine(drawing, scales, chartWidth, chartHeight, ctx, isSelected) {
    const [startPoint, endPoint] = drawing.points;
    if (!startPoint || !endPoint) {
        return;
    }
    const start = toPixel(startPoint, scales);
    const end = toPixel(endPoint, scales);
    const vector = { x: end.x - start.x, y: end.y - start.y };
    const clipped = clipSegmentToBox({ x: start.x - vector.x * 10_000, y: start.y - vector.y * 10_000 }, { x: start.x + vector.x * 10_000, y: start.y + vector.y * 10_000 }, chartWidth, chartHeight);
    if (!clipped) {
        return;
    }
    drawLine(ctx, clipped[0], clipped[1], drawing.style);
    // GAP-16: Y-axis price tag at right edge
    if (drawing.extendRight !== false && clipped[1].x >= chartWidth - 2) {
        // Interpolate price at clipped right edge
        const t = vector.x === 0 ? 0 : (clipped[1].x - start.x) / vector.x;
        const yAtRight = start.y + t * vector.y;
        const priceAtRight = startPoint.y + t * (endPoint.y - startPoint.y);
        drawYAxisPriceTag(ctx, priceAtRight, yAtRight, chartWidth, drawing.style.stroke);
    }
    if (isSelected) {
        drawSelectionHandles(ctx, [clipped[0], clipped[1]], drawing.style.stroke);
    }
}
function drawPolylineTool(drawing, scales, ctx, isSelected) {
    if (drawing.points.length < 2) {
        return;
    }
    const pixels = drawing.points.map((point) => toPixel(point, scales));
    drawPolyline(ctx, pixels, drawing.style);
    if (isSelected) {
        drawSelectionHandles(ctx, pixels, drawing.style.stroke);
    }
}
function drawDateAndPriceRange(drawing, scales, ctx, isSelected) {
    const [startPoint, endPoint] = drawing.points;
    if (!startPoint || !endPoint) {
        return;
    }
    const start = toPixel(startPoint, scales);
    const end = toPixel(endPoint, scales);
    const x = Math.min(start.x, end.x);
    const y = Math.min(start.y, end.y);
    const width = Math.abs(end.x - start.x);
    const height = Math.abs(end.y - start.y);
    const percent = startPoint.y === 0 ? 0 : ((endPoint.y - startPoint.y) / Math.abs(startPoint.y)) * 100;
    const bars = Math.max(1, Math.round(Math.abs(end.x - start.x) / 6));
    const badge = `Δ ${percent >= 0 ? "+" : ""}${percent.toFixed(2)}% · ${bars} bars`;
    ctx.save();
    const fillColor = drawing.style.fill && drawing.style.fill !== "transparent" ? drawing.style.fill : drawing.style.stroke;
    ctx.globalAlpha = drawing.style.fillOpacity ?? drawing.style.opacity ?? 1;
    ctx.fillStyle = fillColor;
    ctx.fillRect(x, y, width, height);
    ctx.restore();
    drawStrokedRect(ctx, { x, y, width, height }, drawing.style);
    drawTextLabel(ctx, badge, { x: x + 8, y: y + 16 }, drawing.style, {
        weight: 700,
        fontSize: drawing.style.fontSize ?? 11,
    });
    if (isSelected) {
        drawSelectionHandles(ctx, [start, end], drawing.style.stroke);
    }
}
function drawPositionZones(drawing, scales, mode, ctx, isSelected) {
    const [startPoint, endPoint] = drawing.points;
    if (!startPoint || !endPoint) {
        return;
    }
    const start = toPixel(startPoint, scales);
    const end = toPixel(endPoint, scales);
    const left = Math.min(start.x, end.x);
    const right = Math.max(start.x, end.x);
    const width = Math.max(0, right - left);
    const riskReward = drawing.riskReward ?? {
        entry: startPoint.y,
        stop: mode === "long" ? Math.min(startPoint.y, endPoint.y) : Math.max(startPoint.y, endPoint.y),
        target: mode === "long" ? Math.max(startPoint.y, endPoint.y) : Math.min(startPoint.y, endPoint.y),
    };
    const entryY = toPixel({ x: startPoint.x, y: riskReward.entry }, scales).y;
    const stopY = toPixel({ x: startPoint.x, y: riskReward.stop }, scales).y;
    const targetY = toPixel({ x: startPoint.x, y: riskReward.target }, scales).y;
    const reward = Math.abs(riskReward.target - riskReward.entry);
    const risk = Math.abs(riskReward.entry - riskReward.stop);
    const ratio = risk > 0 ? reward / risk : undefined;
    const badge = ratio ? `R/R 1:${ratio.toFixed(1)}` : "R/R n/a";
    const tpFill = "rgba(34, 171, 92, 0.18)";
    const slFill = "rgba(215, 50, 75, 0.18)";
    const tpBounds = { x: left, y: Math.min(entryY, targetY), width, height: Math.abs(targetY - entryY) };
    const slBounds = { x: left, y: Math.min(entryY, stopY), width, height: Math.abs(stopY - entryY) };
    drawFilledRect(ctx, tpBounds, tpFill, 1);
    drawFilledRect(ctx, slBounds, slFill, 1);
    drawLine(ctx, { x: left, y: entryY }, { x: right, y: entryY }, drawing.style);
    drawLine(ctx, { x: left, y: targetY }, { x: right, y: targetY }, drawing.style);
    drawLine(ctx, { x: left, y: stopY }, { x: right, y: stopY }, drawing.style);
    drawTextLabel(ctx, badge, { x: right - 4, y: Math.min(entryY, stopY, targetY) - 6 }, drawing.style, {
        align: "right",
        baseline: "alphabetic",
        weight: 700,
        fontSize: drawing.style.fontSize ?? 11,
    });
    if (isSelected) {
        drawSelectionHandles(ctx, [start, end], drawing.style.stroke);
    }
}
function drawRectangle(drawing, scales, ctx, isSelected) {
    const [startPoint, endPoint] = drawing.points;
    if (!startPoint || !endPoint) {
        return;
    }
    const start = toPixel(startPoint, scales);
    const end = toPixel(endPoint, scales);
    const x = Math.min(start.x, end.x);
    const y = Math.min(start.y, end.y);
    const width = Math.abs(end.x - start.x);
    const height = Math.abs(end.y - start.y);
    const fill = drawing.style.fill ?? "transparent";
    const fillAlpha = drawing.style.fillOpacity ?? drawing.style.opacity ?? 1;
    ctx.save();
    ctx.globalAlpha = fillAlpha;
    ctx.fillStyle = fill;
    ctx.fillRect(x, y, width, height);
    ctx.restore();
    drawStrokedRect(ctx, { x, y, width, height }, drawing.style);
    if (isSelected) {
        drawSelectionHandles(ctx, [start, end], drawing.style.stroke);
    }
}
function drawArrow(drawing, scales, ctx, isSelected) {
    const [startPoint, endPoint] = drawing.points;
    if (!startPoint || !endPoint) {
        return;
    }
    const start = toPixel(startPoint, scales);
    const end = toPixel(endPoint, scales);
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const length = Math.hypot(dx, dy);
    const headLength = Math.max(8, drawing.style.strokeWidth * 4);
    const headWidth = Math.max(5, drawing.style.strokeWidth * 2);
    drawLine(ctx, start, end, drawing.style);
    if (length > 0) {
        const ux = dx / length;
        const uy = dy / length;
        const px = -uy;
        const py = ux;
        const base = {
            x: end.x - ux * headLength,
            y: end.y - uy * headLength,
        };
        const left = {
            x: base.x + px * headWidth,
            y: base.y + py * headWidth,
        };
        const right = {
            x: base.x - px * headWidth,
            y: base.y - py * headWidth,
        };
        ctx.save();
        ctx.globalAlpha = drawing.style.opacity ?? 1;
        ctx.beginPath();
        ctx.moveTo(end.x, end.y);
        ctx.lineTo(left.x, left.y);
        ctx.lineTo(right.x, right.y);
        ctx.closePath();
        ctx.fillStyle = drawing.style.stroke;
        ctx.strokeStyle = drawing.style.stroke;
        ctx.lineWidth = drawing.style.strokeWidth;
        ctx.fill();
        ctx.stroke();
        ctx.restore();
    }
    if (isSelected) {
        drawSelectionHandles(ctx, [start, end], drawing.style.stroke);
    }
}
function drawLongPosition(drawing, scales, ctx, isSelected) {
    drawPositionZones(drawing, scales, "long", ctx, isSelected);
}
function drawShortPosition(drawing, scales, ctx, isSelected) {
    drawPositionZones(drawing, scales, "short", ctx, isSelected);
}
function drawGannFan(drawing, scales, chartWidth, chartHeight, ctx, isSelected) {
    const [originPoint, endPoint] = drawing.points;
    if (!originPoint || !endPoint) {
        return;
    }
    const origin = toPixel(originPoint, scales);
    const end = toPixel(endPoint, scales);
    const geometry = calculateGannFanGeometry(origin.x, origin.y, end.x, end.y, chartWidth, chartHeight);
    const gannSegKeys = SEGMENT_KEYS_BY_TYPE[drawing.type] ?? [];
    geometry.lines.forEach((line, lineIdx) => {
        const segKey = gannSegKeys[lineIdx];
        const segStyle = segKey ? resolveSegmentStyle(drawing, segKey) : drawing.style;
        if (segKey && !isSegmentVisible(drawing, segKey))
            return;
        ctx.save();
        ctx.strokeStyle = segStyle.stroke;
        ctx.lineWidth = line.isPrincipal ? (segStyle.strokeWidth + 1) : segStyle.strokeWidth;
        ctx.lineCap = "round";
        ctx.setLineDash([]);
        ctx.globalAlpha = segStyle.opacity ?? 1;
        ctx.beginPath();
        ctx.moveTo(line.x1, line.y1);
        ctx.lineTo(line.x2, line.y2);
        ctx.stroke();
        ctx.restore();
        // Label at end of line (clamped within chart)
        const labelX = Math.max(4, Math.min(chartWidth - 30, line.x2 + 4));
        const labelY = Math.max(12, Math.min(chartHeight - 4, line.y2 - 4));
        drawTextLabel(ctx, line.label, { x: labelX, y: labelY }, segStyle, {
            align: "left",
            baseline: "alphabetic",
            weight: line.isPrincipal ? 700 : 400,
            fontSize: segStyle.fontSize ?? 10,
        });
    });
    if (isSelected) {
        drawSelectionHandles(ctx, [origin, end], drawing.style.stroke);
    }
}
function drawElliottWave(drawing, scales, ctx, isSelected, focusedPointIndex) {
    const geometry = calculateElliottWaveGeometry(drawing, scales);
    if (!geometry || geometry.pixels.length < 2) {
        return;
    }
    const { pixels, labels } = geometry;
    const elliottSegKeys = SEGMENT_KEYS_BY_TYPE[drawing.type] ?? [];
    if (elliottSegKeys.length > 0) {
        for (let i = 0; i < elliottSegKeys.length && i + 1 < pixels.length; i++) {
            const key = elliottSegKeys[i];
            if (!isSegmentVisible(drawing, key))
                continue;
            drawLine(ctx, pixels[i], pixels[i + 1], resolveSegmentStyle(drawing, key));
        }
    }
    else {
        drawPolyline(ctx, pixels, drawing.style);
    }
    pixels.forEach((pixel, index) => {
        const label = labels[index] ?? "";
        if (!label) {
            return;
        }
        drawSemanticPointAffordance(ctx, label, pixel, drawing.style, isSelected, focusedPointIndex === index);
    });
    if (isSelected) {
        drawSelectionHandles(ctx, pixels, drawing.style.stroke);
    }
}
function drawHarmonicPattern(drawing, scales, ctx, isSelected, focusedPointIndex) {
    const geometry = calculateHarmonicPatternGeometry(drawing, scales);
    if (!geometry || geometry.pixels.length < 2) {
        return;
    }
    const { pixels, labels, hasClosingLine, isHeadAndShoulders } = geometry;
    // Filled polygon
    if (drawing.style.fill && drawing.style.fill !== "none") {
        ctx.save();
        ctx.globalAlpha = drawing.style.fillOpacity ?? 0.1;
        ctx.beginPath();
        pixels.forEach((pt, i) => {
            if (i === 0) {
                ctx.moveTo(pt.x, pt.y);
            }
            else {
                ctx.lineTo(pt.x, pt.y);
            }
        });
        ctx.closePath();
        ctx.fillStyle = drawing.style.fill;
        ctx.fill();
        ctx.restore();
    }
    // Zigzag polyline (body) — per-segment styles when registered
    const segKeys = SEGMENT_KEYS_BY_TYPE[drawing.type] ?? [];
    if (segKeys.length > 0) {
        // Sequential keys: all keys except last when a closing line exists
        const seqKeys = hasClosingLine ? segKeys.slice(0, segKeys.length - 1) : segKeys;
        for (let i = 0; i < seqKeys.length && i + 1 < pixels.length; i++) {
            const key = seqKeys[i];
            if (!isSegmentVisible(drawing, key))
                continue;
            const segStyle = resolveSegmentStyle(drawing, key);
            drawLine(ctx, pixels[i], pixels[i + 1], segStyle);
        }
    }
    else {
        drawPolyline(ctx, pixels, drawing.style);
    }
    // Closing line (dashed) from first → last point
    if (hasClosingLine && pixels.length >= 2) {
        const first = pixels[0];
        const last = pixels[pixels.length - 1];
        if (first && last) {
            const closingKey = segKeys.length > 0 ? segKeys[segKeys.length - 1] : undefined;
            const closingStyle = closingKey ? resolveSegmentStyle(drawing, closingKey) : drawing.style;
            if (!closingKey || isSegmentVisible(drawing, closingKey)) {
                ctx.save();
                ctx.globalAlpha = closingStyle.opacity ?? 1;
                ctx.strokeStyle = closingStyle.stroke;
                ctx.lineWidth = closingStyle.strokeWidth;
                ctx.setLineDash([5, 3]);
                ctx.beginPath();
                ctx.moveTo(first.x, first.y);
                ctx.lineTo(last.x, last.y);
                ctx.stroke();
                ctx.setLineDash([]);
                ctx.restore();
            }
        }
    }
    // Head & Shoulders neckline (NL=index5, NR=index6), yellow dashed, extended 20%
    if (isHeadAndShoulders && pixels.length >= 7) {
        const nl = pixels[5];
        const nr = pixels[6];
        if (nl && nr) {
            const dx = nr.x - nl.x;
            const dy = nr.y - nl.y;
            const ext = 0.2;
            ctx.save();
            ctx.globalAlpha = drawing.style.opacity ?? 1;
            ctx.strokeStyle = "#faad14";
            ctx.lineWidth = drawing.style.strokeWidth;
            ctx.setLineDash([6, 3]);
            ctx.beginPath();
            ctx.moveTo(nl.x - dx * ext, nl.y - dy * ext);
            ctx.lineTo(nr.x + dx * ext, nr.y + dy * ext);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.restore();
        }
    }
    // Point labels
    pixels.forEach((pixel, index) => {
        const label = labels[index] ?? "";
        if (!label) {
            return;
        }
        drawSemanticPointAffordance(ctx, label, pixel, drawing.style, isSelected, focusedPointIndex === index);
    });
    // GAP-11: colored harmonic ratio validation labels at leg midpoints
    const hrLabels = computeHarmonicRatioLabels(drawing);
    if (hrLabels.length > 0) {
        const ratioStyle = { align: "center", baseline: "alphabetic", weight: 700, fontSize: drawing.style.fontSize ?? 11 };
        hrLabels.forEach((hrLabel, i) => {
            const p0 = pixels[i];
            const p1 = pixels[i + 1];
            if (!p0 || !p1)
                return;
            const midX = (p0.x + p1.x) / 2;
            const midY = (p0.y + p1.y) / 2;
            drawTextLabel(ctx, formatHarmonicRatioLabel(hrLabel), { x: midX, y: midY - 10 }, { ...drawing.style, stroke: hrLabel.color }, ratioStyle);
        });
    }
    if (isSelected) {
        drawSelectionHandles(ctx, pixels, drawing.style.stroke);
    }
}
// ───── DT-13: Extended Fibonacci ────────────────────────────────────────────
function drawFibExtended(drawing, scales, ctx, isSelected) {
    const geo = calculateFibExtendedGeometry(drawing, scales);
    if (!geo)
        return;
    const { type, p1, p2, p3 } = geo;
    const stroke = drawing.style.stroke;
    const strokeWidth = drawing.style.strokeWidth;
    ctx.save();
    ctx.globalAlpha = drawing.style.opacity ?? 1;
    ctx.strokeStyle = stroke;
    ctx.lineWidth = strokeWidth;
    ctx.fillStyle = stroke;
    ctx.font = `bold 9px sans-serif`;
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const baseRadius = Math.sqrt(dx * dx + dy * dy);
    switch (type) {
        case "fibCircles":
        case "fibSpeedResistanceArcs": {
            // Concentric arcs / circles at fib levels × base radius
            const isArcs = type === "fibSpeedResistanceArcs";
            for (const level of FIB_EXTENDED_LEVELS) {
                const r = baseRadius * level;
                ctx.beginPath();
                if (isArcs) {
                    ctx.arc(p1.x, p1.y, r, Math.PI, 2 * Math.PI); // top semi-circle
                }
                else {
                    ctx.arc(p1.x, p1.y, r, 0, 2 * Math.PI);
                }
                ctx.globalAlpha = (drawing.style.opacity ?? 1) * 0.7;
                ctx.stroke();
                // label
                ctx.globalAlpha = drawing.style.opacity ?? 1;
                ctx.fillText(String(level), p1.x + r * 0.707, p1.y - r * 0.707);
            }
            // Center dot
            ctx.beginPath();
            ctx.arc(p1.x, p1.y, 3, 0, Math.PI * 2);
            ctx.fill();
            break;
        }
        case "fibSpiral": {
            // Golden ratio spiral: r = r0 * φ^(θ / (π/2))
            const PHI = 1.6180339887;
            const r0 = 1;
            const turns = 4 * Math.PI;
            const steps = 200;
            const angle0 = Math.atan2(dy, dx);
            ctx.beginPath();
            for (let i = 0; i <= steps; i++) {
                const theta = (i / steps) * turns;
                const r = r0 * Math.pow(PHI, theta / (Math.PI / 2));
                const x = p1.x + r * Math.cos(theta + angle0);
                const y = p1.y + r * Math.sin(theta + angle0);
                if (i === 0)
                    ctx.moveTo(x, y);
                else
                    ctx.lineTo(x, y);
            }
            ctx.stroke();
            break;
        }
        case "fibSpeedResistanceFan": {
            // Fan lines from p1 to p2 at FIB_FAN_RATIOS
            const canvasHeight = p1.y; // base at p1 y
            for (const ratio of FIB_FAN_RATIOS) {
                const targetY = p1.y - (p1.y - p2.y) * ratio;
                ctx.beginPath();
                ctx.moveTo(p1.x, p1.y);
                ctx.lineTo(p2.x, targetY);
                ctx.globalAlpha = (drawing.style.opacity ?? 1) * (ratio === 0.618 ? 1 : 0.7);
                ctx.stroke();
                ctx.globalAlpha = drawing.style.opacity ?? 1;
                ctx.fillText(String(ratio), p2.x + 4, targetY);
            }
            break;
        }
        case "fibChannel": {
            // Fib retracement channel — p3 is the offset point
            const channelDy = p2.y - p1.y;
            const offsetY = p3 ? (p3.y - p1.y) : channelDy;
            for (const level of FIB_EXTENDED_LEVELS.slice(0, 7)) {
                const lineY1 = p1.y + offsetY * level;
                const lineY2 = p2.y + offsetY * level;
                ctx.beginPath();
                ctx.moveTo(p1.x, lineY1);
                ctx.lineTo(p2.x, lineY2);
                ctx.globalAlpha = (drawing.style.opacity ?? 1) * (level === 0.618 ? 1 : 0.6);
                ctx.stroke();
                ctx.globalAlpha = drawing.style.opacity ?? 1;
                ctx.fillText(String(level), p2.x + 4, lineY2);
            }
            break;
        }
        case "trendBasedFibTime": {
            // Vertical lines at fib time intervals from p1→p2, then p2 + n*(p2-p1)
            const period = p2.x - p1.x;
            const FIBS = [0, 1, 1, 2, 3, 5, 8, 13, 21];
            const canvasH = 2000; // approximate
            for (const n of FIBS) {
                const vx = p1.x + period * n;
                ctx.beginPath();
                ctx.moveTo(vx, 0);
                ctx.lineTo(vx, canvasH);
                ctx.globalAlpha = (drawing.style.opacity ?? 1) * 0.6;
                ctx.stroke();
                ctx.globalAlpha = drawing.style.opacity ?? 1;
                ctx.fillText(String(n), vx + 3, p1.y - 8);
            }
            break;
        }
        case "fibWedge": {
            // Two converging trend lines meeting at p3 (apex-like)
            const apex = p3 ?? p2;
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(apex.x, apex.y);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(p2.x, p2.y);
            ctx.lineTo(apex.x, apex.y);
            ctx.stroke();
            // Fib retracement lines between p1 and p2 at apex
            for (const level of [0.382, 0.5, 0.618]) {
                const lx = p1.x + (p2.x - p1.x) * level;
                const ly = p1.y + (p2.y - p1.y) * level;
                ctx.beginPath();
                ctx.setLineDash([4, 3]);
                ctx.moveTo(lx, ly);
                ctx.lineTo(apex.x, apex.y);
                ctx.globalAlpha = (drawing.style.opacity ?? 1) * 0.5;
                ctx.stroke();
                ctx.setLineDash([]);
                ctx.globalAlpha = drawing.style.opacity ?? 1;
            }
            break;
        }
        case "pitchfan": {
            // 3 pivot points: A·B·C — fan lines from A through midpoints of B-C at fib ratios
            const midX = p3 ? (p2.x + p3.x) / 2 : p2.x;
            const midY = p3 ? (p2.y + p3.y) / 2 : p2.y;
            for (const ratio of FIB_FAN_RATIOS) {
                const tx = p3 ? p2.x + (p3.x - p2.x) * ratio : p2.x;
                const ty = p3 ? p2.y + (p3.y - p2.y) * ratio : p2.y;
                const extX = p1.x + (tx - p1.x) * 3;
                const extY = p1.y + (ty - p1.y) * 3;
                ctx.beginPath();
                ctx.moveTo(p1.x, p1.y);
                ctx.lineTo(extX, extY);
                ctx.globalAlpha = (drawing.style.opacity ?? 1) * (ratio === 0.5 ? 1 : 0.65);
                ctx.stroke();
                ctx.globalAlpha = drawing.style.opacity ?? 1;
                ctx.fillText(String(ratio), extX - 20, extY);
            }
            // Draw connecting line p2→p3
            if (p3) {
                ctx.beginPath();
                ctx.setLineDash([4, 3]);
                ctx.moveTo(p2.x, p2.y);
                ctx.lineTo(p3.x, p3.y);
                ctx.stroke();
                ctx.setLineDash([]);
            }
            break;
        }
        default:
            break;
    }
    if (isSelected) {
        const handles = [p1, p2];
        if (p3)
            handles.push(p3);
        drawSelectionHandles(ctx, handles, stroke);
    }
    ctx.restore();
}
// ───── DT-14: Gann Advanced ──────────────────────────────────────────────────
function drawGannAdvanced(drawing, scales, ctx, isSelected) {
    const geo = calculateGannAdvancedGeometry(drawing, scales);
    if (!geo)
        return;
    const { x1, y1, x2, y2 } = geo;
    const w = x2 - x1;
    const h = y2 - y1;
    const stroke = drawing.style.stroke;
    ctx.save();
    ctx.globalAlpha = drawing.style.opacity ?? 1;
    // Outer rect
    ctx.strokeStyle = stroke;
    ctx.lineWidth = drawing.style.strokeWidth;
    ctx.strokeRect(x1, y1, w, h);
    // Grid lines at 1/8 fractions (opacity 0.4)
    ctx.lineWidth = 1;
    for (const frac of GANN_FRACTIONS) {
        // Horizontal
        const gy = y1 + h * frac;
        ctx.beginPath();
        ctx.globalAlpha = (drawing.style.opacity ?? 1) * 0.4;
        ctx.strokeStyle = stroke;
        ctx.moveTo(x1, gy);
        ctx.lineTo(x2, gy);
        ctx.stroke();
        // Vertical
        const gx = x1 + w * frac;
        ctx.beginPath();
        ctx.moveTo(gx, y1);
        ctx.lineTo(gx, y2);
        ctx.stroke();
    }
    // 1×1 diagonal — red
    ctx.globalAlpha = drawing.style.opacity ?? 1;
    ctx.strokeStyle = "#ff4d4f";
    ctx.lineWidth = drawing.style.strokeWidth;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    // Other diagonals (muted)
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1;
    ctx.globalAlpha = (drawing.style.opacity ?? 1) * 0.4;
    ctx.beginPath();
    ctx.moveTo(x1, y2);
    ctx.lineTo(x2, y1);
    ctx.stroke();
    if (isSelected) {
        ctx.globalAlpha = drawing.style.opacity ?? 1;
        drawSelectionHandles(ctx, [{ x: x1, y: y1 }, { x: x2, y: y2 }], stroke);
    }
    ctx.restore();
}
// ───── DT-15: Cycle Tools ─────────────────────────────────────────────────────
function drawCycleTools(drawing, scales, ctx, isSelected) {
    const geo = calculateCycleGeometry(drawing, scales);
    if (!geo)
        return;
    const { type, x1, y1, x2, y2, count, amplitude } = geo;
    const stroke = drawing.style.stroke;
    const opacity = drawing.style.opacity ?? 1;
    ctx.save();
    ctx.strokeStyle = stroke;
    ctx.lineWidth = drawing.style.strokeWidth;
    if (type === "cyclicLines") {
        const dx = (x2 - x1) / count;
        for (let i = 0; i <= count; i++) {
            ctx.globalAlpha = opacity * (i % 2 === 0 ? 0.8 : 0.4);
            const gx = x1 + i * dx;
            ctx.beginPath();
            ctx.moveTo(gx, Math.min(y1, y2) - 20);
            ctx.lineTo(gx, Math.max(y1, y2) + 20);
            ctx.stroke();
        }
    }
    else if (type === "timeCycles") {
        ctx.globalAlpha = opacity;
        const dx = (x2 - x1) / count;
        const radius = Math.abs(dx) / 2;
        for (let i = 0; i < count; i++) {
            const cx = x1 + (i + 0.5) * dx;
            ctx.beginPath();
            ctx.arc(cx, y1, Math.abs(radius), 0, Math.PI, false);
            ctx.stroke();
        }
    }
    else if (type === "sineLine") {
        ctx.globalAlpha = opacity;
        const totalWidth = x2 - x1;
        const halfPeriod = totalWidth / count;
        ctx.beginPath();
        const steps = Math.max(200, Math.abs(totalWidth) * 2);
        for (let i = 0; i <= steps; i++) {
            const px = x1 + (i / steps) * totalWidth;
            const py = y1 - amplitude * Math.sin(Math.PI * (px - x1) / halfPeriod);
            if (i === 0)
                ctx.moveTo(px, py);
            else
                ctx.lineTo(px, py);
        }
        ctx.stroke();
    }
    if (isSelected) {
        ctx.globalAlpha = opacity;
        drawSelectionHandles(ctx, [{ x: x1, y: y1 }, { x: x2, y: y2 }], stroke);
    }
    ctx.restore();
}
export function renderDrawingToCanvas(ctx, drawing, scales, options) {
    if (drawing.visible === false) {
        return;
    }
    renderDrawingShape(ctx, drawing, scales, options);
    // DT-10-T07: render 🔔 badge if alert is active
    if (drawing.alertCondition?.enabled) {
        renderDrawingAlertIcon(ctx, drawing, scales, options.chartWidth, options.chartHeight);
    }
}
function renderDrawingShape(ctx, drawing, scales, options) {
    const effectiveDrawing = {
        ...drawing,
        style: resolveDrawingStyle(drawing),
    };
    const overlayPrimitive = toOverlayPrimitive(effectiveDrawing, scales, {
        chartWidth: options.chartWidth,
        chartHeight: options.chartHeight,
        plotData: options.plotData,
        focusedPointIndex: options.focusedPointIndex,
    });
    if (overlayPrimitive) {
        renderOverlayPrimitiveToCanvas(ctx, overlayPrimitive, options);
        return;
    }
    switch (effectiveDrawing.type) {
        default:
            return;
    }
    // DT-10-T07: After rendering, draw alert icon if condition is active
    if (drawing.alertCondition?.enabled) {
        renderDrawingAlertIcon(ctx, drawing, scales, options.chartWidth, options.chartHeight);
    }
}
// ─── CE21-DT1: Action handles (delete / clone / lock) ─────────────────────────
/**
 * Compute the bounding box of a drawing's anchor points in pixel space.
 * hLine / vLine are treated as spanning the full chart dimension.
 * (Mirrors getDrawingBoundingBox in hitTest.ts — kept local to avoid circular dep.)
 */
function computeBoundingBox(drawing, scales, chartWidth, chartHeight) {
    if (drawing.points.length === 0) {
        return null;
    }
    if (drawing.type === "hLine" && drawing.points[0]) {
        const p = toPixel(drawing.points[0], scales);
        return { minX: 0, maxX: chartWidth, minY: p.y, maxY: p.y };
    }
    if (drawing.type === "vLine" && drawing.points[0]) {
        const p = toPixel(drawing.points[0], scales);
        return { minX: p.x, maxX: p.x, minY: 0, maxY: chartHeight };
    }
    if (drawing.type === "circle") {
        const [centerPoint, edgePoint] = drawing.points;
        if (!centerPoint || !edgePoint) {
            return null;
        }
        const center = toPixel(centerPoint, scales);
        const edge = toPixel(edgePoint, scales);
        const radius = Math.hypot(edge.x - center.x, edge.y - center.y);
        if (!Number.isFinite(radius) || radius <= 0) {
            return null;
        }
        return {
            minX: center.x - radius,
            maxX: center.x + radius,
            minY: center.y - radius,
            maxY: center.y + radius,
        };
    }
    // For gannSquare/gannBox/gannSquareFixed use actual rendered corners clamped to the
    // visible chart area so action handles are always reachable within the viewport.
    if (drawing.type === "gannSquare" || drawing.type === "gannBox" || drawing.type === "gannSquareFixed") {
        const geo = calculateGannAdvancedGeometry(drawing, scales);
        if (geo) {
            return {
                minX: Math.max(0, Math.min(geo.x1, geo.x2)),
                maxX: Math.min(chartWidth, Math.max(geo.x1, geo.x2)),
                minY: Math.max(0, Math.min(geo.y1, geo.y2)),
                maxY: Math.min(chartHeight, Math.max(geo.y1, geo.y2)),
            };
        }
    }
    const pixels = drawing.points.map((pt) => toPixel(pt, scales));
    const xs = pixels.map((p) => p.x);
    const ys = pixels.map((p) => p.y);
    return {
        minX: Math.min(...xs),
        maxX: Math.max(...xs),
        minY: Math.min(...ys),
        maxY: Math.max(...ys),
    };
}
/**
 * Render the three action handles for a selected drawing onto the canvas.
 *   delete → red circle with × , top-right corner + (14, −14)
 *   clone  → blue circle with +, top-right corner + (32, −14)
 *   lock   → yellow (locked) / gray (unlocked) circle with indicator, top-left + (−14, −14)
 */
export function renderDrawingActionHandles(ctx, drawing, scales, chartWidth = 1000, chartHeight = 600) {
    const bbox = computeBoundingBox(drawing, scales, chartWidth, chartHeight);
    if (!bbox) {
        return;
    }
    const handles = [
        { x: bbox.maxX + 14, y: bbox.minY - 14, fill: "#ff4d4f", icon: "\u00d7" }, // delete
        { x: bbox.maxX + 32, y: bbox.minY - 14, fill: "#1677ff", icon: "+" }, // clone
        {
            x: bbox.minX - 14,
            y: bbox.minY - 14,
            fill: drawing.locked ? "#faad14" : "#8c8c8c",
            icon: drawing.locked ? "\u25a0" : "\u25a1", // ■ locked / □ unlocked
        },
    ];
    ctx.save();
    ctx.globalAlpha = 1;
    ctx.setLineDash([]);
    for (const handle of handles) {
        const r = 8;
        ctx.beginPath();
        ctx.arc(handle.x, handle.y, r, 0, Math.PI * 2);
        ctx.fillStyle = handle.fill;
        ctx.fill();
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 10px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(handle.icon, handle.x, handle.y);
    }
    ctx.restore();
}
/**
 * DT-10-T07: Render a 🔔 bell badge on drawings that have an active alert condition.
 * Drawn at top-right of the drawing's bounding box.
 */
export function renderDrawingAlertIcon(ctx, drawing, scales, chartWidth = 1000, chartHeight = 600) {
    if (!drawing.alertCondition?.enabled)
        return;
    const bbox = computeBoundingBox(drawing, scales, chartWidth, chartHeight);
    if (!bbox)
        return;
    const x = bbox.maxX - 2;
    const y = bbox.minY + 2;
    ctx.save();
    ctx.font = "11px sans-serif";
    ctx.textAlign = "right";
    ctx.textBaseline = "top";
    ctx.globalAlpha = 0.9;
    ctx.fillText("\uD83D\uDD14", x, y);
    ctx.restore();
}
/**
 * Renders the rubber-band selection rectangle.
 * Coordinates are in chart-local pixel space (matching moreProps.mouseXY).
 */
export function renderRubberBand(ctx, startX, startY, currentX, currentY) {
    const x = Math.min(startX, currentX);
    const y = Math.min(startY, currentY);
    const w = Math.abs(currentX - startX);
    const h = Math.abs(currentY - startY);
    if (w < 2 && h < 2) {
        return;
    }
    ctx.save();
    ctx.globalAlpha = 0.08;
    ctx.fillStyle = "#1677ff";
    ctx.fillRect(x, y, w, h);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = "#1677ff";
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, w, h);
    ctx.restore();
}
/**
 * Render a live measurement tooltip near (px, py).
 * The label is clamped to stay inside the chart viewport.
 */
export function renderMeasurementLabel(ctx, px, py, opts) {
    const PADDING = 6;
    const LINE_HEIGHT = 16;
    const FONT = "12px sans-serif";
    const lines = [opts.priceDeltaText, opts.pctText, opts.barsText];
    ctx.save();
    ctx.font = FONT;
    const maxWidth = Math.max(...lines.map((l) => ctx.measureText(l).width));
    const boxW = maxWidth + PADDING * 2;
    const boxH = lines.length * LINE_HEIGHT + PADDING * 2;
    // Default: just above and to the right of cursor
    let bx = px + 10;
    let by = py - boxH - 6;
    // Clamp right edge
    if (bx + boxW > opts.chartWidth - 4) {
        bx = px - boxW - 10;
    }
    // Clamp bottom edge
    if (by + boxH > opts.chartHeight - 4) {
        by = opts.chartHeight - boxH - 4;
    }
    // Clamp top
    if (by < 4) {
        by = 4;
    }
    // Clamp left
    if (bx < 4) {
        bx = 4;
    }
    // Background
    ctx.globalAlpha = 0.88;
    ctx.fillStyle = "#1a1a2e";
    ctx.beginPath();
    ctx.roundRect(bx, by, boxW, boxH, 4);
    ctx.fill();
    ctx.globalAlpha = 1;
    // Text
    ctx.fillStyle = "#ffffff";
    ctx.textBaseline = "top";
    lines.forEach((line, i) => {
        ctx.fillText(line, bx + PADDING, by + PADDING + i * LINE_HEIGHT);
    });
    ctx.restore();
}
