# RUN CODE REVIEW - Whale Alerts Symbol Kline Refactor

## 1. Bootstrap files phải đọc trước khi review

1. `docs/WHALE_ALERTS_SYMBOL_KLINE_REFACTOR_HANDOFF_MASTER_20260427.md`
2. `docs/WHALE_ALERTS_SYMBOL_KLINE_REFACTOR_EXECUTION_PLAN_20260427.md`
3. `docs/WHALE_ALERTS_SYMBOL_KLINE_REFACTOR_TRACEABILITY_MATRIX_20260427.md`
4. `docs/WHALE_ALERTS_SYMBOL_KLINE_REFACTOR_SELF_AUDIT_AND_TEST_PROTOCOL_20260427.md`
5. `quality/QUALITY.md`
6. `AGENTS.md`

## 2. Focus areas bắt buộc

### A. Route composition correctness

- `frontend/src/pages/WhaleAlertsDashboard.jsx`
- Route có thực sự dùng Kline + selected-session bubble hay chỉ chồng thêm UI lên chart cũ?

### B. Immutable source protection

- `frontend/src/components/WhaleBubbleChart.jsx`
- `frontend/src/components/WhaleAnalyticsTab.jsx`
- `frontend/src/components/modern/ModularPositionDeck.jsx`
- Các file này phải được kiểm diff đầu tiên.

### C. Selected-session truth

- Kiểm luồng state từ Kline click -> selected session -> bubble request -> advisory context.

### D. Viewport-dependent shark icons

- Kiểm logic visible range listener, top 10% calculation và cleanup khi pan/zoom/timeframe.

### E. Stock Detail regression

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

### Checklist R3 - Tooltip semantics

- [ ] Tooltip lấy đúng bucket của nến hover.
- [ ] Toggle ẩn/hiện hoạt động.

### Checklist R4 - Shark icon viewport rule

- [ ] Top 10% tính theo viewport hiện tại.
- [ ] Logic recompute khi zoom/pan.
- [ ] Không có memory leak hoặc interval thừa.

### Checklist R5 - Cleanup and retirement

- [ ] Route whale-alerts/symbol không còn dual path chart cũ.
- [ ] Fetch/realtime subscriptions cũ được cleanup.

## 5. Regression test generation sau review

Nếu review nêu BUG findings, phải viết hoặc yêu cầu viết regression tests tương ứng theo nhóm sau:

1. Kline selected-session sync test.
2. Shark icon viewport recompute test.
3. Immutable source protection check trong code review evidence.
4. Stock Detail radar relocation regression test.
5. Backend session selector / payload contract test nếu có diff BE.

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