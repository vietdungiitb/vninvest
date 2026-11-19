# UI/UX W0 — Token SSOT Implementation Plan (rev4 — AGREE vòng 4)

> **For agentic workers:** thực thi theo skill repo `workflow-dev-loop` (9 bước) + `writing-plans` (task fail-before), từng step checkbox `- [ ]`. Không dùng `superpowers:*` (skill không tồn tại — O-20).

**Goal:** Một tên token semantic chỉ có **1 nơi khai báo trong base layer**; 13 conflict → 0; **không làm `check-theme-contrast` đỏ**; có cơ chế dev-only để chụp ảnh light.

**Architecture:** `theme/tokens.css` = owner semantic + light override. `index.css @theme` = owner `--shadow-*` (Tailwind cần). `soc.tokens.css` chỉ giữ `--soc-*`, `--pf-*`, `--vnb-*`; **5 light override** cũ dời sang `theme/tokens.css:65-82` + `--text-on-accent: #0f172a`; **không** dời `--accent-cyan` (O-24 — giữ base `#06b6d4`) và **không** thêm `--text-muted` vào light block (O-25 fix a — giữ base `#94a3b8`). `.vnbConsole` (`soc.components.css:4341-4352`) là ngoại lệ dark-first có allowlist test. Dev-only light flag bật qua query param có guard build.

**Tech Stack:** CSS custom properties, Tailwind v4 `@theme`, Vitest source-scan có control, `check-theme-contrast.mjs --no-runtime`, Playwright staging.

**Spec:** `docs/AUDIT_UIUX_FULL_20261119.md` · `docs/evidence/uiux-ssot/AUDIT_PLAN_PROGRAM_20261119.md` (O-01..O-05) · `docs/handoffs/HANDOFF_2026-11-19_UIUX-SSOT.md` rev2.

**Base**: `dev@2b10b3016`.

## Global Constraints (Owner D1 rev2 — 8 nhóm delta)

| Token | SOC trước | Owner sau |
|---|---|---|
| `--accent-cyan` | `#22d3ee` | `#06b6d4` — **giữ ở base, KHÔNG thêm override `#0e7490` vào light block** (O-24) |
| `--text-on-accent` (light) | `#ffffff` (base) | `#0f172a` trong `theme/tokens.css` light block — chữ đen trên cyan: **7.35:1** (O-24 fix a, đã tự tính) |
| `--text-muted` (dark) | `#94a3b8` | **giữ `#94a3b8` (KHÔNG hội tụ về `#64748b`, KHÔNG override light)** dưới dạng giá trị trực tiếp; net delta = 0. Đổi `theme/tokens.css:3` từ `var(--color-text-muted, #64748b)` sang `#94a3b8` — sửa fallback không đủ vì `index.css:67` định nghĩa biến (C1/C2 minor, O-25 fix a) |
| `--border-default` | `rgba(80,120,168,.15)` | `#1e293b` |
| `--fs-xs/sm/md` | `0.68/0.75/0.85rem` | `0.75/0.8125/0.875rem` |
| `--bg-panel` | `rgba(8,23,52,.4)` | `#0f172a` |
| `--bg-panel-soft` | `rgba(15,23,42,.3)` | `#0f172a` (sửa bug alias tại `theme/tokens.css:14`) |
| `--shadow-sm/md` | `0 2px 8px/.15` · `0 8px 20px/.2` | `index.css:80-81` Tailwind |
| `--font-sans` | `ui-sans-system…` | `"Inter","Segoe UI"…` |

