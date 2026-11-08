# Audit độc lập lần 3 — Plan Phase B ĐÃ SỬA so với Spec §5 và Verdict v1+v2 (2026-11-08)

> **Ngày:** 2026-11-08 · **Auditor:** subagent độc lập (chỉ đọc, không sửa code ngoài file verdict này)
> **Plan được audit (đã sửa):** `docs/PLAN_UIUX_PHASE_B_20261108.md` (313 dòng, Task 1–9) tại HEAD `740816c6d`
> **Spec đối chiếu:** `docs/PLAN_UIUX_REMEDIATION_20261030.md` (§5 B1/B2/B3/B4/B5/B6, §7 Gates/DoD)
> **Verdict v1:** `docs/evidence/uiux-remediation/AUDIT_PHASE_B_20261108.md:19,58-91` (NEED_REVISION OBJ-1..7)
> **Verdict v2:** `docs/evidence/uiux-remediation/AUDIT_PHASE_B_20261108_v2.md:15-27,33-81` (NEED_REVISION lần 2)
> **Codebase tại HEAD:** `git log --oneline -15` = `740816c6d` docs+ledger 421 ← `c06c72404`/`6e5bd5cab` lint fix ← `7f3f2739a` B2 BillingCenter ← `72bf0a0b2` audit v2 ← `b2fb07782` B2 Reports ← `8318fdf47` B5 Close ← `7839b010e` revise plan ← `289076e0c` B2 Security ← `120e7f3f4` B6 4/4 ← `fa8d65081` B6 3/4 ← `df03e9007` B6 2/4 ← `dbf165656` B6 1/4 ← `485b1d06a` B1 ← `f5326a364` claim+plan. Mọi lệnh chỉ đọc (`read`/`grep`/`git log --stat`).
> **Phương pháp:** `read` trực tiếp UTF-8 + `grep`/`git show --stat` (chỉ đọc). Không chạy gate/build/test — mọi gate **CHƯA CHẠY** theo L-G02.
> **Câu hỏi đặt cho v3:** plan đã sửa tại `7839b010e` có xử lý **đủ 7 OBJ v1** không (cite `file:line`), xét tại HEAD `740816c6d` (đã thêm 5 commit sau revise + v2).

---

## 1. Tóm tắt 5 điểm nghiêm trọng nhất

1. **Plan không đổi kể từ `7839b010e`, nên 7 OBJ v1 chưa hề được đồng bộ ở mức Steps/Commit/Baseline.** `git log --oneline -- docs/PLAN_UIUX_PHASE_B_20261108.md` chỉ có 2 commit (`f5326a364`, `7839b010e`); `git diff 7839b010e HEAD -- docs/PLAN_UIUX_PHASE_B_20261108.md` rỗng. Rev-note đúng hướng nhưng Steps còn nguyên → mâu thuẫn nội tại vẫn còn, đúng như v2 kết luận (`AUDIT_PHASE_B_20261108_v2.md:18,24-27`).
2. **B6 thực tế đã 4/4 DONE, plan vẫn là "phần còn lại".** `AuthResetPasswordPage.tsx:3-4,9,36-37` đã `useForm`+`zodResolver`, `UserSettingsPage.tsx:3-4,8,103-104` đã RHF+zod (commits `fa8d65081`, `120e7f3f4` là cha của revise), nhưng plan `docs/PLAN_UIUX_PHASE_B_20261108.md:230-233` vẫn mô tả Reset "vẫn `useState`" và Step 5 `:253` vẫn `git add` 2 file đã xong. Fail-before theo plan **không bao giờ fail**.
3. **Task 1 chưa đóng vòng.** Plan `:64,66` đánh dấu ĐÃ LÀM đúng, nhưng Steps 1–7 `:77-107` vẫn là checklist `- [ ]` với Step 2 "Expected FAIL" và Step 7 commit duplicate; implementer theo Goal `:5` "implement task-by-task" vẫn có thể overwrite test đang pass `page-error-boundary.component.test.tsx:7-40`.
4. **Baseline header vẫn `dd94fc3e1` (`:37`), không có Step 0 re-baseline.** Số gate tại `docs/AUDIT_UIUX_FRONTEND_20261108.md:19-31` (đo tại `c06c72404`) là nguồn mới, nhưng **plan không trích dẫn** → plan vẫn dùng số stale 8+ commit làm DoD (L-G02).
5. **HEAD tiến thêm sau v2 khiến bảng B2/B5 trong plan càng stale:** B5 Close đã xong (`8318fdf47`), B2 Billing đã xong (`7f3f2739a`, `BillingCenterPage.tsx:5,369-370`), B2 Reports đã xong (`b2fb07782`) — plan `:126,203-204` vẫn liệt kê chúng là "việc còn lại". Code tiến nhanh hơn văn bản, nhưng plan không cập nhật thì implementer vẫn sẽ làm lại việc đã xong.

