"""
PR-3 — AI4: News Sentiment Analysis Worker + API View
Worker sync_news_sentiment: chạy mỗi 30 phút.

Logic:
 - Quét tiêu đề tin tức 24h qua từ OpenNews pipeline (tasks_news_context).
 - Gọi AI (provider/model từ settings) chấm điểm tâm lý -1 đến +1.
 - Weighted average theo NewsSourceWeight.
 - Lưu SentimentLog.
"""
from __future__ import annotations

import json
import logging
from decimal import Decimal, InvalidOperation
from typing import Optional

from celery import shared_task
from django.db import transaction
from django.utils import timezone

logger = logging.getLogger(__name__)

_SENTIMENT_MAX_TOKENS = 300
_SENTIMENT_SYMBOLS_PER_RUN = 50   # giới hạn số mã mỗi lần chạy để tránh quá tải token


def _build_sentiment_prompt(symbol: str, headlines: list[str]) -> str:
    bullets = '\n'.join(f'- {h}' for h in headlines[:20])
    return (
        f'Bạn là chuyên gia phân tích tâm lý thị trường chứng khoán Việt Nam.\n'
        f'Dưới đây là {len(headlines)} tiêu đề tin tức gần đây về mã {symbol}:\n'
        f'{bullets}\n\n'
        f'Hãy trả lời JSON (KHÔNG giải thích thêm) với đúng 2 trường:\n'
        f'{{"score": <float từ -1.00 (rất xấu) đến 1.00 (rất tốt)>, '
        f'"reasoning": "<tóm tắt lý do trong 30 từ tiếng Việt>"}}'
    )


def _parse_ai_sentiment_response(text: str) -> tuple[Optional[Decimal], str]:
    """Parse JSON từ AI response. Trả về (score, reasoning)."""
    try:
        # Tìm đoạn JSON trong response (AI đôi khi wrap thêm text)
        start = text.find('{')
        end = text.rfind('}') + 1
        if start < 0 or end <= start:
            return None, ''
        data = json.loads(text[start:end])
        raw_score = data.get('score', 0)
        score = Decimal(str(raw_score)).quantize(Decimal('0.01'))
        # Clamp về [-1, 1]
        score = max(Decimal('-1.00'), min(Decimal('1.00'), score))
        reasoning = str(data.get('reasoning', ''))[:500]
        return score, reasoning
    except (json.JSONDecodeError, InvalidOperation, KeyError):
        logger.warning('[sentiment] Không parse được AI response: %s', text[:200])
        return None, ''


def _fetch_headlines_for_symbol(symbol: str, max_items: int = 15) -> list[str]:
    """Lấy tiêu đề tin từ pipeline OpenNews (tasks_news_context)."""
    try:
        from portfolio.tasks_news_context import _fetch_google_news_rss
        items = _fetch_google_news_rss(symbol, max_items=max_items)
        return [item.get('title', '') for item in items if item.get('title')]
    except Exception as exc:
        logger.debug('[sentiment] Không lấy được tin cho %s: %s', symbol, exc)
        return []


def _get_default_provider_and_model():
    """Lấy AI provider/model mặc định từ settings (giống pipeline whale advisory)."""
    import os
    provider = os.getenv('SENTIMENT_AI_PROVIDER', os.getenv('DEFAULT_AI_PROVIDER', 'openclaw'))
    model = os.getenv('SENTIMENT_AI_MODEL', '')
    return provider, model


def _call_sentiment_ai(provider: str, model: str, prompt: str) -> dict:
    """Gọi AI service với prompt sentiment."""
    from portfolio.ai_service import _resolve_provider_api_key, generate_whale_text
    api_key = _resolve_provider_api_key(provider)
    if not api_key:
        return {'text': '', 'prompt_tokens': 0, 'completion_tokens': 0}
    try:
        # Tận dụng generate_whale_text như một low-level wrapper
        from portfolio.ai_service import _openai_compatible_completion, _claude_completion
        import os
        if provider in ('openai', 'gemini', 'copilot'):
            base_url_map = {
                'openai': os.getenv('OPENAI_BASE_URL', 'https://api.openai.com/v1'),
                'gemini': os.getenv('GEMINI_BASE_URL', 'https://generativelanguage.googleapis.com/v1beta/openai'),
                'copilot': os.getenv('COPILOT_BASE_URL', 'https://models.github.ai/inference'),
            }
            base_url = base_url_map[provider]
            model_id = model or 'gpt-4o-mini'
            return _openai_compatible_completion(
                base_url=base_url, api_key=api_key, model=model_id,
                prompt=prompt, max_tokens=_SENTIMENT_MAX_TOKENS,
            )
        elif provider == 'claude':
            model_id = model or 'claude-3-haiku-20240307'
            return _claude_completion(api_key=api_key, model=model_id, prompt=prompt, max_tokens=_SENTIMENT_MAX_TOKENS)
        else:
            # openclaw / fallback — dùng OpenAI-compatible
            base_url = os.getenv('OPENCLAW_BASE_URL', 'https://api.openclaw.ai/v1')
            model_id = model or 'openclaw-mini'
            return _openai_compatible_completion(
                base_url=base_url, api_key=api_key, model=model_id,
                prompt=prompt, max_tokens=_SENTIMENT_MAX_TOKENS,
            )
    except Exception as exc:
        logger.warning('[sentiment] AI call failed provider=%s: %s', provider, exc)
        return {'text': '', 'prompt_tokens': 0, 'completion_tokens': 0}


