from __future__ import annotations

import logging

logger = logging.getLogger(__name__)


def _fetch_news_context_for_advisory(symbol: str, max_items: int = 4) -> str:
    """
    Đọc tin tức gần đây từ cache Redis hoặc vnstock.
    Trả về chuỗi rỗng nếu không có dữ liệu hoặc lỗi.
    """
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
                logger.debug('_fetch_news_context_for_advisory: vnstock error for %s: %s', symbol, exc)
                items = []
        else:
            raw_items = cached.get('items', []) if isinstance(cached, dict) else []
            items = [
                {
                    'title': str(row.get('title') or '').strip(),
                    'source': str(row.get('source') or '').strip(),
                    'date': str(row.get('published_at') or '')[:10],
                }
                for row in raw_items
                if str(row.get('title') or '').strip()
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
        logger.debug('_fetch_news_context_for_advisory: unexpected error for %s: %s', symbol, exc)
        return ''
