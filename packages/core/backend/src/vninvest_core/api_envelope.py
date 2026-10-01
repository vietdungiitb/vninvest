"""
Mô tả OpenAPI cho envelope `{data, meta}` — **điểm vào duy nhất cho schema**.

## Vì sao file này tồn tại

Ba app đã bọc response 2xx thành `{data, meta}`:

| app | commit |
|---|---|
| `identity_access` | `02d8b25f1` |
| `service_ops` | `07d7be028` |
| `user_workspace` | `4c59dc1ab` |

Nhưng **schema OpenAPI vẫn mô tả shape cũ** (phẳng). Đo tại `4c59dc1ab`:
**256 operation** mô tả sai (đều do `@extend_schema(responses=...)` trỏ
thẳng vào `XxxResponseSerializer`), và **372 operation** không mô tả gì cho 2xx.
Test `service_ops/tests/test_soc_api_domain.py` **pass nhầm** vì chỉ assert
`summary` / `requestBody` / `security`, không assert shape `responses`.

Sửa 256 chỗ bằng tay thì không bền — lần refactor sau sẽ hỏng lại, và không ai
đọc lại schema cho tới khi có bug. Nên đặt **một** helper ở đây rồi tham chiếu.

## Vì sao KHÔNG ép mọi 2xx vào envelope

Đây là ranh giới quan trọng nhất của file. Bọc bừa sẽ **làm docs sai ở hướng
mới** — tệ hơn hiện trạng, vì hiện trạng sai thì người đọc còn nghi ngờ, còn
bọc bừa thì nó *trông* chính xác:

| Trường hợp | Xử lý | Vì sao |
|---|---|---|
| 2xx đã bọc | `envelope_response(...)` | đúng hợp đồng |
| **≥ 400** | **không đụng** | lỗi đi qua RFC 9457 `application/problem+json` (`vninvest_core.exceptions.core_api_exception_handler`) — hợp đồng khác hẳn, không phải `{data, meta}` |
| **204/205/304** | **không đụng** | không có body |
| **F4** `{object, generated_at, …}` | **không đụng** | hợp đồng phẳng riêng |
| **F5** `{data, +siblings}` | **không đụng** | bọc sẽ **làm rơi sibling** |
| `market_serving` contract 2.0 | **không đụng** | hợp đồng riêng |

Quy tắc phân loại F3/F4/F5 đã có sẵn và đã được máy kiểm trong
`scripts/check-envelope-contract.py` — helper này dùng **cùng** tiêu chí đó,
không tự phát minh tiêu chí thứ hai.

## Dùng

```python
from vninvest_core.api_envelope import envelope_response

@extend_schema(
    responses={
        200: envelope_response(PrefetchConfigResponseSerializer),
        401: OpenApiTypes.OBJECT,   # RFC 9457 — để nguyên
    },
)
```

`data` là list thì truyền `many=True`:

```python
200: envelope_response(DeliveryRowSerializer, many=True)
```

Không có serializer nội bộ (payload dựng tay) thì bỏ tham số:

```python
200: envelope_response()          # data: free-form, meta: object
```
"""
from rest_framework import serializers
from drf_spectacular.utils import OpenApiResponse

__all__ = ['envelope_response', 'EnvelopeMetaField']


def EnvelopeMetaField(**kwargs):
    """`meta` — provenance tự do.

    Cố ý **không** liệt kê field: `meta` chỉ mang provenance **đã có sẵn**
    (`as_of` / `stale` / `calculation_version` / `source`), app nào không có
    thì để `{}`. Liệt kê một danh sách field lý tưởng sẽ khiến client tin vào
    những key không tồn tại — đúng thứ mà `envelope.py` của các app đã cảnh
    báo khi chọn `meta` tối thiểu.
    """
    kwargs.setdefault('required', False)
    return serializers.DictField(**kwargs)


def _is_serializer(obj) -> bool:
    """Chấp nhận cả **class** lẫn **instance** của serializer.

    `isinstance(XSerializer, BaseSerializer)` là **False** — class được tạo bởi
    `SerializerMetaclass`, không phải instance. Kiểm tra sai kiểu này làm
    `envelope_response(SomeSerializer)` ném `TypeError` lúc import, và vì
    `@extend_schema` chạy lúc import nên **mất trắng cả app** — lỗi import
    trong `urls.py`, không phải lỗi schema.
    """
    if isinstance(obj, serializers.BaseSerializer):
        return True
    return isinstance(obj, type) and issubclass(obj, serializers.BaseSerializer)


def _as_field(inner, many: bool):
    """Chuẩn hoá payload nội bộ thành **field instance** mà DRF nhận.

    `SerializerMetaclass._get_declared_fields` chỉ gom `isinstance(obj, Field)`
    — một serializer **class** gán làm class attribute **không phải** Field nên
    bị bỏ qua âm thầm, và component sinh ra chỉ còn `meta`. Đó chính là lý do
    `data` biến mất ở lần thử đầu: schema không báo lỗi, chỉ thiếu một field.
    """
    if inner is None:
        if many:
            return serializers.ListField(child=serializers.JSONField())
        return serializers.JSONField()
    if isinstance(inner, type):
        return inner(many=many)
    if many and not getattr(inner, 'many', False):
        child = getattr(inner, 'child', None) or inner
        return type(child)(many=True)
    return inner


def _component_name(inner) -> str:
    """Tên component tất định — không dùng `id()` (đổi mỗi lần chạy)."""
    if inner is None:
        return 'DataMetaEnvelope'
    name = getattr(inner, '__name__', None)
    if not name:
        # `XSerializer(many=True)` là instance, không có `__name__`.
        child = getattr(inner, 'child', None)
        name = getattr(child, '__name__', None) or 'Data'
    # `XResponseSerializer` -> `XResponseEnvelope`: bỏ hậu tố `Serializer` cho
    # component dễ đọc trong docs, nhưng vẫn tất định.
    if name.endswith('Serializer') and len(name) > len('Serializer'):
        name = name[: -len('Serializer')]
    return f'{name}Envelope'


def envelope_response(inner=None, *, many: bool = False,
                       description=None, examples=None) -> OpenApiResponse:
    """Trả `OpenApiResponse` mô tả `{data: <inner>, meta: {...}}`.

    Args:
        inner: serializer **class** hoặc **instance** của payload thật. Bỏ
            trống ⇒ `data` là free-form.
        many: `data` là mảng ⇒ bọc `inner` vào `ListField`.
        description: mô tả response.
        examples: ví dụ như `OpenApiExample` của `@extend_schema`.

    Returns:
        `OpenApiResponse` — dùng thẳng trong `@extend_schema(responses=...)`.

    Raises:
        TypeError: nếu truyền thứ không phải serializer. Bắt lỗi ngay ở import
            time còn hơn schema âm thầm đổi thành `object` free-form rồi
            docs sai mà không ai biết.
    """
    if not _is_serializer(inner):
        raise TypeError(
            'envelope_response() nhan serializer class/instance, nhan '
            f'{type(inner).__name__}. Neu payload la free-form, bo tham so.'
        )

    name = _component_name(inner)
    attrs = {
        'data': _as_field(inner, many),
        'meta': EnvelopeMetaField(),
        'Meta': type('Meta', (), {'ref_name': name}),
    }
    envelope_cls = type(name, (serializers.Serializer,), attrs)
    return OpenApiResponse(
        response=envelope_cls(),
        description=description,
        examples=examples,
    )