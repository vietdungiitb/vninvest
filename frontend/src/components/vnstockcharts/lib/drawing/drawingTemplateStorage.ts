import { DrawingStyle, DrawingToolType } from "./types";
import { validateDrawingStyleTemplate } from "./drawingStyleRegistry";

// localStorage keys:
// rsc-drawing-template-index-${toolType}  →  JSON string[] (list of template names)
// rsc-drawing-template-${toolType}-${templateName}  →  JSON Partial<DrawingStyle>

export function listTemplates(toolType: DrawingToolType): string[] {
	if (typeof localStorage === "undefined") return [];
	try {
		const raw = localStorage.getItem(`rsc-drawing-template-index-${toolType}`);
		if (!raw) return [];
		return JSON.parse(raw) as string[];
	} catch {
		return [];
	}
}

export function saveTemplate(toolType: DrawingToolType, name: string, style: Partial<DrawingStyle>): void {
	if (typeof localStorage === "undefined") return;
	const validated = validateDrawingStyleTemplate(style);
	if (!validated) return;
	try {
		// Update index
		const list = listTemplates(toolType);
		if (!list.includes(name)) {
			list.push(name);
			localStorage.setItem(`rsc-drawing-template-index-${toolType}`, JSON.stringify(list));
		}
		// Save template style
		localStorage.setItem(`rsc-drawing-template-${toolType}-${name}`, JSON.stringify(validated));
	} catch (error) {
		console.error("Failed to save template", error);
	}
}

export function deleteTemplate(toolType: DrawingToolType, name: string): void {
	if (typeof localStorage === "undefined") return;
	try {
		const list = listTemplates(toolType);
		const filtered = list.filter(item => item !== name);
		localStorage.setItem(`rsc-drawing-template-index-${toolType}`, JSON.stringify(filtered));
		localStorage.removeItem(`rsc-drawing-template-${toolType}-${name}`);
	} catch (error) {
		console.error("Failed to delete template", error);
	}
}

export function loadTemplate(toolType: DrawingToolType, name: string): Partial<DrawingStyle> | null {
	if (typeof localStorage === "undefined") return null;
	try {
		const raw = localStorage.getItem(`rsc-drawing-template-${toolType}-${name}`);
		if (!raw) return null;
		const parsed = JSON.parse(raw);
		return validateDrawingStyleTemplate(parsed);
	} catch {
		return null;
	}
}

export function exportAllTemplates(): Record<string, Partial<DrawingStyle>> {
	if (typeof localStorage === "undefined") return {};
	const all: Record<string, Partial<DrawingStyle>> = {};
	try {
		for (let i = 0; i < localStorage.length; i++) {
			const key = localStorage.key(i);
			if (key && key.startsWith("rsc-drawing-template-") && !key.startsWith("rsc-drawing-template-index-")) {
				const raw = localStorage.getItem(key);
				if (raw) {
					const parsed = JSON.parse(raw);
					const validated = validateDrawingStyleTemplate(parsed);
					if (validated) {
						all[key] = validated;
					}
				}
			}
		}
	} catch (error) {
		console.error("Failed to export templates", error);
	}
	return all;
}

export function importAllTemplates(data: Record<string, Partial<DrawingStyle>>): void {
	if (typeof localStorage === "undefined") return;
	try {
		const indices: Record<string, string[]> = {};
		for (const [key, value] of Object.entries(data)) {
			if (key.startsWith("rsc-drawing-template-") && !key.startsWith("rsc-drawing-template-index-")) {
				const validated = validateDrawingStyleTemplate(value);
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
							indices[toolType] = listTemplates(toolType as DrawingToolType);
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
	} catch (error) {
		console.error("Failed to import templates", error);
	}
}