---

## 2. Verdict v3

### **NEED_REVISION (lần 3) — direction đúng, revision chưa đủ, chưa PASS/AGREE, chưa REJECT**

- **Không REJECT:** kiến trúc vẫn đúng spec §5 B1–B6 (+C/D/E): tổng quát hoá primitive + boundary 1 chỗ ở layout, RHF+zod đã có trong `package.json`, bổ states bằng `ShellSkeleton`/`ShellEmptyState` sẵn có, a11y bằng `t()` sẵn có, tôn trọng deny-list không sửa `package.json`. Không slice nào bịa ngoài spec; C4 recharts loại đúng theo D2. Gates/DoD khớp spec §7.
- **Không AGREE:** plan đã sửa **không đồng bộ toàn bộ khối Task** — chỉ prepend rev-note + sửa Files, không sửa Steps/Produces/Commit/Baseline — nên implementer chạy nguyên văn vẫn re-implement việc đã xong hoặc nhận fail-before ngược. Đây chính là lỗi Critical mà v1 (`AUDIT_PHASE_B_20261108.md:19`) và v2 (`AUDIT_PHASE_B_20261108_v2.md:15`) đã chặn. 5 commit sau revise (`8318fdf47`, `b2fb07782`, `7f3f2739a`, `740816c6d` + lint fix) không làm giảm lỗi plan; chúng làm plan **stale hơn**.
- **Việc cần làm (nhỏ, ~0.25–0.5 ngày, không đổi effort S/M/L):** sửa plan lần 4 theo §4 cuối file này (đánh dấu B6/B5-Close/B2-Billing ĐÃ LÀM, xoá/hạ checklist Task 1/6 Steps cũ, đồng bộ Commit/Produces/Baseline header + Step B2/B3/B5), rồi re-audit v4 → AGREE. Chỉ sau AGREE mới claim slice tiếp theo theo `docs/AGENT_PROTOCOL.md` §10–§11.

**Điểm số đối chiếu 7 OBJ v1:** 1/7 xử lý đủ (OBJ-6), 3/7 gần đủ (OBJ-3/4/5 — còn dư nhỏ), 2/7 một phần (OBJ-1, OBJ-2), 1/7 chưa xử lý (OBJ-7). Khớp phân loại v2 (`AUDIT_PHASE_B_20261108_v2.md:110`); đánh giá lại tại HEAD mới vẫn giữ nguyên phân loại, chỉ tăng mức stale ở OBJ-3/4.

---

## 3. Đối chiếu 7 OBJ v1 — plan đã sửa vs spec §5 vs code thật tại HEAD `740816c6d`

### OBJ-1 (Critical) — Task 1 đã DONE: fail-before mô tả trạng thái cũ — **XỬ LÝ MỘT PHẦN (chưa đóng)**

| Yêu cầu v1 (`AUDIT_PHASE_B_20261108.md:58-61`) | Spec §5 | Plan đã sửa (`file:line`) | Code thật (`file:line`) | Đánh giá |
|---|---|---|---|---|
| Đánh dấu Task 1 ĐÃ LÀM + evidence 3 file + `485b1d06a` | `PLAN_UIUX_REMEDIATION_20261030.md:196-212` (tổng quát hoá, bọc `Outlet` `key=pathname`, focus `#main-content`) | `docs/PLAN_UIUX_PHASE_B_20261108.md:64` title "ĐÃ LÀM (giữ)"; `:66` evidence `PageErrorBoundary.tsx:28-53`, `FullLayout.tsx:47-54,114`, test `:7-40` | `packages/web/src/components/PageErrorBoundary.tsx:28-32` chỉ `console.error(error, info)`, `:43` `page-error-boundary` (không `sdp-*`), `:44-52` default EN; `packages/web/src/layouts/full/FullLayout.tsx:47-54` effect close-drawer + `focus({preventScroll:true})`, `:103-110` `tabIndex:-1`, `:114` `e(PageErrorBoundary, {key: location.pathname}, e(Outlet))`; `git log` `485b1d06a` tồn tại | **ĐỦ** ở title + note |
| Xoá Steps 1–7 khỏi checklist hoặc giữ 1 step bổ sung test tên khác, không overwrite | Cùng §5 B1 Gate (vitest mới) | `:66` "chỉ bổ sung test reset/`preventScroll`/EN nếu cần" nhưng Steps 1–7 **giữ nguyên** `:77-107` (`- [ ]` chưa tick, Step 2 "Expected FAIL", Step 5 re-wrap, Step 7 commit duplicate); không nêu tên file mới | Test hiện hữu `packages/web/src/components/__tests__/page-error-boundary.component.test.tsx:7-40` chỉ 2 test (render throw `:8-24`, không `sdp-`/log `:26-38`); **không** cover reset khi `key` đổi + EN không chứa chữ Việt + `preventScroll` | **CHƯA ĐỦ** — checklist còn mở nên implementer vẫn có thể overwrite/commit trùng |
| Cập nhật Baseline HEAD + Step 0 | Spec §7 `PLAN_UIUX_REMEDIATION_20261030.md:363-375` | `:37` vẫn `dd94fc3e1`, `:39-49` không đổi | HEAD `740816c6d` (8 commit sau `dd94fc3e1`) | **CHƯA** → cộng OBJ-7 |

