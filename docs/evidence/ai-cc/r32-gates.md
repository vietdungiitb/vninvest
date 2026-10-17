# R3.2 — Trang "Traces" cạnh Usage (2026-10-17)

Nhánh `feat/ai-r32-traces-page` ← `dev`. Claim `ai-r32`.
Plan: `IMPLEMENTATION_PLAN_AI_COMMAND_CENTER_COMMERCIAL_20260925.md:1065-1083`.

## Bối cảnh: M3 đã đo, không phải tôi nhớ

M3 (Entry 364) đo bằng `grep`: `AITrace` có ở 7 file nhưng **không** file nào ở
`views`/`urls`/`serializers` ⇒ dữ liệu ghi một chiều, **không ai đọc lại được**.
R3.2 vì vậy gồm **cả** endpoint BE lẫn trang FE, không phải chỉ UI.

## Sai lệch plan vs code (ghi ra, không sửa code để chạy theo plan)

Plan `:1069` nói *"tab thứ 6 trong `AiHubNav`"*. Đọc `AiHubNav.tsx` thật: chỉ có **3
tab** (Tổng quan · Agents · Usage). ⇒ Traces là **tab thứ 4**. Plan đếm từ bản thiết kế
cũ; nếu làm theo chữ "thứ 6" sẽ phải bịa thêm 2 tab không tồn tại.

## AC

| AC | Điều kiện | Trạng thái | Bằng chứng |
|---|---|---|---|
| AC1 | Route `/settings/ai/traces` + tab | ✅ | `main.tsx` + `pageRegistry.js` + `routeCatalog.js` + `AiHubNav.tsx`; test `AC1: tab Traces có trong AiHubNav...` |
| AC2 | Waterfall latency từng bước + tổng | ✅ | `test_AC2` — 4 bước đúng thứ tự `technical→synthesis`, tổng 700 ms = 100+150+200+250 |
| AC3 | Click bước ⇒ metadata, **không** plaintext | ✅ | `test_AC3` ×2 (metadata + `error_code`); BE `test_row_exposes_step_latency_and_hashes_but_no_plaintext` |
| AC4 | Filter + pagination | ✅ | BE 8 test filter/pagination · FE `test_AC4` ×3 |
| AC5 | Empty state trung thực | ✅ | `test_AC5` — nói rõ "chưa có trace nào — hãy chạy 1 lần tư vấn", **không** bảng rỗng; BE `results=[]` + `total=0` |
| AC6 | User A không thấy trace B | ✅ | `TracesIsolationTests` ×3 — kể cả **staff cũng chỉ thấy của mình** |
| AC7 | Skeleton + nút Thử lại | ✅ | `test_AC7` ×2 |

## Quyết định thiết kế (có lý do, ghi rõ)

1. **Không có nhánh xem người khác — kể cả staff.** AC6 chỉ đòi cách ly, không AC nào
   cho quyền xem người khác ⇒ thiếu quyền thì không mở. `AIAuditLog` (R0.11) đã từng
   phải vá một endpoint lộ cấu hình của user khác; không lặp lại.
2. **Không có endpoint chi tiết.** Row đã mang đủ metadata (chỉ SHA-256, không có bí
   mật) nên thêm `/traces/<id>/` là thêm round-trip mà không thêm thông tin. Đánh đổi:
   payload mỗi row dài hơn — chấp nhận được vì `limit ≤ 100`.
3. **Không ô "xem nội dung prompt".** R3.1 chỉ lưu hash (PIPL 13/2023) ⇒ dữ liệu đó
   không tồn tại. Trang hiện dòng thông báo nói rõ điều này thay vì để người dùng tìm.
4. **Filter đổi ⇒ reset `offset=0`.** Không reset thì đang ở trang 3 sẽ kẹt ở offset
   không còn dòng nào.
5. Adapter **không** có tham số user/tenant — BE bỏ qua, và có tham số sẽ gây hiểu
   nhầm là có thể lọc người khác.

## Bug do test bắt được trong lúc viết (không phải của test)

Trang ban đầu **thiếu `useEffect(() => void execute(), [execute])`**. `useRetryableAsync`
**không tự chạy** (`hooks/useRetryableAsync.ts:102` chỉ trả `execute`; mẫu gọi thật ở
`AIUsageDashboard.tsx:237`). Hậu quả: API không bao giờ được gọi, `data` luôn `null` ⇒
trang rơi thẳng vào **empty state** — nhìn như chạy, thực tế không tải gì. Đáng chú ý:
`test_AC5` (empty state) **vẫn pass** với bug này ⇒ chỉ test có dữ liệu mới bắt được.

## Bẫy gặp

| Bẫy | Hậu quả | Cách tránh |
|---|---|---|
| `useRetryableAsync` không tự execute | Trang "chạy" nhưng không gọi API | Luôn `useEffect(() => { void execute(); }, [execute])` |
| `reverse()` thiếu namespace | `NoReverseMatch` | `user_workspace.urls` include với `namespace='user_workspace'` ⇒ `reverse('user_workspace:…')` |
| Tự viết `unwrapped()` | Không khớp envelope ⇒ 13 lỗi giả | Dùng `advisory.tests.envelope.unwrapped` có sẵn |
| Thêm route ⇒ `system-design` FAIL | Chặn push | `gen-endpoint-catalog.py --write` rồi `check-system-design --write`/`--check` |
| Gõ class CSS không tồn tại | `tsc` **không** bắt, UI mất style | `grep '^\.class'` trong `aiSettings.module.css` trước khi dùng |

## Gate đã chạy

| Gate | Kết quả |
|---|---|
| BE mới | `tests.test_ai_traces_api` **15/15** |
| BE hồi quy | 42 module · **516/516 OK** |
| FE mới | `ai-traces.component.test.tsx` **11/11** |
| FE hồi quy | 86 file · **574/574** |
| `tsc --noEmit` | exit 0 |
| `npm run build` | exit 0 (`built in 56.91s`) |
| `lint` | **0 error** / 4103 warning (+36 so với M3 — **toàn bộ** là `react/jsx-no-literals` trên `data-testid`, đúng false-positive đã ghi sẵn trong CLAIMS entry `uiux-w6-soc`) |
| `i18n:scan` | exit 0 |
| `check-ai-cc` | SACH |
| `check:ai-cc-dag` | PASS 46/61/0 vòng |
| pre-push | **23/23** (gồm `system-design` sau khi regen) |

## CHƯA CHẠY (không báo PASS)

- **Chưa mở trang trên staging thật** — mọi thứ mới chạy qua test + build. Chưa có
  `deploy-staging.sh` ⇒ **chưa biết** trang hiển thị ra sao với dữ liệu thật.
- **Chưa chạy E2E Playwright** (click tab → waterfall → click bước trên trình duyệt).
- **Chưa có trace thật để xem**: staging vẫn không có key provider dùng được (R2.10 AC8
  mở từ M2) ⇒ waterfall trên staging sẽ hiện empty state, **đúng** nhưng chưa ai
  nhìn thấy nhánh "có dữ liệu".
- Full BE ngoài advisory+AI · `ruff` · E2E · staging deploy.
- 36 warning `jsx-no-literals` **chưa** dọn — dọn bằng `eslint-disable` sẽ tạo mẫu mới
  trong repo; nên xử lý ở ticket riêng nếu muốn hạ baseline.

## Tiếp

**R3.3** — dashboard SLO LLM (`PERCENTILE_CONT` trên `AIUsageRecord`, plan `:1085+`).
AC13 của R2 (link `ghu_`) vẫn chưa làm.