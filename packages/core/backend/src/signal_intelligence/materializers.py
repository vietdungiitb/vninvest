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
_MARKET_ANOMALY_PCT_THRESHOLD = 7.0


def _build_snapshot_evidence(*, symbol: str, session_date, price_change_pct, stale: bool, source: str) -> dict:
    return {
        'symbol': symbol,
        'session_date': session_date.isoformat() if hasattr(session_date, 'isoformat') else session_date,
        'price_change_pct': float(price_change_pct or 0),
        'stale': bool(stale),
        'source': source,
    }


def _build_alert_evidence(*, source: str, signal_type: str, event_id: str, whale_intensity: float | None, matched_value: int | None) -> dict:
    return {
        'source': source,
        'signal_type': signal_type,
        'event_id': event_id,
        'whale_intensity': whale_intensity,
        'matched_value': matched_value,
    }


def _resolve_confidence_from_matched_value(matched_value: int | None, *, alert_family: str) -> float:
    amount = int(matched_value or 0)
    if alert_family == 'whale':
        if amount >= 5_000_000_000:
            return 0.99
        if amount >= 1_000_000_000:
            return 0.95
        return 0.85
    if amount >= 2_000_000_000:
        return 0.9
    if amount >= 1_000_000_000:
        return 0.85
    return 0.7


def _upsert_market_anomaly_event(
    *,
    symbol: str,
    session_date,
    event_type: str,
    severity: str,
    confidence: float,
    direction: str,
    source_ref: str,
    evidence: dict,
    metadata: dict,
    triggered_at,
    unified_alert,
):
    from signal_intelligence.models import MarketAnomalyEvent

    event, created = MarketAnomalyEvent.objects.get_or_create(
        source_ref=source_ref,
        defaults={
            'symbol': symbol,
            'session_date': session_date,
            'event_type': event_type,
            'severity': severity,
            'confidence': confidence,
            'direction': direction,
            'value': None,
            'source_ref': source_ref,
            'evidence': evidence,
            'metadata': metadata,
            'triggered_at': triggered_at,
            'unified_alert': unified_alert,
        },
    )

    dirty_fields: list[str] = []
    expected_values = {
        'symbol': symbol,
        'session_date': session_date,
        'event_type': event_type,
        'severity': severity,
        'confidence': confidence,
        'direction': direction,
        'source_ref': source_ref,
        'evidence': evidence,
        'metadata': metadata,
        'triggered_at': triggered_at,
        'unified_alert': unified_alert,
    }
    for field_name, expected_value in expected_values.items():
        if getattr(event, field_name) != expected_value:
            setattr(event, field_name, expected_value)
            dirty_fields.append(field_name)

    if event.value is not None:
        event.value = None
        dirty_fields.append('value')

    if dirty_fields and not created:
        event.save(update_fields=dirty_fields)

    return event