### OBJ-2 (Critical) — Task 6 fail-before sai một nửa — **XỬ LÝ MỘT PHẦN, nay sai `file:line` (stale mới)**

| Yêu cầu v1 (`:63-69`) | Spec §5 | Plan đã sửa | Code thật | Đánh giá |
|---|---|---|---|---|
| (a) Thu hẹp còn lại: migrate Reset + quyết định `authResetSchema.ts` | `PLAN_UIUX_REMEDIATION_20261030.md:251-260` (RHF+zod, `authPolicy.js` SSOT, 4 form) | `:228` title "phần còn lại: Reset + change-password"; `:231` "Reset `:36-42` vẫn `useState` → migrate + `authResetSchema.ts:5-8` untracked, 0 importer — dùng trong cùng slice"; Files `:236-237` | Tại HEAD: `AuthResetPasswordPage.tsx:3-4` imports `useForm`+`zodResolver`, `:9` importer `authResetSchema`, `:36-37` `useForm<ResetValues>({resolver: zodResolver(isConfirmMode ? resetConfirmSchema : resetRequestSchema)})`; commit `fa8d65081` "AuthResetPasswordPage -> RHF+zod" + test `auth-forms-rhf-reset.component.test.tsx`; `git status` sạch — không còn `??` | **SAI tại HEAD** — mô tả đúng tại `df03e9007` (thời điểm v1) nhưng đã cũ 2 commit trước revise; plan viết lại quá khứ |
| (b) Chốt change-password = `UserSettingsPage.tsx`, ghi `file:line` | §5 B6 "form đổi mật khẩu" | `:232` "(b) … `UserSettingsPage.tsx:249` — đọc thêm hàm đổi mật khẩu … (chưa đọc trong vòng này)"; `:238` "chỉ khi đã đọc xác nhận" | `UserSettingsPage.tsx:3-4` imports RHF+zod, `:8` `changePasswordSchema`, `:103-104` `resolver: zodResolver(changePasswordSchema)`, `:151-169` `onPasswordSubmit` + `changeUserPassword`, `:271` `passwordSuccess` (không còn `:249`); commit `120e7f3f4` B6 4/4 + `changePasswordSchema.ts:5` + test `user-settings-password-rhf.component.test.tsx` | **CHƯA ĐỦ + SAI `file:line`** — plan tự thừa nhận chưa đọc; citation `:249` đã cũ |
| (c) Commit set không gồm Login/Register; AC "4 form" → "3 form" | §5 B6 AC "4 form dùng `useForm`" | Note `:230` "không liệt kê 2 file vào commit" + `:233` "3 form", nhưng Produces `:244` vẫn "4 form dùng `useForm`", Step 1 `:246` vẫn "4 form", Step 5 `:252-254` vẫn `git add AuthLoginPage.tsx AuthRegisterPage.tsx …` | `AuthLoginPage.tsx:3-4,42` + `AuthRegisterPage.tsx:3-4,32-33` đã migrate (`dbf165656`, `df03e9007`) | **MÂU THUẪN NỘI TẠI** — note đúng nhưng Steps/Commit chưa sửa; với B6 nay DONE 4/4, fix đúng là ĐÃ LÀM như Task 1 |
| Kiểm chứng thêm tại HEAD | — | — | `AuthLoginPage.tsx:3-4,42`, `AuthRegisterPage.tsx:3-4,32-33` (grep `useForm`/`zodResolver`) | Khẳng định B6 4/4, không còn "phần còn lại" |

