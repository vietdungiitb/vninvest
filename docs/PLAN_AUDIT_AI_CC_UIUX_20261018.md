# PLAN AUDIT — AI CC UI/UX 2026-10-18

> **Auditor độc lập, READ-ONLY với product source.** Không sửa file nào trong `packages/`.
> Duy nhất file tạo mới: `docs/PLAN_AUDIT_AI_CC_UIUX_20261018.md`.
> Đối tượng: `docs/PLAN_AI_CC_UIUX_20261018.md` (434 dòng) @ `96cc87e12`, branch `feat/ai-cc-uiux`.
> HEAD xác nhận bằng `git rev-parse HEAD` ⇒ `96cc87e12ce0e979d65ff616a1110634d4d46ed7`.

| | |
|---|---|
| **Lệnh đã chạy thật** | `npm run lint` · `npm run check:tokens` · `npm run check:contrast` · `npm run i18n:scan:strict` · `npx tsc --noEmit` · `node ./scripts/check-ai-cc.mjs` (+`--self-test`) · `node ./scripts/check-uiux-budget.mjs` · `npm run test:components` · `eslint --stdin` ×3 biến thể |
| **Quy ước** | Mọi dòng kết luận để **mục + verdict trên CÙNG dòng** (hazard 20). Số không tái tạo được ghi `ƯỚC LƯỢNG` hoặc `CHƯA CHẠY`. |
| **Lessons áp dụng** | L-V01 (script đo phải có control) · L-V02 (gốc rễ kế thừa cần phản chứng) · L-V03 (gate ghi file ⇒ `git status`) · L-F07 (tách `$LASTEXITCODE`) · L-T02 (citation = file + dòng + byte) · L-G02 (không báo PASS cho thứ chưa chạy) · L-G04 (con số phải kèm lệnh tái tạo) · L-002/L-M02 (claim) |

---

## Verdict

```
NEED_REVISION
confidence: high
```

**Lý do đủ để KHÔNG phải `PASS`** — 11 lỗi cụ thể, trong đó 3 lỗi sẽ khiến người thực thi **tạo ra bằng chứng sai**:
1. `AC1.4` (fail-before) **làm hỏng file** — đo được UTF-16LE BOM, 11 288 byte vs blob 5 512 byte.
2. `AC3.1` **đã đúng sẵn trước khi sửa** — `grep -c labelKey` = 6, threshold `≥ 6` ⇒ AC rỗng, không bao giờ đỏ.
3. `AC3.1` + `AC4.3` dùng lệnh `grep` — **`grep` không tồn tại** trên Windows PowerShell 5.1.

**Lý do đủ để KHÔNG phải `REJECT`** — phần lõi của plan **rất tốt và tái tạo được nguyên văn**:
- **8/8 gate baseline khớp con số tuyệt đối**, kể cả 5 chỉ số G7 và thời gian 110,93 s.
- **G2 đúng chính xác 1 error** tại `AICommandCenterForm.tsx:305`; **AC0.1 là fix duy nhất hoạt động** — đo bằng `eslint --stdin` (module-level ⇒ exit 0; thêm dep ⇒ vẫn exit 1).
- **Hazard 6 được tôn trọng**: không AC nào đòi `check:tokens` exit 0; `AC5.4` nói rõ "KHÔNG đòi exit 0".
- 9/11 finding (F1, F2, F3 kết luận, B1, B2, B3, B4, B5, B7) đúng về **kết luận**.

---

## 1. Kiểm chứng citation

**Công cụ:** `node` đọc `fs.readFileSync(abs,'utf8')`, tách dòng, in `JSON.stringify(dòng)` — trích **nguyên văn byte giải mã** (L-T02). Script: `audit-cites.mjs` / `audit-cites2.mjs`.
**Tổng khẳng định có đánh số dòng kiểm chứng được: 68. Sai: 5. Lệch 1 dòng: 4. Lệch do artifact đếm newline cuối: 2.**

### 1.1 Nhóm SAI (5) — verdict từng dòng

| # | Citation của plan | Byte thật đọc được | **Verdict** |
|---|---|---|---|
| C1 | `tabOverview` dùng cho tab route `:234` và anchor `:230` (plan:76) | `AICommandCenterPage.tsx:234` = `}, t("aiCommandCenter.tabOverview")),` **nằm trong anchor nav `:229-245`**; `:230` = `e(Link, {` (không phải nhãn). Tab route dùng `AiHubNav.tsx:78` | **SAI** — đảo ngược cả hai dòng |
| C2 | `tabAudit` dùng cho tab route `AiHubNav.tsx:110` và anchor `:241` (plan:76) | `AiHubNav.tsx:110` = `active: location.pathname.startsWith("/settings/ai/audit")` — labelKey thật ở **`:109`**; `AICommandCenterPage.tsx:241` = `key: "nav-audit"` — label thật ở **`:244`** | **LỆCH** (2 dòng, lệch 1 và lệch 3) |
| C3 | `getAICommandCenterConfig` tại `AICommandCenterForm.tsx:83` (plan:91, lặp ở AC2.5/F2) | `AICommandCenterForm.tsx:83` = `updateConfig: (payload: Record<string, unknown>) => Promise<AISettings>;`. **`Select-String "getAICommandCenterConfig"` trong file ⇒ 0 hit.** Chỗ gọi thật: `AICommandCenterPage.tsx:33` | **SAI FILE** |
| C4 | `pf-manage-rebuild` ở `docs/CLAIMS.md:1359` (plan:46) | `:1359` = claim **`paper-copy-a0`**, status `done`, "RELEASED qua PR #171". `pf-manage-rebuild` nằm ở **`:1222–1227`** | **SAI** |
| C5 | B6: "grep mọi `.css` trong `packages/web/src`: **0 định nghĩa**" (plan:128) | `--accent-cyan-soft` = 0 định nghĩa ✓, nhưng **`--border-strong` có 2 định nghĩa**: `soc.tokens.css:11` `--border-strong: rgba(var(--soc-rgb-5078a8) / 0.25);` và `:123` `--border-strong: rgba(15, 23, 42, 0.2);` | **SAI** (1/2) |