def _upsert_advisory_signal_event(
    *,
    symbol: str,
    session_date,
    signal_type: str,
    severity: str,
    confidence: float,
    title: str,
    body: str,
    source_ref: str,
    evidence: dict,
    metadata: dict,
    triggered_at,
    unified_alert,
):
    from signal_intelligence.models import AdvisorySignalEvent

    event, created = AdvisorySignalEvent.objects.get_or_create(
        source_ref=source_ref,
        defaults={
            'symbol': symbol,
            'session_date': session_date,
            'signal_type': signal_type,
            'severity': severity,
            'confidence': confidence,
            'title': title,
            'body': body,
            'value': None,
            'source_ref': source_ref,
            'evidence': evidence,
            'metadata': metadata,
            'triggered_at': triggered_at,
            'unified_alert': unified_alert,
        },
    )

    dirty_fields: list[str] = []
    expected_values = {
        'symbol': symbol,
        'session_date': session_date,
        'signal_type': signal_type,
        'severity': severity,
        'confidence': confidence,
        'title': title,
        'body': body,
        'source_ref': source_ref,
        'evidence': evidence,
        'metadata': metadata,
        'triggered_at': triggered_at,
        'unified_alert': unified_alert,
    }
    for field_name, expected_value in expected_values.items():
        if getattr(event, field_name) != expected_value:
            setattr(event, field_name, expected_value)
            dirty_fields.append(field_name)

    if event.value is not None:
        event.value = None
        dirty_fields.append('value')

    if dirty_fields and not created:
        event.save(update_fields=dirty_fields)

    return event


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
            whale_confidence = _resolve_confidence_from_matched_value(w.matched_value, alert_family='whale')
            if alert.confidence != whale_confidence:
                alert.confidence = whale_confidence
                dirty = True
            if alert.freshness_state != 'fresh':
                alert.freshness_state = 'fresh'
                dirty = True
            whale_evidence = _build_alert_evidence(
                source='native_order_flow_events',
                signal_type='whale_sync',
                event_id=str(w.alert_id),
                whale_intensity=None,
                matched_value=int(w.matched_value),
            )
            if alert.evidence != whale_evidence:
                alert.evidence = whale_evidence
                dirty = True
            if dirty:
                alert.save(update_fields=['source_ref', 'title', 'session_date', 'confidence', 'freshness_state', 'evidence'])
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
                        'confidence': _resolve_confidence_from_matched_value(matched_value, alert_family='dark_flow'),
                        'freshness_state': 'fresh',
                        'title': title,
                        'body': '',
                        'value': Decimal(str(matched_value)) if matched_value is not None else None,
                        'direction': direction,
                        'session_date': event.session_date,
                        'triggered_at': event.triggered_at,
                        'source_ref': source_ref,
                        'metadata': metadata,
                        'evidence': _build_alert_evidence(
                            source='native_order_flow_events',
                            signal_type=event.signal_type,
                            event_id=str(event.event_id),
                            whale_intensity=event.whale_intensity,
                            matched_value=matched_value,
                        ),
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
            confidence = _resolve_confidence_from_matched_value(matched_value, alert_family='dark_flow')
            if alert.confidence != confidence:
                alert.confidence = confidence
                dirty_fields.append('confidence')
            if alert.freshness_state != 'fresh':
                alert.freshness_state = 'fresh'
                dirty_fields.append('freshness_state')
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
            evidence = _build_alert_evidence(
                source='native_order_flow_events',
                signal_type=event.signal_type,
                event_id=str(event.event_id),
                whale_intensity=event.whale_intensity,
                matched_value=matched_value,
            )
            if alert.evidence != evidence:
                alert.evidence = evidence
                dirty_fields.append('evidence')
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
def materialize_stale_quote_alerts(self, symbol: str | None = None):
    from market_serving.models import SymbolSnapshot
    from signal_intelligence.models import UnifiedAlert

    qs = SymbolSnapshot.objects.filter(stale=True).order_by('-fetched_at', '-pk')
    if symbol:
        qs = qs.filter(symbol=symbol.upper())

    created = 0
    for snapshot in qs[:500]:
        source_ref = f'stale_quote:{snapshot.symbol}:{snapshot.session_date.isoformat()}'
        severity = UnifiedAlert.SeverityChoices.HIGH if abs(float(snapshot.price_change_pct or 0)) >= 10 else UnifiedAlert.SeverityChoices.MEDIUM
        confidence = 0.9 if snapshot.stale else 0.7
        evidence = _build_snapshot_evidence(
            symbol=snapshot.symbol,
            session_date=snapshot.session_date,
            price_change_pct=snapshot.price_change_pct,
            stale=snapshot.stale,
            source='market_serving.symbol_snapshot',
        )
        alert, alert_created = UnifiedAlert.objects.get_or_create(
            source_ref=source_ref,
            defaults={
                'symbol': snapshot.symbol,
                'alert_type': UnifiedAlert.AlertTypeChoices.SYSTEM,
                'severity': severity,
                'confidence': confidence,
                'freshness_state': 'stale',
                'title': f'Bảng giá chậm {snapshot.symbol}',
                'body': 'Snapshot thị trường đã bị đánh dấu stale.',
                'value': None,
                'direction': UnifiedAlert.DirectionChoices.NEUTRAL,
                'session_date': snapshot.session_date,
                'triggered_at': snapshot.fetched_at,
                'source_ref': source_ref,
                'metadata': {
                    'source': 'market_serving.symbol_snapshot',
                    'market_status': snapshot.market_status,
                    'price_change_pct': float(snapshot.price_change_pct or 0),
                },
                'evidence': evidence,
            },
        )
        dirty_fields: list[str] = []
        if alert.alert_type != UnifiedAlert.AlertTypeChoices.SYSTEM:
            alert.alert_type = UnifiedAlert.AlertTypeChoices.SYSTEM
            dirty_fields.append('alert_type')
        if alert.severity != severity:
            alert.severity = severity
            dirty_fields.append('severity')
        if alert.confidence != confidence:
            alert.confidence = confidence
            dirty_fields.append('confidence')
        if alert.freshness_state != 'stale':
            alert.freshness_state = 'stale'
            dirty_fields.append('freshness_state')
        if alert.title != f'Bảng giá chậm {snapshot.symbol}':
            alert.title = f'Bảng giá chậm {snapshot.symbol}'
            dirty_fields.append('title')
        if alert.body != 'Snapshot thị trường đã bị đánh dấu stale.':
            alert.body = 'Snapshot thị trường đã bị đánh dấu stale.'
            dirty_fields.append('body')
        if alert.session_date != snapshot.session_date:
            alert.session_date = snapshot.session_date
            dirty_fields.append('session_date')
        if alert.triggered_at != snapshot.fetched_at:
            alert.triggered_at = snapshot.fetched_at
            dirty_fields.append('triggered_at')
        if alert.metadata != {
            'source': 'market_serving.symbol_snapshot',
            'market_status': snapshot.market_status,
            'price_change_pct': float(snapshot.price_change_pct or 0),
        }:
            alert.metadata = {
                'source': 'market_serving.symbol_snapshot',
                'market_status': snapshot.market_status,
                'price_change_pct': float(snapshot.price_change_pct or 0),
            }
            dirty_fields.append('metadata')
        if alert.evidence != evidence:
            alert.evidence = evidence
            dirty_fields.append('evidence')
        if dirty_fields and not alert_created:
            alert.save(update_fields=dirty_fields)

        _upsert_market_anomaly_event(
            symbol=snapshot.symbol,
            session_date=snapshot.session_date,
            event_type='stale_quote',
            severity=severity,
            confidence=confidence,
            direction=UnifiedAlert.DirectionChoices.NEUTRAL,
            source_ref=source_ref,
            evidence=evidence,
            metadata={
                'source': 'market_serving.symbol_snapshot',
                'market_status': snapshot.market_status,
                'price_change_pct': float(snapshot.price_change_pct or 0),
            },
            triggered_at=snapshot.fetched_at,
            unified_alert=alert,
        )

        if alert_created or dirty_fields:
            created += 1

    return {
        'status': 'ok',
        'created': created,
        'source': 'market_serving.symbol_snapshot',
    }


