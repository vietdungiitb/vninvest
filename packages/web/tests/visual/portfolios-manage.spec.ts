/**
 * E2E `/portfolios/manage` — chạy trên trình duyệt thật, dữ liệu thật.
 *
 * ── Vì sao file này tồn tại ────────────────────────────────────────────
 * Claim `pf-manage-rebuild` (2026-10-13) ghi rõ một mục CHƯA CHẠY:
 * *"chưa thêm spec Playwright nào vào repo; probe viết ở thư mục tạm"* — nghĩa
 * là kiểm chứng E2E chỉ tồn tại trong một phiên làm việc, người sau không lặp
 * lại được. File này biến nó thành gate.
 *
 * Nó cũng là nơi chứng minh **2 lỗi mà test component không bắt được** và
 * **1 lỗi chỉ lộ ra khi đo trên nền thật** (xem `## Entry 282` §6, §9):
 *   ① nhãn phân trang luôn nói sai (do `defaultValue` bị bỏ qua);
 *   ② `cash_note` kỹ thuật của BE lộ thẳng vào UI;
 *   ③ light mode: trang không vẽ nền riêng ⇒ chữ bảng rơi xuống nền app shell
 *      (tối) trong khi token đã đổi sang màu tối ⇒ tương phản ~1.1:1.
 *
 * ── Vì sao KHÔNG chụp screenshot ───────────────────────────────────────
 * `page.screenshot({ path })` mà ghi vào repo = **mutate working tree** khi
 * chạy suite (L-V03). Vì vậy spec này **không** dùng `toHaveScreenshot`;
 * chỉ assert trên DOM + `getComputedStyle`.
 *
 * ── Cách chạy ───────────────────────────────────────────────────────────
 *   PLAYWRIGHT_BASE_URL=https://docker.edusuccess.vn npx playwright test \
 *     tests/visual/portfolios-manage.spec.ts --project=chromium
 *   (auth state lấy từ `tests/visual/auth.setup.ts` — user `testuser`)
 */
import { test, expect } from '@playwright/test';

/**
 * Chờ cổng bootstrap của app (`ProtectedRoute` → `PortfolioContext`) mở ra.
 *
 * `storageState` chỉ chứa cookie/localStorage — app vẫn phải chạy lại
 * `syncAuthState()` + `fetchUserConfig()` mỗi lần tải trang. Nếu không chờ,
 * `toBeHidden('Đang tải danh mục...')` **trượt qua ngay** (chuỗi đó chưa từng
 * xuất hiện) rồi assert chạy trên trang chưa render ⇒ lỗi sai bản chất.
 */
async function waitForAppReady(page: import('@playwright/test').Page) {
  await expect(page.getByText(/Đang xác thực tài khoản/)).toBeHidden({ timeout: 30_000 });
}

/**
 * Chờ trang sẵn sàng.
 *
 * KHÔNG được chỉ `toBeHidden('Đang tải danh mục...')`: trang là lazy chunk
 * (`pageRegistry.js:221-222`), nên lúc `goto` xong chuỗi đó **chưa tồn tại**
 * trong DOM ⇒ `toBeHidden` trượt qua ngay lập tức và assert chạy trên trang
 * trắng. Thứ tự đúng: đợi `h1` (render xong) → đợi hết trạng thái loading →
 * phải thấy BẢNG **hoặc** empty state.
 */
async function waitForList(page: import('@playwright/test').Page) {
  await waitForAppReady(page);
  await expect(page.getByRole('heading', { name: 'Quản lý danh mục' })).toBeVisible({
    timeout: 60_000,
  });
  await expect(page.getByText('Đang tải danh mục...')).toBeHidden({ timeout: 60_000 });
  await expect
    .poll(async () => {
      const rows = await page.locator('table thead th').count();
      const empty = await page.getByText('Chưa có danh mục nào.').count();
      return rows + empty;
    }, { timeout: 60_000 })
    .toBeGreaterThan(0);
}

