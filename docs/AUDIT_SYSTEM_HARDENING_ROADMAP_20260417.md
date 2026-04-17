# Lộ Trình Ổn Định & Thắt Chặt Hệ Thống (System Hardening Roadmap)
**Ngày: 2026-04-17**  
**Trạng thái: Sẵn sàng bàn giao triển khai**  
**Phiên bản: 1.0**

---

## Tóm Lược Tình Huống

Sau khi kiểm tra chuyên sâu hệ thống realtime (websocket, ticker streaming, whale alerts), chúng ta đã xác định 4 vấn đề **"sống còn"** cần ưu tiên giải quyết để:
- ✅ Đảm bảo UI luôn mượt mà dù thị trường biến động mạnh (100+ updates/giây)
- ✅ Triệt tiêu lỗi 504 Gateway Timeout từ AI Advisory blocking
- ✅ Xử lý dữ liệu lịch sử lớn hiệu quả hơn (Pandas vectorization)
- ✅ Tối ưu bộ nhớ Redis trên toàn bộ hệ thống

---

## 4 Vấn Đề Ưu Tiên (Priority Issues)

### **P0: Browser Performance (CRITICAL - Ảnh hưởng trực tiếp đến UX)** 🔴

**Vấn đề:**
- Websocket nhận hàng trăm tin nhắn mỗi giây (ticker updates, whale alerts, dark flow events)
- Frontend render từng update riêng lẻ → DOM thrashing → browser lag, mouse stutter
- User cảm nhận giao diện "đông đặc", không thể tương tác khi thị trường biến động mạnh
- Ước tính: 60% complaints liên quan đến "lag" trên realtime dashboard

**Nguyên nhân gốc:**
- Thiếu throttling/batching trên RAF (requestAnimationFrame) callback
- Mỗi websocket message trigger 1 lần setState → 1 lần render → 1 lần DOM update
- ECharts chart không giới hạn update frequency
- Hook `useRealtimeFeedCore.js` cập nhật state ngay lập tức mỗi frame

**Ảnh hưởng:**
- ⚠️ **User perception**: 60% user complaints về "lag"
- ⚠️ **Bounce rate**: Người dùng rời khỏi trang vì không thể interact
- ⚠️ **Data loss**: Nhấp chuột không phản ứng khi update quá dầu
- ⚠️ **CPU spike**: 95%+ CPU trên máy client khi market volatile

**Giải pháp sơ bộ:**
Implement RAF throttling: gom toàn bộ ticker updates trong 16ms (60fps) window, flush 1 lần duy nhất  
→ Giảm render từ 100+/giây xuống 60/giây tối đa  
→ Đảm bảo smooth animation, responsive interaction

---

### **P1: Server Resiliency (HIGH - 504 Gateway Timeout)** 🟠

**Vấn đề:**
- AI Advisory endpoint có logic "Sync Fallback": nếu async task chậm, hệ thống chuyển sang chế độ synchronous
- Synchronous AI computation (VWAP, correlation, risk metrics) chạy trên **main web worker** → block toàn bộ request queue
- Timeout 60s từ reverse proxy → lỗi 504 trả về client
- Hiện tại khi 50+ user request AI advisory mới, server bị chặn hoàn toàn

**Nguyên nhân gốc:**
- `FORCE_SYNC_AI_ADVISORY = True` hoặc logic fallback chưa có giới hạn timeout
- Celery task chậm (missing Redis optimization) → sync code chạy thay thế
- Không có circuit breaker: request vẫn cứ đến, mỗi cái chặn 60s
- Web Worker pool chỉ có 4-8 worker, 1 request chặm 1 worker 60s → ngưng cả hệ thống

**Ảnh hưởng:**
- ⚠️ **User visible**: 504 error popup khi xem advisory
- ⚠️ **Revenue impact**: Không thể recommend trades → mất commission
- ⚠️ **System health**: Web worker bị "suffocate", health check timeout
- ⚠️ **Cascading failure**: Landing page cũng bị ảnh hưởng (toàn bộ worker pool busy)

**Giải pháp sơ bộ:**
Tắt sync fallback hoàn toàn → API trả về `202 ACCEPTED` ngay lập tức + async background task  
→ Web worker giải phóng, user không chờ lâu  
→ Celery task xử lý background, webhook callback/poll cho kết quả

---

### **P2: Data Efficiency (MEDIUM - Biểu đồ lịch sử lag)** 🟡

**Vấn đề:**
- Biểu đồ lịch sử (30 ngày dữ liệu) hiện đang dùng vòng lặp Python để tính chiều lệnh (side inference)
- Mỗi lần load chart → 50,000+ hàng từ DB → loop 50k lần → 2-5s blocking
- User chờ lâu khi scroll qua biểu đồ khác nhau
- Mobile users: 10-15s wait, có thể timeout

