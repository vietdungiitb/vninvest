"""Celery task discovery shim for signal_intelligence materializers."""
import logging
from decimal import Decimal

from celery import shared_task
from django.db.models import Count

from .materializers import materialize_unified_alerts, materialize_whale_feed_aggregate

logger = logging.getLogger(__name__)

# ------------------------------------------------------------------
# Thresholds — SSOT ở order_flow_engine, alias ở đây để tương thích
# ------------------------------------------------------------------
from .order_flow_engine import (  # noqa: E402
    WHALE_VALUE_MIN_VND        as _TICK_WHALE_VALUE_MIN_VND,
    DARK_FLOW_VALUE_MIN_VND    as _TICK_DARK_FLOW_VALUE_MIN_VND,
    DARK_FLOW_BUY_RATIO_MIN    as _TICK_DARK_FLOW_BUY_RATIO_MIN,
    DARK_FLOW_PRICE_CV_MAX     as _TICK_DARK_FLOW_PRICE_CV_MAX,
)

_TICK_MAX_SYMBOLS_PER_RUN = 500  # tối đa bao nhiêu symbol/lần chạy

__all__ = [
    'materialize_unified_alerts',
    'materialize_whale_feed_aggregate',
    'run_signal_detection_job',
    'detect_and_store_global_whale_alerts',
    'detect_order_flow',
]


def _get_latest_session_date():
    """Trả về session_date có dữ liệu IntradayTick gần nhất."""
    from market_data.models import IntradayTick
    latest = (
        IntradayTick.objects
        .order_by('-timestamp')
        .values_list('timestamp', flat=True)
        .first()
    )
    if latest is None:
        return None
    return latest.date()


