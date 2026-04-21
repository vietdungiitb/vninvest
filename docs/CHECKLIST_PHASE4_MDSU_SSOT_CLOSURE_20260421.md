# CHECKLIST PHASE 4: MDSU SSOT Closure [DONE] ✅

**Ngày hoàn thành**: 2026-04-21  
**Trạng thái**: PASSED 100%
**Mục tiêu**: Đã đóng toàn bộ direct `DailyPrice.objects` ở business read-path còn sót để đạt full SSOT thực tế.

---

## 1) Migration các call-site còn sót

### A. `backend/portfolio/analytics.py`
- [x] Migrate call-site L93 sang `MarketDataService.get_ohlcv_batch(...)`
- [x] Migrate call-site L225 sang `MarketDataService.get_latest_snapshot(...)`
- [x] Migrate call-site L268 sang `MarketDataService.get_ohlcv_batch(...)`
- [x] Migrate call-site L805 sang `MarketDataService.get_ohlcv_batch(...)`

### B. `backend/portfolio/ai_advisory_helpers.py`
- [x] Migrate call-site L957 sang `MarketDataService.get_historical_indicators(...)`
- [x] Migrate call-site L1038 sang `MarketDataService.get_historical_indicators(...)`

### C. `backend/portfolio/ai_context.py`
- [x] Migrate call-site L55 sang `MarketDataService.get_historical_indicators(...)`

### D. `backend/portfolio/tasks_signal_verification.py`
- [x] Migrate call-site L43 (`count`) sang API service phù hợp
- [x] Migrate call-site L50 (`get`) sang API service phù hợp

### E. `backend/portfolio/services.py`
- [x] Migrate call-site L1705 (`get_price_changes`) sang `MarketDataService`

---

## 2) Củng cố Gate Test chống regression

File mục tiêu: `backend/portfolio/tests/test_mdsu_gate.py`

- [x] Bổ sung vào `MIGRATED_FILES`: (Tổng cộng 14 modules)
- [x] Mở rộng pattern cấm để bắt đủ các dạng: `.filter(`, `.get(`, `.count(`, `.annotate(`, `.order_by(`
- [x] Chốt kiểm tra cứng no-direct-query cho toàn bộ 14 business modules.

---

## 3) Verification bắt buộc

- [x] Chạy `portfolio.tests.test_market_data_service` [PASS]
- [x] Chạy `portfolio.tests.test_mdsu_gate` [PASS]
- [x] Re-scan toàn `backend/portfolio` (exclude tests) xác nhận direct `DailyPrice.objects` chỉ còn ở:
  - [x] `market_data_service.py` (được phép)
  - [x] `admin.py` (ngoài scope business read-path)
  - [x] `management/commands/*` (ngoài scope runtime read-path)
  - [x] write operation hợp lệ (`update_or_create`) theo policy
- [x] Ghi lại số test PASS (8/8) và danh sách query còn lại (0 in business read-path)

---

## 4) Audit bắt buộc sau khi hoàn thành

- [x] Cập nhật `docs/CODE_CHANGE_AUDIT_LEDGER.md` với entry Phase 4 thực thi (Entry 2026-04-21z)
- [x] Cập nhật `PROGRESS_DASHBOARD.md` với status 100% COMPLETE
- [x] Đính kèm tỷ lệ đạt theo 2 thước đo:
  - [x] Scope migrated modules: 14/14 modules 100% compliant.
  - [x] Full business read-path: 26/26 call-sites 100% compliant.

---

## 5) Definition of Done (Phase 4)

- [x] 0 direct `DailyPrice.objects` trong business read-path đã định nghĩa
- [x] Gate test fail ngay khi có direct query mới ở module đã migrate
- [x] Bộ test MDSU pass 100%
- [x] Audit ledger + progress dashboard đã đồng bộ

---

## 6) Ghi chú scope

- Đã đạt 100% SSOT cho Market Data Business Read-path.
- Mọi coding task tiếp theo bắt buộc tuân thủ MarketDataService SSOT.
