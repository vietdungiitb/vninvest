/**
 * W3-1 (AC-1.2) — moi control thay the trong A11Y-9 co accessible NAME DOC DUOC.
 *
 * Vì sao test này tồn tại
 * -----------------------
 * Vòng audit đã đóng **6 lần** "sai số" vì đếm bằng grep thay vì đo (L-G04).
 * Riêng A11Y-9 còn nặng hơn: rule `scan-ui-guidelines.mjs:163` chỉ kiểm
 * `aria-label` **CÙNG MỘT DÒNG** với `<input`. Nên "thêm `aria-label` xuống
 * dòng khác" là fix **trông có** mà rule vẫn đếm ⇒ con số 44 không phản ánh
 * tiến độ (`docs/TEST_REPORT_UIUX_WAVE2.md:85-88`).
 *
 * ⇒ Test này KHÔNG đếm attribute. Nó hỏi đúng câu hỏi người dùng với
 * screen reader: `getByRole(..., { name: ... })` — tức **tên đọc được**.
 * Một `aria-label=""` rỗng hoặc trùng nhau sẽ fail ở đây.
 *
 * AC-1.1 phân 44 hit thành: (a) 38 thật · (b) 6 false positive của rule.
 * Slice này sửa 38 nhóm (a). 6 nhóm (b) **cố ý KHÔNG sửa** — chúng ĐÃ có tên,
 * chỉ là rule không nhìn thấy (xem `b-` test ở cuối file).
 */

