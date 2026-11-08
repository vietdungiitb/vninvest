# Audit độc lập lần 2 — Plan Phase B ĐÃ SỬA so với Spec §5 và Verdict v1 (NEED_REVISION OBJ-1..7)

> **Ngày:** 2026-11-08 · **Auditor:** subagent độc lập (chỉ đọc, không sửa code ngoài file verdict này)
> **Plan được audit (đã sửa):** `docs/PLAN_UIUX_PHASE_B_20261108.md` (313 dòng, Task 1–9) tại HEAD `7839b010e` (`feat/uiux-phase-a`)
> **Spec đối chiếu:** `docs/PLAN_UIUX_REMEDIATION_20261030.md` (§5 slice B1/B2/B3/B4/B5/B6 + errata §3 E1–E10, §7 Gates/DoD)
> **Verdict v1:** `docs/evidence/uiux-remediation/AUDIT_PHASE_B_20261108.md` (116 dòng, NEED_REVISION OBJ-1..7)
> **Codebase tại HEAD:** `git log --oneline -15` = `7839b010e` revise plan → `289076e0c` B2 Security → `120e7f3f4` B6 4/4 UserSettings → `fa8d65081` B6 3/4 Reset → `df03e9007` B6 2/4 Register → `dbf165656` B6 1/4 Login → `485b1d06a` B1 → `f5326a364` claim+plan. Mọi lệnh chỉ đọc.
> **Phương pháp:** `read`/`grep`/`git log --oneline`/`git show --stat`. Không chạy gate/build/test — mọi số gate **CHƯA CHẠY** (L-G02).
> **Câu hỏi đặt cho v2:** plan đã sửa (`git show 7839b010e -- docs/PLAN_UIUX_PHASE_B_20261108.md`: chỉ 59 dòng đổi, thêm rev-note ở Task 1/2/4/5/6) có xử lý đủ 7 objection v1 không.

---

## 1. Verdict v2

### **NEED_REVISION (lần 2) — direction đúng, revision chưa đủ, chưa PASS/AGREE, chưa REJECT**

- **Không REJECT:** kiến trúc vẫn đúng spec §5 B1–B6 (+C/D/E); 4 objection đã xử lý về mặt khung việc (OBJ-6 chốt hẳn; OBJ-3 có bảng 12 route; OBJ-4 đưa `ShellToast` vào Files + scope DONE; OBJ-5 tái dùng script gate). Không có slice nào bịa ngoài spec.
- **Không AGREE:** bản đã sửa **thêm note đúng hướng nhưng không đồng bộ các mục Steps/Commit/Produces/Baseline** nên plan hiện chứa **mâu thuẫn nội tại** (rev-note bảo "không liệt kê Login/Register vào commit" nhưng Step 5 vẫn `git add` 2 file đó; rev-note bảo "không re-implement B1" nhưng Task 1 vẫn giữ Steps 1–7 fail-before checklist; rev-note B2 chọn Billing nhưng Step 1 vẫn Dashboard). Ngoài ra HEAD đã tiến thêm 3 commit B6 (`dbf165656`+`df03e9007`+`fa8d65081`+`120e7f3f4` = **B6 4/4 DONE**) và 1 commit B2 Security (`289076e0c`) **trước** commit revise `7839b010e`, nhưng rev-note Task 6 vẫn viết Reset "vẫn `useState`" — **sai tại HEAD**. Implementer chạy plan nguyên văn vẫn sẽ re-implement việc đã xong hoặc nhận fail-before ngược. Đó là đúng lỗi Critical mà v1 đã chặn, chỉ giảm mức độ.
- **Việc cần làm (nhỏ, ~0.25 ngày):** sửa plan lần 3 theo §4 cuối file này (đánh dấu B6 DONE, xoá/hạ checklist Task 1/6 Steps cũ, đồng bộ Commit/Produces/Baseline header + Step B2/B3/B5), rồi re-audit v3 → AGREE. Không thay effort S/M/L.

**Tóm tắt 5 điểm nghiêm trọng nhất:**

