# SELF-AUDIT AND TEST PROTOCOL - Whale Alerts Symbol KLine Intelligence Upgrade

## 1. Mục đích

Protocol này là checklist bắt buộc cho đội code và QA nội bộ sau mỗi slice của chương trình KLine intelligence.

Mục tiêu là chặn sớm 5 nhóm lỗi:

1. chart nhìn đúng nhưng lệch bucket,
2. heatmap đẹp nhưng sai semantics,
3. whale marker không recompute theo viewport,
4. selected session drift sang bubble/advisory,
5. báo hoàn thành nhưng thiếu evidence hoặc thiếu doc sync.

## 2. Nguyên tắc vận hành

1. Không có evidence thì xem như chưa làm.
2. Không có focused validation ngay sau edit đầu tiên thì slice chưa pass.
3. Nếu UI/runtime thay đổi mà chưa refresh stack thì chưa được chụp evidence final.
4. Nếu đụng docs trong `docs/` mà chưa sync ledger/progress thì xem như chưa hoàn thành slice.

## 3. Workflow audit bắt buộc cho mỗi slice

### Bước 1 - Khóa phạm vi slice

Ghi rõ:

1. Slice ID
2. Req IDs liên quan
3. File thực tế đã chạm
4. Loại slice: frontend / backend / integration / docs-only

### Bước 2 - Focused validation ngay sau slice

#### Frontend-only slice

```powershell
Push-Location ./frontend
npm run build
Pop-Location
```

Nếu có suite hẹp cho slice:

```powershell
Push-Location ./frontend
npm test -- --watchAll=false <test-path>
Pop-Location
```

#### Backend-only slice

```powershell
Push-Location ./backend
../.venv/Scripts/python.exe manage.py test portfolio.tests.test_whale_analytics_snapshot_api --keepdb
../.venv/Scripts/python.exe manage.py test portfolio.tests.test_whale_analytics_snapshot_flow_series --keepdb
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
../.venv/Scripts/python.exe manage.py test portfolio.tests.test_order_flow --keepdb
Pop-Location
```

#### Docs-only slice

Validation tối thiểu:

1. đối chiếu cross-reference giữa docs,
2. kiểm tra naming consistency,
3. sync `docs/CODE_CHANGE_AUDIT_LEDGER.md` và `PROGRESS_DASHBOARD.md`.

### Bước 3 - Runtime refresh nếu slice chạm UI/runtime

```powershell
docker compose -f ./docker-compose.dev.yml up -d --build frontend backend
```

### Bước 4 - Thu bằng chứng

Bắt buộc lưu tối thiểu:

1. command đã chạy và PASS/FAIL,
2. screenshot hoặc video nếu slice là UI,
3. payload snapshot nếu slice chạm contract,
4. note residual risk,
5. danh sách file đổi thực tế.

### Bước 5 - Đồng bộ audit docs

Sau mỗi slice đã PASS nội bộ:

1. cập nhật `docs/CODE_CHANGE_AUDIT_LEDGER.md`,
2. cập nhật `PROGRESS_DASHBOARD.md`,
3. điền evidence template của pack này.

## 4. Test matrix theo bề mặt rủi ro

## A. Flow View Model parity

### A1. Canonical bucket parity

PASS khi cùng một candle bucket cho ra cùng timestamp ở:

1. tooltip,
2. Flow Compare pane,
3. heatmap,
4. whale marker selection.

### A2. Symbol/timeframe reset

PASS khi selected session cũ không bị carry sang symbol mới hoặc timeframe không còn hợp lệ.

## B. Flow Compare pane

### B1. Pane semantics

PASS khi pane hiển thị đủ:

1. CVD normalized,
2. Buy Strength,
3. Institutional Strength,
4. Baseline 50.

### B2. Line toggle

PASS khi toggle line không làm mutate source data và không gây lệch badge/value.

### B3. Last-value badges

PASS khi badge đúng giá trị bucket cuối cùng đang render.

## C. Heatmap

### C1. Mode switching

PASS khi `Off`, `Net`, `Buy`, `Sell` đổi semantics đúng.

### C2. Confidence / degraded state

PASS khi heatmap giảm nhấn mạnh hoặc hiện degraded state nếu dữ liệu thiếu.