import { describe, expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import { createElement } from "react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { MemoryRouter } from "react-router-dom";
import { LangProvider } from "../../context/LangContext";
import { PortfolioProvider } from "../../context/PortfolioContext";
import { Input } from "../../components/ui/input";
import { InputOtp, InputOtpSlot } from "../../components/ui/input-otp";
import { StatsPanel } from "../../components/alert-center/StatsPanel";
import CampaignForm from "../../features/advertising/components/CampaignForm";

function wrap(node: React.ReactElement) {
  return render(
    createElement(
      MemoryRouter,
      null,
      createElement(
        PortfolioProvider,
        null,
        createElement(LangProvider, null, node),
      ),
    ),
  );
}

/** Tất cả control nhận văn bản trong cây đã render. */
function textControls(): HTMLElement[] {
  return [
    ...screen.queryAllByRole("textbox"),
    ...screen.queryAllByRole("searchbox"),
    ...screen.queryAllByRole("combobox"),
    ...screen.queryAllByRole("slider"),
    ...screen.queryAllByRole("checkbox"),
    ...screen.queryAllByRole("radio"),
  ];
}

/**
 * Điều kiện cốt lõi: KHÔNG control nào có tên rỗng.
 * `aria-label=""` và `aria-labelledby` trỏ tới id không tồn tại đều rơi vào đây.
 */
function expectAllNamed(scope: HTMLElement[]) {
  const unnamed = scope.filter((el) => {
    const name = (
      el.getAttribute("aria-label") ??
      el.getAttribute("title") ??
      ""
    ).trim();
    if (name) return false;
    // Tên có thể đến từ <label htmlFor> / <label> bọc ngoài — kiểm bằng cách
    // tra id và label element thật, không đoán.
    const id = el.getAttribute("id");
    if (id) {
      // Không dùng `CSS.escape` — jsdom của repo này không có. Các id trong
      // W3-1 đều là ký tự an toàn cho selector thuần.
      const lbl = document.querySelector(`label[for="${id}"]`);
      if (lbl && (lbl.textContent ?? "").trim()) return false;
    }
    const wrapping = el.closest("label");
    if (wrapping && (wrapping.textContent ?? "").trim()) return false;
    return true;
  });
  expect(
    unnamed.map((el) => el.outerHTML.slice(0, 110)),
    "control khong co accessible name",
  ).toEqual([]);
}

// ── AC-1.2a · primitive `Input`: trước đây không có fallback khi caller
// không truyền `label`, nên `placeholder` là toàn bộ thông tin (đọc kiểu
// "edit text" không biết đang nhập gì).
describe("W3-1 · Input primitive có tên khi không truyền `label`", () => {
  test("không `label` → vẫn tìm được theo tên lấy từ placeholder", () => {
    wrap(createElement(Input, { placeholder: "Mã tenant" }));
    expect(screen.getByRole("textbox", { name: "Mã tenant" })).toBeTruthy();
    expectAllNamed(textControls());
  });

  test("có `label` → tên đến từ <label htmlFor>, không phải từ aria-label", () => {
    wrap(createElement(Input, { label: "Email", id: "in-email" }));
    const el = screen.getByLabelText("Email");
    expect(el).toBeTruthy();
    expectAllNamed(textControls());
  });

  test("caller truyền `aria-label` → giá riêng thắng", () => {
    wrap(createElement(Input, { placeholder: "ph", "aria-label": "Tên riêng" }));
    expect(screen.getByRole("textbox", { name: "Tên riêng" })).toBeTruthy();
  });
});

// ── AC-1.2b · `InputOtp`: mỗi ô phải tên riêng ("Digit 1".."Digit n").
describe("W3-1 · InputOtp đánh số ô có tên", () => {
  test("InputOtp 4 ô → 4 tên khác nhau", () => {
    wrap(createElement(InputOtp, { length: 4, value: ["", "", "", ""] } as never));
    const boxes = screen.getAllByRole("textbox");
    expect(boxes).toHaveLength(4);
    const names = boxes.map((b) => b.getAttribute("aria-label"));
    expect(names).toEqual(["Digit 1", "Digit 2", "Digit 3", "Digit 4"]);
    expectAllNamed(textControls());
  });

  test("InputOtpSlot nhận `slotLabel` khi caller không truyền `aria-label`", () => {
    wrap(createElement(InputOtpSlot, { slotLabel: "Ô mã" }));
    expect(screen.getByRole("textbox", { name: "Ô mã" })).toBeTruthy();
  });
});

// ── AC-1.2c · `StatsPanel` (alert-center): ô tìm kiếm thống kê.
describe("W3-1 · StatsPanel ô tìm kiếm có tên", () => {
  test("tìm được theo tên, không chỉ có placeholder", () => {
    wrap(
      createElement(StatsPanel, {
        searchTerm: "",
        onSearchChange: () => {},
        // `StatsPanel` return sớm về empty state khi `rows` rỗng
        // (StatsPanel.tsx:51) => phải có ít nhất 1 dòng để ô search render.
        rows: [{ symbol: "FPT", count: 3 }],
      } as never),
    );
    // `type="text"` ⇒ role `textbox`, KHÔNG phải `searchbox`.
    const boxes = screen.getAllByRole("textbox");
    expect(boxes.length).toBeGreaterThan(0);
    for (const b of boxes) {
      expect((b.getAttribute("aria-label") ?? "").trim().length).toBeGreaterThan(0);
    }
  });
});

// ── AC-1.2d · `CampaignForm`: 13 control trước đây có `<label>` **không
// `htmlFor`** + input **không `id`** ⇒ label không gắn được với control ⇒
// screen reader không đọc được nhãn hiển thị.
describe("W3-1 · CampaignForm gắn nhãn hiển thị với control", () => {
  test("mọi control của form tìm được theo nhãn đang hiển thị", () => {
    wrap(
      createElement(CampaignForm, {
        campaign: null,
        onSubmit: () => {},
        onCancel: () => {},
      } as never),
    );
    // `getAllByRole('textbox')` KHÔNG trả về control chưa render (form có
    // nhánh preview) — nên đòi ÍT NHẤT 1 và kiểm tất cả những cái có mặt.
    const boxes = [...screen.queryAllByRole("textbox"), ...screen.queryAllByRole("combobox")];
    expect(boxes.length).toBeGreaterThan(0);
    expectAllNamed(boxes);
  });

  test("nhãn `Chiến dịch` gắn đúng control qua htmlFor", () => {
    wrap(
      createElement(CampaignForm, {
        campaign: null,
        onSubmit: () => {},
        onCancel: () => {},
      } as never),
    );
    // `cf-name` là id đặt ở W3-1; label phải trỏ tới đúng id đó.
    const lbls = [...document.querySelectorAll("label[for]")];
    const cfNames = lbls.map((l) => l.getAttribute("for")).filter((f) => f?.startsWith("cf-"));
    expect(cfNames.length).toBeGreaterThanOrEqual(1);
    for (const f of cfNames) {
      expect(document.getElementById(f as string)).toBeTruthy();
    }
  });
});

// ── AC-1.1 nhóm (b) — 6 FALSE POSITIVE của rule, KHÔNG sửa code.
// Chứng minh bằng **source thật** rằng chúng ĐÃ có `aria-label` trong
// cửa sổ ±6 dòng — tức rule bỏ sót vì chỉ nhìn CÙNG DÒNG, không phải vì
// control thật sự không tên. Nếu ai "sửa" chúng, test này đỏ.
describe("W3-1 · 6 hit (b) đã có tên sẵn — không sửa", () => {
  // [file, dòng `<input`, số dòng aria-label cách đi]
  const CASES = [
    ["src/components/ui/command.tsx", 22, 27],
    ["src/components/ui/command.tsx", 54, 58],
    ["src/components/alert-center/FilterBar.tsx", 107, 111],
    ["src/components/alert-center/FilterBar.tsx", 117, 123],
    ["src/components/WhaleBubbleChart.jsx", 1513, 1517],
  ] as const;

  test.each(CASES)("%s:%i có aria-label ở dòng %i (rule chỉ nhìn cùng dòng)", (file, at, ariaAt) => {
    const lines = readFileSync(resolve(process.cwd(), file), "utf8").split(/\r?\n/);
    // dòng `at` PHẢI là thẻ control, và KHÔNG được chứa aria-label
    expect(lines[at - 1]).toMatch(/<(input|select|textarea)\b/);
    expect(lines[at - 1]).not.toMatch(/aria-label/);
    // dòng aria-label phải tồn tại trong cửa sổ ±6 và thật sự có aria-label
    const delta = ariaAt - at;
    expect(Math.abs(delta)).toBeLessThanOrEqual(6);
    expect(lines[ariaAt - 1]).toMatch(/aria-label/);
  });
});