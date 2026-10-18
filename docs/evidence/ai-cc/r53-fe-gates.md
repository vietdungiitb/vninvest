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

## VERIFY TRÊN STAGING — HTTP thật + **đã mở ảnh xem**

Deploy `dev` @ `a73c27a2c` → container healthy.

**Đo bằng HTTP thật** (L-V07). Lần đầu tôi dùng `APIClient` trong container ⇒
`DisallowedHost: testserver` — đó là **lỗi của probe**, không phải của sản phẩm; phải đổi
sang `curl` + token thật.

| Kiểm tra | Kết quả |
|---|---|
| `showmigrations advisory` | `[X] 0023_aitrace_prompt_template_version` |
| Cột DB | `prompt_template_version | integer | NO` (default 0) |
| `GET` AI CC (staff) | `sub_agent_prompts` **có**, đủ 4 khoá |
| `PUT` 1 prompt | **HTTP 200**, version **0 → 1** |
| `PUT` khoá lạ | **HTTP 400** |
| Audit sau PUT | id 9: `before.technical=''` → `after.technical='PROBE R5.3 staging'` |

Đã **dọn probe**: `metadata` trả về rỗng sau khi đo.

## Ảnh — mở ra xác nhận bằng mắt

`docs/evidence/ai-r53/visual/01-sub-agent-prompts.png`

Thấy trong ảnh: khối **"PROMPT SUB-AGENT HỆ THỐNG · PHIÊN BẢN HIỆN TẠI: 0"**, mô tả
tiếng Việt, và **4 ô** nhãn `CHUYÊN GIA KỸ THUẬT` · `CHUYÊN GIA DÒNG TIỀN` ·
`CHUYÊN GIA TÂM LÝ THỊ TRƯỜNG` · `GIÁM ĐỐC TỔNG HỢP`, placeholder có `{symbol}`.
Bên dưới, panel audit hiện `technical_agent_prompt ← PROBE R5.3 sta…` ⇒ **các đường ghi
hiện ra đúng** trên môi trường thật.

Quan sát phụ (chưa kết luận là lỗi): 4 ô xếp dọc, ô 4 có thanh cuộn nhỏ ⇒ chiều cao ô
không đều nhau.

## Còn mở

- Lịch sử phiên bản trong **UI** chưa ràng riêng cho 4 prompt (đọc chung ở tab Audit của R4.5).
- Chiều cao 4 ô không đều — **chưa** đo, chưa sửa.