@shared_task(bind=True, max_retries=2, default_retry_delay=60)
def detect_and_store_global_whale_alerts(self, symbol: str | None = None):
    """
    Phát hiện whale buy/sell và dark flow từ IntradayTick.

    Sử dụng Pandas engine (order_flow_engine) để:
    1. Load per-tick data cho mỗi symbol.
    2. Detect whale ticks riêng lẻ → bulk ghi WhaleAlertCanonical + UnifiedAlert.
       (Đây là input cho session_facts_engine để tính CVD/buy_strength đúng.)
    3. Detect dark flow theo cửa sổ 5 phút.
    4. Ghi aggregate OrderFlowEvent cho whale_buy / whale_sell / dark_flow.

    Idempotent: source_ref unique constraint trên UnifiedAlert đảm bảo không trùng.
    """
    from django.utils.timezone import now
    from market_data.models import IntradayTick
    from signal_intelligence.models import OrderFlowEvent
    from signal_intelligence.order_flow_engine import (
        load_session_ticks_df,
        detect_whale_ticks,
        detect_dark_flow_windows,
        compute_cvd_buckets_df,
        invalidate_cvd_cache,
    )

    session_date = _get_latest_session_date()
    if session_date is None:
        logger.warning('detect_and_store_global_whale_alerts: no IntradayTick data, skipping')
        return {'status': 'skipped', 'reason': 'no_tick_data'}

    # Lấy danh sách symbol cần xử lý
    qs = IntradayTick.objects.filter(timestamp__date=session_date)
    if symbol:
        symbols = [symbol.upper()]
    else:
        symbols = list(
            qs.values('symbol')
            .annotate(cnt=Count('id'))
            .order_by('-cnt')
            .values_list('symbol', flat=True)[:_TICK_MAX_SYMBOLS_PER_RUN]
        )

    total_whale_ticks        = 0
    total_order_flow_events  = 0

    for sym in symbols:
        try:
            df = load_session_ticks_df(sym, session_date)
            if df.empty:
                continue

            # ── 1. Per-tick whale detection → WhaleAlertCanonical ─────────
            whale_df    = detect_whale_ticks(df, _TICK_WHALE_VALUE_MIN_VND)
            whale_count = _bulk_write_whale_canonical(whale_df, sym, session_date)
            total_whale_ticks += whale_count
            if whale_count > 0:
                # Xoá CVD cache để force recompute với data mới
                invalidate_cvd_cache(sym, session_date)

            # ── 2. Tính CVD aggregate cho OrderFlowEvent.cvd_at_signal ────
            cvd_df      = compute_cvd_buckets_df(df, bucket_minutes=1)
            final_cvd   = float(cvd_df['cumulative_cvd'].iloc[-1]) if not cvd_df.empty else 0.0

            buy_mask        = df['side'] == 'BUY'
            sell_mask       = df['side'] == 'SELL'
            total_buy_value = float(df.loc[buy_mask,  'value'].sum())
            total_sell_value= float(df.loc[sell_mask, 'value'].sum())
            total_count     = len(df)
            buy_count_total = int(buy_mask.sum())
            buy_ratio       = buy_count_total / total_count if total_count > 0 else 0.0
            triggered_at    = now()

            # ── 3. Whale buy aggregate signal ─────────────────────────────
            if total_buy_value >= _TICK_WHALE_VALUE_MIN_VND:
                whale_intensity = min(1.0, total_buy_value / 5_000_000_000)
                buy_avg_price   = float(df.loc[buy_mask,  'price'].mean() or 0)
                buy_vol_total   = int(df.loc[buy_mask,    'volume'].sum())
                _upsert_order_flow_event(
                    source_ref   = f'tick_session:{sym}:{session_date}:buy',
                    symbol       = sym,
                    session_date = session_date,
                    signal_type  = OrderFlowEvent.SignalTypeChoices.WHALE_BUY,
                    side         = OrderFlowEvent.SideChoices.BUY,
                    strength     = whale_intensity,
                    whale_intensity = whale_intensity,
                    cvd          = final_cvd,
                    price        = buy_avg_price,
                    volume       = buy_vol_total,
                    triggered_at = triggered_at,
                    metadata     = {
                        'source':           'pandas_tick_engine',
                        'buy_value':        total_buy_value,
                        'sell_value':       total_sell_value,
                        'whale_tick_count': whale_count,
                        'session_date':     str(session_date),
                    },
                )
                total_order_flow_events += 1

            # ── 4. Whale sell aggregate signal ────────────────────────────
            if total_sell_value >= _TICK_WHALE_VALUE_MIN_VND:
                whale_intensity  = min(1.0, total_sell_value / 5_000_000_000)
                sell_avg_price   = float(df.loc[sell_mask, 'price'].mean() or 0)
                sell_vol_total   = int(df.loc[sell_mask,   'volume'].sum())
                _upsert_order_flow_event(
                    source_ref   = f'tick_session:{sym}:{session_date}:sell',
                    symbol       = sym,
                    session_date = session_date,
                    signal_type  = OrderFlowEvent.SignalTypeChoices.WHALE_SELL,
                    side         = OrderFlowEvent.SideChoices.SELL,
                    strength     = whale_intensity,
                    whale_intensity = whale_intensity,
                    cvd          = final_cvd,
                    price        = sell_avg_price,
                    volume       = sell_vol_total,
                    triggered_at = triggered_at,
                    metadata     = {
                        'source':           'pandas_tick_engine',
                        'buy_value':        total_buy_value,
                        'sell_value':       total_sell_value,
                        'whale_tick_count': whale_count,
                        'session_date':     str(session_date),
                    },
                )
                total_order_flow_events += 1

            # ── 5. Dark flow via window detection ─────────────────────────
            dark_windows = detect_dark_flow_windows(df)
            if dark_windows:
                max_intensity = max(w['intensity'] for w in dark_windows)
                last_price    = float(df['price'].iloc[-1]) if not df.empty else 0.0
                _upsert_order_flow_event(
                    source_ref   = f'tick_session:{sym}:{session_date}:dark_flow',
                    symbol       = sym,
                    session_date = session_date,
                    signal_type  = OrderFlowEvent.SignalTypeChoices.DARK_FLOW,
                    side         = OrderFlowEvent.SideChoices.BUY,
                    strength     = max_intensity,
                    whale_intensity = max_intensity,
                    cvd          = final_cvd,
                    price        = last_price,
                    volume       = int(sum(w['buy_count'] for w in dark_windows)),
                    triggered_at = triggered_at,
                    metadata     = {
                        'source':           'pandas_dark_flow_window',
                        'windows_detected': len(dark_windows),
                        'max_intensity':    max_intensity,
                        'windows':          dark_windows[:5],  # top 5 windows
                        'session_date':     str(session_date),
                    },
                )
                total_order_flow_events += 1

        except Exception as exc:  # noqa: BLE001
            logger.exception('detect_and_store_global_whale_alerts: error for %s: %s', sym, exc)
            continue

    logger.info(
        'detect_and_store_global_whale_alerts: session=%s whale_ticks=%d order_flow_events=%d',
        session_date, total_whale_ticks, total_order_flow_events,
    )
    return {
        'status':                 'ok',
        'session_date':           str(session_date),
        'whale_ticks_written':    total_whale_ticks,
        'order_flow_events':      total_order_flow_events,
    }


