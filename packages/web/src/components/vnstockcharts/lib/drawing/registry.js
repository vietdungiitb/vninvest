import { applyDrawingTemplate } from "./drawingStyleRegistry.js";
const drawingToolRegistry = new Map();
export function registerDrawingTool(tool) {
    drawingToolRegistry.set(tool.name, tool);
    return tool;
}
export function createTool(name) {
    const tool = drawingToolRegistry.get(name);
    if (!tool) {
        throw new Error(`Missing drawing tool: ${name}`);
    }
    return tool;
}
export function listDrawingTools() {
    return [...drawingToolRegistry.values()];
}
export function isDrawingToolName(name) {
    return drawingToolRegistry.has(name);
}
export function createDraftFromTool(name, startPoint) {
    const draft = createTool(name).createDraft(startPoint);
    // DT-5: inject template style if saved for this tool type
    return { ...draft, style: applyDrawingTemplate(name, draft.style) };
}
// CE19-01: Plugin registry for custom drawing tools registered from outside the library
const _pluginTools = new Map();
export function registerDrawingPlugin(definition) {
    if (_pluginTools.has(definition.type)) {
        console.warn(`[DrawingRegistry] Overwriting existing plugin: ${definition.type}`);
    }
    _pluginTools.set(definition.type, definition);
}
export function getDrawingPlugin(type) {
    return _pluginTools.get(type);
}
export function listDrawingPlugins() {
    return [..._pluginTools.values()];
}
