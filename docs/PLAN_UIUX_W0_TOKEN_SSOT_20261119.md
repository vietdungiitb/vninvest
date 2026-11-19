# UI/UX W0 — Token SSOT Implementation Plan (rev6 — O-27/O-28, chờ audit vòng 6)

> **For agentic workers:** thực thi theo skill repo `workflow-dev-loop` (9 bước) + `writing-plans` (task fail-before), từng step checkbox `- [ ]`. Không dùng `superpowers:*` (skill không tồn tại — O-20).

**Goal:** Một tên token semantic chỉ có **1 nơi khai báo trong base layer**; 13 conflict → 0; **không làm `check-theme-contrast` đỏ**; có cơ chế dev-only để chụp ảnh light.

**Architecture:** `theme/tokens.css` = owner semantic + light override. `index.css @theme` = owner `--shadow-*` (Tailwind cần). `soc.tokens.css` chỉ giữ `--soc-*`, `--pf-*`, `--vnb-*`; **6 light override** cũ dời sang `theme/tokens.css:65-82` + `--text-on-accent: #0f172a`; **không** dời `--accent-cyan` (O-24 — giữ base `#06b6d4`). **O-26 rev5**: `--text-muted: #475569` được thêm vào light block **sau khi** sửa gate để dùng chữ light + nền light. `.vnbConsole` (`soc.components.css:4341-4352`) là ngoại lệ dark-first có allowlist test. Dev-only light flag bật qua query param có guard build.

**Tech Stack:** CSS custom properties, Tailwind v4 `@theme`, Vitest source-scan có control, `check-theme-contrast.mjs --no-runtime`, Playwright staging.

**Spec:** `docs/AUDIT_UIUX_FULL_20261119.md` · `docs/evidence/uiux-ssot/AUDIT_PLAN_PROGRAM_20261119.md` (O-01..O-05) · `docs/handoffs/HANDOFF_2026-11-19_UIUX-SSOT.md` rev2.

**Base**: `dev@2b10b3016`.

## Global Constraints (Owner D1 rev2 — 8 nhóm delta)

| Token | SOC trước | Owner sau |
|---|---|---|
| `--accent-cyan` | `#22d3ee` | `#06b6d4` — **giữ ở base, KHÔNG thêm override `#0e7490` vào light block** (O-24) |
| `--text-on-accent` (light) | `#ffffff` (base) | `#0f172a` trong `theme/tokens.css` light block — chữ đen trên cyan: **7.35:1** (O-24 fix a, đã tự tính) |
| `--text-muted` (dark) | `#94a3b8` | **giữ `#94a3b8` (KHÔNG hội tụ về `#64748b`)** dưới dạng giá trị trực tiếp; net delta = 0. Đổi `theme/tokens.css:3` từ `var(--color-text-muted, #64748b)` sang `#94a3b8` (C1/C2). Light block dùng `#475569` riêng (O-26/O-28) |
| `--border-default` | `rgba(80,120,168,.15)` | `#1e293b` |
| `--fs-xs/sm/md` | `0.68/0.75/0.85rem` | `0.75/0.8125/0.875rem` |
| `--bg-panel` | `rgba(8,23,52,.4)` | `#0f172a` |
| `--bg-panel-soft` | `rgba(15,23,42,.3)` | `#0f172a` (sửa bug alias tại `theme/tokens.css:14`) |
| `--shadow-sm/md` | `0 2px 8px/.15` · `0 8px 20px/.2` | `index.css:80-81` Tailwind |
| `--font-sans` | `ui-sans-system…` | `"Inter","Segoe UI"…` |