1. **B6 claim "phần còn lại" trong khi đã 4/4 DONE** — `AuthResetPasswordPage.tsx:3-4,36-37` đã `useForm`+`zodResolver`, `authResetSchema.ts` đã có importer (`AuthResetPasswordPage.tsx:9`), `UserSettingsPage.tsx:8,104` + `changePasswordSchema.ts:5` đã RHF; plan dòng 230–233 mô tả Reset "vẫn `useState`" và Step 5 dòng 253 vẫn `git add AuthLoginPage/AuthRegisterPage` đã xong → fail-before không bao giờ fail (OBJ-2 tái diễn ở dạng mới).
2. **Task 1 chưa đóng vòng** — dòng 64–66 đánh dấu ĐÃ LÀM đúng, nhưng Steps 1–7 dòng 77–107 vẫn là checklist `- [ ]` với Step 2 "Expected FAIL" và Step 5 re-wrap + Step 7 commit duplicate; implementer theo Goal dòng 5 "implement task-by-task" vẫn có thể overwrite test đang pass (OBJ-1 chưa đóng).
3. **Baseline header vẫn `dd94fc3e1`** dòng 37, không có Step 0 re-baseline; commit message ghi "re-baseline" nhưng diff `7839b010e` **không sửa** bảng baseline dòng 39–49 và header dòng 37 → số gate stale 5–6 commit, không dùng làm DoD được (OBJ-7 chưa xử lý).
4. **B2 bảng có khung nhưng 5/12 dòng chưa đọc** (dòng 121,124,125,128 = "cần đọc ở mục này"/"đọc khi implement") và Step 1 dòng 138 chọn `/dashboard` mâu thuẫn Files dòng 132 chọn Billing; B2 Security `289076e0c` (đã làm ở `TenantAdminSecurityPage.tsx`) không được map vào bảng → AC top12 vẫn chưa kiểm hết (OBJ-3 xử lý một phần).
5. **Các commit-list/Produces còn lệch Files** — B5 Step 5 dòng 222 thiếu `ShellToast.tsx:81` và evidence `B5-icon-button-grep.txt` (Files dòng 204–207 đã thêm); B3 Step 1 dòng 162 "grep" mâu thuẫn Files dòng 156 "spawnSync script"; B6 Produces dòng 244 "4 form" mâu thuẫn rev-note "3 form" dòng 233 (OBJ-4b/5 còn dư).

---

## 2. Đối chiếu 7 objection (v1 §4) — plan đã sửa vs code thật

### OBJ-1 (Critical) — Task 1 đã DONE — **XỬ LÝ MỘT PHẦN (chưa đóng)**

| Yêu cầu v1 | Plan đã sửa (`file:line`) | Code thật (`file:line`) | Đánh giá |
|---|---|---|---|
| Đánh dấu Task 1 **ĐÃ LÀM (giữ)** với evidence 3 file + `485b1d06a` | `docs/PLAN_UIUX_PHASE_B_20261108.md:64` title "ĐÃ LÀM (giữ)"; `:66` evidence "`PageErrorBoundary.tsx:28-53` không còn log `[StockDetailPage]`, không `sdp-*`; `FullLayout.tsx:47-54,114` wrap+`key`+focus; test `page-error-boundary.component.test.tsx:7-40` tồn tại" | `packages/web/src/components/PageErrorBoundary.tsx:28-32` chỉ `console.error(error, info)`, `:43` `page-error-boundary` (không `sdp-*`), `:44-53` default EN; `packages/web/src/layouts/full/FullLayout.tsx:47-54` effect close-drawer + `focus({preventScroll:true})`, `:103-110` `tabIndex:-1`, `:114` `e(PageErrorBoundary, {key: location.pathname}, e(Outlet))`; `git log` `485b1d06a` B1 tồn tại | **ĐỦ** ở mức tiêu đề + note |
| Xoá Steps 1–7 khỏi checklist, hoặc giữ 1 step bổ sung **test tên khác** (reset/`preventScroll`/EN), không overwrite | `:66` "Không re-implement; chỉ bổ sung test reset/`preventScroll`/EN nếu cần (tính năng bổ sung, không thay Task này)" — tốt, nhưng Steps 1–7 **giữ nguyên** `:77-107` (`- [ ]` chưa tick, Step 2 "Expected FAIL", Step 5 "Implement B1.2", Step 7 `git add` + commit duplicate) | Test hiện hữu `page-error-boundary.component.test.tsx:7-40` (v1 E-4) vẫn là file `page-error-boundary.component.test.tsx` — cùng tên mà plan chưa tạo tên mới | **CHƯA ĐỦ** — implementer đọc theo checkbox vẫn có thể viết lại test/commit trùng. V1 yêu cầu "xoá Steps 1–7 khỏi checklist" chưa thực hiện; note bổ sung không nêu rõ "tên file mới/khác" |
| Cập nhật Baseline HEAD `dd94fc3e1` → `df03e9007` (+Step 0) | `:37` vẫn "`HEAD feat/uiux-phase-a @ dd94fc3e1`"; `:39-49` bảng baseline **không đổi** trong diff `7839b010e` | HEAD thật `7839b010e` (5 commit sau `dd94fc3e1`: `485b1d06a`, `dbf165656`, `df03e9007`, `fa8d65081`, `120e7f3f4`, `289076e0c`, `7839b010e`) | **CHƯA XỬ LÝ** → cộng OBJ-7 |