- Giữ `--pf-gain` xanh / `--pf-loss` đỏ (L-F08). Không nới allowlist `check-tokens.mjs`.
- `.vnbConsole` **không migrate** — đưa vào allowlist test (O-15).
- **O-24 trade-off đã chốt**: gate đo canvas tối `#020617`, app light dùng canvas sáng. `#06b6d4` pass gate (8.31) nhưng chữ trắng chỉ 2.43; `#0e7490` pass app (5.36) nhưng gate 3.77. ⇒ giữ base `#06b6d4`, thêm `--text-on-accent: #0f172a` ở light block (7.35). Không đổi `--pf-gain/--pf-loss` (L-F08 — chỉ đổi màu chữ trên nút).
- **O-25 trade-off (fix a)**: cùng inverse problem cho `--text-muted`. Gate canvas tối: `#475569` 2.66 (tệ hơn baseline), `#94a3b8` 7.87; app canvas sáng: `#475569` 7.24, `#94a3b8` 2.45. Tỉ lệ giữa 2 nền ≈19.2 ⇒ max contrast của 1 màu xám ≈4.38 < 4.5 ⇒ **không có giá trị đơn lẻ pass cả hai**. ⇒ **KHÔNG** khai `--text-muted` trong light block; giữ base `#94a3b8` direct; ghi known limitation (app light dev-only) + mở program riêng sửa gate để include `light-theme.css`. **Không nâng baseline** (R2).
- Không `--update-baseline` trước khi sửa thật (R2). Gate phải **đỏ trước khi sửa, xanh sau**.
- Branch `feat/uiux-ssot-w0` (agent `uiux-ssot-w0`). Claim trước dòng code đầu tiên.
- Light flag: dev/staging-only, revert trước production (D5).

**Lessons áp dụng:** [L-001, L-002, L-003, L-005, L-007, L-008, L-M02, L-A01, L-T01, L-T02, L-F03, L-F05, L-F08, L-F11, L-G02, L-V01, L-V02, L-V04, L-V05]
**Checklist đã tick:** [x] regex tự replicate 0/13 + control false (O-01) · [x] simulate contrast exit 1 + 4 violation (O-02) · [x] đếm 20 khai báo = 13 base + 7 light (O-05) · [x] `.vnbConsole` đọc tay · [x] không đụng deny-list.

## Baseline Exit Codes (replicate hôm nay)

| Gate | Trước | Mục tiêu |
|---|---|---|
| `check-token-conflict` | 13 / root-only 11 | 0 / 0 |
| `check-theme-contrast` | 32 + 12 undecodable; simulate W0 = **exit 1, +4 @soc/dark** | exit 0, **0 vi phạm mới** |
| `check:tokens` | 0 | 0 |
| `check:contrast` / `check-portfolio-contrast` / `check:light-theme` | 0 | 0 |

## Review Focus

1. **Regex** — `\b` trước `-` không tạo boundary; dùng `(?<![-\w])`; strip comment; tách base/light (O-01). Control: `--bg-panel: red;` phải MATCH, `/* --bg-panel: x */` và `--soc-bg-panel:` phải KHÔNG.
2. **Contrast** — `--text-muted` dark `#64748b` cho 3.75/4.24; nâng `#94a3b8`; **validate bằng gate simulation trước khi commit**.
3. **5 light override + 2 khoá cấm** — chuyển 5 key (`--text-primary`, `--text-secondary`, `--border-default`, `--bg-panel`, `--bg-panel-soft`) lên `theme/tokens.css:65-82`, bổ sung `--text-on-accent: #0f172a`; **assert `--accent-cyan` VÀ `--text-muted` KHÔNG được khai trong light block** (O-24/O-25). Test riêng block light.
4. **`.vnbConsole`** — owner thứ 3; test phải allowlist có chủ đích, không coi là vi phạm.
5. **Light flag** — không được đổi behavior production; test assert `data-theme` không set khi không có flag.

---

### Task 1: Test đỏ có control âm/dương

**Files:** Create `packages/web/src/components/soc/__tests__/token-ssot.component.test.ts`

**Interfaces:** Produces `BASE_TOKENS` (13), `LIGHT_KEYS` (5), `FORBIDDEN_LIGHT = ["--accent-cyan", "--text-muted"]`, `stripComments()`, `splitBlocks()`.

- [ ] **Step 1: Viết test**