def _bulk_write_whale_canonical(whale_df, symbol: str, session_date) -> int:
    """
    Bulk insert per-tick whale events vào UnifiedAlert + WhaleAlertCanonical.

    Idempotent via source_ref unique constraint trên UnifiedAlert.
    Dùng bulk_create + re-fetch pattern để tránh N+1 queries.

    Trả về số lượng WhaleAlertCanonical records được tạo mới.
    """
    from signal_intelligence.models import UnifiedAlert, WhaleAlertCanonical

    if whale_df is None or whale_df.empty:
        return 0

    def _severity(value: float) -> str:
        if value >= 5_000_000_000:
            return UnifiedAlert.SeverityChoices.CRITICAL
        if value >= 2_000_000_000:
            return UnifiedAlert.SeverityChoices.HIGH
        if value >= 1_000_000_000:
            return UnifiedAlert.SeverityChoices.MEDIUM
        return UnifiedAlert.SeverityChoices.LOW

    # Chuẩn bị metadata per tick
    tick_rows = []
    source_refs = []
    for row in whale_df.to_dict(orient='records'):
        executed_at   = row['timestamp']
        if hasattr(executed_at, 'to_pydatetime'):
            executed_at = executed_at.to_pydatetime()
        side_raw      = str(row.get('side') or 'UNKNOWN').upper()
        side          = 'buy' if side_raw == 'BUY' else 'sell'
        matched_value = int(round(float(row.get('value') or 0)))
        price         = float(row.get('price') or 0)
        volume        = int(row.get('volume') or 0)
        source_ref    = f'whale_tick:{symbol}:{executed_at.isoformat()}:{side}:{matched_value}'

        tick_rows.append({
            'source_ref':    source_ref,
            'executed_at':   executed_at,
            'side':          side,
            'matched_value': matched_value,
            'price':         price,
            'volume':        volume,
        })
        source_refs.append(source_ref)

    if not tick_rows:
        return 0

    # Loại bỏ source_ref đã tồn tại
    existing_refs = set(
        UnifiedAlert.objects
        .filter(source_ref__in=source_refs)
        .values_list('source_ref', flat=True)
    )
    new_rows = [r for r in tick_rows if r['source_ref'] not in existing_refs]
    if not new_rows:
        return 0

    # Bulk create UnifiedAlert
    unified_to_create = []
    for row in new_rows:
        val       = row['matched_value']
        side_lbl  = 'Mua' if row['side'] == 'buy' else 'Bán'
        unified_to_create.append(UnifiedAlert(
            alert_type   = UnifiedAlert.AlertTypeChoices.WHALE,
            symbol       = symbol,
            session_date = session_date,
            severity     = _severity(val),
            confidence   = round(min(1.0, val / 5_000_000_000), 4),
            title        = f'Lệnh cá mập {side_lbl} {symbol}: {val // 1_000_000:,}M VND',
            body         = (
                f'Phát hiện lệnh whale {side_lbl.lower()} tại giá {row["price"]:,.0f} — '
                f'khối lượng {row["volume"]:,} — giá trị {val // 1_000_000:,}M VND'
            ),
            value        = Decimal(str(val)),
            direction    = (
                UnifiedAlert.DirectionChoices.BUY
                if row['side'] == 'buy'
                else UnifiedAlert.DirectionChoices.SELL
            ),
            triggered_at = row['executed_at'],
            source_ref   = row['source_ref'],
            metadata     = {'source': 'pandas_tick_engine', 'session_date': str(session_date)},
        ))

    UnifiedAlert.objects.bulk_create(unified_to_create, ignore_conflicts=True)

    # Re-fetch bằng source_ref để có đúng PKs (bulk_create trả về incomplete set khi ignore_conflicts)
    new_source_refs = [r['source_ref'] for r in new_rows]
    unified_map = {
        obj.source_ref: obj
        for obj in UnifiedAlert.objects.filter(source_ref__in=new_source_refs)
    }

    # Kiểm tra WhaleAlertCanonical đã tồn tại
    existing_canonical_pks = set(
        WhaleAlertCanonical.objects
        .filter(alert_id__in=[obj.pk for obj in unified_map.values()])
        .values_list('alert_id', flat=True)
    )

    canonical_to_create = []
    for row in new_rows:
        unified = unified_map.get(row['source_ref'])
        if unified is None or unified.pk in existing_canonical_pks:
            continue
        canonical_to_create.append(WhaleAlertCanonical(
            alert        = unified,
            symbol       = symbol,
            session_date = session_date,
            side         = (
                WhaleAlertCanonical.SideChoices.BUY
                if row['side'] == 'buy'
                else WhaleAlertCanonical.SideChoices.SELL
            ),
            price        = Decimal(str(round(row['price'], 2))),
            volume       = row['volume'],
            matched_value= row['matched_value'],
            is_dark_flow = False,
            executed_at  = row['executed_at'],
        ))

    if canonical_to_create:
        WhaleAlertCanonical.objects.bulk_create(canonical_to_create, ignore_conflicts=True)

    logger.debug(
        '_bulk_write_whale_canonical: %s/%s — %d new canonical records',
        symbol, session_date, len(canonical_to_create),
    )
    return len(canonical_to_create)


