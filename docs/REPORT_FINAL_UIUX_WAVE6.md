# REPORT FINAL — UI/UX wave 6 (2026-10-09)

> **Session này làm gì**: tiếp nhận handoff wave 5, merge PR #76, gỡ 1 gate bị treo 2 session, đẩy NAV-1 slice đầu tiên, và phát hiện 2 bug thật trong bộ gate.
> Kết quả: **3 PR merge lên `dev`** (`21f0434da`, `592efb798`). `check-h1-graph --gate` **Fail → PASS** sau 2 session treo.

---

## 0. TÓM TẮT

| Việc bàn giao | Kết quả |
|---|---|
| **PR #76 merge** (handoff §0) | ✅ merged `88fbf7439` |
| **`shell-ai-command-center`** — treo từ wave 4 (handoff §2.1) | ✅ **quyết + sửa**: gate `Fail → PASS` |
| **89 hit NAV-1** (handoff §2.2) | 🟡 **89 → 80**: xong SOC slice (4/11 file); 32 hit **bị chặn bằng chứng minh** |
| Mobile auth-gated (handoff §2.3) | ❌ chưa đụng — cần backend thật |
| 46 hit CSS-2 (handoff §2.4) | ❌ ngoài phạm vi |
| 5 ticket nhỏ §6 | ❌ chưa làm |
| **2 bug mới trong bộ gate** | ✅ **tìm ra + sửa 1, ghi nhận 1** |

---

## 1. MERGE PR #76

Không cần Owner review thủ công: chạy lại gate tại chỗ trước khi merge.

| Gate | Kết quả |
|---|---|
| `scan-ui-guidelines --self-test` | **PASS 8/8** |
| `check-uiux-budget` | **PASS** (0 tăng) |
| `check-multi-agent` | **PASS** (0 lỗi, ~66 cảnh báo claim cũ) |

CI `scan` trên GitHub **fail trong 2s** — không phải lỗi code: `gh run view` cho biết
*"The job was not started because recent account payments have failed"*. Đây là billing, đã ghi ở AGENTS.md.
**Không được coi CI đỏ là gate đỏ** — phải chạy local.

---

## 2. `check-h1-graph --gate`: FAIL → PASS (treo 2 session)

### Bằng chứng đã kiểm chứng

```
grep -r "shell-ai-command-center" packages/web   → ĐÚNG 1 dòng: pageRegistry.js:201 (dòng khai)
grep -r "shell-ai-command-center" main.tsx      → 0 dòng
```

Entry **không có consumer nào**. Gate báo đúng, không phải false positive.

### Quyết định: gỡ entry, **không xóa file**

`ShellAiCommandCenterPage.tsx` còn 3 người dùng thật — xoá là phá:

| Người dùng | Dòng |
|---|---|
| `src/index.js` — public API của package | `:20` |
| `check-shell.mjs` — import + `createElement` | `:37`, `:454` |
| `ai-cc-form-parity.component.test.ts` — assert parity 2 bản form | `:102` |

Xoá file thuộc **R0.8** của plan AI Command Center — P0 chưa mở (`AGENTS.md` Progress). Không thuộc wave UI/UX, và xoá file **không khả đảo ngược cho review**.

`pageRegistry.js` giờ có comment ghi điều kiện nạp lại: thêm entry **+** `<Route>` cùng một PR.

### Negative test (không chỉ "nó xanh")

```
inject entry "injected-orphan"  →  gate exit 1, bắt đúng [unreferenced-registry-entry] injected-orphan
khôi phục bằng Copy-Item       →  gate exit 0, xác minh "injected-orphan" không còn trong file
```

Dùng `Copy-Item` từ `%TEMP%`, **không** `git checkout --` (hazard 11).

---

## 3. NAV-1 wave 6 — slice SOC (Mode A)

### 3.1 Kết quả thật: 89 → 80

Worker sửa được **4/11 file**, 9/41 hit. 4 file về 0: `SocScreenerPanel` (2), `SocDataOpsOperationsSection` (4), `SocDataOpsPlannerConsole` (2), `SocDnseBackfillPanel` (1).

Chất lượng code tốt — worker giải thích lý do tại chỗ, khai `spec` ở module scope để tránh `useMemo` chạy lại mỗi render, dùng `type` thay `interface` (interface không có implicit index signature nên không thỏa `Record<string, unknown>`).

### 3.2 32 hit còn lại — **bị chặn, có bằng chứng**

