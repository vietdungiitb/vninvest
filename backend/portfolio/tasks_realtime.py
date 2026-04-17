from __future__ import annotations

import logging

from celery import shared_task
from django.conf import settings
from django.core.cache import cache

from portfolio.domain_constants import resolve_user_whale_threshold_vnd
from portfolio.models import TrackedSymbol, UserConfig
from portfolio.observability import record_whale_dedup_observation, record_whale_event_observation

logger = logging.getLogger(__name__)


def _whale_thresholds_for_user(user_id: int | None) -> list[float]:
    default_threshold = float(getattr(settings, "REALTIME_DEFAULT_WHALE_THRESHOLD", 500_000_000))
    if user_id is None:
        return [default_threshold]

    config = UserConfig.objects.filter(user_id=user_id).values("whale_alert_threshold").first()
    if not config or config.get("whale_alert_threshold") is None:
        return [default_threshold]

    threshold_vnd = float(config["whale_alert_threshold"]) * 1_000_000
    return [threshold_vnd]


@shared_task(bind=True, name='portfolio.tasks.collect_and_publish_realtime', autoretry_for=(Exception,), retry_backoff=True, retry_kwargs={"max_retries": 3})
def collect_and_publish_realtime(self, user_id: int | None = None) -> dict:
    from django.core.cache import cache
    from portfolio import tasks as tasks_facade

    if not getattr(settings, "REALTIME_ENABLED", False):
        return {"status": "skipped", "reason": "REALTIME_ENABLED=false"}

    # Distributed lock: prevent overlapping executions of this periodic task.
    lock_key = f"lock:collect_and_publish_realtime:{user_id or 'global'}"
    lock_timeout = 30  # seconds — should exceed max expected task duration
    if not cache.add(lock_key, 1, timeout=lock_timeout):
        logger.debug("collect_and_publish_realtime already running (lock=%s), skipping", lock_key)
        return {"status": "skipped", "reason": "lock_held"}

    try:
        symbols = tasks_facade.collect_symbols_for_user(user_id=user_id)
        if not symbols:
            return {"status": "ok", "symbols": 0, "published": 0}

        stream_enabled = getattr(settings, "STREAM_REDIS_URL", None)
        producer = None
        if stream_enabled:
            try:
                from portfolio.realtime.tick_producer import TickProducer

                producer = TickProducer()
            except Exception as exc:
                logger.warning("TickProducer init failed: %s", exc)

        publisher = tasks_facade.RealtimePublisher()
        worker_name = getattr(self.request, 'hostname', '') or 'collect-and-publish'

        user_thresholds = _whale_thresholds_for_user(user_id)
        symbol_threshold_overrides: dict[str, float] = {}
        if user_id is not None and symbols:
            override_rows = TrackedSymbol.objects.filter(
                user_id=user_id,
                symbol__in=symbols,
                whale_alert_threshold_million__isnull=False,
            ).values('symbol', 'whale_alert_threshold_million')
            for row in override_rows:
                normalized_symbol = tasks_facade._normalize_symbol(row.get('symbol'))
                if not normalized_symbol:
                    continue
                symbol_threshold_overrides[normalized_symbol] = resolve_user_whale_threshold_vnd(
                    row.get('whale_alert_threshold_million')
                )

        published = 0
        whale_event_publish_flags: dict[str, dict[str, bool]] = {}
        for symbol in symbols:
            normalized_symbol = tasks_facade._normalize_symbol(symbol)
            runtime_config = tasks_facade.resolve_whale_runtime_config(
                symbol=symbol,
                worker_name=worker_name,
                source='collect_and_publish',
            )
            if user_id is not None:
                thresholds = [
                    symbol_threshold_overrides.get(normalized_symbol, user_thresholds[0])
                ]
            else:
                thresholds = runtime_config['thresholds_vnd'] or user_thresholds

            frame = tasks_facade.collect_intraday_frame(symbol)

            if producer is not None:
                try:
                    producer.ensure_consumer_groups(symbol)
                    producer.push_intraday_ticks(symbol, frame)
                except Exception as exc:
                    logger.warning("Stream push failed for %s: %s", symbol, exc)

            ticker_channel = f"ticker:{symbol}"
            ticker_seq = publisher.next_seq(ticker_channel)
            ticker_payload = tasks_facade.build_ticker_payload(symbol=symbol, trades_df=frame, seq=ticker_seq)
            if publisher.publish(ticker_channel, ticker_payload):
                published += 1

            whale_channel = f"whale:{symbol}"
            for signal in tasks_facade.detect_whale_signals(symbol=symbol, trades_df=frame, thresholds=thresholds):
                whale_seq = publisher.next_seq(whale_channel)
                whale_payload = tasks_facade.build_whale_payload(
                    signal=signal,
                    seq=whale_seq,
                    config_version=runtime_config['version_code'],
                    source=f"collect-and-publish:{runtime_config['mode']}",
                    score_config=runtime_config['score_config'],
                )
                event_id = whale_payload.get("event_id", "")
                if event_id:
                    dedup_cache_key = f"whale:dedup:{event_id}"
                    if cache.get(dedup_cache_key):
                        record_whale_dedup_observation(hit=True)
                        continue
                    cache.set(dedup_cache_key, 1, timeout=300)
                    record_whale_dedup_observation(hit=False)

                if publisher.publish(whale_channel, whale_payload):
                    published += 1
                    if event_id:
                        whale_event_publish_flags[event_id] = {
                            "symbol_channel_published": True,
                            "user_channel_published": False,
                        }
                    record_whale_event_observation(
                        source=str(whale_payload.get('source') or 'intraday-engine'),
                        ts=whale_payload.get('ts'),
                        recovered=bool(whale_payload.get('recovered')),
                    )
                if user_id is not None:
                    publish_flags = whale_event_publish_flags.get(event_id or "", {})
                    already_on_symbol_channel = bool(publish_flags.get("symbol_channel_published"))
                    if not already_on_symbol_channel:
                        user_channel = f"user:{user_id}:alerts"
                        user_seq = publisher.next_seq(user_channel)
                        user_payload = {**whale_payload, "seq": user_seq}
                        if publisher.publish(user_channel, user_payload):
                            published += 1
                            if event_id:
                                whale_event_publish_flags[event_id] = {
                                    "symbol_channel_published": False,
                                    "user_channel_published": True,
                                }
                tracked_rows = list(
                    TrackedSymbol.objects.filter(symbol=signal.symbol)
                    .values('user_id', 'whale_alert_threshold_million')
                )
                tracked_user_ids = [int(tr.get('user_id')) for tr in tracked_rows if tr.get('user_id')]
                user_cfgs_map = {
                    cfg.user_id: cfg 
                    for cfg in UserConfig.objects.filter(user_id__in=tracked_user_ids)
                } if tracked_user_ids else {}

                for tracked_row in tracked_rows:
                    tracked_user_id = int(tracked_row.get('user_id') or 0)
                    if not tracked_user_id:
                        continue
                    user_cfg = user_cfgs_map.get(tracked_user_id)
                    if user_cfg is None:
                        continue
                    if not bool(user_cfg.advisory_whale_signal_enabled):
                        continue
                    threshold_vnd = tasks_facade._resolve_advisory_threshold_vnd(
                        user_cfg,
                        tracked_threshold_million=tracked_row.get('whale_alert_threshold_million'),
                    )
                    threshold_source = 'symbol_override' if tracked_row.get('whale_alert_threshold_million') is not None else 'user_default'
                    tasks_facade._accumulate_user_advisory_event(
                        user_id=int(tracked_user_id),
                        symbol=signal.symbol,
                        source='whale_alert',
                        payload={
                            'event_score': whale_payload.get('event_score', 0),
                            'side': whale_payload.get('side') or signal.side,
                            'matched_value': signal.matched_value,
                        },
                        threshold_vnd=threshold_vnd,
                        threshold_source=threshold_source,
                    )

        if user_id is not None:
            heartbeat_channel = f"user:{user_id}:alerts"
            heartbeat_seq = publisher.next_seq(heartbeat_channel)
            heartbeat_payload = tasks_facade.build_heartbeat_payload(scope=f"user:{user_id}", seq=heartbeat_seq)
            if publisher.publish(heartbeat_channel, heartbeat_payload):
                published += 1

        logger.info("Realtime publish completed: symbols=%d published=%d", len(symbols), published)
        return {"status": "ok", "symbols": len(symbols), "published": published}
    finally:
        cache.delete(lock_key)
