# SELF-AUDIT AND TEST PROTOCOL - Whale Alerts Symbol Kline Refactor

## 1. Mục đích

Protocol này là checklist bắt buộc cho đội code và QA nội bộ sau mỗi slice. Mục tiêu là chặn ba kiểu sai phổ biến trước khi final auditor vào vòng cuối:

1. code chạy nhưng sai semantics phiên,
2. sửa route đích nhưng làm regress module nguồn của modern dashboard,
3. báo hoàn thành mà không có bằng chứng kiểm chứng thực tế.

## 2. Nguyên tắc vận hành

1. Không có evidence thì xem như chưa làm.
2. Không có focused validation ngay sau slice thì xem như chưa pass.
3. Không được tự đánh dấu PASS cho slice nếu chưa cập nhật ledger và progress dashboard.
4. Với slice runtime/UI, phải rebuild hoặc restart dev stack liên quan trước khi chụp bằng chứng.

## 3. Workflow audit bắt buộc cho mỗi slice

### Bước 1 - Khóa phạm vi slice

Ghi rõ:

- Slice ID
- Req ID liên quan
- File thực tế đã chạm
- Touched surface: frontend / backend / both

### Bước 2 - Focused validation ngay sau khi hoàn tất slice

#### Frontend-only slice

```powershell
Push-Location ./frontend
npm run build
Pop-Location
```

#### Backend-only slice

```powershell
Push-Location ./backend
../.venv/Scripts/python.exe manage.py test portfolio.tests.test_whale_analytics_snapshot_api --keepdb
../.venv/Scripts/python.exe manage.py test portfolio.tests.test_order_flow --keepdb
Pop-Location
```

#### Route integration slice

```powershell
Push-Location ./frontend
npm run build
Pop-Location

Push-Location ./backend
../.venv/Scripts/python.exe manage.py test portfolio.tests.test_whale_analytics_snapshot_api --keepdb
../.venv/Scripts/python.exe manage.py test portfolio.tests.test_whale_orders_ssot_parity --keepdb
Pop-Location
```

### Bước 3 - Runtime refresh nếu slice chạm UI/runtime

```powershell
docker compose -f ./docker-compose.dev.yml up -d --build frontend backend
```

Nếu chỉ đổi frontend nhưng cần audit route ngay:

```powershell
docker compose -f ./docker-compose.dev.yml up -d --build frontend
```

### Bước 4 - Thu bằng chứng

Bắt buộc lưu tối thiểu:

1. command đã chạy và trạng thái PASS/FAIL,
2. screenshot hoặc video nếu là slice UI,
3. network payload snapshot nếu slice chạm contract,
4. note residual risk nếu còn,
5. danh sách file đổi thực tế.

### Bước 5 - Đồng bộ audit docs

Sau mỗi slice đã PASS nội bộ:

1. cập nhật `docs/CODE_CHANGE_AUDIT_LEDGER.md`,
2. cập nhật `PROGRESS_DASHBOARD.md`,
3. điền evidence template của gói này.

## 4. Test matrix theo bề mặt rủi ro

## A. Kline and technical pane

### A1. Pane đồng bộ thời gian

- Kiểm tra nến, whale buy/sell, CVD, buy/sell strength, institutional strength cùng bucket thời gian.
- PASS khi hover vào một nến thì toàn bộ metric đúng phiên đó.

### A2. Tooltip toggle

- Tắt tooltip rồi hover không còn panel dữ liệu.
- Bật lại tooltip thì panel trở lại đúng trạng thái.

### A3. Shark icon viewport rule

- Zoom in / zoom out / pan chart.
- PASS khi danh sách nến có icon thay đổi theo viewport hiện tại.
- FAIL nếu icon cố định theo toàn dataset.

## B. Bubble selected-session sync

### B1. First load

- Mở `whale-alerts/:symbol` tại phiên ngoài giờ.
- PASS khi bubble chart dùng phiên giao dịch gần nhất có dữ liệu hợp lệ.

### B2. Click candle

