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
from rest_framework import serializers

from identity_access.serializers import TenantWebhookConfigSerializer

__all__ = [
    'DetailResponseSerializer',
    'PartnerBillingStatusSerializer',
    'PlanChangePreviewSerializer',
    'WebhookConfigWithSecretSerializer',
    'WebhookSecretResponseSerializer',
]


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
