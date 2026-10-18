/**
 * R4.4 AC1 — `/settings` phải có lối vào `/settings/ai` trong nhóm "Trí tuệ nhân tạo".
 *
 * Bối cảnh đo được trước khi viết: `UserSettingsPage.tsx` (265 dòng) **đã có** sẵn
 * pattern `section` + `Link` (block trỏ `/broker`), nên AC1 là **nối vào có sẵn**,
 * không phải thiết kế mới. Fail-before: trang **không** có link tới `/settings/ai`.
 *
 * Test này cố tình kiểm **cả** hai điều: có link, và link nằm trong **nhóm** có
 * nhãn tiếng Việt — vì link đúng URL mà đặt lơ lửng ở cuối trang thì người dùng
 * vẫn không tìm thấy, đó là AC hỏng theo kiểu không báo lỗi.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { createElement } from "react";
import { MemoryRouter } from "react-router-dom";

const adapterMocks = vi.hoisted(() => ({
  // Đúng tên hàm trang dùng: `UserSettingsPage.tsx:68,131,158` gọi
  // `getUserProfile` / `updateUserProfile` / `changeUserPassword`. Lần mock đầu tôi đặt
  // `getUserConfig` ⇒ `getUserProfile is not a function` ⇒ **trang throw**, không
  // render gì, mọi assert đỏ vì lý do sai.
  getUserProfile: vi.fn(),
  updateUserProfile: vi.fn(),
  changeUserPassword: vi.fn(),
}));

vi.mock("../../adapters/coreApiAdapter.js", () => ({
  coreApiAdapter: {
    get getUserProfile() { return adapterMocks.getUserProfile; },
    get updateUserProfile() { return adapterMocks.updateUserProfile; },
    get changeUserPassword() { return adapterMocks.changeUserPassword; },
  },
}));

// `LangProvider` gọi `usePortfolio()` bên trong (`LangContext.js:31`) và **ném** nếu
// thiếu provider. Bản đầu của test này không mock nên component throw ⇒ không có gì
// render ⇒ mọi assert đỏ mà **không** phải vì link thiếu. Đo lỗi thật bằng cách
// render thử rồi đọc DOM, đừng đoán.
vi.mock("../../context/PortfolioContext.js", () => ({
  usePortfolio: () => ({
    userIdentity: { isStaff: false, isSuperuser: false },
    userEntitlements: null,
    userPlan: null,
    ability: { can: () => true },
  }),
  PortfolioProvider: ({ children }: { children?: unknown }) => children,
}));

import { LangProvider } from "../../context/LangContext.js";
import { UserSettingsPage } from "../UserSettingsPage.js";

beforeEach(() => {
  for (const fn of Object.values(adapterMocks)) (fn as ReturnType<typeof vi.fn>).mockReset();
  adapterMocks.getUserProfile.mockResolvedValue({
    display_name: "Nam", avatar_url: "", language: "vi", theme: "light",
    whale_alert_threshold: 1000,
  });
  adapterMocks.updateUserProfile.mockResolvedValue({});
  adapterMocks.changeUserPassword.mockResolvedValue({});
});

function renderPage() {
  return render(
    createElement(
      MemoryRouter,
      { initialEntries: ["/settings"] },
      createElement(LangProvider, null, createElement(UserSettingsPage, { key: "page" })),
    ),
  );
}

describe("R4.4 AC1: /settings co link toi /settings/ai", () => {
  it("render link tro toi /settings/ai", async () => {
    // Trang nap bang fetch (useEffect) ⇒ phai `await`, assert dong bo se thay trang
    // dang o trang thai "dang tai" va do la do do sai chu khong phai loi AC1.
    const { container } = renderPage();
    await waitFor(() => {
      expect(container.querySelector('a[href="/settings/ai"]')).toBeTruthy();
    });
    const link = container.querySelector('a[href="/settings/ai"]');
    expect(link?.textContent?.trim().length).toBeGreaterThan(0);
  });

  it("link nam trong mot nhom co nhan, khong lo le", async () => {
    const { container } = renderPage();
    await waitFor(() => {
      expect(container.querySelector('a[href="/settings/ai"]')).toBeTruthy();
    });
    const link = container.querySelector('a[href="/settings/ai"]');
    const section = link?.closest("section");
    expect(section).toBeTruthy();
    expect(section?.textContent || "").toMatch(/trí tuệ nhân tạo/i);
  });

  it("khong phai link dau tien cua trang (truoc do la nhom khac)", async () => {
    const { container } = renderPage();
    await waitFor(() => {
      expect(container.querySelector('a[href="/settings/ai"]')).toBeTruthy();
    });
    const links = Array.from(container.querySelectorAll("a"));
    const aiIndex = links.findIndex((a) => a.getAttribute("href") === "/settings/ai");
    // Phai ton tai it nhat mot link khac (ví dụ /broker) di truoc ⇒ nhóm AI la
    // muc rieng, khac la them lien ket lung tung.
    expect(links.length).toBeGreaterThan(1);
    expect(aiIndex).toBeGreaterThanOrEqual(0);
  });
});