```ts
const BASE_TOKENS = ["--text-primary","--text-secondary","--text-muted","--accent-cyan",
  "--bg-panel","--bg-panel-soft","--border-default","--font-sans",
  "--fs-xs","--fs-sm","--fs-md","--shadow-sm","--shadow-md"];
const declareRe = (n: string) => new RegExp("(?<![-\\w])" + n + "\\s*:");
const stripComments = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "");
// control
expect(declareRe("--bg-panel").test("--bg-panel: red;")).toBe(true);          // dương
expect(declareRe("--bg-panel").test("/* --bg-panel: red; */")).toBe(false);   // âm (comment)
expect(declareRe("--bg-panel").test("--soc-bg-panel: red;")).toBe(false);    // âm (prefix)
// base block (trước :root[data-theme="light"])
expect(baseBlock.match(declareRe("--bg-panel"))).toBeNull();  // đỏ hôm nay
// light block: 5 key phải có đúng ở theme/tokens.css, KHÔNG ở soc.tokens.css
// O-24: --accent-cyan KHÔNG được khai trong light block (dùng base #06b6d4)
// O-25: --text-muted CŨNG KHÔNG được khai trong light block (giữ base #94a3b8)
//       --text-on-accent: #0f172a phải có trong light block
expect(themeLight).toMatch(/--text-on-accent:\s*#0f172a/);
for (const n of ["--accent-cyan", "--text-muted"]) expect(themeLight).not.toMatch(new RegExp("(?<![-\\w])" + n + "\\s*:"));
// R3: sau Task 2 Step 2, socLight cũng không còn --text-muted
//     (legacy --soc-c-94a3b8: #475569 KHÔNG phải --text-muted, nằm ngoài yêu cầu)
expect(socLight).not.toMatch(/(?<![-\w])--text-muted\s*:/);
```

- [ ] **Step 2:** `npx vitest run …token-ssot…` → **FAIL đúng 13 base + 5 light thiếu + 2 light bị cấm (`--accent-cyan`, `--text-muted`)**, control PASS. Ghi evidence `red.md`. Nếu control âm fail → dừng, sửa test.
- [ ] **Step 3: Commit test đỏ.**

---

### Task 2: Gỡ 13 base + dời 6 light + khoá accent-cyan + sửa contrast

**Files:**
- Modify `packages/web/src/components/soc/soc.tokens.css` (xoá 13 dòng base + 7 dòng light)
- Modify `packages/web/src/theme/tokens.css:3,14,65-82` (muted dark `#94a3b8`, bg-panel-soft alias, bổ sung light key)
- Modify `.vnbConsole` allowlist test trong file test Task 1

**Interfaces:** Consumes `BASE_TOKENS`/`LIGHT_KEYS`. Produces: `check-theme-contrast` exit 0.

- [ ] **Step 1: Simulation đỏ trước khi sửa repo thật** — chạy lại script mô phỏng của audit (temp copy 4 file CSS + baseline, xoá 13 base, `--repo <tmp> --no-runtime`) → exit 1, 4 violation mới. Lưu vào `docs/evidence/uiux-ssot/w0/contrast-red.md`.
- [ ] **Step 2:** Xoá 13 dòng base (comment thay thế), dời **5** light value sang `theme/tokens.css` light block (`--text-primary`, `--text-secondary`, `--border-default`, `--bg-panel`, `--bg-panel-soft`), bổ sung **`--text-on-accent: #0f172a`**. **KHÔNG** dời `--accent-cyan: #0e7490` (O-24) và **KHÔNG** thêm `--text-muted: #475569` (O-25 fix a) — giữ base `#06b6d4` / `#94a3b8`.
- [ ] **Step 3:** Sửa `theme/tokens.css:3` thành `--text-muted: #94a3b8` (**giá trị trực tiếp**, không phải fallback — C1); sửa `theme/tokens.css:14` alias `--bg-panel-soft` trỏ đúng. Không tạo token trùng tên.
- [ ] **Step 4:** Chạy simulation lại: `node packages/web/scripts/check-theme-contrast.mjs --no-runtime` → exit 0, **0 vi phạm mới** (kể cả pair `text-on-accent-on-accent-cyan@soc/light` — chữ đen 7.35) **và 3 cặp `text-muted*@shell/light` không xấu đi** (O-25: 3.75/4.24/3.75 giữ nguyên, không về 2.66/2.66/2.66). Ghi `docs/evidence/uiux-ssot/w0/contrast-green.md` kèm 10 tỉ lệ tự tính bằng script WCAG (C5). Ghi rõ known limitation: app light dev-only có `text-muted` 2.45 — sửa gate riêng, không nâng baseline. Nếu còn đỏ → quay Step 3, **không** update baseline.
- [ ] **Step 5:** Vitest Task 1 → xanh. `check-token-conflict --print-count` → `0`.
- [ ] **Step 6: Commit** — `fix(uiux-w0): single token owner + WCAG-safe muted + light migration`.