### OBJ-3 (Major) — B2: "12 route" không ánh xạ được — **XỬ LÝ MỘT PHẦN (khung có, stale mới)**

| Yêu cầu v1 (`:71-73`) | Spec §5 | Plan đã sửa | Code thật | Đánh giá |
|---|---|---|---|---|
| Bảng 12 dòng route→file→trạng thái→việc còn lại, kèm `file:line`; xác nhận Watchlist + `/portfolios`; test đại diện route thiếu skeleton | `PLAN_UIUX_REMEDIATION_20261030.md:214-221` (12 route liệt kê, `ShellSkeleton`+`ShellEmptyState` sẵn có) | `:113` rev-note; bảng `:115-128` 12 dòng (1 Dashboard, 2 StockDetail, 3 AlertCenter, 4 Screener, 5 `/portfolios` overview, 6 `/portfolios/manage`, 7 settings, 8 operations-center, 9 admin/tenants, 10 billing, 11 ai-advisory, 12 watchlist); Files `:131-132` 12 file + test "đại diện **BillingCenter**" | 12 file tồn tại; `DashboardPage` có `LoadingSkeleton` local; `BillingCenterPage.tsx:5,369-370` nay **đã** `ShellSkeleton` (`7f3f2739a` sau revise); `UserSettingsPage.tsx:59,64,74` manual `setLoading` không skeleton; `WhaleAdvisoryPage.tsx:166` `pageLoading`, grep Skeleton = 0 hit | **Khung ĐỦ**, Watchlist + portfolios tách 2 dòng (gặp yêu cầu) |
| Kèm `file:line` mỗi dòng; Steps đồng bộ Files; map commit B2 đã làm | §5 B2 AC "12 route có states tương ứng" | Dòng 1–4,7,10,11 có `file:line`; **dòng 5,8,9,12** vẫn "cần đọc"/"đọc khi implement"; **Step 1 `:138`** "(đại diện 1 route: `/dashboard`)" **mâu thuẫn** Files `:132` (Billing); bảng không map `289076e0c` (Security), `b2fb07782` (Reports), `7f3f2739a` (Billing) | `289076e0c`/`b2fb07782`/`7f3f2739a` đã làm 3 phần B2 sau revise nhưng không xuất hiện trong bảng; `docs/AUDIT_UIUX_FRONTEND_20261108.md:13` đo lại "còn 5 route chưa đo/guarded" | **MỘT PHẦN + STALE** — 5 dòng deferred + Step mâu thuẫn + 3 commit B2 ngoài bảng thì AC chưa kiểm hết; tại HEAD bảng dòng 10 (`:126` "Text loading → Thay bằng ShellSkeleton") đã saivì Billing đã xong |

### OBJ-4 (Major) — B5 scope chưa đầy đủ — **XỬ LÝ GẦN ĐỦ, nay stale vì đã làm xong**

| Yêu cầu v1 (`:75-79`) | Spec §5 | Plan đã sửa | Code thật | Đánh giá |
|---|---|---|---|---|
| (a) Icon-button 10 page: lệnh grep + attach evidence | `PLAN_UIUX_REMEDIATION_20261030.md:242-249` ("10 page đông tương tác") | Files `:205-207` lệnh `Select-String … Group-Object Path … Select-Object -First 10` + "(lưu output vào `B5-icon-button-grep.txt` trong cùng commit)" | Chưa có file evidence tại HEAD — đúng vì implementer chưa chạy; plan chọn nhánh v1 cho phép ("implementer phải chạy + attach") | **ĐỦ** theo điều kiện |
| (b) Quyết định `ShellToast.tsx:81` | §5 B5 `"Close"` `SocSchedulerBoard.tsx:366` | Rev `:200` "đưa cả 2 vào Files"; Files `:203-204` `SocSchedulerBoard.tsx:366` + `ShellToast.tsx:81` (`useI18n`) — nhưng **Step 5 `:222`** `git add SocSchedulerBoard.tsx <icon-button files> test` **thiếu** `ShellToast.tsx` + evidence | Tại HEAD cả 2 đã xong qua `8318fdf47`: `ShellToast.tsx:4,80,83` `t("common.close")`, `SocSchedulerBoard.tsx:4,366` `t("common.close", {defaultValue:"Close"})` | **ĐỦ** về quyết định, **STALE** về trạng thái (đã xong mà plan vẫn todo) + Commit thiếu file |
| (c) `scope="col"`: liệt kê thiếu hoặc DONE `ff90ffb28` | §5 B5 "14 bảng + 3 SOC" | Rev `:200` "`scope="col"` ĐÃ LÀM ở Phase A (`ff90ffb28` — đã 100+ hit; chỉ bổ sung khi còn `<th>` thiếu scope)" | `SocSchedulerBoard.tsx:389-392,658-665` đã `scope="col"`; 100+ hit | **ĐỦ** |
| (d) Test 2 nhánh `<main>` theo từng nhánh | §5 B5 AC `check:dom-landmarks` 1 `<main>`/trang | Files `:208-209` "test render cả 2 nhánh (`isCheckingSession=true`/`false`)"; Produces `:213` | `AuthLoginPage.tsx` 2 nhánh `<main>` (v1 E-11) | **ĐỦ** (minor: plan ghi `:129,141` vs code cũ `:117-119/:134-135`) |

