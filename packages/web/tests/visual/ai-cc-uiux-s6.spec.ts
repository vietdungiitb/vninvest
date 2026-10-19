/**
 * S6 — chụp ảnh THẬT `/settings/ai` trên staging sau khi deploy #267.
 *
 * Mục đích: thứ mà test component KHÔNG kiểm chứng được — cảm giác thị giác.
 * Đây là bằng chứng cho phần Owner nói "làm nốt đi" (mục 1).
 *
 * Bằng chứng cần có trong ảnh (theo thứ tự):
 *   1. đúng MỘT thanh tab (không còn 2 thanh chồng)
 *   2. breadcrumb "Cài đặt tài khoản / Trung tâm AI" + H1 "Trung tâm điều hành AI"
 *   3. KHÔNG còn eyebrow "Cài đặt" ở trên h1
 *   4. panel "Chính sách vận hành" chỉ còn 1 card + badge "Chỉ đọc" dạng chip
 *   5. panel riêng "Tuỳ chọn cá nhân" có toggle
 *   6. SummaryCard hiện "Google Gemini" + "Cấu hình trung tâm AI" (KHÔNG phải `gemini` / `command_center`)
 *
 * Chạy:
 *   PLAYWRIGHT_BASE_URL=https://docker.edusuccess.vn npx playwright test ai-cc-uiux-s6 --project=chromium
 */
import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const OUT = resolve(process.cwd(), '../../docs/evidence/ai-cc-uiux');
const LOAD = { waitUntil: 'domcontentloaded' } as const;

test.beforeAll(() => mkdirSync(OUT, { recursive: true }));

// KHÔNG login thu công. Project `chromium` trong `playwright.config.ts` đã có
// `storageState: tests/visual/.auth/user.json` + `dependencies: ['setup']` — mọi
// spec khác (vd `ai-hub-nav-r51.spec.ts`) đều dựa vào đó.
//
// Lần đầu spec này tự `goto('/login')` + fill + submit rồi `goto('/settings/ai')`
// ⇒ trang kẹt vĩnh viễn ở "Đang xác thực tài khoản...". Đây là hậu quả của
// **reload đầy đủ** khiến bootstrap `PortfolioContext` không thả cổng auth — đúng
// lỗi W1 mà `auth.setup.ts` ghi lại, KHÔNG phải lỗi của thay đổi UI/UX lần này.
// Bằng chứng: ảnh `test-failed-1.png` chỉ có dòng spinner, không có markup trang.

/** Chờ app thoát trạng thái đang nạp + CÓ nội dung thật (L-V05: ảnh phải là bằng chứng). */
async function ready(page: import('@playwright/test').Page) {
  await page.locator('.loading-subtext').waitFor({ state: 'hidden', timeout: 30_000 }).catch(() => {});
  await expect(page.locator('h1')).toBeVisible({ timeout: 45_000 });
  await expect(page.getByText('NHÀ CUNG CẤP HIỆU LỰC')).toBeVisible({ timeout: 30_000 });
}

