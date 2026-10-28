"""D1 (v34 upgrade): endpoint tham chiếu bán lẻ — vàng SJC/BTMC + tỷ giá VCB.

Nguồn: vnbroker retail facade (v3.4.0, không cần credential).
GET /core/v1/broker/retail/gold/?source=sjc|btmc&date=YYYY-MM-DD
GET /core/v1/broker/retail/exchange-rate/?date=YYYY-MM-DD
Cache 1h. Không secret, không write.
"""
from django.core.cache import cache
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated

from vninvest_core.exceptions import ValidationErrorException

from .envelope import envelope
from drf_spectacular.utils import extend_schema
from drf_spectacular.openapi import OpenApiTypes
from vninvest_core.api_envelope import envelope_response


GOLD_SOURCES = ('sjc', 'btmc')
CACHE_TTL_SECONDS = 3600


def _get_retail():
    try:
        from vnbroker import Vnbroker
        return Vnbroker().retail()
    except ImportError as exc:
        raise ValidationErrorException(
            detail='Retail facade chưa khả dụng (cần vnbroker >= 3.3).',
            code='broker_unavailable',
        ) from exc


def _frame_to_records(frame) -> list:
    if frame is None:
        return []
    try:
        if hasattr(frame, 'empty') and frame.empty:
            return []
        rows = frame.to_dict('records')
        return rows if isinstance(rows, list) else []
    except Exception:
        return []


@extend_schema(
    summary='retail_gold_api',
    description='Declared so drf-spectacular stops reporting an unguessable serializer; payload shape is verified by the envelope invariant tests.',
    request=OpenApiTypes.OBJECT,
    responses={
        200: envelope_response(),
    },
)
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def retail_gold_api(request):
    """Giá vàng SJC/BTMC theo ngày (None = hôm nay)."""
    source = str(request.query_params.get('source', 'sjc') or '').strip().lower()
    date = str(request.query_params.get('date', '') or '').strip() or None
    if source not in GOLD_SOURCES:
        raise ValidationErrorException(
            detail='source phải là sjc hoặc btmc.', code='validation_error')
    cache_key = f'broker:retail:gold:{source}:{date or "today"}'
    cached = cache.get(cache_key)
    if cached is not None:
        return envelope(
            {'ok': True, 'source': source, 'date': date, 'rows': cached,
             'cached': True})
    try:
        frame = _get_retail().gold(source=source, date=date)
    except ValueError as exc:
        raise ValidationErrorException(detail=str(exc), code='validation_error') from exc
    except Exception as exc:
        raise ValidationErrorException(
            detail=f'Không lấy được giá vàng: {type(exc).__name__}',
            code='upstream_error') from exc
    rows = _frame_to_records(frame)
    cache.set(cache_key, rows, CACHE_TTL_SECONDS)
    return envelope({'ok': True, 'source': source, 'date': date, 'rows': rows,
                     'cached': False})


@extend_schema(
    summary='retail_exchange_rate_api',
    description='Declared so drf-spectacular stops reporting an unguessable serializer; payload shape is verified by the envelope invariant tests.',
    request=OpenApiTypes.OBJECT,
    responses={
        200: envelope_response(),
    },
)
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def retail_exchange_rate_api(request):
    """Tỷ giá Vietcombank theo ngày (None = hôm nay)."""
    date = str(request.query_params.get('date', '') or '').strip() or None
    cache_key = f'broker:retail:fx:{date or "today"}'
    cached = cache.get(cache_key)
    if cached is not None:
        return envelope(
            {'ok': True, 'source': 'vcb', 'date': date, 'rows': cached,
             'cached': True})
    try:
        frame = _get_retail().exchange_rate(date=date)
    except ValueError as exc:
        raise ValidationErrorException(detail=str(exc), code='validation_error') from exc
    except Exception as exc:
        raise ValidationErrorException(
            detail=f'Không lấy được tỷ giá: {type(exc).__name__}',
            code='upstream_error') from exc
    rows = _frame_to_records(frame)
    cache.set(cache_key, rows, CACHE_TTL_SECONDS)
    return envelope({'ok': True, 'source': 'vcb', 'date': date, 'rows': rows,
                     'cached': False})