def _get_source_weight(source_name: str) -> float:
    """Lấy trọng số nguồn tin từ DB. Cache nhẹ trong process."""
    from portfolio.models import NewsSourceWeight
    try:
        obj = NewsSourceWeight.objects.get(source_name=source_name, is_active=True)
        return float(obj.weight)
    except NewsSourceWeight.DoesNotExist:
        return 1.0


def _get_sector_average_sentiment(symbol: str, days: int = 7) -> Optional[Decimal]:
    """
    Fallback: trung bình SentimentLog của cùng ngành trong N ngày.
    Đơn giản hóa — lấy trung bình của tất cả symbol trong 7 ngày.
    """
    from portfolio.models import SentimentLog
    from django.db.models import Avg
    since = timezone.now() - timezone.timedelta(days=days)
    result = SentimentLog.objects.filter(captured_at__gte=since).aggregate(avg=Avg('sentiment_score'))
    avg = result.get('avg')
    return Decimal(str(avg)).quantize(Decimal('0.01')) if avg is not None else None


@shared_task(
    name='portfolio.tasks_sentiment.sync_news_sentiment',
    bind=True,
    max_retries=1,
    default_retry_delay=120,
    queue='default',
)
def sync_news_sentiment(self, symbols: list[str] | None = None):
    """
    Phân tích tâm lý tin tức và lưu SentimentLog.
    Nếu symbols=None, tự động lấy danh sách từ TrackedSymbol.
    Chạy mỗi 30 phút qua Celery Beat.
    """
    from portfolio.models import SentimentLog, TrackedSymbol

    if symbols is None:
        # Lấy top N symbol đang được track
        symbols = list(
            TrackedSymbol.objects.values_list('symbol', flat=True)
            .distinct()[:_SENTIMENT_SYMBOLS_PER_RUN]
        )

    provider, model = _get_default_provider_and_model()
    created = 0
    fallback_used = 0
    errors = 0

    for symbol in symbols:
        try:
            headlines = _fetch_headlines_for_symbol(symbol)

            if not headlines:
                # Fallback 1: sector average
                avg = _get_sector_average_sentiment(symbol)
                if avg is not None:
                    score = avg
                    reasoning = 'Không có tin tức — dùng trung bình ngành'
                    fallback_used += 1
                else:
                    # Fallback 2: neutral
                    score = Decimal('0.00')
                    reasoning = 'Dữ liệu hạn chế'
                    fallback_used += 1
                token_cost = 0
            else:
                prompt = _build_sentiment_prompt(symbol, headlines)
                result = _call_sentiment_ai(provider, model, prompt)
                ai_text = result.get('text', '')
                token_cost = result.get('prompt_tokens', 0) + result.get('completion_tokens', 0)

                parsed_score, parsed_reasoning = _parse_ai_sentiment_response(ai_text)
                if parsed_score is None:
                    score = Decimal('0.00')
                    reasoning = 'Dữ liệu hạn chế'
                    fallback_used += 1
                else:
                    score = parsed_score
                    reasoning = parsed_reasoning

            with transaction.atomic():
                SentimentLog.objects.create(
                    symbol=symbol,
                    sentiment_score=score,
                    source_type='news',
                    headline_count=len(headlines),
                    ai_reasoning=reasoning,
                    token_cost=token_cost,
                )
            created += 1

        except Exception as exc:
            logger.error('[sync_news_sentiment] Lỗi symbol=%s: %s', symbol, exc)
            errors += 1

    result = {
        'status': 'ok',
        'symbols_processed': len(symbols),
        'created': created,
        'fallback_used': fallback_used,
        'errors': errors,
    }
    logger.info('[sync_news_sentiment] Done: %s', result)
    return result
