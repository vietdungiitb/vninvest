# BACKEND DESIGN — Stock Detail SaaS Native VNStockChart Redesign

**Ngày**: 2026-05-22  
**Quan trọng**: Đây là workstream frontend-led nhưng backend boundary phải được khóa rất chặt để đội code không đổi contract tùy tiện hoặc quay lại legacy monolith.

---

## 1. Tóm tắt backend policy

1. Mặc định: backend không đổi chỉ để phục vụ layout.
2. Nếu đổi backend là vì blocker thật sự của stock-detail native path, không phải vì tiện triển khai UI.
3. Mọi backend change phải ở `packages/core/backend/`.
4. Mọi contract mới/nâng cấp phải đi qua `/core/v1/*`.
5. Không có shortcut bằng `/api/*` business route mới.

---

## 2. Canonical backend surfaces

### Native owner files

1. `packages/core/backend/src/market_data/stock_mgmt_native_views.py`
2. `packages/core/backend/src/market_data/core_urls.py`
3. `packages/core/backend/src/market_serving/native_views.py`
4. `packages/core/backend/tests/test_stock_management_api_routes.py`
5. `packages/core/backend/src/market_data/tests/test_stock_management_native_api.py`

### Not canonical

1. root `backend/portfolio/*`
2. legacy monolith `/api/stock-management/*` as end-state business path
3. direct provider calls in request path outside adapter policy

---

## 3. Backend data responsibilities

| Concern | Default native owner | Policy |
|---|---|---|
| Stock profile / overview | `stock_mgmt_native_views.py` | Existing native path preferred |
| Chart history | `stock_mgmt_native_views.py` | Existing native path preferred |
| Order flow summary | `stock_mgmt_native_views.py` / `native_views.py` | Existing native path preferred |
| Session facts / CVD / whale analytics snapshot | existing core-api surfaces + adapter wrappers | Reuse first |
| Advisory latest/history | existing core-api surfaces + adapter wrappers | Reuse first |
| Tracked symbols | native route already exists | Adapter completion before backend change |
| Price alerts | native route already exists | Adapter completion before backend change |
| Watchlists | existing core/native route family | Adapter completion before backend change |
| News | currently may still be stub | Frontend degrade until native truth exists |
| Financials | currently may still be stub | Frontend degrade until native truth exists |

---

## 4. No-change policy for backend v1

### Forbidden in this workstream unless blocker is proven

1. Không thêm endpoint `stock-detail shell summary` mới chỉ để giảm số request.
2. Không đổi serializer shape hiện có chỉ để đẹp hơn cho frontend.
3. Không thêm dashboard-like aggregate route dưới legacy namespace.
4. Không đẩy provider fetch mới vào request path để “lấy tạm dữ liệu cho news/fundamentals”.

### Allowed without extra architecture review

1. Hoàn thiện adapter wrappers ở frontend.
2. Hoàn thiện tests route/native nếu change đã có trong `packages/core/backend/`.
3. Ghi rõ degraded states khi backend truth chưa sẵn.

---

## 5. If backend change becomes unavoidable

Backend change chỉ hợp lệ khi đồng thời đạt:

1. file change nằm trong `packages/core/backend/`
2. route nằm dưới `/core/v1/*`
3. OpenAPI metadata được cập nhật
4. route tests + native tests được thêm/cập nhật
5. không tạo compat `/api/*` route mới

### Candidate blocker areas duy nhất được phép xem xét

1. `news` native endpoint nếu current stub block P1 delivery.
2. `financials` native endpoint nếu current stub block P1 delivery.
3. `depth/liquidity` route nếu frontend cần truth mà existing contract không usable.
4. aggregate snapshot route chỉ khi team chứng minh bằng evidence rằng request fan-out của page là blocker thực sự.

---

## 6. Backend response assumptions frontend được phép dựa vào

Frontend chỉ được yêu cầu backend cung cấp facts, không được ép backend phản ánh structure UI.

### 6.1 Blocking lane assumptions

1. profile/overview identity
2. quote snapshot
3. chart bars/history
4. order flow summary tối thiểu

### 6.2 Deferred lane assumptions

1. tracked state
2. watchlist membership
3. price alerts
4. advisory latest/history
5. news / financials nếu có truth

### 6.3 Error policy

1. invalid symbol phải fail rõ ràng
2. auth/private routes phải giữ auth semantics hiện hành
3. không nuốt lỗi bằng silent fallbacks khiến frontend hiểu sai là “không có dữ liệu”

---

## 7. Adapter and backend collaboration rules

1. Frontend phải chứng minh adapter gap trước khi yêu cầu backend change.
2. Backend reviewer phải ưu tiên “reuse existing native route” trước khi đồng ý endpoint mới.
3. Nếu chỉ thiếu response mapping ở frontend, fix ở adapter/view model, không mở route mới.
4. Nếu response đã đủ facts nhưng naming khó dùng, chuẩn hóa ở adapter, không ép backend đổi serializer.

---

## 8. OpenAPI and test gates

Nếu backend touched, tối thiểu phải pass:

```powershell
Push-Location .\packages\core\backend
$env:DJANGO_DEBUG='true'
$env:DJANGO_ALLOWED_HOSTS='localhost,127.0.0.1'
$env:DJANGO_SECRET_KEY='test-secret'
$env:CORE_PAT_PEPPER='test-pepper'
..\..\..\.venv\Scripts\python.exe manage.py test tests.test_stock_management_api_routes market_data.tests.test_stock_management_native_api --keepdb
Pop-Location
```

và phải chứng minh:

1. route tests PASS
2. native stock-management tests PASS
3. OpenAPI metadata/checklist được cập nhật nếu contract đổi

---

## 9. VnBroker and provider access hard rules

1. Không import trực tiếp `Vnbroker`, `Quote`, hoặc provider internals ngoài adapter SSOT.
2. Không thêm request-path provider fetch mới như workaround cho stock detail.
3. Nếu cần dữ liệu thị trường mới, phải đi qua adapter owner path đã được governance khóa trước.

---

## 10. Reject conditions cho reviewer backend

1. Có bất kỳ stock-detail business route mới nào dưới legacy `/api/*`.
2. Có backend change ngoài `packages/core/backend/`.
3. Có contract change mà thiếu OpenAPI metadata/tests.
4. Có fake/default payload để làm UI “đủ đẹp”.
5. Frontend yêu cầu backend trả về structure UI thay vì facts.