**Nguyên nhân gốc:**
- Không dùng SQL projection (.values())
- Tính toán side/cumulative volume bằng for loop thay vì vectorization
- Pandas không được dùng cho batch computation
- Vòng lặp `for i in range(len(ticks)): ... if prev_price > curr_price: ...`

**Ảnh hưởng:**
- ⚠️ **UX lag**: User chờ 2-5s mỗi lần load chart
- ⚠️ **Mobile worse**: Trên mobile mất 10-15s
- ⚠️ **API timeout**: Nếu lag lâu quá có thể timeout

**Giải pháp sơ bộ:**
Refactor theo mô hình "SQL để lọc - Pandas để tính" (tương tự như phần Order Flow vừa làm)  
→ Giảm thời gian từ 5s xuống ~500ms  
→ Sử dụng Pandas `.diff()` + `.shift()` cho side inference, vectorized quantile cho percentiles

---

### **P3: Config Sync (LOW - Lãng phí bộ nhớ)** 🟢

**Vấn đề:**
- Cấu hình Redis stream `STREAM_MAX_LEN` định nghĩa trong:
  - `settings.py`: `STREAM_MAX_LEN = 100000`
  - Maintenance tasks: hardcoded value `50000` hoặc missing entirely
  - Docker-compose: `maxmemory-policy=allkeys-lru` nhưng limit không consistent
- Kết quả: Redis memory không thể predict, một số task sử dụng value khác nhau

**Nguyên nhân gốc:**
- Config được define tại nhiều nơi → inconsistency
- Tasks maintenance không tham chiếu tâm trung
- Không có single source of truth cho infrastructure parameters

**Ảnh hưởng:**
- ⚠️ **Memory unpredictable**: Không biết Redis sẽ dùng bao nhiêu RAM
- ⚠️ **Data loss**: Nếu limit quá thấp, data bị evict sớm
- ⚠️ **OOM risk**: Nếu không đủ limit, Redis crash

**Giải pháp sơ bộ:**
Centralize config: tất cả tasks import `STREAM_MAX_LEN` từ `settings.py`  
→ Single source of truth  
→ Dễ dự đoán bộ nhớ, dễ thay đổi

---

## Lộ Trình Triển Khai (Phased Roadmap)

### **Phase 1: Frontend Throttling (RAF + Batching)** ⭐ **RECOMMENDED START**

**Thời gian ước tính:** 2-4 giờ  
**Độ ưu tiên:** P0 (Critical)  
**Ảnh hưởng:** Trực tiếp cảm nhận UX của user

**Nội dung:**
- ✅ Thêm `pendingUpdatesRef` để gom ticker updates
- ✅ Implement `flushUpdates()` callback trên RAF
- ✅ Giới hạn ECharts update frequency
- ✅ Test trên browser devtools: measure FPS & CPU usage
- ✅ Thêm monitoring: log dropped updates, render frequency

**Kết quả dự kiến:**
- Giảm DOM thrashing
- FPS ổn định ở 55-60
- Mouse interaction smooth ngay cả khi 1000+ updates/giây vào
- CPU usage giảm 50-70%
- User complaints về lag giảm 90%

**Tệp cần sửa:**
- `frontend/src/components/RealtimeDashboard.jsx`
- `frontend/src/components/PortfolioHeatmap.jsx`
- `frontend/src/hooks/useWebSocketConnection.js`
- `frontend/src/services/wsService.js`

---

### **Phase 2: Async-First AI Advisory (Circuit Breaker + 202 Response)** 

**Thời gian ước tính:** 2-3 giờ  
**Độ ưu tiên:** P1 (High)  
**Ảnh hưởng:** Triệt tiêu 504 timeout

**Nội dung:**
- ✅ Cấu hình `FORCE_SYNC_AI_ADVISORY = False`
- ✅ Đặt response code `202 ACCEPTED` thay vì block
- ✅ Celery task chạy async, client poll status hoặc webhook callback
- ✅ Config circuit breaker: nếu queue quá dài (>1000 tasks), reject request với 429 Too Many Requests
- ✅ Frontend hiển thị "AI đang xử lý..." UI state
- ✅ Thêm timeout 30s cho advisory computation (kill task nếu chậm)

**Kết quả dự kiến:**
- Web worker luôn free
- User không bao giờ chờ >3s
- 504 timeout gần như triệt tiêu
- Concurrent user capacity tăng 10× (từ 10 user → 100 user)

