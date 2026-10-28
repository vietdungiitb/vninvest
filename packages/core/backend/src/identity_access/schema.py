"""Serializer **chỉ dùng cho schema OpenAPI** của app `identity_access`.

## Vì sao file này tồn tại

App này có **326 operation không mô tả gì** cho response 2xx — không phải vì
`@extend_schema` sai, mà vì **không có `@extend_schema` nào**. Đo tại
`8fcb07b87`: `identity_access` có đúng **0** decorator `@extend_schema`; 33
operation "có mô tả" chỉ vì framework suy ra được từ `serializer_class` của
`GenericAPIView` (tiền lệ `PATListView` để nguyên).

Nên phần lớn payload 2xx ở đây là **dict dựng tay** trong view. Không có
serializer thì không có gì để mô tả. File này bổ sung serializer cho đúng
những payload có hợp đồng **ổn định** — không phải để bịa field.

## Ranh giới: khi nào **không** tạo serializer ở đây

| Trường hợp | Xử lý | Vì sao |
|---|---|---|
| Payload khớp **1:1** serializer đã có | dùng lại serializer đó | tránh trùng hợp đồng |
| Serializer có sẵn **+** key riêng của endpoint | serializer con, thêm key | `POST /webhooks/` trả cấu hình **kèm** `raw_secret`; mô tả bằng `TenantWebhookConfigSerializer` là **thiếu field** — đúng loại lỗi như F5 siblings |
| Dict dựng tay, key ổn định | serializer ở đây | docs có giá trị |
| Dict dựng tay, key **động** | `envelope_response()` (free-form) | liệt kê field không tồn tại còn tệ hơn không mô tả |

## Không đụng `serializers.py`

`serializers.py` là file dùng chung, nhiều agent khác đang sửa. File này chỉ
chứa serializer **read-only, không nhập vào tầng nghiệp vụ**, nên tách riêng để
hai bên không đụng nhau.
"""
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from identity_access.serializers import (
    CorePATCredentialSerializer,
    ReportDeliveryLogSerializer,
    ScheduledReportSerializer,
    TenantCustomRoleSerializer,
    TenantInviteSerializer,
    TenantMemberSerializer,
    TenantWebhookConfigSerializer,
)

__all__ = [
    'AbilitySerializer',
    'DNSECredentialMetadataSerializer',
    'DetailResponseSerializer',
    'IssuedCorePATSerializer',
    'OperatorMailConfigCursorPageSerializer',
    'OperatorMailConfigRowSerializer',
    'OperatorSuccessResponseSerializer',
    'PATRevocationResponseSerializer',
    'PATRotationResponseSerializer',
    'PaginatedResultsSerializer',
    'PartnerBillingStatusSerializer',
    'PartnerRoleListSerializer',
    'PlanChangePreviewSerializer',
    'ReportTestQueuedSerializer',
    'SSOCallbackSerializer',
    'SSOLoginInitiateSerializer',
    'SSOTestLoginSerializer',
    'ScheduledReportDetailSerializer',
    'TenantCustomRoleWithCountSerializer',
    'TenantInviteListSerializer',
    'TenantLifecycleSerializer',
    'TenantMemberListSerializer',
    'TenantSummarySerializer',
    'UserProfilePayloadSerializer',
    'UserProfileWithTenantsSerializer',
    'WebhookConfigWithSecretSerializer',
    'WebhookSecretResponseSerializer',
]


class ScheduledReportDetailSerializer(ScheduledReportSerializer):
    """Kết quả `GET /partner/reports/{id}/` — lịch sử gửi **đính kèm**.

    Khác `ScheduledReportSerializer` ở `delivery_logs`. Đây là kiểu lệch
    "1:1 không còn đúng": view gọi `serializer.data` rồi **gán thêm** key
    (`views_reports.py:72`). Mô tả bằng `ScheduledReportSerializer` là thiếu
    field — cùng loại lỗi với F5 siblings.
    """

    delivery_logs = ReportDeliveryLogSerializer(many=True, read_only=True)

    # `ModelSerializer` **không** tự nối `fields` của lớp cha — thiếu dòng này
    # thì DRF ném `AssertionError: The field 'delivery_logs' was declared ... but
    # has not been included in the 'fields' option` lúc **import**, làm hỏng cả
    # app chứ không riêng endpoint này.
    class Meta(ScheduledReportSerializer.Meta):
        fields = [*ScheduledReportSerializer.Meta.fields, 'delivery_logs']
        read_only_fields = [
            *ScheduledReportSerializer.Meta.read_only_fields, 'delivery_logs',
        ]