### 1.2 Nhóm LỆCH artifact (2) — không phải lỗi plan

| Citation | Đo | **Verdict** |
|---|---|---|
| `soc.tokens.css` "185 dòng" | 186 phần tử sau `split(/\r?\n/)`; **140 token `--*` khớp tuyệt đối** | **LỆCH 1** — artifact newline cuối |
| `soc.components.css` "4076 dòng" | 4077 phần tử | **LỆCH 1** — artifact |

### 1.3 Nhóm ĐÚNG (đã trích nguyên văn)

| Nhóm | Kiểm chứng | **Verdict** |
|---|---|---|
| F1 | `AICommandCenterPage.tsx:227` = `e(AiHubNav, { key: "hub-tabs" })`; `:229` = `e("nav", { key: "hub-nav", className: styles.hubNav, "aria-label": t("aiCommandCenter.title") }, [`; `:245` = `]),`; `AiHubNav.tsx:117` = `` { className: `${styles.hubNav} ${className}`, "aria-label": t("aiCommandCenter.title") } ``; `AiHubNav.tsx:60` = `export function AiHubNav({ className = "" }: { className?: string }) {`; `AiHubNav.tsx:79` = `active: location.pathname === "/settings/ai",`; `AICommandCenterPage.tsx:233` = hash-cond đúng nguyên văn; `aiSettings.module.css:132/145/169` = `.hubNav {`/`.hubNavLink {`/`.hubNavLinkActive {` | **ĐÚNG** (9/9) |
| F1 "2/3 mục trùng nhãn" | Anchor: `:234` Tổng quan · `:239` `t("aiCommandCenter.tabRuntime")` · `:244` `t("aiCommandCenter.tabAudit")`. Route: `AiHubNav.tsx:78/89/96/102/109` = tabOverview/tabUsage/tabTraces/tabSlo/tabAudit. Trùng đúng 2 (Tổng quan, Nhật ký audit) | **ĐÚNG** |
| F2 | `vi.js:5380` = `operationPolicy: 'Chính sách vận hành',`; `:5381` = `eventGate: 'Gate sự kiện',`; `:5409` = `title: 'Trung tâm điều hành AI',`; `:2487` = `title: 'Cài đặt tài khoản',`; `Breadcrumb.tsx:49` = `settings: 'userSettings.title',`; `AICommandCenterPage.tsx:119-134` chứa `:123` `const userConfig = await (coreApiAdapter as any).getUserConfig();` + `:126` `setEventGateEnabled(prefs.advisory_whale_signal_enabled !== false);`; `:175` = `const res = await (coreApiAdapter as any).updateUserConfig({ advisory_whale_signal_enabled: next });`; `:260` = `e(ShellPanel, { key: "policy", title: t("aiCommandCenter.operationPolicy") },`; `:262` key `pol-gate`; `:276` đóng | **ĐÚNG** (10/10) |
| F3 | `:112/:113/:114` đúng 3 setter; `:277/:281/:285` đúng 3 `metricCard`; `AICommandCenterForm.tsx:271/:272` đúng; `:745` `data-testid: "field-max-tokens"`; `:764` `data-testid: "field-refresh-interval"`; `:31` = `advisory_max_auto_refreshes_per_day?: number;`; `AICommandCenterPage.component.test.js:226` = `advisory_max_auto_refreshes_per_day: 8,`; `vi.js:5385/5387/5496/5497/5541` đúng nguyên văn | **ĐÚNG** (14/14) |
| F3 "grep chỉ 3 hit" | Script đệ quy `packages/web/src` (ext ts/tsx/js/jsx/css/json) với **CONTROL** `advisory_refresh_interval_hours` = 17 hit (>0 ⇒ bộ lọc hoạt động). `advisory_max_auto_refreshes_per_day` = **10 hit**: `AICommandCenterForm.tsx:31`, `AICommandCenterPage.tsx:113`, **`pages/signals/WhaleAdvisoryPage.tsx:28` + `:548`**, test ×6 | **SAI** — thiếu 7 hit; plan bỏ sót trang thứ 2 (`WhaleAdvisoryPage.tsx:548` = `/{refreshInfo.advisory_max_auto_refreshes_per_day ?? EMPTY_DASH}`) |
| B1 | `portfolio_analytics_views.py:1176/1301/1492/1580` đều = `'effective_ai_source': metadata.get('effective_ai_source') or 'command_center',`; tổng **7 hit** trong `packages/core/backend/src` khớp tuyệt đối | **ĐÚNG** (5/5) |
| B1 "không chỗ nào ghi" | Grep bổ sung theo mẫu gán (`metadata[...]=`/`.setdefault`/`.update(`): **0 hit**. Đối chiếu đường ghi thật của `advisory_refresh_interval_hours` (`:1445` `if 'advisory_refresh_interval_hours' in payload:`) — `effective_ai_source` **không** có block tương ứng | **ĐÚNG** |
| B2 | `providerModels.ts:67-73` = 5 option, **0/5 có `labelKey`**; `:4-5` = comment + `labelKey?: string;`; `AICommandCenterForm.tsx:584-586` = `PROVIDER_OPTIONS.map((p) => e("option", { key: p.key, value: p.key }, t(p.labelKey ?? p.label))` | **ĐÚNG** (4/4) |
| B3 | `AICommandCenterPage.tsx:416` = `+ (entry.source ? ` · ${entry.source}` : "")` | **ĐÚNG** |
| B4 | `sidebaritems.ts:39` (thật: `src/layouts/full/vertical/sidebar/sidebaritems.ts`) = `{ labelKey: 'layout.nav.aiCommandCenter', path: '/settings/ai', icon: 'Cpu' },`; `vi.js:98` = `aiCommandCenter: 'Trung tâm AI',`; `Breadcrumb.tsx:50` = `ai: 'userSettings.aiGroup.title',`; `vi.js:2490` = `title: 'Trí tuệ nhân tạo',`; `:219` = `e("h1", {...}, t("aiCommandCenter.title")),`; `UserSettingsPage.tsx:276` = `t("userSettings.aiGroup.goTo", { defaultValue: "Mở trung tâm AI" })`; `vi.js:2492` = `goTo: 'Mở trung tâm AI',`; `vi.js:5410` = `eyebrow: 'Cài đặt',`; `vi.js:131` = `aiCommandCenter: 'Trung tâm AI',` | **ĐÚNG** (9/9) |
| **B5** | `AICommandCenterForm.tsx:181-186` — **brace depth = 1**, hàm bao là `export function AICommandCenterForm({` tại `:124` ⇒ **khai trong thân component** ✓. `:305` = `    [onSettingsChange, onPromptConfigChange]` | **ĐÚNG** — root cause chuẩn |
| B7 | `vi.js:5449-5463`: đếm máy bằng regex dấu tiếng Việt ⇒ **15/15 dòng KHÔNG dấu**, `5449` = `titleAudit: 'Nhat ky kiem toan AI',`, `5463` = `auditColReason: 'Ly do',` | **ĐÚNG** |
| §0/§1 | `ShellPageTemplate.js:69` = `export function ShellPanel({ title, subtitle, actions = null, children, className = "", as = "article" }) {`; `:80` = `title ? renderElement("h2", { className: styles.panelTitle }, title) : null,`; `aiSettings.module.css` `:root` = `:55`…`:69`, đếm máy **13 token `--ai-*`** khớp | **ĐÚNG** (5/5) |
| §0 claim | Claim `ai-cc-uiux` nằm ở `docs/CLAIMS.md:1608`; plan ghi `1605-1609` (file chỉ có 1608 dòng) | **LỆCH** — vùng đúng, biên trên dư 1 |

