# IMPLEMENTATION PLAN - Whale Alerts Symbol KLine Intelligence Upgrade

**Ngày tạo**: 2026-04-28  
**Scope**: `whale-alerts/:symbol` KLine intelligence workspace  
**Level**: A (Major - frontend architecture, backend contract expansion, QA and governance bundle)  
**Status**: READY FOR IMPLEMENTATION REVIEW

---

## 1. Business objective

### Vấn đề cần giải quyết

Route `whale-alerts/:symbol` đã được refactor về KLine làm surface trung tâm, nhưng trạng thái hiện tại vẫn mang tính remediation theo từng lỗi:

1. pane flow còn tách rời,
2. chưa có heatmap đúng nghĩa,
3. whale marker mới ở mức icon nổi bật, chưa có scoring và guardrail đầy đủ,
4. tooltip, pane, marker và bubble sync vẫn có nguy cơ drift nếu tiếp tục mở rộng theo kiểu chắp vá,
5. chưa có một target architecture đủ rõ để đội code triển khai một lần cho đúng và có thể audit dài hạn.

### Mục tiêu nghiệp vụ

1. Xây dựng một `KLine intelligence workspace` đủ dùng cho nhà đầu tư thực chiến.
2. Hợp nhất các tín hiệu dòng tiền vào một trải nghiệm đọc chart thống nhất: `heatmap + Flow Compare pane + whale marker + tooltip rich context`.
3. Giữ selected-session truth cho bubble chart và AI advisory.
4. Giữ immutable bubble source của modern dashboard.
5. Chuyển logic từ trạng thái “fix-by-fix” sang kiến trúc bền vững có test gates và evidence pack rõ ràng.

### KPI đầu ra

| Chỉ số | Baseline | Mục tiêu |
|---|---:|---:|
| Số pane flow rời rạc | 2-3 | 1 `Flow Compare pane` |
| Tỷ lệ drift bucket giữa candle / tooltip / pane / marker | Có rủi ro | 0 |
| Heatmap semantics consistency giữa timeframe | Chưa có | 100% cùng quy tắc màu |
| Tỷ lệ whale marker recompute sai viewport | Có rủi ro | 0 |
| Selected-session mismatch sang bubble/advisory | Có rủi ro | 0 |
| Regression trên modern dashboard bubble source | Rủi ro cao nếu sửa trực tiếp | 0 |

---

## 2. Scope and non-scope

### In-scope

1. Thiết kế và triển khai `Flow View Model` dùng chung cho KLine intelligence.
2. Hợp nhất `CVD`, `Buy Strength`, `Institutional Strength` thành `Flow Compare pane`.
3. Thêm heatmap dòng tiền theo bucket thời gian ngay trên KLine surface.
4. Chuẩn hóa whale marker scoring và viewport recompute.
5. Nâng cấp tooltip KLine với ngữ cảnh flow đầy đủ.
6. Hiển thị degraded state hoặc confidence state khi dữ liệu thiếu hoặc fallback.
7. Giữ selected session truth sang bubble chart và AI advisory.
8. Cập nhật test strategy, self-audit protocol, evidence template và release gates cho toàn chương trình.

### Out-of-scope

1. Không tái thiết kế bubble chart nguồn của modern dashboard.
2. Không làm footprint heatmap theo giá x thời gian ở giai đoạn này.
3. Không thay chart engine chính của nến.
4. Không mở entitlement, auth hay workflow admin mới.
5. Không thay đổi triết lý advisory canonical toàn symbol ngoài phần sync theo selected session.

---

## 3. Current-state assessment

### Hệ thống hiện tại

1. `frontend/src/components/KLineChartPanel.jsx` đã có nền tảng custom indicators, tooltip toggle, whale marker overlay và sync session.
2. `frontend/src/hooks/useWhaleAnalyticsData.js` đã dùng `compact: 0`, tách chart snapshot và bubble snapshot, và hỗ trợ `includeBaseline`.
3. `backend/portfolio/services_whale_analytics_snapshot.py` đã có cached percentile baseline và flow snapshot đủ để mở rộng tiếp.
4. `frontend/src/components/WhaleBubbleChart.jsx` là nguồn tham chiếu semantics cho `Dòng tiền thông minh`, nhưng bất biến.

### Rủi ro hiện tại

