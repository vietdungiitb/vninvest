# Khung chuẩn hóa Theme Template — Audit UI & Kế hoạch thực hiện chi tiết

> **Mục đích:** Audit toàn bộ giao diện, xác định phân mảnh styling, và xây dựng kế hoạch
> thực hiện slice-by-slice với tiêu chí đánh giá rõ ràng để đội code thực hiện không cần hỏi lại.
> **Trạng thái:** Tài liệu đã audit + verified — chờ phê duyệt để bắt đầu Pha 0.

---

## 1. Hiện trạng: 5 hệ thống styling song song — trạng thái hiện tại là BROKEN

Quét **197 file** có tín hiệu styling, phát hiện **5 cơ chế song song** với **4 namespace token không khớp nhau**.

### 1.0 Kết luận runtime (đã xác minh bằng grep source)

> **`frontend/src/index.css` KHÔNG được import vào `packages/web`.** Grep source cho thấy
> chỉ có comment trong `soc.js`, không có import CSS. Do đó các bare-name token
> (`--text-primary`, `--text-muted`, `--text-secondary`, `--bg-panel`, `--bg-panel-soft`,
> `--border-default`, `--accent-cyan`) **undefined trong SaaS app hiện tại**.
>
> → **Trạng thái hiện tại là BROKEN: border transparent, panel trong suốt, text sai màu đang xảy ra ở production.**
> → **Câu hỏi "Q1: frontend có load không?" đã có đáp án: KHÔNG. Bridge theo Tailwind values là đúng hướng.**

### 1.1 Năm hệ thống styling

| # | Hệ thống | Token namespace | Định nghĩa | Quy mô |
|---|----------|----------------|-----------|--------|
| 1 | **Tailwind `@theme`** (`packages/web/src/index.css`) | `--color-text-primary`, `--color-bg-panel`, `--color-accent-primary` | Global, de-facto palette | 363 dòng `@theme` |
| 2 | **SOC module** (`soc.module.css` + `aiSettings.module.css`) | `--text-primary`, `--accent-cyan`, `--border-default`, `--bg-panel-soft` | **KHÔNG define global nào** → undefined | soc 942 dòng, ai 727 dòng |
| 3 | **Shell template** (`ShellPageTemplate.js` – CSS string) | `--shell-ink`, `--shell-accent`, `--shell-border` | Inject global, BEM `shellPage__*` | 556 dòng |
| 4 | **Per-page CSS** (tự định nghĩa class) | ad-hoc | File `.css` / `.module.css` / `.styles.js` riêng từng trang | **~130 KB** (xem §2) |
| 5 | **Inline `style={{}}`** | — | Rải rác trong code | **568 occurrences / 22 files**, densest ở TenantAdmin & SOC |

### 1.2 Phát hiện then chốt

#### A. Token namespace conflict — 3 giá trị "text-primary" khác nhau

| Namespace | Variable | Giá trị | Scope |
|---|---|---|---|
| Tailwind `@theme` | `--color-text-primary` | `#f1f5f9` | Global `:root` (via Tailwind) |
| Legacy `:root` | `--text-primary` | `#e6f3ff` | Global `:root` (legacy frontend/) |
| Shell scoped | `--shell-ink` | `#f1f5f9` | `.shellPage` class only |

