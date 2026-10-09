# HANDOFF — session sau UI/UX wave 6 (2026-10-10)

> # ⚠️ TÀI LIỆU NÀY ĐÃ BỊ THAY THẾ — ĐỪNG LÀM THEO
>
> **Bản đúng:** **`SESSION_LOG_WAVE6_20261009.md`** (cùng thư mục).
> **Ngày bị thay:** 2026-10-09, sau khi PR #80 merge.
>
> **Vì sao hỏng.** File này viết lúc **18:52**, **trước** khi Owner chọn phương án
> (a) cho 32 hit SOC. Ba chỗ dưới đây đã thành sai:
>
> | Chỗ | Nội dung cũ (sai) | Thực tế |
> |---|---|---|
> | §0 | `NAV-1 hit = 89 → 80` | **89 → 60** |
> | §2.3 | *"32 hit SOC bị chặn — **CẦN OWNER CHỌN** (a)/(b)/(c)"* | Owner **đã chọn (a)**; 32 hit đó **đã xử lý xong** |
> | §2.2 | cần đo lại phân bố 80 hit | đã đo xong, xem `SESSION_LOG` §5.4 |
>
> Giữ file lại **để lưu dấu vết** (không xoá — `AGENT_PROTOCOL.md` §3 cấm xoá claim
> cũ). Nhưng **mọi quyết định phải dựa trên `SESSION_LOG_WAVE6_20261009.md`**.
>
> Đây chính là **hazard 3** (trích dẫn thối): tài liệu viết ra rồi tự nó cũ đi
> trong vài giờ, và người đọc tin nó. Xem skill `agent-lessons`, mục 3.

---

> **Phần dưới đây giữ nguyên theo trạng thái 18:52, để tham khảo lịch sử.**
> Đọc `SESSION_LOG_WAVE6_20261009.md` cho trạng thái hiện tại.

> **Đọc theo thứ tự này.** Mục 1 là bản đồ, mục 2 là việc dở dang, mục 3 là bẫy đã tốn thời gian thật.
> Repo `C:\Mujoco Projects\vninvest`, nhánh tích hợp `dev`.

---

## 0. TRẠNG THÁI KHI BÀN GIAO

| Việc | Trạng thái |
|---|---|
| **PR #76** (wave 5) | ✅ **MERGED** `88fbf7439` |
| **PR #77** (`uiux-w6-registry`) | ✅ **MERGED** `21f0434da` |
| **PR #78** (`uiux-w6-soc`) | ✅ **MERGED** `592efb798` |
| `check-h1-graph --gate` | ✅ **PASS** (Fail 3 wave, treo 2 session — đã gỡ) |
| NAV-1 hit | **89 → 80** |
| `dev` | `592efb798` |

**Việc đầu tiên của session sau: xử lý `core.bare` (mục 3.1)**, rồi mới làm việc mới. Đây là lỗi môi trường có thể làm hỏng bất kỳ cây làm việc nào.

---

## 1. BẢN ĐỒ NHANH

| Cần đọc | Vì sao |
|---|---|
| `docs/REPORT_FINAL_UIUX_WAVE6.md` | **Báo cáo đầy đủ**: 3 kết quả, 2 bug gate, bằng chứng, 7 bài học |
| `docs/CODE_CHANGE_AUDIT_LEDGER.md` → `## Entry 259` | Cùng nội dung dạng ledger |
| `docs/audit-uiux/HANDOFF_UIUX_WAVE5_20261009.md` | Lịch sử — **§2.1 đã đóng** (xem mục 3.6) |
| `docs/audit-uiux/scripts/nav1-rule.mjs` | **Đọc comment đầu file** trước khi sửa rule |

### Số đo đã đúng (đã đo lại, không phải đo lại lần nữa)

| Số đo | Giá trị |
|---|---|
| NAV-1 `counted` | **80** (trước session: 89) |
| `scan-ui-guidelines` TONG | **153** |
| `test:components` | **120 file / 847 test** |
| `lint` | 3755 warning, **0 error** (baseline 3754, +1 từ `data-testid` test mới) |

### Công cụ đã đúng (đã đo lại)