class ReportTestQueuedSerializer(serializers.Serializer):
    """Kết quả `POST /partner/reports/{id}/test/` — chỉ xác nhận đã xếp hàng."""

    status = serializers.CharField()
    report_id = serializers.CharField()


class TenantSummarySerializer(serializers.Serializer):
    """Hợp đồng `_tenant_payload()` (`views/helpers.py`) — 9 khoá cố định.

    Tái dùng ở `GET /core/v1/identity/profile/`.
    """

    tenant_id = serializers.CharField()
    public_id = serializers.CharField()
    tenant_code = serializers.CharField()
    display_name = serializers.CharField(allow_null=True)
    plan = serializers.CharField()
    max_active_pats = serializers.IntegerField()
    status = serializers.CharField()
    features = serializers.ListField(child=serializers.CharField())


class AbilitySerializer(serializers.Serializer):
    """Một phần tử của `_build_abilities()` — cặp hành động/chủ thể."""

    action = serializers.CharField()
    subject = serializers.CharField()


# ---------------------------------------------------------------------------
# PAT — `_serialize_partner_pat()`
# ---------------------------------------------------------------------------

class IssuedCorePATSerializer(CorePATCredentialSerializer):
    """PAT vừa cấp — `CorePATCredentialSerializer` **cộng** token thật.

    `_serialize_partner_pat()` (`views_tenant.py:124`) lấy
    `CorePATCredentialSerializer(credential).data` rồi gán thêm
    `secret`/`token`/`access` (ba alias của cùng một chuỗi) — chỉ trả **một
    lần duy nhất**. Dùng `CorePATCredentialSerializer` là thiếu 3 field đó,
    và client sẽ không lấy được token.

    `CorePATIssueResponseSerializer` có sẵn cũng **không** dùng được: nó chỉ
    khai 13 field, còn payload thật có 22.
    """

    secret = serializers.CharField(read_only=True)
    token = serializers.CharField(read_only=True)
    access = serializers.CharField(read_only=True)

    class Meta(CorePATCredentialSerializer.Meta):
        fields = [
            *CorePATCredentialSerializer.Meta.fields,
            'secret', 'token', 'access',
        ]
        read_only_fields = [
            *CorePATCredentialSerializer.Meta.read_only_fields,
            'secret', 'token', 'access',
        ]


class PATRotationResponseSerializer(serializers.Serializer):
    """`POST /partner/pats/{pat_id}/rotate/` — **phẳng**, không phải envelope.

    Cố ý giữ nguyên hợp đồng F4 `{object, …}` mà `views_tenant.py:408` đang
    trả. Endpoint này **không** đồng nhất với `partner_issue_pat` (cái đó đã
    bọc `envelope()`), nên bọc nó vào `{data, meta}` là phá hợp đồng — và sẽ
    làm `test_flat_views_are_not_documented_as_envelope` đỏ.
    """

    object = serializers.CharField()
    old_token_id = serializers.CharField()
    old_token_grace_until = serializers.CharField(allow_null=True)
    new_token = IssuedCorePATSerializer(read_only=True)


class PATRevocationResponseSerializer(serializers.Serializer):
    """`POST /partner/pats/{pat_id}/revoke/` — **phẳng**, F4 `{object, …}`.

    Cùng lý do với `PATRotationResponseSerializer`: `views_tenant.py:435` trả
    thẳng dict có khoá `object`, không bọc envelope.
    """

    object = serializers.CharField()
    token_id = serializers.CharField()
    status = serializers.CharField()
    revoked_at = serializers.CharField(allow_null=True)


