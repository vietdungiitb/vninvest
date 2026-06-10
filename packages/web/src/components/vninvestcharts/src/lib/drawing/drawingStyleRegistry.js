const drawingStyleOverrides = new Map();
const drawingStyleListeners = new Map();
const drawingStyleChangeListeners = new Set();
function normalizeDrawingStyleOverride(partialStyle) {
    const normalized = {};
    if (typeof partialStyle.color === "string" && partialStyle.color.length > 0) {
        normalized.color = partialStyle.color;
    }
    if (typeof partialStyle.lineWidth === "number" && Number.isFinite(partialStyle.lineWidth)) {
        normalized.lineWidth = partialStyle.lineWidth;
    }
    if (typeof partialStyle.opacity === "number" && Number.isFinite(partialStyle.opacity)) {
        normalized.opacity = Math.min(1, Math.max(0, partialStyle.opacity));
    }
    if (Array.isArray(partialStyle.dashPattern)) {
        const dashPattern = partialStyle.dashPattern.filter((value) => typeof value === "number" && Number.isFinite(value) && value > 0);
        if (dashPattern.length > 0) {
            normalized.dashPattern = dashPattern;
        }
    }
    return normalized;
}
function cloneDrawingStyleOverride(style) {
    if (!style) {
        return undefined;
    }
    return {
        ...style,
        dashPattern: style.dashPattern ? [...style.dashPattern] : undefined,
    };
}
function notifyDrawingStyleChange(instanceId) {
    drawingStyleListeners.get(instanceId)?.forEach((callback) => callback());
    drawingStyleChangeListeners.forEach((callback) => callback());
}
function notifyAllDrawingStyleChanges() {
    for (const [instanceId, listeners] of drawingStyleListeners) {
        listeners.forEach((callback) => callback());
    }
    drawingStyleChangeListeners.forEach((callback) => callback());
}
function dashPatternToStrokeDasharray(dashPattern) {
    if (!dashPattern || dashPattern.length === 0) {
        return "solid";
    }
    if (dashPattern.length === 1) {
        return dashPattern[0] <= 2 ? "dotted" : "dashed";
    }
    return dashPattern[0] <= 2 ? "dotted" : "dashed";
}
export function overrideDrawingStyle(drawingId, partialStyle) {
    const normalized = normalizeDrawingStyleOverride(partialStyle);
    const current = drawingStyleOverrides.get(drawingId) ?? {};
    drawingStyleOverrides.set(drawingId, { ...current, ...normalized });
    notifyDrawingStyleChange(drawingId);
}
export function getDrawingStyleOverride(drawingId) {
    return cloneDrawingStyleOverride(drawingStyleOverrides.get(drawingId));
}
export function clearDrawingStyleOverride(drawingId) {
    drawingStyleOverrides.delete(drawingId);
    notifyDrawingStyleChange(drawingId);
}
export function clearDrawingStyleOverrides() {
    drawingStyleOverrides.clear();
    notifyAllDrawingStyleChanges();
}
export function listDrawingStyleOverrides() {
    return Object.fromEntries([...drawingStyleOverrides.entries()].map(([drawingId, style]) => [drawingId, cloneDrawingStyleOverride(style) ?? {}]));
}
export function subscribeDrawingStyle(drawingId, callback) {
    if (!drawingStyleListeners.has(drawingId)) {
        drawingStyleListeners.set(drawingId, new Set());
    }
    drawingStyleListeners.get(drawingId).add(callback);
    return () => {
        const listeners = drawingStyleListeners.get(drawingId);
        if (!listeners) {
            return;
        }
        listeners.delete(callback);
        if (listeners.size === 0) {
            drawingStyleListeners.delete(drawingId);
        }
    };
}
export function subscribeDrawingStyleChanges(callback) {
    drawingStyleChangeListeners.add(callback);
    return () => {
        drawingStyleChangeListeners.delete(callback);
    };
}
export function resolveDrawingStyle(drawing) {
    const override = drawingStyleOverrides.get(drawing.id);
    if (!override) {
        return { ...drawing.style };
    }
    return {
        ...drawing.style,
        stroke: override.color ?? drawing.style.stroke,
        strokeWidth: override.lineWidth ?? drawing.style.strokeWidth,
        opacity: override.opacity ?? drawing.style.opacity,
        strokeDasharray: dashPatternToStrokeDasharray(override.dashPattern) ?? drawing.style.strokeDasharray,
    };
}
// ─── DT-5: Drawing Templates & Style Presets ─────────────────────────────────
//
// A "template" is a partial DrawingStyle saved per tool type in localStorage.
// When a new draft is created for that tool, the template style is injected.
// Security: all fields are validated before use; corrupted data is discarded.
const TEMPLATE_STORAGE_KEY_PREFIX = "rsc-drawing-template-";
/** Allowed CSS hex colour. Prevents XSS via style injection. */
const HEX_COLOR_RE = /^#[0-9a-fA-F]{3,8}$/;
/** Validate a raw object from localStorage against allowed DrawingStyle keys/types. */
export function validateDrawingStyleTemplate(raw) {
    if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
        return null;
    }
    const obj = raw;
    const result = {};
    let valid = false;
    if (typeof obj["stroke"] === "string" && HEX_COLOR_RE.test(obj["stroke"])) {
        result.stroke = obj["stroke"];
        valid = true;
    }
    if (typeof obj["strokeWidth"] === "number" && Number.isFinite(obj["strokeWidth"]) && obj["strokeWidth"] > 0 && obj["strokeWidth"] <= 20) {
        result.strokeWidth = obj["strokeWidth"];
        valid = true;
    }
    if (typeof obj["opacity"] === "number" && Number.isFinite(obj["opacity"]) && obj["opacity"] >= 0 && obj["opacity"] <= 1) {
        result.opacity = obj["opacity"];
        valid = true;
    }
    if (typeof obj["fill"] === "string" && HEX_COLOR_RE.test(obj["fill"])) {
        result.fill = obj["fill"];
        valid = true;
    }
    if (obj["strokeDasharray"] === "solid" || obj["strokeDasharray"] === "dashed" || obj["strokeDasharray"] === "dotted") {
        result.strokeDasharray = obj["strokeDasharray"];
        valid = true;
    }
    return valid ? result : null;
}
export function validateDrawingSegmentStylesTemplate(raw) {
    if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
        return undefined;
    }
    const result = {};
    for (const [key, value] of Object.entries(raw)) {
        const validated = validateDrawingStyleTemplate(value);
        if (validated) {
            result[key] = validated;
        }
    }
    return Object.keys(result).length > 0 ? result : undefined;
}
export function validateDrawingSegmentVisibleTemplate(raw) {
    if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
        return undefined;
    }
    const result = {};
    for (const [key, value] of Object.entries(raw)) {
        if (typeof value === "boolean") {
            result[key] = value;
        }
    }
    return Object.keys(result).length > 0 ? result : undefined;
}
function cloneDrawingSegmentStylesTemplate(segmentStyles) {
    if (!segmentStyles) {
        return undefined;
    }
    return Object.fromEntries(Object.entries(segmentStyles).map(([key, value]) => [key, { ...value }]));
}
function cloneDrawingSegmentVisibleTemplate(segmentVisible) {
    return segmentVisible ? { ...segmentVisible } : undefined;
}
function validateDrawingTemplateData(raw) {
    const directStyle = validateDrawingStyleTemplate(raw);
    if (directStyle) {
        return { style: directStyle };
    }
    if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
        return null;
    }
    const obj = raw;
    const style = validateDrawingStyleTemplate(obj["style"]);
    if (!style) {
        return null;
    }
    const segmentStyles = validateDrawingSegmentStylesTemplate(obj["segmentStyles"]);
    const segmentVisible = validateDrawingSegmentVisibleTemplate(obj["segmentVisible"]);
    return {
        style,
        ...(segmentStyles ? { segmentStyles } : {}),
        ...(segmentVisible ? { segmentVisible } : {}),
    };
}
export function cloneDrawingTemplateData(template) {
    return {
        style: { ...template.style },
        ...(template.segmentStyles ? { segmentStyles: cloneDrawingSegmentStylesTemplate(template.segmentStyles) } : {}),
        ...(template.segmentVisible ? { segmentVisible: cloneDrawingSegmentVisibleTemplate(template.segmentVisible) } : {}),
    };
}
function mergeDrawingSegmentStyles(base, patch) {
    if (!base && !patch) {
        return undefined;
    }
    const keys = new Set([...(base ? Object.keys(base) : []), ...(patch ? Object.keys(patch) : [])]);
    const merged = {};
    for (const key of keys) {
        merged[key] = {
            ...(base?.[key] ?? {}),
            ...(patch?.[key] ?? {}),
        };
    }
    return merged;
}
/**
 * Persist a drawing style as the default template for `toolType`.
 * Only valid DrawingStyle fields are saved. Returns false if nothing valid to save.
 */
