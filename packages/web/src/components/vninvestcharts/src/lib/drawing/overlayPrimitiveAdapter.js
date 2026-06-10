import { chartPointToPixel } from "./coordinateUtils.js";
import { calculateAbcdPatternMetrics } from "../../widget/fork-geometry/abcdPattern.js";
import { calculateCycleGeometry } from "../../widget/fork-geometry/cycles.js";
import { calculateElliottWaveGeometry } from "../../widget/fork-geometry/elliottWaves.js";
import { calculateFibArcGeometry } from "../../widget/fork-geometry/fibArc.js";
import { calculateFibExtendedGeometry, FIB_EXTENDED_LEVELS, FIB_FAN_RATIOS } from "../../widget/fork-geometry/fibExtended.js";
import { calculateFibTimeZoneGeometry } from "../../widget/fork-geometry/fibTimeZone.js";
import { calculateGannAdvancedGeometry, GANN_FRACTIONS } from "../../widget/fork-geometry/gannAdvanced.js";
import { calculateGannFanGeometry } from "../../widget/fork-geometry/gannFan.js";
import { calculateHarmonicPatternGeometry } from "../../widget/fork-geometry/harmonicPatterns.js";
import { computeHarmonicRatioLabels, formatHarmonicRatioLabel } from "./harmonicRatioValidation.js";
import { calculateParallelChannelGeometry } from "../../widget/fork-geometry/parallelChannel.js";
import { calculatePitchforkGeometry } from "../../widget/fork-geometry/pitchfork.js";
import { calculateRegressionChannelMetrics } from "../../widget/fork-geometry/regressionChannel.js";
import { SEGMENT_KEYS_BY_TYPE, isSegmentVisible, resolveSegmentStyle } from "./segmentRegistry.js";
const DEFAULT_FIB_LEVELS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1, 1.618, 2.618];
const DEFAULT_FIB_EXTENSION_LEVELS = [1.272, 1.414, 1.618, 2, 2.618];
const TREND_BASED_FIB_TIME_LEVELS = [0, 1, 1, 2, 3, 5, 8, 13, 21];
function toPixel(point, scales) {
    return chartPointToPixel(point, scales);
}
function toPrimitiveStyle(style) {
    return {
        stroke: style.stroke,
        strokeWidth: style.strokeWidth,
        strokeDasharray: style.strokeDasharray,
        fill: style.fill,
        fillOpacity: style.fillOpacity,
        opacity: style.opacity,
        fontSize: style.fontSize,
        fontFamily: style.fontFamily,
    };
}
function clipSegmentToBox(start, end, chartWidth, chartHeight) {
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
function toPrimitiveSegment(drawing, key, start, end, patch) {
    const style = toPrimitiveStyle(resolveSegmentStyle(drawing, key));
    return {
        start,
        end,
        color: style.stroke,
        strokeWidth: style.strokeWidth,
        strokeDasharray: patch?.strokeDasharray ?? style.strokeDasharray,
        dashPattern: patch?.dashPattern,
        opacity: patch?.opacity,
        hitTestable: patch?.hitTestable,
        label: patch?.label,
        labelPosition: patch?.labelPosition,
    };
}
function buildAbcdPatternPrimitive(drawing, scales, primitiveStyle) {
    const metrics = calculateAbcdPatternMetrics(drawing, scales);
    if (!metrics) {
        return null;
    }
    const labels = drawing.waveLabels ?? ["A", "B", "C", "D"];
    const fontSize = drawing.style.fontSize ?? 11;
    const points = metrics.points;
    const segments = [];
    const segmentKeys = SEGMENT_KEYS_BY_TYPE.abcdPattern ?? [];
    for (let index = 0; index < segmentKeys.length && index + 1 < points.length; index += 1) {
        const key = segmentKeys[index];
        if (!isSegmentVisible(drawing, key)) {
            continue;
        }
        segments.push(toPrimitiveSegment(drawing, key, points[index], points[index + 1]));
    }
    const pointLabels = points.map((point, index) => ({
        text: labels[index] ?? ["A", "B", "C", "D"][index] ?? "",
        position: { x: point.x + 6, y: point.y - 6 },
        baseline: "alphabetic",
        weight: 700,
        fontSize,
    })).filter((label) => label.text.length > 0);
    const ratioLabels = computeHarmonicRatioLabels(drawing);
    const valueLabels = ratioLabels.length >= 2
        ? [
            {
                text: formatHarmonicRatioLabel(ratioLabels[0]),
                position: { x: metrics.segmentMidpoints[1].x, y: metrics.segmentMidpoints[1].y - 10 },
                align: "center",
                baseline: "alphabetic",
                weight: 700,
                fontSize,
                color: ratioLabels[0].color,
            },
            {
                text: formatHarmonicRatioLabel(ratioLabels[1]),
                position: { x: metrics.segmentMidpoints[2].x, y: metrics.segmentMidpoints[2].y - 10 },
                align: "center",
                baseline: "alphabetic",
                weight: 700,
                fontSize,
                color: ratioLabels[1].color,
            },
        ]
        : [
            {
                text: metrics.bcToAb == null ? "BC/AB n/a" : `BC/AB ${metrics.bcToAb.toFixed(2)}`,
                position: { x: metrics.segmentMidpoints[1].x, y: metrics.segmentMidpoints[1].y - 10 },
                align: "center",
                baseline: "alphabetic",
                weight: 700,
                fontSize,
            },
            {
                text: metrics.cdToBc == null ? "CD/BC n/a" : `CD/BC ${metrics.cdToBc.toFixed(2)}`,
                position: { x: metrics.segmentMidpoints[2].x, y: metrics.segmentMidpoints[2].y - 10 },
                align: "center",
                baseline: "alphabetic",
                weight: 700,
                fontSize,
            },
        ];
    return {
        type: "abcdPattern",
        points,
        style: primitiveStyle,
        segments,
        labels: [...pointLabels, ...valueLabels],
    };
}
function buildHarmonicPatternPrimitive(drawing, scales, primitiveStyle, options) {
    const geometry = calculateHarmonicPatternGeometry(drawing, scales);
    if (!geometry || geometry.pixels.length < 2) {
        return null;
    }
    const { pixels, labels, hasClosingLine, isHeadAndShoulders } = geometry;
    const fontSize = drawing.style.fontSize ?? 11;
    const segmentKeys = SEGMENT_KEYS_BY_TYPE[drawing.type] ?? [];
    const segments = [];
    const seqKeys = segmentKeys.length > 0 && hasClosingLine ? segmentKeys.slice(0, segmentKeys.length - 1) : segmentKeys;
    if (seqKeys.length > 0) {
        for (let index = 0; index < seqKeys.length && index + 1 < pixels.length; index += 1) {
            const key = seqKeys[index];
            if (!isSegmentVisible(drawing, key)) {
                continue;
            }
            segments.push(toPrimitiveSegment(drawing, key, pixels[index], pixels[index + 1]));
        }
    }
    else {
        for (let index = 1; index < pixels.length; index += 1) {
            segments.push({
                start: pixels[index - 1],
                end: pixels[index],
                color: primitiveStyle.stroke,
                strokeWidth: primitiveStyle.strokeWidth,
                strokeDasharray: primitiveStyle.strokeDasharray,
            });
        }
    }
    if (hasClosingLine && pixels.length >= 2) {
        const first = pixels[0];
        const last = pixels[pixels.length - 1];
        const closingKey = segmentKeys.length > 0 ? segmentKeys[segmentKeys.length - 1] : undefined;
        if (!closingKey || isSegmentVisible(drawing, closingKey)) {
            segments.push(closingKey
                ? toPrimitiveSegment(drawing, closingKey, first, last, { strokeDasharray: "dashed", dashPattern: [5, 3], hitTestable: false })
                : {
                    start: first,
                    end: last,
                    color: primitiveStyle.stroke,
                    strokeWidth: primitiveStyle.strokeWidth,
                    strokeDasharray: "dashed",
                    dashPattern: [5, 3],
                    hitTestable: false,
                });
        }
    }
    if (isHeadAndShoulders && pixels.length >= 7) {
        const leftNeckline = pixels[5];
        const rightNeckline = pixels[6];
        const dx = rightNeckline.x - leftNeckline.x;
        const dy = rightNeckline.y - leftNeckline.y;
        const extension = 0.2;
        segments.push({
            start: { x: leftNeckline.x - dx * extension, y: leftNeckline.y - dy * extension },
            end: { x: rightNeckline.x + dx * extension, y: rightNeckline.y + dy * extension },
            color: "#faad14",
            strokeWidth: primitiveStyle.strokeWidth,
            strokeDasharray: "dashed",
            dashPattern: [6, 3],
            hitTestable: false,
        });
    }
    const ratioLabels = computeHarmonicRatioLabels(drawing).map((label, index) => {
        const start = pixels[index];
        const end = pixels[index + 1];
        if (!start || !end) {
            return null;
        }
        return {
            text: formatHarmonicRatioLabel(label),
            position: { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 - 10 },
            align: "center",
            baseline: "alphabetic",
            weight: 700,
            fontSize,
            color: label.color,
        };
    }).filter((label) => label !== null);
    return {
        type: drawing.type,
        points: pixels,
        style: primitiveStyle,
        polygons: drawing.style.fill && drawing.style.fill !== "none"
            ? [{ points: pixels, fill: drawing.style.fill, opacity: drawing.style.fillOpacity ?? 0.1 }]
            : undefined,
        segments,
        labels: ratioLabels,
        semanticBadges: labels.map((label, index) => ({
            label,
            position: pixels[index],
            isFocused: options?.focusedPointIndex === index,
        })),
    };
}
function buildElliottWavePrimitive(drawing, scales, primitiveStyle, options) {
    const geometry = calculateElliottWaveGeometry(drawing, scales);
    if (!geometry || geometry.pixels.length < 2) {
        return null;
    }
    const { pixels, labels } = geometry;
    const segmentKeys = SEGMENT_KEYS_BY_TYPE[drawing.type] ?? [];
    const segments = [];
    if (segmentKeys.length > 0) {
        for (let index = 0; index < segmentKeys.length && index + 1 < pixels.length; index += 1) {
            const key = segmentKeys[index];
            if (!isSegmentVisible(drawing, key)) {
                continue;
            }
            segments.push(toPrimitiveSegment(drawing, key, pixels[index], pixels[index + 1]));
        }
    }
    else {
        for (let index = 1; index < pixels.length; index += 1) {
            segments.push({
                start: pixels[index - 1],
                end: pixels[index],
                color: primitiveStyle.stroke,
                strokeWidth: primitiveStyle.strokeWidth,
                strokeDasharray: primitiveStyle.strokeDasharray,
            });
        }
    }
    return {
        type: drawing.type,
        points: pixels,
        style: primitiveStyle,
        segments,
        semanticBadges: labels.map((label, index) => ({
            label,
            position: pixels[index],
            isFocused: options?.focusedPointIndex === index,
        })),
    };
}
function buildGannFanPrimitive(drawing, scales, primitiveStyle, options) {
    const [originPoint, endPoint] = drawing.points;
    if (!originPoint || !endPoint || options?.chartWidth == null || options?.chartHeight == null) {
        return null;
    }
    const origin = toPixel(originPoint, scales);
    const end = toPixel(endPoint, scales);
    const geometry = calculateGannFanGeometry(origin.x, origin.y, end.x, end.y, options.chartWidth, options.chartHeight);
    const segmentKeys = SEGMENT_KEYS_BY_TYPE.gannFan ?? [];
    const segments = [];
    const labels = [];
    for (let index = 0; index < geometry.lines.length; index += 1) {
        const line = geometry.lines[index];
        const key = segmentKeys[index];
        if (key && !isSegmentVisible(drawing, key)) {
            continue;
        }
        const segmentStyle = key ? resolveSegmentStyle(drawing, key) : drawing.style;
        segments.push({
            start: { x: line.x1, y: line.y1 },
            end: { x: line.x2, y: line.y2 },
            color: segmentStyle.stroke,
            strokeWidth: line.isPrincipal ? segmentStyle.strokeWidth + 1 : segmentStyle.strokeWidth,
            strokeDasharray: "solid",
        });
        labels.push({
            text: line.label,
            position: {
                x: Math.max(4, Math.min(options.chartWidth - 30, line.x2 + 4)),
                y: Math.max(12, Math.min(options.chartHeight - 4, line.y2 - 4)),
            },
            color: segmentStyle.stroke,
            align: "left",
            baseline: "alphabetic",
            weight: line.isPrincipal ? 700 : 400,
            fontSize: segmentStyle.fontSize ?? 10,
        });
    }
    return {
        type: "gannFan",
        points: [origin, end],
        style: primitiveStyle,
        segments,
        labels,
    };
}
function buildGannAdvancedPrimitive(drawing, scales, primitiveStyle) {
    const geometry = calculateGannAdvancedGeometry(drawing, scales);
    if (!geometry) {
        return null;
    }
    const { x1, y1, x2, y2 } = geometry;
    const left = Math.min(x1, x2);
    const right = Math.max(x1, x2);
    const top = Math.min(y1, y2);
    const bottom = Math.max(y1, y2);
    const width = right - left;
    const height = bottom - top;
    const baseOpacity = primitiveStyle.opacity ?? 1;
    const segments = [
        { start: { x: left, y: top }, end: { x: right, y: top }, color: primitiveStyle.stroke, strokeWidth: primitiveStyle.strokeWidth },
        { start: { x: right, y: top }, end: { x: right, y: bottom }, color: primitiveStyle.stroke, strokeWidth: primitiveStyle.strokeWidth },
        { start: { x: right, y: bottom }, end: { x: left, y: bottom }, color: primitiveStyle.stroke, strokeWidth: primitiveStyle.strokeWidth },
        { start: { x: left, y: bottom }, end: { x: left, y: top }, color: primitiveStyle.stroke, strokeWidth: primitiveStyle.strokeWidth },
    ];
    for (const fraction of GANN_FRACTIONS) {
        segments.push({
            start: { x: left, y: top + height * fraction },
            end: { x: right, y: top + height * fraction },
            color: primitiveStyle.stroke,
            strokeWidth: 1,
            opacity: 0.4 / baseOpacity,
            hitTestable: false,
        }, {
            start: { x: left + width * fraction, y: top },
            end: { x: left + width * fraction, y: bottom },
            color: primitiveStyle.stroke,
            strokeWidth: 1,
            opacity: 0.4 / baseOpacity,
            hitTestable: false,
        });
    }
    segments.push({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, color: "#ff4d4f", strokeWidth: primitiveStyle.strokeWidth, hitTestable: false }, { start: { x: x1, y: y2 }, end: { x: x2, y: y1 }, color: primitiveStyle.stroke, strokeWidth: 1, opacity: 0.4 / baseOpacity, hitTestable: false });
    return {
        type: drawing.type,
        points: [{ x: x1, y: y1 }, { x: x2, y: y2 }],
        style: primitiveStyle,
        segments,
    };
}
function buildPositionPrimitive(drawing, scales, primitiveStyle, mode) {
    const [startPoint, endPoint] = drawing.points;
    if (!startPoint || !endPoint) {
        return null;
    }
    const start = toPixel(startPoint, scales);
    const end = toPixel(endPoint, scales);
    const left = Math.min(start.x, end.x);
    const right = Math.max(start.x, end.x);
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
    return {
        type: drawing.type,
        points: [start, end],
        style: primitiveStyle,
        polygons: [
            {
                points: [
                    { x: left, y: Math.min(entryY, targetY) },
                    { x: right, y: Math.min(entryY, targetY) },
                    { x: right, y: Math.max(entryY, targetY) },
                    { x: left, y: Math.max(entryY, targetY) },
                ],
                fill: "rgba(34, 171, 92, 0.18)",
            },
            {
                points: [
                    { x: left, y: Math.min(entryY, stopY) },
                    { x: right, y: Math.min(entryY, stopY) },
                    { x: right, y: Math.max(entryY, stopY) },
                    { x: left, y: Math.max(entryY, stopY) },
                ],
                fill: "rgba(215, 50, 75, 0.18)",
            },
        ],
        segments: [
            { start: { x: left, y: entryY }, end: { x: right, y: entryY } },
            { start: { x: left, y: targetY }, end: { x: right, y: targetY } },
            { start: { x: left, y: stopY }, end: { x: right, y: stopY } },
        ],
        labels: [{
                text: badge,
                position: { x: right - 4, y: Math.min(entryY, stopY, targetY) - 6 },
                align: "right",
                baseline: "alphabetic",
                weight: 700,
                fontSize: drawing.style.fontSize ?? 11,
            }],
    };
}
function buildCyclePrimitive(drawing, scales, primitiveStyle) {
    const geometry = calculateCycleGeometry(drawing, scales);
    if (!geometry) {
        return null;
    }
    const { type, x1, y1, x2, y2, amplitude } = geometry;
    const count = Math.max(1, geometry.count);
    const anchorSegment = {
        start: { x: x1, y: y1 },
        end: { x: x2, y: y2 },
        opacity: 0,
    };
    if (type === "cyclicLines") {
        const dx = (x2 - x1) / count;
        const top = Math.min(y1, y2) - 20;
        const bottom = Math.max(y1, y2) + 20;
        return {
            type,
            points: [{ x: x1, y: y1 }, { x: x2, y: y2 }],
            style: primitiveStyle,
            segments: [
                anchorSegment,
                ...Array.from({ length: count + 1 }, (_, index) => {
                    const x = x1 + index * dx;
                    return {
                        start: { x, y: top },
                        end: { x, y: bottom },
                        opacity: index % 2 === 0 ? 0.8 : 0.4,
                        hitTestable: false,
                    };
                }),
            ],
        };
    }
    if (type === "timeCycles") {
        const dx = (x2 - x1) / count;
        const radius = Math.abs(dx) / 2;
        const paths = Array.from({ length: count }, (_, index) => {
            const centerX = x1 + (index + 0.5) * dx;
            return {
                points: Array.from({ length: 25 }, (_, step) => {
                    const theta = (step / 24) * Math.PI;
                    return {
                        x: centerX + radius * Math.cos(theta),
                        y: y1 + radius * Math.sin(theta),
                    };
                }),
            };
        });
        return {
            type,
            points: [{ x: x1, y: y1 }, { x: x2, y: y2 }],
            style: primitiveStyle,
            segments: [anchorSegment],
            paths,
        };
    }
    const totalWidth = x2 - x1;
    const halfPeriod = totalWidth / count || Number.EPSILON;
    const steps = Math.max(200, Math.round(Math.abs(totalWidth) * 2));
    return {
        type,
        points: [{ x: x1, y: y1 }, { x: x2, y: y2 }],
        style: primitiveStyle,
        segments: [anchorSegment],
        paths: [{
                points: Array.from({ length: steps + 1 }, (_, index) => {
                    const px = x1 + (index / steps) * totalWidth;
                    return {
                        x: px,
                        y: y1 - amplitude * Math.sin(Math.PI * (px - x1) / halfPeriod),
                    };
                }),
            }],
    };
}
function buildDateAndPriceRangeBadge(drawing, scales) {
    const [startPoint, endPoint] = drawing.points;
    if (!startPoint || !endPoint) {
        return undefined;
    }
    const start = toPixel(startPoint, scales);
    const end = toPixel(endPoint, scales);
    const percent = startPoint.y === 0 ? 0 : ((endPoint.y - startPoint.y) / Math.abs(startPoint.y)) * 100;
    const bars = Math.max(1, Math.round(Math.abs(end.x - start.x) / 6));
    return `Δ ${percent >= 0 ? "+" : ""}${percent.toFixed(2)}% · ${bars} bars`;
}
function formatOverlayNumber(value) {
    return new Intl.NumberFormat("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(value);
}
function buildFibonacciLevelLines(drawing, scales, mode) {
    const [startPoint, endPoint] = drawing.points;
    if (!startPoint || !endPoint) {
        return undefined;
    }
    const start = toPixel(startPoint, scales);
    const end = toPixel(endPoint, scales);
    const priceDelta = endPoint.y - startPoint.y;
    const pixelDelta = end.y - start.y;
    const fallbackLevels = mode === "extension" ? DEFAULT_FIB_EXTENSION_LEVELS : DEFAULT_FIB_LEVELS;
    if (drawing.fibLevelConfigs && drawing.fibLevelConfigs.length > 0) {
        return drawing.fibLevelConfigs
            .filter((config) => config.visible)
            .map((config) => {
            const price = mode === "extension"
                ? endPoint.y + priceDelta * config.ratio
                : startPoint.y + priceDelta * config.ratio;
            const y = mode === "extension"
                ? toPixel({ x: endPoint.x, y: price }, scales).y
                : start.y + pixelDelta * config.ratio;
            return {
                y,
                label: `${(config.ratio * 100).toFixed(1)}% — ${formatOverlayNumber(price)}`,
                color: config.color,
            };
        });
    }
    return (drawing.fibLevels ?? fallbackLevels).map((ratio) => {
        const price = mode === "extension"
            ? endPoint.y + priceDelta * ratio
            : startPoint.y + priceDelta * ratio;
        const y = mode === "extension"
            ? toPixel({ x: endPoint.x, y: price }, scales).y
            : start.y + pixelDelta * ratio;
        return {
            y,
            label: `${(ratio * 100).toFixed(1)}% — ${formatOverlayNumber(price)}`,
        };
    });
}
function buildFibArcLevels(drawing, scales) {
    const geometry = calculateFibArcGeometry(drawing, scales);
    if (!geometry) {
        return undefined;
    }
    return geometry.radii.map((radius, index) => ({
        radius,
        label: `${(geometry.levels[index] * 100).toFixed(1)}%`,
        radiusRatio: geometry.levels[index],
    }));
}
function buildFibTimeZoneMarkers(drawing, scales) {
    const geometry = calculateFibTimeZoneGeometry(drawing, scales);
    if (!geometry) {
        return undefined;
    }
    const [startPoint, endPoint] = drawing.points;
    const startIndex = startPoint?.xIndexFloat;
    const endIndex = endPoint?.xIndexFloat;
    return geometry.positions.map((x, index) => {
        let xIndexFloat;
        if (typeof startIndex === "number" && typeof endIndex === "number") {
            const stepIndex = endIndex - startIndex;
            xIndexFloat = startIndex + stepIndex * geometry.levels[index];
        }
        return {
            x,
            label: `${geometry.levels[index]}`,
            xIndexFloat,
        };
    });
}
function buildFibExtendedPrimitive(drawing, scales, primitiveStyle) {
    const geometry = calculateFibExtendedGeometry(drawing, scales);
    if (!geometry) {
        return null;
    }
    const { type, p1, p2, p3 } = geometry;
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const baseRadius = Math.hypot(dx, dy);
    switch (type) {
        case "fibCircles":
        case "fibSpeedResistanceArcs":
            return {
                type,
                points: [p1, p2],
                style: primitiveStyle,
                arcLevels: FIB_EXTENDED_LEVELS.map((level) => ({
                    radius: baseRadius * level,
                    label: String(level),
                    labelPosition: { x: p1.x + baseRadius * level * 0.707, y: p1.y - baseRadius * level * 0.707 },
                    startAngle: type === "fibSpeedResistanceArcs" ? Math.PI : 0,
                    endAngle: Math.PI * 2,
                    opacity: 0.7,
                    radiusRatio: level,
                })),
                pointMarkers: [{ point: p1, radius: 3 }],
            };
        case "fibSpiral": {
            const phi = 1.6180339887;
            const steps = 200;
            const turns = 4 * Math.PI;
            const angle0 = Math.atan2(dy, dx);
            const points = Array.from({ length: steps + 1 }, (_, index) => {
                const theta = (index / steps) * turns;
                const radius = Math.pow(phi, theta / (Math.PI / 2));
                return {
                    x: p1.x + radius * Math.cos(theta + angle0),
                    y: p1.y + radius * Math.sin(theta + angle0),
                };
            });
            return {
                type,
                points: [p1, p2],
                style: primitiveStyle,
                paths: [{ points }],
            };
        }
        case "fibSpeedResistanceFan":
            return {
                type,
                points: [p1, p2],
                style: primitiveStyle,
                segments: FIB_FAN_RATIOS.map((ratio) => {
                    const targetY = p1.y - (p1.y - p2.y) * ratio;
                    return {
                        start: p1,
                        end: { x: p2.x, y: targetY },
                        label: String(ratio),
                        labelPosition: { x: p2.x + 4, y: targetY },
                        opacity: ratio === 0.618 ? 1 : 0.7,
                    };
                }),
            };
        case "fibChannel": {
            const offsetY = p3 ? p3.y - p1.y : p2.y - p1.y;
            return {
                type,
                points: p3 ? [p1, p2, p3] : [p1, p2],
                style: primitiveStyle,
                segments: FIB_EXTENDED_LEVELS.slice(0, 7).map((level) => {
                    const lineY1 = p1.y + offsetY * level;
                    const lineY2 = p2.y + offsetY * level;
                    return {
                        start: { x: p1.x, y: lineY1 },
                        end: { x: p2.x, y: lineY2 },
                        label: String(level),
                        labelPosition: { x: p2.x + 4, y: lineY2 },
                        opacity: level === 0.618 ? 1 : 0.6,
                    };
                }),
            };
        }
        case "trendBasedFibTime": {
            const period = p2.x - p1.x;
            return {
                type,
                points: p3 ? [p1, p2, p3] : [p1, p2],
                style: primitiveStyle,
                segments: TREND_BASED_FIB_TIME_LEVELS.map((level) => {
                    const x = p1.x + period * level;
                    return {
                        start: { x, y: 0 },
                        end: { x, y: 2000 },
                        label: String(level),
                        labelPosition: { x: x + 3, y: p1.y - 8 },
                        opacity: 0.6,
                    };
                }),
            };
        }
        case "fibWedge": {
            const apex = p3 ?? p2;
            const retracementLevels = [0.382, 0.5, 0.618].map((level) => ({
                start: { x: p1.x + (p2.x - p1.x) * level, y: p1.y + (p2.y - p1.y) * level },
                end: apex,
                strokeDasharray: "dashed",
                opacity: 0.5,
            }));
            return {
                type,
                points: p3 ? [p1, p2, p3] : [p1, p2],
                style: primitiveStyle,
                segments: [
                    { start: p1, end: apex },
                    { start: p2, end: apex },
                    ...retracementLevels,
                ],
            };
        }
        case "pitchfan": {
            const fanSegments = FIB_FAN_RATIOS.map((ratio) => {
                const tx = p3 ? p2.x + (p3.x - p2.x) * ratio : p2.x;
                const ty = p3 ? p2.y + (p3.y - p2.y) * ratio : p2.y;
                const extX = p1.x + (tx - p1.x) * 3;
                const extY = p1.y + (ty - p1.y) * 3;
                return {
                    start: p1,
                    end: { x: extX, y: extY },
                    label: String(ratio),
                    labelPosition: { x: extX - 20, y: extY },
                    opacity: ratio === 0.5 ? 1 : 0.65,
                };
            });
            return {
                type,
                points: p3 ? [p1, p2, p3] : [p1, p2],
                style: primitiveStyle,
                segments: p3
                    ? [...fanSegments, { start: p2, end: p3, strokeDasharray: "dashed" }]
                    : fanSegments,
            };
        }
        default:
            return null;
    }
}
function buildChannelPrimitive(drawing, scales, primitiveStyle) {
    const [startPoint, endPoint, offsetPoint] = drawing.points;
    if (!startPoint || !endPoint || !offsetPoint) {
        return null;
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
    const segments = [];
    if (isSegmentVisible(drawing, "primary")) {
        segments.push(toPrimitiveSegment(drawing, "primary", start, end));
    }
    if (isSegmentVisible(drawing, "secondary")) {
        segments.push(toPrimitiveSegment(drawing, "secondary", offsetStart, offsetEnd));
    }
    const labels = [];
    if (drawing.showMeasurement) {
        const percent = startPoint.y === 0 ? 0 : ((endPoint.y - startPoint.y) / Math.abs(startPoint.y)) * 100;
        const priceDiff = endPoint.y - startPoint.y;
        const bars = Math.max(1, Math.round(Math.abs(end.x - start.x) / 6));
        labels.push({
            text: `Δ ${priceDiff >= 0 ? "+" : ""}${priceDiff.toFixed(2)} (${percent >= 0 ? "+" : ""}${percent.toFixed(2)}%) · ${bars} bars`,
            position: { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 - 10 },
            align: "center",
            baseline: "alphabetic",
            weight: 700,
            fontSize: drawing.style.fontSize ?? 11,
        });
    }
    return {
        type: "channel",
        points: [start, end, offsetAnchor],
        style: primitiveStyle,
        segments,
        labels,
    };
}
function buildParallelChannelPrimitive(drawing, scales, primitiveStyle, options) {
    const geometry = calculateParallelChannelGeometry(drawing, scales);
    if (!geometry || options?.chartWidth == null || options?.chartHeight == null) {
        return null;
    }
    const segments = [];
    const upper = clipSegmentToBox({ x: geometry.start.x + geometry.offsetVector.x, y: geometry.start.y + geometry.offsetVector.y }, { x: geometry.end.x + geometry.offsetVector.x, y: geometry.end.y + geometry.offsetVector.y }, options.chartWidth, options.chartHeight);
    const middle = clipSegmentToBox(geometry.start, geometry.end, options.chartWidth, options.chartHeight);
    const lower = clipSegmentToBox({ x: geometry.start.x - geometry.offsetVector.x, y: geometry.start.y - geometry.offsetVector.y }, { x: geometry.end.x - geometry.offsetVector.x, y: geometry.end.y - geometry.offsetVector.y }, options.chartWidth, options.chartHeight);
    if (upper && isSegmentVisible(drawing, "upper")) {
        segments.push(toPrimitiveSegment(drawing, "upper", upper[0], upper[1]));
    }
    if (middle && isSegmentVisible(drawing, "middle")) {
        segments.push(toPrimitiveSegment(drawing, "middle", middle[0], middle[1]));
    }
    if (lower && isSegmentVisible(drawing, "lower")) {
        segments.push(toPrimitiveSegment(drawing, "lower", lower[0], lower[1]));
    }
    return {
        type: "parallelChannel",
        points: [geometry.start, geometry.end, geometry.offsetAnchor],
        style: primitiveStyle,
        segments,
    };
}
function buildPitchforkPrimitive(drawing, scales, primitiveStyle, options) {
    const geometry = calculatePitchforkGeometry(drawing, scales);
    if (!geometry || options?.chartWidth == null || options?.chartHeight == null || (geometry.direction.x === 0 && geometry.direction.y === 0)) {
        return null;
    }
    const median = extendLineThroughBox(geometry.pivot, geometry.direction, options.chartWidth, options.chartHeight);
    const leftFork = extendLineThroughBox(geometry.leftSwing, geometry.direction, options.chartWidth, options.chartHeight);
    const rightFork = extendLineThroughBox(geometry.rightSwing, geometry.direction, options.chartWidth, options.chartHeight);
    if (!median || !leftFork || !rightFork) {
        return null;
    }
    const segments = [];
    if (isSegmentVisible(drawing, "median")) {
        segments.push(toPrimitiveSegment(drawing, "median", median[0], median[1]));
    }
    if (isSegmentVisible(drawing, "leftFork")) {
        segments.push(toPrimitiveSegment(drawing, "leftFork", leftFork[0], leftFork[1]));
    }
    if (isSegmentVisible(drawing, "rightFork")) {
        segments.push(toPrimitiveSegment(drawing, "rightFork", rightFork[0], rightFork[1]));
    }
    return {
        type: "pitchfork",
        points: [geometry.pivot, geometry.leftSwing, geometry.rightSwing],
        style: primitiveStyle,
        segments,
        labels: [
            { text: "A", position: { x: geometry.pivot.x + 6, y: geometry.pivot.y - 6 }, baseline: "alphabetic", weight: 700, fontSize: drawing.style.fontSize ?? 11 },
            { text: "B", position: { x: geometry.leftSwing.x + 6, y: geometry.leftSwing.y - 6 }, baseline: "alphabetic", weight: 700, fontSize: drawing.style.fontSize ?? 11 },
            { text: "C", position: { x: geometry.rightSwing.x + 6, y: geometry.rightSwing.y - 6 }, baseline: "alphabetic", weight: 700, fontSize: drawing.style.fontSize ?? 11 },
        ],
    };
}
function buildRegressionChannelPrimitive(drawing, scales, primitiveStyle, options) {
    const metrics = calculateRegressionChannelMetrics(drawing, scales, options?.plotData ?? []);
    if (!metrics) {
        return null;
    }
    const fill = drawing.style.fill && drawing.style.fill !== "transparent" ? drawing.style.fill : "rgba(100,149,237,0.08)";
    const fillAlpha = (drawing.style.fillOpacity ?? 1) * (drawing.style.opacity ?? 1);
    const segments = [];
    if (isSegmentVisible(drawing, "upper")) {
        segments.push(toPrimitiveSegment(drawing, "upper", { x: metrics.startX, y: metrics.upperStartY }, { x: metrics.endX, y: metrics.upperEndY }, { strokeDasharray: "dashed" }));
    }
    if (isSegmentVisible(drawing, "lower")) {
        segments.push(toPrimitiveSegment(drawing, "lower", { x: metrics.startX, y: metrics.lowerStartY }, { x: metrics.endX, y: metrics.lowerEndY }, { strokeDasharray: "dashed" }));
    }
    if (isSegmentVisible(drawing, "center")) {
        segments.push(toPrimitiveSegment(drawing, "center", { x: metrics.startX, y: metrics.startY }, { x: metrics.endX, y: metrics.endY }));
    }
    return {
        type: "regressionChannel",
        points: drawing.points.slice(0, 2).map((point) => toPixel(point, scales)),
        style: primitiveStyle,
        polygons: [{
                points: [
                    { x: metrics.startX, y: metrics.upperStartY },
                    { x: metrics.endX, y: metrics.upperEndY },
                    { x: metrics.endX, y: metrics.lowerEndY },
                    { x: metrics.startX, y: metrics.lowerStartY },
                ],
                fill,
                opacity: fillAlpha,
            }],
        segments,
        labels: [{
                text: `R² ${metrics.rSquared.toFixed(2)}`,
                position: { x: metrics.endX - 4, y: Math.min(metrics.upperEndY, metrics.lowerEndY, metrics.endY) - 6 },
                align: "right",
                baseline: "alphabetic",
                weight: 700,
                fontSize: drawing.style.fontSize ?? 11,
            }],
    };
}
function toOverlayPrimitiveRaw(drawing, scales, options) {
    const primitiveStyle = toPrimitiveStyle(drawing.style);
    switch (drawing.type) {
        case "trendLine":
        case "arrow":
        case "ray":
        case "extendedLine": {
            const [startPoint, endPoint] = drawing.points;
            if (!startPoint || !endPoint) {
                return null;
            }
            return {
                type: drawing.type,
                points: [toPixel(startPoint, scales), toPixel(endPoint, scales)],
                style: primitiveStyle,
            };
        }
        case "hLine": {
            const [point] = drawing.points;
            if (!point) {
                return null;
            }
            return {
                type: "hLine",
                points: [toPixel(point, scales)],
                style: primitiveStyle,
            };
        }
        case "vLine": {
            const [point] = drawing.points;
            if (!point) {
                return null;
            }
            return {
                type: "vLine",
                points: [toPixel(point, scales)],
                style: primitiveStyle,
            };
        }
        case "rectangle": {
            const [startPoint, endPoint] = drawing.points;
            if (!startPoint || !endPoint) {
                return null;
            }
            return {
                type: "rectangle",
                points: [toPixel(startPoint, scales), toPixel(endPoint, scales)],
                style: primitiveStyle,
            };
        }
        case "dateAndPriceRange": {
            const [startPoint, endPoint] = drawing.points;
            if (!startPoint || !endPoint) {
                return null;
            }
            return {
                type: "dateAndPriceRange",
                points: [toPixel(startPoint, scales), toPixel(endPoint, scales)],
                style: primitiveStyle,
                text: buildDateAndPriceRangeBadge(drawing, scales),
            };
        }
        case "fibonacci": {
            const [startPoint, endPoint] = drawing.points;
            if (!startPoint || !endPoint) {
                return null;
            }
            return {
                type: "fibonacci",
                points: [toPixel(startPoint, scales), toPixel(endPoint, scales)],
                style: primitiveStyle,
                levelLines: buildFibonacciLevelLines(drawing, scales, "retrace"),
            };
        }
        case "fibExtension": {
            const [startPoint, endPoint] = drawing.points;
            if (!startPoint || !endPoint) {
                return null;
            }
            return {
                type: "fibExtension",
                points: [toPixel(startPoint, scales), toPixel(endPoint, scales)],
                style: primitiveStyle,
                levelLines: buildFibonacciLevelLines(drawing, scales, "extension"),
            };
        }
        case "fibArc": {
            const geometry = calculateFibArcGeometry(drawing, scales);
            if (!geometry) {
                return null;
            }
            return {
                type: "fibArc",
                points: [geometry.center, geometry.reference],
                style: primitiveStyle,
                arcLevels: buildFibArcLevels(drawing, scales),
            };
        }
        case "fibTimeZone": {
            const geometry = calculateFibTimeZoneGeometry(drawing, scales);
            if (!geometry) {
                return null;
            }
            return {
                type: "fibTimeZone",
                points: [geometry.start, geometry.end],
                style: primitiveStyle,
                verticalMarkers: buildFibTimeZoneMarkers(drawing, scales),
            };
        }
        case "fibCircles":
        case "fibSpeedResistanceArcs":
        case "fibSpiral":
        case "fibSpeedResistanceFan":
        case "fibChannel":
        case "trendBasedFibTime":
        case "fibWedge":
        case "pitchfan":
            return buildFibExtendedPrimitive(drawing, scales, primitiveStyle);
        case "channel":
            return buildChannelPrimitive(drawing, scales, primitiveStyle);
        case "parallelChannel":
            return buildParallelChannelPrimitive(drawing, scales, primitiveStyle, options);
        case "pitchfork":
            return buildPitchforkPrimitive(drawing, scales, primitiveStyle, options);
        case "regressionChannel":
            return buildRegressionChannelPrimitive(drawing, scales, primitiveStyle, options);
        case "abcdPattern":
            return buildAbcdPatternPrimitive(drawing, scales, primitiveStyle);
        case "xabcdPattern":
        case "cypherPattern":
        case "headAndShoulders":
        case "trianglePattern":
        case "threeDrivesPattern":
            return buildHarmonicPatternPrimitive(drawing, scales, primitiveStyle, options);
        case "elliottImpulse":
        case "elliottCorrection":
        case "elliottTriangle":
        case "elliottDoubleCombo":
        case "elliottTripleCombo":
            return buildElliottWavePrimitive(drawing, scales, primitiveStyle, options);
        case "gannFan":
            return buildGannFanPrimitive(drawing, scales, primitiveStyle, options);
        case "gannBox":
        case "gannSquareFixed":
        case "gannSquare":
            return buildGannAdvancedPrimitive(drawing, scales, primitiveStyle);
        case "longPosition":
            return buildPositionPrimitive(drawing, scales, primitiveStyle, "long");
        case "shortPosition":
            return buildPositionPrimitive(drawing, scales, primitiveStyle, "short");
        case "cyclicLines":
        case "timeCycles":
        case "sineLine":
            return buildCyclePrimitive(drawing, scales, primitiveStyle);
        case "circle":
        case "ellipse": {
            const [startPoint, endPoint] = drawing.points;
            if (!startPoint || !endPoint) {
                return null;
            }
            return {
                type: drawing.type,
                points: [toPixel(startPoint, scales), toPixel(endPoint, scales)],
                style: primitiveStyle,
            };
        }
        case "triangle": {
            if (drawing.points.length < 3) {
                return null;
            }
            return {
                type: "triangle",
                points: drawing.points.slice(0, 3).map((point) => toPixel(point, scales)),
                style: primitiveStyle,
            };
        }
        case "callout": {
            const [boxAnchor, tailAnchor] = drawing.points;
            if (!boxAnchor || !tailAnchor) {
                return null;
            }
            return {
                type: "callout",
                points: [toPixel(boxAnchor, scales), toPixel(tailAnchor, scales)],
                style: primitiveStyle,
                text: drawing.text,
            };
        }
        case "priceLabel": {
            const [anchor] = drawing.points;
            if (!anchor) {
                return null;
            }
            return {
                type: "priceLabel",
                points: [toPixel(anchor, scales)],
                style: primitiveStyle,
                text: drawing.text,
            };
        }
        case "priceRange":
        case "dateRange":
        case "barsCount": {
            const [startPoint, endPoint] = drawing.points;
            if (!startPoint || !endPoint) {
                return null;
            }
            return {
                type: drawing.type,
                points: [toPixel(startPoint, scales), toPixel(endPoint, scales)],
                style: primitiveStyle,
                text: drawing.text,
            };
        }
        case "text": {
            const [point] = drawing.points;
            if (!point) {
                return null;
            }
            return {
                type: "text",
                points: [toPixel(point, scales)],
                style: primitiveStyle,
                text: drawing.text,
            };
        }
        case "polyline": {
            if (drawing.points.length < 2) {
                return null;
            }
            return {
                type: "polyline",
                points: drawing.points.map((point) => toPixel(point, scales)),
                style: primitiveStyle,
            };
        }
        default:
            return null;
    }
}
export function toOverlayPrimitive(drawing, scales, options) {
    const primitive = toOverlayPrimitiveRaw(drawing, scales, options);
    if (!primitive) {
        return null;
    }
    const enrichPoint = (point) => {
        if (typeof point.x === "number" && Number.isFinite(point.x) && point.xIndexFloat === undefined) {
            if (scales.xScaleInvertToIndex) {
                const idx = scales.xScaleInvertToIndex(point.x);
                if (idx !== null && Number.isFinite(idx)) {
                    point.xIndexFloat = idx;
                }
            }
        }
        if (typeof point.y === "number" && Number.isFinite(point.y) && point.yPrice === undefined) {
            const price = scales.yScaleInvert(point.y);
            if (price !== null && Number.isFinite(price)) {
                point.yPrice = price;
            }
        }
    };
    if (primitive.points) {
        primitive.points.forEach(enrichPoint);
    }
    if (primitive.segments) {
        primitive.segments.forEach((seg) => {
            if (seg.start)
                enrichPoint(seg.start);
            if (seg.end)
                enrichPoint(seg.end);
            if (seg.labelPosition)
                enrichPoint(seg.labelPosition);
        });
    }
    if (primitive.paths) {
        primitive.paths.forEach((path) => {
            if (path.points)
                path.points.forEach(enrichPoint);
        });
    }
    if (primitive.pointMarkers) {
        primitive.pointMarkers.forEach((pm) => {
            if (pm.point)
                enrichPoint(pm.point);
        });
    }
    if (primitive.labels) {
        primitive.labels.forEach((lbl) => {
            if (lbl.position)
                enrichPoint(lbl.position);
        });
    }
    if (primitive.polygons) {
        primitive.polygons.forEach((poly) => {
            if (poly.points)
                poly.points.forEach(enrichPoint);
        });
    }
    if (primitive.semanticBadges) {
        primitive.semanticBadges.forEach((badge) => {
            if (badge.position)
                enrichPoint(badge.position);
        });
    }
    if (primitive.levelLines) {
        primitive.levelLines.forEach((lvl) => {
            if (lvl.yPrice === undefined && typeof lvl.y === "number" && Number.isFinite(lvl.y)) {
                const price = scales.yScaleInvert(lvl.y);
                if (price !== null && Number.isFinite(price)) {
                    lvl.yPrice = price;
                }
            }
        });
    }
    if (primitive.verticalMarkers) {
        primitive.verticalMarkers.forEach((vm) => {
            if (vm.xIndexFloat === undefined && typeof vm.x === "number" && Number.isFinite(vm.x)) {
                if (scales.xScaleInvertToIndex) {
                    const idx = scales.xScaleInvertToIndex(vm.x);
                    if (idx !== null && Number.isFinite(idx)) {
                        vm.xIndexFloat = idx;
                    }
                }
            }
        });
    }
    if (primitive.arcLevels) {
        primitive.arcLevels.forEach((arc) => {
            if (arc.labelPosition) {
                enrichPoint(arc.labelPosition);
            }
        });
    }
    return primitive;
}
