/**
 * S3 AC3.1 / AC3.2 / AC3.3 / AC3.4 — enum thô KHÔNG được lộ ra UI.
 *
 * Bối cảnh (đo trên `dev` @ `96cc87e12`):
 *   - `AICommandCenterPage.tsx:251` render thẳng `effectiveProvider` ⇒ người dùng thấy
 *     `gemini`; `:253` render thẳng `effectiveSource` ⇒ thấy `command_center`;
 *     `:416` nội suy thẳng `${entry.source}`.
 *   - `effectiveSourceDesc` (`vi.js:5374`) tự viết *"command_center hoặc system fallback"*
 *     ⇒ chính bản dịch đã thừa nhận lộ enum ra giao diện.
 *   - `PROVIDER_OPTIONS` **0/5** có `labelKey` trong khi interface `ProviderModelOption`
 *     **đã có** field `labelKey?` từ R1.3 (`providerModels.ts:4-5`) ⇒ primitive có sẵn.
 *   - Backend (`portfolio_analytics_views.py:1176,1301,1492,1580`): `effective_ai_source`
 *     luôn fallback `'command_center'`; quét đệ quy 750 file `.py` **không có chỗ nào ghi**
 *     ⇒ hôm nay đó là hằng số, hiển thị như dữ liệu người dùng là sai.
 *
 * ⚠ Bẫy đã đo (objection N3): `getNestedValue` (`i18n/index.js:12-16`) tách key theo "."
 * rồi đi từng cấp. Khoá i18n phẳng kiểu `"aiCommandCenter.provider.gemini"` sẽ **không
 * resolve** ⇒ UI in ra chính chuỗi khoá. AC3.1 vì thế kiểm cả **hình dạng lồng** trong
 * dictionary, không chỉ việc khoá có tồn tại.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { createElement } from "react";
import { MemoryRouter } from "react-router-dom";

import { coreApiAdapter } from "../../adapters/coreApiAdapter.js";
import { LangProvider } from "../../context/LangContext.js";
// `vi.js` / `en.js` chỉ có **default export** (`export default vi` ở cuối file) —
// không có named export `viDict`. Import sai tên là test đỏ vì lý do sai.
import viDict from "../../i18n/vi.js";
import enDict from "../../i18n/en.js";
import { AICommandCenterPage } from "../AICommandCenterPage.js";
import { PROVIDER_OPTIONS, aiSourceLabelKey, providerLabelKey } from "../../shared/providerModels.js";

vi.mock("../../components/AIAuditLogsPanel.js", () => ({ AIAuditLogsPanel: () => null }));
vi.mock("../../components/AIAdvisoryPromptConfigDrawer.js", () => ({
  AIAdvisoryPromptConfigDrawer: () => null,
}));

vi.mock("../../context/PortfolioContext.js", () => ({
  usePortfolio: () => ({
    userIdentity: { isStaff: false, isSuperuser: false },
    userEntitlements: null,
    userPlan: null,
    ability: { can: () => true },
  }),
  PortfolioProvider: ({ children }: { children?: unknown }) => children,
}));

/** `getNestedValue` — copy NGUYÊN VĂN từ `i18n/index.js:12-16` để test đúng cơ chế. */
function getNestedValue(source: unknown, path: string): string | undefined {
  return String(path || "")
    .split(".")
    .reduce<any>((acc, part) => (acc && typeof acc === "object" ? acc[part] : undefined), source);
}

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
  ai_prompt_config_history: [
    { version: 3, config: {}, saved_at: "2026-10-19T00:00:00Z", source: "command_center" },
  ],
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

beforeEach(() => {
  vi.spyOn(coreApiAdapter, "getAICommandCenterConfig").mockResolvedValue({ ...baseSettings } as never);
  vi.spyOn(coreApiAdapter, "getUserConfig").mockResolvedValue({ preferences: {} } as never);
});
afterEach(() => vi.restoreAllMocks());

describe("S3: enum thô khong lot ra UI", () => {
  it("AC3.1 — moi provider deu co labelKey va key do RESOLVE duoc (khong phai khoa phang)", () => {
    const missing = PROVIDER_OPTIONS.filter((p) => !p.labelKey);
    expect(missing.map((p) => p.key), "provider chua co labelKey").toEqual([]);

    for (const p of PROVIDER_OPTIONS) {
      for (const [name, dict] of [["vi", viDict], ["en", enDict]] as const) {
        const value = getNestedValue(dict, p.labelKey!);
        expect(
          value,
          `${name}: khoa "${p.labelKey}" khong resolve — khoa phong co cham cham se KHONG duoc`,
        ).toBeTruthy();
        expect(String(value)).not.toContain("aiCommandCenter.");
      }
    }
  });

  it("AC3.2 — o 'Nguon hieu luc' hien nhan da dich, khong in 'command_center'", async () => {
    const { container } = renderHub();
    await waitFor(() => expect(container.querySelector("h1")).toBeTruthy());

    const text = container.textContent ?? "";
    expect(text, "trang van in chuoi enum `command_center`").not.toContain("command_center");
    expect(text).toContain("Cấu hình trung tâm AI");
  });

  it("AC3.2b — gia tri la chua biet roi ve nhan 'Khong xac dinh', khong in tho", () => {
    expect(aiSourceLabelKey("command_center")).toBe("aiCommandCenter.source.commandCenter");
    expect(aiSourceLabelKey("native")).toBe("aiCommandCenter.source.native");
    expect(aiSourceLabelKey("mat_biet")).toBe("aiCommandCenter.source.unknown");
    expect(aiSourceLabelKey(null)).toBe("aiCommandCenter.source.unknown");
    expect(getNestedValue(viDict, aiSourceLabelKey("mat_biet"))).toBe("Không xác định");
  });

  it("AC3.3 — lich su prompt hien nhan da dich cho `entry.source`", async () => {
    const { container } = renderHub();
    await waitFor(() => expect(container.querySelector("h1")).toBeTruthy());

    const text = container.textContent ?? "";
    // `Phiên bản 3` + nguon da dich. Truoc S3 dong nay in `command_center` raw.
    expect(text).toContain("Phiên bản 3");
    expect(text).toContain("Cấu hình trung tâm AI");
  });

  it("AC3.4 — o 'Nha cung cap hieu luc' hien ten provider, khong in `gemini`", async () => {
    // R9 (audit code vòng 5): provider **lạ** phải rơi về nhãn `unknown`, KHÔNG phải
    // `null` rồi in thô key. Bản đầu trả `null` ⇒ `t("anthropic")` → `undefined` →
    // UI in ra chính chuỗi enum, đúng loại lỗi S3 sinh ra để diệt.
    expect(providerLabelKey("gemini")).toBe("aiCommandCenter.provider.gemini");
    expect(providerLabelKey("khong_biet")).toBe("aiCommandCenter.provider.unknown");
    expect(getNestedValue(viDict, providerLabelKey("khong_biet"))).toBe("Nhà cung cấp khác");

    const { container } = renderHub();
    await waitFor(() => expect(container.querySelector("h1")).toBeTruthy());

    const text = container.textContent ?? "";
    expect(text).toContain("Google Gemini");
    // `gemini-3.8-flash` là TÊN MÔ HÌNH — để nguyên, không thuộc phạm vi enum provider.
    expect(text, "o provider van in key tho `gemini`").not.toMatch(/>gemini</);
  });
});