- Giữ `--pf-gain` xanh / `--pf-loss` đỏ (L-F08). Không nới allowlist `check-tokens.mjs`.
- `.vnbConsole` **không migrate** — đưa vào allowlist test (O-15).
- **O-24 trade-off đã chốt**: gate đo canvas tối `#020617`, app light dùng canvas sáng. `#06b6d4` pass gate (8.31) nhưng chữ trắng chỉ 2.43; `#0e7490` pass app (5.36) nhưng gate 3.77. ⇒ giữ base `#06b6d4`, thêm `--text-on-accent: #0f172a` ở light block (7.35). Không đổi `--pf-gain/--pf-loss` (L-F08 — chỉ đổi màu chữ trên nút).
- **O-25 trade-off → bị O-26 bác một phần**: fix (a) ban đầu (không khai `--text-muted` light) khi áp đủ O-05 (xoá `--bg-panel` base) sinh 2 ID mới `text-muted-on-bg-panel-token@shell/light|soc/light` = 2.56:1, shell/light **xấu đi từ baseline 3.75** (`docs/evidence/uiux-ssot/w0/BLOCKER_O26.md`). Owner rev5 chốt **sửa gate đúng gốc**: light variant dùng **cả nền sáng lẫn chữ light** từ `light-theme.css`; thêm `--text-muted: #475569` vào light block. Kết quả mong đợi: dark `#94a3b8` trên `#0f172a` = 6.96 ✅, light `#475569` trên `#f8fafc` = 7.24 ✅. **Không nâng baseline, không báo PASS giả** (R2). Cần audit vòng 5 trước khi đụng gate.
- **O-28 (audit v5) — Owner rev6 chốt**: đổi mapping light `--color-accent-primary` `#0891b2→#0e7490` qua `check-light-theme.mjs --update`; accent trên nền sáng 5.12 ✅, **chữ trắng** trên accent 5.36 ✅ ⇒ bỏ override `--text-on-accent: #0f172a` của O-24. Task 2b phải full simulation (`fresh/worse/undecodable = 0`) + negative proof bao phủ 4 ID. Audit vòng 6 trước khi sửa gate.
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
3. **6 light override + 1 khoá cấm (rev5)** — chuyển 6 key (`--text-primary`, `--text-secondary`, `--border-default`, `--bg-panel`, `--bg-panel-soft`, `--text-muted: #475569`) lên `theme/tokens.css:65-82`, bổ sung `--text-on-accent: #0f172a`; **chỉ `--accent-cyan` bị cấm ở light block** (O-24). Test riêng block light.
4. **`.vnbConsole`** — owner thứ 3; test phải allowlist có chủ đích, không coi là vi phạm.
5. **Light flag** — không được đổi behavior production; test assert `data-theme` không set khi không có flag.

---

### Task 1: Test đỏ có control âm/dương

**Files:** Create `packages/web/src/components/soc/__tests__/token-ssot.component.test.ts`

