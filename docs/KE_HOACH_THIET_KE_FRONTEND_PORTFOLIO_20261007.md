# KẾ HOẠCH THIẾT KẾ FRONTEND PORTFOLIO — v3 (SAU AUDIT ĐỘC LẬP)

> **v3 thay thế v2.** v2 (`420449cb2`) bị audit độc lập trả `NEED_REVISION`:
> **7 blocker · 14 major · confidence high**.
> Quyết định Owner: chỉ **read-side** 5 trang; live trading ngoài phạm vi (chưa có broker API key).
> Merge thẳng `dev`, **không dùng GitHub CI**. Widget **giữ nguyên 1.2.5**.
>
> Nguyên tắc bắt buộc của v3: **không có khẳng định nào không kèm lệnh tái tạo.**
> Mọi con số trong tài liệu này đã chạy thật trên `dev` sạch.

---

## 0. AUDIT ĐÃ BẮT ĐƯỢC GÌ (và cái nó BỎ SÓT)

### 0.1 Bằng chứng tôi tự chạy lại (không tin báo cáo agent)

```bash
# 1. Widget export surface — BLOCKER GỐC, cả plan LẪN audit đều bỏ sót
node --input-type=module -e "import('./packages/web/node_modules/vninvestcharts-widget/dist/index.js').then(m=>console.log(Object.keys(m).length))"
# → 29
node --input-type=module -e "import('./packages/web/node_modules/vninvestcharts-widget/dist/index.js').then(m=>console.log(Object.keys(m).join(',')))"
# → BaseAdapter,DjangoVnstockAdapter,MeasurementOverlay,MockAdapter,PaperTradePanel,
#   SettingsModal,UDFDataAdapter,VNInvestCharts,VNInvestMultiCharts,WidgetEmptyState,
#   WidgetErrorBoundary,WidgetI18nContext,WidgetI18nProvider,WorkspaceSerializer,
#   createLocalStorageAdapter,createMockBars,createRestAdapter,evaluateRuntimePolicy,
#   getIndicator,injectVNInvestChartsCSS,isDrawingToolName,listDrawingTools,
#   registerIndicator,resolveRequestedRuntime,shouldForceLegacyRuntime,useWidgetI18n,
#   version,widgetMessagesEn,widgetMessagesVi
```

**KHÔNG CÓ** `Line` · `Area` · `Bar` · `Comparison` · `Treemap` · `Sunburst` · `Donut`.

| Claim của plan v2 | Thực tế | Bằng chứng |
|---|---|---|
| T1 "map NAV vào field `close` của series `Line`/`Area`" | **API không tồn tại.** `registerSeries("Comparison", {component: () => null})` ở `dist/index.js:19271` là **registry nội bộ của engine**, không phải export cho app | lệnh trên |
| T2/T3 dùng `Comparison` để vẽ benchmark | Không import được | lệnh trên |
| S-07 R1 "widget không có Treemap/Sunburst → dùng ECharts" | Đúng, nhưng kết luận sai: widget **cũng không có** chart time-series nào | lệnh trên |
| T6 "ECharts **chỉ** cho treemap" | Sai — ECharts phải dùng cho **mọi** chart portfolio | xem D1 |

> **Đây là hazard 7 (claim ownership bằng đọc, không compute) lặp lần 2.**
> Cả plan lẫn audit đều đọc *tên* trong bundle rồi kết luận *API tồn tại*.
> Cách đúng: liệt kê `Object.keys(module)` — export surface thật.

### 0.2 Các blocker audit bắt được — tôi đã verify lại, đều ĐÚNG