class UserProfilePayloadSerializer(serializers.Serializer):
    """Phần hồ đồng nhất của `GET`/`PATCH /core/v1/identity/profile/`.

    Cố tình **không** đặt tên `UserProfileSerializer`: đã có model
    `identity_access/models.py:479` tên `UserProfile`, và drf-spectacular đặt
    tên component theo tên lớp ⇒ hai component trùng tên, khác kiểu. Cảnh báo
    đó **không** làm `spectacular` fail nên không gate nào bắt được.
    """

    username = serializers.CharField()
    email = serializers.CharField(allow_blank=True)
    is_staff = serializers.BooleanField()
    is_superuser = serializers.BooleanField()
    display_name = serializers.CharField(allow_null=True)
    avatar_url = serializers.CharField(allow_null=True)
    language = serializers.CharField(allow_null=True)
    theme = serializers.CharField(allow_null=True)
    whale_alert_threshold = serializers.CharField()
    # JSON tự do tuỳ biến giao diện — liệt kê khoá sẽ khiến client tin có
    # khoá không tồn tại.
    preferences = serializers.DictField()


class UserProfileWithTenantsSerializer(UserProfilePayloadSerializer):
    """`GET` trả **thêm** `tenants` + `abilities`; `PATCH` thì không."""

    tenants = TenantSummarySerializer(many=True, read_only=True)
    abilities = AbilitySerializer(many=True, read_only=True)


class TenantLifecycleSerializer(serializers.Serializer):
    """Kết quả `GET /core/v1/tenant/lifecycle/` — dùng để chặn feature."""

    plan = serializers.CharField()
    status = serializers.CharField()
    tenant_id = serializers.CharField()
    tenant_code = serializers.CharField()
    display_name = serializers.CharField(allow_null=True)


class TenantCustomRoleWithCountSerializer(TenantCustomRoleSerializer):
    """`TenantCustomRoleSerializer` + khai báo kiểu cho `member_count`.

    Không phải để "làm đẹp": `get_member_count()` (`serializers.py:552`) trả
    `obj.members.count()` nhưng **không** có type hint, nên drf-spectacular cảnh
    báo *"unable to resolve type hint ... Defaulting to string"* và mô tả
    `member_count` thành **chuỗi** — sai kiểu so với thực tế.

    Trước khi serializer này được schema tham chiếu thì cảnh báo đó **không
    hiện** (không ai đọc tới). Việc mô tả endpoint làm nó lộ ra, nên ở lại đây
    thay vì sửa `serializers.py` — file dùng chung, nhiều agent khác đang đụng.

    Không thêm field nào ⇒ **không** cần khai lại `Meta`.
    """

    @extend_schema_field(serializers.IntegerField())
    def get_member_count(self, obj):
        return super().get_member_count(obj)


class PartnerRoleListSerializer(serializers.Serializer):
    """`GET /partner/roles/` bọc trong `{roles: [...]}` — không phải mảng thẳng.

    `envelope_response(TenantCustomRoleSerializer, many=True)` sẽ mô tả sai:
    `data` phải là **object** chứa `roles`, không phải array.
    """

    roles = TenantCustomRoleWithCountSerializer(many=True, read_only=True)


# ---------------------------------------------------------------------------
# SSO
# ---------------------------------------------------------------------------

class SSOLoginInitiateSerializer(serializers.Serializer):
    """Nhánh SPA của `GET /core/v1/auth/sso/login/`.

    View còn có nhánh `HttpResponseRedirect` cho trình duyệt đi thẳng
    (`sso.py:156`) — nhánh đó là **302**, không thuộc 200.
    """

    redirect_url = serializers.CharField()
    sso_url = serializers.CharField()
    tenant_id = serializers.CharField()
    tenant_name = serializers.CharField(allow_null=True)


class SSOTestLoginSerializer(serializers.Serializer):
    """Kết quả `POST /core/v1/partner/sso/test-login/`."""

    redirect_url = serializers.CharField()
    sso_url = serializers.CharField()


class SSOCallbackUserSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    username = serializers.CharField()
    email = serializers.CharField(allow_blank=True)


class SSOCallbackTenantSerializer(serializers.Serializer):
    tenant_id = serializers.CharField()
    tenant_code = serializers.CharField()
    display_name = serializers.CharField(allow_null=True)
    plan = serializers.CharField()


class SSOCallbackMemberSerializer(serializers.Serializer):
    role = serializers.CharField()


