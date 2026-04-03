from __future__ import annotations

import logging

from celery import shared_task
from django.conf import settings

from portfolio.models import TrackedSymbol, UserConfig, WatchlistGroup, SecuritiesGroup
from portfolio.realtime.collector import collect_intraday_frame, collect_symbols_for_user, collect_and_push
from portfolio.realtime.compute import (
    build_heartbeat_payload,
    build_ticker_payload,
    build_whale_payload,
    detect_whale_signals,
)
from portfolio.realtime.publisher import RealtimePublisher
from portfolio.services import sync_watchlist_prices

logger = logging.getLogger(__name__)


def _whale_thresholds_for_user(user_id: int | None) -> list[float]:
    default_threshold = float(getattr(settings, "REALTIME_DEFAULT_WHALE_THRESHOLD", 500_000_000))
    if user_id is None:
        return [default_threshold]

    config = UserConfig.objects.filter(user_id=user_id).values("whale_alert_threshold").first()
    if not config or config.get("whale_alert_threshold") is None:
        return [default_threshold]

    # whale_alert_threshold is in million VND in current domain model.
    threshold_vnd = float(config["whale_alert_threshold"]) * 1_000_000
    return [threshold_vnd]


@shared_task(bind=True, autoretry_for=(Exception,), retry_backoff=True, retry_kwargs={"max_retries": 3})
def collect_and_publish_realtime(self, user_id: int | None = None) -> dict:
    if not getattr(settings, "REALTIME_ENABLED", False):
        return {"status": "skipped", "reason": "REALTIME_ENABLED=false"}

    symbols = collect_symbols_for_user(user_id=user_id)
    if not symbols:
        return {"status": "ok", "symbols": 0, "published": 0}

    # --- Redis Streams: push ticks vào stream trước khi publish WebSocket ---
    stream_enabled = getattr(settings, "STREAM_REDIS_URL", None)
    producer = None
    if stream_enabled:
        try:
            from portfolio.realtime.tick_producer import TickProducer
            producer = TickProducer()
        except Exception as exc:
            logger.warning("TickProducer init failed: %s", exc)

    publisher = RealtimePublisher()
    thresholds = _whale_thresholds_for_user(user_id)

    published = 0
    for symbol in symbols:
        # Thu thập frame một lần, tái dùng cho cả Stream push lẫn WebSocket publish
        frame = collect_intraday_frame(symbol)

        # Push ticks vào Redis Stream (nếu available) — dùng lại frame đã fetch
        if producer is not None:
            try:
                producer.ensure_consumer_groups(symbol)
                producer.push_intraday_ticks(symbol, frame)
            except Exception as exc:
                logger.warning("Stream push failed for %s: %s", symbol, exc)

        ticker_channel = f"ticker:{symbol}"
        ticker_seq = publisher.next_seq(ticker_channel)
        ticker_payload = build_ticker_payload(symbol=symbol, trades_df=frame, seq=ticker_seq)
        if publisher.publish(ticker_channel, ticker_payload):
            published += 1

        whale_channel = f"whale:{symbol}"
        for signal in detect_whale_signals(symbol=symbol, trades_df=frame, thresholds=thresholds):
            whale_seq = publisher.next_seq(whale_channel)
            whale_payload = build_whale_payload(signal=signal, seq=whale_seq)
            if publisher.publish(whale_channel, whale_payload):
                published += 1
            if user_id is not None:
                user_channel = f"user:{user_id}:alerts"
                user_seq = publisher.next_seq(user_channel)
                user_payload = {**whale_payload, "seq": user_seq}
                if publisher.publish(user_channel, user_payload):
                    published += 1
            # Trigger AI advisory — delay 2s để không block main task
            generate_whale_advisory_task.apply_async(
                kwargs={
                    'symbol': signal.symbol,
                    'matched_value_vnd': signal.matched_value,
                    'side': signal.side,
                },
                countdown=2,
            )

    if user_id is not None:
        heartbeat_channel = f"user:{user_id}:alerts"
        heartbeat_seq = publisher.next_seq(heartbeat_channel)
        heartbeat_payload = build_heartbeat_payload(scope=f"user:{user_id}", seq=heartbeat_seq)
        if publisher.publish(heartbeat_channel, heartbeat_payload):
            published += 1

    logger.info("Realtime publish completed: symbols=%d published=%d", len(symbols), published)
    return {"status": "ok", "symbols": len(symbols), "published": published}


