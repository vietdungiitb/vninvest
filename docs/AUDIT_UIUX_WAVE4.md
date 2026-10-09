# AUDIT — code UI/UX wave 4 (Stage 5)

- **Phạm vi**: `feat/uiux-wave4` vs `dev` @ `ea0002d00`
- **Ngày**: 2026-10-09
- **Hình thức**: 1 auditor độc lập (`AUDIT_UIUX_WAVE4_HOOKS.md`, tự chạy lại mọi
  gate, tự dựng lại lỗi) + supervisor tự audit phần scanner/script/CSS/h1
  (agent thứ hai bị rate-limit 3 lần — **ghi thẳng vì không được báo cáo PASS
  cho việc chưa chạy**).

---

## 0. KẾT LUẬN

| Mức | Số |
|---|---|
| **blocker** | **0** |
| **major** | **4** → đã sửa hết, còn lại **0** |
| **minor** | 4 → 1 đã sửa, 3 ghi nhận |

`confidence: high` — mọi finding đều có lệnh tái lập, và 4/4 major đã được **sửa
rồi chạy lại gate xanh**, không phải "đã ghi nhận".

---

## 1. NHỮNG GÌ ĐÃ SỬA SAU AUDIT

### ID-1 (major) — 2 setter trong 1 handler ⇒ mất kết quả
`packages/web/src/pages/admin/AdminBillingFleetPage.tsx:131,137`

```tsx
onChange={(e) => { setStatus(e.target.value); setPage(1); }}
```

`useSearchParams` của `react-router-dom@6.30.3` đóng trên `searchParams` của
lần render đó (**không có ref sống**). Hai lệnh trong cùng một tick ⇒ lần hai
đọc `prev` cũ và **xoá mất** kết quả lần một.

Auditor đã **tự dựng lại** bằng probe jsdom và **tái lập trên code `dev`** ⇒
đây là lỗi **có sẵn từ wave 2**, không phải hồi quy. Hậu quả thật: chọn trạng
thái hoá đơn **im lặng không ghi được vào URL**.

→ Sửa: gộp `setUrlState({ status, page: 1 })` thành **một** lệnh.

### ID-2 (major, MỚI do wave 4) — draft không seed từ URL
4 trang `AdminCore{AuditTrace,Jobs,PATs,ServiceAccounts}Page`.

Sau khi `filters` đổi từ `useState` sang `useUrlRecord`: deep-link `?search=fpt`
**lọc bảng đúng** (đây là điều wave 4 muốn), nhưng `filtersDraft` vẫn khởi tạo
rỗng ⇒ **form trống trong khi bảng đã lọc**, và **một lần bấm Apply là xoá sạch
bộ lọc trong link**.

Cả hai hình thức lỗi đều tồn tại, nhưng hình thức mới nguy hiểm hơn: người dùng
thấy bảng đã lọc rồi Apply lại mất ⇒ họ nghĩ tính năng hỏng.

→ Sửa: `useState<Filters>(filters)` — draft lấy giá trị đã phân tích từ URL ở
render đầu ⇒ form và bảng luôn khớp.

### ID-3 (major, MỚI) — `replaceKeys` chết lặng lẽ trong `useUrlRecord`
`packages/web/src/hooks/useUrlState.ts`

`allReplace` chạy `every` trên **toàn bộ key của `spec`**; `spec` luôn có key
ngoài danh sách ⇒ `replaceKeys` **không bao giờ** cho `true`.

→ Sửa: `every` trên `touched` (key người dùng vừa ghi) + **3 test khoá lại**.
Fail-trước: cố tình đưa bug về ⇒ `expected 'PUSH' to be 'REPLACE` ×2.

### ID-4 (minor) — self-test của scanner là **tautology** (phát hiện khi tự audit)
`docs/audit-uiux/scripts/scan-ui-guidelines.mjs`

Do lại: cố tình cho `urlSyncdVars` đọc **cả comment** (bỏ lọc) ⇒ self-test
**PASS 4/4**. Lý do: T1 gọi `codeLines()` trước, nên comment đã bị loại ở đường
ống và `urlSyncedVars` không bao giờ thấy nó.

⇒ 4/5 trường hợp của gate **không bảo vệ được thứ gì cả**.

→ Sửa: (a) `urlSyncedVars` **tự loại comment** (lọc 2 lần là idempotent),
(b) thêm **T5** gọi hàm trực tiếp với text còn nguyên comment.
Chứng minh lại bằng inject-bug: bỏ lọc ⇒ **FAIL 1/5**.

---

## 2. NHỮNG GÌ ĐÃ KIỂM TRA VÀ **KHÔNG** thấy vấn đề

