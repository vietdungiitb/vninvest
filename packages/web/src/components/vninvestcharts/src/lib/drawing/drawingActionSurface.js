export function createDrawingContextMenuItems(drawing, hasClipboard, labels, callbacks) {
    const items = [
        { key: "copy", label: labels.copy, onSelect: callbacks.copySelectedDrawing },
        { key: "paste", label: labels.paste, onSelect: callbacks.pasteCopiedDrawing, disabled: !hasClipboard },
        { key: "front", label: labels.bringToFront, onSelect: callbacks.bringSelectedToFront },
        { key: "back", label: labels.sendToBack, onSelect: callbacks.sendSelectedToBack },
    ];
    if (drawing.groupId) {
        items.push({
            key: "selectGroup",
            label: labels.selectGroup,
            onSelect: () => callbacks.selectGroup?.(drawing.groupId),
        }, {
            key: "deleteGroup",
            label: labels.deleteGroup,
            onSelect: () => callbacks.deleteGroup?.(drawing.groupId),
            danger: true,
        });
    }
    return items;
}
