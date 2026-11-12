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
    let controller: DrawingWorkspaceController | null = null;
    const first = render(<Harness capture={(c) => { controller = c; }} />);

    await act(async () => {
      controller?.interaction.replaceDrawings([makeDrawing("d-wi-1")]);
    });
    // useDrawingStorage debounce 300ms roi moi ghi ra storage.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 400));
    });
    first.unmount();

    const raw = localStorage.getItem(STORAGE_KEY);
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw as string);
    expect(Array.isArray(parsed.drawings)).toBe(true);
    expect(parsed.drawings).toHaveLength(1);
    expect(parsed.drawings[0].id).toBe("d-wi-1");

    // Remount = mô phỏng reload trang: drawing phải được nạp lại từ storage.
    let reloaded: DrawingWorkspaceController | null = null;
    render(<Harness capture={(c) => { reloaded = c; }} />);
    await act(async () => {});

    expect(reloaded?.state.drawings).toHaveLength(1);
    expect(reloaded?.state.drawings[0].id).toBe("d-wi-1");
  });
});
