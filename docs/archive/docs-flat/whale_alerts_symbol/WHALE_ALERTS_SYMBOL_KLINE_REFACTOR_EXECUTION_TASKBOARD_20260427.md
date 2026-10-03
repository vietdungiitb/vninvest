# TASKBOARD: Whale Alerts Symbol Kline Refactor

**Ngày**: 2026-04-27  
**Mục tiêu**: Giao việc theo slice cho route `whale-alerts/:symbol` với self-audit và bằng chứng bắt buộc ở từng chặng.

---

## A. Governance / Architecture Guard

- [ ] `ARC-01` Khóa immutable source files của modern dashboard bubble stack  
Owner: Tech Lead  
Estimate: 1h  
DoD: Có rule rõ trong plan/handoff/quality docs rằng `WhaleBubbleChart.jsx`, `WhaleAnalyticsTab.jsx`, `components/modern/ModularPositionDeck.jsx` là copy-only, không sửa trực tiếp.

- [ ] `ARC-02` Chốt namespace copy và file anchors mới cho whale-alerts/symbol  
Owner: Frontend Lead  
Estimate: 1h  
Dependency: ARC-01  
DoD: Handoff pack chỉ rõ file neo nguồn và file đích; không để đội code tự suy diễn vị trí mount.

- [ ] `ARC-03` Chốt data contract per-candle/per-session cho Kline technical pane và bubble selected session  
Owner: Backend Lead + Frontend Lead  
Estimate: 2h  
Dependency: ARC-02  
DoD: Có danh sách fields bắt buộc và test gates tương ứng trong traceability matrix.

---

## B. Frontend Shared Chart Foundation

- [ ] `FE-1.1` Tách/copy KlineChart khỏi `StockDetail` thành module dùng cho whale route  
Owner: Frontend Lead  
Estimate: 4h  
Dependency: ARC-03  
Anchor files: `frontend/src/pages/StockDetail.jsx`, module mới cho whale alerts  
DoD: Stock Detail vẫn chạy; whale route mount được chart mới.

- [ ] `FE-1.2` Thêm pane kỹ thuật hợp nhất và tooltip đầy đủ theo phiên  
Owner: Frontend Dev  
Estimate: 6h  
Dependency: FE-1.1  
DoD: Tooltip có OHLCV + whale buy/sell + CVD + buy/sell strength + institutional strength; có toggle ẩn/hiện.

- [ ] `FE-1.3` Thêm overlay icon cá mập cho top 10% nến đang hiển thị  
Owner: Frontend Dev  
Estimate: 4h  
Dependency: FE-1.2  
DoD: Icon recompute theo viewport; semantic màu đúng buy/sell dominance; tooltip có flag nến nổi bật cá mập.

- [ ] `FE-1.4` Đồng bộ selected-session state giữa hover/click/range change  
Owner: Frontend Dev  
Estimate: 3h  
Dependency: FE-1.3  
DoD: First load dùng latest valid session; click nến cập nhật state đúng.

---

## C. Bubble Copy-Only Integration

- [ ] `FE-2.1` Copy bubble chart stack từ modern dashboard sang namespace whale route  
Owner: Frontend Lead  
Estimate: 4h  
Dependency: ARC-01, FE-1.4  
DoD: Namespace mới hoạt động; source files bất biến không đổi.

- [ ] `FE-2.2` Gắn data adapter để bubble chart nhận phiên được click hoặc phiên mới nhất  
Owner: Frontend Dev  
Estimate: 5h  
Dependency: FE-2.1  
DoD: Click nến đổi bubble đúng phiên; first load dùng latest valid session.

- [ ] `FE-2.3` Thay bubble AI advisory bằng adapter từ Stock Detail  
Owner: Frontend Dev  
Estimate: 5h  
Dependency: FE-2.2  
DoD: Advisory ngắn, bám dữ liệu phiên đang chọn; không làm regress advisory ở Stock Detail.

- [ ] `FE-2.4` Chứng minh immutable source map bằng self-audit diff  
Owner: Frontend Lead  
Estimate: 1h  
Dependency: FE-2.3  
DoD: Có bằng chứng rõ source bubble files không bị sửa.

---

## D. Whale Route Composition and Cleanup

- [ ] `FE-3.1` Thay `DarkMoneyMasterChart` bằng Kline + bubble composite trên `whale-alerts/:symbol`  
Owner: Frontend Lead  
Estimate: 4h  
Dependency: FE-2.4  
DoD: Route trung tâm dùng Kline + bubble; old chart không còn là surface chính.

- [ ] `FE-3.2` Cô đặc `CHIẾN THUẬT W2+W4` và `NHẬN DIỆN DARK MONEY` sang cột phải  
Owner: Frontend Dev  
Estimate: 3h  
Dependency: FE-3.1  
DoD: Card gọn, rõ quyết định, không lặp thông tin trung tâm.

