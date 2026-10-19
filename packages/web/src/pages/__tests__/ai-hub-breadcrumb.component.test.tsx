/**
 * R4.4 AC2 — mọi route AI CC phải có breadcrumb quay về `/settings`.
 *
 * Bối cảnh đo được trước khi viết: **không** trang AI CC nào render `Breadcrumb`.
 * Vậy AC2 không phải "sửa nhãn nhanh" mà là **thiếu hẳn**. Test ở đây quét **source**
 * của cả 5 trang để một trang mới thêm sau này (ví dụ tab AI mới) không lọt qua
 * quên render breadcrumb — cùng tinh thần với `test_urls_py_has_no_write_route...`
 * ở R4.3: sự vắng mặt phải được canh bằng thứ **chạy được**, không bằng grep tay.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { render, screen } from "@testing-library/react";
import { createElement } from "react";
import { MemoryRouter } from "react-router-dom";

import { LangProvider } from "../../context/LangContext.js";
import { Breadcrumb } from "../../components/Breadcrumb.js";

// `LangProvider` cần `PortfolioProvider` (gọi `usePortfolio()` ở `LangContext.js:31`).
// Bản đầu thiếu mock này ⇒ component throw ⇒ breadcrumb không render ⇒ assert đỏ vì
// lý do sai. Bằng chứng: `Error: usePortfolio must be used inside PortfolioProvider`.
vi.mock("../../context/PortfolioContext.js", () => ({
  usePortfolio: () => ({
    userIdentity: { isStaff: false, isSuperuser: false },
    userEntitlements: null,
    userPlan: null,
    ability: { can: () => true },
  }),
  PortfolioProvider: ({ children }: { children?: unknown }) => children,
}));

/** 4 trang AI CC tương ứng 4 route còn lại trong `main.tsx` (R5.1 đã gỡ route Agents). */
const AI_CC_PAGES = [
  "AICommandCenterPage.tsx",      // /settings/ai
  "AIUsageAnalyticsPage.tsx",     // /settings/ai/usage
  "AICommandTracesPage.tsx",      // /settings/ai/traces
  "AISloDashboardPage.tsx",       // /settings/ai/slo
];

function readPage(file: string): string {
  return readFileSync(resolve(process.cwd(), "src/pages", file), "utf8");
}