### OBJ-2 (Critical) — Task 6 fail-before sai một nửa — **XỬ LÝ MỘT PHẦN, nay còn sai thông tin (stale mới)**

| Yêu cầu v1 | Plan đã sửa | Code thật | Đánh giá |
|---|---|---|---|
| (a) Thu hẹp còn lại: migrate `AuthResetPasswordPage.tsx` + quyết định `authResetSchema.ts` (dùng thì commit cùng slice) | `:228-232` title "phần còn lại: Reset + change-password"; note (a) "`AuthResetPasswordPage.tsx:36-42` (vẫn `useState`) → migrate + `resetRequestSchema` (`authResetSchema.ts:5-8` đã tạo, `-- untracked (0 importer) — dùng nó trong cùng slice`); Files `:236-237` `Modify AuthResetPasswordPage` + `Create (đã tạo, chưa dùng) authResetSchema.ts` | Tại HEAD: `AuthResetPasswordPage.tsx:3-4` đã `useForm`+`zodResolver`, `:36-37` `useForm<ResetValues>({resolver: zodResolver(isConfirmMode ? resetConfirmSchema : resetRequestSchema)})`; `authResetSchema.ts:5` `resetRequestSchema` tồn tại **có importer** `AuthResetPasswordPage.tsx:9`; `fa8d65081` (cha của revise) "AuthResetPasswordPage -> RHF+zod, conditional schema request vs confirm" (+ test `auth-forms-rhf-reset.component.test.tsx`, schema 17 dòng). `git status` sạch — không còn `?? authResetSchema.ts` | **SAI tại HEAD** — mô tả "vẫn `useState`, untracked, 0 importer" là đúng tại `df03e9007` (thời điểm v1) nhưng **đã cũ 2 commit** trước `7839b010e`. Plan revise viết lại quá khứ, chưa re-read code |
| (b) Chốt change-password = `UserSettingsPage.tsx` + ghi `file:line` hàm đổi mật khẩu trước khi claim | `:232` "(b) change-password thực tế ở `UserSettingsPage.tsx:249` (`userSettings.passwordSuccess`) — đọc thêm hàm đổi mật khẩu để ghi `file:line` chính xác trước khi claim (chưa đọc trong vòng này)"; `:238` "`UserSettingsPage.tsx` (chỉ khi đã đọc xác nhận...; không sửa nếu ngoài scope)" | `UserSettingsPage.tsx:8` đã `import {changePasswordSchema}`, `:104` `resolver: zodResolver(changePasswordSchema)`, `:245-259` `registerPw("new_password")` + `FormField` + `pwErrors.new_password_confirm` — tức **B6 4/4 đã DONE** qua `120e7f3f4` ("UserSettings password form -> RHF+zod, keep changeUserPassword payload", + `changePasswordSchema.ts:5`, test `user-settings-password-rhf.component.test.tsx`). `UserSettingsPage.tsx:249` nay là `type: "password"` input, **không còn** `t("userSettings.passwordSuccess")` như v1 E-13 | **CHƯA ĐỦ + SAI `file:line`** — plan tự thừa nhận "chưa đọc", đồng thời citation `:249` đã cũ sau `120e7f3f4` |
| (c) Commit set **không** gồm Login/Register; AC "4 form" → "3 form" | Note `:230` "không liệt kê 2 file này vào commit tiếp theo" + `:233` "Login+Register (đã xong)+Reset = 3 form"; nhưng **Produces `:244`** vẫn "4 form dùng `useForm` + zod", **Step 1 `:246`** vẫn "4 form dùng `useForm`+zod", **Step 5 `:253`** `git add src/pages/auth/AuthLoginPage.tsx src/pages/auth/AuthRegisterPage.tsx src/pages/auth/AuthResetPasswordPage.tsx ...` — liệt kê lại 2 file đã xong | `AuthLoginPage.tsx:3-4,42` + `AuthRegisterPage.tsx:3-4,32-33` đã migrate (`dbf165656`, `df03e9007`) | **MÂU THUẪN NỘI TẠI** — note đúng nhưng Steps/Commit chưa sửa theo. Với B6 nay DONE 4/4, đúng fix là đánh dấu Task 6 **ĐÃ LÀM (giữ)** như Task 1, không phải "phần còn lại" |

