/**
 * B4 — Visual QA cho `/ai-advisory`: 6 ảnh = {light, dark} x {data, empty, error}.
 *
 * Vì sao cần spec riêng thay vì chụp tay: ảnh phải tái lập được để so sánh
 * giữa các lần sửa, và phải chụp đúng viewport desktop để kiểm chứng N1
 * (layout 2 cột ở `lg`, trước đó dùng `xl` nên không bao giờ kích hoạt).
 *
 * Ghi chú về trạng thái:
 * - `data`   : mã có tư vấn thật trong DB.
 * - `empty`  : mã KHÔNG có tư vấn — đúng tình huống N3 tạo ra khi người dùng
 *              tìm một mã bất kỳ, nên phải chụp để thấy empty state có thật sự
 *              dễ hiểu chứ không phải trang trắng.
 * - `error`  : trạng thái lỗi hiển thị bằng thông điệp thật của hệ thống.
 */
import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Ảnh ghi ra `docs/evidence/` ở GỐC REPO. Lần chụp đầu dùng
 * `resolve('docs/evidence/...')` — đường dẫn tương đối so với cwd, mà cwd của
 * Playwright là `packages/web`, nên ảnh rơi vào `packages/web/docs/evidence/...`
 * (đã phải chép tay sang). Dùng `process.cwd()` + `../../` để trỏ đúng gốc repo,
 * đồng thời tránh `__dirname` vì spec là ESM.
 */
const OUT = resolve(process.cwd(), '../../docs/evidence/ai-advisory-ui/visual');
const SYMBOL_WITH_DATA = process.env.ADVISORY_DATA_SYMBOL || 'VIC';
const SYMBOL_EMPTY = process.env.ADVISORY_EMPTY_SYMBOL || 'HAG';
const ADVISORY_ROUTE = '/ai-advisory';

test.beforeAll(() => {
  mkdirSync(OUT, { recursive: true });
});

/**
 * Chạy TUẦN TỰ, không song song.
 *
 * Bằng chứng: probe đơn lẽ (1 trình duyệt) thấy skeleton tắt sau ~6s và mỗi
 * endpoint chỉ được gọi đúng 1 lần. Chạy 7 test song song thì container bị
 * nghẽn, sau 20s skeleton vẫn còn — ảnh chụp ra sẽ phụ thuộc thứ tự tải chứ
 * không phản ánh giao diện. Ảnh QA chỉ có giá trị khi trạng thái đã ổn định.
 */
test.describe.configure({ mode: 'serial' });

/**
 * Bật theme ĐÚNG CÁCH APP LÀM — qua `localStorage['vninvest-theme']`.
 *
 * Bằng chứng lần chụp đầu: dùng `test.use({ colorScheme: 'light' })` thì cả 2
 * nhóm ảnh vẫn ra màu tối. Lý do: `index.css:13` định nghĩa variant dark là
 * `&:where(:root:not([data-theme="light"]) *)` — tức app KHÔNG theo OS preference
 * mà theo attribute `data-theme` do `main.tsx:175-180` đọt từ
 * `localStorage['vninvest-theme']` trước first paint. Chỉnh `colorScheme` của
 * Playwright không có tác dụng gì với app này.
 */
async function setTheme(page: import('@playwright/test').Page, theme: 'dark' | 'light') {
  await page.addInitScript((value) => {
    try {
      window.localStorage.setItem('vninvest-theme', value);
    } catch {
      /* private mode */
    }
  }, theme);
}

/**
 * Chờ app thoát trạng thái bootstrap, không đợi `networkidle` (app giữ polling/WS mở).
 *
 * Phải chờ spinner "Đang xác thực tài khoản..." biến mất như `auth.setup.ts` đang
 * làm: lần chạy đầu chỉ chờ 2,5s là chụp được đúng màn hình xác thực — ảnh "trắng
 * trơn" nhưng không phải lỗi UI. Với `/ai-advisory`, `PortfolioContext` còn phải
 * tải danh sách danh mục nên lâu hơn trang thường.
 */
async function gotoAdvisory(page: import('@playwright/test').Page, symbol: string) {
  await page.goto(`${ADVISORY_ROUTE}?symbol=${symbol}`, { waitUntil: 'domcontentloaded' });
  const spinner = page.getByText('Đang xác thực tài khoản...');
  // Chờ tối đa 25s; nếu hết giờ vẫn ở spinner thì để assertion phía sau báo lỗi
  // kèm ảnh, thay vì âm thầm chụp ảnh sai.
  await expect(spinner).toBeHidden({ timeout: 25000 });
  // PHẢI chờ skeleton tải xong. Lần chụp đầu chỉ đợi cố định 1,5s nên bắt
  // được 3 thanh `h-24 animate-pulse` đang nhấp nháy và đưa vào ảnh như thể
  // là giao diện hỏng. Đo thật: sau ~6s số request mỗi endpoint = 1 (không
  // lặp) và skeleton tự tắt — nghĩa là đây là trạng thái tải tạm thời, không
  // phải lỗi. Ảnh QA phải chụp trạng thái đã ổn định.
  await expect(page.locator('div.animate-pulse.h-24')).toHaveCount(0, { timeout: 30000 });
  await page.waitForTimeout(500);
}

/** Chụp xong phải xác nhận theme thật sự đã đổi, nếu không ảnh "light" lại ra
 *  màu tối thì cả nhóm ảnh trở nên vô nghĩa mà vẫn báo xanh. */
