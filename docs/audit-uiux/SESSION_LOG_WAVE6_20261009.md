# NHẬT KÝ SESSION — UI/UX wave 6 (2026-10-09)

> **Session này**: tiếp nhận handoff wave 5, merge 4 PR, gỡ 1 gate bị treo 3 wave, đẩy NAV-1 từ **89 → 60 hit**, phát hiện **2 bug thật trong bộ gate** và **6 bug runtime** do chính việc chuyển state sang URL.
> **Kết quả**: `dev` = `c008cba39`, 4 PR merged, **854/854 test PASS**, `lint` **0 error**, `tsc` 0.

---

## 1. NHẬT KÝ THEO THỨ TỰ THỜI GIAN

| # | Việc | Kết quả |
|---|---|---|
| 1 | Mở phiên: `agent-sync`, `git status`, đọc handoff wave 5 | `uiux-w5-nav1` branch, PR #76 đang OPEN |
| 2 | **Merge PR #76** (wave 5) | Chạy lại gate tại chỗ: self-test 8/8, budget 0, multi-agent 0 → merge `88fbf7439` |
| 3 | Điều tra `shell-ai-command-center` (treo từ wave 4) | Xác minh **0 consumer**; quyết: gỡ entry, **không xoá file** |
| 4 | Chia NAV-1 89 hit thành 3 slice file-rời-nhau | 3 worktree + junction + hook config |
| 5 | Chạy 3 worker song song | **2/3 bị rate-limit cắt**; SOC hoàn thành |
| 6 | Nghiệm thu SOC slice | 120 file/847 test PASS; tự verify lại, không tin báo cáo |
| 7 | Tìm nguyên nhân `check-h1-graph --gate` FAIL | `core.bare=true` + self-test kế thừa `GIT_DIR` |
| 8 | Sửa 2 bug bộ gate | 1 sửa được, 1 **chưa xác định** |
| 9 | Viết Entry 259 + REPORT_FINAL + HANDOFF | PR #79 merged `04e7d1709` |
| 10 | **Owner yêu cầu làm phương án (a)** | Bọc Router cho test + migrate SOC |
| 11 | Xong 5 panel (14 hit) + đóng 2 lint error | PR #80 merged `c008cba39` |

---

## 2. GATE CHẠY THẬT TRÊN `dev` (sau merge)

| Gate | Exit | Ghi chú |
|---|---|---|
| `check-h1-graph --gate` | **0** | **Fail → PASS**; 0 vi phạm; 61 route |
| `nav1-report.mjs` | 0 | **89 → 60** hit |
| `scan-ui-guidelines --self-test` | **0** | 8/8 |
| `npx tsc --noEmit` | **0** | = baseline |
| `npm run test:components` | **0** | **120 file / 854 test PASS** |
| `npm run lint` | **0** | **0 error**, 3764 warning |
| `npm run build` | **0** | 34.81s |
| `check-uiux-budget` | **0** | 0 tăng |
| `check-multi-agent` | **0** | 0 lỗi, 0 trùng số migration |
| `check-ledger-entry` | **0** | max=259 |
| `pre-push-gate` (tay) | **0** | 17 PASS / 0 FAIL |

### CHƯA CHẠY — không báo PASS

- **`check-shell.mjs`**: exit 1 `ERR_UNKNOWN_FILE_EXTENSION`. **Đã xác minh hỏng sẵn** trên worktree sạch chưa sửa gì.
- **BE test**: không liên quan (chỉ `packages/web` + docs).
- **Playwright mobile**: cần backend thật.
- **Gate qua pre-push hook**: `hook-mode` còn đỏ (mục 5.1).

---

## 3. 6 BUG RUNTIME BẮT ĐƯỢC — DO CHÍNH VIỆC CHUYỂN SANG URL

Đây là phần đáng giá nhất. **Không cái nào tồn tại trước** — tất cả do `useState` → `useUrlState`.

