import { describe, expect, it } from "vitest";
import { HIT_TOLERANCE, ACTION_HANDLE_RADIUS } from "./hitTest";
import type { PointerDeviceType } from "./hitTest";

// DT-9: pointer device type utility — pure extraction logic
function resolvePointerDeviceType(event: Partial<PointerEvent> & { touches?: { length: number } }): PointerDeviceType {
	const pt = event.pointerType as string | undefined;
	if (pt === "touch") return "touch";
	if (pt === "pen") return "pen";
	return "mouse";
}

function hasPinchGesture(event: { touches?: { length: number } }): boolean {
	return (event.touches?.length ?? 0) > 1;
}

describe("DT-9 – Touch & Stylus Support", () => {
	describe("DT9-T01: HIT_TOLERANCE per device type", () => {
		it("DT9-T01-01: mouse tolerance is smaller than touch", () => {
			expect(HIT_TOLERANCE["mouse"]).toBeLessThan(HIT_TOLERANCE["touch"]);
		});

		it("DT9-T01-02: touch tolerance is 16px", () => {
			expect(HIT_TOLERANCE["touch"]).toBe(16);
		});

		it("DT9-T01-03: pen tolerance is 8px", () => {
			expect(HIT_TOLERANCE["pen"]).toBe(8);
		});

		it("DT9-T01-04: mouse tolerance is 6px", () => {
			expect(HIT_TOLERANCE["mouse"]).toBe(6);
		});
	});

	describe("DT9-T02: ACTION_HANDLE_RADIUS per device type", () => {
		it("DT9-T02-01: touch handle radius is larger than mouse", () => {
			expect(ACTION_HANDLE_RADIUS["touch"]).toBeGreaterThan(ACTION_HANDLE_RADIUS["mouse"]);
		});

		it("DT9-T02-02: touch handle radius is 12px", () => {
			expect(ACTION_HANDLE_RADIUS["touch"]).toBe(12);
		});
	});

	describe("DT9-T03: resolvePointerDeviceType()", () => {
		it("DT9-T03-01: pointerType touch → touch", () => {
			expect(resolvePointerDeviceType({ pointerType: "touch" })).toBe("touch");
		});

		it("DT9-T03-02: pointerType pen → pen", () => {
			expect(resolvePointerDeviceType({ pointerType: "pen" })).toBe("pen");
		});

		it("DT9-T03-03: pointerType mouse → mouse", () => {
			expect(resolvePointerDeviceType({ pointerType: "mouse" })).toBe("mouse");
		});

		it("DT9-T03-04: undefined pointerType → mouse (fallback)", () => {
			expect(resolvePointerDeviceType({})).toBe("mouse");
		});

		it("DT9-T03-05: unknown pointerType → mouse (fallback)", () => {
			expect(resolvePointerDeviceType({ pointerType: "stylus-unknown" as any })).toBe("mouse");
		});
	});

	describe("DT9-T04: pinch guard (multi-touch detection)", () => {
		it("DT9-T04-01: single touch is not pinch", () => {
			expect(hasPinchGesture({ touches: { length: 1 } })).toBe(false);
		});

		it("DT9-T04-02: two touches = pinch", () => {
			expect(hasPinchGesture({ touches: { length: 2 } })).toBe(true);
		});

		it("DT9-T04-03: no touches property = no pinch", () => {
			expect(hasPinchGesture({})).toBe(false);
		});

		it("DT9-T04-04: three touches = pinch", () => {
			expect(hasPinchGesture({ touches: { length: 3 } })).toBe(true);
		});
	});
});
