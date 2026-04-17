import os

from django.conf import settings
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import PortfolioNewsDigest, UserConfig


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def stock_news_api(request, symbol: str):
    """
    GET /api/stock-management/stocks/<symbol>/news/
    Sprint34 Layer 1: Trả về danh sách tin tức gần đây theo mã từ vnstock.
    Cache Redis 30 phút. Graceful degradation khi vnstock không khả dụng.
        Hỗ trợ manual refresh:
            - GET .../news/?force=1
            - POST .../news/
    """
    from .adapters.cache_adapter import get_cache, set_cache

    normalized_symbol = str(symbol or '').strip().upper()
    if not normalized_symbol or len(normalized_symbol) > 10:
        return Response({'detail': 'Mã chứng khoán không hợp lệ.'}, status=status.HTTP_400_BAD_REQUEST)

    force_refresh = request.method == 'POST' or str(request.query_params.get('force', '')).strip().lower() in {'1', 'true', 'yes'}

    cache_key = f'stock:news:{normalized_symbol}'
    if not force_refresh:
        cached = get_cache(cache_key)
        if cached is not None:
            cached['cached'] = True
            return Response(cached)

    rss_sources_raw = str(
        getattr(settings, 'VNSTOCK_RSS_NEWS_SOURCES', os.getenv('VNSTOCK_RSS_NEWS_SOURCES', 'rss_cafef,rss_vneconomy'))
        or 'rss_cafef,rss_vneconomy'
    )
    rss_sources = [src.strip() for src in rss_sources_raw.split(',') if src.strip()]
    if not rss_sources:
        rss_sources = ['rss_cafef', 'rss_vneconomy']

    def _fix_mojibake(text: str) -> str:
        value = str(text or '').strip()
        if not value:
            return value
        if 'Ã' not in value and 'áº' not in value and 'Ä' not in value:
            return value
        try:
            repaired = value.encode('latin1', errors='ignore').decode('utf-8', errors='ignore').strip()
            return repaired or value
        except Exception:
            return value

    def _fetch_news_with_fallback(limit: int = 20):
        import pandas as _pd
        from vnstock.api.news import News

        collected = []
        seen = set()
        last_exc = None

        for source in rss_sources:
            try:
                news_client = News(source=source)
            except Exception as exc:
                last_exc = exc
                continue

            df = None
            try:
                df = news_client.by_symbol(normalized_symbol, limit=max(limit * 2, 20))
            except Exception as exc:
                last_exc = exc

            if df is None or (hasattr(df, 'empty') and df.empty):
                try:
                    latest_df = news_client.latest(limit=60)
                    if latest_df is not None and not latest_df.empty:
                        if 'symbol' in latest_df.columns:
                            symbol_filtered = latest_df[latest_df['symbol'].astype(str).str.upper() == normalized_symbol]
                        else:
                            symbol_filtered = latest_df[latest_df.get('title', _pd.Series(dtype='str')).astype(str).str.upper().str.contains(normalized_symbol)]
                        df = symbol_filtered
                except Exception as exc:
                    last_exc = exc
                    df = None

            if df is None or (hasattr(df, 'empty') and df.empty):
                continue

            rows = df.to_dict(orient='records') if hasattr(df, 'to_dict') else []
            for row in rows:
                title = _fix_mojibake(str(row.get('title') or row.get('headline') or '').strip())
                if not title:
                    continue
                url = str(row.get('url') or row.get('link') or '').strip()
                if url and not url.startswith(('http://', 'https://')):
                    url = ''
                source_name = _fix_mojibake(str(row.get('source') or source).strip())
                raw_date = row.get('published_at') or row.get('published_date') or row.get('date') or ''
                try:
                    published_at = str(_pd.Timestamp(raw_date).isoformat()) if raw_date else None
                except Exception:
                    published_at = str(raw_date) if raw_date else None

                dedup_key = (title.lower(), (url or '').lower())
                if dedup_key in seen:
                    continue
                seen.add(dedup_key)

                collected.append(
                    {
                        'title': title,
                        'url': url or None,
                        'source': source_name or source,
                        'published_at': published_at,
                    }
                )
                if len(collected) >= limit:
                    return collected

        if collected:
            return collected
        if last_exc:
            raise last_exc
        return []

    items = []
    unavailable = False
    try:
        items = _fetch_news_with_fallback(limit=20)
    except Exception:
        from . import views as legacy_views

        legacy_views.logger.warning('stock_news_api: không lấy được tin tức cho %s', normalized_symbol)
        unavailable = True

    def _fetch_rss_fallback(news_symbol: str, limit: int = 12):
        import datetime
        import email.utils
        import urllib.parse
        import urllib.request
        import xml.etree.ElementTree as ET

        keyword = urllib.parse.quote_plus(f'{news_symbol} chứng khoán')
        rss_urls = [
            f'https://news.google.com/rss/search?q={keyword}&hl=vi&gl=VN&ceid=VN:vi',
            f'https://news.google.com/rss/search?q={keyword}&hl=en-US&gl=US&ceid=US:en',
        ]

        normalized_items = []
        seen = set()
        for rss_url in rss_urls:
            try:
                with urllib.request.urlopen(rss_url, timeout=8) as response:
                    payload = response.read()
                root = ET.fromstring(payload)
            except Exception:
                continue

            channel = root.find('channel')
            if channel is None:
                continue

            for item_node in channel.findall('item'):
                title = (item_node.findtext('title') or '').strip()
                if not title:
                    continue
                link = (item_node.findtext('link') or '').strip()
                if link and not link.startswith(('http://', 'https://')):
                    link = ''
                pub_date_raw = (item_node.findtext('pubDate') or '').strip()
                published_at = None
                if pub_date_raw:
                    try:
                        parsed_date = email.utils.parsedate_to_datetime(pub_date_raw)
                        if parsed_date is not None:
                            published_at = parsed_date.isoformat()
                    except Exception:
                        published_at = None

                dedup_key = (title.lower(), link.lower())
                if dedup_key in seen:
                    continue
                seen.add(dedup_key)

                normalized_items.append(
                    {
                        'title': title,
                        'url': link or None,
                        'source': 'google-news-rss',
                        'published_at': published_at or datetime.datetime.utcnow().isoformat(),
                    }
                )
                if len(normalized_items) >= limit:
                    return normalized_items

        return normalized_items

    if not items:
        try:
            rss_items = _fetch_rss_fallback(normalized_symbol, limit=12)
            if rss_items:
                items = rss_items
                unavailable = False
        except Exception as exc:
            from . import views as legacy_views

            legacy_views.logger.warning('stock_news_api: rss fallback failed for %s: %s', normalized_symbol, exc)

    result = {
        'symbol': normalized_symbol,
        'items': items,
        'fetched_at': timezone.now().isoformat(),
        'cached': False,
        'unavailable': unavailable,
    }
    if not unavailable:
        set_cache(cache_key, result, timeout=1800)
    return Response(result)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def stock_news_ai_summary_api(request, symbol: str):
    """
    POST /api/stock-management/stocks/<symbol>/news/ai-summary/
    Tạo bản tóm tắt AI dựa trên tin tức mới nhất của 1 mã cổ phiếu.
    Body options:
      - force_refresh: bool (bỏ cache tin tức khi true)
    """
    from .ai_options import ADVISORY_CAPABILITY, get_model_entry, is_valid_provider
    from .ai_service import generate_portfolio_digest
    from .adapters.cache_adapter import get_cache, set_cache

    normalized_symbol = str(symbol or '').strip().upper()
    if not normalized_symbol or len(normalized_symbol) > 10:
        return Response({'detail': 'Mã chứng khoán không hợp lệ.'}, status=status.HTTP_400_BAD_REQUEST)

    force_refresh = bool(request.data.get('force_refresh'))
    source_payload = None

    if not force_refresh:
        cached_news = get_cache(f'stock:news:{normalized_symbol}')
        if cached_news is not None:
            source_payload = dict(cached_news)
            source_payload['cached'] = True

    if source_payload is None:
        from django.test import RequestFactory
        from rest_framework.test import force_authenticate

        rf = RequestFactory()
        params = {'force': '1'} if force_refresh else {}
        internal_request = rf.get(f'/api/stock-management/stocks/{normalized_symbol}/news/', data=params)
        force_authenticate(internal_request, user=request.user)

        news_response = stock_news_api(internal_request, normalized_symbol)
        if news_response.status_code >= 400:
            return news_response
        source_payload = dict(news_response.data or {})

    if bool(source_payload.get('unavailable')):
        return Response(
            {
                'detail': 'Nguồn tin tức tạm thời không khả dụng. Vui lòng thử lại sau.',
                'reason': 'news_unavailable',
            },
            status=status.HTTP_409_CONFLICT,
        )

    items = source_payload.get('items') if isinstance(source_payload.get('items'), list) else []
    if not items:
        return Response(
            {
                'detail': 'Chưa có dữ liệu tin tức để AI tổng hợp.',
                'reason': 'empty_news',
            },
            status=status.HTTP_409_CONFLICT,
        )

    user_cfg, _ = UserConfig.objects.get_or_create(user=request.user)
    user_provider = str(user_cfg.ai_provider or '').strip().lower()
    user_model = str(user_cfg.get_effective_ai_model() or '').strip()
    user_api_key = str(user_cfg.get_ai_api_key() or '').strip()

    if not user_api_key:
        return Response(
            {
                'detail': 'Bạn chưa cấu hình AI API key cá nhân. Vui lòng vào UserConfig để thiết lập trước khi dùng AI News.',
                'reason': 'missing_user_ai_api_key',
                'username': request.user.username,
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    if not is_valid_provider(user_provider):
        return Response(
            {
                'detail': 'AI provider trong UserConfig không hợp lệ.',
                'reason': 'invalid_user_ai_provider',
                'username': request.user.username,
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    if not user_model:
        return Response(
            {
                'detail': 'AI model trong UserConfig đang để trống.',
                'reason': 'missing_user_ai_model',
                'username': request.user.username,
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    model_entry = get_model_entry(user_provider, user_model)
    if model_entry is not None and ADVISORY_CAPABILITY not in list(model_entry.get('capabilities') or []):
        return Response(
            {
                'detail': 'AI model trong UserConfig chưa được bật capability AI News.',
                'reason': 'user_ai_model_capability_blocked',
                'username': request.user.username,
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    lines = []
    for item in items[:10]:
        title = str(item.get('title') or '').strip()
        if not title:
            continue
        source = str(item.get('source') or 'unknown').strip()
        published_at = str(item.get('published_at') or '').strip()
        lines.append(f"- {title} ({source}{', ' + published_at if published_at else ''})")

    if not lines:
        return Response(
            {
                'detail': 'Không đủ dữ liệu headline hợp lệ để AI tổng hợp.',
                'reason': 'invalid_news_payload',
            },
            status=status.HTTP_409_CONFLICT,
        )

    news_context_by_symbol = {
        normalized_symbol: f"[{normalized_symbol}]\n" + "\n".join(lines),
    }

    ai_cache_key = f'stock:news:ai-summary:{normalized_symbol}'
    if not force_refresh:
        ai_cached = get_cache(ai_cache_key)
        if ai_cached is not None:
            ai_cached['cached'] = True
            return Response(ai_cached)

    try:
        digest_payload = generate_portfolio_digest(
            provider=user_provider,
            model=user_model,
            api_key=user_api_key,
            symbols=[normalized_symbol],
            news_context_by_symbol=news_context_by_symbol,
            user=request.user,
        )
    except Exception as exc:
        from . import views as legacy_views

        legacy_views.logger.exception('stock_news_ai_summary_api failed for %s: %s', normalized_symbol, exc)
        import httpx

        if isinstance(exc, (httpx.ReadTimeout, httpx.ConnectTimeout, TimeoutError)):
            return Response(
                {
                    'detail': 'AI provider phản hồi quá chậm (timeout). Vui lòng thử lại sau 1-2 phút.',
                    'reason': 'ai_provider_timeout',
                    'username': request.user.username,
                },
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        return Response(
            {
                'detail': 'Không thể tạo AI News lúc này. Vui lòng thử lại sau.',
                'reason': 'ai_summary_generation_failed',
                'username': request.user.username,
            },
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )

    response_payload = {
        'symbol': normalized_symbol,
        'summary': str(digest_payload.get('summary') or '').strip(),
        'full': str(digest_payload.get('full') or '').strip(),
        'item_count': len(items),
        'ai_provider': user_provider,
        'ai_model': user_model,
        'generated_at': timezone.now().isoformat(),
        'news_fetched_at': source_payload.get('fetched_at'),
        'cached': False,
    }
    set_cache(ai_cache_key, response_payload, timeout=900)
    return Response(response_payload)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def portfolio_news_digest_api(request):
    """
    GET /api/stock-management/portfolio/news-digest/
    Sprint35 Layer 3: Trả về bản tóm tắt tin tức danh mục mới nhất của user.
    Query param: ?date=YYYY-MM-DD (tuỳ chọn, mặc định hôm nay)
    Fallback: nếu không có bản tin cho ngày yêu cầu, trả về bản tin gần nhất.
    """
    import datetime

    from django.utils import timezone as _tz

    today = _tz.localdate()
    date_str = request.query_params.get('date', '')
    if date_str:
        try:
            target_date = datetime.date.fromisoformat(date_str)
        except ValueError:
            return Response({'detail': 'Định dạng ngày không hợp lệ. Dùng YYYY-MM-DD.'}, status=400)
    else:
        target_date = today

    # Tìm bản tin đúng ngày yêu cầu trước
    qs = PortfolioNewsDigest.objects.filter(user=request.user)
    digest = qs.filter(date=target_date).order_by('-created_at').first()
    is_latest_fallback = False

    # Nếu không tìm được → fallback về bản tin gần nhất
    if digest is None:
        digest = qs.order_by('-date', '-created_at').first()
        if digest is not None:
            is_latest_fallback = (digest.date != target_date)

    if digest is None:
        return Response({
            'has_digest': False,
            'today': str(today),
            'requested_date': str(target_date),
            'message': 'Chưa có bản tóm tắt tin tức. Bản tin sẽ được tạo tự động sau 16:05 các ngày trong tuần.',
        })

    return Response({
        'has_digest': True,
        'is_latest_fallback': is_latest_fallback,
        'today': str(today),
        'requested_date': str(target_date),
        'id': digest.id,
        'date': str(digest.date),
        'symbols': digest.symbols,
        'digest_summary': digest.digest_summary,
        'digest_full': digest.digest_full,
        'item_count': digest.item_count,
        'ai_model': digest.ai_model,
        'created_at': digest.created_at.isoformat(),
    })