class SSOCallbackSerializer(serializers.Serializer):
    """Kết quả `POST|GET /core/v1/auth/sso/callback/`.

    `access`/`token` là **token thật** (JWT) trả về một lần — không phải PAT.
    """

    access = serializers.CharField()
    token = serializers.CharField()
    user = SSOCallbackUserSerializer(read_only=True)
    tenant = SSOCallbackTenantSerializer(read_only=True)
    member = SSOCallbackMemberSerializer(read_only=True)


class PaginatedResultsSerializer(serializers.Serializer):
    """`{results: [...]}` — dùng khi view bọc trong `paginated_envelope()`.

    Cần cho các view của `commercial_partner_views.py` gọi serializer **lazy
    import** (`from commercial.serializers import PartnerUsageMeterSerializer`
    *bên trong* method). Không thể đưa serializer đó vào `@extend_schema` vì
    decorator chạy lúc **import**, còn import kiểu đó cố ý để chịu được
    trường hợp app `commercial` chưa migrate.

    Vì vậy ở đây chỉ khẳng định điều chắc chắn — **`data` là object có mảng
    `results`** — chứ không liệt kê field của app kia.
    """

    results = serializers.ListField(child=serializers.JSONField())


# ---------------------------------------------------------------------------
# F3 — `success_response()` của views_operator
# ---------------------------------------------------------------------------

class OperatorSuccessResponseSerializer(serializers.Serializer):
    """F3 `{status, timestamp, request_id, data}` — hợp đồng **phẳng**.

    `views_operator.success_response()` (`views_operator.py:21`) trả đúng
    shape này ở **6** call site. Bộ phân loại của
    `scripts/check-envelope-contract.py` xếp nó là `SKIP_F3`.

    Ranh giới quan trọng: `data` nằm **trong** F3, không phải `data` của
    envelope `{data, meta}`. Trông giống nhau nên rất dễ bọc nhầm — mà bọc
    nhầm thì `meta` biến mất và client mất `request_id` để tra log.
    """

    status = serializers.CharField()
    timestamp = serializers.CharField()
    request_id = serializers.CharField()
    data = serializers.JSONField()


class OperatorMailConfigRowSerializer(serializers.Serializer):
    """Một dòng của `GET /core/v1/operator/mail-config/`.

    Hợp đồng đã **ẩn** secret: `smtp_password_configured` /
    `google_service_account_json_configured` là bool, không phải bản mật.
    """

    id = serializers.IntegerField()
    provider = serializers.CharField()
    is_active = serializers.BooleanField()
    from_email = serializers.CharField(allow_null=True)
    smtp_host = serializers.CharField(allow_null=True)
    smtp_port = serializers.IntegerField(allow_null=True)
    smtp_username = serializers.CharField(allow_null=True)
    smtp_password_configured = serializers.BooleanField()
    smtp_use_tls = serializers.BooleanField()
    smtp_use_ssl = serializers.BooleanField()
    google_service_account_json_configured = serializers.BooleanField()
    google_delegated_user_email = serializers.CharField(allow_null=True)
    created_at = serializers.CharField()
    updated_at = serializers.CharField()


class OperatorMailConfigCursorPageSerializer(serializers.Serializer):
    """`data` của `GET /core/v1/operator/mail-config/`.

    View dựng `results` tay rồi bọc cả khối cursor pagination
    (`views_operator.py:70`) nên `data` là **object** `{next, previous,
    results}` — không phải mảng thẳng.
    """

    next = serializers.CharField(allow_null=True)
    previous = serializers.CharField(allow_null=True)
    results = OperatorMailConfigRowSerializer(many=True, read_only=True)


# ---------------------------------------------------------------------------
# DNSE credential
# ---------------------------------------------------------------------------

class DNSECredentialMetadataSerializer(serializers.Serializer):
    """Metadata của `_safe_serialize()` — cố ý **không** có api_key/secret.

    `GET` và `POST` dùng chung shape này (`dnse_credential_views.py:50, :81`).
    """

    user_id = serializers.IntegerField()
    username = serializers.CharField()
    is_system_provider = serializers.BooleanField()
    is_verified = serializers.BooleanField()
    last_verified_at = serializers.CharField(allow_null=True)
    created_at = serializers.CharField()
    updated_at = serializers.CharField()


# ---------------------------------------------------------------------------
# Tenant member / invite
# ---------------------------------------------------------------------------