→ **Ba biến cho cùng một khái niệm. Hai biến cùng giá trị (#f1f5f9), một biến khác (#e6f3ff). Không thể đổi theme ở 1 chỗ.**

#### B. Trạng thái hiện tại là BROKEN — bare-name token pandemic

**Tất cả bare-name tokens đều undefined trong SaaS app** vì `frontend/src/index.css` không load. Hệ quả:

**Trong `soc.module.css` (942 dòng):**
- 0 block `:root` định nghĩa token nào
- 3 lines dùng `var(--text-muted)` **không fallback** (lines 473, 480, 530)
- → SOC cũng đang break, không phải "an toàn vì có fallback"

**Toàn codebase — bare-name references không fallback:**

| Token | Bare (no fallback) | Có fallback | Tỷ lệ break |
|-------|-------------------|-------------|-------------|
| `--text-muted` | **217** | 30 | **87.8%** |
| `--text-secondary` | **25** | 1 | **96.2%** |
| `--bg-panel` | **10** | 0 | **100%** |
| `--text-primary` | (đã fix ở S0 trước) | — | — |
| `--accent-cyan` | (đã fix ở S0 trước) | — | — |
| `--border-default` | (đã fix ở S0 trước) | — | — |
| `--bg-panel-soft` | (đã fix ở S0 trước) | — | — |

**Tổng: 252 bare-name references không fallback across CSS/TSX → silent color loss ở production.**

**Impact cụ thể:**
- `ScreenerPage.tsx` lines 41/45/80: `--bg-panel`, `--text-muted`, `--text-secondary` → undefined
- `soc.module.css` lines 473/480/530: `--text-muted` → undefined
- `VninvestInput.module.css`: 9 references không fallback → input component mất styling
- `WatchlistPage.css`: 34 references không fallback → watchlist mất styling

#### C. Shell token scope lớn hơn ShellPageTemplate

18 files beyond ShellPageTemplate.js consume `--shell-*` tokens. **Chỉ 3 files có fallback** (ShellSkeleton.tsx, ShellOperationsCenterPage.tsx, pageRegistry.js). 15 files dùng bare `var(--shell-*)` không fallback.

Các files **không phải ShellPageTemplate** dùng `--shell-*`:
- `Breadcrumb.tsx` — `--shell-muted`, `--shell-accent`, `--shell-border` (không fallback)
- `ShellEmptyState.tsx` — `--shell-muted`, `--shell-ink` (không fallback)
- `TenantAdminLayout.tsx` — `--shell-border`, `--shell-surface`, `--shell-muted` (không fallback)
- `TenantAdminSidebar.tsx` — `--shell-surface`, `--shell-border`, `--shell-accent`, `--shell-muted`, `--shell-ink` (không fallback)
- `ShellMailConfigPage.tsx` — `--shell-muted` (không fallback)
- `BillingCenterPage.tsx` — `--shell-border`, `--shell-accent`, `--shell-ink`, `--shell-muted`, `--shell-signal` (không fallback)
- `PaymentReturnPage.tsx` — `--shell-ink`, `--shell-muted`, `--shell-border` (không fallback)
- `TenantAdminCapabilitiesPage.tsx` — 5 tokens (không fallback)
- `TenantAdminHomePage.tsx` — 4 tokens (không fallback)
- `TenantAdminMembersPage.tsx` — 3 tokens (không fallback)
- `TenantAdminPATsPage.tsx` — 3 tokens (không fallback)
- `TenantAdminUsagePage.tsx` — 4 tokens (không fallback)
- `TenantAdminUsageHistoryPage.tsx` — 3 tokens (không fallback)
- `TenantAdminSecurityPage.tsx` — 3 tokens (không fallback)
- `TenantAdminWebhooksPage.tsx` — 3 tokens (không fallback)

#### D. AlertCenterPage trùng lặp — .module.css là DEAD CODE

- `AlertCenterPage.tsx` line 7: `import { CORE_STYLES } from "./AlertCenterPage.styles.js"` — **ACTIVE**
- `AlertCenterPage.module.css` — **KHÔNG được import ở đâu** → dead code
- → S6 chỉ cần xóa `.module.css` (trivial), không phải "dedup 2 file CSS giống hệt"

#### E. TenantAdmin pages — density cao nhất, bị bỏ qua

| File | Inline style count |
|---|---|
| `TenantAdminPATsPage.tsx` | 90 |
| `TenantAdminUsagePage.tsx` | 84 |
| `TenantAdminWebhooksPage.tsx` | 58 |
| `TenantAdminHomePage.tsx` | 58 |
| `TenantAdminBillingPage.tsx` | 44 |
| `TenantAdminMembersPage.tsx` | 43 |

→ **~377 inline styles集中在 6 files TenantAdmin**, không nằm trong lộ trình Pha 0-5 gốc.

#### F. Phân bố styling (mỗi file)

```
95   inline
30   SOC-module + local-module + inline
17   shellPage
14   core-global
10   shellPage + core-global
 5   AI-module + local-module
 4   core-global + inline
 4   shellPage + inline
 4   sdp-global + inline
 3   SOC-module
 2   AI-module + local-module + inline
 2   SOC-module + inline
 2   sdp-global
 1   SOC-module + local-module
 1   local-module
 1   AI-module + shellPage + local-module + inline
 1   styles.js + core-global + inline
 1   shellPage + core-global + inline
```

---

## 2. Per-page CSS — chi tiết cần thay thế

| File | Lines | KB | Class prefix | Fallback status |
|------|-------|----|-------------|-----------------|
| `pages/StockDetailPage.css` | 2,175 | 44.2 | `sdp-` (268 class defs) | — |
| `pages/AlertCenterPage.styles.js` | 1,053 | 27.9 | `core-` (126 defs) | **ACTIVE import** |
| `pages/AlertCenterPage.module.css` | 1,023 | 27.2 | `core-` (126 defs) | **DEAD CODE** |
| `pages/WatchlistPage.css` | 422 | 8.8 | `watchlistPage__*` BEM | **34 var() KHÔNG fallback** |
| `pages/PortfoliosPage.css` | 330 | 6.0 | `core-portfolios-page` | — |
| `features/dashboard/AIAdvisorAlertPanel.css` | 257 | 5.4 | `ai-advisor-panel-*` | — |
| `components/DNSEConnectionPanel.css` | 280 | 5.0 | `dnse-panel__*` | — |
| `components/alert-center/*` (2 file) | — | 6.0 | — | — |
| `components/dashboard/SmartStatsHeader.css` | 86 | 1.7 | — | — |
| `components/ui/VninvestInput.module.css` | 110 | 2.3 | — | **9 var() KHÔNG fallback** |
| `pages/auth/AuthRegisterPage.css` | 8 | 0.1 | — | — |

**Global `core-`**: 161 occurrences trong CSS, 135 occurrences trong JS/TS — tập trung ở AlertCenter (126), Portfolios (30), UserSettings (12).
**`sdp-`**: 268 class defs trong StockDetailPage.css, total ~351 references across stock-detail files.

---

## 3. Nguyên tắc khung

1. **Một nguồn token duy nhất** — `:root` token-bridge alias 3 namespace về 1 giá trị. SOC module giữ nguyên `var(--x, fallback)`, fallback căn lại khớp `@theme` → zero rename.
2. **Theme module chỉ chứa true primitives** — button, card, input, modal, badge, alert, tabs, skeleton, emptyState, statusDot. **KHÔNG gộp SOC domain module** (socPanel, socHeader, socMetric... là SOC-specific, không reuse).
3. **SOC module giữ riêng**, chỉ import token từ `theme/tokens.css`. SOC module là domain styling, không phải design system.
4. **Page chrome bắt buộc** — mọi trang đi qua `ShellPageTemplate` (chuyển `--shell-*` → token chung, CSS string → CSS Modules).
5. **Per-page CSS chấp nhận được** nếu scoped qua CSS Modules + dùng bridged tokens. Vấn đề là "unbridged tokens", không phải "per-page file exists".
6. **Inline style chỉ cho giá trị động** (tính từ props/state) — static styling chuyển hết vào module class.
7. **CSS Modules (scoped) + `var(--token, fb)`**, không dùng global class string (`core-`, `sdp-`, `shellPage__*`).

---

## 4. Kiến trúc mục tiêu

```
packages/web/src/
  index.css                      # @theme (palette) + :root token-bridge (alias legacy → Tailwind)
  theme/
    tokens.css                   # :root { --text-primary: var(--color-text-primary); ... }
    theme.module.css             # shared primitives (button, card, input, modal, badge, ...)
    ShellPageTemplate.module.css # CSS Modules thay CSS string
    ShellPageTemplate.js         # refactor: import className từ module
  components/
    soc/
      soc.module.css             # GIỮ NGUYÊN — SOC domain module, import tokens.css
      aiSettings.module.css      # GIỮ NGUYÊN — AI domain module
    ...                          # các component khác
  pages/
    *.tsx                        # import từ theme/ + component-level modules
    *.module.css                 # per-page scoped CSS ĐƯỢC CHO PHÉP nếu dùng bridged tokens
```

### Token-bridge (Phase 0 — chìa khóa)

```css
/* packages/web/src/theme/tokens.css */
:root {
  /* === Text === */
  --text-primary:   var(--color-text-primary,    #f1f5f9);
  --text-muted:     var(--color-text-secondary,  #94a3b8);
  --text-secondary: var(--color-text-secondary,  #94a3b8);

  /* === Accent === */
  --accent-cyan:    var(--color-accent-primary,   #06b6d4);
  --accent-emerald: var(--color-success-500,      #10b981);
  --accent-rose:    var(--color-danger-500,        #ef4444);
  --accent-amber:   var(--color-warning-500,       #f59e0b);

  /* === Surface === */
  --bg-panel:       var(--color-bg-panel,         #0f172a);
  --bg-panel-soft:  var(--color-bg-panel,         #0f172a);
  --border-default: var(--color-border-primary,   #1e293b);
  --shadow-panel:   var(--shadow-lg, 0 10px 15px rgb(0 0 0 / 0.1));
}
```

→ `soc.module.css`, `aiSettings.module.css`, `VninvestInput.module.css`, `WatchlistPage.css`, ScreenerPage, SOC TSX files — tất cả tự nhiên sống bằng token global.
→ Đổi theme/thương hiệu chỉ ở 1 chỗ (`@theme` trong `index.css`).

---

## 5. Lộ trình chi tiết theo Slice

### Tổng quan

| Slice | Phạm vi | Files | Effort | Rủi ro | Pre-requisite |
|-------|---------|-------|--------|--------|---------------|
| **S0** | Audit + fix ALL bare-name var() references | ~20 | M | Thấp | — |
| **S1** | Token-bridge + tokens.css | 3 | S | Thấp | S0 |
| **S2** | Theme primitives module | 2 | M | Thấp | S1 |
| **S3** | ShellPageTemplate refactor + all --shell-* consumers | ~22 | L | Cao | S1 |
| **S4** | AI area cleanup | 8 | S | Thấp | S2 |
| **S5** | SOC inline → module class | ~35 | L | TB | S2 |
| **S6** | AlertCenter dead code cleanup | 2 | S | Thấp | — |
| **S7** | Stock-detail standardization | ~8 | XL | Cao | S2, S3 |
| **S8** | Core pages (Dashboard, Transactions, UserSettings, Portfolios, WhaleAlerts) | ~14 | XL | Cao | S2, S3 |
| **S9** | TenantAdmin inline cleanup | ~8 | L | TB | S2 |
| **S10** | Watchlist + remaining pages | ~6 | M | TB | S2, S3 |

---

### Slice S0: Audit & Fix ALL Bare-Name var() References

> **KHẨN CẤP:** Đây không phải "optional pre-work". Trạng thái hiện tại là BROKEN —
> 252 bare-name references không fallback đang gây silent color loss ở production.

**Mục tiêu:** Đảm bảo MỌI `var(--token)` reference đều có fallback hợp lệ trước khi triển khai token-bridge.

**Scope tokens cần fix (7+ tokens):**

| Token | Bare refs | Có fallback | Files affected |
|-------|-----------|-------------|----------------|
| `--text-primary` | (verify) | (verify) | VninvestInput, Watchlist, SOC TSX |
| `--text-muted` | **217** | 30 | soc.module.css:473/480/530, SocDataOpsMonitor:30, AlertCenter:26, Screener:4, VninvestInput:2, + 25 files |
| `--text-secondary` | **25** | 1 | SocScreenerRuleModal:6, ScreenerHistory:4, WatchlistPage:4, ScreenerPage:2, + 5 files |
| `--bg-panel` | **10** | 0 | ScreenerPage:3, ScreenerHistory:2, ScreenerResults:1, ScreenerTemplates:1, SocScreenerRuleModal:1, VninvestInput:1, WatchlistPage:1 |
| `--bg-panel-soft` | (verify) | (verify) | VninvestInput, WatchlistPage, SOC TSX |
| `--border-default` | (verify) | (verify) | VninvestInput, WatchlistPage, SOC TSX |
| `--accent-cyan` | (verify) | (verify) | VninvestInput, WatchlistPage, SOC TSX |

**Hành động:**
1. Chạy grep tìm tất cả bare-name var() references (không có fallback) cho MỌI token trong danh sách trên
2. Với mỗi occurrence KHÔNG có fallback → thêm fallback giá trị Tailwind:
   - `--text-primary` → `#f1f5f9`
   - `--text-muted` → `#94a3b8`
   - `--text-secondary` → `#94a3b8`
   - `--bg-panel` → `#0f172a`
   - `--bg-panel-soft` → `#0f172a`
   - `--border-default` → `#1e293b`
   - `--accent-cyan` → `#06b6d4`
3. Với SOC module, verify fallback values hiện tại khớp @theme values. Nếu khác → sửa fallback cho khớp.

**Kết quả đầu ra (deliverables):**
- [ ] File `docs/S0_FALLBACK_AUDIT.md` — full grep results before/after, mỗi token một section
- [ ] Patch tất cả files thiếu fallback

**Tiêu chí đánh giá (acceptance criteria):**

```bash
# AC-S0.1: Không còn bare-name var(--text-primary) không fallback
grep -rn "var(--text-primary)[^,]" packages/web/src/ --include="*.css" --include="*.tsx" \
  | grep -v "var(--text-primary," | wc -l
# Kết quả mong đợi: 0

# AC-S0.2: Không còn bare-name var(--text-muted) không fallback
grep -rn "var(--text-muted)[^,]" packages/web/src/ --include="*.css" --include="*.tsx" \
  | grep -v "var(--text-muted," | wc -l
# Kết quả mong đợi: 0

# AC-S0.3: Không còn bare-name var(--text-secondary) không fallback
grep -rn "var(--text-secondary)[^,]" packages/web/src/ --include="*.css" --include="*.tsx" \
  | grep -v "var(--text-secondary," | wc -l
# Kết quả mong đợi: 0

# AC-S0.4: Không còn bare-name var(--bg-panel) không fallback
grep -rn "var(--bg-panel)[^,]" packages/web/src/ --include="*.css" --include="*.tsx" \
  | grep -v "var(--bg-panel," | wc -l
# Kết quả mong đợi: 0

# AC-S0.5: Không còn bare-name var(--bg-panel-soft) không fallback
grep -rn "var(--bg-panel-soft)[^,]" packages/web/src/ --include="*.css" --include="*.tsx" \
  | grep -v "var(--bg-panel-soft," | wc -l
# Kết quả mong đợi: 0

# AC-S0.6: Không còn bare-name var(--border-default) không fallback
grep -rn "var(--border-default)[^,]" packages/web/src/ --include="*.css" --include="*.tsx" \
  | grep -v "var(--border-default," | wc -l
# Kết quả mong đợi: 0

# AC-S0.7: Không còn bare-name var(--accent-cyan) không fallback
grep -rn "var(--accent-cyan)[^,]" packages/web/src/ --include="*.css" --include="*.tsx" \
  | grep -v "var(--accent-cyan," | wc -l
# Kết quả mong đợi: 0

# AC-S0.8: Tổng bare-name references = 0
grep -rn "var(--\(text-primary\|text-muted\|text-secondary\|bg-panel\|bg-panel-soft\|border-default\|accent-cyan\))" \
  packages/web/src/ --include="*.css" --include="*.tsx" \
  | grep -v "var(--[a-z-]*," | wc -l
# Kết quả mong đợi: 0

# AC-S0.9: soc.module.css lines 473/480/530 đã có fallback
sed -n '473p;480p;530p' packages/web/src/components/soc/soc.module.css
# Kết quả: mỗi dòng phải chứa var(--text-muted, #94a3b8)
```

**Audit checklist:**
- [ ] `S0_FALLBACK_AUDIT.md` đã tạo với full grep results per token
- [ ] Mỗi file đã patch đều có comment giải thích giá trị fallback
- [ ] soc.module.css lines 473/480/530 đã fix
- [ ] ScreenerPage.tsx lines 41/45/80 đã fix
- [ ] VninvestInput.module.css 9 refs đã fix
- [ ] WatchlistPage.css 34 refs đã fix
- [ ] `npx tsc --noEmit` pass
- [ ] `npm run build` pass
- [ ] **Hard gate:** AC-S0.8 pass (= 0 bare-name references)

**Rủi ro & giảm thiểu:**
- **R:** Fallback value chọn sai (legacy vs Tailwind conflict) → **G:** Giá trị fallback luôn là Tailwind @theme values, KHÔNG phải legacy frontend/ values
- **R:** Patch漏掉 file → **G:** AC-S0.8 là global grep, không thể漏

---

### Slice S1: Token-Bridge + tokens.css

**Mục tiêu:** Tạo `theme/tokens.css` alias tất cả bare-name token về Tailwind `@theme` values. Bridge là single source of truth cho 3 namespace.

**Scope files:**
- **Tạo mới:** `packages/web/src/theme/tokens.css`
- **Sửa:** `packages/web/src/index.css` (thêm `@import './theme/tokens.css'`)
- **Verify:** `soc.module.css`, `aiSettings.module.css`, `VninvestInput.module.css`, `WatchlistPage.css` — KHÔNG sửa, chỉ verify hoạt động đúng qua bridge

**Hành động:**
1. Tạo `packages/web/src/theme/tokens.css` với `:root` block chứa tất cả alias tokens (xem §4 Token-bridge)
2. Import `tokens.css` vào `index.css` SAU `@theme` block
3. Verify mỗi token mapping đúng giá trị

**Kết quả đầu ra:**
- [ ] `packages/web/src/theme/tokens.css` — file mới
- [ ] `packages/web/src/index.css` — import thêm tokens.css
- [ ] `docs/S1_TOKEN_MAPPING.md` — mapping table: legacy var → Tailwind var → computed value

**Tiêu chí đánh giá:**

```bash
# AC-S1.1: tokens.css tồn tại và import được
test -f packages/web/src/theme/tokens.css && echo "PASS" || echo "FAIL"

# AC-S1.2: index.css import tokens.css
grep -n "tokens.css" packages/web/src/index.css | wc -l  # >= 1

# AC-S1.3: Mỗi token trong tokens.css có @theme source
grep "text-primary.*color-text-primary" packages/web/src/theme/tokens.css | wc -l  # >= 1
grep "text-muted.*color-text-secondary" packages/web/src/theme/tokens.css | wc -l  # >= 1
grep "bg-panel.*color-bg-panel" packages/web/src/theme/tokens.css | wc -l  # >= 1

# AC-S1.4: tokens.css KHÔNG chứa giá trị hardcoded không có @theme source
# (LƯU Ý: fallback values trong var(--x, #fallback) là EXPECTED — chúng là safety net)
# Chỉ check: KHÔNG có property trực tiếp gán hex/rgb mà không qua var()
grep -E "^\s+[a-z-]+:\s*#[0-9a-fA-F]" packages/web/src/theme/tokens.css | wc -l
# Kết quả mong đợi: 0 (mọi giá trị phải qua var() alias)

# AC-S1.5: Build pass
npm run build  # exit 0

# AC-S1.6: SOC module colors unchanged
# Mở browser → SOC page → verify colors giống hệt trước khi implement

# AC-S1.7: ScreenerPage colors now resolve (không còn undefined)
# Mở browser → Screener → verify text/background hiển thị đúng
```

**Audit checklist:**
- [ ] `S1_TOKEN_MAPPING.md` đã tạo với mapping table hoàn chỉnh
- [ ] `tokens.css` chỉ chứa alias, KHÔNG chứa logic phức tạp
- [ ] `npx tsc --noEmit` pass
- [ ] `npm run build` pass
- [ ] Visual verify SOC module page: colors giống hệt
- [ ] Visual verify ScreenerPage: text/background giờ đúng (trước đây undefined)
- [ ] Visual verify Watchlist page: colors giống hệt
- [ ] Visual verify VnInvestInput component: colors giống hét

---

### Slice S2: Theme Primitives Module

**Mục tiêu:** Tạo shared `theme.module.css` chứa design system primitives dùng chung ≥2 places. **KHÔNG gộp SOC domain module.**

**Scope files:**
- **Tạo mới:** `packages/web/src/theme/theme.module.css`
- **Giữ nguyên:** `soc.module.css`, `aiSettings.module.css` (chỉ verify import tokens)

**Primitives cần có (dùng ≥2 places trong codebase):**

| Primitive | Class pattern | Ghi chú |
|-----------|--------------|---------|
| Button | `.btn`, `.btnPrimary`, `.btnSecondary`, `.btnDanger`, `.btnGhost` | Dùng ở SOC, Dashboard, Settings |
| Card/Panel | `.card`, `.panelSoft`, `.panelGlass` | Glassmorphism shared |
| Input | `.input`, `.inputFocused`, `.inputError` | Thay VninvestInput.module.css |
| Select | `.select`, `.selectTrigger` | |
| Checkbox/Toggle | `.checkbox`, `.toggle`, `.toggleActive` | |
| Badge/Status | `.badge`, `.badgeSuccess`, `.badgeWarning`, `.badgeDanger`, `.statusDot` | Dùng ở SOC + Dashboard |
| Alert | `.alert`, `.alertInfo`, `.alertSuccess`, `.alertWarning`, `.alertDanger` | |
| Tabs | `.tabs`, `.tab`, `.tabActive`, `.tabPanel` | |
| Modal/Drawer | `.modalOverlay`, `.modalContent`, `.drawerOverlay`, `.drawerContent` | |
| Table | `.table`, `.tableHeader`, `.tableRow`, `.tableCell` | |
| Skeleton | `.skeleton`, `.skeletonPulse` | Loading states |
| Empty state | `.emptyState`, `.emptyStateIcon`, `.emptyStateText` | |
| Toolbar | `.toolbar`, `.toolbarGroup` | |
| Metric | `.metric`, `.metricValue`, `.metricLabel` | Dashboard + SOC |

**Hành động:**
1. Quét codebase tìm class patterns đang dùng ≥2 places → xác định primitives cần tạo
2. Tạo `theme.module.css` với mỗi primitive dùng `var(--token)` bridge
3. Verify primitives match styling hiện tại (visual diff)

**Kết quả đầu ra:**
- [ ] `packages/web/src/theme/theme.module.css` — file mới
- [ ] `docs/S2_PRIMITIVES_INVENTORY.md` — danh sách primitives, class names, và files đang dùng chúng

**Tiêu chí đánh giá:**

```bash
# AC-S2.1: theme.module.css tồn tại
test -f packages/web/src/theme/theme.module.css && echo "PASS" || echo "FAIL"

# AC-S2.2: Primitives dùng bridged tokens cho color-related properties
# (LƯU Ý: shadows, scrollbars, border-radius CẦN giá trị cố định → hex/rgb chấp nhận được)
# Chỉ count: color/background/border-color properties phải dùng var()
grep -E "(color|background|border-color)\s*:\s*#[0-9a-fA-F]" packages/web/src/theme/theme.module.css | wc -l
# Kết quả mong đợi: 0

# AC-S2.3: SOC module KHÔNG bị sửa
git diff packages/web/src/components/soc/soc.module.css | wc -l  # 0
git diff packages/web/src/components/aiSettings.module.css | wc -l  # 0

# AC-S2.4: Import paths đúng
grep -n "import.*tokens" packages/web/src/theme/theme.module.css | wc -l  # >= 1

# AC-S2.5: tsc + build pass
npx tsc --noEmit && npm run build  # exit 0
```

**Audit checklist:**
- [ ] `S2_PRIMITIVES_INVENTORY.md` contains: primitive name, class name, used in ≥2 files, token references
- [ ] `theme.module.css` organized by section comments (`/* === Buttons === */`, etc.)
- [ ] All primitives use `var(--token, fallback)` pattern
- [ ] SOC module still works without any changes (visual verify)
- [ ] No primitive duplicates existing SOC classes (naming conflict check)

---

### Slice S3: ShellPageTemplate Refactor + All --shell-* Consumers

> **LƯU Ý QUAN TRỌNG:** S3 không chỉ refactor ShellPageTemplate.js. Có **18 files beyond ShellPageTemplate.js** dùng `--shell-*` tokens (xem §1.2C). Phải update TẤT CẢ.

**Mục tiêu:** Chuyển ShellPageTemplate từ CSS string trong JS sang CSS Modules. Đổi `--shell-*` tokens sang bridged tokens. Breaking change cho tất cả consumers.

**Scope files:**
- **Tạo mới:** `packages/web/src/theme/ShellPageTemplate.module.css`
- **Sửa:** `packages/web/src/components/ShellPageTemplate.js` — xóa CSS string, import module
- **Sửa:** Tất cả files dùng `shellPage__*` BEM classes (~17 page imports)
- **Sửa:** Tất cả files dùng `--shell-*` tokens trong template literals/inline styles (18 files):

| File | Tokens used | Fallback? |
|------|------------|-----------|
| `Breadcrumb.tsx` | `--shell-muted`, `--shell-accent`, `--shell-border` | Không |
| `ShellEmptyState.tsx` | `--shell-muted`, `--shell-ink` | Không |
| `ShellSkeleton.tsx` | `--shell-border`, `--shell-surface` | Có |
| `TenantAdminLayout.tsx` | `--shell-border`, `--shell-surface`, `--shell-muted` | Không |
| `TenantAdminSidebar.tsx` | `--shell-surface`, `--shell-border`, `--shell-accent`, `--shell-muted`, `--shell-ink` | Không |
| `ShellOperationsCenterPage.tsx` | `--shell-accent`, `--shell-ink` | Có |
| `ShellMailConfigPage.tsx` | `--shell-muted` | Không |
| `BillingCenterPage.tsx` | 5 tokens | Không |
| `PaymentReturnPage.tsx` | 3 tokens | Không |
| `TenantAdminCapabilitiesPage.tsx` | 5 tokens | Không |
| `TenantAdminHomePage.tsx` | 4 tokens | Không |
| `TenantAdminMembersPage.tsx` | 3 tokens | Không |
| `TenantAdminPATsPage.tsx` | 3 tokens | Không |
| `TenantAdminUsagePage.tsx` | 4 tokens | Không |
| `TenantAdminUsageHistoryPage.tsx` | 3 tokens | Không |
| `TenantAdminSecurityPage.tsx` | 3 tokens | Không |
| `TenantAdminWebhooksPage.tsx` | 3 tokens | Không |
| `pageRegistry.js` | `--shell-ink`, `--shell-muted` | Có |

**Token mapping Shell → Bridged:**

| Shell token | Bridged token | Giá trị Shell | Giá trị Bridged | Khác? |
|---|---|---|---|---|
| `--shell-ink` | `--text-primary` | `#f1f5f9` | `#f1f5f9` | ✅ same |
| `--shell-muted` | `--text-muted` | `#94a3b8` | `#94a3b8` | ✅ same |
| `--shell-accent` | `--accent-cyan` | `#00b4d8` | `#06b6d4` | ⚠️ **KHÁC** |
| `--shell-border` | `--border-default` | (verify) | (verify) | — |
| `--shell-surface` | `--bg-panel-soft` | (verify) | (verify) | — |
| `--shell-signal` | (cần define) | — | — | Token mới |

**⚠️ QUYẾT ĐỊNH CẦN TRƯỚC S3:** `--shell-accent` (#00b4d8) khác `--accent-cyan` (#06b6d4). Hai lựa chọn:
- **Option A:** Accept đổi accent → Shell pages sẽ đổi từ #00b4d8 sang #06b6d4 (rủi ro visual)
- **Option B:** Define `--shell-accent` trực tiếp trong tokens.css với giá trị #00b4d8 → giữ nguyên visual

**Hành động:**
1. List TẤT CẢ consumers: `grep -rn "shellPage__\|--shell-" packages/web/src/ --include="*.js" --include="*.tsx" --include="*.css"`
2. Tạo `ShellPageTemplate.module.css` với CSS Modules mapping
3. Chuyển BEM `shellPage__hero` → `styles.hero`
4. Với mỗi file dùng `--shell-*`: chuyển sang `var(--bridged-token)` hoặc xóa nếu unused
5. Update tất cả consumers trong 1 commit

**Kết quả đầu ra:**
- [ ] `packages/web/src/theme/ShellPageTemplate.module.css` — file mới
- [ ] `packages/web/src/components/ShellPageTemplate.js` — refactor, không có CSS string
- [ ] Tất cả 18+ shell consumers updated
- [ ] `docs/S3_SHELL_CONSUMERS.md` — danh sách consumers đã update + decision về --shell-accent

**Tiêu chí đánh giá:**

```bash
# AC-S3.1: Không còn CSS string trong ShellPageTemplate.js
grep -c "const.*= \`" packages/web/src/components/ShellPageTemplate.js
# Kết quả: 0

# AC-S3.2: Không còn --shell-* token usage ở BẤT KỲ file nào
grep -rn "\-\-shell-" packages/web/src/ --include="*.js" --include="*.tsx" --include="*.css" | wc -l
# Kết quả: 0

# AC-S3.3: Không còn shellPage__* class reference (BEM strings)
grep -rn "shellPage__" packages/web/src/ --include="*.js" --include="*.tsx" | wc -l
# Kết quả: 0

# AC-S3.4: ShellPageTemplate.module.css import correctly
grep -n "import.*ShellPageTemplate" packages/web/src/components/ShellPageTemplate.js | wc -l  # >= 1

# AC-S3.5: All pages render correctly
# Verify: SOC page, Dashboard, Stock detail, TenantAdmin, Billing — page layout không bị vỡ

# AC-S3.6: tsc + build pass
npx tsc --noEmit && npm run build  # exit 0
```

**Audit checklist:**
- [ ] `S3_SHELL_CONSUMERS.md` lists ALL consumers + confirmation each updated
- [ ] No `shellPage__` string remains in any file
- [ ] No `--shell-*` token remains in any file
- [ ] `--shell-accent` decision documented
- [ ] Visual verify: page hero/eyebrow/title/description/layout identical
- [ ] Visual verify: TenantAdmin sidebar, layout — identical
- [ ] Visual verify: Breadcrumb, ShellEmptyState — identical
- [ ] Responsive verify: mobile/tablet layout không bị vỡ

---

### Slice S4: AI Area Cleanup

**Mục tiêu:** Chuyển AI area components sang dùng `theme.module.css` primitives.

**Scope files:**
- `packages/web/src/components/aiSettings.module.css` — verify tokens đã bridge
- AI area TSX files — convert static styles → theme.module.css classes
- `packages/web/src/features/dashboard/AIAdvisorAlertPanel.css` (5.4 KB) — migratable

**Hành động:**
1. Verify `aiSettings.module.css` hoạt động đúng qua bridge
2. Migrate `AIAdvisorAlertPanel.css` → `theme.module.css` classes
3. Audit inline styles trong AI TSX files → chuyển static vào module

**Kết quả đầu ra:**
- [ ] `AIAdvisorAlertPanel.css` deleted
- [ ] AI TSX files reduced inline count

**Tiêu chí đánh giá:**

```bash
# AC-S4.1: AIAdvisorAlertPanel.css deleted
test -f packages/web/src/features/dashboard/AIAdvisorAlertPanel.css && echo "FAIL" || echo "PASS"

# AC-S4.2: aiSettings.module.css token references resolve correctly
# Verify: --text-primary resolves to #f1f5f9, not undefined

# AC-S4.3: AI component tests pass
npm run test -- --testPathPattern="aiSettings|AIAdvisor|Federation"  # all pass

# AC-S4.4: Inline count in AI files reduced by ≥50%
```

**Audit checklist:**
- [ ] AIAdvisorAlertPanel.css deleted, content moved to theme.module.css
- [ ] aiSettings.module.css unchanged (git diff = 0)
- [ ] All AI component tests pass
- [ ] Visual verify: AI Settings modal, AI Federation panel, AI Analytics identical

---

### Slice S5: SOC Inline → Module Class

**Mục tiêu:** Giảm inline styles trong SOC components ≥80% bằng cách chuyển static styling vào `soc.module.css` hoặc `theme.module.css`.

**Scope files:** ~35 SOC TSX files
**Baseline inline counts (hiện tại):**
- SettingsModal: 129
- SocSchedulerBoard: 87
- SocDataOpsMonitorSection: 85
- DrawingInspector: 55
- SocDataOpsOperationsSection: 64
- Các file khác: 5-30 each

**Hành động:**
1. Với mỗi SOC TSX file:
   - Phân loại inline: `static` (fixed values, colors, spacing) vs `dynamic` (calculated from props/state)
   - Static → chuyển vào `.module.css` class
   - Dynamic → giữ inline (hoặc use CSS custom properties)
2. Mở rộng `soc.module.css` với các classes mới
3. Verify visual identical

**Phân loại inline để quyết định:**

| Loại | Ví dụ | Action |
|------|-------|--------|
| **Static fixed** | `style={{ padding: '16px', borderRadius: '12px' }}` | → Chuyển vào module class |
| **Static token** | `style={{ color: 'var(--text-primary)' }}` | → Chuyển vào module class, dùng `var()` |
| **Dynamic from props** | `style={{ width: \`${percent}%\` }}` | → GIỮ inline hoặc dùng CSS var |
| **Dynamic from state** | `style={{ opacity: isVisible ? 1 : 0 }}` | → GIỮ inline hoặc dùng CSS class toggle |
| **Conditional layout** | `style={{ display: isOpen ? 'block' : 'none' }}` | → Chuyển sang conditional className |

**Kết quả đầu ra:**
- [ ] SOC inline count giảm ≥80%
- [ ] `docs/S5_SOC_INLINE_AUDIT.md` — before/after count per file

**Tiêu chí đánh giá:**

```bash
# AC-S5.1: Total SOC inline count reduced ≥80%
# Baseline: grep style={{ in packages/web/src/components/soc/*.tsx
BEFORE=$(grep -rc "style={{" packages/web/src/components/soc/ --include="*.tsx" | awk -F: '{s+=$2} END {print s}')
AFTER_PREV=$BEFORE  # capture before changes
# Sau khi fix:
AFTER=$(grep -rc "style={{" packages/web/src/components/soc/ --include="*.tsx" | awk -F: '{s+=$2} END {print s}')
echo "Before: $BEFORE | After: $AFTER | Reduction: $(( (BEFORE-AFTER)*100/BEFORE ))%"
# mong đợi: >= 80%

# AC-S5.2: soc.module.css increased (new classes added)
SOC_LINES=$(wc -l < packages/web/src/components/soc/soc.module.css)
# mong đợi: SOC_LINES >= 942 (baseline) + ~200 new classes

# AC-S5.3: tsc + build + SOC component tests pass
npx tsc --noEmit && npm run build && npm run test -- --testPathPattern="soc"  # all pass

# AC-S5.4: Visual diff 0 regressions
```

**Audit checklist:**
- [ ] `S5_SOC_INLINE_AUDIT.md` has per-file before/after inline counts
- [ ] Every static inline moved to module class
- [ ] Every dynamic inline has justification for keeping inline
- [ ] SOC module CSS增长合理 (không quá 1,200 dòng)
- [ ] All SOC component tests pass
- [ ] Visual verify: SOC Dashboard, SOC Settings, SOC Scheduler, Drawing Inspector

---

### Slice S6: AlertCenter Dead Code Cleanup

> **Cập nhật:** AlertCenterPage.tsx line 7 import `./AlertCenterPage.styles.js` (ACTIVE).
> `AlertCenterPage.module.css` là DEAD CODE — không được import ở đâu.

**Mục tiêu:** Xóa dead code. Đơn giản, low-risk.

**Scope files:**
- `pages/AlertCenterPage.module.css` (1,023 dòng) — **DEAD CODE → XÓA**
- `pages/AlertCenterPage.styles.js` (1,053 dòng) — **ACTIVE → GIỮ**

**Hành động:**
1. Verify `AlertCenterPage.module.css` không được import ở bất kỳ đâu
2. Xóa `AlertCenterPage.module.css`
3. Verify build + test vẫn pass

**Kết quả đầu ra:**
- [ ] `AlertCenterPage.module.css` deleted

**Tiêu chí đánh giá:**

```bash
# AC-S6.1: AlertCenterPage.module.css deleted
test -f packages/web/src/pages/AlertCenterPage.module.css && echo "FAIL" || echo "PASS"

# AC-S6.2: AlertCenterPage.tsx still imports .styles.js (unchanged)
grep "AlertCenterPage.styles" packages/web/src/pages/AlertCenterPage.tsx | wc -l  # 1

# AC-S6.3: No file imports AlertCenterPage.module.css
grep -rn "AlertCenterPage.module" packages/web/src/ --include="*.tsx" --include="*.js" | wc -l  # 0

# AC-S6.4: tsc + build pass
npx tsc --noEmit && npm run build  # exit 0
```

**Audit checklist:**
- [ ] Dead .module.css deleted
- [ ] .styles.js untouched
- [ ] Build + tests pass
- [ ] Visual verify: Alert Center page identical

---

### Slice S7: Stock-Detail Standardization

**Mục tiêu:** Standardize StockDetailPage styling. Giữ per-page CSS (scoped) nhưng chuyển sang bridged tokens. **KHÔNG xóa StockDetailPage.css** — đây là domain-specific layout, không generalize được.

**Scope files:**
- `pages/StockDetailPage.css` (2,175 dòng) — verify dùng bridged tokens
- `sdp-` classes (268 defs) — verify scoped, không leak
- Stock-detail TSX files (~8 files) — reduce inline

**Hành động:**
1. Verify `StockDetailPage.css` đã dùng `var()` (với fallback) cho colors
2. Nếu dùng hardcoded hex → chuyển sang `var(--token, fallback)`
3. Giữ `sdp-` prefix nhưng đảm bảo CSS Modules scoped (`.module.css`)
4. Audit inline styles trong stock-detail TSX files → chuyển static vào module

**Kết quả đầu ra:**
- [ ] `StockDetailPage.css` dùng bridged tokens cho ≥80% color values
- [ ] Stock-detail inline count reduced ≥50%

**Tiêu chí đánh giá:**

```bash
# AC-S7.1: StockDetailPage.css uses bridged tokens
HARDCODED=$(grep -cE "(color|background|border-color)\s*:\s*#[0-9a-fA-F]" packages/web/src/pages/StockDetailPage.css)
TOKENIZED=$(grep -c "var(--" packages/web/src/pages/StockDetailPage.css)
echo "Tokenized ratio: $TOKENIZED / $((HARDCODED + TOKENIZED))"
# mong đợi: ratio >= 0.8

# AC-S7.2: Stock-detail inline reduced ≥50%

# AC-S7.3: No sdp- class leak outside stock-detail
grep -rn "sdp-" packages/web/src/ --include="*.tsx" --include="*.js" \
  | grep -v "stock-detail\|StockDetail" | wc -l
# Kết quả: 0

# AC-S7.4: tsc + build + stock tests pass
npx tsc --noEmit && npm run build && npm run test -- --testPathPattern="stock"  # all pass

# AC-S7.5: Visual verify stock detail page identical
```

**Audit checklist:**
- [ ] StockDetailPage.css tokenized (no raw hex colors except truly fixed)
- [ ] No sdp- class usage outside stock-detail domain
- [ ] Stock detail inline count documented in before/after
- [ ] All stock-related tests pass
- [ ] Visual verify: full stock detail page walkthrough
- [ ] **Visual snapshot trước/sau** (chromatic/percy hoặc manual screenshot)

---

### Slice S8: Core Pages Standardization

**Mục tiêu:** Standardize core pages (Dashboard, Transactions, UserSettings, Portfolios, WhaleAlerts). Chuyển per-page CSS sang bridged tokens.

**Scope files (~14 files):**
- `pages/PortfoliosPage.css` (330 lines) — `core-` prefix
- `pages/DashboardPage.tsx` + related — `core-` classes
- `pages/TransactionsPage.tsx` — `core-` classes
- `pages/UserSettingsPage.tsx` — `core-` classes
- `pages/WhaleAlertsPage.tsx` — `core-` classes
- `components/dashboard/SmartStatsHeader.css` (86 lines)

**Hành động:**
1. Với mỗi page: verify per-page CSS dùng bridged tokens
2. Audit `core-` class usage → migrate sang scoped classes
3. Reduce inline styles
4. **Làm từng page 1 PR** với visual snapshot

**Kết quả đầu ra:**
- [ ] Mỗi page có 1 PR riêng với before/after visual snapshot
- [ ] `core-` classes reduced ≥50% across core pages

**Tiêu chí đánh giá:**

```bash
# AC-S8.1: Per-page CSS files dùng bridged tokens
for f in PortfoliosPage.css SmartStatsHeader.css; do
  HARDCODED=$(grep -cE "(color|background|border-color)\s*:\s*#[0-9a-fA-F]" "packages/web/src/pages/$f" 2>/dev/null || echo 0)
  echo "$f: $HARDCODED hardcoded color properties"
done
# mong đợi: 0 per file

# AC-S8.2: core- classes reduced ≥50%
BEFORE_CORE=$(grep -rn "core-" packages/web/src/ --include="*.css" --include="*.tsx" | wc -l)
# After S8: mong đợi BEFORE_CORE * 0.5

# AC-S8.3: Each page has visual snapshot PR

# AC-S8.4: tsc + build + all tests pass
npx tsc --noEmit && npm run build && npm run test  # all pass
```

**Audit checklist:**
- [ ] Each page PR has before/after screenshot
- [ ] Each page per-page CSS verified using bridged tokens
- [ ] core- classes documented per page with before/after counts
- [ ] All page tests pass
- [ ] Visual verify each page individually

---

### Slice S9: TenantAdmin Inline Cleanup

**Mục tiêu:** Giảm inline styles trong TenantAdmin pages ≥80%. Đây là vùng density cao nhất codebase.

**Scope files (~8 files):**
- `TenantAdminPATsPage.tsx` (90 inline)
- `TenantAdminUsagePage.tsx` (84 inline)
- `TenantAdminWebhooksPage.tsx` (58 inline)
- `TenantAdminHomePage.tsx` (58 inline)
- `TenantAdminBillingPage.tsx` (44 inline)
- `TenantAdminMembersPage.tsx` (43 inline)
- `TenantAdminAuditLogsPage.tsx` (28 inline)
- `TenantAdminServiceAccountsPage.tsx` (25 inline)

**Hành động:**
1. Tạo `TenantAdmin.module.css` shared cho area
2. Phân loại inline: static → module class, dynamic → CSS var hoặc giữ
3. Migrate theo pattern tương tự S5

**Kết quả đầu ra:**
- [ ] TenantAdmin inline count reduced ≥80% (từ ~377 xuống ≤75)
- [ ] `TenantAdmin.module.css` file mới

**Tiêu chí đánh giá:**

```bash
# AC-S9.1: TenantAdmin inline reduced ≥80%
BEFORE=377
AFTER=$(grep -rc "style={{" packages/web/src/pages/TenantAdmin*.tsx | awk -F: '{s+=$2} END {print s}')
echo "Before: $BEFORE | After: $AFTER | Reduction: $(( (BEFORE-AFTER)*100/BEFORE ))%"
# mong đợi: >= 80%

# AC-S9.2: TenantAdmin.module.css exists
test -f packages/web/src/pages/TenantAdmin.module.css && echo "PASS" || echo "FAIL"

# AC-S9.3: tsc + build pass
npx tsc --noEmit && npm run build  # exit 0

# AC-S9.4: Visual verify TenantAdmin pages
```

**Audit checklist:**
- [ ] TenantAdmin.module.css created with all static classes
- [ ] Per-file inline counts documented before/after
- [ ] No dynamic values accidentally moved to static class
- [ ] All TenantAdmin pages render correctly

---

### Slice S10: Watchlist + Remaining Pages

**Mục tiêu:** Standardize WatchlistPage.css + remaining pages.

**Scope files:**
- `pages/WatchlistPage.css` (422 lines) — already fixed fallbacks in S0
- `components/ui/VninvestInput.module.css` (110 lines) — migrated to theme.module.css in S2/S4
- `pages/auth/AuthRegisterPage.css` (8 lines)
- `components/DNSEConnectionPanel.css` (280 lines)

**Hành động:**
1. Verify WatchlistPage.css tokens correctly bridged
2. Delete VninvestInput.module.css (content migrated to theme.module.css)
3. Verify remaining per-page CSS uses bridged tokens

**Kết quả đầu ra:**
- [ ] VninvestInput.module.css deleted
- [ ] All remaining per-page CSS verified using bridged tokens

**Tiêu chí đánh giá:**

```bash
# AC-S10.1: VninvestInput.module.css deleted
test -f packages/web/src/components/ui/VninvestInput.module.css && echo "FAIL" || echo "PASS"

# AC-S10.2: WatchlistPage.css tokens bridged
grep -c "var(--" packages/web/src/pages/WatchlistPage.css  # >= 34

# AC-S10.3: tsc + build pass
npx tsc --noEmit && npm run build  # exit 0

# AC-S10.4: Visual verify Watchlist, Auth, DNSE panel
```

**Audit checklist:**
- [ ] VninvestInput migrated + deleted
- [ ] WatchlistPage.css verified bridged
- [ ] All remaining files verified
- [ ] Visual verify all remaining pages

---

## 6. Tiêu chí hoàn thành tổng thể (Final DoD)

| Metric | Target | Measurement method |
|--------|--------|--------------------|
| Token source | 1 `:root` (`tokens.css`); tất cả bare-name tokens alias về Tailwind | `grep` bare-name tokens → 0 outside tokens.css |
| Bare-name references | **0** bare (không fallback) across codebase | AC-S0.8 script |
| Per-page CSS | **≥6 files** domain-specific (StockDetailPage, WatchlistPage, AlertCenterPage.styles.js, AuthRegisterPage, DNSEConnectionPanel, SmartStatsHeader) — chấp nhận được nếu dùng bridged tokens | `find` + manual verify |
| `core-` classes | 0 occurrences trong CSS | `grep -rn "core-" packages/web/src/ --include="*.css" \| wc -l` = 0 |
| `sdp-` classes | Scoped trong stock-detail only | `grep -rn "sdp-" packages/web/src/ \| grep -v stock-detail \| wc -l` = 0 |
| `shellPage__*` + `--shell-*` | 0 occurrences | `grep -rn "shellPage__\|--shell-" packages/web/src/ \| wc -l` = 0 |
| Inline styles | Reduced ≥70% (from 568 to ≤170) | `grep -rc "style={{" packages/web/src/ --include="*.tsx" \| awk` |
| Build | `npx tsc --noEmit` + `npm run build` pass | CI gate |
| Tests | `npm run test` all pass | CI gate |
| Visual | 0 regressions trên tất cả pages | **Visual snapshot comparison (hard gate)** |

---

## 7. Rủi ro & giảm thiểu

| Risk | Severity | Mitigation | Owner |
|------|----------|------------|-------|
| **252 bare-name refs → silent color loss** | **Khẩn cấp** | S0 fix TRƯỚC KHI làm gì khác | Slice S0 |
| **SOC lines 473/480/530 broken** | **Khẩn cấp** | S0 step 1 fix | Slice S0 |
| **Shell token scope 18+ files** | Cao | S3 phải list + update TẤT CẢ consumers | Slice S3 |
| **--shell-accent (#00b4d8) vs --accent-cyan (#06b4d8)** | TB | Quyết định trước S3, document decision | Pre-S3 |
| **SOC domain coupling nếu gộp vào theme** | TB | KHÔNG gộp SOC, giữ domain module riêng | S2 |
| **Visual regression không detect được** | Cao | **Visual snapshot tooling là hard pre-req trước S7** | Pre-S7 |
| **AlertCenter .styles.js đang ACTIVE** | Thấp | S6 chỉ xóa dead .module.css | S6 |
| **God file 2,175 lines StockDetailPage.css** | TB | KHÔNG merge vào theme, giữ domain | S7 |
| **TenantAdmin inline >90% density** | TB | Pattern established từ S5, apply tương tự | S9 |

---

## 8. Pre-requisite trước khi bắt đầu

### Đã xác minh (không còn là open question):

| Question | Kết luận | Evidence |
|----------|---------|----------|
| **Q1: `frontend/src/index.css` có load trong SaaS app?** | **KHÔNG** | Grep source: chỉ comment trong soc.js, không có import CSS |
| **Q2: Bare-name tokens có undefined?** | **CÓ** | 252 bare references không fallback → silent color loss |
| **Q3: SOC có "an toàn"?** | **KHÔNG** | soc.module.css lines 473/480/530 dùng bare `var(--text-muted)` |

### Cần chốt trước khi code:

1. **Accent color decision:** `--shell-accent` (#00b4d8) hay `--accent-cyan` (#06b6d4) làm accent chính?
   - Ảnh hưởng: Shell pages accent color, SOC accent, button primary color
   - **Phải chốt trước S3**

2. **DoD scope:** Chấp nhận "per-page CSS scoped + bridged tokens" thay vì "0 per-page CSS"?
   - StockDetailPage.css 2,175 dòng là domain layout, không generalize
   - **Đã resolve: ≥6 per-page CSS files chấp nhận được nếu dùng bridged tokens**

3. **Visual snapshot tooling:** Setup Chromatic/Percy trước S7 hay dùng manual screenshot comparison?
   - **Nên là hard pre-req**, không optional — thay đổi dính mọi page, manual screenshot rủi ro cao
   - Nếu automated → cần budget + setup time trước S7
   - **PHẢI quyết định trước S7, không được để optional**

---

## 9. Glossary

| Thuật ngữ | Định nghĩa |
|-----------|-----------|
| **Bridged token** | Token alias trong `:root` map từ legacy namespace → Tailwind `@theme` |
| **Bare-name token** | Token dùng `var(--token)` không có fallback → undefined nếu token không resolve |
| **Fallback** | Giá trị mặc định trong `var(--token, fallback)` khi token không resolve |
| **Per-page CSS** | File `.css`/`.module.css` riêng cho 1 page component |
| **Domain module** | Module styling riêng cho 1 domain (vd: `soc.module.css`), không reuse |
| **Primitives** | Shared UI components (button, card, input...) dùng ≥2 places |
| **Static inline** | `style={{ fixedValue }}` — có thể chuyển vào module class |
| **Dynamic inline** | `style={{ calculatedValue }}` — cần giữ inline hoặc dùng CSS var |
