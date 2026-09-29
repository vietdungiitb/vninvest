# Kế Hoạch Phase 3 — Security & Compliance

> **Ngày:** 2026-06-24
> **Phiên bản:** 1.1 (Revised after audit)
> **Trạng thái:** Đã audit — chờ phê duyệt
> **Audit phản biện:** `TENANT_ADMIN_UPGRADE_PLANS_AUDIT_REPORT.md` §2
> **Audit gap:** `LoginAttempt` model chưa có, `views_security.py` chưa có, `TenantAdminSecurityPage.tsx` chưa có

---

## 1. Tổng Quan

Thêm Security Dashboard cho phép admin theo dõi hoạt động đăng nhập, quản lý session đang hoạt động, và phát hiện truy cập bất thường.

### 1.1 Mục tiêu cụ thể

| Tính năng | Mô tả | Ưu tiên |
|-----------|-------|---------|
| **Login Activity** | Biểu đồ success/fail login 30 ngày, danh sách fail gần đây | P0 |
| **Active Sessions** | Danh sách session JWT đang active, cho phép revoke | P0 |
| **PATs "Last Used"** | Cột last_used + bộ lọc unused > 90 ngày trên PATs page | P1 |
| **IP Insights** | Thống kê IP đăng nhập, cảnh báo IP lạ | P2 |

---

## 2. Backend

### 2.1 Model: `LoginAttempt`

```python
class LoginAttempt(models.Model):
    tenant = models.ForeignKey(CoreTenant, on_delete=models.CASCADE, null=True, db_index=True)
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    username = models.CharField(max_length=150, db_index=True)
    email = models.EmailField(blank=True, default='')
    ip_address = models.GenericIPAddressField(db_index=True)
    user_agent = models.TextField(blank=True)
    success = models.BooleanField(db_index=True)
    failure_reason = models.CharField(max_length=64, blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        indexes = [
            models.Index(fields=['tenant', 'created_at']),
            models.Index(fields=['tenant', 'success']),
        ]
```

**Ghi chú:**
- Dùng `django-axes` integration optional — nếu có axes thì sync vào `LoginAttempt` qua signal; nếu không thì tự ghi từ login views
- Retention: tự động xóa các bản ghi > 90 ngày (Celery task daily)

### 2.2 Endpoints

#### `GET /partner/security/login-activity/?days=30`

**Response:**
```json
{
  "daily": [
    {"date": "2026-06-01", "success": 12, "failed": 1},
    {"date": "2026-06-02", "success": 8, "failed": 0}
  ],
  "summary": {
    "total_logins": 320,
    "total_failed": 15,
    "success_rate_pct": 95.3,
    "unique_ips": 24,
    "unique_users": 18,
    "most_active_day": "2026-06-15",
    "recent_failures": [
      {"username": "attacker@example.com", "ip": "10.0.0.99", "attempts": 8, "last_at": "2026-06-23T14:30:00Z"}
    ]
  }
}
```

#### `GET /partner/security/sessions/`

**Response:**
```json
{
  "sessions": [
    {
      "user_id": 42,
      "username": "admin@tenant.com",
      "ip_address": "203.0.113.42",
      "user_agent": "Mozilla/5.0 ...",
      "login_at": "2026-06-23T08:00:00Z",
      "last_active_at": "2026-06-24T09:15:00Z",
      "session_id": "jwt_prefix_abc123",
      "is_current": true
    }
  ],
  "total_active": 3
}
```

**Implementation notes:**
- **⚠️ Audit finding:** Hệ thống VNInvest sử dụng **dynamic human `CorePATCredential`** (lưu trong DB) làm token đăng nhập (xem `views/login.py:143-154`). Do đó **không cần Redis session tracking hay blocklist** — mọi thao tác trên DB là đủ.
- Sessions = `CorePATCredential.objects.filter(service_account__tenant=tenant, is_human_session=True, status='active', expires_at__gt=timezone.now())`
- Revoke = chuyển `status='revoked'` — middleware `CorePATAuthentication` tự kiểm tra status ở request tiếp theo.
- **Giảm ~90% complexity so với thiết kế cũ.**

#### `POST /partner/security/sessions/revoke/`

**Request body:**
```json
{
  "session_id": 42,
  "revoke_all_except_current": false,
  "reason": "Suspicious activity detected"
}
```

**Logic:**
- Nếu `revoke_all_except_current = true`: SET status='revoked' WHERE tenant=request.tenant AND is_human_session=True AND id != current_session_id
- Nếu `session_id` cụ thể: UPDATE CorePATCredential SET status='revoked' WHERE id=session_id
- Không cần Redis — middleware `CorePATAuthentication` đọc status từ DB mỗi request
- Ghi audit log event `session.revoked`

### 2.3 Security Utilities

