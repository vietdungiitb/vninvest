# PLAN — Convert chart widget từ Free sang Enterprise bằng cơ chế demo của `charts.edusuccess.vn`

> **Ngày:** 2026-11-22 · **Trạng thái:** KHẢO SÁT + KẾ HOẠCH, chưa implement.
> **Người yêu cầu:** Owner · **Phạm vi:** `packages/web` (FE) + hạ tầng staging + đối chiếu 3 repo anh em
> (`vninvestcharts-widget`, `vninvestcharts-engine`, `vnsaas`).
> **Nguyên tắc chỉ đạo:** *cái gì widget đã cung cấp thì dùng widget, không viết riêng.*
> **Lessons áp dụng:** [L-V01, L-V02, L-V05, L-F01, L-F02, L-F12, L-T01, L-T02].
>
> Quy ước bằng chứng: mọi khẳng định kèm `file:line`; chưa chạy/đọc được → ghi **CHƯA XÁC MINH**,
> không suy diễn. Đường dẫn `W:` = `D:\Mujoco Projects\vninvestcharts-widget`, `E:` =
> `D:\Mujoco Projects\vninvestcharts-engine`, `S:` = `D:\Mujoco Projects\vnsaas`.

---

## 0. Kết luận 1 trang

1. **Tiền đề cần đính chính.** Dự án không bị "thiếu tính năng enterprise" trong source widget.
   Widget public đã chứa toàn bộ matrix tier, kể cả 13 capability enterprise
   (`E:packages/vn-kline-engine-core/src/capabilities.ts:219-230`). Badge **FREE** trên staging là
   do **phân giải tier thất bại**, không do cài nhầm package free: license key hết hạn 18/11/2026
   (`docs/evidence/widget-license-verify/verify-20261111.md:80`) + `/billing/subscription` trả 404
   (`docs/CODE_CHANGE_AUDIT_LEDGER.md:1641` theo agent khảo sát) ⇒ `verifyLicenseKey` trả `null`
   rồi fallback `free` (`packages/web/src/components/VNStockChartPanel.js:81-87,101-113`;
   `packages/web/src/adapters/useTenantTier.js:55-68`).

2. **"Tài khoản demo" KHÔNG phải tài khoản đăng nhập.** Nó là bộ 3: tenant SaaS `widget-demo`
   (tier `enterprise`) + **PAT server-only** + endpoint same-origin `/api/v1/entitlement` do nginx
   proxy tới `saas.edusuccess.vn` (`W:docs/evidence/DEMO-ENTERPRISE-ENTITLEMENT_2026-11-19.md:8-22`;
   `W:deploy/nginx-app.conf:151-168`). Blob `vni1.*` demo bị **domain-bound tới
   `charts.edusuccess.vn`** (`S:packages/core/backend/src/license/views_demo.py:52,63-64,126`;
   `S:.../license/views.py:71-77`) ⇒ **không dùng được cho `docker.edusuccess.vn`**. Tên miền đúng
   là `charts.edusuccess.vn` (số nhiều); `chart.edusuccess.vn` không tồn tại (probe 22/11/2026 trả
   transport error).

3. **Chặn cứng: bản cài đã lùi hơn bản demo 3 patch.** Repo khóa `@vninvestcharts/widget@0.4.4`,
   `@vninvestcharts/widget-pro@0.4.4` (`packages/web/package.json:73-75,107-108`; verify node local
   cùng version). Site demo chạy **0.4.7**, commit `ddc947dd` (`GET https://charts.edusuccess.vn/health.json`,
   22/11/2026). Quét 721 file trong `node_modules/@vninvestcharts/widget/dist` cho kết quả
   **0 hit** với `/api/v1/entitlement`, `enterpriseBinding`, `fetchWhaleCampaigns`,
   `EnterpriseDockProvider`, `fetchOrderbookDepth` (lệnh tái hiện ở §9). ⇒ **không thể convert chỉ
   bằng đổi credential**; bắt buộc nâng build/widget.