### OBJ-3 (Major) — B2 12 route — **XỬ LÝ MỘT PHẦN (khung có, 5 dòng chưa đọc)**

| Yêu cầu v1 | Plan đã sửa | Code thật | Đánh giá |
|---|---|---|---|
| Bảng 12 dòng route→file→trạng thái→việc còn lại, kèm `file:line`; xác nhận Watchlist + `/portfolios`; test đại diện route **thiếu** skeleton | `:113` rev-note "bảng 12 route... Test đại diện chọn route thiếu skeleton (Billing)"; bảng `:115-128` 12 dòng (1 Dashboard, 2 StockDetail, 3 AlertCenter, 4 Screener, 5 `/portfolios` overview `PortfolioOverviewPage.tsx`, 6 `/portfolios/manage` `PortfoliosPage.tsx`, 7 settings `UserSettingsPage.tsx`, 8 operations-center, 9 admin/tenants, 10 billing, 11 ai-advisory, 12 watchlist); Files `:131-132` 12 file + test "đại diện **BillingCenter**" | 12 file đều tồn tại (glob, `WatchlistPage.tsx` có mặt — v1 E-7 đã đóng về tồn tại). `DashboardPage.tsx` có `LoadingSkeleton` local; `BillingCenterPage.tsx:362-372` text loading `t('commercial.billingCenter.loading')` (không skeleton) — khớp dòng 10 bảng; `UserSettingsPage.tsx:59,64,74` manual `setLoading` không `ShellSkeleton` — khớp dòng 7; `WhaleAdvisoryPage.tsx:166` `pageLoading`, grep `Skeleton` = 0 hit — khớp dòng 11; `UserSettingsPage.tsx` grep `ShellSkeleton` = 0 hit | **Khung ĐỦ**, Watchlist + portfolios tách 2 dòng (gặp yêu cầu) |
| Kèm `file:line` **cho mỗi dòng**; test Steps phải đồng bộ Files | Dòng 1–4,7,10,11 có `file:line` cụ thể; **dòng 5,8,9,12** vẫn "Chưa đo... cần đọc", "Lazy panel... (đọc code khi implement)", "Admin kit (chưa `file:line`)", "Cần đọc thực tế" — 4–5/12 dòng deferred. **Step 1 `:138`** "(đại diện 1 route: `/dashboard`)" **mâu thuẫn** Files `:132` (Billing) | `289076e0c` B2 Security (`TenantAdminSecurityPage.tsx` +16/−1) đã làm 1 phần B2 nhưng **không xuất hiện trong bảng** (bảng chỉ có 12 file top12, không có Security) — B2 thực tế là 13 file nếu tính Security | **MỘT PHẦN** — v1 yêu cầu bảng "để AC kiểm được"; 5 dòng "đọc khi implement" + Step mâu thuẫn + B2 Security ngoài bảng thì AC chưa kiểm hết |

### OBJ-4 (Major) — B5 scope — **XỬ LÝ GẦN ĐỦ (còn lệch Commit)**