```bash
# B1: /analytics/ chỉ trả summary
sed -n '471,474p' packages/core/backend/src/user_workspace/portfolio_analytics_views.py
#   return envelope({'summary': inner_payload(summary_body),
#                    'note': 'full_analytics_available_via_sub_endpoints'}, ...)

# B2: metric không tồn tại
grep -c sharpe  packages/core/backend/src/user_workspace/**/*.py   # 2 — CẢ HAI LÀ COMMENT
grep -c sortino packages/core/backend/src/user_workspace/**/*.py   # 0
grep -c correlation packages/core/backend/src/user_workspace/**/*.py # 0
# risk_metrics trả đúng 4 key (analytics.py:346-349): volatility, var_95_daily, max_drawdown, concentration

# B3: holdings/allocation không có sector
sed -n '180,191p' portfolio_analytics_views.py   # symbol,quantity,avg_cost,current_price,
                                                  # market_value,unrealized_pnl,unrealized_pnl_pct,
                                                  # price_missing_reason,stale  → THIẾU name,weight,sector,24h%
sed -n '449,453p' portfolio_analytics_views.py   # symbol,value,weight_pct → THIẾU sector

# B4: hardcode:scan không tồn tại
node -e "console.log(require('./package.json').scripts['hardcode:scan']??'KHONG TON TAI')"   # packages/web
# B6: manage.py path
Test-Path packages/core/backend/manage.py      # True
Test-Path packages/core/backend/src/manage.py  # False
```

### 0.3 Baseline BE thật — hazard 6 nặng nhất

```bash
docker exec vninvest-dev-core-api sh -lc "cd /app/src && python manage.py test 2>&1 | tail -25"
```
```
Ran 2180 tests in 826.244s
FAILED (failures=19, errors=17, skipped=6)
```

| Nguồn | Ghi | Đúng? |
|---|---|---|
| plan v2 `:165` | "679/679 OK" | ❌ SAI |
| `AGENTS.md:58` | "602 test — failures=10, errors=3" | ❌ STALE |
| `docs/OPEN_WORK_20260927.md:53,412` | "602 test — failures=10, errors=3" | ❌ STALE |
| **đo thật 2026-10-07** | **2180 test — 19F + 17E + 6S** | ✅ |

⇒ **GT9 KHÔNG BAO GIỜ xanh được.** Tiêu chí đúng là **delta = 0**, không phải "0 lỗi".
Bằng chứng: `docs/evidence/portfolio-fe/GT9-baseline.txt`.

### 0.4 Baseline FE (đo trên `dev` sạch, `5e1a0da16`)

| Gate | Lệnh | Exit |
|---|---|---|
| GT1 | `npx tsc --noEmit` | **0** |
| GT3 | `npm run lint` | **0** (0 errors, 3569 warnings) |
| — | `npm run check:contrast` | 0 ⚠️ **giả** — xem M1 |
| — | `npm run check:tokens` | 0 ⚠️ roots không gồm `src/styles` — xem M2 |
| — | `npm run check:i18n-hardcoded` | 0 |
| GT11 | `node scripts/check-multi-agent.mjs` | 0 (+18 warning) |
| GT5b | `npm run hardcode:scan` | **1 — KHÔNG TỒN TẠI** |
| GT12 | axe | **không công cụ** |

---

## 1. 8 QUYẾT ĐỊNH MỚI (thay đổi kiến trúc so với v2)