describe("R4.4 AC2: breadcrumb tren moi route AI CC", () => {
  it("ca 4 trang AI CC con lai deu render Breadcrumb", () => {
    const missing = AI_CC_PAGES.filter((file) => !readPage(file).includes("Breadcrumb"));
    expect(
      missing, missing.length ? `thieu Breadcrumb: ${missing.join(", ")}` : "",
    ).toEqual([]);
  });

  it("Breadcrumb tao duong dan quay ve /settings tren route con", () => {
    render(
      createElement(
        MemoryRouter,
        { initialEntries: ["/settings/ai/traces"] },
        createElement(LangProvider, null, createElement(Breadcrumb, { key: "bc" })),
      ),
    );
    const back = screen.getByRole("link", { name: /cài đặt/i });
    expect(back.getAttribute("href")).toBe("/settings");
  });

  it("muc 'ai' la link toi /settings/ai, khong phai chuoi tho", () => {
    render(
      createElement(
        MemoryRouter,
        { initialEntries: ["/settings/ai/slo"] },
        createElement(LangProvider, null, createElement(Breadcrumb, { key: "bc" })),
      ),
    );
    // S4 (2026-10-19): nhãn đổi từ "Trí tuệ nhân tạo" (tên NHÓM trong `/settings`)
    // sang "Trung tâm AI" — cùng khoá `routes.aiCommandCenter` với sidebar và
    // `routeCatalog.js:292`. Owner chốt: vị trí hẹp dùng tên ngắn, H1 giữ tên dài.
    const hub = screen.getByRole("link", { name: /trung tâm ai/i });
    expect(hub.getAttribute("href")).toBe("/settings/ai");
    expect(
      screen.queryByRole("link", { name: /trí tuệ nhân tạo/i }),
      "breadcrumb van dung ten nhom thay vi ten trang",
    ).toBeNull();
  });

  it("3 muc dieu huong doc duoc tren /settings/ai/slo", () => {
    // AC3 la "3 anh"; test nay khoa phan "3 muc" bang DOM de anh chup khong
    // the chung minh duoc mau.
    const { container } = render(
      createElement(
        MemoryRouter,
        { initialEntries: ["/settings/ai/slo"] },
        createElement(LangProvider, null, createElement(Breadcrumb, { key: "bc" })),
      ),
    );
    const nav = container.querySelector("nav.breadcrumb");
    expect(nav).toBeTruthy();
    const hrefs = Array.from(nav?.querySelectorAll("a") || []).map((a) => a.getAttribute("href"));
    expect(hrefs).toContain("/settings");
    expect(hrefs).toContain("/settings/ai");
  });

  it("trang co that dung component Breadcrumb (khong phai ban sao inline)", () => {
    for (const file of AI_CC_PAGES) {
      const source = readPage(file);
      expect(source).toMatch(/from ["'][^"']*Breadcrumb/);
    }
    expect(existsSync(resolve(process.cwd(), "src/components/Breadcrumb.tsx"))).toBe(true);
  });
});

// R5.1d — lỗi phát hiện khi **mở ảnh E2E** (ledger Entry 377): breadcrumb rơi về
// **chuỗi thô** ở các route AI còn lại vì `Breadcrumb.tsx:66` chỉ có ánh xạ cho
// `settings`/`ai` (R4.4). `usage` còn tệ hơn: bị map sang `tenantUsage.title` —
// nhãn của trang tenant. Test ở đây chốt **nhãn**, không chốt *sự tồn tại* của crumb
// (test R4.4 chỉ assert có link `/settings` nên không bắt được lỗi này).
describe("R5.1d — nhãn breadcrumb của route AI phải dịch, không rơi về chuỗi thô", () => {
  // (path, nhãn tiếng Việt mong đợi) — lấy từ ảnh E2E `01/02-audit-tab.png`.
  const CASES: Array<[string, RegExp]> = [
    ["/settings/ai/audit", /nhật ký audit/i],
    ["/settings/ai/usage", /usage ai/i],
    ["/settings/ai/traces", /dấu vết/i],
    ["/settings/ai/slo", /slo/i],
  ];

  for (const [path, want] of CASES) {
    it(`${path}: mục cuối là nhãn đã dịch`, () => {
      const { container } = render(
        createElement(
          MemoryRouter,
          { initialEntries: [path] },
          createElement(LangProvider, null, createElement(Breadcrumb, { key: "bc" })),
        ),
      );
      const nav = container.querySelector("nav.breadcrumb");
      const last = nav?.lastElementChild?.textContent?.trim() ?? "";
      // Mục cuối không phải link ⇒ text nằm thẳng trong nav.
      expect(last, `mục cuối = "${last}" (chuỗi thô)`).toMatch(want);
      expect(last, "không được là tên segment thô").not.toBe(path.split("/").pop());
    });
  }

  it("KHÔNG phá nhãn của /tenant-admin/usage (trùng tên segment nhưng khác nghĩa)", () => {
    const { container } = render(
      createElement(
        MemoryRouter,
        { initialEntries: ["/tenant-admin/usage"] },
        createElement(LangProvider, null, createElement(Breadcrumb, { key: "bc" })),
      ),
    );
    const nav = container.querySelector("nav.breadcrumb");
    const last = nav?.lastElementChild?.textContent?.trim() ?? "";
    // Nhãn thật đo được: `tenantUsage.title` = "Usage và quota thành viên".
    // Điều cần chặn là: nó **không** bị thay bằng nhãn AI ("Usage AI").
    expect(last, "nhãn tenant usage phải giữ nguyên").toMatch(/quota thành viên/i);
    expect(last, "không được dùng nhãn của AI hub").not.toBe("Usage AI");
  });
});