| Yêu cầu v1 | Plan đã sửa | Code thật | Đánh giá |
|---|---|---|---|
| (a) Icon-button 10 page: chốt bằng lệnh grep + attach evidence (hoặc ghi rõ implementer phải chạy trước commit) | Files `:205-207` lệnh `Select-String -Path "packages/web/src/pages" -Pattern "<button" | ... | Group-Object Path | Sort-Object Count -Descending | Select-Object -First 10` + "(lưu output vào `docs/evidence/uiux-remediation/B5-icon-button-grep.txt` trong cùng commit; implementer không tự liệt kê từ trí nhớ)" | Chưa có file evidence này tại HEAD (glob/`git status` sạch) — đúng vì implementer chưa chạy; plan đã chọn nhánh "implementer phải chạy + attach" mà v1 cho phép | **ĐỦ** (theo điều kiện v1, không yêu cầu danh sách sẵn ngay) |
| (b) Quyết định `ShellToast.tsx:81` (đưa vào Files hoặc giới hạn test 1 file) | Rev-note `:200` "đưa cả 2 vào Files"; Files `:203-204` `SocSchedulerBoard.tsx:366` + `ShellToast.tsx:81` (`"Close"` → `t("common.close")` + `useI18n`) | `ShellToast.tsx:81` `aria-label: "Close"` (`closeBtnProps` object, comment `jsx-no-literals`) vẫn hardcode; `SocSchedulerBoard.tsx:366` vẫn `"Close"` (v1 E-11) | **ĐỦ** về quyết định. Nhưng **Step 5 `:222`** `git add src/components/soc/SocSchedulerBoard.tsx <icon-button files> test` **thiếu** `ShellToast.tsx` và `B5-icon-button-grep.txt` — implementer chạy theo Commit sẽ để sót file đã liệt kê |
| (c) `scope="col"`: liệt kê thiếu hoặc tuyên bố DONE `ff90ffb28` kèm số đếm | Rev-note `:200` "`scope="col"` ĐÃ LÀM ở Phase A (`ff90ffb28` — đã 100+ hit, không làm lại); chỉ bổ sung khi còn `<th>` thiếu `scope` (đếm lại bằng grep trước commit)" | `ff90ffb28` Phase A "table scope a11y" (plan `:55`); 100+ hit (v1 E-11, vd `AdminCoreTenantsPage.tsx:284-289`) | **ĐỦ** |
| (d) Test 2 nhánh `<main>` theo từng nhánh | Files `:208-209` "giữ nguyên `AuthLoginPage.tsx:129,141`; test render cả 2 nhánh (`isCheckingSession=true` và `false`)"; Produces `:213` "1 `<main>`/trang theo nhánh" | `AuthLoginPage.tsx:117-119` + `:134-135` 2 nhánh `<main>` (v1 E-11) | **ĐỦ**. Lưu ý `file:line` plan `:129,141` vs code `:117-119/:134-135` (lệch do HEAD cũ) — minor, không chặn |

### OBJ-5 (Minor) — B3 test grep — **XỬ LÝ GẦN ĐỦ (còn wording thừa)**

| Yêu cầu v1 | Plan đã sửa | Code thật | Đánh giá |
|---|---|---|---|
| Step 1/Step 4 ghi đúng lệnh `node scripts/check-i18n-hardcoded.mjs <file>` per-file + `TOTAL_HARDCODED_VI`; tái dùng script (mirror `classifyLine`), không viết grep riêng | Files `:156` "**tái dùng script** qua `spawnSync` per-file, không viết grep riêng — mirror `classifyLine` ở `packages/web/scripts/check-i18n-hardcoded.mjs:79-122`: bỏ dòng có `t(`/`defaultValue`, bỏ comment/className/test-file. `TOTAL_HARDCODED_VI` kỳ vọng per-file, vd `ShellMailConfigPage.tsx:101,112,118-119` là hit thật" | `packages/web/scripts/check-i18n-hardcoded.mjs:44-48` (không arg → exit 2), `:79-122` classify bỏ `t(`/`defaultValue`; `ShellMailConfigPage.tsx:101,112,118-119` hardcode thật (v1 E-9) | **ĐỦ** ở Files. Step 4 `:165` vẫn viết "`node scripts/check-i18n-hardcoded.mjs <8 file>` = 0" (chung chung thay vì per-file) và **Step 1 `:162`** vẫn "grep 8 file có chuỗi Việt" — wording cũ chưa xoá, nhưng Files là nguồn chính xác, implementer có căn cứ để chạy đúng |

### OBJ-6 (Minor) — B4 đường dẫn wrapper — **XỬ LÝ ĐỦ**