| # | Quyết định | Lý do (bằng chứng) |
|---|---|---|
| **D1** | **ECharts cho TẤT CẢ chart portfolio** (line/area/bar/treemap/pie). Bỏ hoàn toàn widget khỏi phạm vi portfolio | Widget không có series API (§0.1). `echarts ^6.0.0` + `echarts-for-react ^3.0.6` **đã là dependency**, có sẵn pattern tree-shake tại `packages/web/src/components/WhaleBubbleChart.jsx:17` (`echarts-for-react/lib/core`). **Không thêm dependency mới** |
| **D2** | Thêm endpoint metrics thật (S-00b) | `risk_metrics`/`benchmark_metrics`/`performance` đã **có sẵn code**, chỉ thiếu route. Dùng lại code chết, không viết lại |
| **D3** | Bổ sung `company_name`/`industry`/`weight`/`24h%` (S-00c) | Nguồn thật: `StockProfile.company_name` (`market_data/models.py:32`), `StockProfile.industry` = "Ngành" (`:40`), `SymbolSnapshot.price_change_pct` (`user_workspace/models.py`) |
| **D4** | Sửa 6 gate chết trước khi code (S-00d) | `hardcode:scan` không tồn tại; `manage.py` sai path; không có axe. Đòi PASS từ gate chết = tiêu chí không thi hành được |
| **D5** | GT9 = **delta 0 so baseline 2180/19F/17E** | §0.3 |
| **D6** | Thay `check:contrast` bằng script **đọc file token thật** | `check-contrast.mjs:26-34` là mảng 7 cặp tĩnh, **không đọc file nào**. Xoá sạch palette portfolio vẫn PASS |
| **D7** | Metric không có → trả `null` + `reason_code`, **không** bịa số | `sharpe`/`sortino`/`correlation` không tồn tại (§0.2 B2). R8 của v2 "số thiếu ⇒ `—`" đã che lỗi |
| **D8** | Widget giữ nguyên **1.2.5**, **không nâng 1.4.0** | Không còn dùng cho portfolio. Stock detail giữ nguyên. Hủy D-32 (`[S3]:79`) — **ghi rõ waiver** |

---

## 2. RE-SLICE: 12 slice → 17 slice

```
W0  chặn tất cả   S-00e ✅ XONG (đo baseline) · S-00d (sửa 6 gate chết) · S-00a (3 route)
W1  chặn data     S-00b (metrics endpoint) · S-00c (sector/name/weight/24h%)
W2  nền tảng FE   S-01 (token) · S-01b (contrast script thật) · S-02 (adapter+hook+facade)
W3  khung          S-03 (chart contract ECharts) · S-04 (shell)
W4  5 trang        S-05 Overview · S-06 Holdings · S-07 Allocation · S-08 Analytics · S-09 Activity
W5  bàn giao       S-10 (i18n+a11y+responsive) · S-11 (routeCatalog + evidence + nghiệm thu)
```

| Slice | Nội dung | ed | Phụ thuộc | Đóng blocker nào |
|---|---|---|---|---|
| **S-00e** | Đo baseline BE thật | **0.5** | — | ✅ **XONG** |
| **S-00a** | Mở 3 route `equity-curve`/`allocation`/`chart` | 0.5 | — | plan v2 S-00 |
| **S-00b** | Wire `performance`/`risk_metrics`/`benchmark_metrics`/`freshness` vào `GET /analytics/metrics/` | 4 | S-00a | B1, B2 |
| **S-00c** | Thêm `company_name`/`industry`/`weight`/`24h%` vào holdings + allocation | 2.5 | — | B3 |
| **S-00d** | Viết `hardcode:scan` thật · sửa `manage.py` path trong docs · cài `@axe-core/playwright` + spec axe | 1.5 | — | B4, B5, B6 |
| **S-01** | Token vào `src/components/soc/soc.tokens.css` + class vào `soc.components.css` (**KHÔNG** tạo `src/styles/`) | 3 | — | M2, M3 |
| **S-01b** | Script contrast **đọc token file thật**, đo 4 màu tài chính × 2 theme | 1 | S-01 | M1, D6 |
| **S-02** | `adapters/core/portfolio.js` + `hooks/usePortfolioWorkspace.ts` + **wire `coreApiAdapter.js`** (import + spread tường minh) | 2.5 | S-01 | M4 |
| **S-03** | Chart contract ECharts — type thật, `echarts-for-react/lib/core`, register 4 option-builder | 2 | S-02 | **B-GỐC**, M5, m3 |
| **S-04** | Workspace shell + 4 component dùng chung | 3 | S-02 | — |
| **S-05** | Trang Overview | 4 | S-03, S-04, S-00b | B2 |
| **S-06** | Trang Holdings 13 cột | 4 | S-04, S-00c | B3 |
| **S-07** | Trang Allocation | 3 | S-04, S-00a, S-00c | B3 |
| **S-08** | Trang Analytics | 4 | S-03, S-04, S-00b | B1, M12 |
| **S-09** | Trang Activity timeline | 3 | S-04 | M11, C25 |
| **S-10** | i18n (namespace **greenfield**) + a11y + responsive | 3 | S-05..S-09 | M10, M13 |
| **S-11** | 5 route `routeCatalog.js` (8 field, 5 capability, 5 titleKey) + evidence pack | 1 | S-05..S-09 | M14 |

