from __future__ import annotations

import logging

from celery import shared_task

logger = logging.getLogger(__name__)


def _fetch_news_context_for_advisory(symbol: str, max_items: int = 4) -> str:
    """
    Sprint34 Layer 2: Đọc tin tức gần đây từ cache Redis hoặc vnstock.
    Trả về chuỗi rỗng nếu không có dữ liệu hoặc lỗi (graceful degradation).
    Không gọi vnstock trực tiếp nếu cache miss + đang trong cooldown.
    """
    import logging as _logging

    _log = _logging.getLogger(__name__)

    try:
        from django.core.cache import cache as _cache

        cache_key = f'stock:news:{symbol}'
        cached = _cache.get(cache_key)
        items = None

        if cached is None:
            try:
                from portfolio.adapters.vnstock_adapter import _build_stock_client, _run_with_timeout

                def _fetch():
                    stock_client = _build_stock_client(symbol=symbol, source='VCI')
                    return stock_client.company.news()

                raw = _run_with_timeout(_fetch, timeout=5)
                if raw is not None and not (hasattr(raw, 'empty') and raw.empty):
                    import pandas as _pd

                    rows = raw.to_dict(orient='records') if hasattr(raw, 'to_dict') else (raw if isinstance(raw, list) else [])
                    items_parsed = []
                    for row in rows[:max_items]:
                        title = str(row.get('title') or row.get('subject') or row.get('headline') or '').strip()
                        source_name = str(row.get('source') or row.get('publisher') or '').strip()
                        raw_date = row.get('published_date') or row.get('publishedDate') or row.get('date') or ''
                        try:
                            date_str = str(_pd.Timestamp(raw_date).date()) if raw_date else ''
                        except Exception:
                            date_str = str(raw_date)[:10] if raw_date else ''
                        if title:
                            items_parsed.append({'title': title, 'source': source_name, 'date': date_str})
                    items = items_parsed
            except Exception as exc:
                _log.debug('_fetch_news_context_for_advisory: vnstock error for %s: %s', symbol, exc)
                items = []
        else:
            raw_items = cached.get('items', []) if isinstance(cached, dict) else []
            items = [
                {'title': str(r.get('title') or '').strip(), 'source': str(r.get('source') or '').strip(), 'date': str(r.get('published_at') or '')[:10]}
                for r in raw_items if str(r.get('title') or '').strip()
            ]

        if not items:
            return ''

        lines = [f'Tin tức gần đây về {symbol}:']
        for item in items[:max_items]:
            meta = ''
            if item.get('source') and item.get('date'):
                meta = f" ({item['source']}, {item['date']})"
            elif item.get('source'):
                meta = f" ({item['source']})"
            elif item.get('date'):
                meta = f" ({item['date']})"
            lines.append(f"- {item['title']}{meta}")
        return '\n'.join(lines)
    except Exception as exc:
        _log.debug('_fetch_news_context_for_advisory: unexpected error for %s: %s', symbol, exc)
        return ''