@shared_task(bind=True, max_retries=2, default_retry_delay=30)
def materialize_market_anomaly_alerts(self, symbol: str | None = None):
    from market_serving.models import SymbolSnapshot
    from signal_intelligence.models import UnifiedAlert

    qs = SymbolSnapshot.objects.exclude(price_change_pct__isnull=True).order_by('-fetched_at', '-pk')
    if symbol:
        qs = qs.filter(symbol=symbol.upper())

    created = 0
    for snapshot in qs[:500]:
        pct = float(snapshot.price_change_pct or 0)
        if abs(pct) < _MARKET_ANOMALY_PCT_THRESHOLD:
            continue
        severity = UnifiedAlert.SeverityChoices.HIGH if abs(pct) >= 10 else UnifiedAlert.SeverityChoices.MEDIUM
        confidence = 0.9 if abs(pct) >= 10 else 0.8
        source_ref = f'market_anomaly:{snapshot.symbol}:{snapshot.session_date.isoformat()}'
        evidence = _build_snapshot_evidence(
            symbol=snapshot.symbol,
            session_date=snapshot.session_date,
            price_change_pct=snapshot.price_change_pct,
            stale=snapshot.stale,
            source='market_serving.symbol_snapshot',
        )
        alert, alert_created = UnifiedAlert.objects.get_or_create(
            source_ref=source_ref,
            defaults={
                'symbol': snapshot.symbol,
                'alert_type': UnifiedAlert.AlertTypeChoices.SIGNAL,
                'severity': severity,
                'confidence': confidence,
                'freshness_state': 'fresh' if not snapshot.stale else 'stale',
                'title': f'Biến động bất thường {snapshot.symbol}',
                'body': f'Biến động giá {pct:.2f}%',
                'value': None,
                'direction': UnifiedAlert.DirectionChoices.NEUTRAL,
                'session_date': snapshot.session_date,
                'triggered_at': snapshot.fetched_at,
                'source_ref': source_ref,
                'metadata': {
                    'source': 'market_serving.symbol_snapshot',
                    'market_status': snapshot.market_status,
                    'price_change_pct': pct,
                },
                'evidence': evidence,
            },
        )
        dirty_fields: list[str] = []
        if alert.alert_type != UnifiedAlert.AlertTypeChoices.SIGNAL:
            alert.alert_type = UnifiedAlert.AlertTypeChoices.SIGNAL
            dirty_fields.append('alert_type')
        if alert.severity != severity:
            alert.severity = severity
            dirty_fields.append('severity')
        if alert.confidence != confidence:
            alert.confidence = confidence
            dirty_fields.append('confidence')
        freshness_state = 'fresh' if not snapshot.stale else 'stale'
        if alert.freshness_state != freshness_state:
            alert.freshness_state = freshness_state
            dirty_fields.append('freshness_state')
        if alert.title != f'Biến động bất thường {snapshot.symbol}':
            alert.title = f'Biến động bất thường {snapshot.symbol}'
            dirty_fields.append('title')
        if alert.body != f'Biến động giá {pct:.2f}%':
            alert.body = f'Biến động giá {pct:.2f}%'
            dirty_fields.append('body')
        if alert.session_date != snapshot.session_date:
            alert.session_date = snapshot.session_date
            dirty_fields.append('session_date')
        if alert.triggered_at != snapshot.fetched_at:
            alert.triggered_at = snapshot.fetched_at
            dirty_fields.append('triggered_at')
        if alert.metadata != {
            'source': 'market_serving.symbol_snapshot',
            'market_status': snapshot.market_status,
            'price_change_pct': pct,
        }:
            alert.metadata = {
                'source': 'market_serving.symbol_snapshot',
                'market_status': snapshot.market_status,
                'price_change_pct': pct,
            }
            dirty_fields.append('metadata')
        if alert.evidence != evidence:
            alert.evidence = evidence
            dirty_fields.append('evidence')
        if dirty_fields and not alert_created:
            alert.save(update_fields=dirty_fields)

        _upsert_market_anomaly_event(
            symbol=snapshot.symbol,
            session_date=snapshot.session_date,
            event_type='price_shock',
            severity=severity,
            confidence=confidence,
            direction=UnifiedAlert.DirectionChoices.NEUTRAL,
            source_ref=source_ref,
            evidence=evidence,
            metadata={
                'source': 'market_serving.symbol_snapshot',
                'market_status': snapshot.market_status,
                'price_change_pct': pct,
            },
            triggered_at=snapshot.fetched_at,
            unified_alert=alert,
        )

        if alert_created or dirty_fields:
            created += 1

    return {
        'status': 'ok',
        'created': created,
        'source': 'market_serving.symbol_snapshot',
    }