| # | Bug | Hậu quả | Bắt bởi |
|---|---|---|---|
| 1 | `page` nằm trong deps của effect debounce | Mỗi lần bấm trang bị `setPage(1)` **đè mất** lựa chọn | `W6-1` (URL ra `page=1` thay vì `2`) |
| 2 | Effect gọi `load(1)` hardcode | Deep-link `?page=3` bị bỏ qua, nạp trang 1 | `W6-3` |
| 3 | `setPage(1)` chạy ở mount | Xoá mất deep-link ngay lập tức | `W6-O1` |
| 4 | Clamp `safePage` khi `services` còn rỗng | `totalPages=1` ⇒ ghi đè URL **vĩnh viễn** | `W6-O1` |
| 5 | Setter của `useUrlValue` nhận **giá trị**, không phải updater lambda | Truyền lambda ⇒ ghi chuỗi hàm vào URL | `tsc` TS2345, 5 call site |
| 6 | `<output>` của probe có implicit ARIA role `status` | Phá assertion `queryByRole("status")` của test khác | `soc-queue-depth` đỏ |

### Bài học đắt nhất

Thêm `page` vào deps để **hết cảnh báo eslint** ⇒ **3 test đỏ**. ESLint đúng; cách sửa của tôi sai. Cách đúng: `ref` trỏ setter mới nhất + `useCallback` deps rỗng.

`useCallback` bọc `setOverviewState` **không giúp** — `setState` đổi tham chiếu mỗi render.

---

## 4. 2 BUG TRONG BỘ GATE

### 4.1 ĐÃ SỬA — `GIT_*` kế thừa vào fixture tạm

3 self-test tạo repo tạm bằng `git init` rồi ghi `FIX/.git/COMMIT_EDITMSG`. Dưới hook, git truyền `GIT_DIR` cho tiến trình con ⇒ `git init` **re-init vào repo thật** ⇒ `ENOENT`.

```
warning: re-init: ignored --initial-branch=feat/probe
→ ENOENT: ...\trailer-probe-XXXX\.git\COMMIT_EDITMSG
```

Sửa ở `verify-trailer-bypass.mjs` + `test-agent-preflight.mjs` (xoá mọi `GIT_*` khỏi env). `verify-hook-mode.mjs` **cố ý không sửa** — nó chạy hook trong repo thật nên cần giữ `GIT_DIR`.

**Triệu chứng gốc**: `pre-push-gate` chạy tay **17/17 PASS**, qua `git push` **FAIL**. Cùng script, hai kết quả.

### 4.2 CHƯA XÁC ĐỊNH — `core.bare=true` tự quay lại

`.git/config` tự có `core.bare=true` ⇒ `git status/add/restore` trả `fatal: this operation must be run in a work tree`.

**Đã loại trừ bằng chứng** (đừng đo lại):
- Không script nào trong repo hay `~/.opencode` ghi `core.bare` — grep toàn bộ
- `git config --global` / `--system` sạch
- Không lệnh git thường nào làm đổi (`status`, `worktree list`, `fetch`, `prune`, `rev-parse`, `config --list`)
- Không đổi trong 60s chờ không có gì chạy
- `extensions.worktreeConfig=false` vẫn flip
- **Chỉ flip khi `git push` từ worktree**; push từ main tree không gây ra

**Fix tạm mỗi lần**: `git config --local core.bare false`

---

## 5. BÀN GIAO — VIỆC CÒN TỒN ĐỌNG

### 5.1 ⚠️ `core.bare` — ưu tiên cao, chặn push

Xem mục 4.2. Cần bắt được lệnh ghi — thử **Process Monitor**, hoặc `GIT_TRACE=1` khi push.

### 5.2 2 branch WIP — **CHƯA VERIFY, CHƯA PUSH**

| Worktree | Branch | Trạng thái |
|---|---|---|
| `C:\Mujoco Projects\uiux-w6-hooks` | `feat/uiux-w6-hooks` | commit `9885f2ea1` — 5/9 file (77 dòng) |
| `C:\Mujoco Projects\uiux-w6-pages` | `feat/uiux-w6-pages` | commit `bae85e53a` — 3/18 file |

⚠ **Trước khi làm tiếp**: chạy `tsc` + `test:components` + `nav1-report` trên từng branch. Đỏ ⇒ sửa hoặc revert. **Không** push nguyên trạng.

Nội dung WIP:

- **hooks**: `OrderFlowRadarPanel.js`, `WhaleBubbleChart.jsx`, `WorkstationLayout.jsx`, `Header.tsx` + test `useStockDetailPageModel`
- **pages**: `PortfolioActivityPage.tsx`, `TenantAdminHomePage.tsx`, `TenantUsageSummaryPage.tsx`