class TenantMemberListSerializer(serializers.Serializer):
    """`GET /core/v1/tenant-members/` — `{members: [...]}`, không phải mảng."""

    members = TenantMemberSerializer(many=True, read_only=True)


class TenantInviteListSerializer(serializers.Serializer):
    """`GET /core/v1/tenant-members/invites/` — `{invites: [...]}`."""

    invites = TenantInviteSerializer(many=True, read_only=True)


class DetailResponseSerializer(serializers.Serializer):
    """`{detail}` — nhánh "làm xong rồi", xuất hiện ở nhiều view."""

    detail = serializers.CharField()


class WebhookConfigWithSecretSerializer(TenantWebhookConfigSerializer):
    """Kết quả `POST /partner/webhooks/`.

    Khác `TenantWebhookConfigSerializer` ở đúng một chỗ: có thêm
    `raw_secret`, chỉ trả **một lần** duy nhất. Bỏ field này thì client tạo
    webhook không lấy được chữ ký HMAC ⇒ tưởng cấu hình hỏng.
    """

    raw_secret = serializers.CharField(read_only=True)

    class Meta(TenantWebhookConfigSerializer.Meta):
        # `Meta` phải khai lại: `ModelSerializer` **không** tự nối `fields` của
        # lớp cha. Không có dòng này thì DRF ném `AssertionError: The field
        # 'raw_secret' was declared ... but has not been included in the 'fields'
        # option` — và vì `@extend_schema` chạy lúc **import**, lỗi này làm hỏng
        # **cả app** chứ không riêng endpoint.
        fields = [*TenantWebhookConfigSerializer.Meta.fields, 'raw_secret']
        read_only_fields = [
            *TenantWebhookConfigSerializer.Meta.read_only_fields, 'raw_secret',
        ]


class WebhookSecretResponseSerializer(serializers.Serializer):
    """Kết quả `POST /partner/webhooks/{id}/regenerate-secret/`."""

    raw_secret = serializers.CharField()


class PartnerBillingStatusSerializer(serializers.Serializer):
    """Kết quả `GET /partner/billing/status/` — dựng tay trong view."""

    plan = serializers.CharField()
    status = serializers.CharField()
    pending = serializers.BooleanField()
    trial_ends_at = serializers.CharField(allow_null=True)
    stripe_current_period_end = serializers.CharField(allow_null=True)


class PlanChangePreviewSerializer(serializers.Serializer):
    """Kết quả `POST /partner/subscription/preview-change/`.

    `changes` là dict **động** (key là tên feature) ⇒ `DictField`, không liệt
    kê `api_calls`/`members`/… — key nào không đổi thì vắng mặt, liệt kê cứng
    sẽ bắt client tin có field không tồn tại.
    """

    current_plan = serializers.CharField()
    target_plan = serializers.CharField()
    prorated_amount = serializers.IntegerField()
    next_billing_amount = serializers.IntegerField()
    effective_date = serializers.CharField()
    trial_extension_days = serializers.IntegerField(allow_null=True)
    changes = serializers.DictField()


# ---------------------------------------------------------------------------
# View `@api_view` — phần `@extend_schema` còn thiếu (B5 idoc, 2026-10-02)
# ---------------------------------------------------------------------------
# 131 operation của 14 module dưới đây là view `@api_view` — không phải class
# DRF — nên chúng **không có** `@extend_schema` nào và drf-spectacular sinh ra
# `200: {description: "No response body"}`. Toàn bộ nhóm dưới đây bị bỏ qua
# im lặng bởi `EnvelopeGlobalInvariantTest`, vì `_methods_of()` đi tìm
# `ClassDef` trong source mà `@api_view` không có `ClassDef`.
#
# Danh sách key bên dưới đều đọc từ **dict literal trong view**, không suy
# đoán. Payload có key **động** thì dùng `DictField`/`JSONField`, không liệt
# kê cứng — xem bảng "Khi nào KHÔNG tạo serializer" ở đầu file.


