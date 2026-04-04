from __future__ import annotations

import logging
import os

from celery import shared_task
from django.conf import settings
from django.core.cache import cache
from django.utils import timezone

from portfolio.models import (
    PriceAlertRule,
    SecuritiesGroup,
    SecuritiesItem,
    TrackedSymbol,
    Transaction,
    UserConfig,
    WatchlistGroup,
    WatchlistItem,
    WhaleConfigRollout,
)
from portfolio.realtime.collector import collect_intraday_frame, collect_symbols_for_user, collect_and_push
from portfolio.realtime.compute import (
    build_heartbeat_payload,
    build_ticker_payload,
    build_whale_payload,
    detect_whale_signals,
)
from portfolio.realtime.publisher import RealtimePublisher
from portfolio.services import (
    activate_due_scheduled_whale_config_rollouts,
    ensure_rollout_worker_ack_records,
    get_live_celery_worker_names,
    monitor_whale_config_rollout_anomalies,
    record_whale_config_worker_ack,
    resolve_whale_runtime_config,
    refresh_rollout_propagation_status,
    sync_watchlist_prices,
)

logger = logging.getLogger(__name__)

TICKER_PREFETCH_META_CACHE_KEY = 'ticker:prefetch:meta'


def _distinct_symbols(queryset) -> list[str]:
    return sorted({
        str(symbol).strip().upper()
        for symbol in queryset
        if symbol and str(symbol).strip()
    })


def _collect_prefetch_symbols() -> tuple[list[str], dict]:
    include_group_symbols = os.getenv('TICKER_PREFETCH_INCLUDE_GROUP_SYMBOLS', 'False').lower() == 'true'
    symbol_limit = max(int(os.getenv('TICKER_PREFETCH_SYMBOL_LIMIT', '120')), 0)

    source_lists = {
        'tracked_symbols': _distinct_symbols(TrackedSymbol.objects.values_list('symbol', flat=True).distinct()),
        'watchlist_items': _distinct_symbols(WatchlistItem.objects.values_list('symbol', flat=True).distinct()),
        'price_alerts': _distinct_symbols(PriceAlertRule.objects.values_list('symbol', flat=True).distinct()),
        'portfolio_transactions': _distinct_symbols(Transaction.objects.values_list('symbol', flat=True).distinct()),
    }
    if include_group_symbols:
        source_lists['market_group_items'] = _distinct_symbols(
            SecuritiesItem.objects.values_list('symbol', flat=True).distinct()
        )

    merged_symbols = []
    seen = set()
    for _, symbols in source_lists.items():
        for symbol in symbols:
            if symbol in seen:
                continue
            seen.add(symbol)
            merged_symbols.append(symbol)

    if symbol_limit:
        merged_symbols = merged_symbols[:symbol_limit]

    source_counts = {name: len(symbols) for name, symbols in source_lists.items()}
    return merged_symbols, source_counts


def _store_prefetch_meta(payload: dict, timeout: int = 600) -> None:
    try:
        cache.set(TICKER_PREFETCH_META_CACHE_KEY, payload, timeout=timeout)
    except Exception:
        pass


def _is_rate_limited_error(exc: Exception) -> bool:
    message = str(exc or '').lower()
    return '429' in message or 'too many requests' in message


def _prefetch_retry_countdown(retries: int) -> int:
    base = max(int(os.getenv('TICKER_PREFETCH_RETRY_BASE_SECONDS', '15')), 1)
    max_seconds = max(int(os.getenv('TICKER_PREFETCH_RETRY_MAX_SECONDS', '180')), base)
    return min(max_seconds, base * (2 ** max(retries, 0)))


@shared_task(bind=True, autoretry_for=(Exception,), retry_backoff=True, retry_kwargs={"max_retries": 2})
def activate_due_whale_config_rollouts(self) -> dict:
    activated = activate_due_scheduled_whale_config_rollouts()
    return {
        'status': 'ok',
        'activated_count': len(activated),
        'activated': activated,
    }


@shared_task(bind=True, autoretry_for=(Exception,), retry_backoff=True, retry_kwargs={"max_retries": 2})
def monitor_whale_config_anomalies(self, auto_revert: bool = True) -> dict:
    results = monitor_whale_config_rollout_anomalies(auto_revert=auto_revert)
    auto_reverted = [result for result in results if result.get('auto_reverted')]
    anomalies = [result for result in results if not result.get('anomaly', {}).get('healthy', True)]
    return {
        'status': 'ok',
        'checked_count': len(results),
        'anomaly_count': len(anomalies),
        'auto_reverted_count': len(auto_reverted),
        'results': results,
    }


