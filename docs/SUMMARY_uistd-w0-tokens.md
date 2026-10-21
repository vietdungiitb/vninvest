# SUMMARY — worker `uistd-w0-tokens` (slice S3 của `docs/PLAN_UI_STANDARDIZATION_W0.md`)

- **Nhánh:** `feat/uistd-w0-tokens` (base `dev` @ `e7b008f25`) · **Worktree:** `C:\MujocoProjects\agent-uistd-a3`
- **Ngày:** 2026-10-20 · **Claim:** đã khai sẵn ở commit `4f416e1eb` (KHÔNG khai lại)
- **Phạm vi:** **DOC-ONLY** — AC-1 của plan (đo light theme + viết ADR). **KHÔNG sửa 1 dòng CSS nào.**
- **Commit:** `f1f74bf32` (script + ADR) · commit summary: xem `git log -2 --oneline`

> **Lessons áp dụng:** `[L-V01]` (control có đáp án biết trước) · `[L-V02]` (tự phản chứng claim bằng công cụ khác) · `[L-V06]` (`oklch` → `rgb()` qua span tạm, không regex) · `[L-G02]` (không báo PASS cho thứ chưa chạy) · `[L-T01]/[L-T03]` (`git diff --numstat` trước `git add`) · `[L-002]/[L-008]` (claim trước, sửa sau) · `[L-M02]` (tên agent khớp hậu tố nhánh)

---

## 1. File đã đổi (2 file, **0 file CSS**)

| File | Trạng thái | Nội dung |
|---|---|---|
| `packages/web/scripts/measure-theme-tokens.mjs` | **mới** (988 dòng) | script **CHỈ ĐO** — Playwright chromium trên staging, 4 route × 2 theme + 2 mô phỏng |
| `docs/ADR_THEME_LIGHT_20261020.md` | **mới** (253 dòng) | ADR: triệu chứng · nguyên nhân gốc R1–R4 · hệ quả runtime · 2 phương án (a)/(b) · câu hỏi chặn Owner |
| `docs/SUMMARY_uistd-w0-tokens.md` | **mới** | file này |

**KHÔNG chạm** (NG-1/NG-4/NG-5/NG-6): `packages/web/src/theme/tokens.css` · `packages/web/src/index.css` · `packages/web/src/components/soc/soc.tokens.css` · `packages/web/src/components/soc/soc.components.css` · **không** file CSS nào khác.

**Bằng chứng "không sửa token":** `git diff --numstat` (trước khi stage) chỉ có 2 dòng trên; `git diff dev..HEAD --name-only` không chứa file `.css` nào.

---

## 2. Số đo light theme ĐO THẬT (staging `https://docker.edusuccess.vn`)

- **Sha đang chạy trên staging:** `6a127002e392a8aa66484ee33e61c119ec9a36d8` (branch `feat/vnbroker-console`) — đọc qua SSH `root@14.225.255.47:/opt/vninvest`
- **Thời điểm đo cuối:** `2026-10-20T17:00:46.128Z` · **xác nhận tái lập:** `17:03:02.873Z` · `17:06:45.201Z` (3 lần đo liên tiếp, **mọi số trùng khớp**)
- **CONTROL (L-V01):** `#fff`/`#000` = **21.00** · `#777`/`#fff` = **4.48** — chạy **32 lần / 0 lần lệch** ⇒ `CONTROL OK`

| Route | H1 dark (không `data-theme`) | H1 light (`data-theme="light"`) | Chữ dưới WCAG AA (dark → light) |
|---|---|---|---|
| `/admin/users` | `#ffffff` trên `#020617` = **20.1728:1** | `#020617` trên `#020617` = **1.0000:1 ← VÔ HÌNH** | 8/60 → **28/60** (thấp nhất **1.0000:1**) |
| `/operations-center?tab=vnbroker` | `#f1f5f9` trên `#020617` = **18.4140:1** | **18.4140:1** (H1 cứng sáng) | 8/60 → **20/60** (1.9482:1) |
| `/dashboard` | `#f1f5f9` trên `#020617` = **18.4140:1** | **18.4140:1** | 8/60 → **14/60** (1.3284:1) |
| `/portfolios/manage` | `#f1f5f9` = **17.6506:1** | `#0f172a` trên `#ffffff` = **17.8525:1** | 8/60 → **9/60** (3.6292:1) |

