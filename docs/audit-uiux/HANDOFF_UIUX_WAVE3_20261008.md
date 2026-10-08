# HANDOFF — session sau UI/UX wave 3 (2026-10-08)

> **Đọc theo thứ tự này.** Mục 1 là bản đồ, mục 2 là việc dở dang.
> Repo `C:\Mujoco Projects\vninvest`, nhánh tích hợp `dev`.

---

## 1. BẢN ĐỒ NHANH

| Cần đọc | Vì sao |
|---|---|
| `docs/REPORT_FINAL_UIUX_WAVE3.md` | **Báo cáo đầy đủ** wave 3: số đo, 3 phát hiện lớn, 2 blocker, việc dở dang, bài học |
| `docs/CODE_CHANGE_AUDIT_LEDGER.md` → `## Entry 256` | Cùng nội dung, ở dạng ledger |
| `docs/PLAN_UIUX_WAVE3.md` (rev 3) | Kế hoạch + AC + **9 objection audit đã đóng** + STOP condition |
| `docs/TEST_REPORT_UIUX_WAVE2.md` | ⚠ **CÓ 2 CHỖ SAI** — xem mục 2.1, đừng tin nguyên văn |
| `docs/audit-uiux/HANDOFF_UIUX_REMAINING_20261008.md` | Nguồn của Entry 255. Số dòng trong đó **lệch** (mục 2.2) |

### Trạng thái `dev` sau wave 3

```
dev = 12d0702fe   (merge wave 3 = 890a60208)
```

| Số đo | Trước | Sau |
|---|---|---|
| `TONG` (scanner) | 224 | **172** |
| `A11Y-9` | 44 | **5** |
| `NAV-1` | 112 | **99** |
| `npm run lint` | exit 1 (1 error) | **exit 0 (0 error)** |
| `test:components` | exit 1 (2 failed) | **exit 0 (817/817, 117 file)** |

### Hạ tầng mới (đã dùng được ngay)

| Công cụ | Dùng để |
|---|---|
| `node docs/audit-uiux/scripts/scan-ui-guidelines.mjs packages/web/src` | Quét UI/UX. **Số dòng giờ ĐÚNG** (mục 2.2) |
| `node packages/web/scripts/check-uiux-budget.mjs` | Gate "chặn thoái lùi, không chặn nợ sẵn". Có `--self-test` |
| `node docs/audit-uiux/scripts/check-ledger-entry.mjs` | **Gate MỚI** — chặn số `## Entry` trùng mới. `--next-entry` / `--manifest` / `--self-test` |
| `node packages/web/scripts/check-ledger-entry.mjs --next-entry` | In số Entry kế tiếp. **Đọc worktree** — dùng cái này, đừng đoán số |

---

## 2. CÁI BẠN PHẢI BIẾT TRƯỚC KHI LÀM VIỆC MỚI

### 2.1 ⚠ `TEST_REPORT_UIUX_WAVE2.md` SAI 2 CHỖ

| Dòng | Ghi sai | Thật |
|---|---|---|
| `:36` | lỗi lint ở `FactsFirstWhaleBubbleChart.jsx` | **`src/components/OrderFlowRadarPanel.js:155:6`** |
| `:25` | `test:components` exit 0, 116/804 PASS | ở `dev` @ `7aeef9503` nó **exit 1, 2 failed / 802** |

Cả hai đã được đo lại và sửa trong `## Entry 256`. **Đừng trích lại 2 dòng này.**

### 2.2 ⚠ Số dòng trong `HANDOFF_UIUX_REMAINING_20261008.md` LỆCH

File đó viết trước khi scanner được sửa. **Đừng dùng `file:line` của nó.**
Muốn tra chính xác thì chạy scanner (giờ nó in ra số dòng thật) hoặc `Select-String -Encoding utf8`.

### 2.3 ⚠ Rule NAV-1 quét CẢ COMMENT

`scan-ui-guidelines.mjs` có `fileHasUrlSync` — regex quét **toàn bộ nội dung file,
kể cả comment**. Một dòng comment chứa `useSearchParams` / `useNavigate` /
`useLocation` / `URLSearchParams` sẽ làm **cả file** bị coi là "đã đồng bộ URL" và
**mọi hit NAV-1 trong file biến mất khỏi gate**.

⇒ **Không viết tên các token đó trong comment** ở file bạn đang sửa, nếu không muốn
bị bỏ sót.

Ngoài ra escape này là **cấp file**: file chỉ cần gọi hook 1 lần là mọi `useState`
chưa sync cũng bị che. Đây là **major còn mở** của audit Stage 5 (xem mục 3.3).

