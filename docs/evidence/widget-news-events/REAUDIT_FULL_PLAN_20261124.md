# Re-audit toàn diện plan adjusted-price (2026-11-24)

> Auditor độc lập phiên MỚI, chỉ đọc, tự mở source cả 2 repo — **không dùng bảng §0 của plan làm ground truth**.
> Owner yêu cầu: "reaudit lại toàn bộ plan để xác định các nguyên nhân block trước khi tiếp tục".
> Verdict: **NEED_REVISION ở mức quay lại bản thiết kế**, không phải vá O6 rồi audit vòng 4.

## A. BLOCKER / MAJOR (11 cái)

| # | Mức | file:line | Lý do |
|---|---|---|---|
| B1 | 🔴 | `VNStockChartPanel.js:455` ← `:200-205`; `useWidgetData.ts:179`; `chartAdapter.js:42-54,94-102` | **Sửa nhầm lớp.** Host truyền `adapter`; `VNInvestClient.normalizeChartPoint:152-168` không nằm trên đường production (chỉ demo import). Chain ở plan §0:17 sai từ mắt xích giữa. Type cần mở rộng là `OHLCVBar`, không phải `ChartPoint`. |
| B2 | 🔴 | `useWidgetData.ts:1144→1155` (MTF), `:1243/:1255→1271` (compare), `:1310-1311` | MTF/compare bars đi thẳng từ `coordinatedFetch` vào state riêng, **không qua `setBars`**. Transform trong wrapper chỉ chỉnh primary → trộn 2 hệ giá. |
| B3 | 🟠 | `useWidgetData.ts:926-936`, store writes `:770,814,876,936`, `:550,558` | Live tick append bar thô vào store dùng chung. Phải ghi bất biến **store raw / state adjusted**, tránh double-transform. |
| B4 | 🔴 | `useWidgetData.ts:45-104`; `VNInvestChartsProps.ts:60`; `widgetHelpers.ts:225` | Prop `priceAdjustmentMode` không có trong §3 phạm vi file ⇒ `tsc` đỏ. Có 2 bản props trùng tên. |
| B5 | 🟠 | `VNInvestCharts.tsx:1011-1023`; `enrichDataWithCanonicalStore.ts:163-170`; `calculators/types.ts:1-8`; `chartCsv.ts:84,111` | `RawOHLCV`/`EnrichedDatum` không khai báo `adjClose` ⇒ lỗi TS; plan chỉ ghi "CSV adjClose thật" không có type change + AC. |
| B6 | 🔴 | `market.js:238-247`; `chartAdapter.js:96,108`; `PortfolioHeatmap.js:424`; `stock_mgmt_native_views.py:4241-4269` | Đổi drop-in `/chart/` → `/bars/` **vỡ contract**: `/chart/` nhận `days`, `/bars/` nhận `from/to` hoặc `before/limit`. Cần method mới. `adj_close` chỉ có khi flag bật — production chưa xác nhận. |
| B7 | 🔴 | `packages/web/package.json:107`; widget `package.json:3`; ledger `ddc947dd` | `npm pack` thiếu toolchain: source commit, build script, đổi tên `-ent`, verify export enterprise. Sai ⇒ tái phát lỗi badge FREE. |
| B8 | 🔴 | `task3-gates.md:5`; `staging-fe-local-packages.md:5-8` | `npm ci` kẹt **E401 GITHUB_TOKEN** `@vninvestcharts/engine-react@0.5.8`. Gate §5 như viết **chạy không được**. |
| B9 | 🟠 | `useWidgetData.ts:254-263` nhánh `:255-257` | Functional-update `_setBars(next)` lọt qua mọi transform — plan không xử lý/assert. |
| B10 | 🟠 | `ForkEngineSurface.tsx:147-149`; `adjustment.py:52` | `usedAdjustedBars = "≥1 bar có adjClose"` ≠ "bar thực sự được adjust" khi guard từ chối factor. |
| B11 | 🟡 | plan §0:21 | `AUDIT_PLAN_CA_NOOP_20261123.md` **không tồn tại trên `dev`** — file nằm trên branch `feat/ca-parser` (đã push, chưa merge). Tiền đề không kiểm chứng được trên nhánh hiện tại. |

## B. NGUYÊN NHÂN GỐC của chuỗi 3 vòng block
1. **Lỗi plan (~40%)**: viết theo tên file gợi ý, không theo import/call graph. §0:17 liệt kê chain sai ngay mắt xích giữa. B1/B4/B6 là hệ quả.
2. **Lỗi phương pháp audit (~40%)**: mỗi vòng chỉ truy objection vòng trước, cả 3 vòng dùng lại bảng §0 làm ground truth; không quét ngang fan-out (primary / MTF / compare / live tick / cache / CSV / engine snapshot) ⇒ B1, B2 lọt qua.
3. **Bản chất + thiếu quyết định (~20%)**: 2 repo, 3 lớp, deny-list tarball, 5 câu §6 chưa chốt ⇒ gộp quá nhiều slice vào 1 artifact.

⇒ **Không phải "cần vòng 4"** — cần viết lại plan từ đầu với **bảng fan-out nguồn bar** có file:line.

## C. Phân loại câu hỏi owner (§6)
- Không chặn: volume giữ nguyên (reservation turnover), `stock_ratio_pct` âm (đã có guard `adjustment.py:45-52`; chỉ sửa citation).
- Chặn nghiệm thu: drawings toạ độ giá thô — chốt convert hay cảnh báo.
- Chặn rollout: default mode/copy — giữ `'raw'`; cấm text "Adjusted"/"Đã điều chỉnh" (test anti-fake `ChartStatusLine.adjusted.test.tsx:54-63`).
- **CHẶN**: rebuild tarball (B7) + token/E401 (B8) + deny-list `package.json`/lock cần coordinator + `Claim-Deny-List:` + regen lock bằng `npm install --package-lock-only` (ledger Entry 409).

## D. Khuyến nghị — thu hẹp scope, chia slice theo ranh giới repo
- **A1 (host-only, không rebuild tarball)**: `chartAdapter.js:42-54` giữ `adj_close` + method mới gọi `/bars/` (`from/to`, `before/limit`) song song `/chart/`. Verify curl + unit test.
- **A2 (widget, CSV)**: `VNInvestCharts.tsx:1011-1023` đọc `d.adjClose` + mở rộng `RawOHLCV`/`EnrichedDatum`, rewrite nhánh dương tính test. Làm sau khi B7/B8 đóng.
- **B (transform)**: pure fn `applyPriceAdjustment(bars, mode)` + control biết đáp án, gọi ở 3 điểm (`setBars:254`, `setMtfBarsByTimeframe:1155`, `setCompareBars:1271`) hoặc dời lên `coordinatedFetch:210-243` + live tick `:926`. Bất biến store raw / state adjusted, default `'raw'`.
- **C (badge)**: sau A/B, đổi `usedAdjustedBars` = "bar thực sự transform" rồi mới sửa `ForkEngineSurface.tsx:147-149`.

Điều kiện audit sau không lặp: fan-out table từng nguồn bar; auditor đổi người, không tin §0; mỗi slice ≤ 1 repo, claim riêng; owner chốt tarball/token trước A2.
