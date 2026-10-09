# HANDOFF — session sau UI/UX wave 5 / NAV-1 (2026-10-09)

> **Đọc theo thứ tự này.** Mục 1 là bản đồ, mục 2 là việc dở dang,
> mục 3 là những bẫy đã tốn thời gian thật.
> Repo `C:\Mujoco Projects\vninvest`, nhánh tích hợp `dev`.

---

## 0. TRẠNG THÁI KHI BÀN GIAO

| Việc | Trạng thái |
|---|---|
| **PR #76** (`feat/uiux-wave5-nav1` → `dev`) | **ĐÃ TẠO, ĐANG OPEN — CHƯA MERGE** |
| Claim `uiux-wave5-nav1` | `done` (code xong, chờ Owner merge) |
| `dev` | `7746d5c1f` — **chưa** có wave 5 |

⇒ **Việc đầu tiên của session sau: Owner review + merge PR #76.** Sau đó mới
làm việc mới (mục 2).

---

## 1. BẢN ĐỒ NHANH

| Cần đọc | Vì sao |
|---|---|
| `docs/REPORT_FINAL_UIUX_WAVE5_NAV1.md` | **Báo cáo đầy đủ**: số đo, 3 lỗi rule, bằng chứng, trade-off, bài học |
| `docs/CODE_CHANGE_AUDIT_LEDGER.md` → `## Entry 258` | Cùng nội dung ở dạng ledger |
| `docs/audit-uiux/HANDOFF_UIUX_WAVE4_20261009.md` | Lịch sử — ⚠ **§2.2 có 1 danh sách sai**, xem mục 3.6 |
| `docs/audit-uiux/scripts/nav1-rule.mjs` | **Đọc comment đầu file trước khi sửa rule** |

### Số đo sau wave 5

| Số đo | `dev` trước | Sau PR #76 |
|---|---|---|
| `TONG` (scanner) | 177 | **162** |
| `NAV-1` `counted` | 104 | **89** |
| `A` / `C` / `D` (classify) | 12 / 3 / 89 | **0 / 0 / 89** |
| `npm run lint` | 0 error | **0 error** (3754 warning) |
| `test:components` | 844/844 · 119 file | **844/844 · 119 file** (không đổi) |

### Hạn đồ đo được (đã dùng được ngay)

| Công cụ | Dùng để |
|---|---|
| `node docs/audit-uiux/scripts/nav1-classify.mjs packages/web/src` | **Phân loại A/C/D** — dùng cái này **trước** khi lập kế hoạch sửa NAV-1 |
| `node docs/audit-uiux/scripts/nav1-report.mjs packages/web/src` | Bảng hit theo file (top N) |
| `node docs/audit-uiux/scripts/nav1-report.mjs … --why` | Chi tiết từng biến + lý do |
| `node docs/audit-uiux/scripts/scan-ui-guidelines.mjs packages/web/src --self-test` | Chứng minh âm rule NAV-1 (**8/8**) |
| `node docs/audit-uiux/scripts/check-h1-graph.mjs --gate` | 62 route, kết luận `<h1>` theo import graph |
| `node packages/web/scripts/check-uiux-budget.mjs` | Gate "chặn thoái lùi, không chặn nợ sẵn" |
| `node docs/audit-uiux/scripts/check-ledger-entry.mjs --next-entry` | In số Entry kế tiếp (**đọc worktree**) |

---

## 2. VIỆC DỞ DANG

### 2.1 ⚠ CẦN OWNER QUYẾT — `check-h1-graph --gate` đang **ĐỎ**

```
✗ [unreferenced-registry-entry] shell-ai-command-center
   (registry khai nhưng không route nào trong entry tham chiếu)
```

`packages/web/src/pages/pageRegistry.js:201` khai entry, nhưng `main.tsx` **không
có** `<Route>` tương ứng. **Lỗi CÓ SẴN ở `dev`** — đã kiểm bằng
`git show dev:packages/web/src/pages/pageRegistry.js | Select-String shell-ai-command-center`.

