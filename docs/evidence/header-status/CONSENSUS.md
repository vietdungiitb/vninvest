# CONSENSUS — B4 re-review PLAN_HEADER_REALTIME_STATUS_20261119.md

- **Ngày**: 2026-11-19 · **Vai trò**: auditor độc lập (subagent), CHỈ ĐỌC
- **Đối tượng**: `docs/PLAN_HEADER_REALTIME_STATUS_20261119.md` (đã sửa, 91 dòng)
- **Audit trước**: `docs/evidence/header-status/AUDIT_PLAN.md` → NEED_REVISION (6 objection O1–O6)
- **VERDICT: AGREE** (kèm 4 reservation; chưa `PASS` vì code chưa implement, gate chưa chạy)

---

## 1. Đối chiếu 6 objection

| Objection | Trạng thái | Bằng chứng trong plan đã sửa |
|---|---|---|
| **O1** `common.online` / AC6 / SCOPE | **ĐÃ ĐÓNG** | `PLAN:59` đổi thành `labelKey: 'layout.realtime.online'`; `PLAN:55-61` cả 5 labelKey đều `layout.realtime.*`; `PLAN:27` AC6 ghi "**5 key** ... tồn tại trong **cả 2** `locales/{vi,en}/layout.js`; **`common.online` không dùng**"; `PLAN:43-44` SCOPE mỗi locale thêm 5 key (kể cả `online`); `PLAN:46` LIMIT bổ sung cấm cả `locales/*/common.js`. Không còn đường nào trỏ `common.*`. |
| **O2** citation + defensive-only | **ĐÃ ĐÓNG** | `PLAN:14` liệt kê đúng 19 dòng `setRealtimeStatus` (`464,556,913,968,985,997,1003,1014,1020,1044,1100,1134-1178,1194,1228,1238`) và ghi rõ "**4 giá trị thật** ... `'disconnected'` **không bao giờ được set** (grep 0 hit) — giữ là nhánh phòng thủ, chỉ test mock sinh ra". `PLAN:26` AC5 gắn nhãn **Defensive-only**. Tôi tự grep lại: 19 hit/4 giá trị `idle|connecting|polling|live`, `'disconnected'` 0 hit — khớp. |
| **O3** AC0 + optional chaining | **ĐÃ ĐÓNG** | `PLAN:21` AC0 (null/undefined → `layout.realtime.idle`, chấm xám, không throw, không "Đang kết nối"); `PLAN:67` resolver `if (!realtimeCtx) → idle`; `PLAN:75` đọc `realtimeCtx?.feed?.metrics?.manager?.consumerCount ?? 0`. Khớp `RealtimeContext.js:5,8-10` + thực tế test mount không Provider (`Header.component.test.tsx:86-95`). |
| **O4** mock/reset/default/assert-key | **ĐÃ ĐÓNG** | `PLAN:45` nêu rõ thêm `useRealtimeContext: vi.fn()` vào `h=vi.hoisted()` (`:30-36`), thêm `vi.mock("@/context/RealtimeContext.js", ...)` (`:38-43`), `mockReset()` + **default trả `null`** trong `beforeEach` (`:102-119`), đổi comment "4 of the 9 imports" → "5", 6 case AC0–AC5; `PLAN:28` AC7 khẳng định assert trên **key** vì mock `t:(k)=>k`. Alias `@` đúng (`vitest.config.ts:19`). |
| **O5** assert dương tính | **ĐÃ ĐÓNG** | `PLAN:22` AC1 assert dương tính `getByText('layout.realtime.idle')` + class `bg-slate-500`, rồi mới assert phủ định "không có Offline"; `PLAN:23-26` AC2–AC5 mỗi case `getByText(key)` + class chấm tương ứng (`bg-amber-400`, `bg-emerald-400 live-dot-pulse`, `bg-rose-400`). L-V04 thỏa. |
| **O6** đối chứng numstat | **ĐÃ ĐÓNG** | `PLAN:84`: `git diff --numstat` = **đúng 4 file SCOPE, 0 file ngoài SCOPE**; kèm U+FFFD = 0, LF. `PLAN:79` cập nhật 13 test (7 cũ + 6 mới) khớp `PLAN:45`. |

⇒ O1 (blocker trước đó) đã được tháo gỡ; không còn objection chặn plan.

---

## 2. Reservation (phải đóng ở bước code / B8, KHÔNG chặn AGREE)

| # | Reservation | Ai đóng | Bước |
|---|---|---|---|
| **R1** | `PLAN:68` viết `consumerCount ?? 0 === 0 \|\| status === 'idle'`. Do `===` ưu tiên cao hơn `??`, biểu thức parse thành `consumerCount ?? (0===0)`; với `consumerCount = 0` (số, không nullish) kết quả là `0` = **falsy** ⇒ AC1 (`PLAN:22`) sẽ hỏng nếu copy nguyên. Phải viết trong code là `(consumerCount ?? 0) === 0 \|\| status === 'idle'` (hoặc đơn giản `consumerCount === 0` vì `PLAN:75` đã ép `?? 0`). | Implementer | Step 5 (code) — self-check trước khi chạy test |
| **R2** | Hai file `locales/{vi,en}/layout.js` hiện **chưa có** object `realtime` (grep `realtime\|online` → 0 hit ở cả 2). Phải **tạo mới** nested object 5 key, không phải "sửa key có sẵn". | Implementer | Step 5 + gate `i18n-scan-strict` (`PLAN:82`) |
| **R3** | `PLAN:45` dẫn `beforeEach (:102-119)` hơi thiếu (block thực `Header.component.test.tsx:102-122`) — chỉ sai số dòng tham chiếu, không đổi ý định. | Implementer | Step 5 (không cần sửa plan) |
| **R4** | Auditor **KHÔNG chạy** `tsc`/`vitest`/`eslint`/`i18n-scan-strict`; các con số baseline ở `PLAN:33-35` vẫn là claim của tác giả plan. Phải tự chạy thật, log fail-before đỏ (`PLAN:79`), và ghi `CHƯA CHẠY` cho staging/Playwright (`PLAN:85`). | Implementer + auditor | Gates Step 6, re-audit **B8** (`docs/evidence/header-status/REAUDIT.md`) |

---

## 3. Điều kiện chuyển AGREE → PASS

- Code đúng SCOPE 4 file (`PLAN:41-45`), R1–R3 đóng.
- 13/13 test xanh **có fail-before log**; `tsc` 0; `eslint` 0 error; `i18n-scan-strict` exit 0; `check-multi-agent` 0 lỗi; numstat đúng 4/0; U+FFFD 0, LF.
- B8 re-audit tự chạy lại gate (không tin log của agent khác) → ghi `REAUDIT.md` → verdict PASS.
- B9: claim `done`, ledger Entry 559.

**Kết luận:** plan đã khắc phục toàn bộ O1–O6, nhất quán với code thật và đủ chi tiết để implement không hỏi lại. ⇒ **AGREE**, reservation R1–R4 đóng ở Step 5/6 và B8.