test.describe('/portfolios/manage — quản lý danh mục', () => {
  // Mặc định của Playwright là 30 s. Trang này nối 1 request danh sách + N
  // request `summary` song song + lazy chunk; đo thật trên VPS staging từ máy
  // dev cần ~40-55 s cho lần tải đầu (bundle lạnh sau deploy).
  test.setTimeout(120_000);

  test.beforeEach(async ({ page }) => {
    await page.goto('/portfolios/manage', { waitUntil: 'domcontentloaded' });
    await waitForList(page);
  });

  test('hiện đủ 8 cột tiền thật, không phải bảng 4 cột cũ', async ({ page }) => {
    // Bảng cũ chỉ có Tên / Số dư mở đầu / Ngày tạo / Thao tác.
    const headers = await page.locator('table thead th').allInnerTexts();
    const joined = headers.join(' | ');
    for (const col of [
      'TÊN DANH MỤC',
      'GIÁ TRỊ THỊ TRƯỜNG',
      'GIÁ VỐN',
      'LÃI/LỖ CHƯA THỰC HIỆN',
      'MÃ ĐANG GIỮ',
      'NGÀY TẠO',
      'SỐ LIỆU CẬP NHẬT',
      'THAO TÁC',
    ]) {
      expect(joined).toContain(col);
    }
  });

  test('① nhãn phân trang ở trang đầu phải là "Trang đầu tiên"', async ({ page }) => {
    // Regression: `t(key, { defaultValue: cond ? A : B })` bị `createTranslator`
    // bỏ qua khi key ĐÃ có trong dictionary ⇒ trang đầu hiện nhầm "Đang xem
    // trang sau". Test component không bắt được vì cả hai nhánh đều ra text hợp lệ.
    await expect(page.locator('.pfm-pager__label')).toHaveText(/Trang đầu tiên/);
  });

  test('trang danh mục KHÔNG nhúng panel đặt lệnh broker', async ({ page }) => {
    // Panel broker đã tách sang /portfolios/manage/broker (D-36).
    await expect(page.locator('.dnse-panel')).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Kết nối broker' })).toBeVisible();
  });

  test('/portfolios/manage/broker mới là nơi có panel broker', async ({ page }) => {
    await page.goto('/portfolios/manage/broker', { waitUntil: 'domcontentloaded' });
    await waitForAppReady(page);
    await expect(page.getByRole('heading', { name: 'Kết nối broker & đặt lệnh' })).toBeVisible({
      timeout: 60_000,
    });
    await expect(page.locator('.dnse-panel')).toHaveCount(1);
    // Panel có i18n: nhãn tiếng Anh khi chuyển locale (fail-before: cả panel
    // tiếng Việt cứng vì file không import LangContext).
    await expect(page.getByRole('link', { name: /Về quản lý danh mục/ })).toBeVisible();
  });

  test('③ light mode: trang tự vẽ nền, chữ không chìm xuống nền shell', async ({ page }) => {
    await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'));
    await page.waitForTimeout(400);

    const measured = await page.evaluate(() => {
      const parse = (s: string) => (s.match(/[\d.]+/g) || []).slice(0, 3).map(Number);
      const lum = (rgb: number[]) => {
        const c = rgb.map((v) => {
          const x = v / 255;
          return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
        });
        return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
      };
      const ratio = (a: number[], b: number[]) => {
        const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
        return (hi + 0.05) / (lo + 0.05);
      };
      const cell = document.querySelector('.pfm-table tbody td') as HTMLElement | null;
      if (!cell) return null;
      // Nền phải lấy từ `.pfm-table-wrap` — KHÔNG rơi xuống app shell.
      const wrap = cell.closest('.pfm-table-wrap') as HTMLElement;
      return {
        ratio: Number(ratio(parse(getComputedStyle(cell).color), parse(getComputedStyle(wrap).backgroundColor)).toFixed(2)),
        wrapBg: getComputedStyle(wrap).backgroundColor,
      };
    });

    // Không có bảng khi user chưa có danh mục — bỏ qua thay vì fail giả.
    test.skip(measured === null, 'user chưa có danh mục nào');
    // WCAG 2.2 AA = 4.5:1 cho chữ thường.
    expect(measured!.ratio).toBeGreaterThanOrEqual(4.5);
  });

  test('trang có KPI tổng tiền', async ({ page }) => {
    // `.pfm-kpi__label` chứ không dùng `getByText` trần: "Lãi/lỗ chưa thực
    // hiện" có ở CẢ nhãn KPI lẫn nút sort của bảng ⇒ strict-mode violation.
    await expect(page.locator('.pfm-kpi__label').filter({ hasText: 'TỔNG GIÁ TRỊ DANH MỤC' })).toBeVisible();
    await expect(page.locator('.pfm-kpi__label').filter({ hasText: 'TỔNG GIÁ VỐN' })).toBeVisible();
    await expect(page.locator('.pfm-kpi__label').filter({ hasText: 'LÃI/LỖ CHƯA THỰC HIỆN' })).toBeVisible();
    // Ô số tiền phải là số có phân tách nghìn, không phải `—`.
    await expect(page.locator('.pfm-kpi__value').first()).not.toHaveText('—');
  });

  test('② drawer vị thế không lộ ghi chú kỹ thuật của backend', async ({ page }) => {
    const firstRow = page.locator('table tbody tr').first();
    test.skip((await firstRow.count()) === 0, 'user chưa có danh mục nào');
    await firstRow.getByRole('button', { name: 'Chi tiết' }).click();

    const drawer = page.getByRole('dialog');
    await expect(drawer).toBeVisible();
    // `cash_note` từ BE là câu kỹ thuật dài 2 cây — không được hiện cho user.
    await expect(drawer).not.toContainText(/cash = tổng dòng tiền gom từ Transaction/);
    await drawer.getByRole('button', { name: 'Đóng' }).last().click();
  });

  /**
   * ④ Regression: panel drawer/modal phải **ĐỤC** ở dark mode.
   *
   * Fail-before (đo thật trên staging trước khi sửa):
   *   `.pfm-drawer__panel` background = `rgba(8, 23, 52, 0.4)` ⇒ 40% trong suốt
   *   ⇒ trang phía sau lọt qua, hai lớp chữ chồng lên nhau (ảnh Owner báo).
   *   `.pfm-drawer` box = `(0,0,1280x720)` đúng viewport và `elementFromPoint`
   *   ở top-left/mid-left/bottom-left đều trả `DIV.pfm-drawer` ⇒ **overlay KHÔNG
   *   hỏng**; chỉ panel mỏng. Nên phải đo **panel**, không đo overlay.
   *
   * CONTROL cùng trang (L-V01): `.pfm-kpi__card` là thẻ kính **cố ý** 0.4.
   * Nếu phép đo của ta trả alpha = 1 cho nó ⇒ bộ đo hỏng ⇒ mọi dòng cùng lô
   * vô giá trị, phải dừng chứ không kết luận "đã hết lỗi".
   */
  test('④ panel drawer/modal ĐỤC ở dark mode — có control chứng minh phép đo chạy', async ({
    page,
  }) => {
    const firstRow = page.locator('table tbody tr').first();
    test.skip((await firstRow.count()) === 0, 'user chưa có danh mục nào');
    await firstRow.getByRole('button', { name: 'Chi tiết' }).click();
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 30_000 });

    const measured = await page.evaluate(() => {
      const alphaOf = (sel: string): number | null => {
        const el = document.querySelector(sel) as HTMLElement | null;
        if (!el) return null;
        const m = /rgba?\(([^)]*)\)/.exec(getComputedStyle(el).backgroundColor);
        if (!m) return 1;
        const parts = m[1].split(/[\s,/]+/).filter(Boolean);
        if (parts.length < 4) return 1;
        const a = Number(parts[3]);
        return Number.isFinite(a) ? a : 1;
      };
      return {
        theme: document.documentElement.getAttribute('data-theme'),
        drawerPanel: alphaOf('.pfm-drawer__panel'),
        kpiCard: alphaOf('.pfm-kpi__card'),
      };
    });

    // CONTROL trước. Thẻ KPI là kính 0.4 — đo ra 1 nghĩa là phép đo hỏng.
    expect(
      measured.kpiCard,
      `CONTROL hỏng: .pfm-kpi__card phải đo ra ~0.4, thấy ${measured.kpiCard} (theme=${measured.theme}) — phép đo không đáng tin, DỪNG.`,
    ).toBeLessThan(0.9);

    expect(
      measured.drawerPanel,
      `.pfm-drawer__panel phải ĐỤC (alpha=1), thấy ${measured.drawerPanel}`,
    ).toBe(1);
  });

  /** ⑤ Tab "Theo dõi": giao của vị thế và danh sách theo dõi. */
  test('⑤ drawer có tab "Theo dõi" và giải thích vì sao là giao hai tập', async ({ page }) => {
    const firstRow = page.locator('table tbody tr').first();
    test.skip((await firstRow.count()) === 0, 'user chưa có danh mục nào');
    await firstRow.getByRole('button', { name: 'Chi tiết' }).click();

    const drawer = page.getByRole('dialog');
    await expect(drawer).toBeVisible();
    await expect(drawer.getByRole('tab', { name: /Vị thế đang giữ/ })).toBeVisible();
    await expect(drawer.getByRole('tab', { name: /Theo dõi/ })).toBeVisible();

    await drawer.getByRole('tab', { name: /Theo dõi/ }).click();
    await expect(drawer.getByRole('tab', { name: /Theo dõi/ })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    // Bắt buộc nói rõ watchlist thuộc tài khoản chứ không thuộc danh mục —
    // Watchlist không có FK tới Portfolio (user_workspace/models.py:209-253).
    await expect(drawer.getByText(/dùng chung cho mọi danh mục/)).toBeVisible();
  });
});