| Yêu cầu v1 | Plan đã sửa | Code thật | Đánh giá |
|---|---|---|---|
| Chốt 1 đường dẫn + `cwd` qua `scripts/pre-push-gate.mjs` `run()` (existsSync-guard, SKIP≠PASS `:74-80`) | `:178` "Create: `packages/web/scripts/check-i18n-hardcoded-scope.mjs` — chốt đường dẫn này (cạnh script gốc `packages/web/scripts/check-i18n-hardcoded.mjs` để tái dùng `classifyLine`-tương tự"; `:179` "`scripts/pre-push-gate.mjs` — gọi wrapper với `cwd = packages/web` qua hàm `run()` (`existsSync`-guard, SKIP≠PASS, `:74-80`). KHÔNG sửa `package.json`" | `packages/web/scripts/check-i18n-hardcoded.mjs` tồn tại; `scripts/pre-push-gate.mjs` tồn tại với `run()` + guard (v1 E-10); wrapper chưa tồn tại (đúng — việc của Task 4) | **ĐỦ** |

### OBJ-7 (Minor) — Baseline stale — **CHƯA XỬ LÝ**

| Yêu cầu v1 | Plan đã sửa | Code thật | Đánh giá |
|---|---|---|---|
| Thêm Step 0 re-baseline tại HEAD (`df03e9007`), cập nhật Baseline HEAD, ghi số mới / `CHƯA CHẠY` + lý do | Header `:37` vẫn "`dd94fc3e1`"; không có Step 0; `:39-49` bảng số **không đổi** (diff `7839b010e` không chạm các dòng này). Commit message ghi "re-baseline" nhưng nội dung không re-baseline | HEAD thật `7839b010e` (6–7 commit sau `dd94fc3e1`); B1 đổi `FullLayout`, B6 đổi 2–4 form auth + thêm test — số lint warn / test count có thể dịch chuyển (v1 E-5/E-17), auditor không chạy lại nên **không khẳng định** số cũ còn đúng | **CHƯA XỬ LÝ** — nếu implementer dùng số `dd94fc3e1` làm DoD cho HEAD hiện tại sẽ vi phạm L-G02 (báo PASS cho thứ chưa chạy lại) |

---

## 3. Phát hiện mới ở v2 (ngoài 7 OBJ v1)

- **NV-1 (Critical, tái diễn OBJ-2):** Task 6 nay DONE 4/4 nhưng plan vẫn là "phần còn lại". Bằng chứng: `fa8d65081` Reset + `120e7f3f4` UserSettings đều là **cha** của revise commit `7839b010e`, nên tác giả revise đã có thông tin B6 4/4 trong `git log` mà vẫn viết "vẫn `useState`". Fix đúng là **ĐÃ LÀM (giữ)** như Task 1, kèm evidence `AuthResetPasswordPage.tsx:3-4,36-37` + `UserSettingsPage.tsx:8,104` + `changePasswordSchema.ts:5`.
- **NV-2 (Major):** Mẫu lỗi chung của revision: chỉ prepend rev-note + sửa Files, không sửa Steps/Produces/Commit/Baseline → 4 mâu thuẫn nội tại (Task 1 Steps checklist, Task 6 Step 5, B2 Step 1, B5 Step 5). Lần 3 phải sửa **toàn bộ khối Task** chứ không chỉ thêm note.
- **NV-3 (Minor):** `git show 7839b010e --stat` cho thấy commit revise còn commit kèm `AUDIT_PHASE_B_20261108.md` (verdict v1, 116 dòng) — đúng rule 6 (verdict thành văn bản), không phải lỗi. File verdict v2 này là artefact duy nhất của vòng này, đúng phạm vi auditor được giao.
- **NV-4 (Minor):** `docs/CLAIMS.md` không thuộc scope v2 (auditor không đọc `CLAIMS.md` tại HEAD trong vòng này — claim `uiux-phase-a` ở `f5326a364` ghi "B1->B6->B2->B3->B4->B5"; sau B6 4/4 + B2 Security, coordinator cần xác nhận claim slice còn `in-progress` hay đã `done` khi claim slice tiếp — ngoài verdict plan, nhắc coordinator).

**Gates v2:** không chạy tsc/lint/test/build (chỉ đọc) — **CHƯA CHẠY** toàn bộ, không dùng số baseline `dd94fc3e1` (plan `:39-49`) làm DoD.