@shared_task(bind=True, autoretry_for=(Exception,), retry_backoff=True, retry_kwargs={"max_retries": 3})
def sync_user_watch_assets(self, user_id: int, days: int | None = None) -> dict:
    sync_days = int(days or getattr(settings, 'WATCHLIST_SYNC_DAYS', 5))
    results = sync_watchlist_prices(user_id=user_id, days=sync_days)
    return {
        'status': 'ok',
        'user_id': user_id,
        'days': sync_days,
        'symbols': len(results),
        'synced': results,
    }


@shared_task(bind=True, autoretry_for=(Exception,), retry_backoff=True, retry_kwargs={"max_retries": 3})
def sync_all_watch_assets(self, days: int | None = None) -> dict:
    sync_days = int(days or getattr(settings, 'WATCHLIST_SYNC_DAYS', 5))
    user_ids = sorted({
        *TrackedSymbol.objects.values_list('user_id', flat=True),
        *WatchlistGroup.objects.values_list('user_id', flat=True),
    })
    user_ids = [user_id for user_id in user_ids if user_id]

    synced_users = []
    total_symbols = 0
    for user_id in user_ids:
                results = sync_watchlist_prices(user_id=user_id, days=sync_days)
                total_symbols += len(results)
                synced_users.append({'user_id': user_id, 'symbols': len(results)})

    return {
        'status': 'ok',
        'days': sync_days,
        'users': synced_users,
        'total_users': len(synced_users),
        'total_symbols': total_symbols,
    }


# ---------------------------------------------------------------------------
# M2: Celery task — chạy consumer batch theo group (thay thế cho long-running process)
# ---------------------------------------------------------------------------
@shared_task(bind=True, autoretry_for=(Exception,), retry_backoff=False, retry_kwargs={"max_retries": 0})
def run_stream_consumer_batch(self, group: str = "all") -> dict:
    """
    Chạy một batch của stream consumers cho tất cả active symbols.
    Được gọi định kỳ qua Celery Beat (thay vì long-running process).
    """
    from portfolio.realtime.stream_consumers import (
        DbWriterConsumer,
        WsBroadcastConsumer,
        AlertEngineConsumer,
    )

    consumers = []
    if group in ("all", "db-writer"):
        consumers.append(DbWriterConsumer())
    if group in ("all", "ws-broadcaster"):
        consumers.append(WsBroadcastConsumer())
    if group in ("all", "alert-engine"):
        consumers.append(AlertEngineConsumer())

    symbols = collect_symbols_for_user(user_id=None)
    if not symbols:
        return {"status": "ok", "processed": 0}

    total = 0
    for symbol in symbols:
        for consumer in consumers:
            try:
                total += consumer.run_once(symbol)
            except Exception as exc:
                logger.warning("consumer.run_once(%s, %s) error: %s", group, symbol, exc)

    return {"status": "ok", "group": group, "symbols": len(symbols), "processed": total}


# ---------------------------------------------------------------------------
# M4: EOD cleanup — trim stream và xóa IntradayTick cũ
# ---------------------------------------------------------------------------
@shared_task(bind=True, autoretry_for=(Exception,), retry_backoff=True, retry_kwargs={"max_retries": 2})
def cleanup_old_intraday_ticks(self, keep_days: int = 7) -> dict:
    """
    Xóa IntradayTick cũ hơn `keep_days` ngày để tránh DB phình to.
    Chạy mỗi đêm qua Celery Beat.
    """
    from datetime import date, timedelta
    from portfolio.models import IntradayTick

    cutoff = date.today() - timedelta(days=keep_days)
    deleted, _ = IntradayTick.objects.filter(trade_date__lt=cutoff).delete()
    logger.info("EOD cleanup: deleted %d IntradayTick records older than %s", deleted, cutoff)
    return {"status": "ok", "deleted": deleted, "cutoff": str(cutoff)}


