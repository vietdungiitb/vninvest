# AI R5.3 (phần FE) — UI 4 system sub-agent prompt, staff-only, qua modal preview

**Claim**: `ai-r53` · **Nhánh**: `feat/ai-r53` → `dev` · **Ngày**: 2026-10-18

## Cờ staff lấy từ **payload của BE**, không thêm context mới

`AICommandCenterForm` **không** dùng `usePortfolio` (đo bằng `git grep`). Nếu tôi thêm
`usePortfolio()` thì mọi test render form hiện có (không bọc `PortfolioProvider`) sẽ ném
`usePortfolio must be used inside PortfolioProvider` ⇒ đỏ vì lý do sai.

Nên `canEditSubAgentPrompts = settings.sub_agent_prompts != null` — BE **đã bỏ hẳn key** khi
user không phải staff, nên đây là **một nơi duy nhất** quyết định "ai là staff" (server quyết,
client theo). Hai nơi phản quyết định chính là cái làm nav R4.5 lệch.

## AC + test

| AC | Test | Kết quả |
|---|---|---|
| AC1 staff thấy **4** ô với giá trị đang lưu | `AC1 staff thấy 4 ô prompt...` | ✅ 4 ô, đúng giá trị |
| AC1 hiện version hiện hành | `AC1 hiện version...` | ✅ thấy `3` |
| AC2 user thường **không thấy** khối | `AC2 user thường KHÔNG thấy...` | ✅ `queryByTestId` = null |
| AC4 sửa 1 prompt ⇒ payload đúng 4 khoá, không khoá lạ | `AC4 sửa 1 prompt...` | ✅ qua `preview-confirm` |
| — không sửa gì ⇒ **không** modal, **không** PUT | `không sửa gì thì...` | ✅ |

**5/5 test mới** · **460 test hồi quy FE** (455 cũ + 5 mới) — **0 fail** · `tsc` exit 0 ·
`build` exit 0 · `i18n:scan` exit 0, không ghi file.

## Fail-before: 4 đỏ trước khi viết UI

Test đầu tiên của tôi **render sai** (mock `defaultCoreApiAdapter` trong khi form dùng
`coreApiAdapter` + `LangProvider` + `MemoryRouter`) ⇒ 4 đỏ vì **ly do sai**. Đã copy đúng
pattern từ `ai-cc-r14-dirty.component.test.tsx`.

## Một test của tôi có **tiền đề sai**, đã sửa theo hành vi thật

Tôi viết "bấm Lưu khi không đổi gì thì vẫn PUT nhưng không kèm `sub_agent_prompts`". Thật ra
form **không mở modal** khi không có diff (R1.9 AC4) và **không** gọi API. Đã viết lại thành
assert đúng: không modal + không PUT — mạnh hơn bản cũ.

## Class CSS: đo trước, không đoán

Tôi viết `styles.section` / `styles.hint` / `styles.fieldLabel` theo trí nhớ. Đo bằng script so
`styles.X` với class thật trong `aiSettings.module.css` ⇒ cả 3 **không tồn tại** (giống hệt lỗi
`.auditTable` ở R5.1d). Đã đổi sang class có thật (`indicatorsSection`, `helpText`, `label`) và
chạy lại script ⇒ 19/19 class trong form đều tồn tại.

## Còn mở

- **CHƯA deploy staging**: UI mới + migration `0023` chưa chạy trên môi trường thật.
- **CHƯA chụp ảnh** xác nhận bằng mắt (L-V05) — sẽ làm sau khi deploy.
- Chưa có lịch sử phiên bản **trong UI** (đọc từ `AIAuditLog` qua tab Audit của R4.5 —
  chưa ràng vào riêng 4 prompt này).