export function saveDrawingTemplate(toolType, style, extras = {}) {
    const validated = validateDrawingStyleTemplate(style);
    if (!validated) {
        return false;
    }
    try {
        const segmentStyles = validateDrawingSegmentStylesTemplate(extras.segmentStyles);
        const segmentVisible = validateDrawingSegmentVisibleTemplate(extras.segmentVisible);
        const payload = {
            style: validated,
            ...(segmentStyles ? { segmentStyles } : {}),
            ...(segmentVisible ? { segmentVisible } : {}),
        };
        localStorage.setItem(`${TEMPLATE_STORAGE_KEY_PREFIX}${toolType}`, JSON.stringify(payload));
        return true;
    }
    catch {
        return false;
    }
}
export function loadDrawingTemplateData(toolType) {
    try {
        const raw = localStorage.getItem(`${TEMPLATE_STORAGE_KEY_PREFIX}${toolType}`);
        if (!raw) {
            return null;
        }
        const parsed = JSON.parse(raw);
        const validated = validateDrawingTemplateData(parsed);
        return validated ? cloneDrawingTemplateData(validated) : null;
    }
    catch {
        return null;
    }
}
/**
 * Load the saved style template for `toolType`.
 * Returns null if no template is saved or the data is corrupt.
 */
export function loadDrawingTemplate(toolType) {
    return loadDrawingTemplateData(toolType)?.style ?? null;
}
/**
 * Remove the saved style template for `toolType`.
 */
