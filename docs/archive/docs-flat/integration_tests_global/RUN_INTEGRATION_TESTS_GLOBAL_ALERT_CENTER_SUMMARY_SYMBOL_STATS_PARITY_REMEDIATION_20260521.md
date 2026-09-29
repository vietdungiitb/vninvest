# Run Integration Tests — Global Alert Center Summary-Symbol Stats Parity Remediation
**Ngày**: 2026-05-21

---

## 1. Backend suites

```powershell
Push-Location ./packages/core/backend
..\..\..\.venv\Scripts\python.exe manage.py test signal_intelligence.tests.test_alert_center_api --keepdb
..\..\..\.venv\Scripts\python.exe manage.py test signal_intelligence.tests.test_user_alert_delivery --keepdb
..\..\..\.venv\Scripts\python.exe manage.py test signal_intelligence.tests.test_ai_signal_lane --keepdb
Pop-Location
```

Required additions cho chương trình này:

1. timeframe filter tests
2. symbol-stats endpoint tests
3. invariant tests `summary.total == sum(symbol_stats.count)`
4. multi-user unseen tests

---

## 2. Frontend / packages-web tests

```powershell
Push-Location ./packages/web
npm test -- --runInBand --watch=false src/adapters/coreApiAdapter.test.js
Pop-Location
```

Required additions:

1. AlertCenterPage scope sync tests
2. UI semantics label tests

---

## 3. Runtime smoke

```powershell
.\start_dev.ps1
```

Smoke expectations:

1. `/core/v1/signals/alert-center/feed` trả dữ liệu đúng scope filter.
2. `/core/v1/signals/alert-center/summary` và `/core/v1/signals/alert-center/symbol-stats` cùng scope không lệch tổng.
3. Đổi timeframe trên UI tạo payload khác và dữ liệu phản ánh đúng.

---

## 4. Mandatory gate

Không được coi integration test là PASS nếu thiếu:

1. snapshot payload đối chiếu summary và symbol-stats.
2. screenshot UI chứng minh semantics mới.
3. residual risk note cho các hạng mục chưa đóng.
