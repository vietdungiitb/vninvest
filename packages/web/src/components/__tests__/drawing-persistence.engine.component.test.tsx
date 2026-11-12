/**
 * W-I (Wave 1) — characterization test cho drawing persistence của widget.
 *
 * B3 (2026-11-12) đã chứng minh: persistence KHÔNG cần prop nào từ host —
 * widget tự bật storage khi instance chạy UNCONTROLLED (không truyền
 * `drawings`), adapter mặc định ghi key `rsc-drawings-v1-<symbol>-<timeframe>`
 * (engine-drawing `drawingsKey` + `DRAWINGS_KEY_PREFIX`).
 *
 * Test này khoá lại đúng hành vi đó: chạy chính hook widget dùng
 * (`useDrawingWorkspaceController`), lưu 1 drawing, remount (mô phỏng reload)
 * và kiểm tra drawing được nạp lại. KHÔNG sửa package widget (repo khác) —
 * chỉ verify hành vi từ phía app + khoá key để phát hiện đổi prefix ngoài ý muốn.
 *
 * ⚠ `packages/web/tsconfig.json` exclude mọi file `src` có đuôi `.test.` ⇒ file
 * này KHÔNG được `npm run build` type-check. Phải tsc riêng (xem JOURNAL W-I).
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { act, cleanup, render } from "@testing-library/react";
import { useEffect } from "react";
import { useDrawingWorkspaceController } from "@vninvestcharts/engine-react";
import { createDrawingObject } from "@vninvestcharts/engine-drawing";
import type { DrawingObject } from "@vninvestcharts/engine-drawing";
import type { DrawingWorkspaceController } from "@vninvestcharts/engine-react";

const SYMBOL = "VIC";
const TIMEFRAME = "1d";
// Key mặc định của engine-drawing: `${DRAWINGS_KEY_PREFIX}-${symbol}-${timeframe}`.
const STORAGE_KEY = `rsc-drawings-v1-${SYMBOL}-${TIMEFRAME}`;

function makeDrawing(id: string): DrawingObject {
  return createDrawingObject(
    "trendLine",
    [
      { x: 1, y: 2 },
      { x: 3, y: 4 },
    ],
    { id, symbol: SYMBOL, timeframe: TIMEFRAME },
  );
}

function Harness({ capture }: { capture: (controller: DrawingWorkspaceController) => void }) {
  const controller = useDrawingWorkspaceController({ symbol: SYMBOL, timeframe: TIMEFRAME });
  useEffect(() => {
    capture(controller);
  }, [controller, capture]);
  return null;
}

describe("W-I — drawing persistence (adapter mặc định của widget)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  it("P1 — lưu theo symbol|timeframe rồi nạp lại sau khi remount", async () => {
    // Holder object (không phải `let` + narrow): TS không narrow biến được gán
    // trong callback nên `x?.state` bị suy ra thành `never`.
    const first: { current: DrawingWorkspaceController | null } = { current: null };
    const view = render(<Harness capture={(c) => { first.current = c; }} />);

    await act(async () => {
      first.current?.interaction.replaceDrawings([makeDrawing("d-wi-1")]);
    });
    // useDrawingStorage debounce 300ms rồi mới ghi ra storage — poll thay vì
    // sleep cố định để không phụ thuộc timing máy (margin 100ms dễ flaky).
    await act(async () => {
      for (let i = 0; i < 40 && !localStorage.getItem(STORAGE_KEY); i += 1) {
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
    });
    view.unmount();

    const raw = localStorage.getItem(STORAGE_KEY);
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw as string);
    expect(Array.isArray(parsed.drawings)).toBe(true);
    expect(parsed.drawings).toHaveLength(1);
    expect(parsed.drawings[0].id).toBe("d-wi-1");

    // Remount = mô phỏng reload trang: drawing phải được nạp lại từ storage.
    const reloaded: { current: DrawingWorkspaceController | null } = { current: null };
    render(<Harness capture={(c) => { reloaded.current = c; }} />);
    await act(async () => {});

    expect(reloaded.current).not.toBeNull();
    expect(reloaded.current?.state.drawings).toHaveLength(1);
    expect(reloaded.current?.state.drawings[0].id).toBe("d-wi-1");
  });
});