```powershell
node docs/audit-uiux/scripts/nav1-report.mjs packages/web/src --json   # có --json, dùng được
node docs/audit-uiux/scripts/nav1-classify.mjs packages/web/src        # A=0 C=0 D=80
node docs/audit-uiux/scripts/check-h1-graph.mjs --gate                 # PASS 0 vi phạm
node docs/audit-uiux/scripts/scan-ui-guidelines.mjs packages/web/src --self-test  # 8/8
node packages/web/scripts/check-uiux-budget.mjs                       # exit 0
node docs/audit-uiux/scripts/check-ledger-entry.mjs                   # max=259
node packages/web/scripts/check-multi-agent.mjs                       # exit 0
```

---

## 2. VIỆC DỞ DANG

### 2.1 `core.bare=true` — CHƯA XÁC ĐỊNH THỦ PHẠM ⚠️ ưu tiên cao

`.git/config` tự có `core.bare=true` ⇒ `git status` / `git add` / `git restore` trả:
```
fatal: this operation must be run in a work tree
```

**Đã loại trừ** (đừng đo lại):
- Không script nào trong repo hay `~/.opencode` ghi `core.bare` — đã grep toàn bộ
- `git config --global` / `--system` sạch
- Không lệnh git thường nào làm nó đổi (`status`, `worktree list`, `fetch`, `prune`, `rev-parse`)
- Không đổi trong 60s chờ không có gì chạy
- `extensions.worktreeConfig=false` vẫn flip
- **Chỉ flip khi `git push` từ worktree**; push từ main tree không gây ra

**Fix tạm mỗi lần**:
```powershell
git config --local core.bare false
```

**Cách điều tra tiếp**: nó chỉ xảy ra khi `git push` chạy pre-push hook. Nhưng hook không ghi `core.bare`. Có thể là hook của opencode chạy song song, hoặc `git` tự ghi khi `gitdir` không khớp. Cần bắt được lệnh ghi — thử dùng Process Monitor, hoặc đặt `GIT_TRACE=1` khi push.

### 2.2 2 branch có commit WIP — **CHƯA VERIFY, KHÔNG merge**

| Worktree | Branch | Trạng thái |
|---|---|---|
| `C:\Mujoco Projects\uiux-w6-hooks` | `feat/uiux-w6-hooks` | commit WIP: 5/9 file (OrderFlowRadarPanel, WhaleBubbleChart, WorkstationLayout, Header + test) |
| `C:\Mujoco Projects\uiux-w6-pages` | `feat/uiux-w6-pages` | commit WIP: 3/18 file (PortfolioActivityPage, TenantAdminHomePage, TenantUsageSummaryPage) |

**Cả hai bị cắt bởi rate-limit giữa chừng.** Việc đã viết được giữ lại để không mất.

⚠ **Trước khi làm tiếp**: chạy `tsc` + `test:components` + `nav1-report` trên từng branch. Nếu đỏ ⇒ sửa hoặc revert, **không** push nguyên trạng.

### 2.3 32 hit SOC bị chặn — CẦN OWNER CHỌN

`useUrlValue` → `useSearchParams` → `useLocation()` **throw** ngoài `<Router>`. 11 file test hiện có render 7 component SOC **không MemoryRouter**.

Ba lối thoát:
- **(a)** mở rộng file-set cho 11 file test
- **(b)** thêm biến thể "router-optional" vào `useUrlState.ts` (file shared)
- **(c)** bỏ 7 file khỏi scope NAV-1

⚠ Worker **không tự chọn** — cả 3 đều ngoài phạm vi được giao. Đây là lý do còn 32 hit.

### 2.4 4 hit false positive — cần tách ticket

`SocSignalsPanel` `configTab/detectionTab/retentionTab/rulesTab` là **cache dữ liệu** `SignalTabData<T>`, không phải tab đang chọn.

⚠ **Không sửa rule vội** — wave 5 đã học bài: nới rule là làm yếu gate. Cần self-test khoá hành vi mới (tương tự T1–T8).

### 2.5 5 trang admin có `filtersDraft` — cố ý bỏ qua

5 trang `pages/admin/Admin*Page.tsx` mỗi trang 1 hit là `filtersDraft`. Đây là **ô form đang soạn**, quy định tại `hooks/useUrlState.ts:9-10`:
> "AC-4: chỉ đồng bộ state **đã áp dụng**. State `*Draft` **tuyệt đối không** đưa vào URL — nếu đồng bộ cả hai sẽ `useEffect` loop."

⚠ **Đừng "sửa" cho hết số.** 5 hit này không nên động.

---

## 3. BẪY ĐÃ TỐN THỜI GIAN THẬT