### OBJ-5 (Minor) — B3 test grep không khớp logic gate — **XỬ LÝ GẦN ĐỦ (còn wording thừa)**

| Yêu cầu v1 (`:81-83`) | Spec §5 | Plan đã sửa | Code thật | Đánh giá |
|---|---|---|---|---|
| Step ghi đúng lệnh `node scripts/check-i18n-hardcoded.mjs <file>` per-file + `TOTAL_HARDCODED_VI`; tái dùng script (mirror `classifyLine`), không grep riêng | `PLAN_UIUX_REMEDIATION_20261030.md:223-232` (grep chuỗi Việt trong JSX = 0, `i18n:scan:strict` không thêm warning) | Files `:156` "**tái dùng script** qua `spawnSync` per-file, không viết grep riêng — mirror `classifyLine` ở `check-i18n-hardcoded.mjs:79-122` … `TOTAL_HARDCODED_VI` kỳ vọng per-file, vd `ShellMailConfigPage.tsx:101,112,118-119`" | `packages/web/scripts/check-i18n-hardcoded.mjs:44-48` (không arg → exit 2), `:79-122` `classifyLine` bỏ `t(`/`defaultValue`/comment/className/test-file (`:92-96`), `:155-162` in `TOTAL_HARDCODED_VI` + exit 1 | **ĐỦ** ở Files. Step 1 `:162` vẫn "grep 8 file" và Step 4 `:165` vẫn "<8 file>" chung chung — wording cũ chưa xoá, nhưng Files là nguồn chính xác |

### OBJ-6 (Minor) — B4 đường dẫn wrapper mập mờ — **XỬ LÝ ĐỦ**

| Yêu cầu v1 (`:85-87`) | Spec §5 | Plan đã sửa | Code thật | Đánh giá |
|---|---|---|---|---|
| Chốt 1 đường dẫn + `cwd` qua `scripts/pre-push-gate.mjs` `run()` | `PLAN_UIUX_REMEDIATION_20261030.md:234-240` (wrapper baseline + `--all`, gọi từ `pre-push-gate.mjs`, không sửa `package.json`) | `:178` "Create `packages/web/scripts/check-i18n-hardcoded-scope.mjs` — chốt đường dẫn này (cạnh script gốc để tái dùng `classifyLine`-tương tự)"; `:179` "`scripts/pre-push-gate.mjs` — gọi wrapper với `cwd = packages/web` qua `run()` (`existsSync`-guard, SKIP≠PASS `:74-80`)" | `packages/web/scripts/check-i18n-hardcoded.mjs` tồn tại; `scripts/pre-push-gate.mjs:14-21` SKIP≠PASS, `:74-96` `run(cmd, args, cwd)` hỗ trợ `cwd`; wrapper chưa tồn tại (đúng — việc Task 4) | **ĐỦ** |

### OBJ-7 (Minor) — Baseline stale — **CHƯA XỬ LÝ (stale tăng)**

| Yêu cầu v1 (`:89-91`) | Spec §5 | Plan đã sửa | Code thật | Đánh giá |
|---|---|---|---|---|
| Thêm Step 0 re-baseline tại HEAD (`df03e9007`), cập nhật header, ghi số mới / `CHƯA CHẠY` + lý do | `PLAN_UIUX_REMEDIATION_20261030.md:363-375` (Local gates bắt buộc) | Header `:37` vẫn "`dd94fc3e1`"; `:39-49` bảng số **không đổi**; không có Step 0; `git diff 7839b010e HEAD` plan rỗng | HEAD `740816c6d` + audit mới `docs/AUDIT_UIUX_FRONTEND_20261108.md:19-31` đo tại `c06c72404` (`tsc 0`, `lint 0/4604`, `tokens PASS`, `contrast PASS`, `landmarks PASS`, full suite **CHƯA CHẠY lại sau B6/B2** `:27`) — nhưng plan không trích dẫn | **CHƯA XỬ LÝ** — dùng số `dd94fc3e1` làm DoD cho HEAD hiện tại là vi phạm L-G02 |