Còn chưa làm: `useAlertCenterFilters.ts` (6 hit), `WatchlistTable.tsx` (4), `ScreenerResultsTable.tsx` (3), `useWhaleAdvisoryData.js` (2), `AIAuditLogsPanel.tsx` (5), `AIUsageDashboard.tsx` (4), `WhaleAdvisoryPage.tsx` (3), `AICommandCenterPage.tsx` (2) + 11 file 1 hit.

### 5.3 `SocSignalsPanel` (11 hit) — **đã thử, chưa xong, đã rollback**

Không merge thay đổi chưa verify. Nguyên nhân:

- **11 hit** = 7 thật + **4 false positive** (`configTab`/`detectionTab`/`retentionTab`/`rulesTab` là **cache dữ liệu** `SignalTabData<T>` = `{loading, loaded, error, data}`, không phải tab đang chọn — tab là `subTab`)
- Khi bọc Router cho 2 test file, **2 test có sẵn bắt đầu fail** (phân trang trả 20 thay vì 25). Đã xác minh nguyên nhân ở phần chuyển state sang URL, **không** phải do bọc Router
- Component có 4 subtab lazy-load + polling + chọn nhiều → cần thêm thời gian phân tích

### 5.4 NAV-1 còn 60 hit / 29 file — phân bố đã đo

| Nhóm | File | Hit | Ghi chú |
|---|---|---|---|
| SOC | 1 | **11** | mục 5.3 |
| hooks | 2 | **8** | `useAlertCenterFilters` (6) + `useWhaleAdvisoryData` (2) — **trùng WIP** |
| AI CC | 2 | **9** | `AIAuditLogsPanel` (5) + `AIUsageDashboard` (4) |
| watchlist/screener | 2 | **7** | `WatchlistTable` (4) + `ScreenerResultsTable` (3) — **trùng WIP** |
| pages khác | 3 | **5** | `WhaleAdvisoryPage` (3) + `AICommandCenterPage` (2) |
| còn lại | 19 | **20** | rải rác 1-2 hit/file |

⚠ **8 hit trong bảng trên đã nằm trong 2 branch WIP** (mục 5.2) — tính lại sau khi xử lý WIP.

### 5.5 4 hit false positive — cần escape `nav1-rule.mjs`

| Biến | Vì sao false positive |
|---|---|
| `SocSignalsPanel.configTab/detectionTab/retentionTab/rulesTab` | cache `SignalTabData<T>`, không phải tab đang chọn |
| `SocOverviewPanel.debouncedSearch` | bản sao debounce của `search` (giữ nguyên có chủ đích) |

⚠ **Không nới rule vội.** Wave 5 đã học bài: nới rule là làm yếu gate. Cần self-test khoá hành vi mới (tương tự T1–T8).

### 5.6 5 trang admin có `filtersDraft` — cố ý bỏ qua

Quy định tại `hooks/useUrlState.ts:9-10`:
> "AC-4: chỉ đồng bộ state **đã áp dụng**. State `*Draft` **tuyệt đối không** đưa vào URL — nếu đồng bộ cả hai sẽ `useEffect` loop."

⚠ **Đừng "sửa" cho hết số.**

### 5.7 `check-shell.mjs` hỏng

`ERR_UNKNOWN_FILE_EXTENSION`. Xác minh hỏng sẵn trên worktree sạch. Chưa ai sửa.

### 5.8 5 ticket nhỏ từ handoff wave 5 §6

- `expiresWithinDays` kiểu `string` → `number`
- Debounce cho ô nhập văn bản (W-4)
- Tối ưu scanner 211–312 s
- Rule `quote`/`q` — cần **AST**, không phải regex
- Nút "Xoá bộ lọc" (đã undo-back)

### 5.9 Mobile Playwright

Cần backend thật hoặc `storageState` giả lập.

---

## 6. BẪY ĐÃ TỐN THỜI GIAN THẬT

### 6.1 ⚠️ Gate xanh khi chạy tay ≠ xanh khi chạy thật
`pre-push-gate` 17/17 tay, FAIL qua hook. Xem mục 4.1.