### 3.1 ⚠️ `core.bare=true` — xem mục 2.1. Tốn nhiều thời gian nhất session

### 3.2 ⚠️ Gate xanh khi chạy tay ≠ xanh khi chạy thật

`pre-push-gate` chạy tay 17/17 PASS, qua `git push` FAIL. Nguyên nhân: 3 self-test tạo repo tạm bằng `git init`, **kế thừa `GIT_DIR` từ hook** ⇒ `git init` re-init vào repo thật ⇒ `ENOENT`.

⚠ **Đã sửa** cho `verify-trailer-bypass.mjs` + `test-agent-preflight.mjs` (xoá `GIT_*` khỏi env).
`verify-hook-mode.mjs` **cố ý không sửa** — nó chạy hook trong repo thật nên cần giữ `GIT_DIR`.

🔧 **Khi viết self-test mới có `git init` trong thư mục tạm**: luôn dùng `FIX_ENV` đã xoá `GIT_*`.

### 3.3 ⚠️ `Set-Content` của PowerShell **PHÁ HỎNG** file markdown

Dùng `Set-Content` sửa `docs/CODE_CHANGE_AUDIT_LEDGER.md` (7600+ dòng) → tạo **ký tự U+FFFD**, chặn `pre-push-gate`.

⚠ **Dùng `edit` tool cho file `.md`.** Chỉ dùng `Add-Content` cho `CLAIMS.md` (append-only).
Ghi ledger bằng `[System.IO.File]::WriteAllText` với `UTF8Encoding($false)` cũng được.

### 3.4 ⚠️ `git rm --cached` phá index của worktree

Lệnh này làm 13 file `tools/opencode-global/` biến mất khỏi `git ls-files` trong worktree → `global-config-drift` FAIL với thông báo sai lệch.

🔧 Khôi phục: `git reset --hard HEAD` (chỉ khi tree sạch — **kiểm tra `git status` trước**, nếu có việc chưa commit thì copy ra `%TEMP%`).

### 3.5 ⚠️ `core.autocrlf=true` làm `global-config-drift` FAIL

Worktree checkout file bằng **CRLF**, bản deployed ở `~/.opencode` là **LF** ⇒ nội dung "khác" dù đọc ra giống hệt.

🔧 Fix: `git config --local core.autocrlf false` rồi `git reset --hard HEAD`.
🔧 Deploy lại: `node tools/opencode-global/deploy.mjs` (lệnh này chính gate chỉ định).

### 3.6 ⚠️ `check-h1-graph --gate` đã ĐÓNG

`shell-ai-command-center` đã xử lý ở wave 6. Handoff wave 4/5 §2.1 nói "cần Owner quyết" — **đã quyết xong**. Gate giờ PASS.

### 3.7 ⚠️ Không pipe output script vào `Select-Object`

```powershell
node <script> > "$env:TEMP\out.txt" 2>&1; "EXIT=$LASTEXITCODE"
Get-Content "$env:TEMP\out.txt" -Encoding utf8 -Tail 20
```
Pipe vào `Select-Object` **treo** trên máy này.

### 3.8 ⚠️ Scanner chạy 3-5 PHÚT

Đừng timeout 30–120 s rồi kết luận "script hỏng". Dùng timeout ≥ 400000.

### 3.9 ⚠️ Push có thể cần lách hook — nhớ ghi lý do

`gh pr merge` / `git push` đôi khi bị chặn vì lỗi môi trường. Nếu buộc phải lách:
- Push bằng `gh`, **không** `--no-verify`
- **Ghi lý do vào commit body** (`chore(audit): ghi ly do bo pre-push hook`)
- Nói rõ cái gì **chưa** chạy qua hook → `CHƯA CHẠY`, không báo PASS

### 3.10 ⚠️ CI billing

`gh pr checks` báo `fail` trong 2s với *"recent account payments have failed"*. **Đây không phải lỗi code.** Phải chạy gate local.

### 3.11 `interface` không thỏa `Record<string, unknown>`

Dùng **`type`** thay `interface` (chỉ `type` mới có implicit index signature).

### 3.12 `setParams` hai lần trong cùng một tick không compose

`useSearchParams` của `react-router-dom@6.30.3` chạy trên `searchParams` của lần render trước ⇒ lần hai đọc `prev` cũ ⇒ **mất kết quả lần một**. Đã thành lỗi thật ở `AdminBillingFleetPage.tsx:131,137`.