---

## 4. Contradictions (plan vs code / plan vs chính nó)

| # | Plan nói | Thực tế | Tác động |
|---|---|---|---|
| C-1 | Task 1 `:64` "ĐÃ LÀM" nhưng Steps `:77-107` vẫn mở với Expected FAIL | Test `page-error-boundary.component.test.tsx:7-40` đã pass; `PageErrorBoundary.tsx:28-43` đã generalize | Implementer có thể overwrite test pass / commit trùng (OBJ-1 chưa đóng) |
| C-2 | Task 6 `:230` "không liệt kê Login/Register vào commit" nhưng Step 5 `:253` vẫn `git add` chúng | `AuthLoginPage.tsx:3-4,42` + `AuthRegisterPage.tsx:3-4,32-33` đã xong `dbf165656`/`df03e9007` | Diff rỗng cho 2 file, fail-before ngược (OBJ-2 tái diễn) |
| C-3 | Task 6 `:231` "Reset vẫn `useState`, schema untracked, 0 importer" | `AuthResetPasswordPage.tsx:3-4,9,36-37` đã RHF; `fa8d65081` là cha của revise | Plan viết lại quá khứ, sai `file:line` tại HEAD (OBJ-2, NV-1 v2) |
| C-4 | Task 6 Produces `:244` "4 form" vs rev-note `:233` "3 form" | Tại HEAD đã 4/4 DONE (`120e7f3f4`) | AC đếm sai; không biết khi nào slice xong |
| C-5 | B2 Step 1 `:138` "đại diện `/dashboard`" vs Files `:132` "đại diện BillingCenter" | `DashboardPage` đã có `LoadingSkeleton` local; `BillingCenterPage.tsx:369-370` nay đã có `ShellSkeleton` | Test đại diện sai; fail-before chọn route đã có skeleton là vô nghĩa |
| C-6 | B2 bảng dòng 10 `:126` "Text loading → Thay bằng ShellSkeleton" | `BillingCenterPage.tsx:5,369-370` đã thay qua `7f3f2739a` | Việc còn lại là việc đã xong; đếm top12 sai |
| C-7 | B5 Step 5 `:222` thiếu `ShellToast.tsx` + evidence trong khi Files `:204,207` đã thêm | `ShellToast.tsx:83` + `SocSchedulerBoard.tsx:366` đã xong `8318fdf47` | Implementer theo Commit sẽ để sót file / làm lại việc đã xong |
| C-8 | B3 Step 1 `:162` "grep" vs Files `:156` "spawnSync script" | Script `check-i18n-hardcoded.mjs:79-122` là nguồn đúng | Implementer grep thô sẽ báo fail giả (đếm `defaultValue`) |
| C-9 | Baseline header `:37` `dd94fc3e1` vs HĐ `740816c6d` + đo mới `AUDIT_UIUX_FRONTEND_20261108.md:19-31` | Plan trích dẫn số cũ, không có Step 0 | Dùng số cũ làm DoD = báo PASS cho thứ chưa chạy lại (L-G02) |

---

## 5. Tác động & nguyên nhân gốc

- **Tác động (nếu chạy plan nguyên văn):** implementer chạy theo checkbox sẽ (a) overwrite test B1 đang pass hoặc tạo blocker giả ở Task 1; (b) nhận fail-before ngược ở B6 (test "Expected FAIL" sẽ PASS vì code đã migrate) và commit diff rỗng; (c) chọn test đại diện B2 sai route; (d) grep B3 sai logic nên sửa oan `defaultValue`; (e) dùng baseline cũ làm DoD. Mọi lỗi đều sửa được ở mức plan, **không** cần đổi kiến trúc.
- **Nguyên nhân gốc (NV-2 v2, tái xác nhận):** revision chỉ **prepend rev-note + sửa Files**, không sửa Steps/Produces/Commit/Baseline. Code tiến nhanh sau revise (5 commit) nhưng văn bản plan không theo kịp. Đây là vấn đề quy trình, không phải vướng mắc kỹ thuật.
- **Điểm dương giữ nguyên (v1/v2 đã ghi, v3 xác nhận):** direction đúng spec §5; errata trích đúng; thứ tự B1→B2/B3/B4/B5→B6→C→D→E khớp spec §6; Gates/DoD khớp spec §7; ghi `CHƯA CHẠY` cho build/BE/VPS là đúng L-G02; claim `docs/CLAIMS.md:1888` `uiux-phase-a` `in-progress` còn hiệu lực.

