# AI R4.4 — `/settings/ai` trong UserSettingsPage + breadcrumb 3 mức

**Claim**: `ai-r44` · **Nhánh**: `feat/ai-r44-settings-ai-nav` → `dev` · **Ngày**: 2026-10-18
**PR**: #245 (`0bcb015bd`)
**Plan**: `docs/IMPLEMENTATION_PLAN_AI_COMMAND_CENTER_COMMERCIAL_20260925.md:1225-1235`

## Kết quả AC

| # | Điều kiện | Bằng chứng | AC |
|---|---|---|---|
| AC1 | `UserSettingsPage` render link `/settings/ai` trong nhóm "Trí tuệ nhân tạo" | `user-settings-ai-link.component.test.tsx` 3/3 · **ảnh staging** `visual/01-settings.png` thấy rõ khối "Trí tuệ nhân tạo" + "Mở trung tâm AI" | ✅ |
| AC2 | Breadcrumb quay `/settings` trên **mọi** route AI CC | `ai-hub-breadcrumb.component.test.tsx` 5/5 (quét source 5 trang + test DOM) · **ảnh** `visual/03-ai-slo-tab.png`: `Cài đặt tài khoản / Trí tuệ nhân tạo / slo` | ✅ |
| AC3 | Ảnh 3 mức điều hướng | `visual/01-settings.png`, `02-ai-hub.png`, `03-ai-slo-tab.png` — chụp bằng Playwright trên **staging sau khi deploy** | ✅ |

## Đo trước khi viết — AC2 hóa ra là *thiếu*, không phải *sai nhãn*

- **Không trang AI CC nào render `Breadcrumb`** (grep 5 trang). AC2 không phải "sửa nhãn
  quay về `/settings`" mà là **chưa có** breadcrumb ở đâu cả.
- `Breadcrumb.tsx` (93 dòng) **đã có** logic dựng crumb từ đường dẫn; thiếu đúng 2 thứ:
  ánh xạ `settings`/`ai` trong `I18N_MAP`, và điều kiện nhận diện khoá i18n.
- Điều kiện cũ chỉ nhận khoá bắt đầu bằng `tenant`/`shell`, nên mọi khoá dạng `a.b.c`
  bị **in ra tên khoá thay vì nhãn**. Đã mở rộng thành "có dấu chấm **hoặc** bắt đầu
  `tenant`/`shell`" — tương thích ngược với `TenantAdminLayout` (người dùng hiện tại
  duy nhất của `Breadcrumb`).
- Dùng **cùng một khoá** `userSettings.aiGroup.title` cho cả nhóm trong `/settings` lẫn
  crumb `ai`, vì `aiCommandCenter.title` là *"Trung tâm điều hành AI"* — để breadcrumb gọi
  một tên còn menu gọi tên khác là bug nhãn, không phải khác biệt vô hại.

## AC3 tốn 3 lần chụp — và lý do mỗi lần đều **xanh giả**

Đây là phần đáng ghi nhất của slice, vì **cả 3 lần đều PASS** trong khi ảnh vô dụng:

1. **Lần 1** — chụp ngay sau `waitForSelector` ⇒ ảnh chỉ có dòng *"Đang tải cài đặt
   tài khoản..."*. Test xanh vì `assert` chạy **sau** ảnh và đã đợi DOM.
2. **Lần 2** — chuyển assert **trước** ảnh ⇒ ảnh vẫn bị overlay lazy-load
   (`.loading-subtext`, "Route … đang được nạp động") phủ. Test xanh.
3. **Lần 3** — thêm `waitForSelector('[data-testid="user-settings-ai-group"]')` và
   bỏ selector `a[href="/settings/ai"]` ⇒ ảnh mới đúng.

Hai nguyên nhân gốc, đều là dạng lỗi đã có lesson nhưng chưa bị áp:

- **Chụp trước khi nội dung có** ⇒ ảnh là bằng chứng của trạng thái *đang tải*. Sửa: chờ
  nội dung → chụp → assert.
- **`a[href="/settings/ai"]` khớp cả link điều hướng toàn cục trên layout** ⇒ selector
  "đúng đường dẫn" nhưng **sai chỗ**, vẫn xanh khi trang chưa render. Đây là `L-V04` ở dạng
  hình ảnh: *đúng đường dẫn ≠ đúng chỗ*. Sửa: dùng `data-testid` chỉ dành cho khối
  trong trang.

Đây là lần thứ hai trong ngày tôi tự phát hiện xanh giả do **selector/điều kiện** chứ
không phải do code sai (lần đầu là URL sai ở R4.2) — đủ để coi là dấu hiệu hệ thống:
**phải mở ảnh ra xem**, không tin exit code.

## Gates

| Gate | Kết quả |
|---|---|
| FE mới `user-settings-ai-link.component.test.tsx` | **3/3 OK** (fail-before 3/3 đỏ) |
| FE mới `ai-hub-breadcrumb.component.test.tsx` | **5/5 OK** (fail-before 5/5 đỏ) |
| FE hồi quy `pages/__tests__` + `components/__tests__` | 59 file · **372/372 OK** |
| `tsc --noEmit` | exit 0 |
| `npm run build` | exit 0 (`built in 44.07s`) |
| `eslint` (7 file) | 0 error, 60 warning (`react/jsx-no-literals` — nhiễu nền) |
| `i18n:scan` | exit 0, không sửa file dịch |
| Playwright `ai-settings-nav` trên staging | **4 passed** (3 mức + setup) |

## Hai bẫy test đã mắc (đều là lỗi của test, không phải của code)

- `LangProvider` gọi `usePortfolio()` và **ném** nếu thiếu provider
  (`LangContext.js:31`) ⇒ cả 2 file test ban đầu **throw trước khi render**, mọi assert
  đỏ vì lý do sai. Đã mock `PortfolioContext`.
- Mock `coreApiAdapter` sai **tên hàm**: trang dùng `getUserProfile`/`updateUserProfile`/
  `changeUserPassword` (`UserSettingsPage.tsx:68,131,158`), tôi đặt `getUserConfig` ⇒
  `getUserProfile is not a function` ⇒ trang crash.
- Trang nạp dữ liệu bằng `useEffect` ⇒ assert **đồng bộ** thấy trạng thái "đang tải".
  Đã chuyển sang `waitFor`.

## Còn mở

- **R4.5** (phân quyền hiển thị tab trong `AiHubNav`) còn nguyên: hiện `AiHubNav` chỉ dùng ở
  2/5 trang AI (Traces, SLO); Agents/Usage là trang legacy. R4.4 **cố ý** không đụng phần đó.
- `/settings/ai` breadcrumb ở mức 2 hiện là crumb cuối (không phải link) — đúng hành vi
  breadcrumb, chưa cần link tới chính nó.
- Ảnh chụp trên staging với tài khoản `testuser` — **không** phải dữ liệu thật; AC3 cần
  3 mức điều hướng nên mức này là đủ.