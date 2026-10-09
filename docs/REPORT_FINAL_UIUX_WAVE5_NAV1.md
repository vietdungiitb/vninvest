# BÁO CÁO TỔNG KẾT — UI/UX wave 5 / NAV-1 (2026-10-09)

> **Kết luận 1 câu:** 104 hit NAV-1 **không phải 104 lỗi** — 15 là false positive của
> **rule** (đã sửa rule, không sửa số), 89 còn lại là **code thật** (không giảm được
> bằng rule). Gate **mạnh hơn chứ không yếu hơn**, chứng minh bằng inject bug vào
> code thật chứ không phải bằng self-test của chính rule.

| | |
|---|---|
| **Nhánh** | `feat/uiux-wave5-nav1` (từ `dev` @ `7746d5c1f`) |
| **PR** | **#76** → `dev` (**đang OPEN, chờ Owner review**) |
| **Claim** | `uiux-wave5-nav1` — `docs/CLAIMS.md` |
| **Ledger** | `docs/CODE_CHANGE_AUDIT_LEDGER.md` → `## Entry 258` (+ dòng index 258) |
| **Báo cáo chi tiết** | `docs/REPORT_FINAL_UIUX_WAVE5_NAV1.md` |
| **Bàn giao** | `docs/audit-uiux/HANDOFF_UIUX_WAVE5_20261009.md` |
| **Phạm vi** | **chỉ** `docs/audit-uiux/scripts/` + `packages/web/scripts/uiux-baseline.json` — `packages/web/src` sửa **0 dòng** |

---

## 1. Bối cảnh — vì sao phải đo lại trước khi sửa

`HANDOFF_UIUX_WAVE4_20261009.md` §2.2 nói:

> *"104 hit có một phần là false positive của rule (`quantity` · `quota` ·
> `quotesBySymbol` · `pageStats` …). **Cần sửa RULE, không sửa SỐ**."*

Phán đoán **đúng hướng**, nhưng **không nêu cái nào là false positive**. Sửa theo
đoạn văn đó là sửa mỏng. Vì vậy viết `nav1-classify.mjs` để tách trước:

| Nhóm | Số | Ý nghĩa |
|---|---|---|
| **A** | **12** | Khớp nhánh `\|q` **rỗng**: `quantity` · `orderQuantity` · `queueTiers`×5 · `quotesBySymbol` · `selectedRequestId` (khớp `Req`**`q`**`uest`) · `quota` · `quotas` |
| **C** | **3** | `searchParams` từ `useSearchParams`/`useRouterSearchParams` — **chính nó là URL** |
| **D** | **89** | **Ứng viên thật** — bộ lọc/sắp xếp/phân trang không đồng bộ URL |

⇒ **Rule sai 15/104.** 89 còn lại là **nợ thật**.

> ⚠ **Sai số trong handoff wave 4:** `pageStats` được liệt kê là false positive
> nhưng **không phải** — nó là phân trang thật của bảng thống kê
> (`useAlertCenterFilters.ts:13`). Danh sách đó là ví dụ cảm tính.

## 2. Ba lỗi đã sửa

### 2.1 Nhánh `|q` rỗng — `nav1-rule.mjs`

Regex cũ `(\w*(filter|search|sort|page|tab|query|q)\w*)` khớp **bất kỳ tên nào
chứa chữ `q`**. Tách nhánh `q` ra khỏi regex, xử lý bằng `isQueryToken()`:

- `q` · `qValue` · `qFilter` → **bắt** (hết biến, hoặc camelCase)
- `quantity` · `quote` · `queueTiers` · `quotas` → **không bắt**
  (`q` + chữ thường là tiếp một *từ tiếng Anh khác*)

### 2.2 Thiếu escape `useSearchParams` — `nav1-rule.mjs`

`urlSyncedVars()` biết `useUrlValue` · `useUrlState` · `useUrlRecord` nhưng
**không biết** `useSearchParams`. Thêm `USE_SEARCH_PARAMS_RE`.