@shared_task(bind=True, max_retries=2, default_retry_delay=60)
def detect_order_flow(self, symbol: str | None = None):
    """
    Phát hiện order imbalance, CVD divergence và absorption từ IntradayTick.

    Dùng Pandas engine (order_flow_engine) — không còn dùng ORM aggregate đơn giản.
    cvd_at_signal = CVD cumulative thực tế tại thời điểm signal.
    """
    from django.utils.timezone import now
    from market_data.models import IntradayTick
    from signal_intelligence.models import OrderFlowEvent
    from signal_intelligence.order_flow_engine import (
        load_session_ticks_df,
        compute_cvd_buckets_df,
        get_cvd_series_list,
        detect_absorption,
    )

    session_date = _get_latest_session_date()
    if session_date is None:
        logger.warning('detect_order_flow: no IntradayTick data found, skipping')
        return {'status': 'skipped', 'reason': 'no_tick_data'}

    qs = IntradayTick.objects.filter(timestamp__date=session_date)
    if symbol:
        symbols = [symbol.upper()]
    else:
        symbols = list(
            qs.values('symbol')
            .annotate(cnt=Count('id'))
            .order_by('-cnt')
            .values_list('symbol', flat=True)[:_TICK_MAX_SYMBOLS_PER_RUN]
        )

    created      = 0
    triggered_at = now()

    for sym in symbols:
        try:
            df = load_session_ticks_df(sym, session_date)
            if df.empty or len(df) < 10:
                continue

            cvd_df = compute_cvd_buckets_df(df, bucket_minutes=1)
            if cvd_df.empty:
                continue

            final_cvd        = float(cvd_df['cumulative_cvd'].iloc[-1])
            buy_mask         = df['side'] == 'BUY'
            sell_mask        = df['side'] == 'SELL'
            total_buy_value  = float(df.loc[buy_mask,  'value'].sum())
            total_sell_value = float(df.loc[sell_mask, 'value'].sum())
            total_value      = total_buy_value + total_sell_value
            total_count      = len(df)
            buy_count        = int(buy_mask.sum())
            buy_ratio        = buy_count / total_count if total_count > 0 else 0.0

            # ── Order Imbalance (buy_ratio extreme) ───────────────────────
            imbalance_ratio = abs(buy_ratio - 0.5) * 2  # 0..1 scale
            if imbalance_ratio >= 0.6 and total_value >= _TICK_DARK_FLOW_VALUE_MIN_VND:
                dominant_buy     = buy_ratio > 0.5
                side             = OrderFlowEvent.SideChoices.BUY if dominant_buy else OrderFlowEvent.SideChoices.SELL
                imb_avg_price    = float(df.loc[buy_mask if dominant_buy else sell_mask, 'price'].mean() or 0)
                imb_vol          = int(df.loc[buy_mask if dominant_buy else sell_mask, 'volume'].sum())
                _upsert_order_flow_event(
                    source_ref   = f'tick_imbalance:{sym}:{session_date}',
                    symbol       = sym,
                    session_date = session_date,
                    signal_type  = OrderFlowEvent.SignalTypeChoices.ORDER_IMBALANCE,
                    side         = side,
                    strength     = imbalance_ratio,
                    whale_intensity = imbalance_ratio * 0.7,
                    cvd          = final_cvd,
                    price        = imb_avg_price,
                    volume       = imb_vol,
                    triggered_at = triggered_at,
                    metadata     = {
                        'source':          'pandas_tick_engine',
                        'imbalance_ratio': round(imbalance_ratio, 4),
                        'buy_ratio':       round(buy_ratio,       4),
                        'buy_value':       total_buy_value,
                        'sell_value':      total_sell_value,
                        'session_date':    str(session_date),
                    },
                )
                created += 1

            # ── CVD Divergence via absorption detection ───────────────────
            cvd_series_5m = get_cvd_series_list(sym, session_date, bucket_minutes=5)
            if cvd_series_5m:
                import pandas as _pd
                price_by_5m = (
                    df.groupby(df['timestamp'].dt.floor('5min'))['price']
                    .last()
                    .astype(float)
                    .tolist()
                )
                absorption = detect_absorption(cvd_series_5m, price_by_5m)
                if absorption.get('detected') and float(absorption.get('strength', 0)) >= 50:
                    last_price = float(df['price'].iloc[-1]) if not df.empty else 0.0
                    _upsert_order_flow_event(
                        source_ref   = f'tick_cvd_divergence:{sym}:{session_date}',
                        symbol       = sym,
                        session_date = session_date,
                        signal_type  = OrderFlowEvent.SignalTypeChoices.CVD_DIVERGENCE,
                        side         = OrderFlowEvent.SideChoices.NEUTRAL,
                        strength     = float(absorption['strength']) / 100,
                        whale_intensity = float(absorption['strength']) / 100,
                        cvd          = final_cvd,
                        price        = last_price,
                        volume       = int(df['volume'].sum()),
                        triggered_at = triggered_at,
                        metadata     = {
                            'source':     'pandas_absorption_engine',
                            'absorption': absorption,
                            'session_date': str(session_date),
                        },
                    )
                    created += 1

        except Exception as exc:  # noqa: BLE001
            logger.exception('detect_order_flow: error for %s: %s', sym, exc)
            continue

    logger.info('detect_order_flow: session=%s events_written=%d', session_date, created)
    return {'status': 'ok', 'session_date': str(session_date), 'events_written': created}


