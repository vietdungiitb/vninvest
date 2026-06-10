import { describe, expect, it } from "vitest";
import { deleteDrawingGroup, resolveDrawingGroupMemberIds } from "./canvasGroupOps";
describe("canvasGroupOps", () => {
    it("resolves all drawing ids for a group", () => {
        const drawings = [
            { id: "a", groupId: "g1" },
            { id: "b", groupId: "g1" },
            { id: "c", groupId: "g2" },
        ];
        expect(resolveDrawingGroupMemberIds(drawings, "g1")).toEqual(["a", "b"]);
    });
    it("deletes only drawings that match the requested group", () => {
        const drawings = [
            { id: "a", groupId: "g1" },
            { id: "b", groupId: "g1" },
            { id: "c", groupId: "g2" },
        ];
        expect(deleteDrawingGroup(drawings, "g1")).toEqual([{ id: "c", groupId: "g2" }]);
    });
});