@shared_task(bind=True, autoretry_for=(Exception,), retry_backoff=True, retry_kwargs={"max_retries": 2})
def refresh_whale_config_rollout_status(self, rollout_id: int) -> dict:
    rollout = WhaleConfigRollout.objects.select_related('version').get(pk=rollout_id)
    worker_result = get_live_celery_worker_names()
    ensure_rollout_worker_ack_records(rollout, worker_names=worker_result['workers'])
    snapshot = refresh_rollout_propagation_status(rollout)
    return {
        'status': rollout.status,
        'rollout_id': rollout.id,
        'version_code': rollout.version.version_code,
        'signal': snapshot['signal'],
        'acked_count': snapshot['acked_count'],
        'expected_count': snapshot['expected_count'],
        'missing_workers': snapshot['missing_workers'],
        'stale_workers': snapshot['stale_workers'],
    }


@shared_task(bind=True, autoretry_for=(Exception,), retry_backoff=True, retry_kwargs={"max_retries": 2})
def ack_whale_config_rollout(
    self,
    rollout_id: int,
    worker_name: str | None = None,
    worker_version: str | None = None,
    details: str = '',
) -> dict:
    rollout = WhaleConfigRollout.objects.select_related('version').get(pk=rollout_id)
    resolved_worker_name = worker_name or getattr(self.request, 'hostname', '') or 'unknown-worker'
    resolved_version = worker_version or rollout.version.version_code

    ack = record_whale_config_worker_ack(
        rollout,
        worker_name=resolved_worker_name,
        worker_version=resolved_version,
        acked=True,
        details=details or 'ack_from_task',
    )
    snapshot = refresh_rollout_propagation_status(rollout)
    return {
        'status': rollout.status,
        'rollout_id': rollout.id,
        'worker_name': ack.worker_name,
        'worker_version': ack.worker_version,
        'signal': snapshot['signal'],
        'acked_count': snapshot['acked_count'],
        'expected_count': snapshot['expected_count'],
    }


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
    worker_name = getattr(self.request, 'hostname', '') or 'collect-and-publish'

    published = 0
    for symbol in symbols:
        runtime_config = resolve_whale_runtime_config(
            symbol=symbol,
            worker_name=worker_name,
            source='collect_and_publish',
        )
        thresholds = _whale_thresholds_for_user(user_id) if user_id is not None else (runtime_config['thresholds_vnd'] or _whale_thresholds_for_user(user_id))

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
            whale_payload = build_whale_payload(
                signal=signal,
                seq=whale_seq,
                config_version=runtime_config['version_code'],
                source=f"collect-and-publish:{runtime_config['mode']}",
                score_config=runtime_config['score_config'],
            )
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
                    'threshold': signal.threshold,
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

    worker_name = getattr(self.request, 'hostname', '') or f'{group}-worker'
    consumers = []
    if group in ("all", "db-writer"):
        consumers.append(DbWriterConsumer(consumer_name=worker_name))
    if group in ("all", "ws-broadcaster"):
        consumers.append(WsBroadcastConsumer(consumer_name=worker_name))
    if group in ("all", "alert-engine"):
        consumers.append(AlertEngineConsumer(consumer_name=worker_name))

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
def generate_whale_advisory_task(
    self,
    symbol: str,
    matched_value_vnd: float,
    side: str,
    threshold: float = 0,
    force_refresh: bool = False,
) -> dict:
    """
    1. Kiểm tra Redis cooldown — bỏ qua nếu đã gọi trong 15 phút.
    2. Gọi provider AI được cấu hình trong UserConfig: summary (Pro) + detail (Premium).
    3. Lưu WhaleAdvisory vào DB.
    4. Push WebSocket event whale_advisory tới group whale_{symbol}.
    """
    from django.core.cache import cache
    from asgiref.sync import async_to_sync
    from channels.layers import get_channel_layer
    from portfolio.ai_options import get_default_model, is_valid_model, is_valid_provider
    from portfolio.ai_service import generate_whale_text
    from portfolio.models import WhaleAdvisory

    cooldown = getattr(settings, 'WHALE_ADVISORY_COOLDOWN_SECONDS', 900)
    cache_key = f'whale_advisory_lock:{symbol}'

    if not force_refresh and WhaleAdvisory.objects.filter(symbol=symbol).exists():
        logger.info('Whale advisory already exists — skipping auto generation for %s', symbol)
        return {'status': 'skipped', 'symbol': symbol, 'reason': 'existing_advisory'}

    if not force_refresh and cache.get(cache_key):
        logger.info('Whale advisory cooldown active — skipping %s', symbol)
        return {'status': 'skipped', 'symbol': symbol, 'reason': 'cooldown'}

    # Ưu tiên cấu hình từ user staff đầu tiên để vận hành tập trung.
    cfg = UserConfig.objects.filter(user__is_staff=True).select_related('user').order_by('id').first()
    provider = str(getattr(cfg, 'ai_provider', 'openclaw') or 'openclaw').strip().lower()
    model = str(getattr(cfg, 'ai_model', '') or '').strip() or get_default_model(provider)
    if not is_valid_provider(provider):
        provider = 'openclaw'
        model = get_default_model(provider)
    if not is_valid_model(provider, model):
        model = get_default_model(provider)

    api_key = ''
    if cfg:
        api_key = cfg.get_ai_api_key()

    try:
        summary_resp = generate_whale_text(
            provider=provider,
            model=model,
            api_key=api_key,
            symbol=symbol,
            matched_value_vnd=matched_value_vnd,
            side=side,
            deep=False,
        )
        deep_resp = generate_whale_text(
            provider=provider,
            model=model,
            api_key=api_key,
            symbol=symbol,
            matched_value_vnd=matched_value_vnd,
            side=side,
            deep=True,
        )
    except Exception as exc:
        logger.error('AI provider error for %s via %s/%s: %s', symbol, provider, model, exc)
        raise  # Celery retry

    advisory = WhaleAdvisory.objects.create(
        symbol=symbol,
        matched_value=int(matched_value_vnd),
        side=side,
        threshold=float(threshold or 0),
        ai_summary=summary_resp['text'],
        ai_detail=deep_resp['text'],
        ai_provider=provider,
        prompt_tokens=summary_resp['prompt_tokens'] + deep_resp['prompt_tokens'],
        completion_tokens=summary_resp['completion_tokens'] + deep_resp['completion_tokens'],
    )

    # Set cooldown lock cho luồng auto; refresh thủ công có cooldown riêng ở API endpoint.
    if not force_refresh:
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
                    'threshold': float(threshold or 0),
                    'ai_summary': advisory.ai_summary,
                    'ai_detail': advisory.ai_detail,
                    'ai_provider': advisory.ai_provider,
                    'ts': advisory.created_at.isoformat(),
                    'created_at': advisory.created_at.isoformat(),
                    'id': advisory.id,
                },
            },
        )
    except Exception as exc:
        logger.warning('WebSocket push failed for whale_advisory %s: %s', symbol, exc)

    logger.info('WhaleAdvisory created: id=%d symbol=%s side=%s', advisory.id, symbol, side)
    return {
        'status': 'ok',
        'advisory_id': advisory.id,
        'symbol': symbol,
        'ai_provider': provider,
        'ai_model': model,
        'force_refresh': bool(force_refresh),
    }


