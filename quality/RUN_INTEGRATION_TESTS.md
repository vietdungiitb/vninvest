# RUN INTEGRATION TESTS - Whale Alerts Symbol KLine Intelligence Upgrade

## Working Directory

Toàn bộ command trong tài liệu này chạy từ thư mục gốc project bằng relative path.

## 1. Mục tiêu

Xác nhận end-to-end rằng:

1. `whale-alerts/:symbol` dùng KlineChart mới và bubble chart theo phiên.
2. `pane CVD`, `pane strength`, `heatmap`, `whale marker` và tooltip cùng đúng semantics bucket.
2. Bubble source của modern dashboard không bị regress.
3. `StockDetail` vẫn ổn sau khi di chuyển Radar.
4. Evidence đủ mạnh để final auditor ra kết luận GO / NO-GO.

## 2. Safety constraints

1. Chỉ chạy trên dev hoặc staging.
2. Không mark complete nếu chưa rebuild stack tương ứng với slice runtime/UI.
3. Nếu có diff ở immutable source files, dừng test integration và trả NO-GO ngay.

## 3. Pre-flight

### 3.1 Source immutability check

Kiểm tra diff cho 3 file:

- `frontend/src/components/WhaleBubbleChart.jsx`
- `frontend/src/components/WhaleAnalyticsTab.jsx`
- `frontend/src/components/modern/ModularPositionDeck.jsx`

Nếu có diff runtime không được phê duyệt: dừng toàn bộ test.

### 3.2 Build and focused backend validation

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

### 3.3 Runtime refresh

```powershell
docker compose -f ./docker-compose.dev.yml up -d --build frontend backend
```

## 4. Execution UX

Trước khi chạy, người thực thi phải công bố plan dạng bảng:

| Step | Scope | Expected result |
|---|---|---|
| 1 | Build + backend focused suites | Green baseline |
| 2 | Whale Alerts route smoke | KLine + pane CVD + pane strength + latest session bubble |
| 3 | Heatmap and marker smoke | Mode switch + viewport recompute đúng |
| 4 | Session click smoke | Bubble/advisory đổi đúng phiên |
| 5 | Modern dashboard regression smoke | Source route không đổi hành vi |
| 6 | Stock Detail regression smoke | Radar ở vị trí mới, advisory ổn |

Trong lúc chạy phải báo tiến độ một dòng mỗi bước:

- `⧗ Step 2 - Whale Alerts route smoke đang chạy`
- `✓ Step 2 - PASS`
- `✗ Step 2 - FAIL: bubble không đổi theo session click`

Kết thúc phải có summary table + recommendation GO / NO-GO.

## 5. Integration test matrix

## T1. Whale Alerts first load

Mục tiêu:
- Route `whale-alerts/:symbol` mở vào là có KlineChart mới và bubble của phiên gần nhất.

Pass criteria:
- KlineChart hiển thị.
- Bubble chart hiển thị dữ liệu phiên gần nhất.
- Không có chart cũ làm surface chính.

Evidence:
- screenshot toàn trang,
- payload snapshot của bubble first load.

## T2. Heatmap and flow-pane semantics

Mục tiêu:
- Heatmap, pane CVD và pane strength phản ánh đúng payload cùng bucket.

Pass criteria:
- Chuyển được 4 mode `Off/Net/Buy/Sell`.
- Heatmap không che candle quá mức.
- Pane CVD hiển thị đúng `CVD normalized` và baseline `50`.
- Pane strength hiển thị đúng `Buy Strength` và `Institutional Strength`.

Evidence:
- screenshot cho từng mode,
- payload snapshot cùng bucket,
- tooltip proof cho `CVD raw`.

## T3. Session click sync

Mục tiêu:
- Click 2 nến khác nhau phải đổi bubble và advisory theo phiên tương ứng.

Pass criteria:
- Bubble đổi theo nến click.
- Advisory đổi ngữ cảnh theo phiên.

Evidence:
- video hoặc chuỗi screenshot,
- request/response có session selector rõ.

## T4. Tooltip + shark icon viewport

Mục tiêu:
- Tooltip đúng bucket và icon cá mập recompute theo viewport.

Pass criteria:
- Toggle tooltip hoạt động.
- Zoom/pan làm danh sách icon thay đổi hợp lý.

Evidence:
- video zoom/pan,
- note đối chiếu top 10% visible candles.

## T5. Modern dashboard regression smoke

Mục tiêu:
- Whale analytics trên modern dashboard vẫn hoạt động như trước.

Pass criteria:
- Route/Tab nguồn render được.
- Không có regression semantics dễ thấy.

Evidence:
- screenshot modern dashboard bubble,
- source immutability diff proof.

## T6. Stock Detail regression smoke

Mục tiêu:
- Radar nằm dưới KlineChart và advisory session không regress.

Pass criteria:
- Layout đúng.
- Advisory refresh vẫn hoạt động.

Evidence:
- screenshot Stock Detail,
- advisory refresh result.

## 6. Reporting format

| Test ID | Kết quả | Evidence | Notes |
|---|---|---|---|
| T1 | PASS / FAIL | ____ | ____ |
| T2 | PASS / FAIL | ____ | ____ |
| T3 | PASS / FAIL | ____ | ____ |
| T4 | PASS / FAIL | ____ | ____ |
| T5 | PASS / FAIL | ____ | ____ |
| T6 | PASS / FAIL | ____ | ____ |

## 7. GO / NO-GO rules

### GO khi đồng thời đúng

1. Frontend build pass.
2. Backend focused suites pass.
3. T1-T6 pass hoặc tối đa `PASS WITH NOTES` cho một mục không ảnh hưởng semantics cốt lõi.
4. Immutable source files sạch.
5. Ledger + progress dashboard + evidence template đã cập nhật.

### NO-GO nếu xảy ra một trong các lỗi sau

2. Bubble không đổi theo selected session.
3. Heatmap sai semantics hoặc che mất candle nghiêm trọng.
4. Tooltip sai bucket.
5. Shark icon không recompute theo viewport.
6. Modern dashboard source bị regress hoặc bị sửa trực tiếp.
7. Stock Detail advisory/radar regress.