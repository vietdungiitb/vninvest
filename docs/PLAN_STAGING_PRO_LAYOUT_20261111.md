# PLAN — Pro layout staging: rightdock + khoảng trống trái + HLOC hover (2026-11-11)

> Lessons áp dụng: [L-001, L-002, L-V01, L-V02, L-G01, L-G02, L-F04, L-T01, L-S01]
> Slice: `staging-pro-layout` · Branch: `feat/staging-pro-layout` -> `dev`

## 1. Hiện trạng đo (ảnh user 21:54, CAR/1d, badge PRO)

- Badge PRO đã lên; paper trade mở (1B VND). 3 lỗi trình bày:
  (a) right dock ẩn (panel hardcode `showDock:false` — `VNStockChartPanel.js:274`,
  comment ghi rõ lý do free-upsell, giờ tier đã pro);
  (b) dải trống hẹp dọc cạnh TRÁI + grip `⋮⋮` giữa cạnh (nghi dock rail collapse —
  CHƯA XÁC MINH, phải đọc DOM thật);
  (c) HLOC không hiện khi hover (nghi statusline/legend — `showLegend` không được
  truyền, CSS `.Gc{display:none}` nhắm hash 0.4.1 trong khi 0.4.4 `.Gc` = order-hint —
  CHƯA XÁC MINH, phải đọc DOM + computed style thật).
- Baseline: `npx tsc --noEmit` exit 0 (sẽ đo lại sau sửa); test S10 xanh.

## 2. SCOPE / LIMIT / non-goals

- Đo: Playwright (chromium local) → `https://docker.edusuccess.vn` (login admin/admin123
  theo tiền lệ Entry 444/445 — staging test) → `/stocks/CAR`: console log + DOM facts
  JSON + screenshot trước/sau hover. Script + ảnh ở `docs/evidence/staging-pro-layout/`
  (ảnh là bằng chứng, được commit).
- Sửa (dự kiến, chốt sau khi có số đo): `showDock` theo tier; rà soát `.Gc` + legend/
  statusline props; CSS dải trái. Fail-before: test S-quét source (pattern S8–S10).
- LIMIT: không đụng engine/widget package; không đụng BE; không secret mới.
- Non-goals: đổi kiến trúc panel; Pine/strategy sâu.

## 3. Nghiệm thu (Given/When/Then)

- G1: Given staging hiện tại, When chạy probe Playwright, Then có screenshot + DOM facts
  (badge text, dock tồn tại/không, statusline text khi hover, element dải trái + width).
- G2: Given số đo, When sửa + deploy staging, Then probe lại: dock hiện khi Pro,
  không còn dải trống >8px, HLOC hiện khi hover (text chứa O/H/L/C hoặc tương đương).
- G3: tsc 0 + test file xanh + gate check-multi-agent PASS; phần nào không chạy được
  ghi CHƯA CHẠY.

## 4. Gates
`check-multi-agent` (PASS trước sửa) · `git diff --numstat` sau mỗi edit ·
`npx tsc --noEmit` · full build local trước khi đưa lên staging · pre-push gate.
Claim → done, ledger, PR merge-commit (Owner merge).
