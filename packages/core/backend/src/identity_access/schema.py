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
    TenantWebhookConfigSerializer,
)

__all__ = [
    'AbilitySerializer',
    'DetailResponseSerializer',
    'IssuedCorePATSerializer',
    'PATRevocationResponseSerializer',
    'PATRotationResponseSerializer',
    'PartnerBillingStatusSerializer',
    'PartnerRoleListSerializer',
    'PaginatedResultsSerializer',
    'PlanChangePreviewSerializer',
    'ReportTestQueuedSerializer',
    'ScheduledReportDetailSerializer',
    'SSOCallbackSerializer',
    'SSOLoginInitiateSerializer',
    'SSOTestLoginSerializer',
    'TenantCustomRoleWithCountSerializer',
    'TenantLifecycleSerializer',
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