4. **Offline license chỉ tới `pro`.** Owner chốt Q8: tier `enterprise` chỉ cấp khi có PAT SaaS /
   server entitlement online (`W:docs/upgrade-standard/plans/MASTERPLAN_ENTERPRISE_DELIVERY_2026-11-14.md:24,179`).
   Vì vậy Path B (mint blob `vni1.*` không domain-bound qua `POST /api/v1/licenses`,
   `S:.../license/views.py:157-319`) chỉ là **fallback Pro**, không đạt yêu cầu "enterprise".

5. **Khuyến nghị:** đi **Path A** — nhân cơ chế entitlement của demo sang staging
   (`docker.edusuccess.vn`): nâng widget build ≥ 0.4.6, nginx proxy `/api/v1/entitlement` với PAT
   server-only, credential **không** đi URL/`?pat=`, không dùng blob demo. Sau đó mới thay code tự
   vẽ bằng capability enterprise (whale, portfolio, orderbook, workspace).

6. **Quyết định Owner cần chốt trước khi code:** D1–D7 ở §7. Đặc biệt D2 (nguồn build widget —
   registry GitHub Packages trả **401** khi không có `GITHUB_TOKEN`, đã chạy thật 22/11/2026) và
   D6 (Owner từng chốt "dừng ở Wave 0" của `docs/PLAN_WIDGET_FEATURE_LEVERAGE_20261112.md:224-232`;
   yêu cầu hiện tại được hiểu là mở lại, cần xác nhận).

---

## 1. Phạm vi, phương pháp, nguồn đã đọc

- Đọc 3 báo cáo subagent khảo sát độc lập (widget repo / code vninvest / vnsaas) ngày 22/11/2026,
  sau đó **tự kiểm chứng lại các con số load-bearing** theo L-V02 (không tin claim kế thừa).
- Kiểm chứng trực tiếp: version trong `node_modules`, số file/lần hit trong `dist`, nội dung
  `health.json` live, tồn tại của mọi file được trích dẫn, registry `npm view` (401).
- Không đọc/sửa secret thật. Không ghi giá trị PAT/key vào tài liệu — chỉ serial/đường dẫn.
- Không chạy E2E trình duyệt trong phiên này ⇒ trạng thái runtime staging hiện tại ghi
  **CHƯA XÁC MINH** (chỉ có bằng chứng lịch sử 11–20/11).

### 1.1 Bảng nguồn chính

| Nguồn | Nội dung | Đường dẫn |
|---|---|---|
| Code vninvest | Wrapper chart, tier, props, CSS hack | `packages/web/src/components/VNStockChartPanel.js`, `.../VNStockChartPanel.css`, `packages/web/src/adapters/useTenantTier.js` |
| Bằng chứng staging | Demo site PRO/FREE, key hết hạn | `docs/evidence/staging-pro-layout/demo-facts.json:2-21`, `docs/evidence/widget-license-verify/verify-20261111.md` |
| Gap report | 3 kênh tier, blocker kid/product/contract | `docs/REPORT_WIDGET_PRO_ENTERPRISE_GAPS_20261110.md:8-16,20-40,58-62` |
| Plan FE cũ | 12 slice leverage, Wave 0 đã merge | `docs/PLAN_WIDGET_FEATURE_LEVERAGE_20261112.md:9,17-49,160-188,224-238` |
| Spec backend B-1..B-6 | 13 capability + contract demo | `docs/BACKEND_VNINVEST_ENTERPRISE_DEMO_SPEC_2026-11-12.md:14-35,145-159` |
| Widget repo | Matrix tier, demo entitlement, deploy | `W:src/widget/contexts/SaaSFeatureContext.tsx`, `E:packages/vn-kline-engine-core/src/capabilities.ts`, `W:deploy/CHARTS-TEST.md`, `W:docs/evidence/DEMO-ENTERPRISE-ENTITLEMENT_2026-11-19.md` |
| vnsaas | Endpoint demo/license/JWK/activation | `S:packages/core/backend/src/license/views_demo.py`, `S:.../license/views.py`, `S:.../license/signing.py` |

---

## 2. Hiện trạng đã verify

### 2.1 Version / package

