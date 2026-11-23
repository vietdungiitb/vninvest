"""Read API cho CorporateAction — phuc vu widget overlay (Task 1).

Endpoint: GET /core/v1/stock-management/stocks/<symbol>/corporate-actions/
`?from=YYYY-MM-DD&to=YYYY-MM-DD&limit=N`.
Nguon: bang CorporateAction (pipeline ingest VCI, nightly sync), khong goi provider truc tiep.
"""
from datetime import timedelta

from django.utils import timezone
from drf_spectacular.utils import OpenApiParameter, OpenApiTypes, extend_schema
from rest_framework import permissions
from rest_framework.exceptions import NotFound
from rest_framework.views import APIView

from identity_access.permissions import IsTenantActive, require_pat_scopes_or_human_session
from vninvest_core.exceptions import ValidationErrorException

from ..envelope import envelope
from ..models import CorporateAction, StockProfile

TENANT_PERMISSION_CLASSES = [permissions.IsAuthenticated, IsTenantActive]

_DEFAULT_WINDOW_DAYS = 365
_DEFAULT_LIMIT = 200
_MAX_LIMIT = 1000


def _parse_date(value):
    if not value:
        return None
    try:
        return timezone.datetime.strptime(str(value).strip()[:10], '%Y-%m-%d').date()
    except (ValueError, TypeError):
        return None


def _to_float(value):
    if value is None:
        return None
    return float(value)


def _serialize_action(action):
    return {
        'id': f'{action.source}:{action.source_event_id}',
        'symbol': action.symbol,
        'action_type': action.action_type,
        'ex_date': action.ex_date.isoformat() if action.ex_date else None,
        'record_date': action.record_date.isoformat() if action.record_date else None,
        'payment_date': action.payment_date.isoformat() if action.payment_date else None,
        'cash_amount_per_share': _to_float(action.cash_amount_per_share),
        'stock_ratio_pct': _to_float(action.stock_ratio_pct),
        'currency': action.currency,
        'source': action.source,
        'source_event_id': action.source_event_id,
        'raw_title': action.raw_title or '',
        'parse_status': action.parse_status,
        'ambiguous_cash_pct': bool(action.ambiguous_cash_pct),
        'ambiguous_ratio_pct': bool(action.ambiguous_ratio_pct),
    }


class CorporateActionsReadView(APIView):
    """GET /api/stock-management/stocks/<symbol>/corporate-actions/ — danh sach su kien quyen. """

    permission_classes = TENANT_PERMISSION_CLASSES

    @extend_schema(
        summary='Lay su kien corporate actions cua ma',
        description=(
            'Endpoint native `/core/v1/stock-management/stocks/{symbol}/corporate-actions/` '
            'tra ve su kien DIV/ISS tu bang CorporateAction (is_latest) trong khoang ex_date, '
            'phuc vu overlay bieu do widget. So la so, ngay ISO.'
        ),
        parameters=[
            OpenApiParameter(
                name='from',
                type=OpenApiTypes.DATE,
                location=OpenApiParameter.QUERY,
                description='Ngay bat dau (YYYY-MM-DD). Mac dinh: to - 365 ngay.',
                required=False,
            ),
            OpenApiParameter(
                name='to',
                type=OpenApiTypes.DATE,
                location=OpenApiParameter.QUERY,
                description='Ngay ket thuc (YYYY-MM-DD). Mac dinh: hom nay.',
                required=False,
            ),
            OpenApiParameter(
                name='limit',
                type=OpenApiTypes.INT,
                location=OpenApiParameter.QUERY,
                description='So event toi da (1-1000). Mac dinh 200.',
                required=False,
            ),
        ],
        responses={
            200: OpenApiTypes.OBJECT,
            400: OpenApiTypes.OBJECT,
            401: OpenApiTypes.OBJECT,
            403: OpenApiTypes.OBJECT,
            404: OpenApiTypes.OBJECT,
        },
    )
    def get(self, request, symbol):
        require_pat_scopes_or_human_session(request, 'market:read')
        symbol = str(symbol or '').strip().upper()
        today = timezone.localdate()
        from_date = _parse_date(request.query_params.get('from')) or (today - timedelta(days=_DEFAULT_WINDOW_DAYS))
        to_date = _parse_date(request.query_params.get('to')) or today
        if from_date > to_date:
            raise ValidationErrorException(detail='from_after_to', code='validation_error')
        try:
            limit = int(request.query_params.get('limit', _DEFAULT_LIMIT))
        except (TypeError, ValueError):
            limit = _DEFAULT_LIMIT
        limit = max(1, min(_MAX_LIMIT, limit))

        has_profile = StockProfile.objects.filter(symbol=symbol).exists()
        rows = list(
            CorporateAction.objects.filter(
                symbol=symbol,
                is_latest=True,
                ex_date__gte=from_date,
                ex_date__lte=to_date,
            ).order_by('ex_date', 'id')[:limit]
        )
        if not has_profile and not rows:
            raise NotFound(f'Stock not found: {symbol}')
        return envelope({
            'symbol': symbol,
            'from': from_date.isoformat(),
            'to': to_date.isoformat(),
            'count': len(rows),
            'actions': [_serialize_action(row) for row in rows],
            'note': 'corporate_actions_loaded',
        })
