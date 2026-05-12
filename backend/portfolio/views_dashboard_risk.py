import logging
import os
import sys
from datetime import timedelta

from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

# Setup path for packages/core imports
_core_backend_src = os.path.normpath(
    os.path.join(os.path.dirname(__file__), '../../packages/core/backend/src')
)
if os.path.exists(_core_backend_src) and _core_backend_src not in sys.path:
    sys.path.insert(0, _core_backend_src)

# Core models (AUTHORITY)
try:
    from user_workspace.models import Portfolio
except (ImportError, RuntimeError):
    class Portfolio:
        pass

# Legacy models (remaining)
from .analytics import compute_holdings
from .market_data_service import MarketDataService, market_data_service
from .models import OrderFlowSignal, WhaleAlertEvent

logger = logging.getLogger(__name__)

RISK_LOOKBACK_DAYS = 14
MAX_TOP_SYMBOLS = 5


def _coerce_float(value):
    try:
        if value is None:
            return None
        result = float(value)
    except (TypeError, ValueError):
        return None
    if result != result:
        return None
    return round(result, 2)


def _coerce_int(value):
    try:
        if value is None:
            return None
        result = int(value)
    except (TypeError, ValueError):
        return None
    return result


def _coerce_iso_datetime(value):
    if value is None:
        return None
    if hasattr(value, 'isoformat'):
        try:
            return value.isoformat()
        except Exception:
            pass
    return str(value)


