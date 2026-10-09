# REPORT — UI/UX wave 5 / NAV-1 (2026-10-09)

> **Một câu:** 104 hit NAV-1 **không phải 104 lỗi** — 15 là false positive của
> **rule**, đã sửa rule (không sửa số); **89 còn lại là code thật**, không giảm
> được bằng rule. Gate **mạnh hơn chứ không yếu hơn**, chứng minh bằng inject
> bug vào code thật.

- **Nhánh**: `feat/uiux-wave5-nav1` (từ `dev` @ `7746d5c1f`)
- **Claim**: `uiux-wave5-nav1` · **Ledger**: `## Entry 258`
- **Tiền của**: `docs/audit-uiux/HANDOFF_UIUX_WAVE4_20261009.md` §2.2
- **Phạm vi**: **chỉ `docs/audit-uiux/scripts/` + `packages/web/scripts/uiux-baseline.json`**.
  `git diff` cuối = **0 file trong `packages/web/src`**.

---

## 1. Vì sao phải đo lại trước khi sửa

Handoff wave 4 §2.2 nói: *"104 hit có một phần là false positive của rule
(`quantity` · `quota` · `quotesBySymbol` · `pageStats` …). Cần sửa RULE, không
sửa SỐ."*

Phán đoán **đúng**, nhưng **không nêu cái nào là false positive**. Nếu sửa theo
đoạn văn đó thì sửa mỏng. Vì vậy viết `nav1-classify.mjs` để tách trước:

| Nhóm | Số | Ý nghĩa |
|---|---|---|
| **A** | **12** | Khớp nhánh `\|q` **rỗng**. `quantity` · `orderQuantity` · `queueTiers`×5 · `quotesBySymbol` · `selectedRequestId` (khớp `Req`**`q`**`uest`) · `quota` · `quotas` |
| **C** | **3** | `searchParams` từ `useSearchParams`/`useRouterSearchParams` — **chính nó là URL** |
| **D** | **89** | **Ứng viên thật** — bộ lọc/sắp xếp/phân trang không đồng bộ URL |

⇒ **Rule sai 15/104.** 89 còn lại là nợ thật.

> ⚠ `pageStats` mà handoff liệt kê là **KHÔNG** false positive — nó là phân
> trang thật của bảng thống kê (`useAlertCenterFilters.ts:13`). Danh sách trong
> handoff là ví dụ cảm tính, không phải danh sách đo được.

## 2. Ba lỗi đã sửa

### 2.1 Nhánh `|q` rỗng (`nav1-rule.mjs`)

Regex cũ `(\w*(filter|search|sort|page|tab|query|q)\w*)` khớp **bất kỳ tên nào
chứa chữ `q`**. Tách nhánh `q` ra khỏi regex, xử lý bằng `isQueryToken()`:

- `q` · `qValue` · `qFilter` → **bắt** (hết biến, hoặc camelCase)
- `quantity` · `quote` · `queueTiers` · `quotas` → **không bắt**
  (`q` + chữ thường là tiếp một *từ tiếng Anh khác*)

### 2.2 Thiếu escape `useSearchParams` (`nav1-rule.mjs`)

`urlSyncedVars()` biết `useUrlValue` · `useUrlState` · `useUrlRecord` nhưng
**không biết** `useSearchParams`. Thêm `USE_SEARCH_PARAMS_RE`.

### 2.3 `nav1-report.mjs` tự viết lại regex — lỗi 3, phát hiện khi sửa

`nav1-report.mjs:54` hard-code lại regex của gate, **đúng cái mà comment ở chính
header file cấm** (*"KHÔNG tự viết lại regex"*). Sau khi rule sửa, báo cáo và
gate **lệch số**: `escaped` 7 → 23 trong khi gate chỉ giảm 15 ⇒ có **16 dòng
"bị bỏ qua" chỉ do báo cáo**, in ra như bằng chứng hợp lệ.

Sửa bằng `destructureName()` dùng chung `NAME_RE` + `isQueryToken`.

## 3. Bằng chứng fail-before / fail-after

### 3.1 Self-test scanner (5 → 8 case)

| Case | Nội dung | Rule cũ | Rule mới |
|---|---|---|---|
| **T6** | `quantity`/`queueTiers` không phải bộ lọc | **FAIL** | PASS |
| **T7** | `q` + `qValue` thật **vẫn** bắt | PASS | PASS |
| **T8** | escape `searchParams` từ `useRouterSearchParams` | **FAIL** | PASS |
| T1–T5 | 5 case của wave 4 | PASS | PASS |

**8/8 PASS**; trước khi sửa rule: **2/8 FAIL** (output đã lưu).

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
| `NAV-1` (budget) | 104 | **89** | baseline **đã chốt lại** 162 |
| classify A / C / D | 12 / 3 / 89 | **0 / 0 / 89** | **D giữ nguyên 89** ⇒ không bỏ sót ứng viên thật |
| 10 rule khác của budget | — | **không đổi** | không rule nào biến mất |

## 6. Gate đã chạy thật

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

## 7. CHƯA LÀM

- **89 hit NAV-1** còn lại là **code thật**, phải sửa bằng `useUrlRecord` /
  `useUrlState`. Ưu tiên theo số hit: `SocSignalsPanel.tsx` (11) ·
  `SocOverviewPanel.tsx` (7) · `AIAuditLogsPanel.tsx` (5) ·
  `SocDataOpsMonitorSection.tsx` (5).
- `check-h1-graph --gate` vẫn **đỏ** vì `shell-ai-command-center` — **cần Owner
  quyết** (handoff wave 4 §2.1).
- 46 hit `CSS-2` (`prefers-reduced-motion`) — non-goal từ wave 2.
- Mobile Playwright: route cần đăng nhập, `auth.setup.ts` login vào preview
  không có backend.
- **CHƯA CHẠY**: `check-h1-graph --self-test` · `check:tokens` · `check:contrast`
  · `check:dom-landmarks` · `check:ts-imports` · `check:i18n-hardcoded` ·
  `check:admin-spa-routes` · `check:shell` · `i18n:scan:strict` ·
  `check_large_files.ps1` · `pre-push-gate` · Playwright · BE test ·
  `makemigrations` (N/A — không sửa backend).

## 8. Bài học (đã ghi vào comment trong code)

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