---

## 6. Đề xuất sửa plan lần 4 (không sửa code, không đổi effort)

| Ưu tiên | Việc | Chi tiết (mức dòng plan hiện tại) |
|---|---|---|
| P0-1 | Đánh dấu Task 6 **ĐÃ LÀM (giữ)** như Task 1 | Evidence `AuthLoginPage.tsx:3-4,42` (`dbf165656`), `AuthRegisterPage.tsx:3-4,32-33` (`df03e9007`), `AuthResetPasswordPage.tsx:3-4,9,36-37` (`fa8d65081`), `UserSettingsPage.tsx:3-4,8,103-104,151-169` + `changePasswordSchema.ts:5` (`120e7f3f4`); xoá/hạ Steps `:246-254` + commit `:253`; Produces `:244` → "4 form ĐÃ dùng `useForm`"; xoá "chưa đọc" `:232` |
| P0-2 | Đóng Task 1 | Xoá hoặc tick + ghi "ĐÃ LÀM" cho Steps `:77-107`, hoặc thay bằng 1 Step bổ sung duy nhất "test reset/`preventScroll`/EN — file test **tên mới/khác**, không overwrite `page-error-boundary.component.test.tsx`"; nêu tên file mới nếu có |
| P0-3 | Re-baseline thật (OBJ-7) | Cập nhật header `:37` → HEAD hiện tại (`740816c6d` hoặc commit sau), thêm Step 0 chạy lại 6 lệnh local tại `packages/web` (`tsc`, `lint`, `check-tokens`, `check-contrast`, `check:dom-landmarks`, `test:components`) ghi số mới; không chạy được → `CHƯA CHẠY` + lý do; có thể trích dẫn `docs/AUDIT_UIUX_FRONTEND_20261108.md:19-31` thay vì số `dd94fc3e1` |
| P1-1 | Đồng bộ B2 | Step 1 `:138` Dashboard → Billing (khớp Files `:132`), và cập nhật dòng 10 `:126` thành ĐÃ LÀM (`7f3f2739a`); hoàn thành 4 dòng chưa đọc (`:121,124,125,128`) bằng `file:line` thật **hoặc** ghi rõ ngoài scope + lý do; thêm chú thích `289076e0c`/`b2fb07782` đã làm bao nhiêu để tránh đếm trùng |
| P1-2 | Đồng bộ B3/B5 | B3 Step 1 `:162` "grep" → "`node scripts/check-i18n-hardcoded.mjs <file>` per-file qua `spawnSync` (mirror `classifyLine` `:79-122`)"; B5: đánh dấu Close ĐÃ LÀM (`8318fdf47`, `ShellToast.tsx:83` + `SocSchedulerBoard.tsx:366`) và Step 5 `:222` thêm `ShellToast.tsx` + `B5-icon-button-grep.txt` vào `git add` nếu còn giữ step icon-button |
| P2 | Sửa citation nhỏ | `AuthLoginPage.tsx:129,141` (`:200`) → `:117-119`/`:134-135` nếu giữ; kiểm tra mọi `file:line` sau HEAD mới |

Tổng effort revision ≈ 0.25–0.5 ngày (đọc + bảng + sửa chữ), không thay effort S/M/L các slice B2–B5 còn lại (B3/B4 chưa làm, B5 icon-button chưa làm, B2 còn Whale/UserSettings/OperationsCenter/AdminTenants/Watchlist…).

---

## 7. Tests & validation cần chạy (auditor không chạy — CHƯA CHẠY)

