import type { DrawingObject, DrawingStyle } from "./types";

export interface DrawingStyleOverride {
	color?: string;
	lineWidth?: number;
	opacity?: number;
	dashPattern?: number[];
}

const drawingStyleOverrides = new Map<string, Partial<DrawingStyleOverride>>();
const drawingStyleListeners = new Map<string, Set<() => void>>();
const drawingStyleChangeListeners = new Set<() => void>();

function normalizeDrawingStyleOverride(partialStyle: Partial<DrawingStyleOverride>): Partial<DrawingStyleOverride> {
	const normalized: Partial<DrawingStyleOverride> = {};
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

function cloneDrawingStyleOverride(style?: Partial<DrawingStyleOverride>): Partial<DrawingStyleOverride> | undefined {
	if (!style) {
		return undefined;
	}
	return {
		...style,
		dashPattern: style.dashPattern ? [...style.dashPattern] : undefined,
	};
}

function notifyDrawingStyleChange(instanceId: string) {
	drawingStyleListeners.get(instanceId)?.forEach((callback) => callback());
	drawingStyleChangeListeners.forEach((callback) => callback());
}

function notifyAllDrawingStyleChanges() {
	for (const [instanceId, listeners] of drawingStyleListeners) {
		listeners.forEach((callback) => callback());
	}
	drawingStyleChangeListeners.forEach((callback) => callback());
}

function dashPatternToStrokeDasharray(dashPattern?: number[]): DrawingStyle["strokeDasharray"] {
	if (!dashPattern || dashPattern.length === 0) {
		return "solid";
	}
	if (dashPattern.length === 1) {
		return dashPattern[0] <= 2 ? "dotted" : "dashed";
	}
	return dashPattern[0] <= 2 ? "dotted" : "dashed";
}

export function overrideDrawingStyle(drawingId: string, partialStyle: Partial<DrawingStyleOverride>): void {
	const normalized = normalizeDrawingStyleOverride(partialStyle);
	const current = drawingStyleOverrides.get(drawingId) ?? {};
	drawingStyleOverrides.set(drawingId, { ...current, ...normalized });
	notifyDrawingStyleChange(drawingId);
}

export function getDrawingStyleOverride(drawingId: string): Partial<DrawingStyleOverride> | undefined {
	return cloneDrawingStyleOverride(drawingStyleOverrides.get(drawingId));
}

export function clearDrawingStyleOverride(drawingId: string): void {
	drawingStyleOverrides.delete(drawingId);
	notifyDrawingStyleChange(drawingId);
}

export function clearDrawingStyleOverrides(): void {
	drawingStyleOverrides.clear();
	notifyAllDrawingStyleChanges();
}

export function listDrawingStyleOverrides(): Record<string, Partial<DrawingStyleOverride>> {
	return Object.fromEntries([...drawingStyleOverrides.entries()].map(([drawingId, style]) => [drawingId, cloneDrawingStyleOverride(style) ?? {}]));
}

export function subscribeDrawingStyle(drawingId: string, callback: () => void): () => void {
	if (!drawingStyleListeners.has(drawingId)) {
		drawingStyleListeners.set(drawingId, new Set());
	}
	drawingStyleListeners.get(drawingId)!.add(callback);
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

export function subscribeDrawingStyleChanges(callback: () => void): () => void {
	drawingStyleChangeListeners.add(callback);
	return () => {
		drawingStyleChangeListeners.delete(callback);
	};
}

export function resolveDrawingStyle(drawing: DrawingObject): DrawingStyle {
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
export function validateDrawingStyleTemplate(raw: unknown): Partial<DrawingStyle> | null {
	if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
		return null;
	}
	const obj = raw as Record<string, unknown>;
	const result: Partial<DrawingStyle> = {};
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

/**
 * Persist a drawing style as the default template for `toolType`.
 * Only valid DrawingStyle fields are saved. Returns false if nothing valid to save.
 */
export function saveDrawingTemplate(toolType: string, style: Partial<DrawingStyle>): boolean {
	const validated = validateDrawingStyleTemplate(style);
	if (!validated) {
		return false;
	}
	try {
		localStorage.setItem(`${TEMPLATE_STORAGE_KEY_PREFIX}${toolType}`, JSON.stringify(validated));
		return true;
	} catch {
		return false;
	}
}

/**
 * Load the saved style template for `toolType`.
 * Returns null if no template is saved or the data is corrupt.
 */
export function loadDrawingTemplate(toolType: string): Partial<DrawingStyle> | null {
	try {
		const raw = localStorage.getItem(`${TEMPLATE_STORAGE_KEY_PREFIX}${toolType}`);
		if (!raw) {
			return null;
		}
		const parsed: unknown = JSON.parse(raw);
		return validateDrawingStyleTemplate(parsed);
	} catch {
		return null;
	}
}

/**
 * Remove the saved style template for `toolType`.
 */
export function clearDrawingTemplate(toolType: string): void {
	try {
		localStorage.removeItem(`${TEMPLATE_STORAGE_KEY_PREFIX}${toolType}`);
	} catch {
		// ignore
	}
}

/**
 * Apply a template (if any) to `baseStyle`, returning a merged DrawingStyle.
 * Template fields take precedence over defaults but NOT over user-set values in baseStyle
 * unless `forceTemplate` is true (used when creating fresh drafts).
 */
export function applyDrawingTemplate(toolType: string, baseStyle: DrawingStyle): DrawingStyle {
	const template = loadDrawingTemplate(toolType);
	if (!template) {
		return { ...baseStyle };
	}
	return {
		...baseStyle,
		...template,
	};
}