| Kiểm tra | Kết quả | Bằng chứng |
|---|---|---|
| Comment còn giấu hit NAV-1? | **Không** | T1 + T5; inject bug ⇒ FAIL |
| File gọi hook cho biến A giấu biến B? | **Không** | T2 (biến B vẫn bị báo) |
| Escape cấp biến có báo động giả không? | Có, **3 hit** `CampaignTable.jsx` (`sortCol`/`sortDesc`/`globalFilter`) | `nav1-report.mjs --why` — cả 3 **thật sự** đã sync qua `useUrlValue`, nên bỏ là **đúng**, không phải giấu |
| `useUrlRecord` có bỏ sót không? | **Không** — 4/4 trang P1 hết hit | `counted` 108 → **104** |
| Trang nào mất h1? | **Không** — `check-h1-graph --gate`: `KHÔNG_TIM_THAY_H1__CO_PHAN_DONG: 0`, 0 import unresolved | `KHÔNG route nào ... chắc chắn không có h1` |
| `@media (pointer: coarse)` có ảnh hưởng desktop? | **Không** — chỉ khớp thiết bị con trỏ thô | mô tả media query |
| `StockDetailHeader` h1→h2 an toàn? | **Có** — dùng ở đúng 1 chỗ (`StockDetailPage.tsx:330`), `StockDetailPage` chỉ route qua `ShellStockDetailPage` | grep + import graph |

---

## 3. KHÔNG VERIFY ĐƯỢC

| Mục | Vì sao |
|---|---|
| Thiết bị thật / notch / Safari iOS / Firefox | Máy không có; Chromium headless trả `env(safe-area-inset-*) = 0px` |
| Mọi route **cần đăng nhập** trong Playwright | `auth.setup.ts` login thật vào `vite preview` **không có backend** ⇒ project `setup` chết trước thân test |
| **Bề mặt false-negative của rule NAV-1** | Chỉ nhận call site có **literal** và trên **1 dòng**; đã liệt kê trong `nav1-rule.mjs`. Chưa có test nào chứng minh **không** bỏ sót — `nav1-report.mjs --why` in ra từng biến bị bỏ qua để kiểm bằng tay |
| Hiệu năng scanner | Đo **211 s** và **312 s** ở 2 lần. Nguyên nhân đã định vị (`selectorName` O(40·n) mỗi dòng CSS) nhưng **chưa sửa** (ngoài phạm vi, non-goal 12) |

---

## 4. GHI NHẬN (minor, không sửa trong wave này)

| # | Vấn đề | Vì sao chưa sửa |
|---|---|---|
| M-1 | `check-h1-graph --gate` **exit 1**: `unreferenced-registry-entry shell-ai-command-center` | **Có sẵn ở `dev`** (đã kiểm bằng `git show dev:…`), không phải hồi quy. Script **tái hiện độc lập** một phát hiện đã có sẵn trong `AGENTS.md` Entry 228 (`ShellAiCommandCenterPage` không route). Cần quyết định sản phẩm: nối route hay gỡ entry |
| M-2 | `useUrlState` không có khoảng trễ (debounce) cho ô nhập văn bản | Mỗi ký tự **vẫn** gọi `setParams` (dù `replace`). Chặn lịch sử rác thì đủ; debounce là tối ưu hiệu năng, tách ticket |
| M-3 | `expiresWithinDays` giữ kiểu `string` (chỉ lọc `/^\d+$/`) | Đổi sang `number` phải sửa cả form + chỗ đọc; không đổi hành vi nào với người dùng hợp lệ. Tăng bề mặt |

---

## 5. MỘT ĐIỂM QUAN TRỌNG VỀ CON SỐ BASELINE

`uiux-baseline.json` được **nâng** 172 → 177. Đây là **siết rule**, không phải
nới: escape cấp file đã giấu 12 hit; bỏ nó ra thì gate nghiêm hơn. Bằng chứng
escape cấp file vô dụng:

- 7 file gọi `useUrlState` đều destructure **bản ghi** ⇒ regex `const [ <tên> ,`
  không khớp ⇒ **0 hit** ⇒ **không file nào đã sửa cần escape**.
- 7 file bị escape cấp file che đều **không** gọi hook nào (`hasHook=false`).

Gate vẫn giữ nguyên nguyên tắc "chặn thoái lùi, không chặn nợ sẵn": từ 177 trở
đi tăng là đỏ.

---

## 6. ĐỔI HÀNH VI CẦN OWNER BIẾT

**Major 2 bỏ khả năng "undo bộ lọc bằng nút Back".** Gõ trong ô tìm kiếm không
còn đẩy history ⇒ Back sẽ rời trang.

Căn cứ: test cũ `portfolio-deep-link-fu05` AC-3 **pass vì lý do sai** — nó gọi
`fireEvent.change` **một lần** với giá trị đã hoàn chỉnh. Người dùng thật gõ 3
ký tự ⇒ 3 lần. Với `push`, lịch sử chứa `?search=H` → `?search=HP` → `?search=HPG`
và `navigate(-1)` chỉ quay về `?search=HP`, **không** phải bảng chưa lọc.

Đo lại trên code `dev`:

```
voi code CU:  expected 'PUSH' to be 'REPLACE'
              expected '/p?search=HP' not to contain 'search='
voi code MOI:  7 passed (7)
```

⇒ Test được **viết lại thành 2 case** mạnh hơn (không xoá test nào).

**Đánh đổi**: giữ hành vi cũ thì Back phải bấm N lần, N = số ký tự đã gõ. Giá
phải trả: bộ lọc không còn nút hoàn tác nào khác. **Khuyến nghị**: nếu sản phẩm
cần, thêm nút "Xoá bộ lọc" — tách ticket, không làm trong wave này.