> **Ghi chú tự phê bình (L-V01):** tôi **suýt** kết luận "B5 sai" vì dòng `:181` thụt 0 dòng trông như cấp module. Đo brace depth + chạy `eslint --stdin` mới lật ngược: eslint báo `181:7 ... makes the dependencies of useCallback Hook change on every render`. **Plan đúng; suy luận của tôi sai.**

---

## 2. Refute premises

**Quy trình L-F07:** mọi lệnh dùng dạng `$out = & <lệnh> 2>&1; $st = $LASTEXITCODE` — **không** pipe vào `Select-String`/`Out-String` rồi đọc exit code.

| Gate | Exit **thật** | Số plan | Đo lại | **Verdict** |
|---|---|---|---|---|
| G1 `npx tsc --noEmit` | **0** | 0 | exit 0, không output | **ĐÚNG** |
| G2 `npm run lint` | **1** | 1 | `✖ 4157 problems (1 error, 4156 warnings)`; dòng error duy nhất `305:5 error React Hook useCallback has a missing dependency: 'SUB_AGENT_PROMPT_FIELDS'` trong `AICommandCenterForm.tsx`; 4156 warning | **ĐÚNG** — đúng 1 error, đúng file, đúng dòng, đúng rule |
| G3 `npm run check:tokens` | **1** | 1 | `✗ check:tokens — hard hex outside allowlist:` / `src\components\brokerData\brokerData.css: #c4b5fd` | **ĐÚNG** |
| G4 `npm run check:contrast` | **0** | 0 | `✓ check:contrast — PASS (7 tone pairs × 2 modes >= 4.5:1)` | **ĐÚNG** — kể cả "7 tone pair" |
| G5 `npm run i18n:scan:strict` | **0** | 0 | exit 0 (có in warning `i18next-scanner` về `defaultValue` khác nhau) | **ĐÚNG** |
| G6 `node ./scripts/check-ai-cc.mjs` | **0** | 0 | **10** dòng `PASS` (AC1…AC5, AC6, AC7, AC8a, AC8b, AC8c) + `check-ai-cc: SACH.` | **ĐÚNG** |
| G7 `node ./scripts/check-uiux-budget.mjs` | **1** | 1 | `CSS-1 baseline=0 hien tai=4` · `CSS-2 46→55` · `I18N-1 0→1` · `A11Y-9 5→8` · `NAV-1 89→37` — **5/5 khớp tuyệt đối** | **ĐÚNG** |
| G8 `npm run test:components` | **0** | 0 | `Test Files 164 passed (164)` · `Tests 1122 passed (1122)` · `Duration 110.93s` | **ĐÚNG** — 164/1122 khớp tuyệt đối |
| — `--report` của G7 | — | (user cảnh báo) | `check-uiux-budget.mjs` **không có** token `report`; usage ghi `--json` tại `:24` | **Xác nhận cảnh báo** — không dùng cờ này |

