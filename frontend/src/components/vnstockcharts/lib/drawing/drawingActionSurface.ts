import type { DrawingContextMenuItem } from "./contextMenu";
import type { DrawingObject } from "./types";

export interface DrawingActionSurfaceLabels {
	copy: string;
	paste: string;
	bringToFront: string;
	sendToBack: string;
	selectGroup: string;
	deleteGroup: string;
}

export interface DrawingActionSurfaceCallbacks {
	copySelectedDrawing: () => void;
	pasteCopiedDrawing: () => void;
	bringSelectedToFront: () => void;
	sendSelectedToBack: () => void;
	selectGroup?: (groupId: string) => void;
	deleteGroup?: (groupId: string) => void;
}

export function createDrawingContextMenuItems(
	drawing: DrawingObject,
	hasClipboard: boolean,
	labels: DrawingActionSurfaceLabels,
	callbacks: DrawingActionSurfaceCallbacks,
): readonly DrawingContextMenuItem[] {
	const items: DrawingContextMenuItem[] = [
		{ key: "copy", label: labels.copy, onSelect: callbacks.copySelectedDrawing },
		{ key: "paste", label: labels.paste, onSelect: callbacks.pasteCopiedDrawing, disabled: !hasClipboard },
		{ key: "front", label: labels.bringToFront, onSelect: callbacks.bringSelectedToFront },
		{ key: "back", label: labels.sendToBack, onSelect: callbacks.sendSelectedToBack },
	];

	if (drawing.groupId) {
		items.push(
			{
				key: "selectGroup",
				label: labels.selectGroup,
				onSelect: () => callbacks.selectGroup?.(drawing.groupId!),
			},
			{
				key: "deleteGroup",
				label: labels.deleteGroup,
				onSelect: () => callbacks.deleteGroup?.(drawing.groupId!),
				danger: true,
			},
		);
	}

	return items;
}
