# Khung chuẩn hóa Theme Template — Audit UI & Đề xuất áp dụng

> **Mục đích:** Audit toàn bộ giao diện các tính năng hệ thống, xác định sự phân mảnh styling,
> và đề xuất một khung áp dụng theme template chuẩn thay thế các CSS riêng lẻ theo từng trang.
> **Trạng thái:** Tài liệu thảo luận — chưa code. Chờ phê duyệt trước khi thực thi (Pha 0).

---

## 1. Hiện trạng: 5 hệ thống styling song song, không có nguồn truth duy nhất

Quét **197 file** có tín hiệu styling, phát hiện **5 cơ chế song song** với **4 namespace token không khớp nhau**:

| # | Hệ thống | Token namespace | Định nghĩa | Quy mô |
|---|----------|----------------|-----------|--------|
| 1 | **Tailwind `@theme`** (`src/index.css`) | `--color-text-primary`, `--color-bg-panel`, `--color-accent-primary` | Global, de-facto palette | 363 dòng `@theme` |
| 2 | **SOC module** (`soc.module.css` + `aiSettings.module.css`) | `--text-primary`, `--accent-cyan`, `--border-default`, `--bg-panel-soft` | **KHÔNG define global nào** → luôn rơi vào fallback cứng | soc 1.06k dòng, ai 767 dòng |
| 3 | **Shell template** (`ShellPageTemplate.js` – CSS string) | `--shell-ink`, `--shell-accent`, `--shell-border` | Inject global, BEM `shellPage__*` | 627 dòng |
| 4 | **Per-page CSS** (tự định nghĩa class) | ad-hoc | File `.css` / `.module.css` / `.styles.js` riêng từng trang | **~145 KB** (xem §2) |
| 5 | **Inline `style={{}}`** | — | Rải rác trong code | **95 file**, cực nặng ở `soc/*` & `stock-detail` |

### Phát hiện then chốt
- SOC module reference `var(--text-primary, #f1f5f9)` nhưng global **không hề define** `--text-primary`
  → luôn dùng fallback cứng → nhìn giống nhau mọi chỗ nhưng **value không được quản lý tập trung**,
  và **không đồng bộ** với Tailwind `@theme` (vd: border SOC `rgba(80,120,168,0.28)` vs Tailwind `--color-border-primary #1e293b`).
- **3 namespace token trùng nghĩa nhưng trái tên** (`--text-primary` vs `--color-text-primary` vs `--shell-ink`)
  → không thể đổi theme/thương hiệu ở 1 chỗ.
- **AlertCenterPage bị trùng lặp**: vừa có `AlertCenterPage.module.css` (27 KB) vừa `AlertCenterPage.styles.js`
  (28 KB, 127 lệnh `core-`) — hai bộ style cho 1 trang.
- Ngay cả nhóm "chuẩn" **`soc/*`** cũng dùng **inline style rất nặng** (SettingsModal 129, SocSchedulerBoard 87,
  SocDataOpsMonitorSection 85, DrawingInspector 55, SocDataOpsOperationsSection 64…). Tức là "chuẩn hóa"
  hiện tại vẫn chưa chuẩn.

### Phân bố cách tiếp cận styling (mỗi file)
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

## 2. Phân mảnh per-page CSS cần thay thế

| File | KB | Khu vực | Ghi chú |
|------|----|---------|--------|
| `pages/StockDetailPage.css` | 54 | Stock-detail | Lớn nhất, kèm `sdp-` 351 lần |
| `pages/AlertCenterPage.module.css` + `.styles.js` | 55 | Alert Center | Trùng lặp (2 bộ) |
| `pages/WatchlistPage.css` | 11 | Watchlist | |
| `pages/PortfoliosPage.css` | 6 | Portfolios | định nghĩa `core-` |
| `features/dashboard/AIAdvisorAlertPanel.css` | 5 | Dashboard | |
| `components/DNSEConnectionPanel.css` | 5 | Settings | |
| `components/alert-center/*` (2 file) | 6 | Alert Center | |
| `components/dashboard/SmartStatsHeader.css` | 2 | Dashboard | |
| `components/ui/VninvestInput.module.css` | 3 | Shared input | hợp nhất vào module chung |
| `pages/auth/AuthRegisterPage.css` | 0.1 | Auth | |

**Global `core-`**: 14 file (AlertCenter 36, Dashboard 21, Transactions 12, UserSettings 12, Portfolios 10, WhaleAlerts 9…).
**`sdp-`**: toàn bộ stock-detail (StockDetailTabs 138, StockContextDeck 78, StockInsightDeck 59, StockDetailHeader 45, StockDetailPage 20, StockSessionWitness 11).

---

## 3. Nguyên tắc khung (đề xuất)

1. **Một nguồn token duy nhất** — bridge `:root` trong `index.css` alias cả 3 namespace về 1 giá trị;
   `soc.module.css` giữ nguyên `var(--x, fallback)` nhưng fallback được căn lại khớp `@theme`
   → single-source, zero rename.
2. **Một shared design-system module** — gộp `soc.module.css` + `aiSettings.module.css` thành
   `src/theme/theme.module.css` chứa mọi primitive:
   `page, hero, panel, card, button(+variant), input, select, textarea, checkbox, toggle, table,
   badge, alert, tabs, toolbar, drawer, modal, metric, skeleton, emptyState, statusDot`.