1. Logic bucket mapping đang phân tán giữa tooltip, indicator templates và whale marker selection.
2. CVD và Strength vẫn đang nghĩ theo nhiều pane riêng, chưa chốt một shape đích cho nhà đầu tư thực chiến.
3. Heatmap chưa tồn tại nên người dùng thiếu lớp “nóng/lạnh dòng tiền” nhìn nhanh theo thời gian.
4. Nếu tiếp tục cộng thêm layer trực tiếp vào `KLineChartPanel.jsx` mà không tách `Flow View Model`, code sẽ tiếp tục phình to và dễ drift semantics.
5. Chưa có quality flags đủ rõ để phân biệt “thiếu dữ liệu thật” với “logic ghép sai”.

### Constraints kỹ thuật

1. Phải dùng `klinecharts` cho candle surface.
2. Không được sửa trực tiếp module bubble nguồn.
3. Phải map đúng SSOT domains hiện có.
4. Nếu đụng market data ở backend, phải giữ MDSU compliance.

---

## 4. Target design

### 4.1 Target architecture

KLine intelligence workspace được chia thành 4 lớp hiển thị bám cùng một `Flow View Model`:

1. `Candle layer`
   - nến,
   - MA / indicator thuộc price surface,
   - volume nếu bật.

2. `Flow context layer`
   - heatmap theo bucket thời gian,
   - buy / sell / net modes,
   - không che mất candle body.

3. `Signal overlay layer`
   - whale marker top 10% visible candles,
   - score và dominance rõ,
   - recompute theo viewport.

4. `Flow Compare pane`
   - `CVD normalized 0-100`,
   - `Buy Strength`,
   - `Institutional Strength`,
   - baseline trung tính,
   - line toggle và last-value badges.

### 4.2 Canonical rule set

1. Mọi layer đều bám cùng `canonical minute key`.
2. Tooltip, pane, marker, heatmap phải đồng bộ theo cùng candle bucket.
3. `CVD raw` chỉ dùng cho tooltip/info panel và debug proof.
4. `CVD normalized` dùng cho so sánh trực quan trong `Flow Compare pane`.
5. Heatmap là context layer, không thay thế pane phân tích.
6. Whale marker là extreme-event layer, không thay heatmap và không thay pane.

### 4.3 Target interaction model

1. Hover candle:
   - cập nhật tooltip và hover info,
   - không đổi selected session.
2. Click candle:
   - cập nhật selected session,
   - bubble/advisory sync theo phiên.
3. Zoom/pan/timeframe change:
   - recompute whale markers,
   - giữ heatmap và pane cùng bucket,
   - nếu selected session không còn hợp lệ thì fallback `latest valid session`.

---

## 5. Execution phases

## Phase 0 - Governance and semantics freeze

### ARC-01
Mục tiêu:
- Khóa semantics của `CVD raw`, `CVD normalized`, `Buy Strength`, `Institutional Strength`, `Heat Level`, `Whale Score`.

### ARC-02
Mục tiêu:
- Khóa SSOT integration map và feature flags cho rollout.

### ARC-03
Mục tiêu:
- Khóa payload contract của snapshot mở rộng, quality flags và degraded states.

## Phase 1 - Frontend data foundation

### FE-1.1
Mục tiêu:
- Tạo `Flow View Model` adapter tách khỏi `KLineChartPanel.jsx`.

Anchor files:
- `frontend/src/components/KLineChartPanel.jsx`
- file mới dưới `frontend/src/features/whale-alerts/kline/`

### FE-1.2
Mục tiêu:
- Quy tất cả tooltip/pane/marker/heatmap về cùng canonical bucket mapping.

### FE-1.3
Mục tiêu:
- Persist chart state: timeframe, tooltip on/off, heatmap mode, line visibility.

## Phase 2 - Backend contract expansion

### BE-2.1
Mục tiêu:
- Mở rộng `whale analytics snapshot` để trả đầy đủ sections cho KLine intelligence.

### BE-2.2
Mục tiêu:
- Trả thêm `normalized flow`, `heatmap`, `marker`, `quality flags`, `default session`.

### BE-2.3
Mục tiêu:
- Hardening cache key, cold-path performance và backward compatibility.

## Phase 3 - KLine intelligence surface

### FE-3.1
Mục tiêu:
- Thay pane rời bằng `Flow Compare pane`.

### FE-3.2
Mục tiêu:
- Nâng tooltip lên bản v2 và thêm last-value badges.

### FE-3.3
Mục tiêu:
- Thêm line toggles và degraded-state UI semantics.

## Phase 4 - Heatmap and whale marker

### FE-4.1
Mục tiêu:
- Render heatmap overlay với các mode `Off`, `Net`, `Buy`, `Sell`.