export function clearDrawingTemplate(toolType) {
    try {
        localStorage.removeItem(`${TEMPLATE_STORAGE_KEY_PREFIX}${toolType}`);
    }
    catch {
        // ignore
    }
}
/**
 * Apply a template (if any) to `baseStyle`, returning a merged DrawingStyle.
 * Template fields take precedence over defaults but NOT over user-set values in baseStyle
 * unless `forceTemplate` is true (used when creating fresh drafts).
 */
export function applyDrawingTemplate(toolType, baseStyle) {
    const template = loadDrawingTemplateData(toolType)?.style;
    if (!template) {
        return { ...baseStyle };
    }
    return {
        ...baseStyle,
        ...template,
    };
}
export function applyDrawingTemplateToDrawing(toolType, drawing) {
    const template = loadDrawingTemplateData(toolType);
    if (!template) {
        return {
            ...drawing,
            style: { ...drawing.style },
            ...(drawing.segmentStyles ? { segmentStyles: mergeDrawingSegmentStyles(undefined, drawing.segmentStyles) } : {}),
            ...(drawing.segmentVisible ? { segmentVisible: { ...drawing.segmentVisible } } : {}),
        };
    }
    return {
        ...drawing,
        style: {
            ...drawing.style,
            ...template.style,
        },
        ...(mergeDrawingSegmentStyles(drawing.segmentStyles, template.segmentStyles)
            ? { segmentStyles: mergeDrawingSegmentStyles(drawing.segmentStyles, template.segmentStyles) }
            : {}),
        ...(drawing.segmentVisible || template.segmentVisible
            ? { segmentVisible: { ...(drawing.segmentVisible ?? {}), ...(template.segmentVisible ?? {}) } }
            : {}),
    };
}