| Thành phần | Repo khóa | Site demo | Bằng chứng |
|---|---|---|---|
| `@vninvestcharts/widget` | **0.4.4** | **0.4.7** | `packages/web/package.json:107`; `W:package.json:3`; `/health.json` 22/11 |
| `@vninvestcharts/widget-pro` | **0.4.4** | không cần (demo dùng build tĩnh) | `packages/web/package.json:108`; `W:deploy/docker-compose.charts-test.yml:25-61` |
| `engine-core / drawing / react` | 0.5.6 | `^0.5.8` ở source | `packages/web/package.json:73-75`; `W:package.json:190` |
| `engine-pro` | 0.4.1 | 0.5.2 (master plan) | verify node local; `W:…MASTERPLAN…:141` |
| Release manifest widget source | — | 0.4.6 @ `0e7c65c9` | `W:release-manifest.json:3-4` |

`W3-RELEASE-PUBLIC` bị **DEFERRED** (`W:…MASTERPLAN…:138,295,844`) — bản 0.4.6/0.4.7 chắc chắn
có trong source nhưng chưa chứng minh đã publish registry. `npm view` trên máy này trả
**E401 Unauthorized** (`packages/web/.npmrc` dùng `${GITHUB_TOKEN}`; token không có trong phiên).

### 2.2 Vì sao badge FREE (root cause đã có phản chứng)

| Nguyên nhân | Bằng chứng | Hệ quả |
|---|---|---|
| Key staging hết hạn `e=1795046399` = 18/11/2026 | `docs/evidence/widget-license-verify/verify-20261111.md:11,80` | `verifyLicenseKey` → null (ngày 22/11) |
| Trust anchor `kid=primary` phải inject bằng tay | `packages/web/src/lib/licenseTrustAnchor.js:13-30`; ledger Entry 454 (`docs/CODE_CHANGE_AUDIT_LEDGER.md:1551-1556`) | Sai 1 ký tự JWK từng làm NULL; đã sửa |
| `/billing/subscription` trả 404 | ledger `:1641` (agent B trích); `useTenantTier.js:63-68` | `serverTier='free'` |
| Không caller nào truyền `tier` prop | `packages/web/src/pages/StockDetailPage.tsx:280-298` | Không có đường dự phòng |
| `registerProExtension` bị cố ý KHÔNG gọi | `docs/evidence/widget-feat-leverage/JOURNAL_20261112.md` (agent B: test `:93-101`) | widget-pro không nạp dù đã cài |

> ⚠ Ledger Entry 447 từng nói "key cũ PRO" đã bị **thu hồi cách diễn đạt** tại Entry 454/§8
> (`verify-20261111.md:98-105`). Không dùng Entry 447 làm bằng chứng tier hiện tại (L-V02).

### 2.3 Demo site làm gì khác

| Cơ chế | Demo `charts.edusuccess.vn` | Staging `docker.edusuccess.vn` |
|---|---|---|
| Tier | `enterprise`, `lockedText=0`, `upgradeNudge=0`, gate 21/21 PASS | rơi `free` (§2.2) |
| Nguồn tier | PAT server-only → nginx `/api/v1/entitlement` → vnsaas billing | không có endpoint này |
| Tenant | `widget-demo` UUID `9d2fd0d5-…`, subscription tier `enterprise` | tenant `admin-core` (chỉ có PAT data `charts-demo`) |
| Data PAT | SA `charts-demo`, `/demo-token.json`, scope `market:read` | cùng SA, đã re-issue id 1067 `market:read`+`ws:realtime` (`docs/evidence/ws-ticket-machine/EVIDENCE_20261120.md:26-29`) |
| Blob demo | cũ TTL 365d bị engine từ chối; mới do endpoint công khai mint, bind domain | **không dùng được** (domain mismatch) |

---

## 3. CONTRADICTIONS (tài liệu vs code/thực tế)

