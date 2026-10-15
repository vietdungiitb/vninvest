import { describe, it, expect } from "vitest";
import {
  isMatchedOrder,
  filterMatchedOrders,
  MATCHED_ORDER_STATUS_LIST,
} from "../sourceBadge";

/**
 * mbw3 FE-STATUS — pin tập trạng thái khớp + chuẩn hóa (AC8 phía FE).
 *
 * Bối cảnh đã verify (read-only): BE pass-through status broker thô, không
 * enum chuẩn (`adapters.py:393,479,625` `_first(item,'status',...)`). FE giữ
 * tối thiểu {FILLED, MATCHED} + ghi rõ giới hạn ở UI. Mở rộng tập này khi và
 * chỉ khi BE công bố enum thật (ticket follow-up) — test này khóa để mọi lần
 * mở đều là diff có chủ ý, không im lặng.
 */
describe("matched order status (FE-STATUS, AC8)", () => {
  it("pin tập matched tối thiểu đã verify: FILLED + MATCHED", () => {
    expect([...MATCHED_ORDER_STATUS_LIST].sort()).toEqual(["FILLED", "MATCHED"]);
  });

  it("chuẩn hóa: trim + hoa/thường + null-safe", () => {
    expect(isMatchedOrder(" filled ")).toBe(true);
    expect(isMatchedOrder("matched")).toBe(true);
    expect(isMatchedOrder("Filled")).toBe(true);
    expect(isMatchedOrder(null)).toBe(false);
    expect(isMatchedOrder(undefined)).toBe(false);
    expect(isMatchedOrder("")).toBe(false);
  });

  it("status ngoài tập ⇒ không khớp (hiện ở Sổ lệnh với status thô, không rớt silently)", () => {
    expect(isMatchedOrder("PENDING")).toBe(false);
    expect(isMatchedOrder("CANCELLED")).toBe(false);
    const rows = [{ status: "FILLED" }, { status: "PENDING" }, { status: "MATCHED" }];
    expect(filterMatchedOrders(rows)).toHaveLength(2);
  });
});