```python
# security_utils.py (mới trong identity_access)

class LoginRecorder:
    @staticmethod
    def record_login(request, user, tenant, success, failure_reason=""):
        LoginAttempt.objects.create(
            tenant=tenant,
            user=user if success else None,
            username=request.data.get('username', ''),
            email=user.email if user else '',
            ip_address=get_client_ip(request),
            user_agent=request.META.get('HTTP_USER_AGENT', ''),
            success=success,
            failure_reason=failure_reason,
        )

    @staticmethod
    def get_active_sessions(tenant):
        return CorePATCredential.objects.filter(
            service_account__tenant=tenant,
            is_human_session=True,
            status='active',
            expires_at__gt=timezone.now(),
        ).select_related('service_account', 'service_account__user_profile__user')

    @staticmethod
    def revoke_session(session_id, tenant):
        CorePATCredential.objects.filter(
            id=session_id,
            service_account__tenant=tenant,
            is_human_session=True,
        ).update(status='revoked')

    @staticmethod
    def revoke_all_sessions_except(tenant, exclude_session_id):
        CorePATCredential.objects.filter(
            service_account__tenant=tenant,
            is_human_session=True,
            status='active',
        ).exclude(id=exclude_session_id).update(status='revoked')
```

### 2.4 Login Activity — Cần sửa `views/login.py`

**⚠️ Audit finding:** Bản kế hoạch gốc thiếu file `views/login.py` trong manifest. Nếu không ghi `LoginAttempt` trong login view, model sẽ không có dữ liệu.

**Cần thêm** `LoginRecorder.record_login()` vào:
1. Cuối hàm `login_view` — khi login thành công (trước khi return Response)
2. Trong catch block — khi login thất bại (sai mật khẩu, user không tồn tại)
3. Trong rate limit block — khi request bị chặn do quá số lần thử

### 2.4 PATs Enhancement

Sửa `TenantAdminPATsPage.tsx` **không cần backend change** — PAT model đã có `last_used_at` và `expires_at`.

Frontend chỉ cần:
1. Thêm cột "Sử dụng gần nhất" hiển thị `last_used_at` (relative time)
2. Thêm nút filter "PAT không dùng > 90 ngày"
3. Highlight đỏ các PAT sắp hết hạn (trong 7 ngày)

---

## 3. Frontend

### 3.1 New Page: `TenantAdminSecurityPage.tsx`

**Layout gợi ý:**

```
┌─────────────────────────────────────────────────────────┐
│  🛡️ Security & Compliance                               │
│  [320 logins] [15 failed] [95.3% rate] [3 active sess.] │
├─────────────────────────────────────────────────────────┤
│  Login Activity (30 days)                📅 7d 14d 30d  │
│  ┌─────────────────────────────────────────────────────┐│
│  │  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░             ││
│  │  ░░ Success ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░         ││
│  │  ██ Failed  ██                                       ││
│  │  01  05  10  15  20  25                              ││
│  └─────────────────────────────────────────────────────┘│
├─────────────────────────────────────────────────────────┤
│  ⚠️ Recent Failed Attempts (last 24h)                   │
│  ┌─────────────────────────────────────────────────────┐│
│  │ 🔴 attacker@example.com  ·  10.0.0.99  ·  8 lần    ││
│  │ 🔴 unknown@test.com      ·  192.168.1.5 ·  3 lần   ││
│  └─────────────────────────────────────────────────────┘│
├─────────────────────────────────────────────────────────┤
│  💻 Active Sessions (3)                                 │
│  ┌─────────────────────────────────────────────────────┐│
│  │ 😀 admin@tenant.com  ·  203.0.113.42  ·  2h trước  ││
│  │   User-Agent: Chrome 126 on Windows           [Revoke]│
│  ├─────────────────────────────────────────────────────┤│
│  │ 😀 user2@tenant.com ·  198.51.100.7  ·  1 ngày trước││
│  │   User-Agent: Safari on macOS                [Revoke]││
│  ├─────────────────────────────────────────────────────┤│
│  │ 😀 user3@tenant.com ·  10.0.0.1  ·  đang hoạt động ││
│  │   User-Agent: Mobile App v2.1 (current session)     ││
│  └─────────────────────────────────────────────────────┘│
│                                          [Revoke All]  │
└─────────────────────────────────────────────────────────┘
```

**Components:**
- Inline chart: Recharts `BarChart` (success=green, failed=red, stacked or grouped)
- Recent failures list: `ShellPage__listItem` với icon + details
- Active sessions table: `ShellPanel` + table với revoke button
- Lưu ý: **không** render bên client-side cho IP geo heatmap (tốn chi phí API)

**Permissions:**
- `read TenantSecurityView` — xem security dashboard
- `manage TenantSecurityView` — revoke session

### 3.2 PATs Page Enhancement

Sửa `TenantAdminPATsPage.tsx`:
- Thêm cột "Lần cuối" sau cột "Trạng thái"
- Nếu `last_used_at` null → hiển thị "Chưa dùng"
- Nếu > 90 ngày → màu cam + icon ⚠️
- Thêm nút lọc "Không dùng > 90 ngày"
- Thêm cột "Hết hạn" với highlight đỏ nếu <= 7 ngày

---

## 4. i18n Keys

### Vietnamese