| # | Tài liệu nói | Thực tế verify 22/11 | Tác động |
|---|---|---|---|
| C1 | `docs/MASTER_TRACKING_2026Q4.md:62` — widget npm `1.2.5`, 59 indicator, app bật 7 | `package.json:107` = `0.4.4`; source `0.4.7`; app đã truyền ~35 props (`VNStockChartPanel.js:434-523`) | Số liệu tracking stale, không dùng làm baseline |
| C2 | `PLAN_WIDGET_FEATURE_LEVERAGE_20261112.md:224-232` — Owner chốt dừng Wave 0 | Yêu cầu hiện tại đòi dùng tính năng enterprise → mở lại Wave 1/2 | Cần Owner xác nhận (D6), không tự ý coi là đã批准 |
| C3 | `REPORT_WIDGET_PRO_ENTERPRISE_GAPS_20261110.md:40` — `VNI_DEMO_LICENSE` nhúng DefinePlugin | Source widget hiện tại **không còn** biến đó (`W:config/webpack.config.js:258-269`; `W:src/demo/demoLicense.ts:1-5`) | Cơ chế demo đã đổi sang entitlement; không copy hướng dẫn cũ |
| C4 | User: "chart.edusuccess.vn" | `charts.edusuccess.vn` (số nhiều); singular trả transport error | Sai domain → mọi link/probe vô dụng |
| C5 | "Đang dùng bản free" (hiểu là package free) | Package public **có** enterprise; fail là do resolve tier + version lùi | Fix sai hướng nếu chỉ đổi credential |
| C6 | `docs/BACKEND_VNINVEST_ENTERPRISE_DEMO_SPEC…:150-151` — whale-campaign/orderbook ❌ | B-1 đã merge PR #357 (`docs/handoffs/HANDOFF_2026-11-12_ENTERPRISE-B1.md:19-21`); B-2..B-6 xong (`docs/handoffs/HANDOFF_2026-11-13_WIDGET-PROGRAM-DONE.md:17-19`) | Backend không còn là blocker chính; blocker là widget build + credential |
| C7 | `W:package.json:3` 0.4.7 / `release-manifest.json:3` 0.4.6 / repo 0.4.4 | 3 số khác nhau; registry 401 | Không thể tự chọn version — chờ Owner D2 |

---

## 4. Kiến trúc mục tiêu (Path A — khuyến nghị)

```
Trình duyệt (docker.edusuccess.vn)
   │
   ├─ /api/v1/entitlement  ──nginx proxy (Origin cố định, PAT server-only root-owned)──>
   │                          https://saas.edusuccess.vn/api/v1/billing/subscription/vninvestcharts_widget
   │                          → {tier_code: "enterprise"}  [W:deploy/nginx-app.conf:151-168]
   │
   ├─ /demo-token.json (data PAT charts-demo, scope market:read) ──> core API
   │
   └─ @vninvestcharts/widget >=0.4.6
        SaaSFeatureContext: effectivePat/effectiveLicense → resolve tier
        (W:src/widget/contexts/SaaSFeatureContext.tsx:270-282,552-591)
          → CapabilityResolver: granted / degraded / locked
        (E:capabilities.ts:236-257, W:CapabilityResolver.ts:206-285)
          → UI: dock Enterprise, whale, orderbook, fundamentals, workspace

Nguyên tắc bảo mật: credential KHÔNG qua URL (?pat=), KHÔNG vào bundle, KHÔNG vào repo/log;
PAT file root-only như demo (W:docs/evidence/DEMO-ENTERPRISE-ENTITLEMENT_2026-11-19.md:12-22).
```

**Path B (fallback, chỉ Pro):** mint `vni1.*` qua `POST /api/v1/licenses` (không truyền `domains`
nên không domain-bound — `S:.../license/views.py:279-286`), inject JWK `kid=primary` đã có sẵn
(`packages/web/src/lib/licenseTrustAnchor.js:13-30`). Ưu điểm: không cần nginx/proxy. Nhược:
**không đạt enterprise** (Q8), TTL cứng 7 ngày (`S:.../license/signing.py:71,161`), phải rotate định kỳ.

---

## 5. Tính năng Enterprise & ánh xạ code tự viết cần thay

Matrix SSOT: `E:packages/vn-kline-engine-core/src/capabilities.ts:219-230` (13 capability).
Backend vninvest đã đáp ứng hầu hết (`docs/BACKEND_VNINVEST_ENTERPRISE_DEMO_SPEC…:145-159`;
`docs/handoffs/HANDOFF_2026-11-13_WIDGET-PROGRAM-DONE.md:17-19`).