### 2.3 `nav1-report.mjs` tự viết lại regex — lỗi phát hiện **trong lúc sửa**

`nav1-report.mjs:54` hard-code lại regex của gate, **đúng cái mà comment ở chính
header file cấm** (*"KHÔNG tự viết lại regex"*). Sau khi rule sửa, báo cáo và gate
**lệch số**: `escaped` 7 → 23 trong khi gate chỉ giảm 15 ⇒ có **16 dòng "bị bỏ
qua" chỉ do báo cáo**, in ra như bằng chứng hợp lệ. Sửa bằng `destructureName()`
dùng chung `NAME_RE` + `isQueryToken`.

## 3. Bằng chứng fail-before / fail-after

### 3.1 Self-test scanner (5 → 8 case)

| Case | Nội dung | Rule cũ | Rule mới |
|---|---|---|---|
| **T6** | `quantity`/`queueTiers` không phải bộ lọc | **FAIL** | PASS |
| **T7** | `q` + `qValue` thật **vẫn** bắt | PASS | PASS |
| **T8** | escape `searchParams` từ `useRouterSearchParams` | **FAIL** | PASS |
| T1–T5 | 5 case của wave 4 | PASS | PASS |

**8/8 PASS**; trước khi sửa rule: **2/8 FAIL** (output đã lưu ở session).

### 3.2 Inject bug vào **code thật** (`WhaleBubbleChart.jsx`, đã khôi phục)

| Biến inject | Kết quả | Ý nghĩa |
|---|---|---|
| `secretStatusFilter` | **BỊ BẮT** | Gate vẫn bắt lỗi thật sau khi sửa rule |
| `quote` | **không bắt** | xem §4 |

`git diff --stat` sau khi khôi phục = rỗng.

## 4. ⚠ Đổi lỗi có chủ đích — `quote` không còn được bắt

Bản sửa **đầu tiên** dùng `q(?![a-z])` **bên trong regex có cờ `i`** ⇒ `[a-z]`
khớp **cả chữ hoa** ⇒ **`qValue` mất**. Đó là sửa rule làm rule **yếu đi** —
đúng thứ lesson wave 3 §4.2 cấm. Phát hiện ở self-test T7, sửa lại bằng
`isQueryToken()` (case-sensitive thật sự).

Đây là **trade-off có chủ đích, không phải bug còn lại**:

- `quantity` · `quotas` · `queueTiers` · `orderQuantity` → **không** phải bộ lọc
  (đã đọc code: `quota` là số hạn dụng, `quantity` là số lượng lệnh).
- `quote` · `qValue` → `quote` **có thể** là ô tìm kiếm mà rule **không bắt được**.
  Để bắt `quote` phải dựa vào **kiểu dữ liệu** (chuỗi / mảng / số), tức phân
  tích AST — không phải regex.
- Đã ghi trong comment `nav1-rule.mjs` để session sau không tự đo lại rồi gọi
  nó là "còn bug".

## 5. Số đo

| Đo | Trước | Sau | Ghi chú |
|---|---|---|---|
| `TONG` scanner | 177 | **162** | −15, đúng bằng 12 + 3 |
| `NAV-1` (budget) | 104 | **89** | baseline `uiux-baseline.json` **đã chốt lại** 162 |
| classify A / C / D | 12 / 3 / 89 | **0 / 0 / 89** | **D giữ nguyên 89** ⇒ không bỏ sót ứng viên thật |
| 10 rule khác của budget | — | **không đổi** | không rule nào biến mất |

## 6. 89 hit còn lại — phân bố theo nhóm (đo thật)

| Nhóm | File | Hit | Nhận xét |
|---|---|---|---|
| `components/soc/` | 11 | **41** | Tập trung lớn nhất — `SocSignalsPanel.tsx` (11) · `SocOverviewPanel.tsx` (7) · `SocUsersPanel.tsx` (5) |
| `hooks/` | 3 | 9 | `useAlertCenterFilters.ts` (6) |
| `pages/admin/` | 6 | 6 | 5 trang có `filtersDraft` + 1 `selectedRequestId` |
| còn lại | 19 | 33 | rải rác, phần lớn 1–4 hit/file |