**Tổng: ~43.5 ed** (v2 khai 33 — sai; thực bảng cộng 34.5, vẫn thiếu 6 ed bị giấu ở B1/B3/B4–B7).

---

## 3. GATE ĐÃ SỬA (v2 đòi 6/15 gate không chạy được)

| Gate | v2 nói | v3 nói | Lệnh thật |
|---|---|---|---|
| GT5 | `npm run hardcode:scan` | script mới (S-00d) | `npm run check:hardcoded` |
| GT6 | `python src/manage.py check` | `python packages/core/backend/manage.py check` | sửa path |
| GT7 | `makemigrations --check --dry-run` | như trên + **đọc head trên `dev`**, không đọc trong worktree | |
| GT8 | `migrate` | `docker exec vninvest-dev-core-api sh -lc "cd /app/src && python manage.py migrate"` | |
| GT9 | "0 failure, 0 error" | **delta = 0 vs baseline 2180/19F/17E/6S** | `docker exec ... python manage.py test` |
| GT12 | axe | `@axe-core/playwright` (cài ở S-00d) | spec axe 5 trang |
| — | `check:contrast` | script S-01b **đọc file thật** | `node scripts/check-portfolio-contrast.mjs` |
| GT5a | `i18n:scan` exit 0 | **không đáng tin** (exit 0 vô điều kiện) → thay bằng đếm parity bằng script | script mới |

---

## 4. NON-GOALS (không làm)

- ❌ Live trading / broker order — chưa có API key
- ❌ Nâng widget lên 1.4.0 (D8, có waiver)
- ❌ Sửa 36 lỗi BE nền (19F+17E) — ngoài phạm vi, đã báo cáo
- ❌ Thêm dependency mới — D1 dùng `echarts` đã có sẵn
- ❌ Migration mới — `StockProfile`/`SymbolSnapshot` đã có đủ field
- ❌ Sửa `package.json` / lock file (deny-list)
- ❌ Viết `src/styles/portfolio-tokens.css` — token vào `soc.tokens.css`

---

## 5. ĐIỀU KIỆN BÀN GIAO

1. GT1/GT2/GT3 exit 0 · GT4 `test:components` xanh **3 lần liên tiếp** (D-19)
2. GT9 **delta = 0** so baseline
3. 12/12 gate có lệnh thật và chạy được, hoặc ghi `CHƯA CHẠY` + lý do
4. Mọi chart **đọc được giá trị thật từ chart** — không tin "build pass"
5. Mọi metric thiếu → `null` + `reason_code`, **không** bịa số
6. `docs/evidence/portfolio-fe/S-NN/` cho từng slice: `gates.md`, `ac-checklist.md`, `commands.txt`
7. `AUDIT_PORTFOLIO_FE.md`: 0 blocker + 0 major, `confidence: high`
8. `TEST_REPORT.md`: mọi dòng `Pass` hoặc `CHƯA CHẠY` có lý do
9. Kiểm tra contrast **trên token file thật**
10. Ledger append Entry cuối cùng

---

## 6. WAIVER (ghi rõ người + lý do)

| Mục | Người waive | Lý do | Rủi ro còn lại |
|---|---|---|---|
| D-32 (nâng widget 1.4.0) | **Owner** (quyết định 2026-10-07) | Widget không dùng cho portfolio sau D1 | Stock detail vẫn trên 1.2.5 |
| 36 lỗi BE nền | **Owner** | Ngoài phạm vi kế hoạch FE | Đã lưu `GT9-baseline.txt`, delta gate chặn hồi quy |
| `sector` rỗng khi `StockProfile` chưa có row | S-00c | Data chưa backfill | UI hiện "Chưa phân ngành" + `reason_code` |