### 2.4 ⚠ `npm run check:uiux` và `check:i18n` KHÔNG TỒN TẠI

`HANDOFF_UIUX_REMAINING_20261008.md:244` bắt chạy `npm run check:uiux` — lệnh đó không
có trong `package.json`. Gate thật là `check-uiux-budget.mjs` (mục 1).

### 2.5 ⚠ Gate i18n là MÙ

`npm run i18n:scan:strict` trả **exit 0** ngay cả khi 2 key nằm sai chỗ
(`advertising.errors` thay vì `common`), khiến `aria-label` render ra **chính chuỗi
key**. **Đừng tin gate này là đủ.** Kiểm tay bằng cách đọc key trong cả 2 locale.

### 2.6 `.jsx` không qua `tsc`

Truyền sai kiểu trong file `.jsx` là **bug im lặng** — ví dụ `boolCodec` mong đợi
string, nhận boolean ⇒ `serialize` trả giá trị sai ⇒ URL sai ⇒ **không error nào**.
Với `.jsx`, hãy test bằng hành vi thật, không chỉ dựa vào type/lint.

---

## 3. VIỆC DỞ DANG — 3 nhóm, theo thứ tự nên làm

### 3.1 W3-5 — Mobile: Playwright emulation (mục #6 của Entry 255)

**Trạng thái**: CHƯA LÀM. Đã điều tra kỹ, không phải "chưa ai thử".

**Vì sao chạy `npm run test:visual` nguyên trạng sẽ hỏng**:
- `packages/web/playwright.config.ts` **đã có** (67 dòng), `testDir: './tests/visual'`.
- Mọi project trừ `setup` đều có `dependencies: ['setup']` + `storageState`.
- `packages/web/tests/visual/auth.setup.ts:5-30` **bắt login thật**:
  `goto('/login')` → điền `testuser@vninvest.vn` / `TestPass123!` →
  `waitForURL('**/dashboard', {timeout:15000})`.
- `webServer` là `npm run preview` — bản build **tĩnh, không backend** ⇒ login fail ⇒
  cả 6 project chết **trước khi vào thân test**.
- Máy chỉ có **chromium** (`%LOCALAPPDATA%\ms-playwright`), **không** webkit/firefox.
- 18 file `*.spec.ts` trong `testDir` đều được chụp **có auth**.

**Cần làm**:
1. Thêm 1 project mới trong `playwright.config.ts`: **không** `dependencies`,
   `storageState: { cookies: [], origins: [] }`, `browserName: 'chromium'`,
   **`testMatch: /mobile-ergonomics\.spec\.ts/`** (thiếu `testMatch` ⇒ chạy cả 18 file
   và đỏ hàng loạt vì auth).
2. Viewport **393×851** + `hasTouch` (giống `devices['Pixel 5']` sẵn có).
   **KHÔNG** dùng 390×844 — đó là `iPhone 12`, cần webkit.
3. Chạy: `npm run test:visual --project=<tên mới>`.

**Chỉ 2 tiêu chí có fail-trước** (3 rule mobile **đã có sẵn** từ wave 2):
- `document.documentElement.scrollWidth <= innerWidth` ở 390×851.
- Touch target của control tương tác chính ≥ **44×44 px** (WCAG 2.5.5).

**Có sẵn rồi, KHÔNG sửa**: `src/index.css:788` (`touch-action: manipulation`),
`:798` (`overscroll-behavior: contain`), `:804-805` (`env(safe-area-inset-*)`).
Việc còn lại nhỏ: `index.css:764` còn **comment cũ** ghi "safe-area-inset-* = 0,
touch-action = 0" — **đã lỗi thời**, cập nhật.

**Ghi `CHƯA CHẠY`** (không đo bằa): thiết bị thật, notch thật, Safari iOS,
focus ring khi chạm thật, tốc độ cuộn thật. `env(safe-area-inset-*)` trả `0px` trong
headless ⇒ **không kiểm chứng được bằng hành vi**.

### 3.2 W3-3 — AC-3 (6 trang `<h1>`) + AC-4 (script import-graph)

**AC-3.1 — 6 trang chưa có test phòng thủ**
`SupportPage` · `TransactionsPage` · `UserSettingsPage` · `UpgradePage` ·
`market/ShellStockDetailPage.js` · `signals/WhaleAdvisoryPage.tsx`