def _resolve_dashboard_portfolio(request):
    raw_portfolio_id = str(request.query_params.get('portfolio_id') or '').strip()
    if raw_portfolio_id:
        try:
            portfolio_id = int(raw_portfolio_id)
        except (TypeError, ValueError):
            return None, Response(
                {'detail': 'portfolio_id phải là số nguyên.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        portfolio = Portfolio.objects.filter(pk=portfolio_id, user=request.user).first()
        if portfolio is None:
            return None, Response(
                {'detail': 'Danh mục không tồn tại hoặc không thuộc tài khoản.'},
                status=status.HTTP_404_NOT_FOUND,
            )
        return portfolio, {'selection_source': 'query_param'}

    portfolio = request.user.portfolios.order_by('-updated_at', '-created_at', '-id').first()
    if portfolio is None:
        return None, Response(
            {'detail': 'Bạn chưa có danh mục nào để tổng hợp rủi ro.'},
            status=status.HTTP_404_NOT_FOUND,
        )
    return portfolio, {'selection_source': 'latest_user_portfolio'}


def _build_stale_positions(holdings_rows: list[dict], realtime_map: dict) -> tuple[list[dict], int, float]:
    stale_rows: list[dict] = []

    for row in holdings_rows:
        symbol = str(row.get('symbol') or '').strip().upper()
        if not symbol:
            continue

        ticker = realtime_map.get(symbol) if isinstance(realtime_map, dict) else None
        ticker = ticker if isinstance(ticker, dict) else {}
        ticker_missing = not bool(ticker)

        current_price = row.get('current_price')
        freshness_seconds = ticker.get('freshness_seconds')
        ticker_stale = bool(ticker.get('stale')) if not ticker_missing else True
        missing_price = current_price is None or current_price != current_price
        if not ticker_stale and not missing_price and not ticker_missing:
            continue

        stale_rows.append(
            {
                'symbol': symbol,
                'current_price': _coerce_float(current_price),
                'market_value': _coerce_float(row.get('market_value')),
                'quantity': _coerce_float(row.get('quantity')),
                'freshness_seconds': _coerce_int(freshness_seconds),
                'stale': True,
                'source': ticker.get('source') or ('realtime_missing' if ticker_missing else 'dashboard_aggregated_risk'),
                'market_phase': ticker.get('market_phase'),
                'market_code': ticker.get('market_code'),
            }
        )

    stale_rows.sort(
        key=lambda item: (
            item.get('market_value') is None,
            item.get('market_value') or 0,
        ),
        reverse=True,
    )
    stale_count = len(stale_rows)
    stale_pct = round((stale_count / len(holdings_rows)) * 100, 2) if holdings_rows else 0.0
    return stale_rows[:MAX_TOP_SYMBOLS], stale_count, stale_pct


def _build_whale_exposure(symbols: list[str]) -> tuple[list[dict], int, int]:
    if not symbols:
        return [], 0, 0

    cutoff = timezone.now() - timedelta(days=RISK_LOOKBACK_DAYS)
    latest_rows: dict[str, dict] = {}

    recent_events = (
        WhaleAlertEvent.objects
        .filter(symbol__in=symbols, occurred_at__gte=cutoff)
        .order_by('-occurred_at', '-id')
        .values(
            'symbol',
            'side',
            'matched_value_vnd',
            'threshold_vnd',
            'severity',
            'event_score',
            'confidence',
            'source',
            'source_layer',
            'occurred_at',
        )
    )

    for row in recent_events:
        symbol = str(row.get('symbol') or '').strip().upper()
        if not symbol or symbol in latest_rows:
            continue
        latest_rows[symbol] = {
            'symbol': symbol,
            'side': row.get('side'),
            'matched_value_vnd': _coerce_int(row.get('matched_value_vnd')),
            'threshold_vnd': _coerce_int(row.get('threshold_vnd')),
            'severity': row.get('severity'),
            'event_score': _coerce_float(row.get('event_score')),
            'confidence': row.get('confidence'),
            'source': row.get('source'),
            'source_layer': row.get('source_layer'),
            'occurred_at': _coerce_iso_datetime(row.get('occurred_at')),
        }

    whale_rows = sorted(
        latest_rows.values(),
        key=lambda item: item.get('matched_value_vnd') or 0,
        reverse=True,
    )
    whale_total_value = sum(int(row.get('matched_value_vnd') or 0) for row in whale_rows)
    return whale_rows[:MAX_TOP_SYMBOLS], len(whale_rows), whale_total_value


def _build_dark_flow(symbols: list[str]) -> tuple[list[dict], int, float | None]:
    if not symbols:
        return [], 0, None

    cutoff = timezone.now() - timedelta(days=RISK_LOOKBACK_DAYS)
    latest_rows: dict[str, dict] = {}

    recent_signals = (
        OrderFlowSignal.objects
        .filter(symbol__in=symbols, created_at__gte=cutoff, strength__gt=0)
        .order_by('-created_at', '-id')
        .values(
            'symbol',
            'signal_type',
            'strength',
            'confidence',
            'tick_rate',
            'small_order_ratio',
            'cvd_at_signal',
            'price_at_signal',
            'window_seconds',
            'whale_intensity',
            'severity',
            'created_at',
        )
    )

    for row in recent_signals:
        symbol = str(row.get('symbol') or '').strip().upper()
        if not symbol or symbol in latest_rows:
            continue
        latest_rows[symbol] = {
            'symbol': symbol,
            'signal_type': row.get('signal_type'),
            'strength': _coerce_float(row.get('strength')),
            'confidence': row.get('confidence'),
            'tick_rate': _coerce_float(row.get('tick_rate')),
            'small_order_ratio': _coerce_float(row.get('small_order_ratio')),
            'cvd_at_signal': _coerce_float(row.get('cvd_at_signal')),
            'price_at_signal': _coerce_float(row.get('price_at_signal')),
            'window_seconds': _coerce_int(row.get('window_seconds')),
            'whale_intensity': _coerce_float(row.get('whale_intensity')),
            'severity': row.get('severity'),
            'created_at': _coerce_iso_datetime(row.get('created_at')),
        }

    dark_flow_rows = sorted(
        latest_rows.values(),
        key=lambda item: item.get('strength') or 0,
        reverse=True,
    )
    strengths = [row['strength'] for row in dark_flow_rows if row.get('strength') is not None]
    avg_strength = round(sum(strengths) / len(strengths), 2) if strengths else None
    return dark_flow_rows[:MAX_TOP_SYMBOLS], len(dark_flow_rows), avg_strength


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def dashboard_aggregated_risk_api(request):
    """
    GET /api/dashboard/aggregated-risk/
    Aggregated dashboard risk snapshot for the selected portfolio.
    """

    portfolio, resolution = _resolve_dashboard_portfolio(request)
    if isinstance(resolution, Response):
        return resolution

    try:
        df_holdings = compute_holdings(portfolio)
    except Exception:
        logger.exception('dashboard_aggregated_risk_api failed to compute holdings for portfolio=%s', portfolio.pk)
        return Response(
            {'detail': 'Không thể tổng hợp rủi ro danh mục tại thời điểm này.'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    if df_holdings.empty or 'symbol' not in df_holdings.columns:
        holding_rows: list[dict] = []
        symbols: list[str] = []
    else:
        holding_rows = df_holdings.to_dict(orient='records')
        symbols = [str(row.get('symbol') or '').strip().upper() for row in holding_rows if str(row.get('symbol') or '').strip()]

    realtime_map = {}
    if symbols:
        try:
            realtime_map = market_data_service.get_realtime_tickers(symbols)
        except Exception:
            logger.exception('dashboard_aggregated_risk_api failed to load realtime tickers for portfolio=%s', portfolio.pk)
            realtime_map = {}

    stale_positions, stale_count, stale_pct = _build_stale_positions(holding_rows, realtime_map)
    whale_exposure_symbols, whale_exposure_symbol_count, whale_exposure_total_vnd = _build_whale_exposure(symbols)
    dark_flow_signals, dark_flow_signal_count, dark_flow_avg_strength = _build_dark_flow(symbols)

    summary_cards = [
        {
            'key': 'stale_positions_pct',
            'label': 'Tỷ lệ vị thế chậm',
            'value': stale_pct,
            'detail': f'{stale_count}/{len(holding_rows)} mã đang chậm dữ liệu realtime',
        },
        {
            'key': 'whale_exposure_symbols',
            'label': 'Mã có whale',
            'value': whale_exposure_symbol_count,
            'detail': f'{whale_exposure_symbol_count} mã có sự kiện whale trong {RISK_LOOKBACK_DAYS} ngày',
        },
        {
            'key': 'dark_flow_avg_strength',
            'label': 'Cường độ dark flow TB',
            'value': dark_flow_avg_strength,
            'detail': f'{dark_flow_signal_count} tín hiệu gần nhất được giữ lại để tính trung bình',
        },
    ]

    return Response(
        {
            'object': 'dashboard_aggregated_risk_snapshot',
            'portfolio': {
                'id': portfolio.id,
                'name': portfolio.name,
                'selection_source': resolution['selection_source'],
                'updated_at': portfolio.updated_at.isoformat() if portfolio.updated_at else None,
            },
            'window_days': RISK_LOOKBACK_DAYS,
            'position_count': len(holding_rows),
            'stale_positions_count': stale_count,
            'stale_positions_pct': stale_pct,
            'whale_exposure_symbol_count': whale_exposure_symbol_count,
            'whale_exposure_total_vnd': whale_exposure_total_vnd,
            'dark_flow_signal_count': dark_flow_signal_count,
            'dark_flow_avg_strength': dark_flow_avg_strength,
            'summary_cards': summary_cards,
            'stale_positions': stale_positions,
            'whale_exposure_symbols': whale_exposure_symbols,
            'dark_flow_signals': dark_flow_signals,
            'generated_at': timezone.now().isoformat(),
        },
        status=status.HTTP_200_OK,
    )
