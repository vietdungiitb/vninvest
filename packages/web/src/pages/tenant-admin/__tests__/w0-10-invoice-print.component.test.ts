/**
 * W0.10 — gap-1 (FE) + gap-3 (allowlist của gate contract).
 *
 * - **gap-1**: BE **không có** route tải hoá đơn PDF và image staging **không có**
 *   thư viện PDF nào (đã probe VPS: reportlab/xhtml2pdf/weasyprint/fpdf/PIL đều
 *   "no") ⇒ FE không được gọi URL BE không tồn tại; phải **in trực tiếp** từ dữ
 *   liệu hoá đơn đã có.
 * - **gap-3**: app `ai_agents` **rỗng** (0 route) nhưng FE UI `AISliceE` **vẫn
 *   gọi** ⇒ 404 thật trên UI ⇒ allowlist của gate phải **giữ đúng 1 mục**; xoá
 *   mục nào là xoá lỗi 404 đang được cover bằng cách im lặng.
 *
 * Test **đọc nguồn** (cùng pattern với `commercial-page.component.test.tsx`):
 * widget/BE không mock được trong jsdom, nhưng assert được hợp đồng mà FE dùng.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const BILLING_SRC = resolve(HERE, "..", "TenantAdminBillingPage.tsx");
const CONTRACT_SRC = resolve(
  HERE,
  "..",
  "..",
  "..",
  "adapters",
  "core",
  "__tests__",
  "route-contract.test.js",
);

const billing = readFileSync(BILLING_SRC, "utf8");
const contract = readFileSync(CONTRACT_SRC, "utf8");

describe("W0.10 — gap-1: hoa don in truc tiep, khong goi URL BE khong ton tai", () => {
  it("khong con goi endpoint /pdf/ (BE khong co route do)", () => {
    expect(billing).not.toContain("/pdf/");
  });

  it("co buildInvoicePrintHtml + window.print()", () => {
    expect(billing).toContain("buildInvoicePrintHtml");
    expect(billing).toContain(".print()");
  });

  it("khong goi window.open voi duong dan thieu /core/v1", () => {
    // Bug 2 cua cung cho: window.open("/partner/...") tro ve server FE, khong phai BE.
    const opens = billing.match(/window\.open\(\s*[`"']([^`"']+)/g) || [];
    for (const call of opens) {
      expect(call).toContain("/core/v1/");
    }
  });
});

describe("W0.10 — gap-3: allowlist chi con dung 1 gap that", () => {
  it("van giu gap /ai/agents/ trong allowlist (FE UI van goi)", () => {
    expect(contract).toContain("ai/agents");
  });

  it("da bo gap da dong (billing pdf + service-accounts detail)", () => {
    expect(contract).not.toContain("partner/billing/invoices");
    expect(contract).not.toContain("partner/service-accounts");
  });
});
