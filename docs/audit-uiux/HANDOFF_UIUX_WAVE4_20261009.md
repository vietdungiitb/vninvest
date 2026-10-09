# HANDOFF — session sau UI/UX wave 4 (2026-10-09)

> **Đọc theo thứ tự này.** Mục 1 là bản đồ, mục 2 là việc dở dang,
> mục 3 là những bẫy đã tốn thời gian thật.
> Repo `C:\Mujoco Projects\vninvest`, nhánh tích hợp `dev`.

---

## 1. BẢN ĐỚ NHANH

| Cần đọc | Vì sao |
|---|---|
| `docs/REPORT_FINAL_UIUX_WAVE4.md` | **Báo cáo đầy đủ**: số đo, phát hiện, waiver, đổi hành vi, bài học |
| `docs/CODE_CHANGE_AUDIT_LEDGER.md` → `## Entry 257` | Cùng nội dung ở dạng ledger |
| `docs/PLAN_UIUX_WAVE4.md` (rev 2) | Kế hoạch + **16 objection 2 vòng Stage 2** + STOP condition |
| `docs/AUDIT_UIUX_WAVE4.md` | Audit Stage 5 (0 blocker · 4 major **đã sửa hết**) |
| `docs/TEST_REPORT_UIUX_WAVE4.md` | Gate từng dòng kèm exit code thật |
| `docs/audit-uiux/HANDOFF_UIUX_WAVE3_20261008.md` | Lịch sử — ⚠ **3 số trong đó sai**, xem mục 3.1 |

### Trạng thái sau wave 4

| Số đo | `dev` trước | Sau |
|---|---|---|
| `TONG` (scanner) | 172 | **177** (baseline **nâng vì siết rule**) |
| `NAV-1` `counted` | 99 | **104** |
| `A11Y-9` | 5 | **5** (giữ nguyên) |
| `npm run lint` | 0 error | **0 error** (3754 problems) |
| `test:components` | 817/817 · 117 file | **844/844 · 119 file** |

### Hạn đồ đo được (đã dùng được ngay)

| Công cụ | Dùng để |
|---|---|
| `node docs/audit-uiux/scripts/nav1-report.mjs packages/web/src` | **NAV-1 chi tiết từng biến** — `--why` in lý do bị bỏ qua. Dùng để lập kế hoạch |
| `node docs/audit-uiux/scripts/nav1-report.mjs … --json` | Cùng dữ liệu dạng máy |
| `node docs/audit-uiux/scripts/scan-ui-guidelines.mjs packages/web/src --self-test` | Chứng minh âm rule NAV-1 (**5/5**) |
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

Script **tái hiện độc lập** phát hiện đã ghi ở `AGENTS.md` Entry 228
("`ShellAiCommandCenterPage` không route"). **Cần Owner chọn**: nối route (mở tính
năng) hay gỡ entry khỏi registry. **Không tự quyết** — nằm ngoài phạm vi UI/UX.

### 2.2 104 hit NAV-1 còn lại

Không thuộc 11 file P1 (D-2 của wave 3). **Đo trước khi sửa**:
`nav1-report.mjs --why` in từng biến + lý do. Lưu ý: 104 hit có một phần là
**false positive của rule** (`quantity` · `quota` · `quotesBySymbol` ·
`pageStats` … khớp nhánh `|q`). **Cần sửa RULE, không sửa SỐ** — hạ nhánh `|q`
để giảm count là làm yếu gate.

### 2.3 Mobile — phần còn lại

Đã đo trên route công khai (`/login`, `/register`). **CHƯA CHẠY**: mọi route **cần
đăng nhập** — `tests/visual/auth.setup.ts:5-30` login thật vào `vite preview`
**không có backend** ⇒ project `setup` chết **trước thân test**. Cần backend thật
hoặc `storageState` giả lập mới đo được.

### 2.4 46 hit `CSS-2` (`prefers-reduced-motion`) — non-goal từ wave 2

---

## 3. BẪY ĐÃ TỐN THỜI GIAN THẬT — ĐỪNG LẶP LẠI

### 3.1 ⚠ `HANDOFF_UIUX_WAVE3_20261008.md` §5 có **3 số sai**

| Dòng | Handoff nói | Thật |
|---|---|---|
| "3 hit cố ý giữ" | **3** | **7** (4 `filtersDraft` + `searchDraft` + 2 ô nhập form) |
| "trần thực tế = 21" | **21** | **4** (tính từ `counted` 99 hiện tại) |
| "giảm ≥ 17" | **17** | 17 là **kết quả W3-2 đã đạt rồi**, không phải việc chưa làm |

Ngoài ra `selectedRequestId` được liệt kê là sửa được, nhưng **không sửa được** —
nó khớp regex nhờ nhánh `|q`.

### 3.2 ⚠ Scanner chạy **3–5 PHÚT** — KHÔNG phải treo

Đo 2 lần: **211 s** và **312 s**. Nguyên nhân đã định vị:
`scan-ui-guidelines.mjs:348-357` (`selectorName`) chạy regex O(40·n) **cho từng
dòng của mọi file CSS**.

⇒ **Đừng** timeout 30–120 s rồi kết luận "script hỏng". Session này mất 2 lượt
chạy vì đúng lỗi này. Dùng `timeout ≥ 400000` và redirect ra file.

### 3.3 ⚠ Không pipe output của script vào `Select-Object`

`node … | Select-Object -Last 20` **treo** trên máy này. Redirect ra file rồi
`Get-Content`:
```powershell
node <script> > "$env:TEMP\out.txt" 2>&1; "EXIT=$LASTEXITCODE"
Get-Content "$env:TEMP\out.txt" -Encoding utf8 -Tail 20
```