# ---------------------------------------------------------------------------
# Tier-2 Cache pre-fetch: batch price_board cho tất cả tracked symbols
# Giải quyết thread pool exhaustion — 1 vnstock call thay vì N calls
# ---------------------------------------------------------------------------
@shared_task(bind=True)
def prefetch_ticker_price_board(self) -> dict:
    """
    Gọi vnstock price_board MỘT LẦN cho tất cả tracked symbols.
    Kết quả được lưu vào Django cache (ticker:{symbol}) với TTL 60s.
    HTTP handler RealtimeTickerView chỉ đọc cache, không gọi vnstock nữa.
    Chạy mỗi 20s qua Celery Beat (luôn bật, không cần REALTIME_ENABLED).
    """
    batch_size = max(int(os.getenv('TICKER_PREFETCH_BATCH_SIZE', '30')), 1)
    symbols, source_counts = _collect_prefetch_symbols()
    if not symbols:
        payload = {
            'status': 'ok',
            'symbols': 0,
            'cached': 0,
            'source_counts': source_counts,
            'generated_at': timezone.now().isoformat(),
            'batch_size': batch_size,
            'batches': 0,
            'sample_symbols': [],
        }
        _store_prefetch_meta(payload)
        return payload

    def _f(val):
        try:
            v = float(val)
            return v if v == v and v != 0 else None
        except (TypeError, ValueError):
            return None

    def _i(val):
        try:
            v = float(val)
            return int(v) if v == v else None
        except (TypeError, ValueError):
            return None

    now_iso = timezone.now().isoformat()
    cached_count = 0
    processed_batches = 0
    max_retries = max(int(os.getenv('TICKER_PREFETCH_MAX_RETRIES', '4')), 0)
    try:
        from vnstock import Vnstock

        for start in range(0, len(symbols), batch_size):
            batch_symbols = symbols[start:start + batch_size]
            stock = Vnstock().stock(symbol=batch_symbols[0], source='VCI')
            df = stock.trading.price_board(symbols_list=batch_symbols)
            processed_batches += 1

            if df is None or df.empty:
                continue

            for _, row in df.iterrows():
                try:
                    sym = str(row.get(('listing', 'symbol')) or '').upper()
                    if not sym:
                        continue
                    match_price = _f(row.get(('match', 'match_price')))
                    ref_price = (_f(row.get(('listing', 'ref_price')))
                                 or _f(row.get(('match', 'reference_price'))))
                    highest = _f(row.get(('match', 'highest')))
                    lowest = _f(row.get(('match', 'lowest')))
                    open_price = _f(row.get(('match', 'open_price')))
                    accum_vol = _i(row.get(('match', 'accumulated_volume')))
                    change_value = round(match_price - ref_price, 2) if match_price and ref_price else None
                    change_pct = (round((match_price - ref_price) / ref_price * 100, 2)
                                  if match_price and ref_price else None)
                    data = {
                        'symbol': sym,
                        'current_price': match_price,
                        'prev_price': ref_price,
                        'change_value': change_value,
                        'change_pct': change_pct,
                        'high_price': highest,
                        'low_price': lowest,
                        'open_price': open_price,
                        'volume': accum_vol,
                        'last_date': now_iso,
                        'freshness_seconds': 0,
                        'stale': False,
                        'source': 'prefetch',
                    }
                    cache.set(f'ticker:{sym}', data, timeout=60)
                    cached_count += 1
                except Exception as exc:
                    logger.warning('prefetch_ticker_price_board parse error row: %s', exc)
    except (Exception, SystemExit) as exc:
        logger.warning('prefetch_ticker_price_board vnstock error: %s', exc)
        if _is_rate_limited_error(exc):
            countdown = _prefetch_retry_countdown(getattr(self.request, 'retries', 0))
            payload = {
                'status': 'retrying',
                'reason': str(exc),
                'symbols': len(symbols),
                'cached': cached_count,
                'source_counts': source_counts,
                'generated_at': timezone.now().isoformat(),
                'batch_size': batch_size,
                'batches': processed_batches,
                'sample_symbols': symbols[:10],
                'retry_after_seconds': countdown,
                'retry_count': getattr(self.request, 'retries', 0) + 1,
                'max_retries': max_retries,
            }
            _store_prefetch_meta(payload)
            raise self.retry(exc=exc, countdown=countdown, max_retries=max_retries)

        payload = {
            'status': 'error',
            'reason': str(exc),
            'symbols': len(symbols),
            'cached': cached_count,
            'source_counts': source_counts,
            'generated_at': timezone.now().isoformat(),
            'batch_size': batch_size,
            'batches': processed_batches,
            'sample_symbols': symbols[:10],
        }
        _store_prefetch_meta(payload)
        return payload

    payload = {
        'status': 'ok',
        'symbols': len(symbols),
        'cached': cached_count,
        'source_counts': source_counts,
        'generated_at': now_iso,
        'batch_size': batch_size,
        'batches': processed_batches,
        'sample_symbols': symbols[:10],
        'retry_count': getattr(self.request, 'retries', 0),
    }
    _store_prefetch_meta(payload)
    logger.info(
        'prefetch_ticker_price_board: symbols=%d cached=%d batches=%d',
        len(symbols),
        cached_count,
        processed_batches,
    )
    return payload

