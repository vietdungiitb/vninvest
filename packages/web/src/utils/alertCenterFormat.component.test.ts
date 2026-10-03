import { describe, it, expect } from "vitest";
import {
  formatVnd,
  formatVndCompact,
  formatTimeICT,
  formatDateICT,
  formatDateTimeICT,
  formatSessionDate,
  formatAgo,
  normalizeAlertText,
  isDuplicateSummary,
} from "./alertCenterFormat.js";

describe("alertCenterFormat (Slice 1.3/1.4)", () => {
  it("formatVnd → vi-VN integer, round Decimal(2) artifacts", () => {
    expect(formatVnd(588479248)).toBe("588.479.248");
    expect(formatVnd("13968396248.00")).toBe("13.968.396.248");
    expect(formatVnd("16755895425.05")).toBe("16.755.895.425");
    expect(formatVnd(null)).toBe("—");
    expect(formatVnd("abc")).toBe("abc");
  });

  it("formatVndCompact → tỷ/triệu, integer fallback", () => {
    expect(formatVndCompact(16755895425.05)).toContain("tỷ");
    expect(formatVndCompact(588479248)).toContain("triệu");
    expect(formatVndCompact(500000)).toBe("500.000");
  });

  it("ICT timestamp pinned — same instant everywhere", () => {
    // 2026-09-18T10:30:00Z == 17:30:00 ICT
    expect(formatTimeICT("2026-09-18T10:30:00Z")).toBe("17:30:00");
    expect(formatDateICT("2026-09-18T10:30:00Z")).toBe("18/09/2026");
    expect(formatDateTimeICT("2026-09-18T10:30:00Z")).toBe("17:30:00 18/09/2026");
    expect(formatTimeICT("not-a-date")).toBe("—");
  });

  it("formatSessionDate YYYY-MM-DD → dd/MM/yyyy, no TZ shift", () => {
    expect(formatSessionDate("2026-09-21")).toBe("21/09/2026");
    expect(formatSessionDate("")).toBe("—");
  });

  it("formatAgo relative", () => {
    expect(formatAgo(new Date(Date.now() - 5 * 60 * 1000).toISOString(), "vi")).toContain("phút");
    expect(formatAgo(new Date(Date.now() - 5 * 60 * 1000).toISOString(), "en")).toContain("minute");
  });

  it("isDuplicateSummary bridges BE comma-đ vs FE dot-VND", () => {
    expect(isDuplicateSummary("Cá mập mua VBB: 588,479,248đ", "Cá mập mua VBB: 588.479.248 VND")).toBe(true);
    expect(normalizeAlertText("Cá mập mua VBB: 588,479,248đ")).toBe(
      normalizeAlertText("Cá mập mua VBB: 588.479.248 VND"),
    );
    expect(isDuplicateSummary("Title VBB", "Body khác hẳn")).toBe(false);
    expect(isDuplicateSummary("", "")).toBe(false);
  });
});
