export function resolveDrawingGroupMemberIds(drawings, groupId) {
    return drawings.filter((drawing) => drawing.groupId === groupId).map((drawing) => drawing.id);
}
export function deleteDrawingGroup(drawings, groupId) {
    return drawings.filter((drawing) => drawing.groupId !== groupId);
}
