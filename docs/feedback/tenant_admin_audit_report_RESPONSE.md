# PHẢN HỒI BÁO CÁO RÀ SOÁT TENANT ADMIN
**Tài liệu gốc:** `docs/feedback/tenant_admin_audit_report.md`  
**Phản hồi:** `docs/feedback/tenant_admin_audit_report_RESPONSE.md`  
**Ngày:** 2026-06-15  
**Trạng thái:** Đánh giá codebase hoàn tất — Chấp thuận một phần / Cần điều chỉnh

---

## 1. Tóm Tắt Đánh Giá

| Mã | Nội dung trong Báo cáo | Kết quả kiểm tra Codebase | Trạng thái |
| :--- | :--- | :--- | :--- |
| **Gap #1** | Lỗi thiết kế 1-đối-1 User-Tenant trong API | **XÁC NHẬN** — `tenant_member_views.py:L67` vẫn dùng `CoreTenant.objects.filter(owner_user=user).first()` | ✅ Lỗ hổng đúng như báo cáo |
| **Gap #2** | Tạo token gõ scope thủ công | **XÁC NHẬN** — `TenantPATs.jsx:L105` default `scopeCodes: 'market:read, signals:read'`, input là text field thủ công | ✅ Lỗ hổng đúng như báo cáo |
| **Gap #3** | Audit Logs ẩn khỏi UI | **XÁC NHẬN** — Model `TenantLifecycleEvent` tồn tại nhưng không có API endpoint cho tenant xem | ✅ Lỗ hổng đúng như báo cáo |
| **Gap #4** | Quota thiếu trực quan hóa | **XÁC NHẬN** — `TenantUsage.jsx` chỉ hiển thị static cards + UsageBar (progress bar), không có timeseries chart | ✅ Lỗ hổng đúng như báo cáo |
| **Gap #5** | Billing chỉ hỗ trợ VNPAY | **XÁC NHẬN** — Model `Invoice` có `currency='VND'` mặc định, chưa có tích hợp Stripe | ✅ Lỗ hổng đúng như báo cáo |

---

## 2. Chi Tiết Đánh Giá Từng Mục

### ✅ Gap #1: Lỗi thiết kế 1-đối-1 — XÁC NHẬN CHÍNH XÁC

**Báo cáo nêu:**  
`tenant_member_views.py:L67` dùng `CoreTenant.objects.filter(owner_user=user).first()`

**Kiểm tra thực tế:**
```python
# File: packages/core/backend/src/identity_access/tenant_member_views.py
# Lines 67-72 trong TenantMemberListView.get()
def get(self, request):
    # ...
    user = request.user
    # Find user's primary tenant
    tenant = CoreTenant.objects.filter(owner_user=user).first()
```

**Kết luận:** ✅ Báo cáo CHÍNH XÁC. Mã nguồn hiện tại chỉ lấy tenant mà user sở hữu (owner), KHÔNG kiểm tra tenant mà user là thành viên (member). Tuy nhiên, có một điểm sáng là `TenantInvitesCombinedView` đã có method `_get_tenant_for_user` hỗ trợ cả hai trường hợp:

```python
def _get_tenant_for_user(self, user):
    """Get the user's primary tenant (owner-owned) or first accessible tenant."""
    # Try to find tenant owned by user
    tenant = CoreTenant.objects.filter(owner_user=user).first()
    if tenant:
        return tenant
    # If not found, try to find any tenant where user is a member
    member = TenantMember.objects.filter(user=user).select_related('tenant').first()
    if member:
        return member.tenant
    return None
```

**Đề xuất:** Cần triển khai `TenantResolutionMiddleware` để chuẩn hóa cách lấy tenant từ request, như báo cáo đề xuất.

---

### ✅ Gap #2: Tạo token gõ scope thủ công — XÁC NHẬN CHÍNH XÁC

**Báo cáo nêu:** Người dùng phải tự gõ thủ công danh sách scope ngăn cách bởi dấu phẩy.

**Kiểm tra thực tế:**
```javascript
// File: frontend/src/pages/admin/tenant/TenantPATs.jsx
// Lines 105-110
const [issueForm, setIssueForm] = useState({
  serviceAccountId: '',
  scopeCodes: 'market:read, signals:read',  // Default scope mặc định!
  expiresAt: '',
  displayName: '',
});

// Lines 361-372: Input là text field thuần túy
<input
  type="text"
  value={issueForm.scopeCodes}
  onChange={(event) => setIssueForm((current) => ({ ...current, scopeCodes: event.target.value }))}
  placeholder={t('tenantPats.scopesPlaceholder')}
  className="rounded-2xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 ..."
  required
/>
```

