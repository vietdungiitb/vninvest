# Cấu hình CORS động cho SaaS API Endpoints (vnbroker / vninvestcharts)

Tài liệu này ghi lại chi tiết vấn đề và giải pháp cấu hình Cross-Origin Resource Sharing (CORS) động trên hệ thống API của VNInvest nhằm hỗ trợ các thư viện client-side (như `vnbroker`, `vninvestcharts`) tích hợp an toàn qua Personal Access Token (PAT).

## 1. Vấn đề (CORS Block)

Các thư viện hoặc website tích hợp sử dụng SaaS PAT của VNInvest để thực hiện các yêu cầu API từ trình duyệt của khách hàng gặp phải lỗi CORS:
```
Access to fetch at 'https://vninvest.edusuccess.vn/core/v1/market-data' from origin 'https://client-domain.com' has been blocked by CORS policy.
```

### Nguyên nhân:
1. Trình duyệt gửi request preflight `OPTIONS` để kiểm tra quyền truy cập trước khi thực hiện request chính (ví dụ: `GET`, `POST` với header `Authorization: Bearer <PAT>`).
2. Do domain của bên thứ ba (`https://client-domain.com` hoặc `http://localhost:3000` trong môi trường dev) không nằm trong cấu hình biến môi trường `CORS_ALLOWED_ORIGINS` của VNInvest, Django API từ chối preflight request.

---

## 2. Giải pháp kỹ thuật

Để hỗ trợ tích hợp linh hoạt (multi-tenant & third-party integrations) mà vẫn đảm bảo an toàn hệ thống, VNInvest áp dụng **Giải pháp 3 (Dynamic CORS Allowance via Django Signals)** phối hợp với cấu hình bật/tắt qua môi trường:

### 2.1. Dynamic Signal Matching
Các route API (`/core/v1/*` và `/api/*`) sử dụng phương thức xác thực bằng Token (`CorePATAuthentication`) thay vì Session/Cookie. Do đó, chúng hoàn toàn miễn nhiễm với tấn công CSRF (Cross-Site Request Forgery). 

Chúng ta sử dụng signal `check_request_enabled` được cung cấp bởi `django-cors-headers` để tự động trả về `True` (cho phép CORS từ mọi origin) cụ thể đối với các request nhắm tới các route API này:

```python
# Hộp đăng ký signal tại: packages/core/backend/src/identity_access/apps.py
from corsheaders.signals import check_request_enabled

def cors_allow_api_requests(sender, request, **kwargs):
    # Cho phép CORS cho tất cả các endpoint API (/core/v1/ và /api/)
    if request.path.startswith('/core/v1/') or request.path.startswith('/api/'):
        return True
    return False

check_request_enabled.connect(cors_allow_api_requests)
```

### 2.2. Environment-based Toggle
Để kiểm soát hành vi này trên các môi trường khác nhau (ví dụ: tắt hoàn toàn ở production nếu cần thiết), cấu hình `CORS_API_DYNAMIC_ALLOW` (kiểu Boolean, mặc định là `True`) được định nghĩa trong `settings.py` và có thể chỉnh sửa qua biến môi trường.

---

## 3. Các tệp tin thay đổi (Proposed Changes)

1. **[settings.py](file:///c:/Mujoco%20Projects/vninvest/packages/core/backend/src/vninvest_core/settings.py)**: Khai báo biến `CORS_API_DYNAMIC_ALLOW` đọc từ môi trường.
2. **[apps.py](file:///c:/Mujoco%20Projects/vninvest/packages/core/backend/src/identity_access/apps.py)**: Đăng ký lắng nghe signal `check_request_enabled` dựa trên cấu hình bật/tắt.
3. **[docker-compose.dev.yml](file:///c:/Mujoco%20Projects/vninvest/docker-compose.dev.yml)**: Thêm tham số `CORS_API_DYNAMIC_ALLOW: "true"` vào service `core-api`.
4. **[test_cors_dynamic.py](file:///c:/Mujoco%20Projects/vninvest/packages/core/backend/tests/test_cors_dynamic.py)**: Test suite tự động xác thực các trường hợp CORS preflight và CORS response.

---

## 4. Hướng dẫn kiểm thử & Xác thực

### 4.1. Chạy test tự động
```powershell
$env:DJANGO_DEBUG='true'
$env:DJANGO_ALLOWED_HOSTS='localhost,127.0.0.1'
$env:CORS_ALLOWED_ORIGINS='http://localhost,http://127.0.0.1'
$env:DJANGO_SECRET_KEY='local-test-secret-key'
$env:CORE_PAT_PEPPER='local-test-pepper'
cd packages/core/backend
..\..\..\.venv\Scripts\python.exe manage.py test tests.test_cors_dynamic --keepdb
```

### 4.2. Kiểm tra thủ công (Manual Verification)
Gửi một request `OPTIONS` giả lập CORS từ trình duyệt bằng `curl`:
```bash
curl -X OPTIONS http://localhost:8001/core/v1/health \
  -H "Origin: https://arbitrary-client-domain.com" \
  -H "Access-Control-Request-Method: GET" \
  -H "Access-Control-Request-Headers: authorization" \
  -I
```

**Kết quả mong đợi (Response Headers):**
```http
HTTP/1.1 204 No Content
Access-Control-Allow-Origin: https://arbitrary-client-domain.com
Access-Control-Allow-Methods: DELETE, GET, OPTIONS, PATCH, POST, PUT
Access-Control-Allow-Headers: authorization, content-type, accept, origin
```

---

## 5. Khuyến cáo bảo mật

> [!WARNING]
> Mặc dù CORS được mở cho các route API, các nhà phát triển tích hợp **KHÔNG NÊN** nhúng trực tiếp SaaS PAT trong mã nguồn Javascript phía client (trình duyệt) chạy công cộng. Hãy sử dụng mô hình **Backend Proxy** (Backend của client gọi API VNInvest bằng PAT) để giữ bí mật tuyệt đối cho Token và ngăn chặn rủi ro lộ lọt tài khoản.
