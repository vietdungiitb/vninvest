# AUDIT KẾ HOẠCH — UI/UX remediation (2026-10-30)

> **Loại:** audit độc lập (chỉ đọc). **Auditor:** subagent (session `ses_e7504d9d6ffeaUACwyHgN3KxV8`).
> **Đối tượng:** `docs/PLAN_UIUX_REMEDIATION_20261030.md` (430 dòng, PROPOSED).
> **Ngày:** 2026-10-30. **Verdict:** **AGREE** (3 objection nhỏ, không blocker).

## Kết quả kiểm chứng 12 citation

| # | Citation | Verdict | Bằng chứng |
|---|---|---|---|
| a | `VNStockChartPanel.js:54` dynamic + `:1` css | ĐÚNG | L54 `import('vninvestcharts-widget')`; L1 import css tĩnh |
| b | `dist/index.html` preload i18n không widget | **CHƯA XÁC MINH** — không có `dist/` trong tree. Plan tự nói build chưa chạy | Hạ cấp claim → "audit-reported, verify ở C1" |
| c | `FullLayout.tsx:89-103` Outlet trong main | ĐÚNG | L89-103 `<main id="main-content">` bọc `Outlet` L102 |
| d | `PageErrorBoundary.tsx:30` log "[StockDetailPage]" | ĐÚNG | L30 `console.error("[StockDetailPage]", …)` |
| e | `PaymentReturnPage.tsx:4-31` custom useI18n | ĐÚNG | L4-31 tự định nghĩa |
| f | `AuthLoginPage.tsx:129,141` nested main | ĐÚNG số dòng, **nuance**: hai nhánh `createElement("main")` có điều kiện (session-check vs form), không lồng thật sự | Sửa từ "nested" → "hai nhánh main" |
| g | `SocSchedulerBoard.tsx:366` aria-label "Close" | ĐÚNG | L366 `"aria-label": "Close"` |
| h | `soc.tokens.css:125-126` --vnb-tile-min/kpi-min | ĐÚNG | L125-126 đúng |
| i | `UserSettingsPage` 208-209, 109, `main.tsx` 263-267 | ĐÚNG | option L208-209; fallback L109; boot L263-267 |
| j | `package.json:33` chỉ 5 path | ĐÚNG | L33 đúng 5 |
| k | `check-tokens.mjs` không strip comment; 6 hex trong comment | ĐÚNG | gate không strip; L4454/4482 xác nhận. Tổng thực: 5 occurrences code (4 unique) + 6 hex trong comment = 155 thật / 161 thô |
| l | `light-theme.css` sinh bởi `--update` | ĐÚNG | script ghi file; header "auto-generated" |

## Đếm lại

- Page prod: **91** (86 `.tsx` + 5 `.js`, loại tests) — ĐÚNG.
- File không có `t(`: **18** (13 page thật, 5 helper) — ĐÚNG.
- `PageErrorBoundary` được dùng ở **3 page** (AlertCenter, Dashboard, StockDetail) — ĐÚNG.

## Tính khả thi slice rủi ro

- **A1 (token gate):** khả thi. `check-tokens.mjs` đã skip `tokens.css`; thêm `light-theme.css`. statusBadge block L4379-4396 có 5 occurrences (4 unique) → map `--pf-*`/`--soc-status-*` hoặc xoá nếu D1=(b).
- **B1 (error boundary ở layout):** khả thi. `FullLayout` chưa import `useLocation` — cần thêm import.
- **C2 (defer chart):** khả thi, rủi ro thấp — widget đã `import()` động L54; còn lại IntersectionObserver ở 4 điểm gọi + tách import CSS tĩnh.

## Tuân thủ quy tắc repo

- `soc.module.css` là barrel 3 dòng (đúng, không token/class) ✓
- Không đổi màu tăng/giảm ✓
- Không sửa file deny-list trong slice FE (đã tránh `package.json` qua pre-push-gate) ✓
- Gate `CHƯA CHẠY` được ghi rõ ✓

## 3 objection (đã xử lý trong plan sau audit này)

1. **(b) unverifiable in-repo:** `dist/` không tồn tại. Hạ cấp claim trong §2 baseline và §3 errata từ "đã verify" → "audit-reported, verify ở C1". Plan đã cập nhật.
2. **(f) wording overstated:** `AuthLoginPage` L129/L141 là hai nhánh điều kiện, không phải nested `<main>`. Sửa từ "nested `<main>`" → "hai nhánh `<main>` có điều kiện (L129 session-check, L141 form)". Plan đã cập nhật.
3. **(k) đếm chưa khớp:** 11 raw violations trong `soc.components.css` = 5 occurrences code (4 unique) + 6 hex trong comment (gate bug). Plan đã ghi rõ "5 occurrences (4 unique)" trong A1 và thêm bước strip comment.

## Kết luận

Plan **đủ chính xác để làm bản đồ vấn đề và cơ sở slice**. Chưa đủ để làm acceptance criteria nguyên văn cho tới khi:
- chạy `npm run build` (C1) để có dist/index.html thật;
- Owner chốt D1 (light theme a/b) trước A2;
- audit độc lập (B3) đã được ghi thành file (file này).

Không có objection nào chặn Phase 0 (đóng gói audit) hoặc A1 (token gate).

*Auditor: subagent ses_e7504d9d6ffeaUACwyHgN3KxV8 — chỉ đọc, không sửa file.*