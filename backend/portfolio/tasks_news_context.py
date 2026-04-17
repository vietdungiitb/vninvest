from __future__ import annotations

import logging

logger = logging.getLogger(__name__)


def _fetch_google_news_rss(symbol: str, max_items: int = 8) -> list:
    """
    Fetch tin tức nhẹ qua Google News RSS — không phụ thuộc vnstock.
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
      2. Google News RSS (HTTP thuần, không phụ thuộc vnstock/VCI)
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

        # Ưu tiên 2: Google News RSS nếu cache trống
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