**Cần Owner chọn**: nối route (mở tính năng) hay gỡ entry khỏi registry.
**Không tự quyết** — nằm ngoài phạm vi UI/UX. Còn treo từ wave 4, **chưa ai đụng**.

### 2.2 89 hit NAV-1 còn lại — **code thật, không giảm được bằng rule**

Đây là nợ lớn nhất. Phân bố đo thật (39 file):

| Nhóm | File | Hit | File tiêu biểu |
|---|---|---|---|
| `components/soc/` | 11 | **41** | `SocSignalsPanel.tsx` (11) · `SocOverviewPanel.tsx` (7) · `SocUsersPanel.tsx` (5) |
| `hooks/` | 3 | 9 | `useAlertCenterFilters.ts` (6) |
| `pages/admin/` | 6 | 6 | 5 trang có `filtersDraft` |
| còn lại | 19 | 33 | rải rác 1–4 hit/file |

Cách sửa: `useUrlRecord` (object 5–7 field) hoặc `useUrlValue` (biến đơn) —
pattern đã có trong 7 file của wave 3, xem `docs/REPORT_FINAL_UIUX_WAVE3.md`.

⚠ **Đừng** sửa bằng cách nới rule. Wave 5 vừa chứng minh: 104 hit chỉ có **15**
là lỗi rule; nới thêm là **làm yếu gate**.

### 2.3 Mobile — phần còn lại

Đã đo trên route công khai (`/login`, `/register`). **CHƯA CHẠY**: mọi route
**cần đăng nhập** — `tests/visual/auth.setup.ts:5-30` login thật vào `vite preview`
**không có backend** ⇒ project `setup` chết **trước thân test**. Cần backend thật
hoặc `storageState` giả lập mới đo được.

### 2.4 46 hit `CSS-2` (`prefers-reduced-motion`) — non-goal từ wave 2

---

## 3. BẪY ĐÃ TỐN THỜI GIAN THẬT — ĐỪNG LẶP LẠI

### 3.1 ⚠ Scanner chạy **3–5 PHÚT** — KHÔNG phải treo

Nguyên nhân đã định vị: `scan-ui-guidelines.mjs` (`selectorName`) chạy regex
O(40·n) **cho từng dòng của mọi file CSS**.

⇒ **Đừng** timeout 30–120 s rồi kết luận "script hỏng". Dùng `timeout ≥ 400000`.

### 3.2 ⚠ Không pipe output của script vào `Select-Object`

`node … | Select-Object -Last 20` **treo** trên máy này. Redirect ra file rồi
`Get-Content`:
```powershell
node <script> > "$env:TEMP\out.txt" 2>&1; "EXIT=$LASTEXITCODE"
Get-Content "$env:TEMP\out.txt" -Encoding utf8 -Tail 20
```

### 3.3 ⚠ `Set-Content` của PowerShell **PHÁ HỎNG** file markdown

Dùng `Set-Content` để sửa `docs/CODE_CHANGE_AUDIT_LEDGER.md` (7559 dòng, ~937 KB)
⇒ tạo **6 ký tự U+FFFD** trong dòng 257, chặn `pre-push-gate`.

Ngoài ra phải di chuyển Entry 258 **từ cuối file lên đầu** (Entry mới nhất luôn
ở dòng 1) và chèn dòng index vào **bảng cuối file** — `Set-Content` làm mất
thứ tự.

⇒ **Dùng `edit` tool cho file markdown.** Chỉ dùng `Add-Content` cho
`CLAIMS.md` (append-only theo `AGENT_PROTOCOL.md` §2).

### 3.4 ⚠ `pre-push-gate` chỉ quét file **ĐÃ THAY ĐỔI**

6 U+FFFD ở mục 3.3 **có sẵn trên `dev`** (do `7746d5c1f`), không phải do branch
mới — nhưng chỉ lộ ra khi sửa file đó.