### 2.1 Kiểm chứng AC0.1 bằng `eslint --stdin` (read-only, không sửa file)

| Biến thể | Cách làm | Exit | **Verdict** |
|---|---|---|---|
| A — nguyên trạng | file hiện tại qua `--stdin` | **1** (`305:5` missing dependency) | **ĐÚNG** với fail-before của plan |
| B — **chính xác AC0.1** | chuyểu `const SUB_AGENT_PROMPT_FIELDS` (179-186) lên ngay sau `:17 const e = createElement;`, **không** thêm dep | **0** — không còn dòng error nào | **ĐÚNG** — AC0.1 là fix **duy nhất** hoạt động |
| C — thêm dep thay vì chuyển | thêm `'SUB_AGENT_PROMPT_FIELDS'` vào deps, giữ nguyên vị trí khai | **1** — `305:5 ... unnecessary dependency` | **Phản chứng** — fix "thêm dep" (bản năng) là **sai** |

> **Kết luận AC0.1 — ĐÚNG và chính xác đến mức đáng ngạc nhiên.** Plan đã chẩn đoán đúng rằng phải *chuyển*, không phải *thêm*. Đây là bằng chứng mạnh nhất cho độ tin cậy của plan.

### 2.2 Ghi đè file (L-V03)

| Kiểm tra | Kết quả | **Verdict** |
|---|---|---|
| `git status --short` sau khi chạy đủ 9 gate + `eslint --stdin` ×3 | **CLEAN — 0 dòng**, không file nào bị gate ghi ngoài ý muốn | **ĐÚNG** — không side effect |

---

## 3. Đánh giá AC

**Tiêu chí:** (a) lệnh tái tạo có chạy được không — tôi đã **thử chạy**; (b) fail-before có rõ không; (c) có đòi thứ không kiểm chứng được không; (d) trùng/mâu thuẫn.

