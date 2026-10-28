"""Schema OpenAPI cho app `commercial`.

## Vì sao file này tồn tại

Cả 7 endpoint mà `commercial` vừa migrate sang `{data, meta}` đều là `APIView`
thuần. drf-spectacular **bỏ qua** chúng (`unable to guess serializer`), và khi
bỏ qua thì nó ghi vào schema:

```yaml
responses:
  '200':
    description: No response body
```

Đó là một **tuyên bố sai**: endpoint có body. Sai theo hướng nguy hiểm hơn là
thiếu, vì người đọc tin là không có gì để kiểm tra.

Đo được trước khi sửa: `manage.py spectacular` báo **1090 lỗi / 202 unique**, và
**192 operation** bị bỏ qua vì lý do này — trong đó `commercial` đúng **7**.

## Vì sao dùng serializer thật thay vì `envelope_response()` trần

`envelope_response()` không tham số sinh `data: <JSON tự do>`. Đúng nhưng vô dụng:
không ai sinh được client từ đó. Vì vậy mỗi shape có một serializer thật.

## Ranh giới: gateway KHÔNG dùng envelope

Các response `{RspCode, Message}` của VNPay **không** dùng helper này — chúng là
hợp đồng với VNPay. Xem `envelope.py` của app này.
"""
from rest_framework import serializers

from vninvest_core.api_envelope import envelope_response  # noqa: F401  (re-export)

__all__ = [
    'LegalPagesDataSerializer',
    'PartnerCostTrendDataSerializer',
    'PartnerCostTrendEmptyDataSerializer',
    'PaymentStatusDataSerializer',
    'StripePortalDataSerializer',
    'StripeSessionDataSerializer',
    'VNPayCreateDataSerializer',
]


class LegalPagesDataSerializer(serializers.Serializer):
    results = serializers.ListField(child=serializers.JSONField())


class VNPayCreateDataSerializer(serializers.Serializer):
    status = serializers.CharField()
    txn_ref = serializers.CharField()
    pay_url = serializers.CharField()
    amount = serializers.DecimalField(max_digits=18, decimal_places=2)


class PaymentStatusDataSerializer(serializers.Serializer):
    txn_ref = serializers.CharField()
    amount = serializers.DecimalField(max_digits=18, decimal_places=2)
    status = serializers.CharField()
    vnp_transaction_no = serializers.CharField(allow_blank=True, required=False)
    updated_at = serializers.CharField()


class StripeSessionDataSerializer(serializers.Serializer):
    session_id = serializers.CharField()
    url = serializers.CharField()


class StripePortalDataSerializer(serializers.Serializer):
    url = serializers.CharField()


class PartnerCostTrendDataSerializer(serializers.Serializer):
    monthly = serializers.ListField(child=serializers.JSONField())
    total_6m = serializers.DecimalField(max_digits=18, decimal_places=2, required=False)
    monthly_avg = serializers.DecimalField(max_digits=18, decimal_places=2, required=False)
    projected_next = serializers.DecimalField(max_digits=18, decimal_places=2, required=False)
    projected_change_pct = serializers.FloatField(required=False)
    currency = serializers.CharField(required=False)


class PartnerCostTrendEmptyDataSerializer(serializers.Serializer):
    monthly = serializers.ListField(child=serializers.JSONField())
    note = serializers.CharField()