#: F3 `{status, timestamp, request_id, data}` — **alias** của
#: `OperatorSuccessResponseSerializer`, dùng cho `views/helpers.success_response`
#: (`views/helpers.py:327`) ở `login` / `register`.
#:
#: Cùng shape ⇒ cùng **một** class, không phải hai. Nếu định nghĩa class thứ
#: hai, drf-spectacular sẽ sinh hai component trùng tên `OperatorSuccessResponse`
#: với identity khác nhau và cảnh báo
#: `Encountered 2 components with identical names ... will very likely result in
#: an incorrect schema` — cảnh báo đó **không** làm lệnh `spectacular` fail.
F3SuccessResponseSerializer = OperatorSuccessResponseSerializer


class DetailPayloadSerializer(serializers.Serializer):
    """`envelope({'detail': ...})` — nhánh trả về chỉ có một thông điệp.

    `logout_view` (`views/login.py:272,273`) và `partner_revoke_session`
    (`views_security.py:146,153`) đều rơi vào shape này.
    """

    detail = serializers.CharField()


class PartnerAlertConfigSerializer(serializers.Serializer):
    """Một dòng cấu hình ngưỡng cảnh báo — `views_alert_config.py:82,128`.

    Trả về **giống nhau** ở cả `GET` và `PATCH` detail ⇒ dùng chung một
    serializer, tránh trôi hợp đồng giữa hai method.
    """

    meter_code = serializers.CharField()
    warning_pct = serializers.IntegerField()
    critical_pct = serializers.IntegerField()
    enabled = serializers.BooleanField()
    notify_email = serializers.BooleanField()
    created_at = serializers.CharField()
    updated_at = serializers.CharField()


class PartnerAlertConfigListSerializer(serializers.Serializer):
    """`envelope({'configs': [...]})` — `views_alert_config.py:52`."""

    configs = PartnerAlertConfigSerializer(many=True)


class LoginActivityDailySerializer(serializers.Serializer):
    """Một ngày trong `partner_login_activity` — `views_security.py`.

    `daily` được dựng ở `_query_daily_login_activity`; các key số đếm là
    `IntegerField`, còn `date` là ISO string.
    """

    date = serializers.CharField()
    success = serializers.IntegerField()
    failed = serializers.IntegerField()


class LoginActivitySummarySerializer(serializers.Serializer):
    """`summary` của `partner_login_activity` — `views_security.py:87`."""

    total_logins = serializers.IntegerField()
    total_failed = serializers.IntegerField()
    success_rate_pct = serializers.FloatField(allow_null=True)
    unique_ips = serializers.IntegerField()
    unique_users = serializers.IntegerField()
    most_active_day = serializers.CharField(allow_null=True)
    recent_failures = serializers.ListField(child=serializers.JSONField())


class PartnerLoginActivitySerializer(serializers.Serializer):
    """`envelope({'daily': ..., 'summary': ...})` — `views_security.py:87`."""

    daily = LoginActivityDailySerializer(many=True)
    summary = LoginActivitySummarySerializer()


class PartnerActiveSessionSerializer(serializers.Serializer):
    """Một phiên đang hoạt động — `views_security.py:114`."""

    session_id = serializers.CharField()
    user_id = serializers.IntegerField()
    username = serializers.CharField()
    ip_address = serializers.CharField()
    user_agent = serializers.CharField()
    login_at = serializers.CharField()
    last_active_at = serializers.CharField()
    token_prefix = serializers.CharField()
    is_current = serializers.BooleanField()


class PartnerActiveSessionsSerializer(serializers.Serializer):
    """`paginated_envelope({'sessions': ..., 'total_active': ...})`.

    Đây là `data` của envelope, **không phải** `results`/`count`/`next` của
    `CoreCursorPagination` — view tự gom vào key `sessions` rồi bọc.
    """

    sessions = PartnerActiveSessionSerializer(many=True)
    total_active = serializers.IntegerField()


class DashboardDailyPointSerializer(serializers.Serializer):
    """Một ngày trong `partner_dashboard_usage_trend` — `views_dashboard.py:226`."""

    date = serializers.CharField()
    api_calls = serializers.IntegerField()
    active_members = serializers.IntegerField()


class PartnerDashboardUsageTrendSerializer(serializers.Serializer):
    """`envelope({'daily': ..., 'days': ...})` — `views_dashboard.py:232`."""

    daily = DashboardDailyPointSerializer(many=True)
    days = serializers.IntegerField()


