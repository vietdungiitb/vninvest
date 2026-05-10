from __future__ import annotations

import logging

logger = logging.getLogger(__name__)


def _fetch_google_news_rss(symbol: str, max_items: int = 8) -> list:
    """
    Fetch tin tức nhẹ qua Google News RSS — không phụ thuộc vnbroker.
    Trả về list dict với keys: title, source, date.
    """
    import email.utils
    import urllib.parse
    import urllib.request
    import xml.etree.ElementTree as ET

    keyword = urllib.parse.quote_plus(f'{symbol} chứng khoán')
    rss_url = f'https://news.google.com/rss/search?q={keyword}&hl=vi&gl=VN&ceid=VN:vi'

    try:
        with urllib.request.urlopen(rss_url, timeout=8) as response:
            payload = response.read()
        root = ET.fromstring(payload)
    except Exception as exc:
        logger.debug('_fetch_google_news_rss: failed for %s: %s', symbol, exc)
        return []

    channel = root.find('channel')
    if channel is None:
        return []

    items = []
    seen: set = set()
    for item_node in channel.findall('item'):
        title = (item_node.findtext('title') or '').strip()
        if not title:
            continue
        pub_date_raw = (item_node.findtext('pubDate') or '').strip()
        date_str = ''
        if pub_date_raw:
            try:
                parsed = email.utils.parsedate_to_datetime(pub_date_raw)
                date_str = str(parsed.date())
            except Exception:
                pass
        dedup_key = title.lower()
        if dedup_key in seen:
            continue
        seen.add(dedup_key)
        items.append({'title': title, 'source': 'google-news-rss', 'date': date_str})
        if len(items) >= max_items:
            break
    return items


def _fetch_news_context_for_advisory(symbol: str, max_items: int = 4) -> str:
    """
    Lấy tin tức gần đây cho mã cổ phiếu. Ưu tiên theo thứ tự:
      1. Redis cache (được điền bởi stock_news_api khi user xem trang chi tiết)
      2. Google News RSS (HTTP thuần, không phụ thuộc vnbroker/VCI)
    Trả về chuỗi rỗng nếu không có dữ liệu hoặc lỗi.
    """
    try:
        from django.core.cache import cache as _cache

        # Ưu tiên 1: Đọc từ Redis cache (key được điền bởi stock_news_api)
        cache_key = f'stock:news:{symbol}'
        cached = _cache.get(cache_key)
        items = None

        if cached is not None:
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

        # Ưu tiên 2: vnbroker dùng source từ vnbroker-config (KBS/VCI/TCBS/SSI theo cài đặt hệ thống)
        if not items:
            try:
                from portfolio.adapters.vnbroker_adapter import _build_stock_client, _run_with_timeout
                from portfolio.vnbroker_runtime_config import get_vnbroker_runtime_settings

                runtime = get_vnbroker_runtime_settings()
                sources_to_try = runtime.get('fallback_sources') or [runtime.get('price_board_source', 'KBS')]

                import pandas as _pd

                for source in sources_to_try:
                    try:
                        def _fetch(src=source):
                            stock_client = _build_stock_client(symbol=symbol, source=src)
                            return stock_client.company.news()

                        raw = _run_with_timeout(_fetch, timeout=6)
                        if raw is not None and not (hasattr(raw, 'empty') and raw.empty):
                            rows = raw.to_dict(orient='records') if hasattr(raw, 'to_dict') else (raw if isinstance(raw, list) else [])
                            parsed = []
                            for row in rows[:max_items]:
                                title = str(row.get('title') or row.get('subject') or row.get('headline') or '').strip()
                                source_name = str(row.get('source') or row.get('publisher') or source).strip()
                                raw_date = row.get('published_date') or row.get('publishedDate') or row.get('date') or ''
                                try:
                                    date_str = str(_pd.Timestamp(raw_date).date()) if raw_date else ''
                                except Exception:
                                    date_str = str(raw_date)[:10] if raw_date else ''
                                if title:
                                    parsed.append({'title': title, 'source': source_name, 'date': date_str})
                            if parsed:
                                items = parsed
                                break
                    except Exception as exc:
                        logger.debug('_fetch_news_context_for_advisory: vnbroker %s failed for %s: %s', source, symbol, exc)
            except Exception as exc:
                logger.debug('_fetch_news_context_for_advisory: vnbroker unavailable for %s: %s', symbol, exc)

        # Ưu tiên 3: Google News RSS (fallback cuối, không phụ thuộc vnbroker)
        if not items:
            items = _fetch_google_news_rss(symbol, max_items=max_items * 2)

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