### FE-4.2
Mục tiêu:
- Chuẩn hóa whale marker scoring và visible-range recompute.

### FE-4.3
Mục tiêu:
- Kiểm soát mật độ marker, hover parity và readability guardrails.

## Phase 5 - Route integration hardening

### FE-5.1
Mục tiêu:
- Củng cố selected-session truth cho Whale Alerts route.

### FE-5.2
Mục tiêu:
- Đảm bảo Stock Detail parity và shared chart behavior không regress.

### FE-5.3
Mục tiêu:
- Retire code path hoặc computation path dư thừa gây dual-truth.

## Phase 6 - QA, release and closure

### QA-6.1
Mục tiêu:
- Viết hoặc cập nhật backend regression suites.

### QA-6.2
Mục tiêu:
- Viết hoặc cập nhật frontend regression suites.

### QA-6.3
Mục tiêu:
- Chạy integration/UAT matrix và thu đủ evidence.

### OPS-6.4
Mục tiêu:
- Refresh dev stack, smoke lại route, chuẩn bị GO / NO-GO.

### DOC-6.5
Mục tiêu:
- Lưu walkthrough / closure docs sau khi execution hoàn tất.

---

## 6. API and data contract changes

### 6.1 Chiến lược contract

Không tạo pipeline song song mới. Mở rộng endpoint snapshot hiện có thành canonical contract cho KLine intelligence.

### 6.2 Request contract đề xuất

`GET /api/portfolio/whale/analytics/:symbol/`

Query params:

1. `timeframe`
2. `compact=0`
3. `trade_date` nếu đang fix selected session
4. `include_baseline`
5. `workspace_mode=kline_intelligence`

### 6.3 Response sections bắt buộc

1. `flow_compare_series`
   - `ts`
   - `cvd_raw`
   - `cvd_normalized_0_100`
   - `buy_strength`
   - `institutional_strength`
   - `baseline`

2. `heatmap_series`
   - `ts`
   - `buy_heat`
   - `sell_heat`
   - `net_heat`
   - `whale_score`
   - `confidence`

3. `marker_series`
   - `ts`
   - `side`
   - `score`
   - `matched_value`
   - `event_score`
   - `confidence`

4. `session_context`
   - `default_trade_date`
   - `selected_trade_date`
   - `latest_valid_trade_date`
   - `quality_state`

5. `quality_flags`
   - `has_flow_data`
   - `has_heatmap_data`
   - `degraded_reason`
   - `contract_version`
   - `cache_key_version`

### 6.4 Backward compatibility

1. Các field mới phải additive.
2. Consumer cũ vẫn hoạt động nếu bỏ qua sections mới.
3. Cache key backend phải versioned khi shape payload đổi.

---

## 7. Scheduling and operations

### 7.1 Feature flags bắt buộc

1. `ENABLE_WHALE_KLINE_INTELLIGENCE_V2`
2. `ENABLE_WHALE_KLINE_HEATMAP`
3. `ENABLE_WHALE_FLOW_COMPARE_PANE`
4. `ENABLE_WHALE_KLINE_DEGRADED_STATES`

### 7.2 Guardrails vận hành

1. Không có cron/scheduler mới cho chương trình này.
2. Mọi performance work phải ưu tiên cache/versioning của snapshot hiện có.
3. Nếu cold path vượt ngưỡng chấp nhận, không rollout heatmap trước khi cache hardening xong.

### 7.3 Runtime refresh

Mọi slice chạm frontend/runtime phải refresh stack bằng:

```powershell
docker compose -f ./docker-compose.dev.yml up -d --build frontend backend
```

---

## 8. Testing and verification

### 8.1 Frontend tests bắt buộc

1. `KLineChartPanel.flow-compare.test.jsx`
2. `KLineChartPanel.heatmap.test.jsx`
3. `KLineChartPanel.whale-marker-viewport.test.jsx`
4. `KLineChartPanel.tooltip-v2.test.jsx`
5. `WhaleAlertsDashboard.kline-session-sync.test.jsx`
6. `StockDetail.kline-parity.test.jsx`

### 8.2 Backend tests bắt buộc

1. `portfolio.tests.test_whale_analytics_snapshot_api`
2. `portfolio.tests.test_whale_analytics_snapshot_flow_series`
3. `portfolio.tests.test_whale_orders_ssot_parity`
4. `portfolio.tests.test_order_flow`
5. `portfolio.tests.test_order_flow_source_parity`
6. suite mới cho `heatmap` và `quality_flags` nếu contract được mở rộng

