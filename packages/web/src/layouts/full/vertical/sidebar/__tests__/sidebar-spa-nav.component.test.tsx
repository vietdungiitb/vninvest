/**
 * Sidebar SPA navigation — menu phải điều hướng trong SPA, KHÔNG reload cả trang.
 *
 * Bối cảnh: menu item render `e('a', { href: item.path, onClick: () => onMobileClose() })`
 * (Sidebar.tsx) — click = full page reload = toàn bộ app remount = bootstrap
 * chạy lại = full-screen "Đang xác thực tài khoản..." (ProtectedRoute,
 * main.tsx:88-96) trên MỖI lần chuyển trang + mất hết state client.
 *
 * Test QUÉT NGUỒN (không render): assert handler chặn hành vi mặc định của
 * thẻ <a> và gọi `navigate()` của react-router. Pattern giống S19-S21
 * (vnstock-chart-panel.data-unlock.component.test.ts).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const SIDEBAR_SRC = resolve(HERE, "..", "Sidebar.tsx");

describe("Sidebar — SPA navigation (không reload cả trang)", () => {
  it("T1 — onClick menu chặn reload mặc định của thẻ <a>", () => {
    const src = readFileSync(SIDEBAR_SRC, "utf8");
    // Regex "có chủ" (gắn với biến event) để KHÔNG khớp comment.
    expect(src).toMatch(/ev\.preventDefault\(\)/);
  });

  it("T2 — onClick menu điều hướng bằng navigate(item.path)", () => {
    const src = readFileSync(SIDEBAR_SRC, "utf8");
    expect(src).toMatch(/navigate\(item\.path\)/);
  });

  it("T3 — giữ href để vẫn copy-link / mở tab mới được", () => {
    const src = readFileSync(SIDEBAR_SRC, "utf8");
    expect(src).toMatch(/href:\s*item\.path/);
  });

  it("T4 — KHÔNG chặn mở-tab-mới (modifier-click / middle-click đi đường mặc định)", () => {
    const src = readFileSync(SIDEBAR_SRC, "utf8");
    // Neo đầu-dòng (multiline) để KHÔNG khớp comment giải thích.
    expect(src).toMatch(/^\s*if \(ev\.metaKey \|\| ev\.ctrlKey \|\| ev\.shiftKey \|\| ev\.altKey \|\| ev\.button !== 0\) return;$/m);
  });
});
