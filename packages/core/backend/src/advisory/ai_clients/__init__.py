"""
R2.2: registry + factory client theo provider.

Thêm provider mới = thêm 1 module trong package này + 1 dòng _PROVIDERS (AC6) —
KHÔNG sửa orchestrator. Provider chưa có client => FactoryError loud (AC4),
không rơi im lặng về OpenAI.
"""
from advisory.ai_clients.anthropic import AnthropicClient
from advisory.ai_clients.base import AiClient, FactoryError, ProviderHTTPError, parse_usage_dict
from advisory.ai_clients.copilot import CopilotClient
from advisory.ai_clients.openclaw import OpenClawClient
from advisory.ai_clients.openai_compat import (
    GEMINI_BASE_URL,
    LOCAL_BASE_URL,
    OPENAI_BASE_URL,
    OpenAICompatClient,
    _base_url_for,
    _resolve_chat_endpoint,
)

_PROVIDERS: dict = {
    # provider -> (module, class, defaults). Module/class để AC6 test được
    # "thêm provider = thêm file" (importlib theo tên module).
    'openai': (
        'advisory.ai_clients.openai_compat',
        'OpenAICompatClient',
        {'base_url': OPENAI_BASE_URL, 'provider_kind': 'openai', 'json_mode': True},
    ),
    'gemini': (
        'advisory.ai_clients.openai_compat',
        'OpenAICompatClient',
        {'base_url': GEMINI_BASE_URL, 'provider_kind': 'gemini', 'json_mode': True},
    ),
    'local': (
        'advisory.ai_clients.openai_compat',
        'OpenAICompatClient',
        {'base_url': LOCAL_BASE_URL, 'provider_kind': 'local', 'json_mode': False},
    ),
    # R2.4: Copilot - KHONG phai OpenAI-compatible voi key cua user.
    # `self_endpoint`: endpoint lay tu token response (`endpoints.api`) nen
    # KHONG resolve theo bang OpenAI/Gemini.
    'copilot': (
        'advisory.ai_clients.copilot',
        'CopilotClient',
        {'self_endpoint': True},
    ),
    # R2.3: Anthropic KHONG phai OpenAI-compatible (x-api-key, /v1/messages).
    # `self_endpoint` giong copilot: endpoint do adapter lo, khong resolve bang
    # bang OpenAI/Gemini. Mac dinh TAT (AI_ENABLE_ANTHROPIC) — fail-closed.
'claude': (
        'advisory.ai_clients.anthropic',
        'AnthropicClient',
        {'self_endpoint': True},
    ),
    # R2.5: openclaw - FAIL-CLOSED. D-03c chua co protocol => khong doan.
    # Client ton tai de loi sai/noi ro ra, khong phai de gia lap goi dịch vu.
    'openclaw': (
        'advisory.ai_clients.openclaw',
        'OpenClawClient',
        {'self_endpoint': True},
    ),
}


def _load_client_class(provider: str):
    import importlib

    entry = _PROVIDERS.get((provider or '').strip().lower())
    if entry is None:
        raise FactoryError(
            f"Provider '{provider}' chua co client (chua cau hinh/khong ho tro). "
            f"Hien co: {sorted(_PROVIDERS)}. Khong tu roi ve OpenAI."
        )
    module_name, class_name, _defaults = entry
    module = importlib.import_module(module_name)
    cls = getattr(module, class_name, None)
    if cls is None:
        raise FactoryError(f"Client '{class_name}' khong ton tai trong {module_name}.")
    return cls, entry[2]


def get_ai_client(
    provider: str,
    *,
    api_key: str = "",
    custom_endpoint: str = "",
    ai_model: str = "",
    timeout: float = 30.0,
) -> AiClient:
    """Factory duy nhất orchestrator dùng (R2.2 AC3: không còn `if provider ==`)."""
    normalized = (provider or '').strip().lower()
    cls, defaults = _load_client_class(normalized)
    if defaults.get('self_endpoint'):
        # Provider tu lo endpoint (copilot: tu token response). Khong resolve
        # theo bang OpenAI/Gemini - se goi sai host.
        endpoint = ''
        base_url = ''
    else:
        endpoint = _resolve_chat_endpoint(normalized, custom_endpoint or '', ai_model or '')
        base_url = _base_url_for(normalized, custom_endpoint or '', ai_model or '')
    extra = {k: v for k, v in defaults.items() if k not in ('base_url', 'self_endpoint')}
    return cls(
        api_key=api_key or "",
        base_url=base_url,
        endpoint=endpoint,
        timeout=timeout,
        model=ai_model or "",
        **extra,
    )


__all__ = [
    'AiClient',
    'AnthropicClient',
    'CopilotClient',
    'FactoryError',
    'OpenAICompatClient',
    'OpenClawClient',
    'ProviderHTTPError',
    '_resolve_chat_endpoint',
    'get_ai_client',
    'parse_usage_dict',
]
