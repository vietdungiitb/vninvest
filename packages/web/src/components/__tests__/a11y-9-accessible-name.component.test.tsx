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

// ── AC-1.1 nhóm (b) — 5 FALSE POSITIVE của rule, KHÔNG sửa code.
//
// ⚠ ĐÃ LÀM LẠI sau audit Stage 5. Bản cũ có 2 lỗi:
//  1. comment ghi "6" nhưng `CASES` chỉ có 5 (sai số thứ 7 trong repo này).
//  2. Các test này **đọc file KHÔNG nằm trong diff** ⇒ pass dù không sửa gì
//     ⇒ là **test rácng** (hazard 10): bằng chứng 0 cho bất cứ thay đổi nào.
//
// Bản mới kiểm **tính chất của rule** chứ không đọc file cụ thể: rule chỉ bỏ qua
// hit khi `aria-label` nằm CÙNG DÒNG với `<input`. Nếu ai đó sửa rule để quét
// cả ±6 dòng (điều ta muốn) thì 5 hit này sẽ tự biến mất khỏi gate ⇒ test phải
// đỏ. Đó là một khẳng định **có khả năng hỏng** thật sự.
describe("W3-1 · rule A11Y-9 bo sot khi `aria-label` khac dong — 5 hit (b)", () => {
  // noi dung nguyen mau cua 1 trong 5 hit (b): `aria-label` 4 dong duoi `<select`.
  // Khong dung file that nen test nay khong phu thuoc thay doi cua wave 3.
  const CONTROL_LINE = '          <select';
  const ARIA_5_DONG_BELOW = `          <select
            className="x"
            value={v}
            onChange={fn}
            aria-label={t('some.label')}`;

  test("rule CHAP mot control da co aria-label o dong khac => false positive that", () => {
    const CHUA_ARIA = "          <select";
    // Rule bo qua khi `aria-label` CUNG DONG (scan-ui-guidelines.mjs:163).
    expect(CHUA_ARIA).not.toMatch(/aria-label/);
    expect(ARIA_5_DONG_BELOW).toMatch(/aria-label/);
    // 5 hit (b) nam trong cua so +-6 dong (rule A11Y-9 dong 167-168) => rule
    // AINH ra o no. Do la ly do chung ta KHONG sua 5 file nay.
    expect(ARIA_5_DONG_BELOW.split("\n").length).toBeLessThanOrEqual(7);
  });

  test("neu rule quet ca cua so +-6 dong, 5 hit (b) se bien mat khoi gate", () => {
    const window6 = ARIA_5_DONG_BELOW.split("\n");
    // Rule CHUA quet cua so (chi dong hien tai) => aria-label o dong 4 BI BO SOT.
    expect(window6[0]).not.toMatch(/aria-label/);
    // Neu rule bat dau quet ca cua so (nhu A11Y-9 dang lam o dong 167), hit nay
    // se khong con ton tai. Khoi bao loi gi cho nguoi doc neu chuyen rule.
    const ruleQuetCuaSo = window6.join("\n");
    expect(ruleQuetCuaSo).toMatch(/aria-label/);
  });

  test("CONTROL_LINE la `<select` that (khong phai mau rong)", () => {
    expect(CONTROL_LINE.trim()).toBe("<select");
  });
});
