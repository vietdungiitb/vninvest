import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { createElement } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as LangContext from "../../context/LangContext.js";
import * as ToastContext from "../../components/ShellToast.js";
import { TenantAdminAIPolicyPage } from "./TenantAdminAIPolicyPage";

/**
 * R4.1 AC1 — trang Tenant Admin đặt policy AI.
 *
 * Ba thứ cần khóa bằng test, vì cả ba đều là lỗi "đỏ nhưng chạy":
 * 1. Nạp giá trị server vào form **một lần khi có data** (`useEffect` phụ thuộc
 *    `policy`). Nếu không, form khoá ở giá trị `useState` mặc định.
 * 2. `read_only` (staff xem đa tenant) ⇒ nút lưu khoá, không gửi PUT.
 * 3. Gửi đúng shape: `max_cost_per_day` rỗng ⇒ `null`, không phải chuỗi rỗng
 *    (BE chấp nhận cả hai, nhưng `""` làm hai nguồn sự thật về "chưa đặt").
 */
vi.mock("../../adapters/coreApiAdapter.js", () => ({
  defaultCoreApiAdapter: {
    coreGet: vi.fn(),
    corePost: vi.fn(),
    corePatch: vi.fn(),
    coreDelete: vi.fn(),
    corePut: vi.fn(),
  },
}));

import { defaultCoreApiAdapter } from "../../adapters/coreApiAdapter.js";

const i18nValue = {
  locale: "vi",
  // Trả key, và **nội suy số được truyền vào**. Lý do: `t` thật lấy giá trị từ
  // bảng dịch, còn test này chỉ cần biết *số phiên bản từ server có tới nơi*.
  // Mock cũ trả nguyên key nên `{version}` (nằm ở **value**, không ở key) không
  // bao giờ được nội suy ⇒ assert "chứa v3" luôn đỏ dù code đúng.
  t: (key: string, opts?: Record<string, unknown>) =>
    opts && "version" in opts ? `v${opts.version}` : key,
  formatNumber: (n: any) => n,
};

const POLICY = {
  allow_byok: false,
  allowed_providers: ["openai"],
  allowed_models: ["gpt-4o-mini"],
  max_tokens_per_day: 5000,
  max_cost_per_day: null,
  version: 3,
  is_default: false,
  tenant_code: "tenant-A",
};

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    createElement(QueryClientProvider, { client }, createElement(TenantAdminAIPolicyPage)),
  );
}

beforeEach(() => {
  window.localStorage.setItem("tenant_id", "tenant-A");
  vi.spyOn(LangContext, "useI18n").mockReturnValue(i18nValue as any);
  vi.spyOn(ToastContext, "useToast").mockReturnValue({ success: vi.fn(), error: vi.fn(), info: vi.fn() } as any);
  (defaultCoreApiAdapter.coreGet as any).mockReset();
  (defaultCoreApiAdapter.corePut as any).mockReset();
});

describe("TenantAdminAIPolicyPage", () => {
  it("nạp giá trị server vào form", async () => {
    (defaultCoreApiAdapter.coreGet as any).mockResolvedValue(POLICY);
    const { container } = renderPage();

    await waitFor(() => {
      expect((container.querySelector("#maxTokensPerDay") as HTMLInputElement).value).toBe("5000");
    });
    expect((container.querySelector("#allowedProviders") as HTMLInputElement).value).toBe("openai");
    const byok = container.querySelector("input[type='checkbox']") as HTMLInputElement;
    expect(byok.checked).toBe(false);
    expect(screen.getByTestId("tenant-ai-policy-version").textContent).toBe("v3");
  });

  it("báo rõ khi tenant chưa có policy (mặc định)", async () => {
    (defaultCoreApiAdapter.coreGet as any).mockResolvedValue({
      ...POLICY, is_default: true, version: 0, allow_byok: true,
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId("tenant-ai-policy-default")).toBeTruthy();
    });
  });

  it("gửi PUT với shape đúng khi bấm lưu", async () => {
    (defaultCoreApiAdapter.coreGet as any).mockResolvedValue(POLICY);
    (defaultCoreApiAdapter.corePut as any).mockResolvedValue(POLICY);
    const { container } = renderPage();

    await waitFor(() => {
      expect((container.querySelector("#maxTokensPerDay") as HTMLInputElement).value).toBe("5000");
    });
    fireEvent.click(container.querySelector("button[type='submit']") as HTMLButtonElement);

    await waitFor(() => {
      expect(defaultCoreApiAdapter.corePut).toHaveBeenCalled();
    });
    const [url, body] = (defaultCoreApiAdapter.corePut as any).mock.calls[0];
    expect(url).toContain("/core/v1/workspace/ai-command-center/tenant-policy/");
    // Ô chi phí để trống ⇒ null (không phải "").
    expect(body.max_cost_per_day).toBeNull();
    expect(body.allow_byok).toBe(false);
    expect(body.allowed_providers).toEqual(["openai"]);
  });

  it("read_only (staff) thì khoá form, không gửi PUT", async () => {
    (defaultCoreApiAdapter.coreGet as any).mockResolvedValue({ ...POLICY, read_only: true });
    const { container } = renderPage();

    await waitFor(() => {
      expect((container.querySelector("#maxTokensPerDay") as HTMLInputElement).disabled).toBe(true);
    });
    const submit = container.querySelector("button[type='submit']") as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
    fireEvent.click(submit);
    expect(defaultCoreApiAdapter.corePut).not.toHaveBeenCalled();
  });
});