import type { DrawingPluginDefinition, DrawingToolDefinition, DrawingToolType, Point } from "./types";
import { applyDrawingTemplate } from "./drawingStyleRegistry";

const drawingToolRegistry = new Map<DrawingToolType, DrawingToolDefinition>();

export function registerDrawingTool(tool: DrawingToolDefinition) {
	drawingToolRegistry.set(tool.name, tool);
	return tool;
}

export function createTool(name: DrawingToolType) {
	const tool = drawingToolRegistry.get(name);
	if (!tool) {
		throw new Error(`Missing drawing tool: ${name}`);
	}
	return tool;
}

export function listDrawingTools() {
	return [...drawingToolRegistry.values()];
}

export function isDrawingToolName(name: string): name is DrawingToolType {
	return drawingToolRegistry.has(name as DrawingToolType);
}

export function createDraftFromTool(name: DrawingToolType, startPoint: Point) {
	const draft = createTool(name).createDraft(startPoint);
	// DT-5: inject template style if saved for this tool type
	return { ...draft, style: applyDrawingTemplate(name, draft.style) };
}

// CE19-01: Plugin registry for custom drawing tools registered from outside the library
const _pluginTools = new Map<string, DrawingPluginDefinition>();

export function registerDrawingPlugin(definition: DrawingPluginDefinition): void {
	if (_pluginTools.has(definition.type)) {
		console.warn(`[DrawingRegistry] Overwriting existing plugin: ${definition.type}`);
	}
	_pluginTools.set(definition.type, definition);
}

export function getDrawingPlugin(type: string): DrawingPluginDefinition | undefined {
	return _pluginTools.get(type);
}

export function listDrawingPlugins(): readonly DrawingPluginDefinition[] {
	return [..._pluginTools.values()];
}