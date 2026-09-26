import { describe, it, expect } from "vitest";
import {
  normalizeAdvisoryItem,
  normalizeAdvisorySide,
} from "@/hooks/useWhaleAdvisoryData.js";

/**
 * R6.3 — bảng case PARITY với test BE `tests/test_advisory_signal_norm.py`.
 *
 * Mục tiêu: FE và BE phải cùng quyết định một khuyến nghị là BUY/SELL/HOLD/
 * UNKNOWN. Nếu lệch, FE hiển thị `UNKNOWN` (chặn đặt lệnh) trong khi BE đã
 * ghi SELL, hoặc tệ hơn — cả hai cùng sai theo hai hướng khác nhau.
 *
 * Bảng case ở đây PHẢI giống `SignalNormRegressionTests.REGRESSION_CASES` ở BE.
 * Đổi một bên mà không đổi bên kia sẽ làm test này đỏ.
 */
const REGRESSION_CASES = [
  ['BÁN', 'SELL'],
  ['BÁN LỤC', 'SELL'],
  ['GIỮ', 'HOLD'],
  ['BÁN (giảm tỷ trọng)', 'SELL'],
  ['KHÔNG MUA', 'UNKNOWN'],
  ['BUY', 'BUY'],
  ['SELL', 'SELL'],
  ['MUA', 'BUY'],
  ['BAN', 'SELL'],
  ['MUA LÚC', 'BUY'],
  ['HOLD', 'HOLD'],
  ['THEO DÕI', 'HOLD'],
  ['NÊN MUA', 'BUY'],
  ['recommendation mua nhẹ 5%', 'BUY'],
];

const EDGE_CASES = [
  ['', 'UNKNOWN'],
  [null, 'UNKNOWN'],
  ['   ', 'UNKNOWN'],
  ['BUY MUA BÁN HOLD WATCH', 'UNKNOWN'],
  ['MUA/BÁN', 'UNKNOWN'],
  ['5.0%', 'UNKNOWN'],
  ['MUA VÀ BÁN', 'UNKNOWN'],
  ['KHÔNG NÊN MUA', 'UNKNOWN'],
  ['DỪNG MUA', 'UNKNOWN'],
];

describe("normalizeAdvisorySide — parity với BE signal_norm", () => {
  it("14 case bằng chứng", () => {
    for (const [raw, expected] of REGRESSION_CASES) {
      expect(normalizeAdvisorySide(raw), `case: ${raw}`).toBe(expected);
    }
  });

  it("case biên", () => {
    for (const [raw, expected] of EDGE_CASES) {
      expect(normalizeAdvisorySide(raw), `case: ${raw}`).toBe(expected);
    }
  });

  it("không bao giờ biến UNKNOWN thành BUY", () => {
    for (const raw of [...REGRESSION_CASES, ...EDGE_CASES].map(([value]) => value)) {
      const side = normalizeAdvisorySide(raw);
      if (side === "UNKNOWN") {
        expect(normalizeAdvisorySide(raw)).not.toBe("BUY");
      }
    }
  });
});

describe("normalizeAdvisoryItem — contract R0.4", () => {
  const payload = {
    advisory_id: "a1",
    symbol: "FPT",
    side: "SELL",
    signal: "SELL",
    confidence_score: 0.82,
    summary: "Giảm tỷ trọng",
    rationale: "Dòng tiền thoát mạnh.",
    ai_provider: "openai",
    ai_model: "gpt-4o-mini",
    risk_level: "high",
    target_price: 15300,
    matched_value: 14500,
    whale_intensity: 72,
    status: "generated",
    created_at: "2026-09-25T10:00:00Z",
    error_code: null,
    user_message: null,
  };

  it("đọc side từ field `signal` của contract mới", () => {
    expect(normalizeAdvisoryItem(payload).side).toBe("SELL");
  });

  it("chấp nhận `side` khi BE không có `signal`", () => {
    const { signal, ...withoutSignal } = payload;
    expect(normalizeAdvisoryItem(withoutSignal).side).toBe("SELL");
  });

  it("confidence 0-1 chuyển sang 0-100", () => {
    expect(normalizeAdvisoryItem(payload).confidence).toBe(82);
  });

  it("confidence thiếu -> null, không bịa 0", () => {
    const { confidence_score, ...withoutConfidence } = payload;
    expect(normalizeAdvisoryItem(withoutConfidence).confidence).toBeNull();
  });

  it("matched_value thiếu -> null, không bịa 0", () => {
    const { matched_value, ...withoutValue } = payload;
    expect(normalizeAdvisoryItem(withoutValue).matched_value).toBeNull();
  });

  it("whale_intensity thiếu -> null, không bịa 0", () => {
    const { whale_intensity, ...withoutIntensity } = payload;
    expect(normalizeAdvisoryItem(withoutIntensity).whale_intensity).toBeNull();
  });

  it("mang theo error_code + user_message khi task fail-closed", () => {
    const failed = normalizeAdvisoryItem({
      ...payload,
      signal: "UNKNOWN",
      side: "UNKNOWN",
      error_code: "advisory_signal_unparseable",
      user_message: "Không đọc được khuyến nghị từ AI cho mã này. Thử làm mới lại.",
    });
    expect(failed.side).toBe("UNKNOWN");
    expect(failed.error_code).toBe("advisory_signal_unparseable");
    expect(failed.user_message).toContain("Thử làm mới");
  });

  it("recommendation tiếng Việt vẫn ra signal dùng được", () => {
    const item = normalizeAdvisoryItem({
      advisory_id: "a2",
      symbol: "VIC",
      signal: "UNKNOWN",
      structured_output: { recommendation: "BÁN LỤC" },
    });
    expect(item.side).toBe("SELL");
  });

  it("null an toàn", () => {
    expect(normalizeAdvisoryItem(null)).toBeNull();
    expect(normalizeAdvisoryItem(undefined)).toBeNull();
  });
});
