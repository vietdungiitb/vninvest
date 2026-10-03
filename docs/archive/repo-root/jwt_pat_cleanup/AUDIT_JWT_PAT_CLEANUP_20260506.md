# AUDIT: JWT → PAT Cleanup — Refactor hoàn tất

**Ngày:** 2026-05-06  
**Commit:** `92331e86` — "refactor(auth): remove all JWT legacy code — PAT-only cleanup"  
**Branches:** `dev`, `enterprise` (fast-forward merged)  
**Production:** `pham@docker.edusuccess.vn` — containers rebuilt và restarted ✅

---

## Mục tiêu

Loại bỏ toàn bộ code JWT (simplejwt) khỏi Django backend legacy. Chỉ dùng PAT (`vni_` prefix) làm cơ chế xác thực duy nhất.

---

## Danh sách file đã sửa

| File | Thay đổi |
|------|----------|
| `backend/config/settings.py` | Xóa `rest_framework_simplejwt.token_blacklist` khỏi `INSTALLED_APPS`; xóa toàn bộ block `SIMPLE_JWT = {...}` |
| `backend/config/urls.py` | Xóa import `TokenRefreshView`, `VerifiedEmailTokenObtainPairView`; xóa 2 URL patterns: `api/auth/token/` và `api/auth/token/refresh/` |
| `backend/portfolio/auth_views.py` | Xóa các import `simplejwt`; xóa class `VerifiedEmailTokenObtainPairSerializer` và `VerifiedEmailTokenObtainPairView`; cập nhật `GoogleOAuthView.post()` để gọi `_issue_pat_for_user()` thay vì `RefreshToken.for_user()` |
| `backend/portfolio/consumers.py` | Xóa import `AccessToken`; xóa toàn bộ JWT fallback block trong `_authenticate_user()` (~25 dòng); xóa helper `_get_user()` |
| `backend/core_pat_auth.py` | Thêm function `_issue_pat_for_user(user, label)` — issue PAT mới qua raw SQL (tạo tenant/service-account nếu cần, insert credential row) |

---

## Kết quả kiểm tra

### Dev smoke test (Docker local)
- ✅ AUTH_CLASSES: `['core_pat_auth.LegacyCorePATAuthentication']`
- ✅ `SIMPLE_JWT` removed từ settings
- ✅ `token_blacklist` removed từ INSTALLED_APPS
- ✅ `_issue_pat_for_user` importable
- ✅ URL patterns `token_obtain_pair`, `token_refresh` không còn tồn tại
- ✅ `auth-me` URL `/api/auth/me/` hoạt động

### Production verification (docker.edusuccess.vn)
```
AUTH: ['core_pat_auth.LegacyCorePATAuthentication']
blacklist_in_apps: False
SIMPLE_JWT_exists: False
_issue_pat_for_user: OK
```
- ✅ `vninvest-backend` Up (healthy)
- ✅ `vninvest-celery-worker` Up (healthy)
- ✅ `vninvest-celery-beat` Up (healthy)

---

## Kiến trúc sau refactor

```
Frontend / Mobile
     │
     ▼  Authorization: Bearer vni_xxxxx
Nginx Proxy
     │
     ▼
Django Backend (legacy)
  └── LegacyCorePATAuthentication (core_pat_auth.py)
        └── Raw SQL → identity_access_corepatcredential
                       identity_access_coreserviceaccount
                       identity_access_coretenant
```

**Không còn JWT trong bất kỳ code path nào.** `djangorestframework-simplejwt==5.3.1` vẫn trong `requirements.txt` nhưng không được import hay đăng ký — có thể cleanup trong sprint sau.

---

## Lưu ý

- `api/auth/token/` và `api/auth/token/refresh/` giờ được serve bởi `packages/core/backend/src/identity_access/compat_urls.py` (PAT-based)
- `GoogleOAuthView` trả về PAT token trong cả field `access` và `refresh` để backward-compatible với frontend localStorage
- WebSocket consumers chỉ accept PAT tokens; anonymous user cho tất cả còn lại