Các trang này **ĐÃ có** đúng 1 `<h1>` — **không thêm `<h1>`**, chỉ thêm assert.
Bắt buộc `toHaveLength(1)`, **không** `toBeLessThanOrEqual(1)` (vì `≤1` cũng pass khi **0**).
Nguồn của `<h1>`: `components/WorkstationShell.tsx:53` (`e("h1",…)`) và
`components/advisory/WhaleAdvisoryBentoHeader.js:44` (`'h1'` **trên dòng riêng**).

Lý do chưa có test: cần cây provider đầy đủ (xem
`src/pages/__tests__/page-heading-fu02c.component.test.tsx:186-194`).
⇒ **Viết 1 `renderRoutePage()` dùng chung** rồi thêm 6 case. Đừng ép từng trang.

**AC-3.2 — script `docs/audit-uiux/scripts/check-h1-graph.mjs`**
Chưa có. Yêu cầu: bắt đầu từ **entry point lấy từ build config** (không từ doc,
không từ tên file — L-G07), phân giải alias `@/`, đi **transitive**.
⚠ Import graph là **tĩnh**: `<h1>` sinh qua biến sẽ không lộ ⇒ script **bắt buộc phải
báo rõ phần động**, im lặng coi là "không có h1" sẽ tạo hàng loạt finding giả.

### 3.3 NAV-1 — 4 file P1 còn lại (9 hit)

`AdminCoreAuditTracePage.tsx` (3) · `AdminCoreJobsPage.tsx` (2) ·
`AdminCorePATsPage.tsx` (2) · `AdminCoreServiceAccountsPage.tsx` (2)

7 file đã làm rồi (mỗi field 1 tham số URL, dùng `useUrlState` có sẵn). 4 file này
khác: `filters` là **object phẳng 5–7 field** + `setFilters({ ...filtersDraft })` khi
Apply.

⇒ Cần **primitive mới** trong `src/hooks/useUrlState.ts`:
`useUrlRecord(spec, defaults, prefix)` để đồng bộ cả một bản ghi có tiền tố,
**+ test identity** cho nó (xem mục 4.2).
⚠ `filtersDraft` **giữ ở local** — đồng bộ cả hai gây `useEffect` loop.

### 3.4 Hai MAJOR còn mở từ audit Stage 5

- **Escape cấp file của rule NAV-1 là bản lề** (mục 2.3) — nên sửa rule ở mức **từng
  biến** thay vì cấp file. Đây là nguyên nhân gốc khiến 4/17 hit của W3-2 bị tính nhầm.
- **`setUrlState` dùng `{replace: false}`** ⇒ mỗi ký tự gõ vào ô lọc đẩy **1 history
  entry**. Cân nhắc `replace: true` cho ô nhập văn bản.

---

## 4. NỘI QUY ĐỂ LÀM TIẾP CHO ĐÚNG

### 4.1 Quy trình bắt buộc

```powershell
sh scripts/agent-install-hooks.sh          # neu chua
pwsh -File scripts/agent-sync.ps1           # rebase + gates
git -C <main tree> status --short
node packages/web/scripts/check-multi-agent.mjs
node docs/audit-uiux/scripts/check-ledger-entry.mjs
```

1. **Khai claim** vào cuối `docs/CLAIMS.md`, **commit riêng, trước khi sửa dòng đầu tiên**.
2. Tạo nhánh `feat/<slice>-<agent>`. **Không commit thẳng vào `dev`.**
3. **Dùng `node docs/audit-uiux/scripts/check-ledger-entry.mjs --next-entry`** để lấy
   số Entry. **Đừng tự đoán** — 59 số trùng có sẵn đã xảy ra đúng vì lý do đó.
4. Không commit 9 file deny-list: `AGENTS.md`, `packages/web/package.json`,
   `pyproject.toml`, `requirements.txt`, `package-lock.json`,
   `docker-compose*.yml`, `.env*`.
5. **Đừng `npm install` / `pip install` khi chưa hỏi** (junction `node_modules` dùng chung).
6. **Đừng `git add .` / `-A`** — xem mục 4.3.
7. Không báo "PASS" cho thứ chưa chạy — ghi `CHƯA CHẠY`.

### 4.2 Bài học cụ thể từ wave 3 (rút từ chính lỗi của tác giả)