Tổng: **39 file / 89 hit**.

## 7. Gate đã chạy thật

| Gate | Kết quả |
|---|---|
| `scan-ui-guidelines --self-test` | **8/8 PASS** (trước: 2/8 FAIL) |
| `check-uiux-budget` | **exit 0** · −15 · baseline chốt · `--self-test` PASS |
| `nav1-classify` | exit 0 · A=0 C=0 D=89 |
| `check-multi-agent` | **exit 0** |
| `check-ledger-entry` | **exit 0** · `max=258` · 0 trùng mới |
| `npx tsc --noEmit` | **exit 0** |
| `npm run lint` | **exit 0** · 0 error / 3754 warning (= baseline) |
| `npm run test:components` | **exit 0** · **119 file / 844 test PASS** (= baseline) |
| `npm run build` | **exit 0** · 36.13s |
| `pre-push-gate` | **17 PASS / 0 FAIL** |

## 8. ⚠ Một sự cố phát sinh ngoài dự kiến

`pre-push-gate` chặn push vì `docs/CODE_CHANGE_AUDIT_LEDGER.md` có **6 ký tự
U+FFFD**. Điều tra thì **6 ký tự đó có sẵn trên `dev`**, do commit `7746d5c1f`
(đóng claim wave 4) tạo ra — **không phải do branch này**. Gate chỉ quét file
**đã thay đổi**, nên chỉ lộ ra khi ledger bị sửa.

Đã sửa bằng cách thay bằng `-`, **không** thêm file vào `encoding-allowlist.txt`
— file đó ghi rõ *"Không được thêm file vào đây để cho gate xanh"*.

## 9. Bài học (đã ghi vào comment trong code + ledger)

1. **"Sửa rule chứ không sửa số" là chỉ dẫn đúng, chưa phải kế hoạch.** Phải có
   bảng phân loại A/C/D trước; 89 phần còn lại là nợ thật, **không giảm** được
   bằng rule.
2. **Comment "KHÔNG tự viết lại regex" không phải mô hình thực thi** —
   `nav1-report.mjs` sai 4 wave. Comment không có test sẽ rot.
3. **Sửa regex có cờ `i` để hạ `case` là hỏng bằng biến** — `q(?![a-z])` không
   case-sensitive như tưởng.
4. **"Gate mạnh hơn chứ không yếu hơn" chỉ chứng minh được bằng inject bug vào
   code thật**, không phải bằng self-test của chính rule (lesson T1 tautology của
   wave 4).
5. **Nợ có sẵn ở file mình sửa sẽ bị quy cho mình** — phải đối chiếu `dev` (blob
   thô) trước khi nhận trách nhiệm.

## 10. CHƯA LÀM (không gia lập)

- **89 hit NAV-1** còn lại là **code thật**, phải sửa bằng `useUrlRecord` /
  `useUrlState`. Ưu tiên theo §6.
- `check-h1-graph --gate` vẫn **đỏ** vì `shell-ai-command-center` — **cần Owner
  quyết** (handoff wave 4 §2.1, chưa ai đụng).
- 46 hit `CSS-2` (`prefers-reduced-motion`) — non-goal từ wave 2.
- Mobile Playwright: route cần đăng nhập, `auth.setup.ts` login vào preview
  không có backend ⇒ project `setup` chết trước thân test.
- **CHƯA CHẠY**: `check-h1-graph --self-test` · `check:tokens` · `check:contrast`
  · `check:dom-landmarks` · `check:ts-imports` · `check:i18n-hardcoded` ·
  `check:admin-spa-routes` · `check:shell` · `i18n:scan:strict` ·
  `check_large_files.ps1` · Playwright · BE test · `makemigrations` (N/A — không
  sửa backend).