**Interfaces:** Produces `BASE_TOKENS` (13), `LIGHT_KEYS` (6, gồm `--text-muted`), `FORBIDDEN_LIGHT = ["--accent-cyan"]`, `stripComments()`, `splitBlocks()`.

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
// rev6/O-27: 6 key có ở theme/tokens.css light, gồm --text-muted: #475569
expect(themeLight).toMatch(/--text-muted:\s*#475569/);
// O-24: --accent-cyan KHÔNG được khai ở light block (giữ base)
for (const n of FORBIDDEN_LIGHT) expect(themeLight).not.toMatch(new RegExp("(?<![-\\w])" + n + "\\s*:"));
// O-28: accent light = #0e7490 ⇒ chữ TRẮNG 5.36 ✅; chữ đen 3.33 ❌ ⇒ bỏ override đen
expect(themeLight).not.toMatch(/--text-on-accent:\s*#0f172a/);
// R3: SOC light không còn --accent-cyan lẫn --text-muted
for (const n of ["--accent-cyan", "--text-muted"]) expect(socLight).not.toMatch(new RegExp("(?<![-\\w])" + n + "\\s*:"));
```

- [ ] **Step 2:** `npx vitest run …token-ssot…` → **FAIL đúng 13 base + 6 light thiếu (gồm `--text-muted`) + 1 light bị cấm (`--accent-cyan`)**, control PASS. Ghi evidence `red.md`. Nếu control âm fail → dừng, sửa test. ⚠ Khi code partial rev4 đang có assert cấm `--text-muted` ở theme light, test sẽ đỏ sai chỗ — phải sửa test theo rev6 **trước** chạy (O-27).
- [ ] **Step 3: Commit test đỏ.**

---

### Task 2: Gỡ 13 base + dời 6 light + khoá accent-cyan + sửa contrast (rev5)

**Files:**
- Modify `packages/web/src/components/soc/soc.tokens.css` (xoá 13 dòng base + 7 dòng light)
- Modify `packages/web/src/theme/tokens.css:3,14,65-82` (muted dark `#94a3b8`, bg-panel-soft alias, bổ sung light key)
- Modify file test Task 1 theo rev6 (O-27): `LIGHT_KEYS` 5→6, bỏ `--text-muted` khỏi `FORBIDDEN_LIGHT`, bỏ assert cấm ở `theme.light`, thêm assert `--text-muted: #475569` + assert không có `--text-on-accent: #0f172a`; giữ assert `socLight` vắng cả 2 tên.
- Modify `.vnbConsole` allowlist test trong file test Task 1

**Interfaces:** Consumes `BASE_TOKENS`/`LIGHT_KEYS`. Produces: `check-theme-contrast` exit 0.

- [ ] **Step 1: Simulation đỏ trước khi sửa repo thật** — chạy lại script mô phỏng của audit (temp copy 4 file CSS + baseline, xoá 13 base, `--repo <tmp> --no-runtime`) → exit 1, 4 violation mới. Lưu vào `docs/evidence/uiux-ssot/w0/contrast-red.md`.
- [ ] **Step 2:** Xoá 13 dòng base (comment thay thế), dời **6** light value sang `theme/tokens.css` light block (`--text-primary`, `--text-secondary`, `--border-default`, `--bg-panel`, `--bg-panel-soft`, **`--text-muted: #475569`**). **O-28**: KHÔNG thêm `--text-on-accent: #0f172a` (chữ trắng giữ nguyên — accent light `#0e7490` cho white 5.36 ✅); **KHÔNG** dời `--accent-cyan: #0e7490` vào light block (O-24) — map light nằm ở `light-theme.css`.
- [ ] **Step 3:** Sửa `theme/tokens.css:3` thành `--text-muted: #94a3b8` (**giá trị trực tiếp**, không phải fallback — C1); sửa `theme/tokens.css:14` alias `--bg-panel-soft` trỏ đúng. Không tạo token trùng tên.
- [ ] **Step 4:** Sau Task 2b, chạy `node packages/web/scripts/check-theme-contrast.mjs --no-runtime` → exit 0, **fresh=0 · worse=0 · undecodable mới=0**. Tỉ lệ kỳ vọng (tự tính C5): dark muted `#94a3b8/#0f172a` 6.96 ✅ · light muted `#475569/#f8fafc` 7.24 ✅ · accent light `#0e7490/#f8fafc` 5.12 ✅ · chữ trắng trên accent `#ffffff/#0e7490` 5.36 ✅. Ghi `contrast-green.md` kèm **toàn bộ** ID đổi (không chỉ 2 cặp). Nếu còn đỏ → dừng, **không** update baseline.

### Task 2b (rev5): Sửa `check-theme-contrast.mjs` dùng chữ light + nền light

- **Files:** Modify `packages/web/scripts/check-theme-contrast.mjs`; Modify `packages/web/scripts/check-light-theme.mjs` (mapping `--color-accent-primary` light `#0891b2 → #0e7490`) rồi chạy `--update` — **KHÔNG sửa tay `theme/light-theme.css`** (file autogenerated); Test self-test của gate.
- **Yêu cầu:** variant `*/light` resolve **cả fg lẫn bg** từ `theme/tokens.css` light + `light-theme.css`; không ghép chữ base vào nền light. Giữ nguyên variant dark.
- **Negative proof (mở rộng O-28):** inject hành vi cũ → gate đúng **cả 4** ID: `text-muted-on-bg-panel*@*/light` VÀ `accent-cyan-on-bg-primary@*/light`; khôi phục → xanh. Ghi `gate-negative-light.md`.
- **Full simulation:** assert `fresh=0` · `worse=0` · `newUndecodable=0` · `lostToUndecodable=0` (`mjs:848-871`) và list **toàn bộ** ID đổi vào evidence.
- **Không** đổi baseline JSON, **không** đổi hợp đồng `exit 0 = subset baseline`. **Audit vòng 6** phải AGREE trước khi sửa gate.
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
