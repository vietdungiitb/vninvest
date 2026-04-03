"""
portfolio/openclaw_client.py
HTTP client gọi OpenClaw AI API để phân tích tín hiệu Whale Alert.
Settings đọc từ .env:
  OPENCLAW_API_KEY   — bắt buộc
  OPENCLAW_BASE_URL  — default: https://api.openclaw.ai/v1
  OPENCLAW_MODEL     — default: openclaw-finance-v1
"""
import logging

from django.conf import settings

logger = logging.getLogger(__name__)

_BASE_URL = lambda: getattr(settings, 'OPENCLAW_BASE_URL', 'https://api.openclaw.ai/v1')
_MODEL    = lambda: getattr(settings, 'OPENCLAW_MODEL', 'openclaw-finance-v1')
_API_KEY  = lambda: getattr(settings, 'OPENCLAW_API_KEY', '')

# Disclaimer bắt buộc đính kèm mọi response tránh vi phạm tư vấn tài chính
_DISCLAIMER = '[Thông tin tham khảo, không phải lời khuyên đầu tư tài chính.]'


def generate_whale_summary(symbol: str, matched_value_vnd: float, side: str) -> dict:
    """
    Tạo tóm tắt ~50 từ cho tier Pro.
    Returns: {text: str, prompt_tokens: int, completion_tokens: int}
    """
    prompt = (
        f"Phân tích ngắn gọn trong 50 từ về tín hiệu giao dịch tại TTCK Việt Nam: "
        f"lệnh {side} mã {symbol}, giá trị {matched_value_vnd / 1_000_000_000:.1f} tỷ VNĐ. "
        f"Nêu ngắn gọn: động lực có thể và mức độ chú ý. "
        f"{_DISCLAIMER}"
    )
    return _call(prompt, max_tokens=130)


def generate_whale_deep(symbol: str, matched_value_vnd: float, side: str) -> dict:
    """
    Tạo phân tích sâu ~200 từ cho tier Premium.
    Returns: {text: str, prompt_tokens: int, completion_tokens: int}
    """
    prompt = (
        f"Phân tích tín hiệu giao dịch sau tại TTCK Việt Nam trong khoảng 200 từ: "
        f"lệnh {side} mã {symbol}, tổng giá trị {matched_value_vnd / 1_000_000_000:.1f} tỷ VNĐ. "
        f"Bao gồm: (1) bối cảnh ngành/công ty, (2) động lực giao dịch có thể, "
        f"(3) mức rủi ro và cơ hội, (4) khuyến nghị theo dõi ngắn hạn. "
        f"{_DISCLAIMER}"
    )
    return _call(prompt, max_tokens=450)


def _call(prompt: str, max_tokens: int) -> dict:
    api_key = _API_KEY()
    if not api_key:
        logger.warning('OPENCLAW_API_KEY chưa được cấu hình — trả về placeholder.')
        return {
            'text': '[AI advisory không khả dụng: OPENCLAW_API_KEY chưa cấu hình.]',
            'prompt_tokens': 0,
            'completion_tokens': 0,
        }

    try:
        import httpx
    except ImportError as exc:
        logger.error('Thiếu dependency httpx cho OpenClaw client: %s', exc)
        raise RuntimeError('Thiếu dependency httpx cho OpenClaw client.') from exc

    headers = {
        'Authorization': f'Bearer {api_key}',
        'Content-Type': 'application/json',
    }
    payload = {
        'model': _MODEL(),
        'messages': [{'role': 'user', 'content': prompt}],
        'max_tokens': max_tokens,
        'temperature': 0.3,  # thấp để ổn định, ít hallucinate
    }

    resp = httpx.post(
        f'{_BASE_URL()}/chat/completions',
        json=payload,
        headers=headers,
        timeout=30.0,
    )
    resp.raise_for_status()
    data = resp.json()

    return {
        'text': data['choices'][0]['message']['content'].strip(),
        'prompt_tokens': data.get('usage', {}).get('prompt_tokens', 0),
        'completion_tokens': data.get('usage', {}).get('completion_tokens', 0),
    }
