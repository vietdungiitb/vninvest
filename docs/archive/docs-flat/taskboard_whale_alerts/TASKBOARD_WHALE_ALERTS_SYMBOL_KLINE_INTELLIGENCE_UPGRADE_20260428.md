# TASKBOARD - Whale Alerts Symbol KLine Intelligence Upgrade

**Ngày**: 2026-04-28  
**Mục tiêu**: Điều phối triển khai KLine intelligence workspace theo slice có owner, test gate và evidence bắt buộc.

---

## A. Governance / Contract Freeze

- [ ] `ARC-01` Khóa semantics của `CVD raw`, `CVD normalized`, `Buy Strength`, `Institutional Strength`, `Heat Level`, `Whale Score`  
Owner: Tech Lead  
Estimate: 2h  
DoD: Tech Spec có công thức hoặc quy tắc khóa; traceability matrix map đủ Req IDs.  
Test gate: Review sign-off trên Tech Spec.  
Evidence: Biên bản sign-off + file docs sync.

- [ ] `ARC-02` Khóa SSOT integration map và feature flags  
Owner: Tech Lead + Backend Lead  
Estimate: 1.5h  
Dependency: ARC-01  
DoD: Không còn ambiguity về canonical route/domain/flag.  
Test gate: Handoff Master + Implementation Plan đồng bộ.  
Evidence: Table SSOT và feature flag list.

- [ ] `ARC-03` Khóa contract sections và quality states của snapshot  
Owner: Backend Lead + Frontend Lead  
Estimate: 2h  
Dependency: ARC-02  
DoD: Payload sections, degraded states, cache key versioning được chốt.  
Test gate: Tech Spec section contract approved.  
Evidence: Payload draft + traceability mapping.

---

## B. Frontend Data Foundation

- [ ] `FE-1.1` Tạo `Flow View Model` adapter  
Owner: Frontend Lead  
Estimate: 4h  
Dependency: ARC-03  
Anchor files: `frontend/src/components/KLineChartPanel.jsx`, namespace mới `frontend/src/features/whale-alerts/kline/`  
DoD: Tooltip/pane/marker/heatmap dùng cùng data model in-memory.  
Test gate: Unit tests cho bucket mapping pass.  
Evidence: file list + adapter tests + screenshot debug panel nếu có.

- [ ] `FE-1.2` Chuẩn hóa canonical minute mapping trên toàn surface  
Owner: Frontend Dev  
Estimate: 3h  
Dependency: FE-1.1  
DoD: Không còn self-lookup timestamp rải rác.  
Test gate: bucket parity tests pass.  
Evidence: diff + parity test output.

- [ ] `FE-1.3` Persist chart state và reset đúng khi đổi symbol  
Owner: Frontend Dev  
Estimate: 3h  
Dependency: FE-1.2  
DoD: timeframe, heatmap mode, line visibility, tooltip state được lưu hợp lý; symbol switch không carry stale session.  
Test gate: state persistence test + symbol switch regression test.  
Evidence: UI video ngắn + test output.

---

## C. Backend Contract Expansion

- [ ] `BE-2.1` Mở rộng `whale analytics snapshot` cho `flow_compare_series`  
Owner: Backend Lead  
Estimate: 4h  
Dependency: ARC-03  
Anchor files: `backend/portfolio/services_whale_analytics_snapshot.py`, `backend/portfolio/views_whale_analytics.py`  
DoD: additive payload section hoạt động với consumer cũ.  
Test gate: snapshot API regression pass.  
Evidence: payload snapshot + test output.

- [ ] `BE-2.2` Thêm `heatmap_series`, `marker_series`, `quality_flags`, `session_context`  
Owner: Backend Dev  
Estimate: 5h  
Dependency: BE-2.1  
DoD: payload đủ cho heatmap/marker/degraded-state rendering.  
Test gate: contract tests + parity tests pass.  
Evidence: payload snapshot + field verification table.

- [ ] `BE-2.3` Cache versioning và performance hardening  
Owner: Backend Dev  
Estimate: 4h  
Dependency: BE-2.2  
DoD: cache key versioned, cold-path trong ngưỡng chấp nhận.  
Test gate: focused API tests + timing evidence.  
Evidence: response timing log + cache key note.

---

## D. KLine Intelligence Surface

- [ ] `FE-3.1` Dựng 2 flow technical panes  
Owner: Frontend Lead  
Estimate: 6h  
Dependency: FE-1.2, BE-2.1  
DoD: pane CVD hiển thị `CVD normalized` + baseline; pane strength hiển thị `Buy Strength` + `Institutional Strength`; cả hai cùng trục X và không lệch bucket.  
Test gate: flow-pane rendering tests + build pass.  
Evidence: screenshot 2 pane + payload parity proof.

- [ ] `FE-3.2` Tooltip v2 và last-value badges  
Owner: Frontend Dev  
Estimate: 4h  
Dependency: FE-3.1  
DoD: Tooltip có đầy đủ ngữ cảnh flow; badges hiển thị đúng giá trị cuối.  
Test gate: tooltip tests + visual proof.  
Evidence: screenshot hover + test output.

- [ ] `FE-3.3` Inline line toggles và degraded-state UX  
Owner: Frontend Dev  
Estimate: 4h  
Dependency: FE-3.2, BE-2.2  
DoD: line toggles hoạt động; quality-state hiển thị rõ.  
Test gate: toggle regression + degraded state test.  
Evidence: UI video + payload snapshot degraded case.

---