**Canvas thật** (`getComputedStyle(document.body).backgroundColor`) = `oklch(0.13 0.028 261.692)` → `#030712` ở **CẢ** light lẫn dark; lớp trong `<div class="bg-[var(--color-bg-primary)]">` = `#020617` ở **CẢ** hai theme ⇒ **canvas không bao giờ chuyển sáng**.

**Token đọc được (2 theme):**

| Token | dark | light |
|---|---|---|
| `--text-primary` | `#f1f5f9` | **`#0f172a`** (đảo sang tối) |
| `--color-bg-primary` | `#020617` | **`#020617`** (không đổi ⇒ canvas tối) |
| `--text-muted` | `#94a3b8` | `#64748b` |
| `--bg-panel` | `/dashboard`: **`#0f172a`** · `/admin/users`: **`rgba(8 23 52 / .4)`** | `#ffffff` |
| `--bg-panel-solid` | `/dashboard`: **(KHÔNG định nghĩa)** · `/admin/users`: `rgb(8 23 52)` | `#ffffff` |

**Mô phỏng (inject CSS, KHÔNG sửa app):**

| Mô phỏng | Kết quả |
|---|---|
| **SIM-A** — `light` + `--color-bg-primary:#f8fafc` (= phương án (a) làm light đúng) | `/admin/users` H1 → **19.2806:1** ✔ nhưng `/operations-center` & `/dashboard` H1 → **1.0471:1** ✘ vô hình; `/dashboard` số chữ dưới AA **14 → 29 / 60** |
| **SIM-B** — override `--color-slate-950:#f1f5f9` (= "sửa nhỏ" `text-slate-950` toàn cục) | `/admin/users` H1 → **18.4140:1** ✔ nhưng số chữ dưới AA **28 → 29 / 60**; panel nền trắng rơi **20.1728:1 → 1.0955:1** |

---

## 3. Gate đã chạy (output thật)

cwd = repo root `C:\MujocoProjects\agent-uistd-a3`.

| # | Lệnh | Exit | Output (rút gọn) |
|---|---|---|---|
| 1 | `node packages/web/scripts/measure-theme-tokens.mjs` | **0** | `CONTROL OK: 32 lan - #fff tren #000 = 21.00, #777 tren #fff = 4.48` |
| 2 | `node packages/web/scripts/check-multi-agent.mjs` | **0** | `0 lỗi, 0 trùng số migration — PASS` |
| 3 | `node scripts/normalize-eol.mjs` | **0** | `normalize-eol — OK (0 file thay doi, tat ca khop dang blob goc)` |
| 4 | `node packages/web/scripts/measure-theme-tokens.mjs --token-conflict` | **0** | `MODE mode B (:root + @theme) => CONFLICT = 13 (baseline 13)` / `=> KHONG DOI so voi baseline 13` · `MODE mode A (:root thuần) => CONFLICT = 11 (baseline 11)` / `=> KHONG DOI so voi baseline 11` |
| 5 | `node packages/web/scripts/measure-theme-tokens.mjs --scan-hardcoded` | **0** | `CHU SANG CUNG : 497 cho trong 89 / 585 file` · `NEN TOI CUNG : 76 cho trong 36 file` · `File CSS co khoi :root[data-theme="light"] THAT: => 4 file` |
| 6 | `npx eslint scripts/measure-theme-tokens.mjs` (trong `packages/web`) | **0** | (không output) |