**Kết luận:** ✅ Báo cáo CHÍNH XÁC. Người dùng phải tự gõ scopes bằng tay. Không có giao diện chọn policy/role trực quan (checkbox list) như AWS IAM. Điều này:
- Rất dễ gây lỗi chính tả (typo) dẫn đến API từ chối token
- Không có mô tả chức năng của từng scope
- Thiếu tính năng autocomplete/preview

---

### ✅ Gap #3: Audit Logs ẩn khỏi UI — XÁC NHẬN CHÍNH XÁC

**Báo cáo nêu:** Model `TenantLifecycleEvent` tồn tại nhưng chưa có UI cho khách xem.

**Kiểm tra thực tế:**
```python
# File: packages/core/backend/src/tenant_lifecycle/models.py
class TenantLifecycleEvent(models.Model):
    class EventType(models.TextChoices):
        PLAN_CHANGED = 'plan_changed', 'Plan Changed'
        STATUS_CHANGED = 'status_changed', 'Status Changed'
        TRIAL_STARTED = 'trial_started', 'Trial Started'
        # ... các event type khác
    tenant = models.ForeignKey('identity_access.CoreTenant', ...)
    event_type = models.CharField(max_length=64, choices=EventType.choices, db_index=True)
    actor_type = models.CharField(max_length=32, default='system')
    actor_user = models.ForeignKey(User, ...)
    old_value = models.JSONField(...)
    new_value = models.JSONField(...)
    ip_address = models.GenericIPAddressField(...)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
```

**Kết luận:** ✅ Báo cáo CHÍNH XÁC. Model đầy đủ các trường cần thiết cho audit (bao gồm IP, actor, old/new values), nhưng:
- Chưa có API endpoint `GET /api/core/v1/partner/audit-logs/` để expose dữ liệu cho frontend
- Chưa có trang UI "Audit Logs" trong Tenant Console

---

### ✅ Gap #4: Quota thiếu trực quan hóa — XÁC NHẬN CHÍNH XÁC

**Báo cáo nêu:** Trang `TenantUsage.jsx` hiển thị thẻ tĩnh, thiếu biểu đồ timeseries.

**Kiểm tra thực tế:**
```python
# File: packages/core/backend/src/commercial/models.py
class QuotaRecord(models.Model):
    """Usage quota tracking per tenant per period."""
    tenant = models.ForeignKey(CoreTenant, ...)
    period_start = models.DateField()
    period_end = models.DateField()
    api_calls_used = models.BigIntegerField(default=0)
    api_calls_limit = models.BigIntegerField(default=-1)
    # ...
```

```javascript
// File: frontend/src/pages/admin/tenant/TenantUsage.jsx
// Lines 71-82: Chỉ có UsageBar (progress bar)
function UsageBar({ consumedAmount, entitledAmount, riskState }) {
  const ratio = entitledAmount > 0 ? Math.min((consumedAmount / entitledAmount) * 100, 100) : 0;
  return (
    <div className="mt-3">
      <div className="h-2 overflow-hidden rounded-full bg-slate-800">
        <div
          className={`h-full rounded-full transition-all ${resolveToneClass(riskState)}`}
          style={{ width: `${ratio}%` }}
        />
      </div>
    </div>
  );
}
```

**Kết luận:** ✅ Báo cáo CHÍNH XÁC. UI hiện tại chỉ hiển thị:
- Static Cards với số tổng (total)
- Progress bar (UsageBar) cho từng meter
- KHÔNG có biểu đồ timeseries (line chart, bar chart) để xem xu hướng theo ngày/giờ
- API endpoint `getTenantUsageMeters()` và `getTenantUsageQuotas()` trả dữ liệu snapshot hiện tại, không phải historical data

Điều này khó cho developer debug khi chạm rate limit — không biết thời điểm nào trong ngày họ dùng nhiều API.

---

### ✅ Gap #5: Billing chỉ hỗ trợ VNPAY — XÁC NHẬN CHÍNH XÁC