3. **Page chrome bắt buộc** — mọi trang đi qua `ShellPageTemplate` (đổi `--shell-*` → token chung).
4. **Xóa per-page CSS** — không còn `.module.css` / `.css` / `.styles.js` theo trang; chỉ giữ module chung.
5. **Inline style chỉ cho giá trị động** (tính từ props/state) — static styling chuyển hết vào module class.
6. **CSS Modules (scoped) + `var(--token, fb)`**, tuyệt đối **không** dùng global class string
   (`core-`, `sdp-`, `shellPage__*`).

---

## 4. Kiến trúc đề xuất

```
src/
  index.css                 # @theme (palette) + MỚI: :root token-bridge (alias 3 namespace)
  theme/
    tokens.css             # :root { --text-primary: var(--color-text-primary); --accent-cyan:...; }
    theme.module.css       # mọi primitive (gộp soc + ai + mới)
    ShellPageTemplate.js   # refactor: dùng theme.module.css thay --shell-*/, CSS string
```

### Token-bridge (rủi ro thấp, chìa khóa)
```css
:root {
  --text-primary:   var(--color-text-primary,    #f1f5f9);
  --text-muted:     var(--color-text-secondary,  #94a3b8);
  --text-secondary: var(--color-text-secondary,  #94a3b8);
  --accent-cyan:    var(--color-accent-primary,   #06b6d4);
  --border-default: var(--color-border-primary,   #1e293b);
  --bg-panel-soft:  var(--color-bg-panel,         #0f172a);
  --shadow-panel:   var(--shadow-lg, 0 10px 15px rgb(0 0 0 / 0.1));
  --accent-emerald: var(--color-success-500, #10b981);
  --accent-rose:    var(--color-danger-500,   #ef4444);
  --accent-amber:   var(--color-warning-500, #f59e0b);
  /* + các token còn lại */
}
```
→ `soc.module.css` tự nhiên "sống" bằng token global; fallback vẫn an toàn nếu thiếu.
→ Đổi theme/thương hiệu chỉ ở 1 chỗ (`@theme` / `:root`).

---

## 5. Lộ trình theo pha (rủi ro & effort)

| Pha | Hạng mục | Files | Effort | Rủi ro | Cách verify |
|-----|----------|-------|--------|--------|-------------|
| **0** | Token-bridge + gộp `theme.module.css` + refactor `ShellPageTemplate` | 4 | M | Thấp | tsc + build + snapshot |
| **1** | AI area (đã làm AISettings/Federation/Analytics) → chuẩn hoá qua `theme.module.css` | 8 | S | Thấp | vitest 11 + jest |
| **2** | **`soc/*`** giảm inline → module class, đồng bộ token | ~35 file | L | TB | component test + visual diff |
| **3** | **Stock-detail**: xoá `StockDetailPage.css`(54KB) + `sdp-`(351) → module | ~8 file | XL | Cao | regression test + manual |
| **4** | **Trang cốt** (AlertCenter, Dashboard, Transactions, Portfolios, UserSettings, WhaleAlerts, Watchlist): xoá per-page CSS + `core-` | ~14 file | XL | Cao | per-PR + snapshot |
| **5** | Shell/misc + Auth + DNSE panel + shared input | còn lại | M | TB | build + jest |

**Ưu tiên đề xuất:** Pha 0 → 1 → 2 trước (nền tảng + vùng an toàn), hoãn Pha 3–4 (trang đang chạy,
rủi ro cao) sang từng PR nhỏ có visual snapshot.

---

## 6. Rủi ro & giảm thiểu

- **Visual regression** (Pha 3–4): chụp snapshot trước/sau, làm từng trang 1 PR.
- **Test break** (class string bị đổi): thêm bước grep test trước mỗi pha
  (đã làm cho AI area — 0 test phụ thuộc `core-`/`sdp-`).
- **Token mismatch**: bridge block giữ fallback khớp giá trị cũ → không đổi màu khi chưa ý muốn.
- **Inline động**: giữ lại inline cho giá trị tính toán (width %, index…); chỉ chuyển static.

---

## 7. Tiêu chí hoàn thành (DoD)
- 0 file per-page CSS; mọi feature dùng `theme.module.css`.
- 1 `:root` token source; soc / shell / ai cùng 1 namespace.
- Inline style chỉ còn giá trị động (grep `style: {` giảm >80%).
- `tsc --noEmit` + `build` + `vitest` + `jest` xanh; visual snapshot không lệch.

---

## 8. Câu hỏi cần chốt trước khi code
1. Có đồng ý gộp thành `src/theme/theme.module.css` (thay vì giữ `soc.module.css` + `aiSettings.module.css` riêng)?
2. Có đồng ý bridge token ở `:root` (Pha 0) làm nguồn duy nhất?
3. Có làm tiếp **Pha 3–4 (Stock-detail + trang cốt)** luôn, hay chỉ dừng **Pha 0–2** an toàn trước?
4. Có cần visual snapshot test (vd. Chromatic / Storybook) làm cổng chặn regression không?