## E. Heatmap and Whale Marker

- [ ] `FE-4.1` Render heatmap overlay theo mode `Off/Net/Buy/Sell`  
Owner: Frontend Lead  
Estimate: 5h  
Dependency: FE-1.2, BE-2.2  
DoD: heatmap hiển thị đúng semantics màu và không phá candle readability.  
Test gate: heatmap mode tests + build pass.  
Evidence: screenshot 4 mode + payload proof.

- [ ] `FE-4.2` Chuẩn hóa whale marker scoring và viewport recompute  
Owner: Frontend Dev  
Estimate: 4h  
Dependency: FE-4.1, BE-2.2  
DoD: marker bám top 10% visible candles theo score đã khóa.  
Test gate: viewport recompute tests.  
Evidence: zoom/pan video + score explanation note.

- [ ] `FE-4.3` Guardrail mật độ marker và hover parity  
Owner: Frontend Dev  
Estimate: 2h  
Dependency: FE-4.2  
DoD: marker không gây nhiễu ở viewport hẹp; hover không lệch bucket.  
Test gate: hover parity test + manual smoke.  
Evidence: side-by-side screenshot trước/sau zoom.

---

## F. Route Integration and Parity

- [ ] `FE-5.1` Củng cố selected-session truth trên Whale Alerts route  
Owner: Frontend Lead  
Estimate: 4h  
Dependency: FE-3.3, FE-4.3  
DoD: bubble và advisory đổi đúng theo session click; first load dùng latest valid session.  
Test gate: session sync tests pass.  
Evidence: video click 2 phiên + payload snapshot.

- [ ] `FE-5.2` Stock Detail parity và shared behavior regression pass  
Owner: Frontend Dev  
Estimate: 3h  
Dependency: FE-5.1  
DoD: Stock Detail không regress về chart, radar, advisory semantics.  
Test gate: Stock Detail regression tests.  
Evidence: screenshot + smoke checklist.

- [ ] `FE-5.3` Retire code path hoặc computation path dư thừa  
Owner: Frontend Lead  
Estimate: 3h  
Dependency: FE-5.2, BE-2.3  
DoD: không còn dual-truth hoặc fallback ngầm làm sai semantics.  
Test gate: code review + integration smoke.  
Evidence: diff proof + review note.

---

## G. QA / Evidence / Ops

- [ ] `QA-6.1` Cập nhật backend suites  
Owner: QA Engineer  
Estimate: 4h  
Dependency: BE-2.3  
DoD: snapshot/flow/order-flow/heatmap contract suites pass.  
Test gate: manage.py test pass.  
Evidence: test output log.

- [ ] `QA-6.2` Cập nhật frontend suites  
Owner: QA Engineer  
Estimate: 5h  
Dependency: FE-5.3  
DoD: pane/tooltip/heatmap/marker/session-sync/stock-detail suites pass.  
Test gate: frontend tests + build pass.  
Evidence: test output log.

- [ ] `QA-6.3` Chạy integration matrix và thu bằng chứng cho từng slice  
Owner: QA Lead  
Estimate: 4h  
Dependency: QA-6.1, QA-6.2  
DoD: mỗi slice có evidence pack và verdict.  
Test gate: integration checklist hoàn tất.  
Evidence: evidence template đã điền.

- [ ] `OPS-6.4` Rebuild/restart runtime và smoke final auditor  
Owner: Feature Owner / Ops  
Estimate: 2h  
Dependency: QA-6.3  
DoD: dev stack sẵn sàng để final auditor kiểm tra ngay.  
Test gate: route smoke pass.  
Evidence: rebuild log + runtime smoke result.

- [ ] `DOC-6.5` Ghi walkthrough / closure docs khi kết thúc execution  
Owner: Slice Owner  
Estimate: 1.5h  
Dependency: OPS-6.4  
DoD: có walkthrough, evidence pack và closeout note trong `docs/`.  
Test gate: documentation completeness review.  
Evidence: file paths + ledger sync.

---

## H. Delivery gates

- [ ] Gate-1: Tech Spec semantics đã được khóa.
- [ ] Gate-2: Pane CVD và pane strength hoạt động và không lệch bucket.
- [ ] Gate-3: Heatmap semantics đúng cho 4 mode.
- [ ] Gate-4: Whale marker recompute đúng theo viewport.
- [ ] Gate-5: Bubble/advisory selected session không regress.
- [ ] Gate-6: Bubble source immutable files sạch.
- [ ] Gate-7: QA evidence pack và docs sync đầy đủ.

---

## I. Run order bắt buộc

1. ARC-01 -> ARC-02 -> ARC-03
2. FE-1.1 -> FE-1.2 -> FE-1.3
3. BE-2.1 -> BE-2.2 -> BE-2.3
4. FE-3.1 -> FE-3.2 -> FE-3.3
5. FE-4.1 -> FE-4.2 -> FE-4.3
6. FE-5.1 -> FE-5.2 -> FE-5.3
7. QA-6.1 -> QA-6.2 -> QA-6.3 -> OPS-6.4 -> DOC-6.5

---

## J. Evidence bắt buộc cho mỗi slice

1. Danh sách file thay đổi thực tế.
2. Validation command và kết quả.
3. Screenshot/video nếu là UI semantics.
4. Payload snapshot nếu slice chạm contract.
5. Residual risk note.
6. Cập nhật `docs/CODE_CHANGE_AUDIT_LEDGER.md`.
7. Cập nhật `PROGRESS_DASHBOARD.md`.