> **AC-1 câu 3 — "đếm lại token conflict vẫn 13":** ✔ **13** (mode B) / **11** (mode A) — **không đổi**, tức **không** sinh conflict mới.

**Token conflict = 13 là số đo TĨNH** (đếm trong repo, không cần mạng) ⇒ tái lập được ở mọi máy.

---

## 4. `CHUA CHAY` (kèm lý do)

| Lần | Lệnh | Kết quả |
|---|---|---|
| 1 / 6 lần chạy đo | `node packages/web/scripts/measure-theme-tokens.mjs --json` | **`CHUA CHAY: page.waitForURL: Timeout 45000ms exceeded`** (đăng nhập staging không kịp chuyển về `/dashboard`) → script in `CHUA CHAY` + **exit 0** (đúng plan N1: `pre-push-gate.mjs:307` coi exit ≠ 0 là FAIL). **5 lần chạy còn lại thành công**, đo đủ 4 route. |

**Không có `CHUA CHAY` nào trong các gate bắt buộc** (1–4 ở bảng trên đều PASS với exit 0 và output thật).

**Không chạy** (ngoài scope S3, để coordinator/S2 lo):
- `npm run test` (jest) · `npm run test:components` (vitest) · `npm run build` (tsc + vite) — S3 **không** chạm file `.ts`/`.tsx`/`.css` ⇒ không thể làm đỏ các gate này; baseline của chúng đã đo ở plan §Baseline.
- `node scripts/check-theme-contrast.mjs` · `check-token-conflict.mjs` · `check-focus-ring.mjs` · `check-heading-contract.mjs` · `check-a11y-runtime.mjs` — **chưa tồn tại** (S2 tạo ở worktree khác, chưa merge). S3 **không** tự tạo để tránh ghi đè file của agent khác.
- `npm run i18n:scan` — S3 không thêm chuỗi i18n nào (script + ADR không có UI).

---

## 5. Waiver

| # | Waiver | Lý do |
|---|---|---|
| W-1 | **Không** chạy `npm run build` / `npm run test:components` | S3 là **DOC-ONLY**: 0 dòng `.ts`/`.tsx`/`.css` bị đổi ⇒ không có đường nào để làm đỏ 2 gate này. Đã thay bằng bằng chứng mạnh hơn cho scope này: `eslint` file script exit 0 + `normalize-eol` exit 0 + `git diff --numstat` không viết lại file. |
| W-2 | **Không** tạo 5 gate của S2 | Plan §SCOPE ghi S3 = `scripts/measure-theme-tokens.mjs` + `docs/ADR_...`; tạo `check-*.mjs` sẽ **ghi đè** file của agent `uistd-w0-gates` trong worktree khác ⇒ vi phạm disjointness (rủi ro "2 worker ghi cùng file" trong plan). |
| W-3 | **Không** cập nhật `docs/CODE_CHANGE_AUDIT_LEDGER.md` | Plan §SCOPE ghi ledger là việc của **coordinator**; AGENTS.md yêu cầu worker append Entry nhưng plan của wave này giao cho coordinator ⇒ báo lại để coordinator quyết (không tự ghi để tránh hunk gộp). |
| W-4 | **Không** thêm `--bg-panel-solid` vào `theme/tokens.css` | NG-6 — sẽ **tạo** conflict 13 → **14** ⇒ làm đỏ gate baseline-locked `check-token-conflict` của S2 ⇒ **tự làm hỏng AC-4**. Đã ghi bằng chứng bác giả thuyết R9 ở ADR §6. |
| W-5 | Số "chữ dưới WCAG AA" của **`/dashboard`** biến động **11 ↔ 14 / 60** giữa các lần đo | Widget thị trường nạp bất đồng bộ ⇒ nội dung mẫu chữ thay đổi. Đã ghi rõ trong ADR §1 (kèm mốc 3 lần đo) và **không** dùng số này làm kết luận chính (kết luận chính = H1 contrast + token + canvas, **tất cả ổn định tuyệt đối**). |

---