| AC | Lệnh tái tạo — đã thử chạy | Fail-before | Vấn đề | **Verdict** |
|---|---|---|---|---|
| AC0.1 | `npm run lint 2>&1 \| Select-String "AICommandCenterForm.tsx" -Context 0,2` — chạy được, không lỗi cú pháp | Rõ + **đã tái hiện** | Không | **PASS** |
| AC0.2 | `npx tsc --noEmit; echo $LASTEXITCODE` — cú pháp OK (`echo` là alias PS) | Không cần | — | **PASS** |
| AC0.3 | `npm run test:components` | Rõ (1122) | — | **PASS** |
| AC1.1 | `npx vitest run src/pages/__tests__/ai-cc-single-nav.component.test.tsx` — **đường dẫn hợp lệ**: `src/pages/__tests__/` tồn tại, `vitest.config.ts` `include: ["src/**/*.component.test.{js,ts,tsx}"]` khớp | Rõ | — | **PASS** |
| AC1.2 | "test mới assert" | Rõ | Không có lệnh cụ thể | **AGREE** |
| AC1.3 | `node -e "…"` — **đã chạy nguyên văn**, exit 0, in **rỗng** (không class mồ côi) | Không cần | Không | **PASS** |
| AC1.4 | `git show 6037303c5:… > <file>` — **ĐÃ CHẠY: byte đầu `FF FE` (UTF-16LE BOM), 11 288 byte vs blob gốc 5 512 byte** | Có, nhưng **hỏng** | **Tạo bằng chứng sai**: file hỏng ⇒ test đỏ vì lý do sai (L-V04) | **NEED_FIX** |
| AC1.5 | `npx tsc --noEmit` + `npm run test:components` | — | — | **PASS** |
| AC2.1–2.4 | "test mới" — không có lệnh | AC2.4 có (grep 3 hit — **sai, thật 10**) | Bằng chứng F3 bị thừa nhận sai | **AGREE** (AC2.4 sửa số) |
| AC2.5 | `npx tsc` · `npm run lint` · `npm run test:components` | — | Đòi lint 0 — hợp lệ vì có "(sau S0)" | **PASS** |
| AC3.1 | `grep -c "labelKey" …` — **`grep` KHÔNG TỒN TẠI** trên PS 5.1 (`Get-Command grep` ⇒ null) | "0/5 có labelKey" đúng, **nhưng** | **`≥ 6` đã đúng sẵn hôm nay (đếm = 6: `:5,17,34,41,45,53`) ⇒ AC rỗng, không bao giờ đỏ.** Ngưỡng đúng phải là `≥ 11` | **NEED_FIX** |
| AC3.2 | "test mới" | Rõ | — | **PASS** |
| AC3.3 | "test mới" | Rõ | — | **PASS** |
| AC3.4 | "test mới"; fail-before = "ảnh staging" | **CHƯA CHẠY** (tôi không có staging) | Dựa vào ảnh không kèm trong repo | **AGREE**, fail-before **CHƯA CHẠY** |
| AC3.5 | `node -e "..."` — **placeholder có dấu `...`, không phải lệnh chạy được** | Không | AC không tái tạo được như viết | **NEED_FIX** |
| AC3.6 | `npm run i18n:scan:strict` · tsc · test | — | Khoá mới dạng **lồng** (`provider.openclaw`) lạ với khối `aiCommandCenter` đang **phẳng 100%**; `i18n/index.js:12-16 getNestedValue` có hỗ trợ `.` ⇒ **khả thi**, nhưng plan không nói nest hay flatten | **AGREE** |
| AC4.1 | "test mới" | Rõ | — | **PASS** |
| AC4.2 | `src/pages/__tests__/ai-hub-breadcrumb.component.test.tsx` — **file đã tồn tại** ✓; `AI_ROUTE_LABELS` tại `:59-64` **không có** khoá `ai` ✓ | Rõ | — | **PASS** |
| AC4.3 | `grep -rn "aiCommandCenter.eyebrow" …` — **`grep` KHÔNG TỒN TẠI** | Rõ | Lệnh fail trên máy thực thi | **NEED_FIX** |
| AC4.4 | 3 lệnh gate | — | — | **PASS** |
| AC5.1 | "rule mới" — mô tả hậu quả đúng ("2 nav cùng aria-label") | — | — | **PASS** |
| AC5.2 | `node ./scripts/check-ai-cc.mjs --self-test` — chạy được, **PASS 11/11** | — | Đòi chạy "**cả 2 kiểu — gõ tay và qua hook**", nhưng script **không có** hook/`GIT_*` (grep `hook\|pre-commit\|GIT_DIR` = chỉ 5 hit, đều là comment/self-test) ⇒ **vế hook không kiểm chứng được** | **NEED_FIX** |
| AC5.3 | `node ./scripts/check-ai-cc.mjs` — **exit 0 nhưng KHÔNG in "N/N"** (in `SACH.`) | Rõ | "**11/11** PASS" là con số của `--self-test`, **đã là 11/11 hôm nay** ⇒ lệnh nào cũng không assert được "11/11" cho lần chạy thường | **NEED_FIX** |
| AC5.4 | `node ./scripts/check-uiux-budget.mjs; echo $LASTEXITCODE` — chạy được, **exit 1** | Rõ | Không | **PASS** |

### 3.1 Trùng / mâu thuẫn giữa các AC

| Phát hiện | **Verdict** |
|---|---|
| `AC5.3` yêu cầu `11/11` trong khi `AC5.2` cũng dùng con số `11/11` cho `--self-test` ⇒ **2 AC cùng dùng 1 con số cho 2 thứ khác nhau** | **MÂU THUẪN** |
| `AC2.5` đòi `npm run lint` exit 0 còn `AC0.1` chỉ đòi "không còn dòng error **trong file này**" ⇒ AC2.5 mạnh hơn AC0.1, không mâu thuẫn nhưng **lệch tiêu chuẩn** | **AGREE** (nên thống nhất) |
| `AC1.3` (xoá class `.hubNav*`) vs `AC1.4` case 3 "cả 5 tab route vẫn còn" — `AiHubNav.tsx:117` **vẫn dùng** `styles.hubNav` ⇒ nếu AC1.3 xoá `.hubNav`, `AiHubNav` **hỏng ngay** | **MÂU THUẪN tiềm ẩn** — plan chỉ nói "nếu còn consumer thì phải có testid", chưa nói rõ `.hubNav` **phải giữ** vì `AiHubNav` dùng |

---

## 4. Hazard 6

| Kiểm tra | Kết quả | **Verdict** |
|---|---|---|
| Có AC nào đòi `npm run lint` exit 0 **vô điều kiện**? | `AC2.5` đòi exit 0 nhưng ghi rõ "(sau S0)"; `S0` làm trước mọi thứ và là **error duy nhất** (đã verify = 1) ⇒ hợp lệ theo đúng luật plan tự đặt | **KHÔNG VI PHẠM** |
| Có AC nào đòi `check:tokens` exit 0? | **Không** — không AC nào chạy `check:tokens`; `N1` ghi rõ gate đang đỏ sẵn | **KHÔNG VI PHẠM** |
| Có AC nào đòi `check-uiux-budget` exit 0? | `AC5.4` nói thẳng "**KHÔNG** đòi exit 0" + "kỳ vọng vẫn là 1" | **KHÔNG VI PHẠM** |
| Kết luận hazard 6 | | **Plan TÔN TRỌNG hazard 6 — §3 là phần chắc nhất của plan** |

---

## 5. SCOPE / Non-goals

### 5.1 File trong SCOPE không tồn tại

| Kiểm tra | **Verdict** |
|---|---|
| 9 dòng bảng SCOPE (§0) — mọi file đều tồn tại (`AICommandCenterPage.tsx`, `AICommandCenterForm.tsx`, `providerModels.ts`, `vi.js`, `en.js`, `Breadcrumb.tsx`, `AiHubNav.tsx`, `aiSettings.module.css`, `check-ai-cc.mjs`) | **0 file sai** |