def _upsert_order_flow_event(
    *,
    source_ref: str,
    symbol: str,
    session_date,
    signal_type: str,
    side: str,
    strength: float,
    whale_intensity: float,
    cvd: float,
    price: float,
    volume: int,
    triggered_at,
    metadata: dict,
) -> bool:
    """Idempotent upsert cho OrderFlowEvent theo source_ref. Trả về True nếu tạo mới."""
    from decimal import Decimal
    from signal_intelligence.models import OrderFlowEvent

    existing = OrderFlowEvent.objects.filter(source_ref=source_ref).first()
    if existing is None:
        OrderFlowEvent.objects.create(
            symbol=symbol,
            session_date=session_date,
            signal_type=signal_type,
            side=side,
            strength=strength,
            whale_intensity=whale_intensity,
            cvd_at_signal=cvd,
            price_at_signal=Decimal(str(round(price, 2))),
            volume_at_signal=volume,
            source_ref=source_ref,
            metadata=metadata,
            triggered_at=triggered_at,
        )
        return True
    dirty = {}
    if existing.strength != strength:
        dirty['strength'] = strength
    if existing.whale_intensity != whale_intensity:
        dirty['whale_intensity'] = whale_intensity
    if existing.cvd_at_signal != cvd:
        dirty['cvd_at_signal'] = cvd
    new_price = Decimal(str(round(price, 2)))
    if existing.price_at_signal != new_price:
        dirty['price_at_signal'] = new_price
    if existing.volume_at_signal != volume:
        dirty['volume_at_signal'] = volume
    if existing.metadata != metadata:
        dirty['metadata'] = metadata
    if dirty:
        OrderFlowEvent.objects.filter(pk=existing.pk).update(**dirty)
    return False


@shared_task(bind=True)
def run_signal_detection_job(self, domain: str = 'all', symbol: str = None):
    """
    Native: Kích hoạt signal detection job.
    Hiện tại chủ yếu trigger materializers.
    """
    if domain in {'all', 'whale'}:
        materialize_whale_feed_aggregate.delay(symbol=symbol)
    if domain in {'all', 'dark_flow'}:
        materialize_unified_alerts.delay()

    return {'status': 'accepted', 'domain': domain, 'symbol': symbol}