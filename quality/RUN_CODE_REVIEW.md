# RUN CODE REVIEW - Whale Alerts Symbol KLine Intelligence Upgrade

## 1. Bootstrap files phải đọc trước khi review

1. `docs/WHALE_ALERTS_SYMBOL_KLINE_INTELLIGENCE_UPGRADE_HANDOFF_MASTER_20260428.md`
2. `docs/IMPLEMENTATION_PLAN_WHALE_ALERTS_SYMBOL_KLINE_INTELLIGENCE_UPGRADE_20260428.md`
3. `docs/TECH_SPEC_WHALE_ALERTS_SYMBOL_KLINE_INTELLIGENCE_UPGRADE_20260428.md`
4. `docs/WHALE_ALERTS_SYMBOL_KLINE_INTELLIGENCE_UPGRADE_TRACEABILITY_MATRIX_20260428.md`
5. `docs/WHALE_ALERTS_SYMBOL_KLINE_INTELLIGENCE_UPGRADE_SELF_AUDIT_AND_TEST_PROTOCOL_20260428.md`
5. `quality/QUALITY.md`
6. `AGENTS.md`

## 2. Focus areas bắt buộc

### A. Route composition correctness

- `frontend/src/pages/WhaleAlertsDashboard.jsx`
- Route có thực sự dùng KLine intelligence workspace hay chỉ chồng thêm UI lên chart cũ?

### B. Flow View Model parity

- `frontend/src/components/KLineChartPanel.jsx`
- namespace mới `frontend/src/features/whale-alerts/kline/`
- Tooltip, pane, heatmap và marker có thực sự cùng bucket hay không?

### C. Immutable source protection

- `frontend/src/components/WhaleBubbleChart.jsx`
- `frontend/src/components/WhaleAnalyticsTab.jsx`
- `frontend/src/components/modern/ModularPositionDeck.jsx`
- Các file này phải được kiểm diff đầu tiên.

### D. Selected-session truth

- Kiểm luồng state từ Kline click -> selected session -> bubble request -> advisory context.

### E. Heatmap semantics

- Kiểm mode `Off`, `Net`, `Buy`, `Sell`.
- Kiểm màu và intensity có phản ánh đúng field payload hay không.

### F. Viewport-dependent shark icons

- Kiểm logic visible range listener, top 10% calculation và cleanup khi pan/zoom/timeframe.

### G. Stock Detail regression

- Kiểm move Radar xuống dưới KlineChart có phá layout hoặc advisory flow hay không.

## 3. Guardrails bắt buộc khi review

1. Line numbers là bắt buộc. Không có line number thì không được ghi finding.
2. Phải đọc body function/component, không review theo tên hàm hoặc import.
3. Nếu chưa chắc là bug, ghi `QUESTION` thay vì `BUG`.
4. Phải grep hoặc đối chiếu code trước khi kết luận “thiếu update i18n”, “thiếu cleanup”, “source file bị sửa”.
5. Không đưa style nit, chỉ nêu bug/risk/regression/missing test.

## 4. Review checklist theo rủi ro

### Checklist R1 - Bubble source immutability

- [ ] Không có diff runtime trong 3 source files bất biến.
- [ ] Route whale-alerts/symbol mount copy/adapter riêng.

### Checklist R2 - Selected session parity

- [ ] First load dùng latest valid session.
- [ ] Click nến đổi bubble đúng phiên.
- [ ] Advisory dùng selected session, không dùng toàn symbol fallback.

### Checklist R3 - Flow parity semantics

- [ ] Tooltip, pane, heatmap và marker cùng bucket.
- [ ] `CVD raw` và `CVD normalized` không bị nhập nhằng.

### Checklist R4 - Heatmap semantics

- [ ] Heatmap mode đúng với payload `Net/Buy/Sell`.
- [ ] Heatmap không che mất candle readability.
- [ ] Degraded-state hiển thị đúng khi confidence thấp.

### Checklist R5 - Tooltip semantics

- [ ] Tooltip lấy đúng bucket của nến hover.
- [ ] Toggle ẩn/hiện hoạt động.

### Checklist R6 - Shark icon viewport rule

- [ ] Top 10% tính theo viewport hiện tại.
- [ ] Logic recompute khi zoom/pan.
- [ ] Không có memory leak hoặc interval thừa.

### Checklist R7 - Cleanup and retirement

- [ ] Route whale-alerts/symbol không còn dual path chart cũ.
- [ ] Fetch/realtime subscriptions cũ được cleanup.

## 5. Regression test generation sau review

Nếu review nêu BUG findings, phải viết hoặc yêu cầu viết regression tests tương ứng theo nhóm sau:

1. Flow View Model bucket parity test.
2. Heatmap mode semantics test.
3. Kline selected-session sync test.
4. Shark icon viewport recompute test.
5. Immutable source protection check trong code review evidence.
6. Stock Detail parity regression test.
7. Backend session selector / payload contract test nếu có diff BE.

## 6. Output format bắt buộc

Mỗi finding phải có đúng format:

1. Severity: `P0` / `P1` / `P2` / `QUESTION`
2. File + line number
3. Hành vi sai hoặc rủi ro
4. Tác động người dùng hoặc rủi ro hệ thống
5. Test/evidence thiếu hoặc cần bổ sung

Ví dụ format:

```text
P1 - frontend/src/pages/WhaleAlertsDashboard.jsx:123
Bubble selected-session state được set ở click handler nhưng không reset khi symbol đổi, nên route có thể mang bubble của symbol trước sang symbol mới.
Impact: người dùng thấy bubble/advisory sai mã dù URL đã đổi.
Missing proof: chưa có regression test cho symbol switch + latest session reset.
```