---

## 4. Recommendation cho implementer (sửa plan lần 3, không sửa code)

1. **Đánh dấu Task 6 ĐÃ LÀM (giữ)** như Task 1: evidence `AuthLoginPage.tsx:3-4,42` (`dbf165656`), `AuthRegisterPage.tsx:3-4,32-33` (`df03e9007`), `AuthResetPasswordPage.tsx:3-4,9,36-37` (`fa8d65081`), `UserSettingsPage.tsx:8,104` + `changePasswordSchema.ts:5` (`120e7f3f4`); xoá/hạ Steps 1–5 + commit `git add Login/Register` dòng 253; Produces dòng 244 sửa "4 form dùng `useForm`" → "4 form ĐÃ dùng `useForm` (evidence trên)"; xoá "chưa đọc trong vòng này" dòng 232.
2. **Đóng Task 1:** xoá hoặc tick + ghi "ĐÃ LÀM" cho Steps 1–7 dòng 77–107, hoặc thay bằng 1 Step bổ sung duy nhất "test reset/`preventScroll`/EN — file test **tên mới/khác**, không overwrite `page-error-boundary.component.test.tsx`"; nêu tên file mới nếu có.
3. **Đồng bộ B2:** Step 1 dòng 138 Dashboard → Billing (khớp Files dòng 132); hoàn thành 4–5 dòng bảng chưa đọc (5,8,9,12) bằng `file:line` thật **hoặc** ghi rõ ngoài scope + lý do (nếu ngoài scope sửa tên slice top12 → top-N); thêm dòng chú thích B2 Security `289076e0c` đã làm bao nhiêu để tránh đếm trùng.
4. **Đồng bộ B3/B5:** B3 Step 1 dòng 162 "grep" → "`node scripts/check-i18n-hardcoded.mjs <file>` per-file qua `spawnSync` (mirror `classifyLine`)"; B5 Step 5 dòng 222 thêm `src/components/ShellToast.tsx` + `docs/evidence/uiux-remediation/B5-icon-button-grep.txt` vào `git add`.
5. **Re-baseline thật (OBJ-7):** cập nhật header dòng 37 → HEAD hiện tại (`7839b010e` hoặc commit sau), thêm Step 0 chạy lại 6 lệnh local tại `packages/web` (`tsc`, `lint`, `check-tokens`, `check-contrast`, `check:dom-landmarks`, `test:components`) ghi số mới; không chạy được → `CHƯA CHẠY` + lý do. Sửa luôn citation `AuthLoginPage.tsx:129,141` → `:117-119`/`:134-135` nếu giữ.
6. **Re-audit v3** → AGREE (lưu `docs/evidence/uiux-remediation/AUDIT_PHASE_B_20261108_v3.md` hoặc append kết luận). Chỉ sau AGREE mới claim slice tiếp theo (`docs/AGENT_PROTOCOL.md` §10–§11, nạp `project-lessons` trước claim, không commit vào `dev`, 1 Entry ledger/slice, `git diff --numstat` khớp).

---

## 5. Kết luận audit

- **Direction: AGREE** — plan đi đúng spec §5 B1–B6 (+C/D/E), tái dùng primitive sẵn có, tôn trọng deny-list, errata/DoD đúng.
- **Hiện trạng plan đã sửa: NEED_REVISION (v2)** — 1 OBJ xử lý đủ (OBJ-6), 3 OBJ gần đủ (OBJ-3/4/5, còn dư nhỏ), 2 OBJ một phần (OBJ-1/2, note đúng nhưng Steps/Commit chưa đồng bộ; OBJ-2 nay sai `file:line` do B6 đã 4/4), 1 OBJ chưa xử lý (OBJ-7 Baseline). Không REJECT vì tổng effort không đổi và mọi lỗi sửa được ở mức plan.
- Trách nhiệm tiếp theo thuộc người sửa plan (coordinator/implementer chính). Auditor không sửa code ngoài file verdict này.

*Auditor: đọc trực tiếp UTF-8 bằng read/grep (không đọc qua console shell Windows), file không tồn tại → báo KHÔNG TỒN TẠI, chưa đọc → không suy diễn. Mọi khẳng định kèm `file:line`; không chạy gate nên không báo PASS cho thứ chưa chạy.*
