# Design Document: Kế hoạch Refactor Fat Views

**Trạng thái:** Approved for phased execution  
**Mục tiêu:** Tách `backend/portfolio/views.py` theo đúng boundary kỹ thuật mà không làm gãy API hiện tại, đồng thời tạo nền tảng để chuyển dần sang kiến trúc dễ test, dễ rollback và dễ mở rộng.

## 1. Nguyên Tắc Thiết Kế Chốt Cứng
1. Không xóa `views.py` trong giai đoạn đầu.
2. Giữ nguyên endpoint contract cũ trong suốt giai đoạn migration.
3. Không dùng thư mục `new_views/`; module mới được đặt cùng cấp trong `backend/portfolio/` để đồng bộ với cấu trúc hiện tại.
4. Rollout theo domain, không rollout theo file size.
5. Mọi thay đổi đều phải rollback được bằng feature flag.

## 2. Cấu Trúc Module Sau Refactor
### Views layer
- `backend/portfolio/market_views.py`
- `backend/portfolio/trading_views.py`
- `backend/portfolio/watchlist_views.py`
- `backend/portfolio/config_views.py`

### Service layer
- `backend/portfolio/services/market_data_service.py`
- `backend/portfolio/services/trading_service.py`
- `backend/portfolio/services/watchlist_service.py`
- `backend/portfolio/services/config_service.py`

### Adapter layer
- `backend/portfolio/adapters/vnbroker_adapter.py`
- `backend/portfolio/adapters/cache_adapter.py`
- `backend/portfolio/adapters/realtime_adapter.py`

### Shared contract
- `backend/portfolio/exceptions.py`
- `backend/portfolio/urls.py` hoặc các file router liên quan sẽ dùng feature flag để chọn implementation cũ/mới.

## 3. Boundary Kỹ Thuật Bắt Buộc
### Import rule
- `Views -> Services -> Adapters`
- Cấm import ngược chiều.

### Responsibility rule
- **Views:** parse request, auth/permission, serializer validation, map exception sang HTTP.
- **Services:** business logic, orchestration, transaction boundary, domain validation.
- **Adapters:** external I/O, cache I/O, retry, fallback, circuit breaker.

### Transaction guideline
- `transaction.atomic()` chỉ được đặt trong service khi có thao tác ghi dữ liệu.
- Không bọc network call trong transaction.

## 4. Error Handling Matrix
| Lớp | Loại lỗi | Chuẩn hóa | HTTP response |
| :--- | :--- | :--- | :--- |
| Adapter | timeout, rate-limit, provider error | `ExternalSystemException` | `502` hoặc fallback có kiểm soát |
| Service | violation nghiệp vụ | `BusinessLogicRuleException` | `400` |
| View | serializer/validation error | lỗi validation chuẩn DRF | `422` hoặc `400` theo serializer hiện hành |

## 5. Feature Flag và Rollback
- Feature flag chính thức được cấu hình trong Django settings từ biến môi trường.
- Cờ khởi đầu:
   - `ENABLE_NEW_MARKET_VIEWS`
   - `ENABLE_NEW_TRADING_VIEWS`
   - `ENABLE_REALTIME_CONNECTION_MANAGER`
- Rollback trigger định lượng cho canary:
   - error rate `5xx > 1.5%` trong `5 phút`
   - hoặc p95 latency `> 500ms` trong `5 phút`
- Khi trigger bị vi phạm, traffic phải quay về implementation cũ bằng flag mà không cần sửa code nóng.

## 6. Chiến Lược QA Bắt Buộc
Không được promote sang phase tiếp theo nếu chưa đạt đủ ba lớp kiểm thử:
1. **Contract tests:** schema, status code, error shape không lệch so với legacy endpoint.
2. **Regression tests:** auth JWT, permission, throttle, cache hit/miss, fallback khi provider lỗi.
3. **Benchmarking và canary:** mở traffic `10% -> 50% -> 100%` sau khi metric ổn định theo measurement contract.

## 7. Thứ Tự Refactor
1. **Phase 1:** Market Data.
2. **Phase 2:** Realtime connection management ở frontend và backend integration liên quan.
3. **Phase 3:** Trading domain.
4. **Phase 4:** Chỉ sau khi ba phase trên ổn định mới mở decision gate cho `DailyPrice` storage strategy.

## 8. Governance
- Hotfix P0/Security được phép đi thẳng production nếu cần.
- Mọi hotfix phải có backport ticket và phải backport vào nhánh refactor trong vòng `24h`.
- Sprint buffer cho benchmark, hardening và rollback rehearsal là bắt buộc, không được cắt bỏ để chạy theo feature scope.
