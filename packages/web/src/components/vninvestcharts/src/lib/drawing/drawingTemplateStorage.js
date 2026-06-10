import { cloneDrawingTemplateData, validateDrawingStyleTemplate, validateDrawingSegmentStylesTemplate, validateDrawingSegmentVisibleTemplate, } from "./drawingStyleRegistry.js";
// localStorage keys:
// rsc-drawing-template-index-${toolType}  →  JSON string[] (list of template names)
// rsc-drawing-template-${toolType}-${templateName}  →  JSON DrawingTemplateData | Partial<DrawingStyle>
function validateNamedTemplateData(raw) {
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
export function listTemplates(toolType) {
    if (typeof localStorage === "undefined")
        return [];
    try {
        const raw = localStorage.getItem(`rsc-drawing-template-index-${toolType}`);
        if (!raw)
            return [];
        return JSON.parse(raw);
    }
    catch {
        return [];
    }
}
export function saveTemplate(toolType, name, style, extras = {}) {
    if (typeof localStorage === "undefined")
        return;
    const validated = validateDrawingStyleTemplate(style);
    if (!validated)
        return;
    try {
        const segmentStyles = validateDrawingSegmentStylesTemplate(extras.segmentStyles);
        const segmentVisible = validateDrawingSegmentVisibleTemplate(extras.segmentVisible);
        const payload = {
            style: validated,
            ...(segmentStyles ? { segmentStyles } : {}),
            ...(segmentVisible ? { segmentVisible } : {}),
        };
        // Update index
        const list = listTemplates(toolType);
        if (!list.includes(name)) {
            list.push(name);
            localStorage.setItem(`rsc-drawing-template-index-${toolType}`, JSON.stringify(list));
        }
        // Save template style
        localStorage.setItem(`rsc-drawing-template-${toolType}-${name}`, JSON.stringify(payload));
    }
    catch (error) {
        console.error("Failed to save template", error);
    }
}
export function deleteTemplate(toolType, name) {
    if (typeof localStorage === "undefined")
        return;
    try {
        const list = listTemplates(toolType);
        const filtered = list.filter(item => item !== name);
        localStorage.setItem(`rsc-drawing-template-index-${toolType}`, JSON.stringify(filtered));
        localStorage.removeItem(`rsc-drawing-template-${toolType}-${name}`);
    }
    catch (error) {
        console.error("Failed to delete template", error);
    }
}
export function loadTemplate(toolType, name) {
    return loadTemplateData(toolType, name)?.style ?? null;
}
export function loadTemplateData(toolType, name) {
    if (typeof localStorage === "undefined")
        return null;
    try {
        const raw = localStorage.getItem(`rsc-drawing-template-${toolType}-${name}`);
        if (!raw)
            return null;
        const parsed = JSON.parse(raw);
        const validated = validateNamedTemplateData(parsed);
        return validated ? cloneDrawingTemplateData(validated) : null;
    }
    catch {
        return null;
    }
}
export function exportAllTemplates() {
    if (typeof localStorage === "undefined")
        return {};
    const all = {};
    try {
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith("rsc-drawing-template-") && !key.startsWith("rsc-drawing-template-index-")) {
                const raw = localStorage.getItem(key);
                if (raw) {
                    const parsed = JSON.parse(raw);
                    const validated = validateNamedTemplateData(parsed);
                    if (validated) {
                        all[key] = cloneDrawingTemplateData(validated).style;
                    }
                }
            }
        }
    }
    catch (error) {
        console.error("Failed to export templates", error);
    }
    return all;
}
export function importAllTemplates(data) {
    if (typeof localStorage === "undefined")
        return;
    try {
        const indices = {};
        for (const [key, value] of Object.entries(data)) {
            if (key.startsWith("rsc-drawing-template-") && !key.startsWith("rsc-drawing-template-index-")) {
                const validated = validateNamedTemplateData(value);
                if (validated) {
                    // Save item
                    localStorage.setItem(key, JSON.stringify(validated));
                    // Extract toolType and templateName
                    // Format is "rsc-drawing-template-${toolType}-${templateName}"
                    const parts = key.replace("rsc-drawing-template-", "").split("-");
                    if (parts.length >= 2) {
                        const toolType = parts[0];
                        const templateName = parts.slice(1).join("-");
                        if (!indices[toolType]) {
                            indices[toolType] = listTemplates(toolType);
                        }
                        if (!indices[toolType].includes(templateName)) {
                            indices[toolType].push(templateName);
                        }
                    }
                }
            }
        }
        // Save all indices
        for (const [toolType, list] of Object.entries(indices)) {
            localStorage.setItem(`rsc-drawing-template-index-${toolType}`, JSON.stringify(list));
        }
    }
    catch (error) {
        console.error("Failed to import templates", error);
    }
}