⚠ **Một lần `setParams` cho mỗi lần ghi.**

### 3.13 Test tự nhiên chứng minh "pass" **không** đủ

Đã xảy ra 3 lần. Cố tình làm hỏng code, rồi kiểm gate có đỏ **trước khi** tin.

---

## 4. GATE PHẢI CHẠY (baseline mới)

```powershell
# repo root
node docs/audit-uiux/scripts/check-h1-graph.mjs --gate              # PASS 0 vi phạm
node docs/audit-uiux/scripts/nav1-report.mjs packages/web/src --json # counted 80
node docs/audit-uiux/scripts/nav1-classify.mjs packages/web/src      # A=0 C=0 D=80
node docs/audit-uiux/scripts/scan-ui-guidelines.mjs packages/web/src --self-test  # 8/8
node packages/web/scripts/check-uiux-budget.mjs                      # exit 0
node docs/audit-uiux/scripts/check-ledger-entry.mjs                  # max=259
node packages/web/scripts/check-multi-agent.mjs                      # exit 0 + ~66 cảnh báo

cd packages/web
npx tsc --noEmit            # 0
npm run lint                # 0 error (3755 warning)
npm run test:components     # 0 (120 file / 847 test)
```

⚠ **Phải `cd packages/web`** — `npx tsc --noEmit` từ repo root dùng **sai binary**.

### Baseline đã biết

| Gate | Trạng thái |
|---|---|
| **`check-shell.mjs`** | **Fail — hỏng sẵn** (`ERR_UNKNOWN_FILE_EXTENSION`, xác minh trên worktree sạch) |
| `check-multi-agent` | 0 + ~66 cảnh báo claim cũ không tồn tại |
| `lint` | 3755 warning, 0 error |
| **`hook-mode` qua push** | **Fail — lỗi môi trường** (mục 2.1) |
| CI `scan` | Fail — **billing** |
| `makemigrations` | N/A nếu chỉ sửa `packages/web` + `docs` |

---

## 5. QUY TRÌNH

1. `pwsh -File scripts/agent-sync.ps1` → `git -C <main tree> status --short`
2. **`git config --local core.bare false`** nếu `git status` báo lỗi (mục 2.1)
3. **Khai claim** vào cuối `docs/CLAIMS.md`, **commit riêng, trước khi sửa dòng đầu tiên**
4. Tạo nhánh `feat/<slice>-<agent>`. **Không commit thẳng vào `dev`.**
5. Số Entry: `node docs/audit-uiux/scripts/check-ledger-entry.mjs --next-entry`. **Đừng tự đoán.**
6. `git add <đường dẫn tường minh>` + `git diff --cached --name-only`. **Không** `git add .`
7. **Không** dùng `git checkout --` (hazard 11) — dùng `git show dev:<file>` + copy ra `%TEMP%`
8. **Không** báo "PASS" cho thứ chưa chạy — ghi `CHƯA CHẠY`
9. PR: `pwsh -File scripts/agent-pr.ps1 -Title "<title>" -Scope "<scope>" -Base dev`

### File deny-list — **KHÔNG** commit khi còn agent khác

`AGENTS.md` · `packages/web/package.json` · `pyproject.toml` · `requirements.txt` · `package-lock.json` · `docker-compose*.yml` · `.env*`

- ✅ Ledger **KHÔNG** còn trong deny-list (từ 2026-10-03) — được append.
- ⚠ `tools/opencode-global/encoding-allowlist.txt` — **được sửa để gỡ file ra**, **không** thêm file mới vào.

---

## 6. CÒN TREO, CHỜ OWNER

1. **`core.bare` tự quay lại** (mục 2.1) — chặn push.
2. **32 hit SOC** — chọn (a) / (b) / (c) (mục 2.3).
3. **2 branch WIP** (mục 2.2) — verify hoặc revert.
4. **4 hit false positive** (mục 2.4) — cần escape ở `nav1-rule.mjs` + self-test.
5. **Mobile Playwright** — cần backend thật hoặc `storageState` giả lập.
6. **`check-shell.mjs` hỏng** (`ERR_UNKNOWN_FILE_EXTENSION`) — chưa ai sửa.
7. **5 ticket nhỏ** từ handoff wave 5 §6: `expiresWithinDays` kiểu `string` → `number` · debounce ô nhập · tối ưu scanner 211–312 s · rule `quote`/`q` (cần AST, không phải regex) · nút "Xoá bộ lọc".