class UsageForecastSerializer(serializers.Serializer):
    """Dự báo của **một** meter — `_forecast_meter` (`views_forecast.py`).

    `daily_rate` / `days_remaining` / `forecast_exhaust_date` là `None` khi
    chưa đủ dữ liệu (`confidence == 'insufficient_data'`) ⇒ cho phép null.
    """

    meter_code = serializers.CharField()
    daily_rate = serializers.FloatField(allow_null=True)
    days_remaining = serializers.IntegerField(allow_null=True)
    forecast_exhaust_date = serializers.CharField(allow_null=True)
    confidence = serializers.CharField()
    total_entitled = serializers.IntegerField()
    total_consumed = serializers.IntegerField()
    remaining = serializers.IntegerField()


class PartnerUsageForecastListSerializer(serializers.Serializer):
    """`envelope({'forecasts': [...], 'lookback_days': ...})` — `views_forecast.py:125`."""

    forecasts = UsageForecastSerializer(many=True)
    lookback_days = serializers.IntegerField()


class UsageTrendDailySerializer(serializers.Serializer):
    """Một ngày trong `partner_usage_trend` — `views_usage_trend.py:72`."""

    date = serializers.CharField()
    consumed = serializers.IntegerField()


class PartnerUsageTrendSerializer(serializers.Serializer):
    """`envelope({'meter_code', 'daily', 'days', 'start_date', 'end_date'})`.

    Lưu ý ranh giới: đây là `data` của **envelope** `{data, meta}` — key
    `daily` nằm trong `data`, không phải sibling. Hợp đồng khác hẳn với
    `views_usage.partner_api_timeline` (`SKIP_F5_SIBLINGS`), nơi `data` nằm
    **ngang hàng** `interval`/`days`/`start_date`/`end_date` và **không** được
    ép về envelope.
    """

    meter_code = serializers.CharField()
    daily = UsageTrendDailySerializer(many=True)
    days = serializers.IntegerField()
    start_date = serializers.CharField()
    end_date = serializers.CharField()


class PartnerUsageTrendAllSerializer(serializers.Serializer):
    """`envelope({'meters', 'days', 'start_date', 'end_date'})`.

    `meters` là dict **động** — key là tên meter (`api_calls`,
    `ai_regenerate`, `whale_symbols`, `exports`) ⇒ `DictField`, không liệt kê
    cứng.
    """

    meters = serializers.DictField()
    days = serializers.IntegerField()
    start_date = serializers.CharField()
    end_date = serializers.CharField()


class PartnerApiUsageSerializer(serializers.Serializer):
    """`GET /partner/usage/api-calls/` — hợp đồng **phẳng**, không phải envelope.

    `views_usage.partner_api_usage` (`views_usage.py:26`) trả
    `{summary, data, filters}` — `data` nằm **ngang hàng** với sibling nên
    bọc vào `{data, meta}` sẽ **làm rơi** `summary`/`filters`. Bộ phân loại
    của `scripts/check-envelope-contract.py` xếp là `SKIP_F5_SIBLINGS`; ở
    đây mô tả đúng shape thật.
    """

    summary = serializers.JSONField()
    data = serializers.JSONField()
    filters = serializers.JSONField()


class PartnerApiTimelineSerializer(serializers.Serializer):
    """`GET /partner/usage/api-calls/timeline/` — phẳng, cùng lý do trên.

    `views_usage.py:205` trả `{interval, data, days, start_date, end_date}`.
    """

    interval = serializers.CharField()
    data = serializers.ListField(child=serializers.JSONField())
    days = serializers.IntegerField()
    start_date = serializers.CharField()
    end_date = serializers.CharField()


class PersonalPATRotationSerializer(serializers.Serializer):
    """`POST /partner/me/keys/{key_id}/rotate/` — **phẳng** (F4), không envelope.

    Cùng hợp đồng với `PATRotationResponseSerializer` của `partner_rotate_pat`
    (`views_tenant.py:386`) chỉ khác giá trị `object`. Bọc nó vào
    `{data, meta}` sẽ phá hợp đồng — xem `api_envelope.py` §"Vì sao KHÔNG ép
    mọi 2xx vào envelope".
    """

    object = serializers.CharField()
    old_token_id = serializers.CharField()
    old_token_grace_until = serializers.CharField(allow_null=True)
    new_token = IssuedCorePATSerializer()