### 5.2 SCOPE lệch với claim (đây mới là vấn đề)

| Kiểm tra | Kết quả | **Verdict** |
|---|---|---|
| Claim `ai-cc-uiux` (`docs/CLAIMS.md:1608`) cột CHỈ ĐỌC liệt kê 8 file, **không có** `Breadcrumb.tsx`, `providerModels.ts`, `scripts/check-ai-cc.mjs` | Plan S3/S4/S5 **sửa 3 file nằm ngoài claim** ⇒ người thực thi sẽ vi phạm L-002/preflight ngay khi commit | **NEED_FIX** — phải cập nhật claim trước phase 2 |
| Claim ghi "**CHƯA CHẠY**: chưa chạy gate nào (gate baseline dành cho phase 2, chưa vào `dev`)" | Nhưng plan §3 trình bày 8 gate **đã đo thật** tại `6037303c5` ⇒ claim và plan **mâu thuẫn nhau** | **NEED_FIX** |
| SCOPE ghi `AiHubNav.tsx` cho S4 "**chỉ nếu** AC4.2 buộc phải" | **Không AC nào trong S4** đụng `AiHubNav.tsx` (AC4.2 sửa `Breadcrumb.tsx`, AC4.3 sửa `AICommandCenterPage.tsx`) | **Scope chết** — nên gỡ |
| SCOPE ghi `AICommandCenterForm.tsx` "S0, S2" nhưng header S2 ghi "**File:** `AICommandCenterPage.tsx`" | Mâu thuẫn nội bộ SCOPE | **LỆCH nhỏ** |
| File plan **cần sửa nhưng không khai SCOPE**: test mới `src/pages/__tests__/ai-cc-single-nav.component.test.tsx` (AC1.1/1.4), và bảng khoá i18n S3 | SCOPE không có dòng "**TAO MOI**: test" | **NEED_FIX** — plan có Non-goal "không thêm scope ngoài danh sách" ⇒ tự mâu thuẫn |

### 5.3 Non-goals N1–N9

| # | Đánh giá | **Verdict** |
|---|---|---|
| N1 | Hợp nhất 3 hệ token — lý do hợp lý (đụng mọi trang dùng `aiSettings.module.css`) | **HỢP LÝ** |
| N2 | Sửa B6 — **phần này vô lý theo nghĩa "đã hỏng"**: kết luận B6 *có thể* đúng nhưng **bằng chứng đã sai** (C5: `--border-strong` có 2 định nghĩa). Bỏ mà không sửa bằng chứng = giữ một claim sai trong tài liệu | **CẦN SỬA BẰNG CHỨNG** — đổi N2 thành "verify `--border-strong` resolve trên `/settings/ai` bằng computed style (có control)" |
| N3 | `HANDOFF_UIUX_REMAINING_20261008.md:218` đã xác minh = `\| 6.6 \| Cỡ 5 rule transition: trong aiSettings.module.css chưa có prefers-reduced-motion \| P2, dễ \|` ⇒ "**P2, để**" | **ĐÚNG** |
| N4 | Focus ring — loại a11y, `improve-ui` §3 loại trừ | **HỢP LÝ** |
| N5 | `main.tsx:195` **không** bọc `StaffRoute` (đã đọc nguyên văn), `:204` **có** bọc ⇒ bất đối xứng thật | **ĐÚNG** |
| N6 | Viết "cần xác minh BE có nhận field này trong PUT (`portfolio_analytics_views.py:1518` liệt kê field được phép)" — `:1518` thật là **vòng `for field in [...]` so sánh before/after để ghi `AIAuditLog`** (đọc `:1516-1529`), **không phải** whitelist field PUT | **SAI** — nhưng plan có ghi "phải đọc xác nhận, không đoán" ⇒ chỉ **citation sai**, thái độ đúng |
| N7 | `AIAuditLogsPanel.tsx:407` = `log.actor \|\| 'system'` ✓; `AIAuditPage.tsx:146` = `<td>{row.action}</td>` ✓ | **ĐÚNG** |
| N8 | Deny-list §2 — đúng | **ĐÚNG** |
| N9 | "Không có `@media max-width` nào trong `aiSettings.module.css`" — đo: **7 khối `@media`, tất cả đều `min-width`, 0 `max-width`** | **ĐÚNG** |

---

## 6. Số đo đã tái tạo được (exit code thật)

