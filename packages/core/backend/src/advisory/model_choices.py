"""Validate model theo provider — chặn cấu hình tự mâu thuẫn.

Bằng chứng gốc (2026-09-25, DB dev): `effective_ai_context` có
`ai_provider=gemini` nhưng `ai_model=gpt-4o-mini`; orchestrator chọn endpoint
OpenAI-compat của Google rồi gửi tên model OpenAI → HTTP 404 →
`error_message="synthesis provider_status=404"`. Nguyên nhân gốc nằm ở chỗ
`UserAICredential.ai_model` nhận bất kỳ chuỗi nào mà không kiểm tra provider.

Module này là SSOT cho quan hệ provider -> model hợp lệ.
"""

OPENAI_PREFIXES = ('gpt-', 'gpt3', 'gpt4', 'o1', 'o3', 'o4', 'chatgpt-')
GEMINI_PREFIXES = ('gemini',)
CLAUDE_PREFIXES = ('claude',)
# openclaw/copilot/local: model do hạ tầng quyết định -> không ràng buộc.
FREEFORM_PROVIDERS = ('local', 'openclaw', 'copilot')

PROVIDER_MODEL_PREFIXES = {
    'openai': OPENAI_PREFIXES,
    'gemini': GEMINI_PREFIXES,
    'claude': CLAUDE_PREFIXES,
}

#: model mặc định gợi ý cho từng provider (chọn model rẻ nhưng đủ tốt).
#: Giá trị đã được probe thật 2026-09-26:
#:   gemini-2.5-flash -> HTTP 200
#:   gemini-3.8-flash -> HTTP 200
#:   gemini-pro / gemini-1.5-flash / gemini-1.5-pro / gemini-2.0-flash /
#:   gemini-2.5-pro  -> HTTP 404 (đã bị gỡ khỏi `SystemAISettings.ModelChoices`)
#: Model OpenAI/Claude không đổi vì không có key để verify trong dev.
DEFAULT_MODEL_BY_PROVIDER = {
    'openai': 'gpt-4o-mini',
    'gemini': 'gemini-2.5-flash',
    'claude': 'claude-sonnet-4',
}

PROVIDER_LABELS = {
    'openai': 'OpenAI',
    'gemini': 'Google Gemini',
    'claude': 'Anthropic Claude',
    'local': 'Local',
    'openclaw': 'OpenClaw',
    'copilot': 'GitHub Copilot',
}


def model_matches_provider(provider, model):
    """True nếu `model` hợp lệ với `provider` (hoặc provider không ràng buộc)."""
    provider_key = str(provider or '').strip().lower()
    model_key = str(model or '').strip().lower()

    if provider_key in FREEFORM_PROVIDERS:
        return True
    if not model_key:
        return True
    if model_key == 'custom':
        return True

    prefixes = PROVIDER_MODEL_PREFIXES.get(provider_key)
    if not prefixes:
        return True
    return model_key.startswith(tuple(prefixes))


def validate_model_for_provider(provider, model):
    """Trả về (is_valid, error_message).

    Rỗng model được phép: khi đó hệ thống fallback về model của
    SystemAISettings và việc chọn model diễn ra ở tầng cấu hình hệ thống.
    """
    provider_key = str(provider or '').strip().lower()
    model_key = str(model or '').strip().lower()

    if not model_key:
        return True, None
    if model_matches_provider(provider_key, model_key):
        return True, None

    expected = PROVIDER_MODEL_PREFIXES.get(provider_key, ())
    label = PROVIDER_LABELS.get(provider_key, provider_key or 'không rõ')
    return False, (
        "Model '{model}' không tương thích với nhà cung cấp {label}. "
        "Model của {label} phải bắt đầu bằng: {expected}."
    ).format(
        model=model_key,
        label=label,
        expected=', '.join(expected),
    )


def suggest_model_for_provider(provider):
    """Gợi ý model hợp lệ cho provider (dùng cho thông báo UI).

    Trả về map tường minh theo provider, KHÔNG dựa vào thứ tự key của
    `MODEL_PROVIDER` — thứ tự dict không đảm bảo được và dễ đổi ngẫu nhiên
    khi ai đó thêm model mới.
    """
    provider_key = str(provider or '').strip().lower()
    return DEFAULT_MODEL_BY_PROVIDER.get(provider_key, '')