### 8.3 Manual / integration gates

1. Heatmap đổi mode đúng.
2. Flow Compare pane không lệch bucket.
3. Whale marker recompute theo viewport.
4. Bubble/advisory đổi đúng session click.
5. Bubble source vẫn bất biến.

### 8.4 Exit criteria

1. Build và focused suites pass.
2. Tất cả slices có evidence pack.
3. Không còn blocker ở traceability matrix.
4. GO / NO-GO được quyết định theo integration protocol.

---

## 9. Observability and alerting

### 9.1 Metrics cần bổ sung

1. Snapshot build time cho `workspace_mode=kline_intelligence`.
2. Heatmap data availability rate.
3. Marker candidate count và visible marker count.
4. Selected-session fallback count.
5. Degraded-state render count.

### 9.2 Logs cần có

1. Khi bucket mapping thất bại.
2. Khi selected session fallback sang latest valid session.
3. Khi heatmap series bị thiếu hoặc confidence thấp.
4. Khi marker score không đủ dữ liệu.

---

## 10. Security and governance

1. Không mở thêm quyền truy cập mới.
2. Không thay đổi auth model.
3. Mọi text mới phải qua i18n tiếng Việt có dấu.
4. Mọi doc `.md` trong `docs/` phát sinh từ chương trình này phải được audit và sync ledger/progress.

---

## 11. Release plan

### 11.1 Rollout

1. Dev: bật toàn bộ flags.
2. Staging: bật `Flow Compare pane` trước, sau đó bật `heatmap`, cuối cùng bật degraded-state UX.
3. Production hoặc final auditor smoke: chỉ sau khi integration matrix pass.

### 11.2 Backout plan

1. Tắt `ENABLE_WHALE_KLINE_HEATMAP` nếu heatmap semantics chưa ổn.
2. Tắt `ENABLE_WHALE_FLOW_COMPARE_PANE` và giữ pane hiện trạng nếu unified pane regress.
3. Không rollback bubble source vì không được đụng vào source đó.

### 11.3 Post-release checklist

1. Smoke `whale-alerts/:symbol`.
2. Smoke `stocks/:symbol`.
3. Check immutable source diff sạch.
4. Cập nhật walkthrough closure docs.

---

## 12. Ownership and timeline

| Phase | Owner chính | Reviewer | ETA |
|---|---|---|---:|
| Phase 0 | Tech Lead | Project Lead | 0.5 ngày |
| Phase 1 | Frontend Lead | Tech Lead | 1 ngày |
| Phase 2 | Backend Lead | Tech Lead | 1 ngày |
| Phase 3 | Frontend Lead | Product/QA Lead | 1 ngày |
| Phase 4 | Frontend Lead | QA Lead | 0.75 ngày |
| Phase 5 | Frontend Lead + Backend Lead | Project Lead | 0.75 ngày |
| Phase 6 | QA Lead + Ops Owner | Final Auditor | 1 ngày |

---

## 13. SSOT integration map

| Domain | Canonical source | Chương trình này dùng vào đâu | Không được làm |
|---|---|---|---|
| whale alert | `whale analytics snapshot` | flow compare, marker, selected session | tạo route nghiệp vụ song song |
| darkmoney flow | existing dark money contract | right-column trust context | tính lại dark flow ở FE |
| ai advisory | advisory session contract hiện có | bubble/advisory theo selected session | advisory toàn symbol giả danh theo phiên |
| market data | MDSU / canonical chart path hiện có | candle data và timeframe alignment | direct query mới vào `DailyPrice` |

---

## 14. MDSU compliance map

1. Candle/OHLCV phải tiếp tục đi qua path canonical hiện có, không thêm view/query riêng trong nghiệp vụ whale route.
2. Nếu backend cần enrich thêm metrics cho KLine intelligence, enrich trong service/snapshot layer, không query trực tiếp từ view layer.
3. Cache design:
   - local memo cho frontend adapter,
   - backend cache key versioned,
   - invalidation theo symbol/timeframe/trade_date/contract_version.
4. Migration strategy:
   - additive payload,
   - feature flag,
   - parity test,
   - rollback bằng flag.

## Kết luận

Chương trình này chỉ thành công nếu đội code khóa semantics trước, dựng `Flow View Model` trước, rồi mới thêm heatmap và visual layers phía trên. Mọi nỗ lực đi ngược thứ tự đó sẽ quay lại mô hình sửa chắp vá.