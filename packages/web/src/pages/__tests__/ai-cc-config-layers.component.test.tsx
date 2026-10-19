/**
 * S2 AC2.1 / AC2.2 / AC2.3 / AC2.4 — tách **tùy chọn cá nhân** ra khỏi panel
 * **chính sách hệ thống**, và bỏ 2 số hiển thị trùng với form.
 *
 * Bối cảnh (đo trên `dev` @ `96cc87e12`, đã kiểm ở S1):
 *   - `eventGate` đọc/ghi qua `getUserConfig()` / `updateUserConfig()`
 *     (`AICommandCenterPage.tsx:119-134`, `:175`) — **endpoint + kho lưu khác hẳn**
 *     AI CC config — nhưng lại nằm trong panel `operationPolicy` = "Chính sách vận hành".
 *     Đây là gốc rễ của nhận xét "lẫn lộn cài đặt tài khoản và cấu hình trung tâm AI".
 *   - `advisory_refresh_interval_hours` và `advisory_max_tokens_per_day` hiện ở panel
 *     (chỉ đọc) **và** sửa được trong form ngay dưới, với **3 tên khác nhau**.
 *   - `advisory_max_auto_refreshes_per_day` hiện ở panel nhưng **không có `<input>` nào**
 *     toàn FE (đo đệ quy 581 file: 10 hit, 4 file production, 0 file tạo input) ⇒
 *     phải gắn nhãn "Chỉ đọc" để người dùng không tưởng sửa được.
 *
 * Fail-before: chạy nguyên file này trên bản tiền-sửa ⇒ 3 case đỏ.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { createElement } from "react";
import { MemoryRouter } from "react-router-dom";

import { coreApiAdapter } from "../../adapters/coreApiAdapter.js";
import { LangProvider } from "../../context/LangContext.js";
import { AICommandCenterPage } from "../AICommandCenterPage.js";

vi.mock("../../components/AIAuditLogsPanel.js", () => ({ AIAuditLogsPanel: () => null }));
vi.mock("../../components/AIAdvisoryPromptConfigDrawer.js", () => ({
  AIAdvisoryPromptConfigDrawer: () => null,
}));

let isStaff = false;
vi.mock("../../context/PortfolioContext.js", () => ({
  usePortfolio: () => ({
    userIdentity: { isStaff, isSuperuser: false },
    userEntitlements: null,
    userPlan: null,
    ability: { can: () => true },
  }),
  PortfolioProvider: ({ children }: { children?: unknown }) => children,
}));

const baseSettings = {
  ai_provider: "gemini",
  ai_model: "gemini-3.8-flash",
  ai_ready: true,
  effective_ai_provider: "gemini",
  effective_ai_model: "gemini-3.8-flash",
  effective_ai_source: "command_center",
  advisory_refresh_interval_hours: 24,
  advisory_max_tokens_per_day: 1000,
  advisory_max_auto_refreshes_per_day: 24,
  temperature: 0.3,
};

function renderHub() {
  return render(
    createElement(
      MemoryRouter,
      { initialEntries: ["/settings/ai"] },
      createElement(LangProvider, null, createElement(AICommandCenterPage, {})),
    ),
  );
}

/** Panel có tiêu đề `title` — `ShellPanel` render `h2` (ShellPageTemplate.js:80). */
function panelByTitle(container: HTMLElement, title: string): HTMLElement | null {
  const heading = Array.from(container.querySelectorAll("h2")).find(
    (h) => h.textContent?.trim() === title,
  );
  return (heading?.closest("article") ?? null) as HTMLElement | null;
}

beforeEach(() => {
  isStaff = false;
  vi.spyOn(coreApiAdapter, "getAICommandCenterConfig").mockResolvedValue({ ...baseSettings } as never);
  vi.spyOn(coreApiAdapter, "getUserConfig").mockResolvedValue({
    preferences: { advisory_whale_signal_enabled: true },
  } as never);
  vi.spyOn(coreApiAdapter, "updateUserConfig").mockResolvedValue({
    advisory_whale_signal_enabled: false,
  } as never);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("S2: tach lop cau hinh — ca nhan vs he thong", () => {
  it("AC2.1 — 'Gate su kien' KHONG con nam trong panel 'Chinh sach van hanh'", async () => {
    const { container } = renderHub();
    await waitFor(() => {
      expect(container.querySelector("h1")).toBeTruthy();
    });

    const policy = panelByTitle(container, "Chính sách vận hành");
    expect(policy, "khong tim thay panel 'Chính sách vận hành'").toBeTruthy();
    expect(
      policy!.textContent,
      "toggle 'Gate sự kiện' vẫn nằm trong panel chính sách hệ thống — đây là lỗi cần sửa",
    ).not.toContain("Gate sự kiện");

    // Nhưng toggle vẫn phải tồn tại ở đâu đó trên trang.
    expect(screen.getByText("Gate sự kiện")).toBeTruthy();
  });

  it("AC2.2 — toggle 'Gate su kien' van goi updateUserConfig (doi cho hien thi, khong doi hanh vi)", async () => {
    renderHub();
    const box = await screen.findByRole("checkbox", { name: /Gate sự kiện/i } as never);

    fireEvent.click(box);

    await waitFor(() => {
      expect(coreApiAdapter.updateUserConfig).toHaveBeenCalledWith({
        advisory_whale_signal_enabled: false,
      });
    });
  });

  it("AC2.3 — panel chinh sach khong con lap lai 2 so da sua duoc trong form", async () => {
    const { container } = renderHub();
    await waitFor(() => {
      expect(container.querySelector("h1")).toBeTruthy();
    });

    const policy = panelByTitle(container, "Chính sách vận hành");
    expect(policy).toBeTruthy();

    // "Khoảng làm mới" va "Token/ngày" la 2 so trung: hien o panel (chi doc) VA
    // sua duoc trong form (`field-refresh-interval` / `field-max-tokens`).
    expect(
      policy!.textContent,
      "panel chính sách vẫn liệt kê số trùng với form",
    ).not.toContain("Khoảng làm mới");
    expect(policy!.textContent, "panel chính sách vẫn liệt kê số trùng với form").not.toContain(
      "Token/ngày",
    );

    // Form van phai sua duoc 2 field do — chi chuyen cho, khong xoa chuc nang.
    expect(container.querySelector('[data-testid="field-refresh-interval"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="field-max-tokens"]')).toBeTruthy();
  });

  it("AC2.4 — so khong sua duoc o bat ky dau phai co nhan 'Chi doc'", async () => {
    const { container } = renderHub();
    await waitFor(() => {
      expect(container.querySelector("h1")).toBeTruthy();
    });

    const policy = panelByTitle(container, "Chính sách vận hành");
    expect(policy).toBeTruthy();
    expect(
      policy!.textContent,
      "'Auto refresh/ngày' vẫn hiện mà không có nhãn chỉ đọc",
    ).toContain("Chỉ đọc");
  });
});