⇒ Trước khi nhận trách nhiệm về lỗi encoding, đối chiếu blob thô:
```powershell
git cat-file blob dev:<path> > "$env:TEMP\x.bin"
```

⇒ **KHÔNG** thêm file vào `tools/opencode-global/encoding-allowlist.txt` — file
đó ghi rõ *"Không được thêm file vào đây để cho gate xanh"*.

### 3.5 ⚠ Copy file để chứng minh fail-trước: dùng `-LiteralPath` + đường dẫn đầy đủ

`Copy-Item "$T\file.keep" $f -Force` **từng hỏng** với
`Cannot find drive. A drive with the name '/**'` — và **file đích bị bỏ lại ở
trạng thái hỏng**:
```powershell
$src = (Resolve-Path "<file>").Path
$dst = [System.IO.Path]::GetFullPath("$env:TEMP\<name>.keep")
Copy-Item -LiteralPath $src -Destination $dst -Force
```
Sau mỗi lần inject-bug **luôn** kiểm `git diff --stat -- <file>`.

### 3.6 ⚠ `HANDOFF_UIUX_WAVE4` §2.2 có **1 danh sách sai**

Nó liệt kê `pageStats` là false positive của NAV-1. **Sai** — `pageStats` là
phân trang thật (`useAlertCenterFilters.ts:13`). Danh sách đó là ví dụ cảm tính.

⇒ **Luôn chạy `nav1-classify.mjs` thay vì tin danh sách trong handoff.**

### 3.7 ⚠ `interface` không thỏa `Record<string, unknown>`

4 trang admin khai `interface JobFilters {…}` ⇒ `useUrlRecord<T extends
Record<string, unknown>>` **từ chối**. Phải dùng **`type`** (chỉ `type` mới có
implicit index signature).

### 3.8 ⚠ `setParams` **hai lần trong cùng một tick không compose**

`useSearchParams` của `react-router-dom@6.30.3` đóng trên `searchParams` của lần
render đó ⇒ lần hai đọc `prev` cũ và **xoá mất** kết quả lần một. Đã thành lỗi
thật ở `AdminBillingFleetPage.tsx:131,137`.

⇒ **Một lần `setParams` cho mỗi lần ghi.**

### 3.9 ⚠ Test tự nó chứng minh "pass" **không đủ**

Đã xảy ra **3 lần**: T1–T4 của scanner (wave 4), AC-3 (wave 4), và chính bản
sửa `q(?![a-z])` của wave 5 (làm mất `qValue`).

⇒ **Cố tình làm hỏng code, rồi kiểm gate có đỏ không.**

### 3.10 ⚠ Gate i18n là MÙ

`npm run i18n:scan:strict` exit 0 **kể cả khi key nằm sai chỗ** ⇒ `aria-label`
render ra **chính chuỗi key**. **Đừng** dùng nó làm bằng chứng duy nhất.

### 3.11 ⚠ `npm run check:uiux` / `check:i18n` **KHÔNG TỒN TẠI**

Gate thật: `check-uiux-budget.mjs` + `check:i18n-hardcoded` + `i18n:scan:strict`.

### 3.12 ⚠ `.jsx` không qua `tsc`

Truyền sai kiểu trong `.jsx` là **bug im lặng**. Test bằng **hành vi thật**.

---

## 4. GATE PHẢI CHẠY (baseline mới)

```powershell
# repo root — scanner 3-5 PHÚT, redirect file KHONG pipe
node docs/audit-uiux/scripts/scan-ui-guidelines.mjs packages/web/src          # TONG 162
node docs/audit-uiux/scripts/scan-ui-guidelines.mjs packages/web/src --self-test  # 8/8
node docs/audit-uiux/scripts/nav1-classify.mjs packages/web/src              # A=0 C=0 D=89
node packages/web/scripts/check-uiux-budget.mjs                              # exit 0
node docs/audit-uiux/scripts/nav1-report.mjs packages/web/src               # counted 89
node docs/audit-uiux/scripts/check-ledger-entry.mjs                          # exit 0
node packages/web/scripts/check-multi-agent.mjs                              # exit 0 + ~66 cảnh báo

cd packages/web
npm run check:tokens ; npm run check:contrast ; npm run check:dom-landmarks
npm run check:ts-imports ; npm run check:i18n-hardcoded
npm run check:admin-spa-routes ; npm run check:shell ; npm run i18n:scan:strict
npx tsc --noEmit                    # 0
npm run lint                        # 0 error (3754 warning)
npm run test:components             # 0 (119 file / 844 test)
npm run build                       # 0
```