**Báo cáo nêu:** Chỉ hỗ trợ thanh toán VNPAY (VND), chưa có Stripe.

**Kiểm tra thực tế:**
```python
# File: packages/core/backend/src/commercial/models.py
class Invoice(models.Model):
    # ...
    currency = models.CharField(max_length=3, default='VND')
    # ...
```

```python
class PaymentTransaction(models.Model):
    # ...
    txn_ref = models.CharField(max_length=64, unique=True, db_index=True)  # vnp_TxnRef
    vnp_transaction_no = models.CharField(max_length=64, null=True, blank=True)
    # ...
```

**Kết luận:** ✅ Báo cáo CHÍNH XÁC.
- Model `Invoice` có trường `currency` (mặc định 'VND'), nhưng hiện chỉ hỗ trợ VNPay
- Model `PaymentTransaction` ghi nhận `vnp_TxnRef`, `vnp_transaction_no` — đặc trưng của VNPay
- Chưa có model/webhook cho Stripe, không có endpoint tạo Stripe Checkout Session
- Không có tính năng tự động upgrade/downgrade plan

Để đạt chuẩn quốc tế, cần tích hợp Stripe Billing Portal.

---

## 3. Các Phát Hiện Thêm Từ Codebase

### 3.1. RBAC/Roles — Tốt hơn báo cáo

Báo cáo nói: "Chỉ có role cứng `admin` và `viewer`".

**Thực tế:**
```python
# File: packages/core/backend/src/identity_access/models.py
class TenantMember(models.Model):
    class RoleChoices(models.TextChoices):
        OWNER = 'owner', 'Owner'
        ADMIN = 'admin', 'Admin'
        MEMBER = 'member', 'Member'
        VIEWER = 'viewer', 'Viewer'
```

✅ **Tốt hơn báo cáo:** Có đầy đủ 4 role, bao gồm OWNER cho phép xác định rõ người s��� hữu tenant.

---

### 3.2. Middleware Resolution — Đã có cơ bản

```python
# File: packages/core/backend/src/identity_access/middleware.py
# Có TenantMiddleware lấy tenant từ owner_user
tenant = CoreTenant.objects.only('public_id',).get(owner_user=user)
```

⚠️ **Nhưng:** Vẫn dựa vào `owner_user`, chưa hỗ trợ `X-Tenant-ID` header.

---

### 3.3. Thư mục Frontend — Đúng như báo cáo

✅ Báo cáo chính xác: Các file tenant admin UI vẫn nằm trong `frontend/src/pages/admin/tenant/` (deprecated), chưa di chuyển sang `packages/web/`.

---

## 4. Kết Luận Chung

| STT | Mã Gap | Nội dung | Tình trạng | Ưu tiên | Hành động |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | Gap #1 | 1-đối-1 User-Tenant API | ✅ Xác nhận | **P0** | Triển khai TenantResolutionMiddleware + X-Tenant-ID header |
| 2 | Gap #2 | Scope thủ công | ✅ Xác nhận | **P1** | Thay input text bằng checkbox list (Visual Policy Editor) |
| 3 | Gap #3 | Audit Logs ẩn | ✅ Xác nhận | **P1** | Tạo API audit-logs + UI xem nhật ký |
| 4 | Gap #4 | Quota thiếu chart | ✅ Xác nhận | **P2** | Thêm timeseries chart (Recharts/Chart.js) |
| 5 | Gap #5 | Billing VNPAY-only | ✅ Xác nhận | **P2** | Tích hợp Stripe Billing Portal |

**Tổng kết:** 5/5 gap trong báo cáo đều được xác nhận CHÍNH XÁC qua kiểm tra codebase. Tất cả các đề xuất trong báo cáo gốc đều hợp lý và cần triển khai.

---

## 5. Các Bước Tiếp Theo (Next Steps)

1. **Gửi phản hồi** — Chuyển file này cho bộ phận yêu cầu báo cáo gốc.
2. ** Xin xác nhận** — Yêu cầu approve để chuyển sang giai đoạn lập kế hoạch hành động chi tiết.
3. **Tạo Action Plan** — Lập kế hoạch chi tiết từng sprint với các milestone rõ ràng.

---

**Người phản hồi:** Antigravity (Advanced Agentic Coding Agent)  
**Ngày hoàn thành đánh giá:** 2026-06-15