| Bài học | Vì sao |
|---|---|
| **Đừng sửa gate để AC của mình trông đạt** | Đã nới `fileHasUrlSync` xoá 3 hit giả, tưởng "−17 hit"; audit đo được 4/17 đến từ nới escape. Gốc lại ⇒ NAV-1 95 → 99 |
| **Đo lại số của chính mình bằng script** | `npm run lint` chỉ ra file lỗi lint **khác** với TEST_REPORT |
| **1 dòng comment có thể làm hỏng gate** | Regex quét toàn file; comment của tôi làm 3 hit biến mất oan |
| **Cơ chế của 1 bug có thể là 2 bug** | Flake "1 file" thực ra là module-import + settle race; chỉ sửa 1 cái thì gate vẫn đỏ |
| **Test mà pass cả trước lẫn sau = bằng chứng 0** | 5 test nhóm (b) đọc file ngoài diff; đã viết lại kiểm **tính chất của rule** trên mẫu nội tại |
| **Chứng minh fail-trước bằng cách AN TOÀN** | Copy file ra `%TEMP%` → `git show HEAD:<file>` ghi đè → chạy → copy lại. **Không** `git checkout --` (hazard 11) |
| **Bằng chứng phải có điều kiện tải** | "3 lần xanh" không đáng tin; đã chạy `--maxWorkers=2` (154 s) mới kết luận |

### 4.3 Nếu có agent khác dùng chung thư mục

`git add .` / `git add -A` / `git commit -a` sẽ **nuốt công việc chưa commit của họ**.
Luôn `git add <đường dẫn tường minh>` rồi kiểm `git diff --cached --name-only`.

Dấu hiệu agent khác đang giữ file: `git status --short` có `M` **nhưng**
`git diff -- <file>` **rỗng** ⇒ chỉ stat-dirty, nội dung giống HEAD ⇒ an toàn.
Nếu `git diff` **có** nội dung ⇒ **đừng** đụng file đó.

### 4.4 Gate phải chạy sau khi sửa code

```powershell
node docs/audit-uiux/scripts/scan-ui-guidelines.mjs packages/web/src   # TONG baseline 172
node packages/web/scripts/check-uiux-budget.mjs                        # exit 0
node docs/audit-uiux/scripts/check-ledger-entry.mjs                    # exit 0
cd packages/web
npm run check:tokens ; npm run check:contrast ; npm run check:dom-landmarks
npm run check:ts-imports ; npm run check:i18n-hardcoded
npm run check:admin-spa-routes ; npm run i18n:scan:strict ; npm run check:shell
npx tsc --noEmit          # 0
npm run lint              # 0 (3743 problems / 0 error)
npm run test:components   # 0 (117 file / 817 test)
npm run build             # 0
```

### 4.5 Baseline đã biết (không phải lỗi của bạn)

| Gate | Trạng thái | Ghi chú |
|---|---|---|
| `check_large_files.ps1` | **Fail — có sẵn** | Fail ở `scratch/…`, `packages/core/backend/…`, `SocOverviewPanel.tsx`, `SocDataOpsMonitorSection.tsx`. Không phải file của bạn |
| `check-multi-agent.mjs` | 0 + **~66 cảnh báo** | Cảnh báo claim cũ không tồn tại, không chặn |
| `lint` | **3743 warning** | `react/jsx-no-literals` bắt sẵn 3581 lần. Chỉ cần giữ **0 error** |
| `ledger` | **59 số trùng** | Cố ý giữ nguyên; gate chặn số trùng **mới** |
| `makemigrations` | N/A nếu chỉ sửa `packages/web` + `docs` | Không có file `.py` ⇒ không có migration |

---

## 5. MỘT CÂU HỎI CẦN OWNER QUYẾT

**AC-2.4 của `PLAN_UIUX_WAVE3.md` là tiêu chí bất khả thi (hazard 6).**
Plan đòi "NAV-1 giảm ≥ 26 hit". Thực tế: 7 file đã làm giảm 17, 4 file còn lại chỉ còn
9 ⇒ tổng 26 — nhưng **3 hit phải giữ nguyên**:

- `AdminCoreTenantsPage.tsx:27` `searchDraft` — ô input **đang soạn**; đồng bộ sẽ gây
  `useEffect` loop.
- `AdvisoryOrderTicket.quantity` + `DNSEConnectionPanel.orderQuantity` — ô nhập trong
  form, deep-link **vô nghĩa** (`HANDOFF_UIUX_REMAINING_20261008.md:38-39`).

⇒ **Trần thực tế = 21.** Không sửa được mà không phá hành vi.
Đề xuất: **sửa AC thành "NAV-1 giảm ≥ 17, và 3 hit được liệt kê ở trên được ghi
rõ là cố ý giữ"** — đo được, kiểm chứng được, không ép hành vi sai.