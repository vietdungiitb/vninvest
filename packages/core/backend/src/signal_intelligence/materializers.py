"""Celery materializer tasks for signal_intelligence."""
import logging
from decimal import Decimal

from celery import shared_task
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
    Native engine: sync UnifiedAlert từ WhaleAlertCanonical và DARK_FLOW OrderFlowEvent.
    """
    from signal_intelligence.models import OrderFlowEvent, UnifiedAlert, WhaleAlertCanonical

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

        dark_synced = 0
        dark_events = OrderFlowEvent.objects.filter(
            signal_type=OrderFlowEvent.SignalTypeChoices.DARK_FLOW,
        ).order_by('-triggered_at', '-pk')[:500]

        for event in dark_events:
            source_ref = event.source_ref or f'order_flow:{event.event_id}:dark_flow'
            direction = event.side or UnifiedAlert.DirectionChoices.NEUTRAL
            matched_value = None
            if event.price_at_signal is not None and event.volume_at_signal:
                matched_value = int(Decimal(event.price_at_signal) * Decimal(event.volume_at_signal))
            elif isinstance(event.metadata, dict) and event.metadata.get('matched_value') is not None:
                try:
                    matched_value = int(event.metadata['matched_value'])
                except (TypeError, ValueError):
                    matched_value = None

            title = (
                f'Dark flow {event.symbol}: {matched_value:,}đ'
                if matched_value is not None
                else f'Dark flow {event.symbol}'
            )
            severity = (
                UnifiedAlert.SeverityChoices.HIGH
                if matched_value is not None and matched_value >= 2_000_000_000
                else UnifiedAlert.SeverityChoices.MEDIUM
            )
            metadata = {
                **(event.metadata or {}),
                'source': 'native_order_flow_events',
                'signal_type': event.signal_type,
                'event_id': str(event.event_id),
                'whale_intensity': event.whale_intensity,
            }

            if event.unified_alert_id:
                alert = event.unified_alert
                alert_created = False
            else:
                alert, alert_created = UnifiedAlert.objects.get_or_create(
                    source_ref=source_ref,
                    defaults={
                        'symbol': event.symbol,
                        'alert_type': UnifiedAlert.AlertTypeChoices.DARK_FLOW,
                        'severity': severity,
                        'title': title,
                        'body': '',
                        'value': Decimal(str(matched_value)) if matched_value is not None else None,
                        'direction': direction,
                        'session_date': event.session_date,
                        'triggered_at': event.triggered_at,
                        'source_ref': source_ref,
                        'metadata': metadata,
                    },
                )

            dirty_fields: list[str] = []
            if alert.symbol != event.symbol:
                alert.symbol = event.symbol
                dirty_fields.append('symbol')
            if alert.alert_type != UnifiedAlert.AlertTypeChoices.DARK_FLOW:
                alert.alert_type = UnifiedAlert.AlertTypeChoices.DARK_FLOW
                dirty_fields.append('alert_type')
            if alert.severity != severity:
                alert.severity = severity
                dirty_fields.append('severity')
            if alert.title != title:
                alert.title = title
                dirty_fields.append('title')
            if alert.body != '':
                alert.body = ''
                dirty_fields.append('body')
            next_value = Decimal(str(matched_value)) if matched_value is not None else None
            if alert.value != next_value:
                alert.value = next_value
                dirty_fields.append('value')
            if alert.direction != direction:
                alert.direction = direction
                dirty_fields.append('direction')
            if alert.session_date != event.session_date:
                alert.session_date = event.session_date
                dirty_fields.append('session_date')
            if alert.triggered_at != event.triggered_at:
                alert.triggered_at = event.triggered_at
                dirty_fields.append('triggered_at')
            if alert.source_ref != source_ref:
                alert.source_ref = source_ref
                dirty_fields.append('source_ref')
            if alert.metadata != metadata:
                alert.metadata = metadata
                dirty_fields.append('metadata')
            if dirty_fields and not alert_created:
                alert.save(update_fields=dirty_fields)

            if event.unified_alert_id != alert.pk or event.source_ref != source_ref:
                event.unified_alert = alert
                event.source_ref = source_ref
                event.save(update_fields=['unified_alert', 'source_ref'])

            if alert_created or dirty_fields:
                dark_synced += 1

        logger.info(
            "materialize_unified_alerts (native): synced %d whale alerts and %d dark-flow alerts.",
            synced,
            dark_synced,
        )
        return {
            'status': 'ok',
            'synced': synced,
            'dark_synced': dark_synced,
            'source': 'native_core',
        }

    except Exception as exc:
        logger.error("materialize_unified_alerts (native): %s", exc)
        raise self.retry(exc=exc)


@shared_task(bind=True, max_retries=2, default_retry_delay=30)
def materialize_whale_feed_aggregate(self, symbol: str | None = None):
    """
    Native whale materializer.

    Chỉ aggregate từ native OrderFlowEvent facts. Nếu chưa có facts phù hợp,
    trả về empty/degraded state có chủ đích thay vì fabricate data hoặc đọc legacy.
    """
    return _native_whale_detect(symbol)


def _native_whale_detect(symbol: str | None = None):
    """
    Materialize WhaleAlertCanonical + UnifiedAlert từ native OrderFlowEvent facts.
    """
    from signal_intelligence.models import OrderFlowEvent, UnifiedAlert, WhaleAlertCanonical

    qs = OrderFlowEvent.objects.filter(
        signal_type__in=[
            OrderFlowEvent.SignalTypeChoices.WHALE_BUY,
            OrderFlowEvent.SignalTypeChoices.WHALE_SELL,
        ],
        side__in=[
            OrderFlowEvent.SideChoices.BUY,
            OrderFlowEvent.SideChoices.SELL,
        ],
    ).order_by('-triggered_at', '-pk')
    if symbol:
        qs = qs.filter(symbol=symbol.upper())
    else:
        qs = qs[:_MAX_ALERTS_PER_RUN]

    created = 0
    skipped = 0
    for event in qs:
        price = event.price_at_signal
        volume = event.volume_at_signal
        if price is None or volume is None or volume <= 0:
            skipped += 1
            continue

        matched_value = int(Decimal(price) * Decimal(volume))
        if matched_value < _WHALE_VALUE_MIN_VND:
            skipped += 1
            continue

        matched_value = min(_WHALE_VALUE_MAX_VND, matched_value)
        session_date = event.session_date or event.triggered_at.date()
        triggered_at = event.triggered_at or now()
        side = 'buy' if event.side == OrderFlowEvent.SideChoices.BUY else 'sell'
        source_ref = event.source_ref or f'order_flow:{event.event_id}'

        label = 'Cá mập mua' if side == 'buy' else 'Cá mập bán'
        severity = 'high' if matched_value >= 2_000_000_000 else 'medium'

        if event.unified_alert_id:
            alert = event.unified_alert
            alert_created = False
        else:
            alert, alert_created = UnifiedAlert.objects.get_or_create(
                source_ref=source_ref,
                defaults={
                    'symbol': event.symbol,
                    'alert_type': UnifiedAlert.AlertTypeChoices.WHALE,
                    'severity': severity,
                    'direction': side,
                    'session_date': session_date,
                    'triggered_at': triggered_at,
                    'title': f'{label} {event.symbol}: {matched_value:,}đ',
                    'body': '',
                    'value': Decimal(str(matched_value)),
                    'metadata': {
                        'source': 'native_order_flow_events',
                        'signal_type': event.signal_type,
                        'event_id': str(event.event_id),
                        'whale_intensity': event.whale_intensity,
                    },
                },
            )

        alert_dirty_fields: list[str] = []
        alert_metadata = {
            **(alert.metadata or {}),
            'source': 'native_order_flow_events',
            'signal_type': event.signal_type,
            'event_id': str(event.event_id),
            'whale_intensity': event.whale_intensity,
        }
        if alert.symbol != event.symbol:
            alert.symbol = event.symbol
            alert_dirty_fields.append('symbol')
        if alert.alert_type != UnifiedAlert.AlertTypeChoices.WHALE:
            alert.alert_type = UnifiedAlert.AlertTypeChoices.WHALE
            alert_dirty_fields.append('alert_type')
        if alert.severity != severity:
            alert.severity = severity
            alert_dirty_fields.append('severity')
        if alert.direction != side:
            alert.direction = side
            alert_dirty_fields.append('direction')
        if alert.session_date != session_date:
            alert.session_date = session_date
            alert_dirty_fields.append('session_date')
        if alert.triggered_at != triggered_at:
            alert.triggered_at = triggered_at
            alert_dirty_fields.append('triggered_at')
        expected_title = f'{label} {event.symbol}: {matched_value:,}đ'
        if alert.title != expected_title:
            alert.title = expected_title
            alert_dirty_fields.append('title')
        if alert.body != '':
            alert.body = ''
            alert_dirty_fields.append('body')
        if alert.value != Decimal(str(matched_value)):
            alert.value = Decimal(str(matched_value))
            alert_dirty_fields.append('value')
        if alert.source_ref != source_ref:
            alert.source_ref = source_ref
            alert_dirty_fields.append('source_ref')
        if alert.metadata != alert_metadata:
            alert.metadata = alert_metadata
            alert_dirty_fields.append('metadata')
        if alert_dirty_fields and not alert_created:
            alert.save(update_fields=alert_dirty_fields)

        if event.unified_alert_id != alert.pk or event.source_ref != source_ref:
            event.unified_alert = alert
            event.source_ref = source_ref
            event.save(update_fields=['unified_alert', 'source_ref'])

        whale_defaults = {
            'symbol': event.symbol,
            'session_date': session_date,
            'side': side,
            'price': price,
            'volume': volume,
            'matched_value': matched_value,
            'is_dark_flow': False,
            'executed_at': triggered_at,
        }
        whale_alert, whale_created = WhaleAlertCanonical.objects.get_or_create(
            alert=alert,
            defaults=whale_defaults,
        )
        if not whale_created:
            whale_dirty_fields: list[str] = []
            for field_name, field_value in whale_defaults.items():
                if getattr(whale_alert, field_name) != field_value:
                    setattr(whale_alert, field_name, field_value)
                    whale_dirty_fields.append(field_name)
            if whale_dirty_fields:
                whale_alert.save(update_fields=whale_dirty_fields)

        if whale_created:
            created += 1

    logger.info(
        "materialize_whale_feed_aggregate (native): created %d alerts, skipped %d (symbol=%s).",
        created, skipped, symbol or 'all',
    )
    return {
        'status': 'ok',
        'created': created,
        'skipped': skipped,
        'source': 'native_order_flow_events',
    }


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