```javascript
// vi.js additions
tenantSecurity: {
  eyebrow: "Tenant Admin",
  title: "Bảo mật & Tuân thủ",
  description: "Giám sát hoạt động đăng nhập và quản lý phiên làm việc",
  metricLogins: "Tổng đăng nhập",
  metricFailed: "Thất bại",
  metricRate: "Tỷ lệ thành công",
  metricSessions: "Phiên hoạt động",
  loginActivityTitle: "Hoạt động đăng nhập (30 ngày)",
  recentFailuresTitle: "Thất bại gần đây (24h qua)",
  activeSessionsTitle: "Phiên đang hoạt động",
  revokeAction: "Thu hồi",
  revokeAllAction: "Thu hồi tất cả",
  confirmRevoke: "Bạn có chắc muốn thu hồi phiên này?",
  noSessions: "Không có phiên nào đang hoạt động",
  noFailures: "Không có lần đăng nhập thất bại nào trong 24h qua",
  emptyState: "Không có dữ liệu bảo mật",
  loadError: "Lỗi khi tải dữ liệu bảo mật",
  logins: "Đăng nhập",
  failed: "Thất bại",
},
tenantPATs: {
  // Additional keys
  lastUsed: "Lần cuối",
  neverUsed: "Chưa dùng",
  expiresIn: "Hết hạn trong",
  filterUnused: "Không dùng > 90 ngày",
  expiringSoon: "Sắp hết hạn",
}
```

---

## 5. Page Registry

```javascript
// pageRegistry.js
{
  path: "/tenant-admin/security",
  component: "TenantAdminSecurityPage",
  permission: "read TenantSecurityView"
}
```

Thêm vào nav entries trong `TenantAdminHomePage.tsx` khi permission granted:
```javascript
{ labelKey: "tenantHome.securityRoute", to: "/tenant-admin/security", subject: "TenantSecurityView", icon: "\uD83D\uDEE1\uFE0F" },
```

---

## 6. Files Changed

| File | Action |
|------|--------|
| `packages/core/backend/src/identity_access/models.py` | Modified — add `LoginAttempt` model |
| `packages/core/backend/src/identity_access/migrations/` | New — migration |
| `packages/core/backend/src/identity_access/views/login.py` | **⚠️ Bổ sung sau audit** — ghi `LoginAttempt` vào cuối login thành công, thất bại, và rate-limit block |
| `packages/core/backend/src/identity_access/views_security.py` | New — login-activity + sessions views |
| `packages/core/backend/src/identity_access/security_utils.py` | New — `LoginRecorder` (đơn giản, **không Redis**) |
| `packages/core/backend/src/identity_access/partner_urls.py` | Modified — register security routes |
| `packages/core/backend/src/identity_access/tasks.py` | Modified — add cleanup_old_login_attempts task |
| `packages/core/backend/src/identity_access/partner_abilities.py` | Modified — seed `TenantSecurityView` |
| `packages/web/src/pages/tenant-admin/TenantAdminSecurityPage.tsx` | New — full security dashboard |
| `packages/web/src/pages/tenant-admin/TenantAdminPATsPage.tsx` | Modified — add last_used column + filters |
| `packages/web/src/pages/pageRegistry.js` | Modified — register route |
| `packages/web/src/pages/tenant-admin/TenantAdminHomePage.tsx` | Modified — add security nav link |
| `packages/web/src/adapters/core/operator.js` | Modified — add security methods |
| `packages/web/src/adapters/coreApiAdapter.js` | Modified — wire |
| `packages/web/src/adapters/coreApiAdapter.d.ts` | Modified — type declarations |
| `packages/web/src/i18n/vi.js` | Modified — add keys |
| `packages/web/src/i18n/en.js` | Modified — add keys (English fallback) |

---

## 7. Effort Estimate

| Task | Backend (h) | Frontend (h) | Total (h) |
|------|:-----------:|:-----------:|:---------:|
| `LoginAttempt` model + migration | 3 | — | 3 |
| `views/login.py` — thêm ghi LoginAttempt thành công/thất bại | 2 | — | 2 |
| `views_security.py` — login-activity aggregation | 3 | — | 3 |
| `views_security.py` — sessions + revoke (dùng CorePATCredential, **không Redis**) | 2 | — | 2 |
| `security_utils.py` — LoginRecorder (đơn giản, **không Redis**) | 1 | — | 1 |
| Celery task cleanup old LoginAttempt | 2 | — | 2 |
| `TenantAdminSecurityPage.tsx` — full UI | — | 12 | 12 |
| `TenantAdminPATsPage.tsx` — last_used column + filter | — | 3 | 3 |
| i18n + registry + permissions | 1 | 2 | 3 |
| Testing + validation | 2 | 2 | 4 |
| **Total** | **16** | **19** | **35** |

> **Điều chỉnh sau audit:** Giảm từ 43h → **~35h** nhờ loại bỏ Redis session tracking/blocklist, tận dụng CorePATCredential có sẵn trong DB.  
> **Effort đánh giá lại (audit độc lập): 30h** — xem `TENANT_ADMIN_UPGRADE_PLANS_AUDIT_REPORT.md` §4.