@shared_task(bind=True, autoretry_for=(Exception,), retry_backoff=True, retry_kwargs={"max_retries": 2})
def trim_streams(self) -> dict:
    """
    Trim tất cả Redis Streams về STREAM_MAX_LEN để tiết kiệm bộ nhớ.
    Chạy định kỳ qua Celery Beat.
    """
    from portfolio.realtime.tick_producer import TickProducer, _get_stream_client

    max_len = getattr(settings, "STREAM_MAX_LEN", 50_000)
    symbols = collect_symbols_for_user(user_id=None)
    if not symbols:
        return {"status": "ok", "trimmed": 0}

    try:
        client = _get_stream_client()
    except Exception as exc:
        logger.warning("trim_streams: Redis unavailable: %s", exc)
        return {"status": "skipped", "reason": str(exc)}

    trimmed = 0
    for symbol in symbols:
        key = TickProducer.stream_key(symbol)
        try:
            client.xtrim(key, maxlen=max_len, approximate=True)
            trimmed += 1
        except Exception as exc:
            logger.warning("trim_streams: xtrim(%s) failed: %s", key, exc)

    return {"status": "ok", "trimmed": trimmed, "max_len": max_len}


# ---------------------------------------------------------------------------
# AI Advisory: Gọi OpenClaw → lưu WhaleAdvisory → push WebSocket
# ---------------------------------------------------------------------------
@shared_task(bind=True, autoretry_for=(Exception,), retry_backoff=60, retry_kwargs={'max_retries': 2})
def generate_whale_advisory_task(self, symbol: str, matched_value_vnd: float, side: str) -> dict:
    """
    1. Kiểm tra Redis cooldown — bỏ qua nếu đã gọi trong 15 phút.
    2. Gọi OpenClaw: summary (Pro) + detail (Premium).
    3. Lưu WhaleAdvisory vào DB.
    4. Push WebSocket event whale_advisory tới group whale_{symbol}.
    """
    from django.core.cache import cache
    from asgiref.sync import async_to_sync
    from channels.layers import get_channel_layer
    from portfolio.models import WhaleAdvisory
    from portfolio.openclaw_client import generate_whale_summary, generate_whale_deep

    cooldown = getattr(settings, 'WHALE_ADVISORY_COOLDOWN_SECONDS', 900)
    cache_key = f'whale_advisory_lock:{symbol}'

    if cache.get(cache_key):
        logger.info('Whale advisory cooldown active — skipping %s', symbol)
        return {'status': 'skipped', 'symbol': symbol, 'reason': 'cooldown'}

    try:
        summary_resp = generate_whale_summary(symbol, matched_value_vnd, side)
        deep_resp    = generate_whale_deep(symbol, matched_value_vnd, side)
    except Exception as exc:
        logger.error('OpenClaw API error for %s: %s', symbol, exc)
        raise  # Celery retry

    advisory = WhaleAdvisory.objects.create(
        symbol=symbol,
        matched_value=int(matched_value_vnd),
        side=side,
        ai_summary=summary_resp['text'],
        ai_detail=deep_resp['text'],
        ai_provider='openclaw',
        prompt_tokens=summary_resp['prompt_tokens'] + deep_resp['prompt_tokens'],
        completion_tokens=summary_resp['completion_tokens'] + deep_resp['completion_tokens'],
    )

    # Set cooldown lock
    cache.set(cache_key, True, timeout=cooldown)

    # Push WebSocket event tới group whale_{symbol}
    try:
        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            f'whale_{symbol}',
            {
                'type': 'whale_advisory',
                'payload': {
                    'event_type': 'whale_advisory',
                    'symbol': symbol,
                    'side': side,
                    'matched_value': int(matched_value_vnd),
                    'ai_summary': advisory.ai_summary,
                    'ai_detail': advisory.ai_detail,
                    'created_at': advisory.created_at.isoformat(),
                    'id': advisory.id,
                },
            },
        )
    except Exception as exc:
        logger.warning('WebSocket push failed for whale_advisory %s: %s', symbol, exc)

    logger.info('WhaleAdvisory created: id=%d symbol=%s side=%s', advisory.id, symbol, side)
    return {'status': 'ok', 'advisory_id': advisory.id, 'symbol': symbol}