### C3. Readability

PASS khi candle body vẫn đọc rõ, không bị heatmap che phủ quá mức.

## D. Whale marker

### D1. Viewport recompute

PASS khi zoom/pan/timeframe change làm marker recompute đúng theo viewport hiện tại.

### D2. Density guardrail

PASS khi số lượng marker bám top `max(1, ceil(visible*10%))`.

### D3. Dominance semantics

PASS khi marker side và màu phản ánh dominance đúng.

## E. Selected session sync

### E1. First load

PASS khi route dùng latest valid session.

### E2. Candle click

PASS khi click 2 nến khác nhau làm bubble và advisory đổi đúng phiên.

### E3. Symbol switch

PASS khi đổi symbol không còn stale selected session từ symbol trước.

## F. Immutable source regression

Kiểm tra ba file:

1. `frontend/src/components/WhaleBubbleChart.jsx`
2. `frontend/src/components/WhaleAnalyticsTab.jsx`
3. `frontend/src/components/modern/ModularPositionDeck.jsx`

PASS khi các file này không có diff runtime.

## G. Performance / contract

### G1. Snapshot payload

PASS khi payload additive và có `quality_flags` đúng.

### G2. Cold path

PASS khi response time nằm trong ngưỡng đã chốt ở ARC-03 hoặc có mitigation note rõ.

## H. Stock Detail parity

PASS khi Stock Detail vẫn đúng chart semantics, radar placement và advisory behavior sau khi shared chart surface đổi.

## 5. Suggested frontend suites to run or create

```powershell
Push-Location ./frontend
npm test -- --watchAll=false src/components/KLineChartPanel.flow-compare.test.jsx
npm test -- --watchAll=false src/components/KLineChartPanel.heatmap.test.jsx
npm test -- --watchAll=false src/components/KLineChartPanel.whale-marker-viewport.test.jsx
npm test -- --watchAll=false src/components/KLineChartPanel.tooltip-v2.test.jsx
npm test -- --watchAll=false src/pages/WhaleAlertsDashboard.kline-session-sync.test.jsx
npm test -- --watchAll=false src/pages/StockDetail.kline-parity.test.jsx
Pop-Location
```

## 6. Suggested backend suites to run or create

```powershell
Push-Location ./backend
../.venv/Scripts/python.exe manage.py test portfolio.tests.test_whale_analytics_snapshot_api --keepdb
../.venv/Scripts/python.exe manage.py test portfolio.tests.test_whale_analytics_snapshot_flow_series --keepdb
../.venv/Scripts/python.exe manage.py test portfolio.tests.test_whale_orders_ssot_parity --keepdb
../.venv/Scripts/python.exe manage.py test portfolio.tests.test_order_flow --keepdb
../.venv/Scripts/python.exe manage.py test portfolio.tests.test_order_flow_source_parity --keepdb
Pop-Location
```

Nếu contract heatmap/quality flags được mở rộng, bắt buộc thêm suite riêng cho:

1. `heatmap_series`
2. `marker_series`
3. `quality_flags`
4. `default_trade_date`

## 7. Evidence standard theo loại slice

### UI slice

1. Build pass.
2. Screenshot/video.
3. Runtime refresh log.
4. Residual risk note.

### Backend contract slice

1. Focused suites pass.
2. Payload snapshot.
3. Giải thích backward compatibility.
4. Timing evidence nếu chạm performance.

### Docs-only slice

1. Audit report doc cho bundle thay đổi.
2. Ledger/progress sync.
3. Cross-reference review note.

## 8. Verdict rules

1. `PASS`: đủ code/docs + validation + evidence + sync.
2. `PASS WITH NOTES`: chạy đúng nhưng còn residual risk nhỏ đã ghi rõ.
3. `FAIL`: thiếu gate, thiếu evidence, hoặc còn xung đột semantics.

## 9. Blockers ngay lập tức

1. Heatmap lệch bucket với candle.
2. Whale marker không tính theo viewport.
3. Bubble/advisory không đổi theo selected session.
4. Source bubble files bị sửa trực tiếp.
5. Degraded state bị ẩn dù payload đã báo thiếu dữ liệu.
6. Không sync ledger/progress sau slice đã claim complete.