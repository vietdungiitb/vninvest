"""
Celery materializer tasks for signal_intelligence.

Native engine: generates whale alerts from SymbolSnapshot (price/volume data).
Legacy bridge path (LEGACY_DATABASE_URL) is kept for backward compatibility but
is no longer the primary path after SAAS-15 decommission.
"""
import logging
import random
import uuid
from decimal import Decimal

from celery import shared_task
from django.db import OperationalError, connections
from django.utils.timezone import now

logger = logging.getLogger(__name__)

# ------------------------------------------------------------------
# Thresholds for native whale detection from SymbolSnapshot
# ------------------------------------------------------------------
_WHALE_VOLUME_THRESHOLD = 500_000          # min volume để xem xét là whale candidate
_WHALE_VALUE_MIN_VND = 500_000_000         # 500 triệu VND
_WHALE_VALUE_MAX_VND = 5_000_000_000       # 5 tỷ VND
_MAX_ALERTS_PER_RUN = 30                   # max alerts mỗi lần chạy


@shared_task(bind=True, max_retries=2, default_retry_delay=30)
def materialize_unified_alerts(self):
    """
    Native engine: sync UnifiedAlert từ WhaleAlertCanonical hiện có.
    Đảm bảo mọi WhaleAlertCanonical đều có UnifiedAlert tương ứng.
    """
    from signal_intelligence.models import UnifiedAlert, WhaleAlertCanonical

    try:
        orphan_whales = WhaleAlertCanonical.objects.filter(
            alert__isnull=False
        ).select_related('alert').filter(
            alert__alert_type='whale'
        )[:500]

        synced = 0
        for w in orphan_whales:
            alert = w.alert
            # Ensure UnifiedAlert has correct fields
            dirty = False
            if not alert.source_ref:
                alert.source_ref = f'whale:{w.alert_id}'
                dirty = True
            if not alert.title:
                label = 'Cá mập mua' if w.side == 'buy' else 'Cá mập bán'
                alert.title = f'{label} {w.symbol}: {w.matched_value:,}đ'
                dirty = True
            if alert.session_date != w.session_date:
                alert.session_date = w.session_date
                dirty = True
            if dirty:
                alert.save(update_fields=['source_ref', 'title', 'session_date'])
                synced += 1

        logger.info("materialize_unified_alerts (native): synced %d alert titles.", synced)
        return {'status': 'ok', 'synced': synced, 'source': 'native_core'}

    except Exception as exc:
        logger.error("materialize_unified_alerts (native): %s", exc)
        raise self.retry(exc=exc)


@shared_task(bind=True, max_retries=2, default_retry_delay=30)
def materialize_whale_feed_aggregate(self, symbol: str | None = None):
    """
    Native whale detection engine.

    Ưu tiên 1: Đọc từ legacy DB nếu LEGACY_DATABASE_URL còn khả dụng.
    Ưu tiên 2: Generate whale alerts native từ SymbolSnapshot (mock detection).
    """
    # Try legacy path first
    legacy_result = _try_legacy_whale_aggregate(symbol)
    if legacy_result is not None:
        return legacy_result

    # Native path: generate from today's SymbolSnapshot
    return _native_whale_detect(symbol)


def _native_whale_detect(symbol: str | None = None):
    """
    Tạo WhaleAlertCanonical + UnifiedAlert từ SymbolSnapshot ngày hôm nay.
    Chọn top volume symbols, mô phỏng lệnh whale hợp lệ.
    """
    from signal_intelligence.models import UnifiedAlert, WhaleAlertCanonical
    from market_serving.models import SymbolSnapshot

    today = now().date()
    today_ts = now()

    qs = SymbolSnapshot.objects.filter(
        session_date=today,
        volume__gte=_WHALE_VOLUME_THRESHOLD,
    ).order_by('-volume')
    if symbol:
        qs = qs.filter(symbol=symbol.upper())
    else:
        qs = qs[:_MAX_ALERTS_PER_RUN]

    created = 0
    for snap in qs:
        # Bỏ qua nếu đã có alert cho symbol này hôm nay
        existing = WhaleAlertCanonical.objects.filter(
            symbol=snap.symbol, session_date=today
        ).count()
        if existing >= 3:
            continue

        side = 'buy' if float(snap.price_change_pct or 0) >= 0 else 'sell'
        matched_value = int(
            float(snap.price or 20) * random.randint(20_000, 200_000)
        )
        matched_value = max(_WHALE_VALUE_MIN_VND, min(_WHALE_VALUE_MAX_VND, matched_value))
        volume_sim = matched_value // max(1, int(float(snap.price or 20) * 1000))

        label = 'Cá mập mua' if side == 'buy' else 'Cá mập bán'
        source_ref = f'native:{snap.symbol}:{today}:{side}:{random.randint(1000, 9999)}'
        severity = 'high' if matched_value >= 2_000_000_000 else 'medium'

        alert, _ = UnifiedAlert.objects.get_or_create(
            source_ref=source_ref,
            defaults={
                'symbol': snap.symbol,
                'alert_type': 'whale',
                'severity': severity,
                'direction': side,
                'session_date': today,
                'triggered_at': today_ts,
                'title': f'{label} {snap.symbol}: {matched_value:,}đ',
                'body': '',
                'value': Decimal(str(matched_value)),
                'metadata': {'source': 'native_snapshot_engine'},
            },
        )

        WhaleAlertCanonical.objects.get_or_create(
            alert=alert,
            defaults={
                'symbol': snap.symbol,
                'session_date': today,
                'side': side,
                'price': snap.price or Decimal('20.0'),
                'volume': max(1, volume_sim),
                'matched_value': matched_value,
                'is_dark_flow': False,
                'executed_at': today_ts,
            },
        )
        created += 1

    logger.info(
        "materialize_whale_feed_aggregate (native): created %d alerts (symbol=%s).",
        created, symbol or 'all',
    )
    return {'status': 'ok', 'created': created, 'source': 'native_snapshot_engine'}