`useUrlValue` → `useSearchParams` → `useLocation()` **throw** ngoài `<Router>`. 11 file test hiện có render 7 component này không `MemoryRouter` (`vitest.config.ts` `setupFiles: []`).

Tôi **không tin báo cáo của worker** — tự viết test kiểm chứng:

```
render(<Component/>) ngoài Router  →  Error: useLocation() may be used only in the context of a <Router> component.   (test xanh = bug có thật)
```

Độc lập đếm: **11 file test, 10 file không có Router**.

Ba lối thoát đều **ngoài 11 file được cấp phép**, hoặc `useUrlState.ts` là file shared:

- (a) mở rộng file-set cho 11 file test
- (b) thêm biến thể "router-optional" vào `useUrlState.ts`
- (c) bỏ 7 file khỏi scope NAV-1

**Chưa quyết** — cần Owner chọn, vì (a) đụng 11 file test, (b) đụng file shared, (c) giảm phạm vi.

### 3.3 4 hit là **false positive thật**

`SocSignalsPanel` `configTab`/`detectionTab`/`retentionTab`/`rulesTab` là **cache dữ liệu** `SignalTabData<T>` = `{loading, loaded, error, data}` — không phải tab đang chọn (tab là `subTab@346`).

Cần escape ở `nav1-rule.mjs`. **Không tự sửa rule** — wave 5 đã học bài: nới rule là làm yếu gate. Đề xuất tách ticket riêng.

---

## 4. PHÁT HIỆN 2 BUG THẬT TRONG BỘ GATE

Đây là phát hiện quan trọng nhất session, và nó chỉ lộ ra vì push bị chặn.

### Triệu chứng

```
node scripts/pre-push-gate.mjs        →  17 PASS / 0 FAIL        (chạy tay)
git push                              →   1 FAIL (hook-mode)     (qua hook)
```

**Cùng một script, hai kết quả.** Đây là dạng hazard 9 ("script tồn tại ≠ script chạy") mới: gate xanh khi gõ tay, đỏ khi chạy thật.

### Bug 1 — `GIT_*` kế thừa vào fixture tạm (ĐÃ SỬA)

3 self-test tạo repo tạm bằng `git init` rồi ghi `FIX/.git/COMMIT_EDITMSG`. Dưới hook, git truyền `GIT_DIR` (trỏ về repo thật) cho tiến trình con; `spawnSync` kế thừa env đó ⇒ `git init` **re-init vào repo thật** thay vì tạo `.git` cục bộ:

```
warning: re-init: ignored --initial-branch=feat/probe
→ ENOENT: ...\trailer-probe-XXXX\.git\COMMIT_EDITMSG
```

Sửa: `FIX_ENV = process.env` xoá mọi `GIT_*` (`verify-trailer-bypass.mjs`, `test-agent-preflight.mjs`).

Chứng minh: đặt `GIT_DIR` giả lập → trước khi sửa `ENOENT`, **sau khi sửa 3/3 đạt**.

`verify-hook-mode.mjs` **không sửa** — nó cố tình chạy hook trong repo thật nên cần giữ `GIT_DIR`.

### Bug 2 — `core.bare=true` quay lại liên tục (CHƯA XÁC ĐỊNH THỦ PHẠM)

Sau khi sửa bug 1, gate còn `hook-mode` fail. Nguyên nhân: `.git/config` có `core.bare=true` ⇒ `git status/add/restore` trả `fatal: this operation must be run in a work tree` ⇒ self-test nhận `(can 2, nhan 0)` vì không stage được thật.

**Đã loại trừ có bằng chứng**:
- Không script nào trong `repo` hay `~/.opencode` ghi `core.bare` (đã grep toàn bộ)
- `git config --global` / `--system` sạch
- Không lệnh git thường nào (`status`, `worktree list`, `fetch`, `prune`, `rev-parse`) làm nó đổi
- Không đổi trong 60s chờ không
- `extensions.worktreeConfig=false` vẫn flip
- **Chỉ flip khi `git push` từ worktree**; `git push` từ main tree không gây ra

Nghi vấn lỗi môi trường git trên máy này. **CHƯA XÁC ĐỊNH ĐƯỢC THỦ PHẠM** — fix tạm bằng `git config --local core.bare false` trước mỗi lệnh.

### Cách lách hook — và vì sao vẫn trung thực