### 3.4 ⚠ Copy file để chứng minh fail-trước: dùng `-LiteralPath`

`Copy-Item "$T\file.keep" $f -Force` **từng hỏng** với lỗi `Cannot find drive. A
drive with the name '/**'` — và **file đích bị bỏ lại ở trạng thái hỏng**. Dùng
đường dẫn đầy đủ + `-LiteralPath`:
```powershell
Copy-Item -LiteralPath "<đường dẫn đầy đủ keep>" -Destination "<đường dẫn đầy đủ đích>" -Force
```
Sau mỗi lần inject-bug **luôn** kiểm lại bằng `git diff --stat -- <file>`.

### 3.5 ⚠ `interface` không thỏa `Record<string, unknown>`

4 trang admin khai `interface JobFilters {…}` ⇒ `useUrlRecord<T extends
Record<string, unknown>>` **từ chối**. Phải dùng **`type`** (chỉ `type` mới có
implicit index signature).

### 3.6 ⚠ `setParams` **hai lần trong cùng một tick không compose**

`useSearchParams` của `react-router-dom@6.30.3` đóng trên `searchParams` của lần
render đó (không có ref sống) ⇒ lần hai đọc `prev` cũ và **xoá mất** kết quả lần
một. Đã thành lỗi thật ở `AdminBillingFleetPage.tsx:131,137` (`setStatus(v);
setPage(1);`) ⇒ chọn trạng thái hoá đơn **im lặng không ghi được vào URL**.

⇒ **Một lần `setParams` cho mỗi lần ghi.** `useUrlState` đã tự tách 2 nhóm;
`useUrlRecord` cố ý ghi **một** lệnh.

### 3.7 ⚠ Test tự nó chứng minh "pass" **không đủ**

Wave này có **2** test xanh **trước khi lẫn cũng lẫn sau**:
- AC-3 của `portfolio-deep-link-fu05` — `fireEvent.change` bắn **1 lần** với giá
  trị hoàn chỉnh.
- 4/5 self-test của scanner — `codeLines()` lọc comment ở đường ống trước khi
  `urlSyncdVars` kịp thấy.

⇒ **Cố tình làm hỏng code, rồi kiểm gate có đỏ không.** Đây là bước bắt buộc
của mọi AC mới.

### 3.8 ⚠ Gate i18n là MÙ

`npm run i18n:scan:strict` exit 0 **kể cả khi key nằm sai chỗ** ⇒ `aria-label`
render ra **chính chuỗi key**. **Đừng** dùng nó làm bằng chứng duy nhất.

### 3.9 ⚠ `npm run check:uiux` / `check:i18n` **KHÔNG TỒN TẠI**

Gate thật: `check-uiux-budget.mjs` + `check:i18n-hardcoded` + `i18n:scan:strict`.

### 3.10 ⚠ `.jsx` không qua `tsc`

Truyền sai kiểu trong `.jsx` là **bug im lặng**. Test bằng **hành vi thật**.

---

## 4. GATE PHẢI CHẠY (baseline mới)

```powershell
# repo root — scanner 3-5 PHÚT, redirect file KHONG pipe
node docs/audit-uiux/scripts/scan-ui-guidelines.mjs packages/web/src   # TONG 177
node docs/audit-uiux/scripts/scan-ui-guidelines.mjs packages/web/src --self-test   # 5/5
node packages/web/scripts/check-uiux-budget.mjs                       # exit 0
node docs/audit-uiux/scripts/nav1-report.mjs packages/web/src         # counted 104
node docs/audit-uiux/scripts/check-h1-graph.mjs --self-test           # 8/8
node docs/audit-uiux/scripts/check-h1-graph.mjs --gate                # 1 (nợ có sẵn, mục 2.1)
node docs/audit-uiux/scripts/check-ledger-entry.mjs                   # exit 0
node packages/web/scripts/check-multi-agent.mjs                       # exit 0 + ~66 cảnh báo

cd packages/web
npm run check:tokens ; npm run check:contrast ; npm run check:dom-landmarks
npm run check:ts-imports ; npm run check:i18n-hardcoded
npm run check:admin-spa-routes ; npm run check:shell ; npm run i18n:scan:strict
npx tsc --noEmit                    # 0
npm run lint                        # 0 error (3754 problems)
npm run test:components             # 0 (119 file / 844 test)
npm run build                       # 0
npx playwright test --project=mobile-ergonomics --reporter=line   # 0 (2 passed)
```

⚠ **Phải `cd packages/web`** — `npx tsc --noEmit` từ repo root dùng **sai
binary** và exit 1.

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

### File deny-list — **KHÔNG** commit trong lúc có agent khác

`AGENTS.md` · `packages/web/package.json` · `pyproject.toml` · `requirements.txt`
· `package-lock.json` · `docker-compose*.yml` · `.env*`

⚠ Ledger **KHÔNG** còn trong deny-list (từ 2026-10-03) ⇒ **được append**.

---

## 6. CÒN TREO, CHỜ OWNER

1. **`shell-ai-command-center`** — nối route hay gỡ entry (mục 2.1).
2. **Nút "Xoá bộ lọc"** — Major 2 đã bỏ undo-bộ-lọc-bằng-Back; nếu sản phẩm cần
   nút hoàn tác thì tách ticket.
3. **`expiresWithinDays`** giữ kiểu `string` — có đổi sang `number` được không
   (W-6).
4. **Debounce** cho ô nhập văn bản (W-4).
5. **Tối ưu scanner** 211–312 s (W-5).