### 6.2 ⚠️ `WriteAllText` biến file thành CRLF
Diff phình từ **142 dòng → 3976 dòng**. Nguyên nhân: **mỗi file trong repo có line-ending khác nhau** — `SocOverviewPanel.tsx` là CRLF, `SocScreenerPanel.tsx` là LF.
🔧 `git diff --numstat` **trước khi commit**; nếu mọi dòng đều đổi ⇒ là line-ending.

### 6.3 ⚠️ `Set-Content` phá file markdown
Dùng `edit` tool cho `.md`.

### 6.4 ⚠️ `git rm --cached` phá index của worktree
Làm 13 file `tools/opencode-global/` biến mất khỏi `git ls-files` → `global-config-drift` FAIL với thông báo sai lệch.
🔧 `git reset --hard HEAD` — **kiểm tra `git status` trước**.

### 6.5 ⚠️ `core.autocrlf=true` gây `global-config-drift`
🔧 `git config --local core.autocrlf false` + `git reset --hard HEAD`, rồi `node tools/opencode-global/deploy.mjs`.

### 6.6 ⚠️ Test đặt sai `describe` block
Block không có `beforeEach` mock ⇒ component render không có dữ liệu, mọi `getByText` fail. **Tạo block riêng có mock.**

### 6.7 ⚠️ `currentUrl()` đọc probe đầu tiên
Một file nhiều test ⇒ đọc nhầm probe của test trước. **PASS khi chạy `-t` riêng, FAIL khi chạy cả file.**
🔧 Lấy probe **cuối cùng**.

### 6.8 ⚠️ Test tự nhiên chứng minh "pass" không đủ
Đã xảy ra 3+ lần. Cố tình làm hỏng code, kiểm gate đỏ **trước khi** tin.

### 6.9 Không pipe script vào `Select-Object` — treo. Scanner chạy 3–5 phút (timeout ≥ 400000).
### 6.10 `npx tsc --noEmit` phải chạy từ `packages/web` — từ repo root dùng sai binary.

---

## 7. BÀI HỌC

1. **Gate phải chạy dưới đúng điều kiện thật.** Thêm self-test mới không cứu được — phải **nạp lại chính môi trường** (đặt `GIT_DIR` rồi chạy).
2. **Cùng script, hai kết quả = đi tìm môi trường, đừng đổ lỗi cho code.** Tôi đã nghĩ code hỏng.
3. **Đừng tin báo cáo agent — hãy chạy lại.** Worker báo blocker đúng; tôi tự viết test xác nhận.
4. **"Hết cảnh báo eslint" không phải tiêu chuẩn.** Thêm `page` vào deps ⇒ 3 test đỏ.
5. **Migration cơ chế state có bug riêng, không chỉ bug cú pháp.** 6 bug ở mục 3 đều do `useState` → URL, không cái nào có sẵn.
6. **Grep toàn bộ `components/soc/`**, không chỉ file được giao — 6/7 file về 0.
7. **Rollback thay vì merge thay đổi chưa verify** — `SocSignalsPanel` làm thế.
8. **Đo lại bằng script, đừng tin mắt thường** — `git diff --numstat` phát hiện ngay CRLF.

---

## 8. TÀI LIỆU LIÊN QUAN

| File | Nội dung |
|---|---|
| `docs/CODE_CHANGE_AUDIT_LEDGER.md` → `## Entry 259` | Ledger phiên này (wave 6 phần 1) |
| `docs/REPORT_FINAL_UIUX_WAVE6.md` | Báo cáo đầy đủ 3 kết quả + 2 bug gate |
| `docs/audit-uiux/HANDOFF_UIUX_WAVE6_20261010.md` | Bàn giao 13 bẫy (bổ sung mục 6 ở đây) |
| `docs/audit-uiux/scripts/nav1-rule.mjs` | **Đọc comment đầu file** trước khi sửa rule |
| `packages/web/src/components/__tests__/socRouterHarness.tsx` | Helper bọc Router — dùng lại cho panel sau |

---

## 9. VIỆC ĐẦU TIÊN CỦA SESSION SAU

1. `git config --local core.bare false` nếu `git status` báo lỗi
2. Xử lý `core.bare` (mục 5.1) — chặn push
3. Quyết định 2 branch WIP: verify hay revert (mục 5.2)
4. Sau đó mới chọn: `SocSignalsPanel` (mục 5.3) hoặc 4 hit false positive (mục 5.5)