@shared_task(bind=True, max_retries=2, default_retry_delay=30)
def materialize_ai_signal_alerts(self, symbol: str | None = None):
    from signal_intelligence.models import AdvisorySignalEvent, OrderFlowEvent, UnifiedAlert

    qs = OrderFlowEvent.objects.filter(
        signal_type=OrderFlowEvent.SignalTypeChoices.OTHER,
    ).order_by('-triggered_at', '-pk')
    if symbol:
        qs = qs.filter(symbol=symbol.upper())

    created = 0
    for event in qs[:500]:
        metadata = event.metadata if isinstance(event.metadata, dict) else {}
        if not metadata.get('ai_signal'):
            continue
        source_ref = event.source_ref or f'ai_signal:{event.event_id}'
        confidence = float(metadata.get('confidence') or event.strength or 0.7)
        severity = UnifiedAlert.SeverityChoices.HIGH if confidence >= 0.85 else UnifiedAlert.SeverityChoices.MEDIUM
        evidence = {
            'source': 'signal_intelligence.ai_signal_events',
            'event_id': str(event.event_id),
            'ai_signal': metadata.get('ai_signal'),
            'confidence': confidence,
        }
        resolved_signal_type = (
            AdvisorySignalEvent.SignalTypeChoices.AI_SUGGEST
            if str(metadata.get('ai_signal') or '').lower().startswith('suggest')
            else AdvisorySignalEvent.SignalTypeChoices.AI_ALERT
        )
        alert_type = (
            UnifiedAlert.AlertTypeChoices.AI_SUGGEST
            if resolved_signal_type == AdvisorySignalEvent.SignalTypeChoices.AI_SUGGEST
            else UnifiedAlert.AlertTypeChoices.AI_ALERT
        )

        title = str(metadata.get('title') or f'AI tín hiệu {event.symbol}')
        body = str(metadata.get('body') or '')
        updated_metadata = {
            **metadata,
            'source': 'signal_intelligence.ai_signal_events',
        }

        alert, alert_created = UnifiedAlert.objects.get_or_create(
            source_ref=source_ref,
            defaults={
                'symbol': event.symbol,
                'alert_type': alert_type,
                'severity': severity,
                'confidence': confidence,
                'freshness_state': 'fresh',
                'title': title,
                'body': body,
                'value': None,
                'direction': UnifiedAlert.DirectionChoices.NEUTRAL,
                'session_date': event.session_date,
                'triggered_at': event.triggered_at,
                'source_ref': source_ref,
                'metadata': updated_metadata,
                'evidence': evidence,
            },
        )
        dirty_fields: list[str] = []
        if alert.alert_type != alert_type:
            alert.alert_type = alert_type
            dirty_fields.append('alert_type')
        if alert.severity != severity:
            alert.severity = severity
            dirty_fields.append('severity')
        if alert.confidence != confidence:
            alert.confidence = confidence
            dirty_fields.append('confidence')
        if alert.freshness_state != 'fresh':
            alert.freshness_state = 'fresh'
            dirty_fields.append('freshness_state')
        if alert.title != title:
            alert.title = title
            dirty_fields.append('title')
        if alert.body != body:
            alert.body = body
            dirty_fields.append('body')
        if alert.session_date != event.session_date:
            alert.session_date = event.session_date
            dirty_fields.append('session_date')
        if alert.triggered_at != event.triggered_at:
            alert.triggered_at = event.triggered_at
            dirty_fields.append('triggered_at')
        if alert.metadata != updated_metadata:
            alert.metadata = updated_metadata
            dirty_fields.append('metadata')
        if alert.evidence != evidence:
            alert.evidence = evidence
            dirty_fields.append('evidence')
        if dirty_fields and not alert_created:
            alert.save(update_fields=dirty_fields)

        _upsert_advisory_signal_event(
            symbol=event.symbol,
            session_date=event.session_date,
            signal_type=resolved_signal_type,
            severity=severity,
            confidence=confidence,
            title=title,
            body=body,
            source_ref=source_ref,
            evidence=evidence,
            metadata=updated_metadata,
            triggered_at=event.triggered_at,
            unified_alert=alert,
        )

        if alert_created or dirty_fields:
            created += 1

    return {
        'status': 'ok',
        'created': created,
        'source': 'signal_intelligence.ai_signal_events',
    }


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
        confidence = _resolve_confidence_from_matched_value(matched_value, alert_family='whale')
        evidence = _build_alert_evidence(
            source='native_order_flow_events',
            signal_type=event.signal_type,
            event_id=str(event.event_id),
            whale_intensity=event.whale_intensity,
            matched_value=matched_value,
        )

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
                    'confidence': confidence,
                    'freshness_state': 'fresh',
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
                    'evidence': evidence,
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
        if alert.confidence != confidence:
            alert.confidence = confidence
            alert_dirty_fields.append('confidence')
        if alert.freshness_state != 'fresh':
            alert.freshness_state = 'fresh'
            alert_dirty_fields.append('freshness_state')
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
        if alert.evidence != evidence:
            alert.evidence = evidence
            alert_dirty_fields.append('evidence')
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
