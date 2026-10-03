# RUN INTEGRATION TESTS - Global Signal Services Control Center

## Working Directory

Toàn bộ command trong tài liệu này chạy từ thư mục gốc project bằng relative path.

## 1. Mục tiêu

Xác nhận end-to-end rằng:

1. global whale service và global dark-flow service chạy theo `effective universe` toàn cục,
2. persisted canonical event có thể tái sử dụng cho global consumers,
3. fan-out đến đúng audience tracked/watchlist,
4. admin control center đủ để vận hành cả hai service trên cùng một surface,
5. evidence đủ mạnh để final auditor ra kết luận GO / NO-GO.

## 2. Safety constraints

1. Chỉ chạy trên dev hoặc staging.
2. Không mark complete nếu chưa rebuild stack tương ứng với slice runtime/UI.
3. Nếu write action không có preview-before-apply, dừng integration và trả NO-GO ngay.

## 3. Pre-flight

### 3.1 Governance check

Xác nhận:

1. explicit consent cho coding đã tồn tại,
2. triad docs + quality constitution + traceability matrix tồn tại,
3. evidence template đã sẵn cho slice đang test.

### 3.2 Build and focused validation baseline

```powershell
Push-Location ./frontend
npm run build
Pop-Location

Push-Location ./backend
../.venv/Scripts/python.exe manage.py test portfolio.tests.test_order_flow --keepdb
Pop-Location
```

### 3.3 Runtime refresh

```powershell
docker compose -f ./docker-compose.dev.yml up -d --build frontend backend
```

## 4. Execution matrix

| Step | Scope | Expected result |
|---|---|---|
| 1 | Universe preview/apply | source counts và effective counts đúng |
| 2 | Dark-flow manual/scheduled run | `OrderFlowSignal` persist đúng và update cache |
| 3 | Whale manual/scheduled run | `WhaleAlertEvent` persist đúng và update cache |
| 4 | Distribution | tracked + watchlist users nhận signal |
| 5 | Control center summary | health, jobs, events, retention hiển thị đúng |
| 6 | Dangerous action guards | preview/confirmations hoạt động |
| 7 | Retention preview | không purge mù raw tick |

## 5. Integration test matrix

## T1. Universe preview

Pass criteria:

1. preview trả `admin_curated`, `tracked`, `watchlist`, `effective` counts,
2. apply flow yêu cầu confirmation rõ ràng.

Evidence:

1. screenshot hoặc video flow preview,
2. payload snapshot preview.

## T2. Dark-flow service run

Pass criteria:

1. run manual hoặc scheduled tạo `OrderFlowSignal` hợp lệ,
2. run summary và cache freshness cập nhật đúng.

Evidence:

1. payload snapshot signal,
2. run registry entry,
3. screenshot summary panel.

## T3. Whale service run

Pass criteria:

1. run tạo `WhaleAlertEvent` canonical,
2. không có duplicate event do multi-threshold.

Evidence:

1. payload snapshot event,
2. run registry entry,
3. dedupe note.

## T4. Distribution

Pass criteria:

1. tracked user nhận event,
2. watchlist user nhận event,
3. `UserAlertHistory` được ghi tối thiểu.

Evidence:

1. websocket/log proof,
2. history payload snapshot.

## T5. Admin control center UX

Pass criteria:

1. load summary ổn,
2. vào được các zones chính,
3. không có white screen,
4. list lớn dùng phân trang đúng chuẩn.

Evidence:

1. screenshot từng zone,
2. video chuyển tab/route,
3. pagination proof.

## T6. Dangerous action guard

Pass criteria:

1. config apply có preview,
2. universe apply có preview,
3. retention purge có preview.

Evidence:

1. video hoặc chuỗi screenshot,
2. payload preview proof.

## T7. Retention safety

Pass criteria:

1. raw tick purge bị chặn nếu canonical safety chưa đạt,
2. preview hiển thị impacted rows và earliest retained date.

Evidence:

1. preview payload,
2. operator note.

## 6. Reporting format

| Test ID | Kết quả | Evidence | Notes |
|---|---|---|---|
| T1 | PASS / FAIL | ____ | ____ |
| T2 | PASS / FAIL | ____ | ____ |
| T3 | PASS / FAIL | ____ | ____ |
| T4 | PASS / FAIL | ____ | ____ |
| T5 | PASS / FAIL | ____ | ____ |
| T6 | PASS / FAIL | ____ | ____ |
| T7 | PASS / FAIL | ____ | ____ |

## 7. GO / NO-GO rules

### GO khi đồng thời đúng

1. frontend build pass,
2. focused backend suites pass,
3. T1-T7 pass hoặc tối đa 1 mục `PASS WITH NOTES` không ảnh hưởng SSOT/detection/distribution,
4. preview-before-apply guard tồn tại ở mọi write action,
5. ledger + progress dashboard + evidence template đã cập nhật.

### NO-GO nếu xảy ra một trong các lỗi sau

1. detector còn phụ thuộc user-specific threshold,
2. whale global không persist canonical event riêng,
3. dark-flow severity vẫn flatten theo whale ratio,
4. tracked hoặc watchlist audience bị bỏ sót,
5. retention purge không có preview safety gate,
6. control center vẫn buộc operator chuyển qua nhiều surface cũ để hoàn tất một workflow.