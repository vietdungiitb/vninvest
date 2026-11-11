# Audit độc lập — PLAN_WIDGET_BUMP_044_20261111.md

- Ngày audit: 2026-11-11 · Auditor: subagent chỉ-đọc (không sửa code, không commit, không install)
- Plan: `docs/PLAN_WIDGET_BUMP_044_20261111.md` (46 dòng, đã đọc toàn bộ)
- Phương pháp: chạy lại từng lệnh/đọc từng file, KHÔNG tin lời plan.

## 1. Registry GH (plan §1 dòng 8-10)

- Lệnh tái hiện: `npm view @vninvestcharts/<pkg> versions --registry=https://npm.pkg.github.com` (+ `npm view @vninvestcharts/widget time ...` cho timestamp)
- `widget` → `[ '0.4.1', '0.4.2', '0.4.3', '0.4.4' ]` — khớp plan. `time['0.4.4'] = '2026-11-11T00:16:58Z'` — khớp từng giây. **PASS**
- `widget-pro` → `[ '0.4.1', '0.4.3' ]`, latest `0.4.3` — khớp plan. **PASS**
- `engine-core` → `[ ..., '0.5.5', '0.5.6' ]`, latest `0.5.6` — khớp plan (`…/0.5.6`). **PASS**
- `engine-drawing` → `[ '0.4.1','0.4.2','0.5.0','0.5.1','0.5.2','0.5.4','0.5.5','0.5.6' ]`, latest `0.5.6` — khớp plan. **PASS**
- `engine-react` → `[ ..., '0.5.5','0.5.6' ]`, latest `0.5.6` — khớp plan. **PASS**

## 2. Pin hiện tại trong package.json (plan §1 dòng 11-12)

- File: `packages/web/package.json:73-75` → engine-core/drawing/react đều `"0.5.5"`; `:108-109` → widget/widget-pro đều `"0.4.1"`. Khớp plan từng dòng. **PASS**

## 3. Tarball widget@0.4.4 tại C:\Temp\wverify044 (plan §1 dòng 13-16)

- Lệnh tái hiện (không ghi file, `node -e` inline, bỏ qua thư mục `dts` khi quét JS, 32 file `.js`):
  `node -e "...walk C:\Temp\wverify044\package\dist, skip dts, count split(needle)..."`
- `dist/dts/widget/adapters/subscriptionTier.d.ts:58` có `fetchSaasBillingTier`, `:70` có `fetchSubscriptionTier` — khớp. **PASS**
- `dist/dts/widget/adapters/licenseActivation.d.ts:34` có `ensureMachineActivationOnce` — khớp. **PASS**
- `dist/dts/widget/VNInvestChartsProps.d.ts:231` → `showLegend?: boolean;` (1 hit) — khớp. **PASS**
- JS runtime (khớp 100% số plan ghi): `billing/subscription` 3 · `/api/v1/activations` 3 · `saas-billing` 3 · `Idempotency-Key` 3 · `showLegend` 18 · `vninvestcharts_widget` 5 (phân bố: `iframe/vninvestchart.iframe.js` + `index.js` + `vninvestchart.iife.js`). **PASS**

## 4. App wiring (plan §1 dòng 17-22)

- `packages/web/src/components/VNStockChartPanel.js:100-101` lazy `import('@vninvestcharts/widget')`; `packages/web/src/pages/watchlist/components/WatchlistDetailPanel.tsx:1,7` import CSS + lazy widget — khớp plan. **PASS**
- Grep `@vninvestcharts/widget-pro` trong `packages/web/src` → **0 hit** (chỉ có `@vninvestcharts/widget` 5 match) — khớp "không ai import". **PASS**
- Tier wiring: `VNStockChartPanel.js:38` (`tier: tierProp = 'free'`) · `:9,:64-65` (`useTenantTier()`) · `:45` + `:290-292` (`licenseKey` prop → forward) · fail-closed đọc thật tại `packages/web/src/adapters/useTenantTier.js:6,24,35-36,63-66` (mọi nhánh lỗi/null → `'free'`, không throw) · test `vnstock-chart-panel.data-unlock.component.test.ts:81-99` cấm `tenantPat`/`registerProExtension`, cho `licenseKey`. Khớp plan. **PASS**

## 5. Lockfile + non-goal (plan §2 dòng 28-31)

- `packages/web/package-lock.json:7114` (`widget` → 0.4.1), `:7148` (`widget-pro` → 0.4.1), top-level engines → 0.5.5; nested stale: `widget/node_modules/engine-core` 0.4.3, `engine-drawing` 0.4.2, `engine-react` 0.4.3. Lockfile **đang chứa version cũ** đúng như dự đoán.
- Plan §2 LIMIT dòng 28-29 ghi rõ "`package-lock.json` KHÔNG sửa trong slice này (deny-list + cần `npm install`, junction dùng chung — phải hỏi trước)" + §3 G3 bắt ghi `CHƯA CHẠY: npm install/build/E2E`. Đã khai báo rõ, không giấu. **PASS** (ghi ở LIMIT thay vì Non-goals — đủ rõ, không trừ điểm)

## Objection (tối đa 3)

1. **(minor) Lý do bump `widget-pro` chưa có bằng chứng.** Plan dòng 18-19 viết "bundle inline widget cũ nếu để lại sẽ lệch" nhưng không trích file:line hay doc nào chứng minh widget-pro inline widget. Bump vẫn vô hại (exact pin, không ai import), nhưng câu này là suy luận chưa verify — nên sửa thành "bump đồng bộ để tránh lệch, chưa verify inline" hoặc bỏ mệnh đề trong ngoặc.
2. **(note, không chặn) Nested engines trong lockfile sẽ càng lệch sau bump.** Sau khi đổi pin mà chưa `npm install`, `package-lock.json` + `node_modules` trên đĩa vẫn ở version cũ (kể cả nested 0.4.x). Plan đã giao việc install cho ticket staging riêng (G3) — chấp nhận được, chỉ lưu ý executor G2 `tsc` sẽ chạy against type cũ cho tới khi install xong, baseline đo trước edit là bắt buộc (plan đã ghi).
3. **Không có.** Mọi số liệu đếm được (version, timestamp, hit count, line ref) đều khớp 100%; không tìm thêm mâu thuẫn.

## Verdict cuối: PASS

Plan trung thực — toàn bộ khẳng định kiểm chứng được đều đúng từng con số. Objection #1 là minor wording, sửa 1 câu khi thực thi, không cần revise plan. Cho phép tiến hành slice `widget-bump-044` theo đúng LIMIT đã ghi (không đụng lockfile, không báo PASS giả cho install/build/E2E).