- Click ít nhất 2 nến khác nhau.
- PASS khi bubble đổi đúng phiên; advisory cũng đổi theo phiên.

### B3. Contract proof

- Chụp network request/response cho selected session.
- PASS khi request có session selector rõ ràng (`trade_date` hoặc field tương đương) và response khớp phiên đã click.

## C. Immutable source regression

### C1. Modern dashboard source files

Kiểm tra ba file:

- `frontend/src/components/WhaleBubbleChart.jsx`
- `frontend/src/components/WhaleAnalyticsTab.jsx`
- `frontend/src/components/modern/ModularPositionDeck.jsx`

PASS khi các file này không có diff runtime của feature pack này.

## D. Stock Detail regression

### D1. Radar relocation

- Mở `stocks/:symbol`.
- PASS khi `OrderFlowRadarPanel` nằm dưới KlineChart và advisory session vẫn hoạt động.

### D2. Existing advisory stability

- Refresh advisory session.
- PASS khi flow hiện hữu không bị hỏng do refactor chart/radar.

## E. Route cleanup

### E1. Old chart retirement

- Audit `WhaleAlertsDashboard` sau cutover.
- PASS khi không còn double-mount chart cũ hoặc fetch thừa từ path retired.

## 5. Suggested frontend suites to run or extend

### Suites hiện hữu phải rerun

```powershell
Push-Location ./frontend
npm test -- --watchAll=false src/components/WhaleBubbleChart.tooltip.test.jsx
npm test -- --watchAll=false src/components/WhaleBubbleChart.sync.test.jsx
npm test -- --watchAll=false src/components/WhaleAnalytics.degraded.test.jsx
npm test -- --watchAll=false src/hooks/useWhaleAnalyticsData.test.js
Pop-Location
```

### Suites mới bắt buộc phải có trước khi đóng feature

1. Whale Alerts Symbol Kline integration test.
2. Selected-session bubble sync test.
3. Shark icon viewport recompute test.
4. Stock Detail radar relocation regression test.

## 6. Suggested backend suites to run or extend

```powershell
Push-Location ./backend
../.venv/Scripts/python.exe manage.py test portfolio.tests.test_whale_analytics_snapshot_api --keepdb
../.venv/Scripts/python.exe manage.py test portfolio.tests.test_whale_analytics_snapshot_flow_series --keepdb
../.venv/Scripts/python.exe manage.py test portfolio.tests.test_whale_orders_ssot_parity --keepdb
../.venv/Scripts/python.exe manage.py test portfolio.tests.test_order_flow --keepdb
../.venv/Scripts/python.exe manage.py test portfolio.tests.test_order_flow_source_parity --keepdb
Pop-Location
```

Nếu BE có mở rộng session selector cho bubble:

1. thêm test latest valid session fallback,
2. thêm test selected `trade_date` parity,
3. thêm test degraded semantics khi session data thiếu.

## 7. Evidence standard cho từng loại slice

### UI slice

1. `npm run build` PASS.
2. Screenshot hoặc video trước/sau.
3. Dev stack frontend rebuild log.

### Backend contract slice

1. Manage.py test PASS.
2. Payload snapshot.
3. Diễn giải ngắn về field mới và backward compatibility.

### Route integration slice

1. FE build PASS.
2. BE tests PASS.
3. Dev stack rebuild log.
4. UI screenshot + network payload + residual risk note.

## 8. Verdict rules

- `PASS`: đủ code + validation + evidence + docs sync.
- `PASS WITH NOTES`: chạy đúng nhưng còn residual risk nhỏ đã ghi rõ và không block final auditor.
- `FAIL`: thiếu một trong các gates hoặc còn xung đột semantics.

## 9. Những lỗi bị xem là blocker ngay lập tức

1. Sửa trực tiếp source bubble files của modern dashboard.
2. Bubble chart không đổi theo nến được click.
3. Tooltip hiển thị sai bucket dữ liệu.
4. Shark icons không cập nhật theo viewport.
5. `StockDetail` advisory/radar bị regress.
6. Không cập nhật ledger và progress dashboard sau slice đã claim complete.