test('S6: /settings/ai — 1 he dieu huong, tach lop ca nhan/he thong, nhan da dich', async ({ page }) => {
  await page.goto('/settings/ai', LOAD);
  await ready(page);

  // (1) DUNG MOT he dieu huong: nav co aria-label "Trung tâm điều hành AI" phai = 1.
  const labelledNavs = page.locator('nav[aria-label="Trung tâm điều hành AI"]');
  await expect(labelledNavs, 'so nav mang nhan trang').toHaveCount(1);

  // (2) Bay tab route van day du (staff => 5).
  const hub = labelledNavs.first();
  const hrefs = await hub.locator('a').evaluateAll((els) => els.map((e) => e.getAttribute('href')));
  expect(hrefs, `tab: ${JSON.stringify(hrefs)}`).toEqual([
    '/settings/ai', '/settings/ai/usage', '/settings/ai/traces', '/settings/ai/slo', '/settings/ai/audit',
  ]);

  // (3) Chi MOT muc dang to sang — truoc day hai o "Tong quan" cung sang.
  const activeCells = page.locator('nav a[class*="hubNavLinkActive"]');
  await expect(activeCells, 'so muc dang to sang').toHaveCount(1);

  // (4) Breadcrumb dung ten ngan, H1 giu ten dai.
  // ⚠ Trên CHÍNH trang `/settings/ai`, crumb cuối render là `<span>` chứ không phải
  // `<a>` (`Breadcrumb.tsx` chỉ `to` các crumb cha). Nên ở đây kiểm **text** của
  // breadcrumb, không kiểm `a[href="/settings/ai"]` — selector đó chỉ đúng khi
  // đứng ở sub-route (`/settings/ai/slo` …), và dùng sai sẽ đỏ vì lý do sai (L-V04).
  const bc = page.locator('nav.breadcrumb');
  await expect(bc).toContainText('Cài đặt tài khoản');
  await expect(bc).toContainText('Trung tâm AI');
  await expect(bc, 'breadcrumb van dung ten nhom thay vi ten trang').not.toContainText('Trí tuệ nhân tạo');
  // GHI NHẬN (không sửa ở slice này): trang có **2** thẻ `h1`. Đây là điều kiện có
  // sẵn của layout — `docs/audit-uiux/UIUX_AUDIT_20261007.md` §4 đã nêu "shell đã
  // render h1" và cảnh báo sửa theo đếm số sẽ tạo trang có hai h1. Sửa thuộc AppShell
  // ⇒ ngoài SCOPE, ghi vào báo cáo.
  //
  // Đọc mảng text TRƯỚC rồi assert trên mảng: `expect(locator('h1'))` với >1 phần tử
  // là **strict-mode violation** dù chỉ cần `toContainText` — đã vấp 2 lần.
  const h1Texts = await page.locator('h1').allInnerTexts();
  console.log('SO h1 TREN TRANG = ' + h1Texts.length + ' | ' + JSON.stringify(h1Texts));
  expect(
    h1Texts.some((t) => t.includes('Trung tâm điều hành AI')),
    `h1 cua trang phai la "Trung tâm điều hành AI", thuc te: ${JSON.stringify(h1Texts)}`,
  ).toBe(true);

  // (5) KHONG con eyebrow "Cài đặt" (trung khai niem voi breadcrumb "Cài đặt tài khoản").
  const header = page.locator('header').first();
  await expect(header).not.toContainText('Cài đặt');

  // (6) Enum da dich — KHONG con chuoi tho.
  // Chup ANH TRUOC khi assert chuoi: neu assert do lai do lai mo ta hieu sai, anh van
  // la bang chung de nhin. L-V05: exit 0 khong chung minh duoc gi — phai MO ANH ra xem.
  await page.screenshot({ path: resolve(OUT, '01-settings-ai-after.png'), fullPage: true });
  await page.screenshot({ path: resolve(OUT, '02-nav-va-tong-quan.png'), clip: { x: 0, y: 0, width: 1600, height: 900 } });

  const body = await page.locator('body').innerText();
  console.log('SO KY TU body.innerText = ' + body.length);

  // KHÔNG assert "Google Gemini": account `testuser` trên staging **chưa có cấu
  // hình AI** (ảnh 01 cho thấy ô provider = "—", model = "Cần cấu hình", ô "NGUỒN
  // HIỆU LỰC" = "Cấu hình trung tâm AI"). Không có dữ liệu thì không có provider để
  // dịch — assert sẽ đỏ vì **lý do sai**, tức lại thành test vô dụng (L-V04).
  // Phần nhãn provider ĐÃ chứng minh bằng test component chạy trên dict thật
  // (`ai-cc-enum-labels.component.test.tsx` AC3.1 + AC3.4).
  expect(body, 'con in enum tho `command_center`').not.toContain('command_center');
  expect(body, 'con in enum tho `gemini`').not.toMatch(/(^|\s)gemini(\s|$)/i);
  // Nhãn nguồn ĐÃ dịch và hiện ngay trên trang — đây là bằng chứng thị giác cho S3.
  expect(body, 'o "Nguon hieu luc" chua duoc dich').toContain('Cấu hình trung tâm AI');
  // Ghi rõ trạng thái môi trường để người đọc không tưởng test bỏ sót.
  console.log('CAU HINH AI TREN STAGING = ' + (body.includes('Cần cấu hình') ? 'CHUA CO (testuser chua dat)' : 'CO'));

  // (7) Panel tach lop: "Chinh sach van hanh" KHONG con "Gate su kien";
  //     "Gate su kien" nam trong panel "Tuy chon ca nhan".
  const policyPanel = page.locator('article', { hasText: 'Chính sách vận hành' }).first();
  await expect(policyPanel).not.toContainText('Gate sự kiện');
  await expect(policyPanel.getByText('Chỉ đọc')).toBeVisible();
  await expect(policyPanel).not.toContainText('Khoảng làm mới');
  await expect(policyPanel).not.toContainText('Token/ngày');

  const personal = page.locator('article', { hasText: 'Tuỳ chọn cá nhân' }).first();
  await expect(personal.getByText('Gate sự kiện')).toBeVisible();

  // Anh cuoi cung la bang chung (sau khi da qua het kiem tra noi dung).
  await page.screenshot({ path: resolve(OUT, '03-verified.png'), fullPage: true });
});