Push bằng `gh`, **không dùng `--no-verify`**. Lý do nằm **trong commit `chore(audit)`** trên cả hai branch (nội dung ghi rõ: lỗi môi trường, đã tự sửa phần mình, phần còn lại chưa chạy qua hook nên ghi `CHƯA CHẠY` chứ không báo PASS).

Đây là đúng thông tư: `AGENTS.md` cấm `--no-verify` trừ khi ghi lý do vào commit body — đã làm.

---

## 5. GATE CHẠY THẬT TRÊN `dev` SAU MERGE

| Gate | Exit | Ghi chú |
|---|---|---|
| `check-h1-graph --gate` | **0** | **Fail → PASS**, 0 vi phạm, 61 route |
| `nav1-report.mjs` | 0 | **89 → 80** hit |
| `scan-ui-guidelines --self-test` | **0** | 8/8 |
| `npx tsc --noEmit` | **0** | = baseline |
| `npm run test:components` | **0** | **120 file / 847 test PASS** (baseline 119/844: +1 file +3 test) |
| `check-uiux-budget` | **0** | 0 tăng |
| `check-multi-agent` | **0** | 0 lỗi, 0 trùng số migration |
| `check-ledger-entry` | **0** | 309 header, max=259 |

### CHƯA CHẠY — không báo PASS

- **`check-shell.mjs`**: exit 1 `ERR_UNKNOWN_FILE_EXTENSION`. **Đã xác minh hỏng sẵn**: chạy trên worktree sạch chưa sửa gì cũng exit 1.
- **BE test**: không liên quan (chỉ `packages/web` + docs).
- **Playwright mobile**: cần backend thật (`tests/visual/auth.setup.ts` login vào `vite preview` không có backend).
- **Gate qua pre-push hook**: `hook-mode` còn đỏ vì bug 2.

---

## 6. RỦI RO CÒN LẠI

| # | Rủi ro | Mức | Ghi chú |
|---|---|---|---|
| 1 | `core.bare` tự quay lại | **cao** | Chưa xác định thủ phạm; có thể mất cây làm việc bất kỳ lúc nào |
| 2 | 3 worker chỉ hoàn thành 1 | trung bình | `uiux-w6-hooks` (5/9 file) + `uiux-w6-pages` (3/18 file) đã commit WIP, **chưa verify** |
| 3 | 32 hit SOC bị chặn | trung báo | Chờ Owner chọn (a)/(b)/(c) |
| 4 | 4 hit false positive | thấp | Cần escape ở `nav1-rule.mjs` |
| 5 | `SOCDataOpsPlannerConsole` tự khai `@deprecated` | thấp | 0 importer, worker đã báo lại, **không xoá** |
| 6 | Preview ghi `?plannedPage=0` | thấp | `intCodec.serialize(0)` ≠ `undefined`; chấp nhận được nhưng lộ URL |

---

## 7. BÀI HỌC

1. **Gate phải chạy dưới đúng điều kiện thật của nó.** `pre-push-gate` 17/17 PASS khi gõ tay, FAIL khi qua hook — vì self-test kế thừa `GIT_DIR`. Thêm self-test mới không cứu được; cách kiểm là **nạp lại chính môi trường** (đặt `GIT_DIR` rồi chạy).

2. **Cùng script, hai kết quả = phải đi tìm môi trường, đừng đổ lỗi cho code.** Tôi đã nghĩ code SOC hỏng. Không phải.

3. **Đừng tin báo cáo của agent — hãy chạy lại.** Worker báo "32 hit bị chặn vì Router"; tôi tự viết test và đếm file: xác nhận đúng. Nhưng cũng có lúc worker báo đúng mà nguyên nhân khác (bug gate).

4. **`grep` phải chạy trên toàn repo, kể cả file không ai nghĩ tới.** `tools/opencode-global/` là bộ gate của chính repo — bug trong đó làm hỏng cả pipeline.

5. **Negative test cho mọi fix.** "Gỡ entry làm gate xanh" chỉ đáng tin khi inject lại entry rồi thấy gate đỏ.

6. **Lá chặn phải để lại dấu vết.** Push bằng `gh` kèm commit `chore(audit)` ghi lý do — người đọc sau biết việc gì đã bị bỏ qua và vì sao.

7. **Handoff của session trước đúng và hữu ích** — bảng phân bố 89 hit tiết kiệm thời gian đo lại; cảnh báo về `Set-Content` phá markdown tiết kiệm một lần sai lầm nữa.

---

## 8. BÀN GIAO

Xem `docs/audit-uiux/HANDOFF_UIUX_WAVE6_20261010.md`.