- Auditor **không chạy** gate nào trong vòng v3 (chỉ đọc): `npx tsc --noEmit`, `npm run lint`, `node scripts/check-tokens.mjs`, `node scripts/check-contrast.mjs`, `npm run check:dom-landmarks`, `npm run test:components`, `npm run build`, BE test, VPS E2E/axe/visual — **CHƯA CHẠY** toàn bộ, không dùng số baseline `dd94fc3e1` (plan `:39-49`) hay số `AUDIT_UIUX_FRONTEND_20261108.md:19-31` (đo tại `c06c72404`) làm DoD cho HEAD `740816c6d`.
- Khi sửa plan lần 4, Step 0 phải chạy lại 6 lệnh local tại `packages/web` và ghi số mới; không chạy được → ghi `CHƯA CHẠY` + lý do (Global Constraints plan `:23`, spec §7). Riêng full suite + build sau B6/B2 mới đã được ghi `CHƯA CHẠY` tại `docs/AUDIT_UIUX_FRONTEND_20261108.md:27,61` và phải chạy lại trước PR.
- Test B1 bổ sung (nếu giữ) phải assert reset khi `key` đổi (navigate `/err` → `/dashboard`), EN không chứa chuỗi Việt cứng, `preventScroll` (`FullLayout.tsx:52`); test B2 đại diện phải là route **thiếu** skeleton (Whale/UserSettings), không chọn Dashboard/Billing đã có; test B3 phải chạy script per-file `check-i18n-hardcoded.mjs:44-48,79-122`, không grep riêng.

---

## 8. Next steps / Owner

- **Coordinator / implementer chính (người sửa plan):** thực hiện §6 (P0-1 → P0-3 → P1-1 → P1-2), chỉ sửa `docs/PLAN_UIUX_PHASE_B_20261108.md` (không sửa code trong vòng sửa plan), sau đó mở re-audit v4 với verdict `AGREE` (lưu `docs/evidence/uiux-remediation/AUDIT_PHASE_B_20261108_v4.md` hoặc append kết luận).
- **Owner:** không cần quyết định mới (D1/D2/D3/D4 chặn các slice khác, không chặn việc sửa plan này). Tránh mở slice B3/B4/B5-icon-button trước khi plan v4 đạt `AGREE`.
- **Quy tắc an toàn không đổi:** mỗi slice 1 commit + 1 Entry ledger, `git diff --numstat` phải khớp dự kiến, không `npm/pip install`, không migration, không chạm deny-list (`AGENTS.md`, `packages/web/package.json`, `pyproject.toml`, `requirements.txt`, `package-lock.json`, `docker-compose*.yml`, `.env*`), token vào `soc.tokens.css` / class vào `soc.components.css` (KHÔNG `soc.module.css`), i18n thêm key `vi.js`+`en.js` cùng lúc, `CHƯA CHẠY` cho build/BE/VPS tới khi chạy trên VPS staging `14.225.255.47` (`bash scripts/deploy-staging.sh --verify`). Chỉ sau `AGREE` mới claim slice tiếp theo (`docs/AGENT_PROTOCOL.md` §10–§11, nạp `project-lessons` trước claim, không commit vào `dev`, PR merge-commit không squash).
- **Kế hoạch B3, B4 là việc còn lại chưa làm theo plan:** B3 (8 page) + B4 (wrapper `packages/web/scripts/check-i18n-hardcoded-scope.mjs` + `cwd=packages/web` từ `scripts/pre-push-gate.mjs:74-96`) chưa có commit; B5 icon-button (10 page) chưa làm; B2 còn Whale/UserSettings/OperationsCenter/AdminTenants/Watchlist… — không suy ra "đã xong" từ ledger, phải đọc code thật khi claim.

---

## 9. Kết luận audit

- **Direction: AGREE** — plan đi đúng spec §5 B1–B6 (+C/D/E), tái dùng primitive sẵn có, tôn trọng deny-list, errata/DoD đúng.
- **Hiện trạng plan đã sửa: NEED_REVISION (v3)** — 1 OBJ đủ (OBJ-6), 3 OBJ gần đủ (OBJ-3/4/5 còn dư nhỏ + stale mới do `8318fdf47`/`7f3f2739a` sau revise), 2 OBJ một phần (OBJ-1/2: note đúng nhưng Steps/Commit/Baseline chưa đồng bộ, OBJ-2 sai `file:line` do B6 đã 4/4), 1 OBJ chưa xử lý (OBJ-7 Baseline). Không REJECT vì mọi lỗi sửa được ở mức plan và tổng effort không đổi.
- Trách nhiệm tiếp theo thuộc người sửa plan. Auditor không sửa code ngoài file verdict này (chỉ tạo `docs/evidence/uiux-remediation/AUDIT_PHASE_B_20261108_v3.md` theo rule 6).

*Auditor: đọc trực tiếp UTF-8 bằng `read`/`grep`/`git` (không đọc qua console shell Windows), file không tồn tại → báo KHÔNG TỒN TẠI, chưa đọc → không suy diễn. Mọi khẳng định kèm `file:line`; không chạy gate nên không báo PASS cho thứ chưa chạy.*