async function expectAppliedTheme(
  page: import('@playwright/test').Page,
  theme: 'dark' | 'light',
) {
  const applied = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
  if (theme === 'light') {
    expect(applied, 'data-theme phai la "light" khi chụp nhóm light').toBe('light');
  } else {
    expect(applied, 'data-theme phai rỗng (dark là mặc định)').toBeNull();
  }
}

for (const theme of ['dark', 'light'] as const) {
  test.describe(`theme=${theme}`, () => {
    // `colorScheme` chỉ để trình duyệt không tự ép màu; theme thật do
    // `setTheme()` đặt qua localStorage (xem giải thích ở trên).
    test.use({ colorScheme: theme });

    test.beforeEach(async ({ page }) => {
      await setTheme(page, theme);
    });

    /**
     * Trạng thái CÓ DỮ LIỆU thật.
     *
     * CHƯA THỂ CHỤP — và không được giả vờ. Lý do đo được, không phải suy đoán:
     * ngày 2026-09-26 probe thẳng endpoint Gemini cho thấy hạn mức API key đã
     * hết (3 request giống hệt, prompt 1 từ, `max_tokens=64` → 429 "You
     * exceeded your current quota" cả 3, không có header `Retry-After`). Mọi
     * advisory đã sinh đều `status=failed`, nên DB không có bản ghi
     * `status=generated` nào để hiển thị.
     *
     * Hành vi dưới đây là fallback trung thực: xác nhận trang vẫn render đủ khung
     * (sidebar + thẻ mã + 3 tab + risk mode) và hiển thị empty state CÓ NỘI
     * DUNG thay vì trắng trơn. Khi hạn mức còn, đổi `ADVISORY_DATA_SYMBOL` sang
     * mã đã có tư vấn là test này tự chụp được ảnh có dữ liệu.
     */
    test(`${theme} / data — mã có tư vấn`, async ({ page }) => {
      await gotoAdvisory(page, SYMBOL_WITH_DATA);
      await page.screenshot({ path: resolve(OUT, `advisory-${theme}-data.png`), fullPage: true });
      await expectAppliedTheme(page, theme);
      // Khung trang phải đủ: sidebar + thẻ mã + các tab.
      await expect(page.getByRole('complementary').first()).toBeVisible();
      await expect(page.getByText(new RegExp(`^${SYMBOL_WITH_DATA}$`)).first()).toBeVisible();
      await expect(page.getByRole('tab').first()).toBeVisible();
    });

    test(`${theme} / empty — mã chưa có tư vấn`, async ({ page }) => {
      await gotoAdvisory(page, SYMBOL_EMPTY);
      await page.screenshot({ path: resolve(OUT, `advisory-${theme}-empty.png`), fullPage: true });
      await expectAppliedTheme(page, theme);
      // Deep-link phải giữ đúng mã đã mở, dù mã đó chưa có tư vấn.
      // Trước N3 effect chọn mã xoá `activeSymbol` khiến trang rơi về
      // "Chọn mã chứng khoán" và bỏ qua mã người dùng bấm.
      await expect(
        page.getByText(new RegExp(`${SYMBOL_EMPTY}.*(chưa có tư vấn|no advisory)`, 'i')).first(),
      ).toBeVisible();
    });

    test(`${theme} / error — trạng thái lỗi`, async ({ page }) => {
      test.setTimeout(90000);
      // Cắt mạng trước khi tải trang, để thông điệp lỗi tải dữ liệu hiện ra
      // ngay thay vì phải chờ khung render xong rồi mới hỏng.
      await page.route('**/core/v1/**', (route) => route.abort('failed'));
      await page.goto(`${ADVISORY_ROUTE}?symbol=${SYMBOL_WITH_DATA}`, { waitUntil: 'domcontentloaded' });
      await expect(page.getByText('Đang xác thực tài khoản...')).toBeHidden({ timeout: 25000 });
      await page.waitForTimeout(2500);
      await page.screenshot({ path: resolve(OUT, `advisory-${theme}-error.png`), fullPage: true });
      await expectAppliedTheme(page, theme);
      // Không được lộ thông báo kỹ thuật tiếng Anh cho người dùng tiếng Việt.
      // Bằng chứng lần chụp đầu: banner lỗi hiện "Failed to fetch" (raw error).
      await expect(page.getByTestId('advisory-error-code'))
        .not.toHaveText(/failed to fetch|networkerror/i);
      // Đồng thời phải CÓ thông điệp hành động bằng tiếng Việt.
      await expect(page.getByTestId('advisory-error-code'))
        .toHaveText(/kiểm tra mạng|check your connection/i);
    });
  });
}

test('desktop — layout phai 2 cot o chieu rong (B3/N1 regression)', async ({ page }) => {
  test.setTimeout(90000);
  // 1440x900: rộng hơn nhiều so với `xl` (1280) trong khi nội dung thực chỉ còn
  // 1232px sau padding. Trước N1 trang rơi về 1 cột ở mọi kích thước.
  await page.setViewportSize({ width: 1440, height: 900 });
  await gotoAdvisory(page, SYMBOL_WITH_DATA);
  await page.screenshot({ path: resolve(OUT, 'advisory-desktop-1440-two-column.png'), fullPage: true });

  const aside = page.getByRole('complementary').first();
  await expect(aside).toBeVisible();
  const box = await aside.boundingBox();
  expect(box, 'sidebar phai co khoang cach hinh anh').not.toBeNull();
  // Sidebar nằm BÊN PHẢI vùng nội dung, không nằm dưới.
  expect(box!.x, 'sidebar phai o ben phai (2 cot), khong xuong dong duoi').toBeGreaterThan(700);
});