| Capability | Backend | Code tự viết trong vninvest | Hành động theo nguyên tắc "dùng widget" |
|---|---|---|---|
| `deep_history` | ✅ `/bars/` contract tốt nhất (`…SPEC:147`) | `chartAdapter.js:59-220` bridge | Giữ adapter (bắt buộc để widget gọi), bỏ logic dựng bar thừa nếu widget có (`VNStockChartPanel.js:214-242`) |
| `realtime_tick` | ⚠ price là string (`…SPEC:148`, B-5) | `market.js:238-247`, build bar realtime `:214-242` | Sau B-5 số hoá → bỏ mapping tay |
| `whale_campaign` | ✅ B-1 merge (`HANDOFF…:19-21`) | `WhaleBubbleChart.jsx:1-119`, `FactsFirstWhaleBubbleChart.jsx:1-55`, render `StockDetailPage.tsx:303-310` | **Thay bằng widget overlay** `enableWhale`/`whaleOrders` + `fetchWhaleCampaigns` (`VNStockChartPanel.js:494-495`; `W:dist/dts/lib/types/adapter.d.ts:68`). ⚠ Kiểm chứng export trước (S5) |
| `orderbook_dom` | ⚠ rỗng trung thực (Q-B1 không nguồn) | `StockOrderBookWidget.jsx:23`, `StockExecutionLogWidget` (`StockDetailPage.tsx:318-320`) | Chuyển sang dock `orderbook_dom`; giữ empty state trung thực, **không tạo số giả** (Rule 15) |
| `fundamentals_full` | ✅ typed (B-4) | watchlist tự fetch 4 endpoint `WatchlistDetailPanel.tsx:66-71,144-234` | Chuyển sang dock tab `fundamentals_full` |
| `adjusted_bars` | ⚠ `adjusted:false`+note (D1) | — | Không tự suy `adj_close`; để widget degrade |
| `cloud_alert` / `server_workspace` | ✅ price-alerts + workspace | `WatchlistDetailPanel.tsx:144-234` sections | Dùng dock tabs thay section riêng |
| `index_constituents` | ✅ S2 PR #379 | chưa có UI | Bật capability, không viết UI riêng |
| `portfolio_analytics` | ✅ endpoint portfolio | `PortfolioChart.tsx:36-56,139-281` (ECharts tự vẽ) | **Ưu tiên thay** bằng widget nếu export có series; nếu không → giữ ECharts + ghi exception có bằng chứng (D5) |
| `realtime_tick` / SSE | ✅ S1 WS ticket | `chartAdapter.js:114-151` | Giữ bridge, bỏ duplicate subscribe |
| `dock_pro` (tier pro) | — | tape/advisory bridge `VNStockChartPanel.js:245-322,468-480` | Giữ **data bridge** (widget chưa forward payload V2), nhưng bỏ filter state trùng UI widget (`VNStockChartPanel.js:270-300`) |
| `multi_chart` (starter+) | — | `VNInvestMultiCharts` chỉ destructure `:170`, chưa render | Bật theo D4; dynamic import (L-F01/F02) |
| `pine_editor` / `strategy_tester` / `replay` | widget-pro | chưa dùng | Chỉ khi Owner duyệt EULA + registry (D4) |

**CSS hack cần dọn khi nâng version** (L-F12): `packages/web/src/components/VNStockChartPanel.css:8-9`
override `opacity` bằng `!important` trên `[data-rsc-chart-status-line]`; thay bằng prop/theme chính
thức nếu bản mới hỗ trợ,否则 giữ kèm comment + test. Class hash `.Gc` đã dọn xong
(`docs/CODE_CHANGE_AUDIT_LEDGER.md:1547`) — không phục hồi.

---

## 6. Kế hoạch slice theo wave

> Mỗi slice: claim riêng trong `docs/CLAIMS.md` trước dòng code đầu tiên; fail-before → pass-after;
> 1 PR/1 slice; ledger 1 Entry riêng; gate chạy thật, không chạy được ghi **CHƯA CHẠY**.
> `packages/web/package.json` nằm deny list ⇒ S1 phải do coordinator, kèm trailer
> `Claim-Deny-List: <lý do>` nếu sửa trực tiếp (MANDATORY-WORKFLOW.md).