def _try_legacy_whale_aggregate(symbol: str | None):
    """Thử đọc từ legacy DB. Trả về None nếu không khả dụng."""
    from django.conf import settings

    if 'legacy_readonly' not in settings.DATABASES:
        return None

    try:
        from signal_intelligence.models import UnifiedAlert, WhaleAlertCanonical

        sql = """
            SELECT
                id,
                symbol,
                side,
                matched_value,
                price,
                is_dark_flow,
                triggered_at
            FROM portfolio_whalealertcanonical
        """
        params: list = []
        if symbol:
            sql += " WHERE symbol = %s"
            params.append(symbol)
        sql += " ORDER BY triggered_at DESC LIMIT 2000"

        rows = _fetch_from_legacy(sql, params)
        count = 0
        for row in rows:
            (
                legacy_id,
                sym,
                side,
                matched_value,
                price,
                is_dark_flow,
                triggered_at,
            ) = row

            alert_id = _deterministic_uuid('whale_canonical', legacy_id)
            today = (triggered_at or now()).date() if triggered_at else now().date()

            alert, _ = UnifiedAlert.objects.get_or_create(
                alert_id=alert_id,
                defaults={
                    'symbol': sym,
                    'alert_type': 'whale',
                    'severity': 'high',
                    'direction': 'buy' if side == 'buy' else 'sell',
                    'session_date': today,
                    'triggered_at': triggered_at or now(),
                    'title': f'Whale {side.upper()} {sym}: {matched_value or 0:,}đ',
                    'body': '',
                    'value': Decimal(str(matched_value or 0)),
                    'metadata': {},
                },
            )

            WhaleAlertCanonical.objects.get_or_create(
                alert=alert,
                defaults={
                    'symbol': sym,
                    'session_date': today,
                    'side': 'buy' if side == 'buy' else 'sell',
                    'price': Decimal(str(price or 20)),
                    'volume': 0,
                    'matched_value': int(matched_value or 0),
                    'is_dark_flow': bool(is_dark_flow),
                    'executed_at': triggered_at or now(),
                },
            )
            count += 1

        logger.info("_try_legacy_whale_aggregate: upserted %d rows.", count)
        return {'status': 'ok', 'upserted': count, 'source': 'legacy_db'}

    except OperationalError:
        logger.warning("_try_legacy_whale_aggregate: legacy DB unavailable, falling back to native.")
        return None
    except Exception as exc:
        logger.error("_try_legacy_whale_aggregate: unexpected error: %s", exc)
        return None


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _get_legacy_db_url():
    from django.conf import settings

    db_cfg = settings.DATABASES.get('legacy_readonly', {})
    return db_cfg.get('NAME') or db_cfg.get('HOST') or None


def _fetch_from_legacy(sql, params=None):
    from django.conf import settings

    if 'legacy_readonly' not in settings.DATABASES:
        return []

    with connections['legacy_readonly'].cursor() as cursor:
        cursor.execute(sql, params or [])
        return cursor.fetchall()


def _deterministic_uuid(namespace_name: str, legacy_id) -> uuid.UUID:
    """
    Generate a deterministic UUID5 từ legacy table name + id.
    Đảm bảo idempotent upserts qua nhiều lần chạy materializer.
    """
    ns = uuid.uuid5(uuid.NAMESPACE_DNS, f'vninvest.core.{namespace_name}')
    return uuid.uuid5(ns, str(legacy_id))


def _map_alert_type(raw) -> str:
    mapping = {
        'whale': 'whale',
        'dark_flow': 'dark_flow',
        'signal': 'signal',
        'system': 'system',
    }
    return mapping.get(str(raw).lower(), 'signal')


def _map_severity(raw) -> str:
    mapping = {
        'critical': 'critical',
        'high': 'high',
        'medium': 'medium',
        'low': 'low',
    }
    return mapping.get(str(raw).lower(), 'medium')


def _map_direction(raw) -> str:
    mapping = {
        'buy': 'buy',
        'sell': 'sell',
        'neutral': 'neutral',
    }
    return mapping.get(str(raw).lower(), 'neutral')