| Số | Giá trị plan | **Đo lại** | Lệnh |
|---|---|---|---|
| G2 error count | 1 | **1** | `npm run lint` |
| G2 warning count | 4156 | **4156** | `npm run lint` |
| G2 error location | `AICommandCenterForm.tsx:305` | **305:5** `react-hooks/exhaustive-deps` | `npm run lint` |
| G3 lỗi | `brokerData.css` | **`src\components\brokerData\brokerData.css: #c4b5fd`** (dòng 67) | `npm run check:tokens` |
| G6 số rule | 10 | **10** | `node ./scripts/check-ai-cc.mjs` |
| G6 self-test | (không nêu) | **11/11** | `… --self-test` |
| G7 CSS-1 / CSS-2 / I18N-1 / A11Y-9 / NAV-1 | 4 / 55 / 1 / 8 / 37 | **4 / 55 / 1 / 8 / 37** | `node ./scripts/check-uiux-budget.mjs` |
| G8 file / test / thời gian | 164 / 1122 / 112,58 s | **164 / 1122 / 110,93 s** | `npm run test:components` |
| G4 số tone pair | 7 | **7 × 2 modes** | `npm run check:contrast` |
| `--ai-*` token ở `:root` | 13 | **13** | đếm máy `aiSettings.module.css:55-69` |
| `soc.tokens.css` token | 140 | **140** | đếm máy |
| `labelKey` trong `providerModels.ts` | (AC3.1 ngụ ý 1) | **6** | `Select-String` |
| Hit `advisory_max_auto_refreshes_per_day` | 3 | **10** | script đệ quy + control 17 hit |
| Hit `effective_ai_source` (BE) | 7 | **7** (0 write) | script đệ quy + control ≥5 |
| Nhãn không dấu `vi.js:5449-5463` | 15 | **15/15** | script regex dấu |
| `PROVIDER_OPTIONS` có `labelKey` | 0/5 | **0/5** | đọc file |

---

## 7. Objections đánh số