### Wave 0 — Chốt quyết định + provision (doc-only, 0.5 ngày, không code)

| ID | Việc | Output | AC |
|---|---|---|---|
| E0-D | Chốt D1–D7 §7 vào claim + doc quyết định | `docs/DECISIONS_CHART_ENTERPRISE_20261122.md` | 7 dòng có người chốt, ngày, lý do |
| E0-P | Provision: tạo/xác nhận tenant subscription `enterprise` trên vnsaas staging; phát PAT server-only; đặt file root-only trên VPS | runbook (không secret) | `GET /api/v1/entitlement` từ `docker.edusuccess.vn` trả `tier_code=enterprise` khi có PAT; 401/403 khi không |

### Wave 1 — Nâng widget + wiring entitlement (1–2 ngày)

| ID | Việc | File | AC / gate |
|---|---|---|---|
| E1 | Verify nguồn build: `npm view @vninvestcharts/widget versions` với token Owner **hoặc** build local từ `W:` pin commit; bump dependency | `packages/web/package.json` (deny-list — coordinator), `package-lock.json` (deny-list) | `node -e` đọc version ≥0.4.6; grep dist có `/api/v1/entitlement` ≥1 hit; `npm run build` exit 0 |
| E2 | Bổ sung init widget: entitlement leg + trust anchor (chỉ fallback Pro) + bỏ `?pat=` nếu có | `VNStockChartPanel.js`, `licenseTrustAnchor.js`, `StockDetailPage.tsx` | Test source-scan S1–S21 cập nhật; `npx tsc --noEmit` 0; vitest panel 15/15 |
| E3 | Hạ tầng staging: nginx proxy `/api/v1/entitlement`, env build `VNI_API_BASE`/`VNI_SAAS_BASE`, mount PAT root-only | VPS `/opt/edusuccess/charts/` (ngoài repo), `compose.staging.env` (không commit secret) | `bash scripts/deploy-staging.sh --verify`; `curl` endpoint trả enterprise; `curl /health.json` của app trả bundle sha mới |
| E4 | E2E Rule 17: mở staging, đo tier observables | evidence mới `docs/evidence/chart-enterprise/EVIDENCE_*.md` + ảnh | badge ENTERPRISE, `lockedText=0`, `upgradeNudge=0`, `data-tier=enterprise`, 0 console error; **mở ảnh ra xem** (L-V05) |

### Wave 2 — Dùng capability thay code tự viết (2–4 ngày, sau E4 xanh)

| ID | Việc | File | AC |
|---|---|---|---|
| E5 | Verify export surface `widget-pro`/`widget` bằng `Object.keys(await import(...))` + grep `dist/dts`; quyết định S5/S6 | evidence JSON | Có/không có export được ghi rõ; không đoán từ comment D1 cũ (`PortfolioChart.tsx:4-34`) |
| E6 | Whale: thay bubble ECharts bằng widget whale/whale_campaign | `WhaleBubbleChart.jsx` (xoá hoặc giữ fallback), `FactsFirstWhaleBubbleChart.jsx`, `VNStockChartPanel.js`, `chartAdapter.js` | 0 import ECharts trong Stock detail chart; widget whale overlay render; test fail-before |
| E7 | Portfolio: dùng widget `portfolio_analytics` nếu E5 xác nhận có; ngược lại giữ ECharts + exception doc | `PortfolioChart.tsx` | Quyết định có bằng chứng export |
| E8 | Orderbook/workspace: chuyển sang dock tabs, xoá panel trùng | `StockOrderBookWidget.jsx`, `WatchlistDetailPanel.tsx`, panel | Dock tab mở được; empty state trung thực; không số giả |
| E9 | Dọn CSS hack + comparison chip trùng | `VNStockChartPanel.css:8-9`, `:392-404` | Hết `!important` hack nếu prop mới đủ; screenshot trước/sau |
| E10 | Đo bundle tĩnh (L-F01/F02) | `packages/web/scripts/measure-route-graph.mjs` | Widget chunk vẫn lazy, không lọt vào initial load mọi route; số có lệnh tái hiện |

### Wave 3 — widget-pro (tuỳ chọn, chỉ khi Owner duyệt D4)