def _generate_news_digest_for_user(user) -> dict:
    """
    Tạo bản tóm tắt tin tức danh mục cho một user.
    Đọc watchlist, fetch news từ cache/vnstock, gọi AI, lưu DB.
    Trả về dict status.
    """
    from django.utils import timezone as _tz

    from portfolio.ai_options import get_advisory_provider_failover_chain, get_default_model
    from portfolio.ai_service import generate_portfolio_digest, _resolve_provider_api_key
    from portfolio.models import PortfolioNewsDigest, WatchlistItem

    today = _tz.localdate()

    if PortfolioNewsDigest.objects.filter(user=user, date=today).exists():
        return {'skipped': True, 'reason': 'already_exists'}

    symbols = list(
        WatchlistItem.objects.filter(group__user=user)
        .values_list('symbol', flat=True)
        .distinct()
        .order_by('symbol')[:20]
    )
    if not symbols:
        return {'skipped': True, 'reason': 'empty_watchlist'}

    news_by_symbol: dict[str, str] = {}
    total_items = 0
    for sym in symbols:
        ctx = _fetch_news_context_for_advisory(sym, max_items=5)
        if ctx:
            news_by_symbol[sym] = ctx
            total_items += ctx.count('\n- ')

    if not news_by_symbol:
        return {'skipped': True, 'reason': 'no_news_available', 'symbols': symbols}

    try:
        user_config = getattr(user, 'userconfig', None)
        provider_chain = get_advisory_provider_failover_chain(user_config)
        provider = provider_chain[0] if provider_chain else 'openclaw'
        model = get_default_model(provider)
        decrypted_key = str(getattr(user_config, 'decrypted_ai_key', '') or '') if user_config else ''
        api_key = _resolve_provider_api_key(provider, decrypted_key)
    except Exception as exc:
        logger.warning('sprint35: cannot resolve AI provider for user=%s: %s', user.id, exc)
        return {'error': str(exc), 'user_id': user.id}

    try:
        result = generate_portfolio_digest(
            provider=provider,
            model=model,
            api_key=api_key,
            symbols=list(news_by_symbol.keys()),
            news_context_by_symbol=news_by_symbol,
            user=user_config,
        )
    except ValueError as exc:
        return {'skipped': True, 'reason': str(exc)}
    except Exception as exc:
        logger.warning('sprint35: AI digest generation failed for user=%s: %s', user.id, exc)
        return {'error': str(exc), 'user_id': user.id}

    try:
        digest = PortfolioNewsDigest.objects.create(
            user=user,
            date=today,
            symbols=list(news_by_symbol.keys()),
            digest_summary=result.get('summary', ''),
            digest_full=result.get('full', ''),
            item_count=total_items,
            ai_model=model,
            prompt_tokens=result.get('prompt_tokens', 0),
            completion_tokens=result.get('completion_tokens', 0),
        )
    except Exception as exc:
        logger.error('sprint35: DB save failed for user=%s: %s', user.id, exc)
        return {'error': str(exc), 'user_id': user.id}

    try:
        from asgiref.sync import async_to_sync
        from channels.layers import get_channel_layer

        channel_layer = get_channel_layer()
        if channel_layer:
            async_to_sync(channel_layer.group_send)(
                f'user_{user.id}_alerts',
                {
                    'type': 'news_digest',
                    'payload': {
                        'event_type': 'news_digest',
                        'digest_id': digest.id,
                        'date': str(today),
                        'symbols': digest.symbols,
                        'summary': digest.digest_summary,
                        'item_count': digest.item_count,
                        'created_at': digest.created_at.isoformat(),
                    },
                },
            )
    except Exception as exc:
        logger.warning('sprint35: WebSocket push failed for user=%s: %s', user.id, exc)

    return {
        'ok': True,
        'user_id': user.id,
        'digest_id': digest.id,
        'symbols': digest.symbols,
        'item_count': digest.item_count,
    }


@shared_task(bind=True, autoretry_for=(Exception,), retry_backoff=True, retry_kwargs={'max_retries': 1})
def generate_all_portfolio_news_digests_task(self, batch_size: int = 200) -> dict:
    """
    Sprint35 Layer 3: Celery Beat 16:05 ICT (Mon-Fri).
    Tạo Portfolio Daily News Digest cho tất cả user có watchlist.
    """
    from django.contrib.auth.models import User as _User

    from portfolio.models import WatchlistItem

    logger.info('event=sprint35_digest_start')
    results = {'ok': 0, 'skipped': 0, 'error': 0}

    user_ids = list(
        WatchlistItem.objects.values_list('group__user_id', flat=True)
        .distinct()[:batch_size]
    )

    for uid in user_ids:
        try:
            user = _User.objects.select_related('userconfig').get(pk=uid)
            result = _generate_news_digest_for_user(user)
            if result.get('ok'):
                results['ok'] += 1
            elif result.get('skipped'):
                results['skipped'] += 1
            else:
                results['error'] += 1
        except Exception as exc:
            logger.warning('sprint35: digest failed for user_id=%s: %s', uid, exc)
            results['error'] += 1

    logger.info('event=sprint35_digest_done ok=%s skipped=%s error=%s', results['ok'], results['skipped'], results['error'])
    return {'status': 'ok', 'batch_size': batch_size, **results}