class PersonalPATRevocationSerializer(serializers.Serializer):
    """`POST /partner/me/keys/{key_id}/revoke/` — **phẳng** (F4)."""

    object = serializers.CharField()
    token_id = serializers.CharField()
    status = serializers.CharField()
    revoked_at = serializers.CharField(allow_null=True)


class PATUsageRowSerializer(serializers.Serializer):
    """Một dòng PAT trong bảng usage — `views_tenant.py:595,632`.

    Dùng chung cho cả `pats_usage` (tenant-wide) và `pats` (per service
    account) của `views_tenant.py`, lẫn `keys` của
    `personal_keys_usage_summary` (`views_personal.py:243`) — ba chỗ đó là
    **cùng một hợp đồng** `{pat_id, label, calls_30d, last_used_at}`, nên chỉ
    định nghĩa một lần. Hai định nghĩa cùng shape sẽ trôi khỏi nhau khi một
    bên sửa.
    """

    pat_id = serializers.CharField()
    label = serializers.CharField()
    calls_30d = serializers.IntegerField()
    last_used_at = serializers.CharField(allow_null=True)


class PersonalKeysUsageSummarySerializer(serializers.Serializer):
    """`GET /partner/me/keys/usage-summary/` — `views_personal.py:238`."""

    total_keys = serializers.IntegerField()
    active_keys = serializers.IntegerField()
    total_calls_30d = serializers.IntegerField()
    keys = PATUsageRowSerializer(many=True)


class PersonalSummaryTenantSerializer(serializers.Serializer):
    """Khối `tenant` của `personal_summary` — `views_personal.py:281`."""

    plan = serializers.CharField()
    status = serializers.CharField()
    display_name = serializers.CharField()
    tenant_code = serializers.CharField()


class PersonalSummaryQuotaSerializer(serializers.Serializer):
    """Khối `quotas` — `views_personal.py:287` (xem `_current_period_quotas`).

    `api_calls_limit = -1` nghĩa là không giới hạn, nên `IntegerField` chứ
    không phải số dương.
    """

    api_calls_limit = serializers.IntegerField()
    period_start = serializers.CharField(allow_null=True)
    period_end = serializers.CharField(allow_null=True)


class PersonalSummaryMySerializer(serializers.Serializer):
    """Khối `my` — `views_personal.py:288`."""

    total_keys = serializers.IntegerField()
    active_keys = serializers.IntegerField()
    calls_30d = serializers.IntegerField()


class PersonalSummarySerializer(serializers.Serializer):
    """`GET /partner/me/summary/` — `views_personal.py:280`."""

    tenant = PersonalSummaryTenantSerializer()
    quotas = PersonalSummaryQuotaSerializer()
    my = PersonalSummaryMySerializer()


class PartnerPATUsageSerializer(serializers.Serializer):
    """`GET /partner/pats/{pat_id}/usage/` — `views_tenant.py:563`.

    `top_endpoints` là list các `(endpoint, count)` dựng tay và `status_breakdown`
    là dict `{'2xx','4xx','5xx'}` — cả hai để `JSONField`/`DictField` thay vì
    liệt kê field không chắc ổn định.
    """

    pat_id = serializers.CharField()
    label = serializers.CharField()
    total_calls = serializers.IntegerField()
    unique_ips = serializers.IntegerField()
    top_endpoints = serializers.JSONField()
    status_breakdown = serializers.DictField()
    timeline = serializers.JSONField()
    last_used_at = serializers.CharField(allow_null=True)
    expires_at = serializers.CharField(allow_null=True)


class PartnerPATUsageSummarySerializer(serializers.Serializer):
    """`GET /partner/pats/usage-summary/` — `views_tenant.py:604`."""

    total_pats = serializers.IntegerField()
    active_pats = serializers.IntegerField()
    total_calls_30d = serializers.IntegerField()
    pats_usage = PATUsageRowSerializer(many=True)


class PartnerServiceAccountUsageSerializer(serializers.Serializer):
    """`GET /partner/service-accounts/{sa_id}/usage/` — `views_tenant.py:639`."""

    sa_id = serializers.CharField()
    name = serializers.CharField()
    total_pats = serializers.IntegerField()
    total_calls = serializers.IntegerField()
    pats = PATUsageRowSerializer(many=True)