| ID | Việc | AC |
|---|---|---|
| E11 | Cài `@vninvestcharts/widget-pro` bản khớp widget, `registerProExtension`, bật Pine/strategy/replay/paper advanced | Có EULA + token registry; `registerProExtension` được gọi sau verify license (`W:AGENTS.md:99`); test tier fail-closed |

### Wave 4 — Đóng phiên

| ID | Việc | AC |
|---|---|---|
| E12 | Full gates + re-audit độc lập + ledger + handoff | `tsc` 0 · `npm run build` 0 · `npm run lint` 0 error · vitest full (hoặc ghi timeout thật) · `check-multi-agent` 0 · `check-ledger-entry` 0 · screenshot staging · handoff trong `docs/handoffs/` |

---

## 7. Quyết định cần Owner chốt (D1–D7)

| # | Quyết định | Khuyến nghị | Nếu không chốt |
|---|---|---|---|
| **D1** | Đi Path A (enterprise online) hay Path B (Pro offline)? | **Path A** — Path B không đạt enterprise (Q8) | Không bao giờ tới tier enterprise |
| **D2** | Nguồn build widget: publish registry (cần `GITHUB_TOKEN`) hay dùng dist local pin commit? | Owner cung cấp token hoặc cho phép `file:`/build riêng; **không tự đoán** | E1 block; registry hiện **401** |
| **D3** | Cấp credential nào cho `docker.edusuccess.vn`? | PAT server-only của tenant subscription **enterprise** mới, file root-only; **không** blob demo, **không** `?pat=` | Fail-closed `free` tiếp |
| **D4** | Có dùng `@vninvestcharts/widget-pro` (private EULA, registry token) và `EnterpriseDockProvider` không? | Wave 1–2先用 widget public; widget-pro chỉ khi duyệt riêng | Không có Pine/strategy/replay trả phí |
| **D5** | Có thay `PortfolioChart` ECharts bằng widget `portfolio_analytics` không? | Có, **sau** khi E5 verify export; nếu widget không có series chart thì giữ và ghi exception | Nguy cơ xoá chart đang chạy mà không có thay thế |
| **D6** | Có mở lại Wave 1/2 của `PLAN_WIDGET_FEATURE_LEVERAGE_20261112` không (Owner 12/11 chốt dừng Wave 0)? | Có — yêu cầu hiện tại được hiểu là đảo quyết định cũ | E6–E10 bị coi là vi phạm quyết định cũ |
| **D7** | TTL/rotation: PAT server-only và key offline (7 ngày) rotate thế nào, ai giữ private key? | Runbook + nhắc hạn; key offline không lưu repo | Hết hạn âm thầm → mất tier đột ngột |

---

## 8. Rủi ro & giảm thiểu

| Rủi ro | Bằng chứng | Giảm thiểu |
|---|---|---|
| Nâng version vỡ CSS/props/pane (legend đè nhau, toolbar mất style) | L-F12 / Entry 440 (`docs/evidence/widget-ui-fix/EVIDENCE_20261110.md`) | Grep CSS entry + `inject*()` signature + mọi prop trong `*Props.d.ts` + tổng `heightRatio` ≤1; screenshot staging |
| `npm view` 401, không lên được bản ≥0.4.6 | lệnh thật 22/11/2026 | D2 trước E1; không tự `npm install` khi chưa hỏi (node_modules junction dùng chung) |
| Secret lọt qua chat/`?pat=`/bundle | `REPORT_WIDGET_PRO_ENTERPRISE_GAPS…:81-85`; Entry 448–454 | PAT file root-only, ENV transient; scan secrets; serial/hash thay key |
| Đo sai bundle (kể cả route chưa mở) | L-F01/F02 | BFS cạnh import tĩnh + đối chiếu `npm run build`; dynamic `import()` không tính initial |
| Screenshot "xanh nhưng vô dụng" (chụp lúc skeleton / selector nhầm) | L-V05 | Đợi nội dung → chụp → assert selector đúng khối → **mở ảnh xem** |
| Xoá code tự viết nhưng widget không có export tương đương | `PortfolioChart.tsx:4-34` (comment cũ đã từng sai) | E5 verify export bằng code, không tin comment/doc |
| Backend "sẵn" nhưng contract lệch | C6 + Q-B1 (không nguồn depth) | Giữ empty state trung thực, không fake; báo widget team khi đổi shape |
| Tin "root cause" cũ | L-V02 / Entry 447 bị thu hồi | Mọi root cause đã có phản chứng ở §2.2/§3 |

