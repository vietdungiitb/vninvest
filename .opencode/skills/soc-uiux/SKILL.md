---
name: soc-uiux
description: Bản đồ UI/UX riêng của vninvest khi thiết kế, xây dựng, sửa hoặc audit giao diện trong packages/web — SSOT SOC (soc.tokens.css / soc.components.css), bản đồ 12 gate cơ học, playbook 3 chạm tra cứu, anti-patterns đã trả giá (module.css barrel, màu Bloomberg, bảng sticky, transition shorthand, CSS build). Dùng cho mọi task UI/UX của repo; RẺ hơn và CHÍNH XÁC hơn catalog thiết kế bên ngoài vì gắn trực tiếp với token + gate thật.
---

# SOC UI/UX — Bản đồ giao diện vninvest

> **Nguyên tắc vàng:** gate cơ học của repo **luôn thắng** mọi khuyến nghị thiết kế (catalog ngoài, skill khác, cả skill này). Khi mâu thuẫn → làm theo gate, rồi mới cân nhắc.

Skill này **không thay** `project-lessons` (planning gate — vẫn phải nạp trước khi lập kế hoạch) và **không thay** gate cơ học — nó là bản đồ để agent không phải đoán.

## 1. SSOT & luật cứng (đọc đầu tiên)

| Luật | Chi tiết | Bằng chứng |
|---|---|---|
| Token CSS mới | → `packages/web/src/components/soc/soc.tokens.css`, **KHÔNG tạo file token riêng** | `soc.tokens.css:33-38` |
| Class mới | → `soc.components.css` | `AGENTS.md` Constraints |
| ❌ CẤM `soc.module.css` | Chỉ là barrel 3 dòng `@import` — thêm token/class vào đó = chỉ dẫn không thi hành được | `soc.module.css:1-3`; lesson L-F03 |
| ❌ Hex cứng ngoài `:root` | Gate fail nếu hex không nằm trong allowlist; hex mới phải được **Owner duyệt vào allowlist**, không tự nới | `check-tokens.mjs:2-4,10-29` |
| ⚠ `src/styles/` ngoài tầm quét | `check-tokens.mjs:8` chỉ quét `src/components|src/pages|src/layouts|src/theme` — file token đặt ở `src/styles/` không gate nào nhìn thấy | `soc.tokens.css:36-38` |
| Modal/drawer phải **đục** | `--bg-panel` là kính 40% làm nền thẻ trên trang; panel nổi che nội dung dùng `--bg-panel-solid`. Mẫu đúng: `WatchlistPage.css:66` (0.95 + blur) | `soc.tokens.css:13-18` |
| Màu tăng/giảm = chuẩn Bloomberg | `--pf-gain` (xanh #34d399) = TĂNG, `--pf-loss` (đỏ #f87171) = GIẢM. Owner chốt 2026-10-13. **Đổi màu tăng/giảm phải hỏi Owner** (L-F08) | `soc.tokens.css:40-53` |
| Treemap/sunburst 5 sắc | `--pf-chart-1..5`, thứ tự = độ lớn | `soc.tokens.css:59-65` |

## 2. Bản đồ gates (chạy gì, kiểm gì)

Chuỗi tổng: `npm run check:shell` (`package.json:12`) = dom-landmarks + tokens + stock-detail-shell + admin-spa-routes + contrast + i18n-scan-strict + i18n-hardcoded.

| Gate | Lệnh | Kiểm tra gì |
|---|---|---|
| tokens | `npm run check:tokens` | Hex cứng ngoài `:root` và ngoài allowlist |
| token-conflict | `node scripts/check-token-conflict.mjs` | Cùng custom property khai báo >1 base block |
| contrast (admin) | `npm run check:contrast` | Cặp màu pill `adminTone.ts` ≥ 4.5:1 **cả 2 mode** |
| contrast (portfolio) | `node scripts/check-portfolio-contrast.mjs` | **Đọc thật** `soc.tokens.css`, tách cặp `--pf-*` — không dùng bảng màu tính sẵn |
| theme-contrast | `node scripts/check-theme-contrast.mjs` | Cặp token ghim cứng, cả 2 theme + 2 load variant, WCAG AA |
| focus-ring | `node scripts/check-focus-ring.mjs` | Bắt `focus:outline-none` xoá outline trình duyệt mà không có ring thay thế |
| dom-landmarks | `npm run check:dom-landmarks` | 1 `<main>`/trang, không lồng `<main>`, Shell là region |
| heading-contract | `node scripts/check-heading-contract.mjs` | Page **không tự render `<h1>`** — shell cung cấp 1 `<h1>`/route |
| light-theme | `node scripts/check-light-theme.mjs` | Phủ light theme (override scoped theo property) |
| a11y-runtime | `node scripts/check-a11y-runtime.mjs` | Probe Chromium thật: AX tree, focus ring thật (Tab), đo trang |
| uiux-budget | `node scripts/check-uiux-budget.mjs` | Ngân sách findings — chặn thoái lui, baseline 327 |
| i18n | `npm run i18n:scan:strict` + `npm run check:i18n-hardcoded` | Không string cứng; scope check:i18n-hardcoded chỉ 5 đường công khai (`package.json:33`) |
| visual | `npm run test:visual` (Playwright) | Baseline ảnh — đổi UI chủ động có chủ đích rồi update-snapshot |

## 3. Playbook 3 chạm (tra cứu đúng chỗ, không đoán)

Nguồn chi tiết + bằng chứng: `docs/AUDIT_UIUX_PRO_MAX_SKILL_APPLICABILITY_20261114.md` §H (đã trial thật).

1. **Pattern greenfield** (trang/mặt UI mới): liệt kê cấu trúc sections + vị trí CTA + anti-patterns của loại trang; **đối chiếu 1 page mẫu cùng loại trong repo** trước khi viết. Nếu dùng catalog ngoài (§5) chỉ lấy Pattern/Avoid/Checklist — **bỏ Colors/Typography**.
2. **Tra cứu UX chi tiết** (sửa/đánh giá UI): với mỗi triệu chứng (chip overflow, badge, error summary, focus…) tra rule Do/Don't + severity; quy về checklist §4.
3. **Chọn chart**: tra loại dữ liệu → chart type + a11y fallback + ngưỡng dữ liệu (vd: candlestick → OHLC table fallback, không tin màu một mình, ~500 nến tối đa). **Ranh giới widget:** mọi chart qua `@vninvestcharts/widget` + `chartAdapter.js` (`packages/web/src/adapters/chartAdapter.js`) — không nhúng engine trực tiếp; type contract ở `src/types/vninvestcharts-widget.d.ts`.

Ngoại lệ màu: catalog ngoài trả hex → **chỉ dùng nếu hex đã nằm trong allowlist** `check-tokens.mjs:10-29` (tháng 11-14: palette fintech dark của catalog trùng allowlist vì cùng root Tailwind slate — trùng hợp tốt, không phải quy luật).

## 4. Checklist pre-delivery (mỗi mục = 1 lệnh)

- [ ] Token: `npm run check:tokens` + `node scripts/check-token-conflict.mjs` xanh
- [ ] Contrast: `check:contrast` + `check-portfolio-contrast` + `check-theme-contrast` xanh (cả 2 theme)
- [ ] Focus: `check:focus-ring` xanh; thử Tab thật nếu đụng control mới
- [ ] Landmarks + heading: `check:dom-landmarks` + `check-heading-contract` xanh
- [ ] i18n: `i18n:scan:strict` + `check:i18n-hardcoded` xanh; label tiếng Việt đủ dấu qua `LangContext`
- [ ] Ngân sách: `check-uiux-budget` không tăng findings
- [ ] Visual: `npm run test:visual` — ảnh baseline mới = có chủ đích, ghi lý do
- [ ] A11y runtime (trang lớn/đổi layout): `check-a11y-runtime` (cần Chromium)

## 5. Catalog ngoài (TUỢN CHỌN — chỉ khi Owner đã chốt cài)

`ui-ux-pro-max` v2.15.0 (MIT) — **không bắt buộc**; skill này tự đủ. Nếu đã cài trong repo:

```bash
python .opencode/skills/ui-ux-pro-max/scripts/search.py "<truy vấn ngắn>" --domain <ux|chart|style|icons> --stack react -n 3
```

Luật: luôn `--stack react` (default html-tailwind là SAI); Windows dùng `python`; KHÔNG `--persist` (SSOT kép); KHÔNG lấy màu/font trừ khi hex trong allowlist; chỉ `--design-system` khi greenfield. Không cài trong repo → xem báo cáo `docs/AUDIT_UIUX_PRO_MAX_SKILL_APPLICABILITY_20261114.md` §G-§H trước khi quyết.

## 6. Anti-patterns đã trả giá (từ `docs/LESSONS/`)

| Sai lầm | Quy tắc | Lesson |
|---|---|---|
| Thêm token/class vào `soc.module.css` | Token → tokens.css, class → components.css | L-F03 |
| Kết luận "class không được áp dụng" từ file `.module.css` nguồn | Đọc **CSS đã build** (`packages/web/dist/assets/*.css`, tìm tên hash `_metricCard_<hash>_`, không có chấm) | L-F11 |
| Dán nền cho 1 ô sticky để giữ cột khi cuon ngang | Rút bảng vừa container; nếu phải sticky thì nền ô = nền container (token), không hardcode — dark theme lộ dải trắng | L-F12 |
| Script viết lại khai báo CSS shorthand mất duration/easing | Giữ nguyên `<time> <easing>`; sau khi chạy đếm lại transition thiếu thời gian = 0 | L-F05 |
| Quét a11y theo cửa sổ ±N dòng → false positive | Đọc tay từng candidate trước khi sửa; ghi rõ rule còn nghi ngờ | L-F06 |
| Đổi màu tăng/giảm theo "chuẩn khác" | Việt Nam = Bloomberg: xanh tăng, đỏ giảm. Đổi phải hỏi Owner | L-F08 |
| Bảng màu "tính sẵn" trong gate contrast portfolio | Gate đọc thật `soc.tokens.css` — thêm token mới phải vào cặp của gate | `soc.tokens.css:46-48` |

## 7. Khi nào KHÔNG dùng skill này

- Task không đụng giao diện → chỉ cần `workflow-dev-loop` + `project-lessons`.
- Polish/redesign tổng quát ngoài scope SOC → skill global `impeccable` vẫn có thể bổ trợ; nhưng mọi kết luận về token/gate của vninvest theo skill này.