| # | Objection | Bằng chứng | Mức |
|---|---|---|---|
| **O1** | **`AC1.4` phá hỏng file khi tạo fail-before** — PowerShell 5.1 `>` ghi UTF-16LE | `git show … > f` cho byte đầu `FF FE`, **11 288 byte vs blob 5 512 byte**. Test sẽ đỏ vì lý do sai ⇒ vi phạm L-V04 | **P0** |
| **O2** | **`AC3.1` là AC rỗng — đã đúng trước khi sửa** | `grep -c labelKey` = **6**, threshold `≥ 6`. Ngưỡng đúng: `≥ 11` | **P0** |
| **O3** | **`AC3.1`/`AC4.3` dùng `grep` — không tồn tại trên máy thực thi** | `Get-Command grep` ⇒ `$null` | **P0** |
| **O4** | **Citation overlap sai cả dòng lẫn tiền đề** | `CLAIMS.md:1359` = `paper-copy-a0` (`done`, PR #171), không phải `pf-manage-rebuild`; claim thật ở `:1222-1227`, **dòng mới nhất `:1225`/`:1227` ghi `done (PR #121)`** ⇒ tiền đề "`in-progress`" **bị registry phủ định** | **P1** |
| **O5** | **B6 mô tả sai bằng chứng** | `--border-strong` có **2 định nghĩa** (`soc.tokens.css:11,123`), không phải 0. Kết luận "không resolve" **CHƯA CHẠY** — cần computed style có control (L-V01) | **P1** |
| **O6** | **F3 đếm thiếu 7 hit, bỏ sót trang thứ 2** | Thật **10 hit**, gồm `pages/signals/WhaleAdvisoryPage.tsx:28` + `:548`. Confidence "high — grep toàn repo" là **overstated** | **P1** |
| **O7** | **`AC5.2` đòi chạy self-test "qua hook" — script không có hook** | `check-ai-cc.mjs` grep `hook\|pre-commit\|GIT_DIR` ⇒ chỉ comment + `--self-test` | **P1** |
| **O8** | **`AC5.3` "11/11" không assert được** | Lần chạy thường in `SACH.`, **không** in "N/N"; `11/11` là số của `--self-test` và **đã là 11/11 sẵn** | **P1** |
| **O9** | **`N6`/`AC2.5` mô tả sai `:1518`** | `:1516-1529` là vòng `for field in [...]` diff before/after ghi `AIAuditLog`, **không** phải whitelist field PUT | **P2** |
| **O10** | **Citation `tabOverview`/`tabAudit` lệch dòng** | Đúng là `AiHubNav.tsx:78`/`:109` và `AICommandCenterPage.tsx:234`/`:244`; plan ghi `:234`/`:230` (đảo) và `:110`/`:241` (lệch) | **P2** |
| **O11** | **SCOPE lệch claim + scope chết + thiếu scope** | 3 file SCOPE ngoài claim; `AiHubNav.tsx` cho S4 không AC nào dùng; thiếu dòng "TAO MOI: test" trong khi Non-goal cấm mở rộng scope | **P2** |
| **O12** | **Claim `:1608` nói "CHƯA CHẠY: chưa chạy gate nào"** trong khi plan §3 trình 8 gate đã đo thật | Hai artifact mâu thuẫn | **P2** |
| **O13** | **`AC1.3` vs `AC1.4` mâu thuẫn tiềm ẩn** | Nếu xoá `.hubNav` theo AC1.3 thì `AiHubNav.tsx:117` mất class ⇒ hỏng. Cần phát biểu "`.hubNav` **phải giữ**" | **P2** |
| **O14** | **`AC3.5` viết `node -e "..."`** — placeholder, không phải lệnh | Đọc nguyên văn plan:305 | **P2** |
| **O15** | **`AICommandCenterForm.tsx:83` không chứa `getAICommandCenterConfig`** | `Select-String` trong file ⇒ **0 hit**; chỗ gọi thật `AICommandCenterPage.tsx:33` | **P2** |

---

## 8. Điều KHÔNG verify được

| # | Điều | Lý do | Nhãn |
|---|---|---|---|
| U1 | **Kết luận B6** "`--border-strong`/`--accent-cyan-soft` không bao giờ resolve trên `/settings/ai`" | Cần `getComputedStyle` trong trình duyệt + control biết đáp án. Tôi chỉ grep được 2 định nghĩa trong `soc.tokens.css`, mà `/settings/ai` (`AICommandCenterPage.tsx:8`) chỉ import `aiSettings.module.css`, **không** import `soc.tokens.css` ⇒ nghiêng về "đúng", nhưng token có thể được chunk khác nạp vào global | **CHƯA CHẠY** |
| U2 | **Fail-before của AC3.4** ("ảnh chụp staging cho thấy ô này hiện `gemini`") | Ảnh không nằm trong repo; không vào staging (L-V05: phải mở ảnh xem mới tin) | **CHƯA CHẠY** |
| U3 | **BE test / `CORE_DATABASE_URL`** | Không dựng DB Postgres; không liên quan gate FE nhưng `portfolio_analytics_views.py` chỉ đọc tĩnh | **CHƯA CHẠY** |
| U4 | **`N6`: BE có nhận `advisory_max_auto_refreshes_per_day` trong PUT không** | Chính plan cũng ghi "chưa verify". Tôi chỉ xác nhận `:1518` **không phải** whitelist PUT | **CHƯA CHẠY** |
| U5 | **Hành vi thật trên `/settings/ai`** (2 nav, 2 "Tổng quan" sáng, `gemini` thô) | Không có server; kết luận F1/F2/F3 dựa trên **đọc mã + thông dịch điều kiện** — chưa có ảnh/computed-style | **ƯỚC LƯỢNG** (độ tin cậy cao, chưa phải đo) |
| U6 | **`i18n:scan:strict` có chấp nhận khoá lồng mới không** | Chỉ biết `i18n/index.js:12-16 getNestedValue` hỗ trợ `.`; chưa chạy scanner với khoá mới ⇒ `AC3.6` có rủi ro | **ƯỚC LƯỢNG** |
| U7 | **Gate trên máy khác / sau rebase** | L-G03: kết quả ở đây là của máy auditor, tại HEAD `96cc87e12` | **Giới hạn** |

---

## 9. Đề xuất sửa (nhỏ, không đổi cấu trúc plan)

1. **O1** — thay `git show … > <file>` bằng `cmd /c "git show … > out.txt"` (UTF-8) hoặc `git cat-file blob <sha> | Set-Content -Encoding utf8`, và thêm assert "kích thước file sau khi tạo == `git cat-file -s`" trước khi chạy test.
2. **O2** — đổi ngưỡng `AC3.1` từ `≥ 6` thành `≥ 11`, và thay `grep -c` bằng lệnh có sẵn trên Windows.
3. **O3** — thay `grep -rn/-c` trong AC3.1/AC4.3 bằng `Select-String -Path (Get-ChildItem -Recurse …)` hoặc `git grep -n`.
4. **O4** — sửa `CLAIMS.md:1359` → `:1222-1227`, và **kiểm chứng lại trạng thái thật** của `pf-manage-rebuild` (`:1225`/`:1227` ghi `done (PR #121)`) trước khi giữ cảnh báo overlap.
5. **O5** — đổi B6 thành "2/2 token **không được khai trong `aiSettings.module.css` chain**; `--border-strong` có định nghĩa ở `soc.tokens.css:11,123` nhưng trang không import ⇒ **cần đo computed style có control**".
6. **O6** — sửa "3 hit" thành "10 hit / 4 file", bổ sung `WhaleAdvisoryPage.tsx` vào phạm vi khảo sát.
7. **O7/O8** — `AC5.2` bỏ vế "qua hook" hoặc ghi rõ là backlog; `AC5.3` đổi Then thành "exit 0 **và** `--self-test` exit 0 với ≥ số case hiện có (11)".
8. **O9** — sửa mô tả `:1518` thành "whitelist diff của `AIAuditLog`", giữ nguyên thái độ "chưa verify".
9. **O10/O15** — sửa 4 số dòng nhãn + xoá citation `AICommandCenterForm.tsx:83`.
10. **O11/O12** — cập nhật claim `ai-cc-uiux` (thêm 3 file + dòng "TAO MOI test"), bỏ dòng SCOPE `AiHubNav.tsx`, bỏ "CHƯA CHẠY: chưa chạy gate nào".
11. **O13** — thêm câu vào `AC1.3`: "`.hubNav` **phải giữ** vì `AiHubNav.tsx:117` còn dùng; chỉ xoá class mà **không** còn consumer".
12. **O14** — viết lệnh thật cho `AC3.5`.

---

**Audit bởi**: RealityAudit (auditor độc lập) · **Ngày**: 2026-10-19 · **HEAD**: `96cc87e12` · **branch**: `feat/ai-cc-uiux`
**Bằng chứng**: 9 gate chạy thật có exit code · 3 biến thể `eslint --stdin` · 2 script đếm có control · `git status --short` = CLEAN
**Đối tượng audit**: `docs/PLAN_AI_CC_UIUX_20261018.md` @ `96cc87e12` · **Verdict**: `NEED_REVISION` · **confidence**: `high`
**Cần audit lại**: sau khi sửa 15 objection P0–P2