---

## 9. Lệnh tái hiện (đã chạy 22/11/2026)

```powershell
# 1. Version thực tế
$b='D:\Mujoco Projects\vninvest\packages\web\node_modules\@vninvestcharts'
foreach($p in 'widget','widget-pro','engine-core'){ (Get-Content "$b\$p\package.json" -Raw|ConvertFrom-Json).version }

# 2. dist widget 0.4.4 có enterprise leg không (0 hit)
node -e "const fs=require('fs'),path=require('path');const root='D:/Mujoco Projects/vninvest/packages/web/node_modules/@vninvestcharts/widget/dist';const needles=['/api/v1/entitlement','enterpriseBinding','fetchWhaleCampaigns','EnterpriseDockProvider','fetchOrderbookDepth'];const files=[];(function w(d){for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name);e.isDirectory()?w(p):files.push(p)}})(root);for(const n of needles)console.log(n,files.reduce((a,f)=>a+fs.readFileSync(f,'utf8').split(n).length-1,0))"

# 3. Live demo
curl https://charts.edusuccess.vn/health.json

# 4. Registry (trả 401 khi thiếu GITHUB_TOKEN)
npm view @vninvestcharts/widget versions --json

# 5. Baseline repo
git status --short; git rev-parse --abbrev-ref HEAD
```

---

## 10. Definition of Done

1. D1–D7 có quyết định Owner ghi trong doc/claim.
2. `data-tier=enterprise` trên staging, badge **ENTERPRISE**, `lockedText=0`, gate capability ≥21/21
   như demo — đo bằng E2E + ảnh đã mở xem.
3. Không còn blob demo domain-bound, không PAT trong URL/bundle/repo/log.
4. Mỗi capability enterprise được **dùng qua widget**; mỗi đoạn code tự viết bị thay có evidence
   `file:line` trước/sau; trường hợp giữ lại có exception được Owner chốt (D5).
5. Gate FE: `npx tsc --noEmit` 0 · `npm run build` 0 · `npm run lint` 0 error · vitest slice +
   hồi quy · `check-multi-agent` 0 · `check-ledger-entry` 0 · đo bundle (L-F01/F02).
6. Ledger: 1 `## Entry N` riêng cho mỗi slice + 1 dòng index; handoff trong `docs/handoffs/`.

---

## 11. Checklist lessons (tick trước khi coi xong)

- [x] L-V01: mọi con số có lệnh tái hiện (§9); script tự viết có đối chứng (dist scan đối chiếu package.json + `/health.json`).
- [x] L-V02: root cause "FREE" có phản chứng (key hết hạn + billing 404 + dist 0 hit), không tin Entry 447.
- [ ] L-V05: E4 phải mở ảnh staging ra xem, không tin exit 0.
- [ ] L-F01/L-F02: E10 đo BFS cạnh tĩnh, kiểm tra preload chunk.
- [ ] L-F12: E1/E4 verify CSS + props + `heightRatio` sau bump version.
- [x] L-T01: `git diff --numstat` sẽ kiểm tra khi append `CLAIMS.md`/ledger (CRLF/LF riêng từng file).
- [x] L-T02: mọi `file:line` đã mở đúng file (3 path được glob xác nhận tồn tại ở §1.1).

---

## 12. Câu hỏi cần làm rõ (ngắn)

1. Owner chọn **Path A** (enterprise online) hay chấp nhận **Pro offline**?
2. Owner có `GITHUB_TOKEN` / cho phép build local widget ≥0.4.6 không (registry đang 401)?
3. Ai là owner của PAT server-only trên VPS, có được thay PAT `charts-demo` hiện tại không?
4. Có dùng `@vninvestcharts/widget-pro` (EULA riêng) trong đợt này không?
5. Có xác nhận mở lại Wave 1/2 (D6) và thay `PortfolioChart` ECharts (D5) không?