- [ ] `FE-3.3` Retire code cũ dư thừa và khóa route semantics mới  
Owner: Frontend Lead  
Estimate: 3h  
Dependency: FE-3.2  
DoD: Không còn dual path chart cũ; fetch thừa được gỡ.

---

## E. Stock Detail Alignment

- [ ] `FE-4.1` Chuyển `OrderFlowRadarPanel` xuống dưới KlineChart trong Stock Detail  
Owner: Frontend Dev  
Estimate: 2h  
Dependency: FE-1.1  
DoD: Layout mới đúng yêu cầu; KlineChart và advisory session vẫn ổn định.

- [ ] `FE-4.2` Regression pass cho `StockDetail` sau khi chia sẻ/copy logic chart  
Owner: Frontend Lead  
Estimate: 2h  
Dependency: FE-4.1  
DoD: Không có regression ở KlineChart, advisory session, radar, bubble cũ.

---

## F. Backend / Data Contract Support

- [ ] `BE-5.1` Bổ sung per-candle/per-session whale metrics cho Kline technical pane  
Owner: Backend Lead  
Estimate: 6h  
Dependency: ARC-03  
Anchor files: contract hiện hữu quanh `getStockPriceChart`, `getStockOrderFlow`, `getWhaleFeed`, `getWhaleAnalyticsSnapshot`  
DoD: Trả đủ fields cho chart mới mà không sinh dual-path logic mới.

- [ ] `BE-5.2` Hỗ trợ bubble snapshot theo `trade_date` hoặc selector phiên rõ ràng  
Owner: Backend Dev  
Estimate: 4h  
Dependency: BE-5.1  
DoD: Bubble session request deterministic, audit được, có fallback semantics rõ.

- [ ] `BE-5.3` Thêm quality flags / degraded semantics cho session-scoped responses nếu cần  
Owner: Backend Dev  
Estimate: 2h  
Dependency: BE-5.2  
DoD: FE có thể phân biệt thiếu dữ liệu thật với lỗi logic ghép phiên.

---

## G. QA / Self-Audit / Evidence

- [ ] `QA-6.1` Viết hoặc cập nhật regression tests cho touched backend suites  
Owner: QA Engineer  
Estimate: 4h  
Dependency: BE-5.3  
DoD: Suites whale/order-flow/analytics snapshot pass.

- [ ] `QA-6.2` Viết hoặc cập nhật regression tests cho whale-alerts/stock-detail frontend slices  
Owner: QA Engineer  
Estimate: 4h  
Dependency: FE-3.3, FE-4.2  
DoD: Có tests cho viewport shark icons, tooltip toggle, selected-session bubble sync, stockdetail regression.

- [ ] `QA-6.3` Chạy self-audit matrix và thu bằng chứng cho từng slice  
Owner: QA Lead + Slice Owner  
Estimate: 4h  
Dependency: QA-6.1, QA-6.2  
DoD: Mỗi slice có evidence pack, traceability mapping và verdict PASS/PASS WITH NOTES/FAIL.

- [ ] `OPS-6.4` Rebuild/restart dev stack bị ảnh hưởng và thu smoke evidence  
Owner: DevOps / Feature Owner  
Estimate: 2h  
Dependency: QA-6.3  
DoD: Dev stack đã lên bản mới để final auditor kiểm tra ngay.

---

## H. Delivery Gates

- [ ] Gate-1: Immutable source files không có diff runtime.
- [ ] Gate-2: `whale-alerts/:symbol` load vào là hiện latest valid session bubble.
- [ ] Gate-3: Click nến đổi bubble đúng phiên.
- [ ] Gate-4: Tooltip toggle + shark icon viewport recompute pass.
- [ ] Gate-5: `OrderFlowRadarPanel` đã nằm dưới KlineChart ở Stock Detail và không regression.
- [ ] Gate-6: Ledger + Progress Dashboard + Evidence Template đã cập nhật đầy đủ.

---

## I. Run Order Bắt Buộc

1. ARC-01 -> ARC-02 -> ARC-03
2. FE-1.1 -> FE-1.2 -> FE-1.3 -> FE-1.4
3. FE-2.1 -> FE-2.2 -> FE-2.3 -> FE-2.4
4. FE-3.1 -> FE-3.2 -> FE-3.3
5. FE-4.1 -> FE-4.2
6. BE-5.1 -> BE-5.2 -> BE-5.3
7. QA-6.1 -> QA-6.2 -> QA-6.3 -> OPS-6.4

---

## J. Evidence bắt buộc cho mỗi slice

1. Danh sách file thực tế đã đổi.
2. Validation command + kết quả.
3. Ảnh/video/screenshot nếu slice là UI semantics.
4. Network payload snapshot nếu slice chạm data contract.
5. Cập nhật `docs/CODE_CHANGE_AUDIT_LEDGER.md`.
6. Cập nhật `PROGRESS_DASHBOARD.md`.