---

### Task 3: Hạ baseline về 0 + negative proof

**Files:** `packages/web/scripts/check-ui-baseline/check-token-conflict{,.root-only}.json`

- [ ] **Step 1:** Chỉ sau Task 2 Step 5 = 0: `--update-baseline` cho 2 scope.
- [ ] **Step 2:** Assert `violations.length === 0` bằng node.
- [ ] **Step 3:** Inject `--text-primary: #e2e8f0;` vào bản sao `soc.tokens.css`, chạy gate với `--repo <tmp>` → exit 1 + chữ `--text-primary`. Ghi `gate-negative.md`.
- [ ] **Step 4: Commit.**

---

### Task 4: Dev-only light flag + ảnh staging

**Files:** Modify `packages/web/src/main.tsx:261-270`, `packages/web/src/pages/UserSettingsPage.tsx:18-24`; Create `packages/web/src/lib/devThemeFlag.ts`; Create `docs/evidence/uiux-ssot/w0/visual.md`.

- [ ] **Step 1:** Test đỏ: flag chỉ active khi build staging (`import.meta.env.MODE === 'staging'` hoặc `VITE_DEV_THEME_FLAG=1`) **và** query `?theme=light`; production assert `document.documentElement` không có `data-theme`.
- [ ] **Step 2:** Implement helper `devThemeFlag.ts`, gọi trong `main.tsx` trước first paint. **Thứ tự ưu tiên (C3)**: (1) `devThemeFlag` set `data-theme="light"` chỉ khi build staging + `?theme=light`; (2) `applyUserTheme()` ở `UserSettingsPage.tsx:19-24` phải **early-return khi `devThemeFlag.active`**, không được force dark ghi đè; (3) khi không có flag, `applyUserTheme()` giữ nguyên behavior dark mặc định. Test assert cả 3 nhánh.
- [ ] **Step 3:** Deploy staging `bash scripts/deploy-staging.sh`; chụp 4 route × 2 theme = 8 ảnh 1440×900; ghi computed border/accent/fs + verdict D1.
- [ ] **Step 4:** Ghi rõ "revert flag trước production" trong `visual.md` và PR body.
- [ ] **Step 5: Commit** — `feat(uiux-w0): staging-only light flag for visual QA`.

---

### Task 5: B7/B8/B9

- [ ] `pwsh -File scripts/agent-sync.ps1` → token-conflict 0 · theme-contrast 0 mới · check:tokens/contrast/portfolio/light/dom → 0 · `npx tsc --noEmit` · `npm run build` (VPS).
- [ ] Auditor độc lập `docs/evidence/uiux-ssot/w0/REAUDIT.md` → 0 blocker/0 major.
- [ ] Claim done → Entry ledger → PR → cleanup.

## Rollback

Revert từng commit Task 2–4. Không `git checkout --` (L-A01); dùng `git show HEAD:<f> > <f>` qua `cmd /c`. Nếu contrast vẫn đỏ → giữ đỏ, báo blocker, **không** nâng baseline.