## 6. Rủi ro còn lại

| # | Rủi ro | Số đo | Mức |
|---|---|---|---|
| R-1 | Light theme ⇒ **tiêu đề admin biến mất** (chưa ai sửa — W0 **không** sửa light theme) | H1 `/admin/users` = **1.0000:1**; **28/60** chữ dưới WCAG AA (dark 8/60) | **P0** (hiển thị, chưa chặn ai) |
| R-2 | Light theme **không** phải trạng thái hiếm | Backend mặc định `ThemeChoices.DARK` (`identity_access/models.py:165`, `:522`) ⇒ opt-in; nhưng `UserSettingsPage.tsx:109` fallback là `"light"` khi `profile.theme` rỗng | **P1** |
| R-3 | `--bg-panel` khác nhau giữa các route **cùng dark theme** (SOC token nằm trong lazy chunk) | `/dashboard` `#0f172a` vs `/admin/users` `rgba(8 23 52 / .4)` | **P1** |
| R-4 | `--bg-panel-solid` không tồn tại trên route chưa nạp SOC chunk | `/dashboard` → `(KHÔNG định nghĩa)` | **P2** |
| R-5 | Nếu Owner chọn (a) mà làm **nửa** (chỉ đổi canvas) | SIM-A: H1 `/dashboard` & `/operations-center` → **1.0471:1** ⇒ **tạo lỗi mới** | **P0** nếu làm nửa |
| R-6 | Số đo gắn với app **đang chạy**, không phải `dev` | staging = `6a127002e` (`feat/vnbroker-console`) ≠ base `e7b008f25` | **P2** (đã ghi sha trong mọi lần đo) |
| R-7 | Đăng nhập staging **flaky** (1/6 lần timeout 45 s) | `CHUA CHAY: page.waitForURL: Timeout 45000ms exceeded` | **P2** (script exit 0, không chặn push) |

---

## 7. Bài học quy trình (1 bài)

> **L-V01 mở rộng: "CHƯA CHẠY" là một kết quả hợp lệ — nhưng chỉ khi bạn phân biệt được nó với "script của tôi hỏng".**
>
> Phiên này bắt được **1 lỗi script thật** đã bị che: hàm truyền cho `page.evaluate` được **serialize** rồi chạy trong browser ⇒ **không** nhìn thấy biến của Node ⇒ `ReferenceError: CONTROL is not defined`. Nếu cứ để lỗi này rơi vào catch chung với lỗi môi trường, script sẽ in `CHUA CHAY: <lỗi>` + exit 0 ⇒ **người đọc tưởng "máy không có staging"** trong khi thực ra script **hỏng** ⇒ mọi số đo trong lô đó vô giá trị mà **không ai bị cảnh báo** — đúng cái kiểu "xanh giả" mà L-G02 cấm.
>
> ⇒ Sửa: tách **2** nhánh lỗi rõ ràng — lỗi **môi trường** (không có staging/mạng/login) ⇒ `CHUA CHAY` + exit 0; lỗi **script** ⇒ `LOI SCRIPT` + **exit 2**. Và kiểm chứng bằng cách chạy **thật** (không tin lý thuyết): 5 lần chạy thành công ⇒ CONTROL OK 32/32 ⇒ đường đo đúng.
>
> Bổ sung cùng tinh thần đó: **"số phụ thuộc dữ liệu" không phải số tái lập được.** Lần đo đầu cho `/admin/users` 41 phần tử mẫu chữ (bảng còn đang tải) vs lần sau 60 ⇒ thêm `waitForSettled` (networkidle + hết trạng thái "Đang tải") ⇒ tổng mẫu ổn định 60 trên cả 4 route. Số **ổn định tuyệt đối** mới là số dùng làm kết luận (H1 contrast · token · canvas); số biến động thì phải **ghi cả khoảng biến động** (11 ↔ 14 ở `/dashboard`) thay vì chọn 1 giá trị và im lặng.