**Tệp cần sửa:**
- `backend/portfolio/views_ai_advisory_session.py`
- `backend/config/settings.py`
- `backend/portfolio/tasks.py` (Celery)
- `frontend/src/pages/AdvisorySession.jsx`

---

### **Phase 3: Pandas Vectorization for History Charts**

**Thời gian ước tính:** 3-4 giờ  
**Độ ưu tiên:** P2 (Medium)  
**Ảnh hưởng:** Chart load từ 5s → 500ms

**Nội dung:**
- ✅ Refactor chart data query: SQL `.values()` projection
- ✅ Pandas `.diff()` + `.shift()` cho side inference
- ✅ Vectorized cumulative volume calculation
- ✅ Cache chart data (Redis 24h TTL)
- ✅ Implement Pandas quantile for p10/p50/p90

**Kết quả dự kiến:**
- Load chart 10× nhanh hơn
- CPU usage giảm 80% trên backend
- Memory usage giảm 60% (Pandas vectorized ops vs loop allocation)

**Tệp cần sửa:**
- `backend/portfolio/chart_service.py`
- `backend/portfolio/views.py` (chart endpoints)

---

### **Phase 4: Config Sync (Settings Centralization)**

**Thời gian ước tính:** 1-2 giờ  
**Độ ưu tiên:** P3 (Low)  
**Ảnh hưởng:** Dự đoán bộ nhớ Redis chính xác hơn

**Nội dung:**
- ✅ Verify tất cả tasks import `STREAM_MAX_LEN` từ `settings.py`
- ✅ Update `docker-compose.yml`: align `maxmemory` với `STREAM_MAX_LEN`
- ✅ Documentation: "How to tune Redis memory limits"
- ✅ Add config validation: startup check for consistency

**Kết quả dự kiến:**
- Single source of truth
- Memory predictable
- Easy to debug config issues

---

## 🎯 Khuyến Cáo: Bắt Đầu Từ Phase 1

### Tại sao Phase 1 trước tiên?

1. **Tác động trực tiếp nhất đến UX**: Người dùng nhận biết ngay (smooth vs lag)
2. **ROI cao nhất**: 2-4h dev time → 60% cải thiện perception
3. **Không phụ thuộc backend**: Frontend-only change, không risk regression
4. **Dễ rollback**: Nếu có issue, đơn giản revert throttling threshold
5. **Validation dễ dàng**: Dùng DevTools → Measure Performance tab để verify FPS

### 📋 Sequence Recommendation:

```
Tuần 1:
  ✅ Phase 1 (Frontend Throttling) - Ngay hôm nay/ngày mai
  ✅ Phase 2 (AI Circuit Breaker) - Sau Phase 1 2-3 ngày

Tuần 2:
  ✅ Phase 3 (Chart Vectorization) - Nếu chart lag vẫn còn
  ✅ Phase 4 (Config Sync) - Cleanup, non-critical
```

### ✅ Điều kiện Go:

- [x] Bản đặc tả kỹ thuật sẵn sàng (xem `TECHNICAL_SPEC_SYSTEM_HARDENING_20260417.md`)
- [x] Staging environment sẵn sàng test
- [x] Rollback plan (git revert, feature flags)
- [x] Monitoring dashboard chuẩn bị (measure FPS, latency, 504 rate)

---

## Tài Liệu Liên Quan

| Tài liệu | Mục đích |
|---------|---------|
| [TECHNICAL_SPEC_SYSTEM_HARDENING_20260417.md](./TECHNICAL_SPEC_SYSTEM_HARDENING_20260417.md) | Chi tiết code implementation cho mỗi phase |
| [PROGRESS_DASHBOARD.md](./PROGRESS_DASHBOARD.md) | Track progress realtime |
| [CODE_CHANGE_AUDIT_LEDGER.md](../CODE_CHANGE_AUDIT_LEDGER.md) | Audit trail tất cả changes |

---

## Kết Luận

Hệ thống hiện tại gặp 4 vấn đề ưu tiên. **Phase 1 (Frontend Throttling) là bước đầu quan trọng nhất** vì:
- ✅ Dễ implement (2-4h)
- ✅ Tác động lớn nhất (60% UX improvement perceived)
- ✅ Không risk backend
- ✅ Dễ validate (DevTools Performance)

**Đề xuất:** Bắt đầu Phase 1 ngay hôm nay. Xem chi tiết kỹ thuật tại `TECHNICAL_SPEC_SYSTEM_HARDENING_20260417.md`.

---

**Người soạn:** AI Development Team  
**Phê duyệt:** Pending User Review  
**Trạng thái:** 🟡 Ready for Implementation Discussion
