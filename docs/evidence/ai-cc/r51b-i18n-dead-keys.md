# AI R5.1b — dọn khoá i18n chết + sửa drift parity có sẵn

**Claim**: `ai-r51b` · **Nhánh**: `feat/ai-r51b-i18n-dead-keys` → `dev` · **Ngày**: 2026-10-18
**Kế thừa**: R5.1 đã gỡ trang Agents nhưng **bỏ sót toàn bộ khoá i18n** của nó.

## AC

| # | Điều kiện | Bằng chứng |
|---|---|---|
| AC1 | Không còn khoá chết của trang Agents | 5 đường dẫn xoá, **63 key/locale** |
| AC2 | Test khoá trạng thái "đã dọn" + chống xoá nhầm | `ai-dead-keys-r51b.component.test.ts` (6 test): khoá **mặt** (4 path) và **lưng** (12 key anh viện) |
| AC3 | Parity 2 locale | `layout.nav` + `routes` cùng tập key ở cả vi/en |
| AC4 | Không xoá nhầm | Kiểm chứng **object diff** HEAD↔working: `63 xoá / 2 thêm (parity fix) / 0 đổi giá trị` mỗi locale |

## Nội dung đã xoá (đo trước, grep 0-hit)

| Đường dẫn | Số key | Bằng chứng "chết" |
|---|---|---|
| `aiAgentFederation` (namespace) | 36 × 2 locale | grep `packages/web/src` chỉ còn test + i18n |
| `agentFederation` (namespace trùng tên) | 24 × 2 locale | `git grep -c` **toàn repo**: chỉ 2 file định nghĩa + tài liệu lịch sử, **0 call site** |
| `layout.nav.aiAgentFederation` | 1 × 2 | nhãn sidebar của trang đã gỡ |
| `routes.aiAgentFederation` | 1 × 2 | nhãn breadcrumb của trang đã gỡ |
| `aiCommandCenter.tabAgents` | 1 × 2 | `AiHubNav.tsx` còn 5 `labelKey`, **không có** `tabAgents` |

Tổng: **63 key × 2 locale = 126**, cộng 18 dòng snapshot EN trong `AISliceE` và 26 dòng
test `E-AC2` (render panel đã xoá) + 1 import.

## Sửa thêm: drift parity có sẵn (không phải do slice này)

Test mới phát hiện `routes.aiTraces` / `routes.aiSlo` **chỉ có ở `en.js`** ⇒ breadcrumb
route Traces/SLO bị lệch key giữa 2 locale. Đã chèn vào `routes` của `vi.js` với giá trị
**lấy nguyên văn** từ `layout.nav` cùng file (`Dấu vết AI` / `SLO AI`) — không dịch, không
bịa. Việc này có sẵn từ R4.4 (lúc thêm breadcrumb), **CHƯA** bị test nào bắt.

## Gates

| Gate | Kết quả |
|---|---|
| Test khoá mới — **fail-before** | 3 đỏ / 2 xanh, liệt kê đúng 4 path chết |
| Test khoá mới — sau khi sửa | 6/6 xanh |
| 6 file i18n liên quan | **74/74** xanh |
| FE hồi quy `pages` + `components` + `i18n` | 63 file · **450/450** xanh |
| `tsc --noEmit` | exit 0 |
| `npm run build` | exit 0 (45.01s) |
| `npm run i18n:scan` | exit 0, **không ghi file** (idempotent) |

## Sai sót của tôi (2 lần, đều đã bắt được)

### 1. Tôi **đoán sai** parent của khoá (`layout.*` thay vì `layout.nav.*`)

Viết test khoá với `layout.aiCommandCenter` ⇒ test **đỏ vì lý do sai**: mấy key đó **không
tồn tại**. Nguyên nhân: regex lùi tìm parent chỉ khớp indent **2 space**, còn khoá nằm ở
indent 6 ⇒ tìm nhầm `layout: {` thay vì `nav: {`. Sửa bằng cách **walk object thật** in ra
mọi đường dẫn kết thúc bằng `aiAgentFederation` — kết quả là `layout.nav.*`.
*(Đây là L-T02 ở dạng khác: không sai số dòng mà sai **cấu trúc**.)*

### 2. Script xoá **xoá nhầm dòng** mà `numstat` vẫn khớp

Lần 1 dùng `splice` với **nhiều chỉ số**: xoá dòng đầu làm lệch mọi chỉ số phía sau, nên mỗi
lần xoá sau trỏ vào **dòng kế tiếp**. Đã xoá oan `aiUsageAnalytics: 'Usage AI',`.
`git diff --numstat` vẫn báo `-41/-41/-18` — **đúng số lượng, sai nội dung** ⇒ L-V06 chưa đủ,
phải kiểm chứng bằng **tên dòng**.

Cách sửa: lọc theo **nội dung** (`kept`/`removed` trong một lượt), và script **tự fail** nếu
bất kỳ dòng nào bị xoá mà không khớp regex. Thêm bước kiểm chứng mạnh nhất: **object diff**
giữa `git show HEAD:…` và working tree — báo đúng `63 xoá / 0 đổi giá trị` cho mỗi
locale, và từ chối mọi key nằm ngoài danh sách chết.

## Còn mở

- **Chưa chụp màn hình** nav 5 tab trên staging với phiên đăng nhập (kế thừa từ R5.1).
- Đã gỡ thêm namespace `agentFederation` (24 key/locale) sau khi đo `git grep` toàn repo = 0 call site.