⚠ **Phải `cd packages/web`** — `npx tsc --noEmit` từ repo root dùng **sai
binary** và exit 1.

⚠ **Thứ tự tham số của scanner**: `scan-ui-guidelines.mjs <root> --self-test`.
Đảo lại ⇒ `ENOENT: scandir '--self-test'`.

### Baseline đã biết (không phải lỗi của bạn)

| Gate | Trạng thái |
|---|---|
| `check-h1-graph --gate` | **Fail — có sẵn** (mục 2.1) |
| `check-multi-agent.mjs` | 0 + **~66 cảnh báo** claim cũ không tồn tại |
| `lint` | **3754 warning**, 0 error (`jsx-no-literals` đã có 3581) |
| `check-ledger-entry` | **59 số trùng cũ** — cố ý giữ; gate chặn trùng **mới** |
| `check_large_files.ps1` | **Fail — có sẵn** |
| `makemigrations` | **N/A** nếu chỉ sửa `packages/web` + `docs` |

---

## 5. QUY TRÌNH

1. `pwsh -File scripts/agent-sync.ps1` → `git -C <main tree> status --short`
2. **Khai claim** vào cuối `docs/CLAIMS.md`, **commit riêng, trước khi sửa dòng đầu tiên**.
3. Tạo nhánh `feat/<slice>-<agent>`. **Không commit thẳng vào `dev`.**
4. Số Entry: `node docs/audit-uiux/scripts/check-ledger-entry.mjs --next-entry`. **Đừng tự đoán.**
5. `git add <đường dẫn tường minh>` + `git diff --cached --name-only`. **Không** `git add .`.
6. **Không** dùng `git checkout --` để thử (hazard 11) — dùng `git show dev:<file>` + copy ra `%TEMP%`.
7. **Không báo "PASS" cho thứ chưa chạy** — ghi `CHƯA CHẠY`.
8. PR: `pwsh -File scripts/agent-pr.ps1 -Title "<title>" -Scope "<scope>" -Base dev`
   (`-Title` là **bắt buộc**; gọo không có nó sẽ báo lỗi tham số.)

### File deny-list — **KHÔNG** commit trong lúc có agent khác

`AGENTS.md` · `packages/web/package.json` · `pyproject.toml` · `requirements.txt`
· `package-lock.json` · `docker-compose*.yml` · `.env*`

⚠ Ledger **KHÔNG** còn trong deny-list (từ 2026-10-03) ⇒ **được append**.
⚠ `tools/opencode-global/encoding-allowlist.txt` — **được sửa để GỠ file ra**,
**không** thêm file mới vào.

---

## 6. CÒN TREO, CHỜ OWNER

1. **`shell-ai-command-center`** — nối route hay gỡ entry (mục 2.1).
2. **PR #76** — review + merge.
3. **Nút "Xoá bộ lọc"** — Major 2 đã bỏ undo-bộ-lọc-bằng-Back; nếu sản phẩm cần
   nút hoàn tác thì tách ticket.
4. **`expiresWithinDays`** giữ kiểu `string` — có đổi sang `number` được không (W-6).
5. **Debounce** cho ô nhập văn bản (W-4).
6. **Tối ưu scanner** 211–312 s (W-5) — mục 3.1.
7. **`quote` và biến `q`+chữ thường** không còn được NAV-1 bắt — để bắt thì
   phải phân tích kiểu dữ liệu, tức **AST**, không phải regex. Xem `## Entry 258` §6.