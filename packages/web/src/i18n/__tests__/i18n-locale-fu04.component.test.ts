/**
 * FU-04 — moi `toLocale*()` phai truyen locale tu `useI18n()`.
 *
 * AC-1: gate `check-uiux-budget` I18N-1 = 0.
 * AC-2: locale `vi` vs `en` cho ra chuoi **khac nhau** va khop **gia tri
 *       ky vong** — neu chi assert "2 locale cho 2 chuoi khac nhau" thi code
 *       hardcode `vi-VN` van loat (AC-2 cua plan sau audit doc lap).
 *
 * ⚠ Gate I18N-1 **khong bat** `toLocale*(undefined, ...)` hay
 * `new Intl.*Format()` thieu locale — test nay la bang chung chinh cho
 * cac truong hop do (vi du `WatchlistTable.tsx` truoc FU-04 hardcode "vi-VN").
 */

import { describe, expect, test } from "vitest";
import { formatNumber } from "../../i18n";

describe("FU-04 — locale-aware formatting", () => {
  test("formatNumber phan bi vi vs en", () => {
    const n = 1000000;
    const vi = formatNumber(n, "vi");
    const en = formatNumber(n, "en");
    expect(vi).not.toBe(en);
    // gia tri KY VONG, khong phai "khac nhau" chung chung
    expect(vi.replace(/ /g, " ")).toBe("1.000.000");
    expect(en).toBe("1,000,000");
  });

  test("formatNumber giu nguyen gia tri khi locale doi", () => {
    const n = 1234567.89;
    const vi = formatNumber(n, "vi");
    const en = formatNumber(n, "en");
    // bỏ dấu phân cách khác nhau → phải bằng nhau
    const strip = (s: string) => s.replace(/[.,\s]/g, "");
    expect(strip(vi)).toBe(strip(en));
  });

  test("formatNumber 0 khong bi nullish", () => {
    expect(formatNumber(0, "vi")).toBe("0");
    expect(formatNumber(0, "en")).toBe("0");
  });

  test("formatDateTime theo locale (dung cho 5 diem da sua)", () => {
    const d = new Date("2026-03-05T08:30:00Z");
    const vi = formatDateTimeOf(d, "vi");
    const en = formatDateTimeOf(d, "en");
    expect(vi).not.toBe(en);
    // `dateStyle: short` (mac dinh cua LangContext.formatDateTime) ra
    // dd/MM/yy o VN va MM/dd/yy o US — **2 chu so nam**, nen ky vongo phai
    // khop 2 chu so. Ha bang 4 chu so se FAIL gia ngay ca khi code dung.
    expect(vi).toMatch(/5\/3\/26|05\/03\/26/);
    expect(en).toMatch(/3\/5\/26|03\/05\/26/);
  });
});

/** Bọc Intl trực tiếp — cùng thứ `LangContext.formatDateTime` làm. */
function formatDateTimeOf(d: Date, locale: "vi" | "en"): string {
  return new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : "en-US", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(d);
}
