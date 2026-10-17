import logging
import json
import asyncio
from django.conf import settings
from market_serving.models import SymbolSnapshot, SessionFacts
from .advisory_helpers import (
    _parse_prompt_config,
    build_ohlcv_lookback_context,
    build_cvd_lookback_context
)
from .signal_norm import (
    SIGNAL_UNKNOWN,
    normalize_confidence,
    normalize_risk_level,
    normalize_signal,
)
# R2.2: client theo provider qua factory — orchestrator không còn nhánh
# `if provider ==`. `_resolve_chat_endpoint` re-export từ adapter để test R0.6
# (`from advisory.orchestrator import _resolve_chat_endpoint`) không phải sửa.
from advisory.ai_clients.base import ProviderCircuitOpenError, ProviderHTTPError
from advisory.ai_clients import get_ai_client
from advisory.ai_clients.openai_compat import _resolve_chat_endpoint
# R3.1: trace helper import ở module level — `trace.py` chỉ import model **bên trong**
# hàm nên không gây vòng import ngược với `advisory.models`.
from advisory.trace import record_step_trace

logger = logging.getLogger(__name__)


# R0.10 — mã lỗi + thông điệp hành động cho người dùng, thay vì trả raw
# `synthesis provider_status=404` như trước.
PROVIDER_ERROR_CODES = {
    400: ('provider_bad_request', 'Yêu cầu tới nhà cung cấp AI bị từ chối. Kiểm tra lại cấu hình model.'),
    401: ('provider_auth_failed', 'API key AI không hợp lệ hoặc đã hết hạn. Vào Cài đặt AI để cập nhật.'),
    403: ('provider_auth_failed', 'API key AI không có quyền truy cập model đã chọn.'),
    404: ('provider_model_not_found', 'Nhà cung cấp AI không tìm thấy model đã chọn. Kiểm tra provider và model có khớp nhau không.'),
    429: ('provider_rate_limited', 'Nhà cung cấp AI đang giới hạn tốc độ. Thử lại sau ít phút.'),
    500: ('provider_unavailable', 'Dịch vụ AI gặp sự cố tạm thời. Thử lại sau.'),
    502: ('provider_unavailable', 'Dịch vụ AI không phản hồi đúng. Thử lại sau.'),
    503: ('provider_unavailable', 'Dịch vụ AI đang bảo trì. Thử lại sau.'),
    504: ('provider_timeout', 'Dịch vụ AI phản hồi quá chậm. Thử lại sau.'),
}

#: N2 — 429 có HAI nguyên nhân hoàn toàn khác nhau, trước đây bị gộp làm một:
#:
#: 1. `RESOURCE_EXHAUSTED` tạm thời (quá nhiều request/giây) -> chờ lành, retry
#:    được.
#: 2. HẾT HẠN MỨC tài khoản (`"exceeded your current quota, please check your
#:    plan and billing details"`) -> không có gì để retry, chờ bao lâu cũng vậy.
#:
#: Bằng chứng (2026-09-26, probe trực tiếp endpoint Google OpenAI-compat):
#: prompt 1 từ, `max_tokens=64`, 3 request giống hệt cách nhau 3s -> 429 cả 3,
#: không có header `Retry-After`. Gộp chung khiến thông điệp "thử lại sau ít phút"
#: khiến người dùng bấm lại vô hạn trong khi nguyên nhân thật là phải nạp tiền /
#: đổi hạn mức.
QUOTA_EXHAUSTED_CODE = 'provider_quota_exceeded'
QUOTA_EXHAUSTED_MESSAGE = (
    'Đã hết hạn mức sử dụng của nhà cung cấp AI. Cần kiểm tra gói/thanh toán '
    'hoặc nâng hạn mức rồi thử lại — chờ sẽ không tự hết.'
)

#: Các cụm từ provider hay dùng để báo HẾT HẠN MỨC. So khớp không phân biệt
#: hoa thường. Chỉ dùng cho HTTP 429.
_QUOTA_EXHAUSTED_MARKERS = (
    'exceeded your current quota',
    'quota exceeded',
    'billing details',
    'out of quota',
)


def _is_quota_exhausted(text: str) -> bool:
    """429 do hết hạn mức tài khoản, khác 429 do quá tốc độ tạm thời."""
    if not text:
        return False
    lowered = text.lower()
    return any(marker in lowered for marker in _QUOTA_EXHAUSTED_MARKERS)


def _retry_delay_seconds(response, attempt: int) -> float:
    """Backoff luỹ thừa, nhưng tôn trọng `Retry-After` nếu provider gửi kèm.

    Bằng chứng: Gemini KHÔNG gửi `Retry-After` cho 429 hết hạn mức (probe
    2026-09-26), nhưng provider khác có thể gửi. Khi có, đó là giá trị chính
    thức từ server — tôn trọng nó thay vì tự đoán.
    """
    header = None
    if response is not None:
        try:
            header = response.headers.get('Retry-After')
        except Exception:
            header = None
    if header:
        try:
            return max(0.0, min(float(str(header).strip()), 120.0))
        except (TypeError, ValueError):
            pass
    return PROVIDER_RETRY_BASE_SECONDS * (2 ** (attempt - 1))

#: Response tới nhưng nội dung không dùng được. Tách khỏi lỗi HTTP vì nguyên
#: nhân hoàn toàn khác: HTTP 200 + `finish_reason="length"` => JSON bị cắt cụt.
INVALID_RESPONSE_CODE = 'provider_invalid_response'
INVALID_RESPONSE_MESSAGE = (
    'AI trả về nội dung không đầy đủ nên không đọc được khuyến nghị. Thử làm mới lại.'
)
TRUNCATED_RESPONSE_CODE = 'provider_response_truncated'
TRUNCATED_RESPONSE_MESSAGE = (
    'AI trả về câu trả lời bị cắt cụt nên không đọc được khuyến nghị. Thử làm mới lại.'
)

SIGNAL_UNPARSEABLE_CODE = 'advisory_signal_unparseable'
SIGNAL_UNPARSEABLE_MESSAGE = (
    'Không đọc được khuyến nghị từ AI cho mã này. Thử làm mới lại.'
)

#: Số lần thử lại + backoff cho lỗi tạm thời của provider.
#: Bằng chứng (2026-09-26, probe trực tiếp endpoint Google OpenAI-compat):
#: một request nhỏ tuần tự trả 200, nhưng orchestrator gọi 3 sub-agent SONG
#: SONG thì cả 3 trả 503 ("high demand") và synthesis cũng 500 -> advisory fail
#: 100%. Không retry thì tính năng không dùng được trên Gemini.
PROVIDER_RETRY_ATTEMPTS = 3
PROVIDER_RETRY_BASE_SECONDS = 2.0

#: Chỉ retry lỗi thực sự tạm thời. 400/401/403/404 là lỗi cấu hình hoặc xác
#: thực — retry chỉ tốn thêm thời gian và quota.
RETRYABLE_STATUS_CODES = frozenset({408, 429, 500, 502, 503, 504})

#: Sàn token cho lời gọi SYNTHESIS.
#: Bằng chứng (2026-09-26, probe thật với gemini-2.5-flash): ở `max_tokens`
#: 800 response bị cắt ở 44 ký tự, 1000 bị cắt ở 62 ký tự — cả hai
#: `finish_reason="length"` và JSON hỏng. Chỉ ở 2000 mới parse được. Trước đây
#: code dùng thẳng `max_tokens` của người dùng (mặc định 1000) nên advisory
#: luôn fail với lỗi 500 gây hiểu lầm là provider hỏng.
SYNTHESIS_MAX_TOKENS_FLOOR = 2000


def _is_retryable_status(status) -> bool:
    if status is None:
        return False
    try:
        return int(status) in RETRYABLE_STATUS_CODES
    except (TypeError, ValueError):
        return False


class AdvisorySynthesisError(Exception):
    def __init__(self, provider_status: int, body_snippet: str, code=None, message=None):
        self.provider_status = provider_status
        self.body_snippet = (body_snippet or '')[:500]
        if code:
            self.error_code = code
            self.user_message = message or code
        else:
            self.error_code, self.user_message = PROVIDER_ERROR_CODES.get(
                int(provider_status or 0),
                ('provider_error', 'Dịch vụ AI không phản hồi như mong đợi. Thử lại sau.'),
            )
        # Không để chuỗi raw của provider lọt vào thông điệp hiển thị cho user.
        super().__init__(f'{self.error_code} provider_status={provider_status}')

    def public_payload(self):
        return {
            'error_code': self.error_code,
            'user_message': self.user_message,
            'provider_status': self.provider_status,
        }


def _resolve_chat_endpoint(provider: str, custom_endpoint: str, ai_model: str = '') -> str:
    """Re-export từ adapter (R2.2) — giữ đường import cũ cho test R0.6."""
    from advisory.ai_clients.openai_compat import _resolve_chat_endpoint as _impl

    return _impl(provider, custom_endpoint, ai_model)


def _extract_usage(usage) -> tuple:
    """Alias giữ tương thích (R0.7 test import từ đây). Canonical ở base."""
    from advisory.ai_clients.base import parse_usage_dict

    return parse_usage_dict(usage)


def _resolve_cost(provider: str, model: str, tokens_total: int, tokens_in=None, tokens_out=None) -> tuple:
    """Alias giu tuong thich. Canonical o `advisory.pricing.resolve_cost` (R2.7)."""
    from advisory.pricing import resolve_cost as _impl

    return _impl(provider, model, tokens_total, tokens_in=tokens_in, tokens_out=tokens_out)


def _coerce_float(raw):
    """Trả float hoặc None. Không bao giờ ném, không bao giờ bịa giá trị."""
    if raw is None or isinstance(raw, bool):
        return None
    if isinstance(raw, (int, float)):
        value = float(raw)
        return None if value != value else value
    if isinstance(raw, str):
        cleaned = raw.strip().replace(',', '.')
        if not cleaned:
            return None
        try:
            return float(cleaned)
        except (ValueError, TypeError):
            return None
    return None



def _resolve_routing(provider: str = '') -> dict:
    """R2.6: chọn deployment qua router; trả decision để ghi vào trace (AC5).

    - Không có deployment nào cấu hình ⇒ `{'chosen': None}` ⇒ giữ nguyên hành vi
      cũ (dùng provider/ai_model đã truyền vào). Không phải lỗi.
    - Có deployment nhưng không deployment nào khoẻ ⇒ raise
      `NoHealthyDeploymentError` (503 `no_healthy_deployment`) — AC6.
    """
    try:
        from advisory.models import AIDeployment
        from advisory.routing import routing_decision
    except Exception:  # pragma: no cover - import lỗi thì giữ hành vi cũ
        logger.exception('routing import failed; falling back to direct provider call')
        return {'chosen': None}

    deployments = list(AIDeployment.objects.all())
    if not deployments:
        return {'chosen': None}
    decision = routing_decision(deployments)
    chosen_name = decision['chosen']
    chosen = next((d for d in deployments if d.name == chosen_name), None)
    if chosen is None:  # pragma: no cover - routing luôn chọn từ trong danh sách
        return {'chosen': None}
    return {
        'chosen': chosen.name,
        'provider': chosen.provider,
        'model': chosen.model,
        'deployment': chosen,
        'decision': decision,
    }


def _resolve_retry_policy(deployment=None):
    """R2.9: policy retry theo deployment duoc route toi; thieu thi lay settings.

    Dong no nay la call site cho `RetryPolicy.from_deployment()` — truoc do ham co
    san + test nhung khong ai goi, nen knob tren `AIDeployment` vo dung.
    """
    from advisory.ai_clients.base import RetryPolicy

    try:
        return RetryPolicy.from_deployment(deployment)
    except Exception:
        logger.exception('resolve retry policy failed; using defaults')
        return RetryPolicy()


async def call_agent_async(
    ai_client,
    agent_name: str,
    system_prompt: str,
    user_prompt: str,
    ai_model: str,
    temperature: float,
    max_tokens: int,
    policy=None,
    trace_ctx=None,
    routing_decision=None,
) -> str:
    """Gọi 1 sub-agent qua AiClient — retry/backoff/breaker do CLIENT lo (R2.9).

    Vòng retry cũ ở đây đã chuyển xuống `AiClient.complete_resilient()`: 3 sub-agent
    `asyncio.gather` dùng chung một client nên retry/breaker **không nhân 3** (AC7).
    `policy` = `RetryPolicy` theo deployment được route tới (R2.10 nối
    `RetryPolicy.from_deployment`; `None` ⇒ policy mặc định từ settings).

    R3.1: đây là **funnel duy nhất** của cả 3 sub-agent ⇒ đúng một chỗ ghi trace.
    Lỗi bị nuốt (trả chuỗi thông báo) nhưng **vẫn** ghi `status='error'` (AC4).
    """
    import time as _trace_time

    _t0 = _trace_time.monotonic()
    try:
        result = await ai_client.complete_resilient(
            system_prompt, user_prompt,
            model=ai_model, temperature=temperature,
            max_tokens=max_tokens, timeout=25.0,
            policy=policy,
        )
        _text = (result.get('text') or '').strip()
        # Truyền nguyên `result` (dict) để `trace.py` lấy `text` **và** `usage`;
        # chỉ hash phần text, không đụng `raw` (chứa payload server trả về).
        record_step_trace(
            trace_ctx, agent_name,
            provider=getattr(ai_client, 'provider', '') or '',
            model=ai_model,
            prompt=f"{system_prompt}\n\n{user_prompt}",
            response=result,
            latency_ms=int((_trace_time.monotonic() - _t0) * 1000),
            status='ok', error_code='',
            routing_decision=routing_decision,
        )
        return _text
    except ProviderCircuitOpenError as _e:
        # R2.9 AC4: breaker mở => không gọi provider, không retry vô ích.
        logger.error('Circuit breaker mở cho sub-agent %s', agent_name)
        record_step_trace(
            trace_ctx, agent_name,
            provider=getattr(ai_client, 'provider', '') or '', model=ai_model,
            prompt=f"{system_prompt}\n\n{user_prompt}",
            latency_ms=int((_trace_time.monotonic() - _t0) * 1000),
            status='error', error_code='provider_circuit_open',
            routing_decision=routing_decision,
        )
        return (
            'Không thể phân tích từ %s do nhà cung cấp AI đang tạm ngưng '
            '(circuit mở). Thử lại sau ít phút.' % agent_name
        )
    except Exception as e:
        logger.error(f"LLM request failed for sub-agent {agent_name}: {e}")
        record_step_trace(
            trace_ctx, agent_name,
            provider=getattr(ai_client, 'provider', '') or '', model=ai_model,
            prompt=f"{system_prompt}\n\n{user_prompt}",
            latency_ms=int((_trace_time.monotonic() - _t0) * 1000),
            status='error', error_code=_error_code_of(e),
            routing_decision=routing_decision,
        )
        return (
            'Không thể phân tích từ %s do lỗi hệ thống: %s' % (agent_name, str(e))
        )


def _error_code_of(exc) -> str:
    """Mã lỗi ngắn cho trace. ProviderHTTPError đã có `status_code`; lỗi lạ thì theo class."""
    status = getattr(exc, 'status_code', None)
    if status:
        return f'provider_http_{status}'
    return exc.__class__.__name__[:64] or 'unknown_error'


class AdvisoryOrchestrator:
    @classmethod
    def run(cls, effective_context: dict, symbol: str, trace_ctx=None) -> dict:
        """
        Coordinates Technical, Flow, and Sentiment agents in parallel,
        incorporating historical lookback context and dynamic source routing configurations.

        `trace_ctx` (R3.1) là context `AITrace` do `advisory.tasks` dựng; `None` ⇒
        không ghi trace (đường gọi cũ) và **không** đổi hành vi.
        """
        symbol = symbol.strip().upper()
        # Parse and resolve prompt configuration
        prompt_config = _parse_prompt_config(effective_context.get('prompt_config'))
        sources = prompt_config["sources"]

        # Fetch latest price snapshot
        snapshot = SymbolSnapshot.objects.filter(symbol=symbol).order_by('-session_date').first()
        price = float(snapshot.price) if snapshot else 0.0
        price_change_pct = float(snapshot.price_change_pct) * 100 if snapshot else 0.0
        high_price = float(snapshot.high) if snapshot and snapshot.high else price
        low_price = float(snapshot.low) if snapshot and snapshot.low else price
        volume = int(snapshot.volume) if snapshot else 0

        # Fetch latest session flow facts
        facts = SessionFacts.objects.filter(symbol=symbol).order_by('-session_date').first()
        cvd = float(facts.cvd_normalized) if facts else 0.0
        buy_strength = float(facts.buy_strength) if facts else 0.0
        inst_strength = float(facts.institutional_strength) if facts else 0.0
        whale_flow = int(facts.whale_net_flow) if facts else 0

        # Build lookback contexts dynamically based on enabled flags
        ohlcv_context = ""
        if sources["technical"]["enabled"]:
            tech_lookback = sources["technical"]["lookback"]
            ohlcv_context = build_ohlcv_lookback_context(symbol, limit=tech_lookback)

        cvd_context = ""
        if sources["whale"]["enabled"] or sources["dark_flow"]["enabled"]:
            whale_lookback = max(sources["whale"]["lookback"], sources["dark_flow"]["lookback"])
            cvd_context = build_cvd_lookback_context(symbol, limit=whale_lookback)

        db_data = {
            "price": price,
            "price_change_pct": price_change_pct,
            "high_price": high_price,
            "low_price": low_price,
            "volume": volume,
            "cvd": cvd,
            "buy_strength": buy_strength,
            "inst_strength": inst_strength,
            "whale_flow": whale_flow,
            "ohlcv_context": ohlcv_context,
            "cvd_context": cvd_context,
        }

        # N2 — metric DETERMINISTIC lấy thẳng từ DB.
        #
        # Trước đây `matched_value` và `whale_intensity` được serializer đọc từ
        # `structured_output` nhưng KHÔNG module nào trong app `advisory` ghi
        # 2 key đó (grep toàn `advisory/`: chỉ có chỗ đọc). Kết quả: 2/4 metric
        # tiêu đề trên UI luôn hiện `—` — tính năng như hỏng dù không có lỗi
        # hiển thị nào. Ở đây tính thẳng từ nguồn thật:
        #   - `matched_value`  = giá tham chiếu đã dùng để phân tích
        #   - `whale_intensity`= `institutional_strength`, đúng như tiền lệ đã dùng
        #     ở `portfolio_analytics_views.py:1957`
        # Việc này cố ý KHÔNG nhờ LLM: số liệu phải tái lập được, không được
        # bịa bởi mô hình.
        reference_price = 0.0
        snapshot_is_stale = False
        if snapshot is not None:
            reference_price = float(snapshot.reference_price or snapshot.price or 0.0)
            snapshot_is_stale = bool(snapshot.stale)

        facts_is_stale = bool(facts.stale) if facts else False
        total_buy_volume = int(facts.total_buy_volume) if facts else None
        total_sell_volume = int(facts.total_sell_volume) if facts else None
        dark_flow_score = float(facts.dark_flow_score) if facts else None
        session_date = (
            facts.session_date if facts else (snapshot.session_date if snapshot else None)
        )

        metrics = {
            'matched_value': reference_price or None,
            'whale_intensity': round(inst_strength, 4) if facts else None,
            'price': price or None,
            'price_change_pct': round(price_change_pct, 2) or None,
            'reference_price': reference_price or None,
            'total_buy_volume': total_buy_volume,
            'total_sell_volume': total_sell_volume,
            'dark_flow_score': dark_flow_score,
        }

        # Input snapshot: đúng những con số đã đưa cho LLM, để người dùng
        # kiểm chứng được kết luận thay vì phải tin.
        input_snapshot = {
            'symbol': symbol,
            'session_date': session_date.isoformat() if session_date else None,
            'price': price or None,
            'price_change_pct': round(price_change_pct, 2) or None,
            'high': high_price or None,
            'low': low_price or None,
            'volume': volume or None,
            'cvd_normalized': round(cvd, 4) if facts else None,
            'buy_strength': round(buy_strength, 4) if facts else None,
            'institutional_strength': round(inst_strength, 4) if facts else None,
            'whale_net_flow': whale_flow or None,
            'total_buy_volume': total_buy_volume,
            'total_sell_volume': total_sell_volume,
            'dark_flow_score': dark_flow_score,
            'data_sources': {
                'snapshot_stale': snapshot_is_stale,
                'session_facts_stale': facts_is_stale,
                'has_snapshot': snapshot is not None,
                'has_session_facts': facts is not None,
            },
        }

        # Attribution: đóng góp của từng nhóm tín hiệu, cùng thang 0..1.
        feature_attribution = {
            'technical': None,
            'whale': round(buy_strength, 4) if facts else None,
            'dark_flow': round(dark_flow_score, 4) if dark_flow_score is not None else None,
            'sentiment': None,
            'is_stale': snapshot_is_stale or facts_is_stale,
        }

        db_data.update({
            'metrics': metrics,
            'input_snapshot': input_snapshot,
            'feature_attribution': feature_attribution,
            'is_stale': snapshot_is_stale or facts_is_stale,
        })

        return asyncio.run(cls.run_async(
            effective_context, symbol, db_data, trace_ctx=trace_ctx))

    @classmethod
    async def run_async(
        cls,
        effective_context: dict,
        symbol: str,
        db_data: dict,
        trace_ctx=None,
    ) -> dict:
        symbol = symbol.strip().upper()
        ai_model = effective_context.get('ai_model') or 'gpt-4o-mini'
        api_key = effective_context.get('api_key')
        temperature = effective_context.get('temperature') or 0.3
        max_tokens = effective_context.get('max_tokens') or 1000
        language = effective_context.get('language') or 'vi'

        # These four are produced by run() and handed over inside db_data
        # (see run(), just above the run_async call). They used to be read here
        # as bare names, which are locals of run() and not visible in this
        # function, so every call raised NameError: name 'metrics' is not
        # defined. Fixed 2026-09-26; the previous E2E claim of
        # status=generated could not have come through this path.
        metrics = db_data.get('metrics') or {}
        input_snapshot = db_data.get('input_snapshot') or {}
        feature_attribution = db_data.get('feature_attribution') or {}
        is_stale = bool(db_data.get('is_stale'))

        # Extract values from pre-fetched db_data
        price = db_data["price"]
        price_change_pct = db_data["price_change_pct"]
        high_price = db_data["high_price"]
        low_price = db_data["low_price"]
        volume = db_data["volume"]
        cvd = db_data["cvd"]
        buy_strength = db_data["buy_strength"]
        inst_strength = db_data["inst_strength"]
        whale_flow = db_data["whale_flow"]
        ohlcv_context = db_data["ohlcv_context"]
        cvd_context = db_data["cvd_context"]

        # Load dynamic custom prompts from metadata or fallback to standard templates
        metadata = effective_context.get('metadata') or {}
        
        tech_sys = metadata.get('technical_agent_prompt') or 'Bạn là chuyên gia phân tích kỹ thuật chứng khoán cho mã {symbol}.'
        flow_sys = metadata.get('flow_agent_prompt') or 'Bạn là chuyên gia phân tích dòng tiền lớn và dấu vết cá mập cho mã {symbol}.'
        sent_sys = metadata.get('sentiment_agent_prompt') or 'Bạn là chuyên gia phân tích tâm lý thị trường cho mã {symbol}.'
        synth_sys = metadata.get('synthesis_agent_prompt') or 'Bạn là Giám đốc Phân tích tổng hợp khuyến nghị cho mã {symbol}.'

        provider = effective_context.get('ai_provider', 'openai')
        custom_endpoint = effective_context.get('custom_endpoint', '')

        # Check if we should use simulated fallback
        is_mock = (not api_key or api_key.lower() in ('mock', 'mock_key') or api_key.startswith('mock_'))
        if is_mock:
            if not getattr(settings, 'DEBUG', False):
                raise ValueError("Không tìm thấy API Key cấu hình cho AI Provider.")
            
            logger.info("Using simulated fallback response in DEBUG mode")
            trend_label = "MUA" if cvd > 0.1 else "BÁN" if cvd < -0.1 else "TRUNG LẬP"
            if language == 'en':
                trend_label = "BUY" if cvd > 0.1 else "SELL" if cvd < -0.1 else "NEUTRAL"
                text = (
                    f"AI analysis for {symbol} (Price: {price:,.0f} VND, {price_change_pct:+.2f}%). "
                    f"Whale flow registered {whale_flow:,.0f} VND with CVD at {cvd:.2f}. "
                    f"Technical signals point to a {trend_label.lower()} posture."
                )
                return {
                    'advisory_text': text,
                    'ai_model': ai_model,
                    'tokens_used': 150,
                    'metrics': metrics,
                    'input_snapshot': input_snapshot,
                    'feature_attribution': feature_attribution,
                    'is_stale': is_stale,
                    'technical_analysis': f"Technical analysis for {symbol} shows price trading between {low_price:,.0f} and {high_price:,.0f} VND. Support is established at {low_price:,.0f} VND.",
                    'whale_analysis': f"Whale flow analysis shows net flow of {whale_flow:,.0f} VND. Institutional strength is calibrated at {inst_strength * 100:.1f}%.",
                    'sentiment_analysis': f"Market sentiment for {symbol} is currently {trend_label.lower()} with normalized CVD of {cvd:.2f}.",
                    'recommendation': f"Recommendation is to maintain a {trend_label.lower()} bias. Monitor resistance level near {high_price:,.0f} VND.",
                    'summary': text
                }
            else:
                text = (
                    f"Bản phân tích AI cho mã {symbol} (Thị giá: {price:,.0f} VND, biến động {price_change_pct:+.2f}%). "
                    f"Dòng tiền cá mập đạt {whale_flow:,.0f} VND ròng với chỉ số CVD {cvd:.2f}. "
                    f"Các tín hiệu kỹ thuật cho thấy xu hướng {trend_label}."
                )
                return {
                    'advisory_text': text,
                    'ai_model': ai_model,
                    'tokens_used': 150,
                    'metrics': metrics,
                    'input_snapshot': input_snapshot,
                    'feature_attribution': feature_attribution,
                    'is_stale': is_stale,
                    'technical_analysis': f"Phân tích kỹ thuật mã {symbol} ghi nhận biên độ giao động từ {low_price:,.0f} đến {high_price:,.0f} VND. Ngưỡng hỗ trợ tĩnh hình thành quanh {low_price:,.0f} VND.",
                    'whale_analysis': f"Dòng tiền lớn (Whale Flow) ghi nhận ròng {whale_flow:,.0f} VND. Cường độ tổ chức (Institutional Strength) duy trì ở mức {inst_strength * 100:.1f}%.",
                    'sentiment_analysis': f"Tâm lý chung đối với {symbol} nghiêng về trạng thái {trend_label.lower()} với lực mua ròng đạt {buy_strength * 100:.1f}% tổng khớp.",
                    'recommendation': f"Khuyến nghị duy trì trạng thái {trend_label.lower()}. Tiếp tục quan sát biến động quanh ngưỡng kháng cự {high_price:,.0f} VND.",
                    'summary': text
                }

        # Resolve endpoints (R0.6: custom_endpoint user nhap phai qua SSRF guard).
        endpoint = _resolve_chat_endpoint(provider, custom_endpoint, ai_model)

        # R2.2: mọi gọi provider đi qua factory — không còn nhánh if provider ==.
        # api_key rỗng/local: adapter tự bỏ Authorization header (như cũ).
        ai_client = get_ai_client(
            provider, api_key=api_key or '', endpoint=endpoint, ai_model=ai_model,
        )
        # R2.6: router chon deployment + ghi quyet dinh vao trace. Khong co
        # deployment nao khoe => 503 no_healthy_deployment (AC6), khong im lang
        # roi ve provider dang hong.
        routing = _resolve_routing(provider)
        if routing.get('chosen'):
            provider = routing.get('provider') or provider
            ai_model = routing.get('model') or ai_model
            ai_client = get_ai_client(
                provider, api_key=api_key or '', endpoint=endpoint, ai_model=ai_model,
            )

        # R2.9/R2.10: retry/backoff theo deployment đã được route tới (nếu có).
        # Không có deployment => policy mặc định từ settings.
        retry_policy = _resolve_retry_policy(routing.get('deployment'))

        # Build user prompts for each sub-agent
        tech_user_prompt = f"""
Analyze the technical posture for symbol {symbol}:
- Current Price: {price:,.2f} VND (Change: {price_change_pct:+.2f}%)
- Session High: {high_price:,.2f} VND, Session Low: {low_price:,.2f} VND, Volume: {volume:,}
{ohlcv_context}
Based on these metrics, write a technical analysis block in {"Vietnamese" if language == 'vi' else "English"}.
"""

        flow_user_prompt = f"""
Analyze the money flow & large transactions for symbol {symbol}:
- Cumulative CVD Normalized: {cvd:.3f}
- Buy Strength: {buy_strength:.3f}
- Institutional Strength: {inst_strength:.3f}
- Whale Net Flow (VND): {whale_flow:,}
{cvd_context}
Based on these metrics, write a flow analysis block in {"Vietnamese" if language == 'vi' else "English"}.
"""

        sentiment_user_prompt = f"""
Analyze the retail and institutional sentiment for symbol {symbol}:
- Current Price: {price:,.2f} VND (Change: {price_change_pct:+.2f}%)
- Cumulative CVD Normalized: {cvd:.3f}
- Buy Strength: {buy_strength:.3f}
- Whale Net Flow (VND): {whale_flow:,}
Based on these metrics, write a sentiment analysis block in {"Vietnamese" if language == 'vi' else "English"}.
"""

        # R3.1: `routing_decision` ghi kèm vào trace từng bước — đóng nợ R2.6
        # ("chưa biết bước này đi qua deployment/chiến lược nào").
        _routing_decision = {
            'strategy': (routing or {}).get('strategy', ''),
            'deployment_id': getattr(
                (routing or {}).get('deployment'), 'id', None),
            'deployment_name': getattr(
                (routing or {}).get('deployment'), 'name', ''),
            'model': ai_model,
        }

        # Call sub-agents concurrently
        tech_task = call_agent_async(
            ai_client, "technical", tech_sys.format(symbol=symbol), tech_user_prompt,
            ai_model, temperature, 400, policy=retry_policy,
            trace_ctx=trace_ctx, routing_decision=_routing_decision,
        )
        flow_task = call_agent_async(
            ai_client, "flow", flow_sys.format(symbol=symbol), flow_user_prompt,
            ai_model, temperature, 400, policy=retry_policy,
            trace_ctx=trace_ctx, routing_decision=_routing_decision,
        )
        sent_task = call_agent_async(
            ai_client, "sentiment", sent_sys.format(symbol=symbol), sent_user_prompt,
            ai_model, temperature, 300, policy=retry_policy,
            trace_ctx=trace_ctx, routing_decision=_routing_decision,
        )

        # Await all sub-agents
        tech_res, flow_res, sent_res = await asyncio.gather(tech_task, flow_task, sent_task)

        # Synthesis Prompt
        synthesis_user_prompt = f"""
You are the Lead Analyst. Review and synthesize the following sub-agent inputs for {symbol}:
- Technical Analysis: {tech_res}
- Flow Analysis: {flow_res}
- Sentiment Analysis: {sent_res}

You must respond strictly as a JSON object (without markdown blocks like ```json ... ```).
The output JSON keys must be:
- "signal": exactly one of "BUY", "SELL", "HOLD". No other text in this field.
- "confidence_score": a number between 0 and 1 (1.0 = maximum certainty). No unit, no percent sign.
- "target_price": a number (VND) or null when the data does not support a target.
- "risk_level": exactly one of "low", "medium", "high".
- "recommendation": Final calibrated action, target parameters, risks, and guidelines.
- "summary": A concise, final summary (under 100 words).
- "rationale": 2-4 sentences explaining why the signal follows from the inputs above.

Please write all text in {"Vietnamese" if language == 'vi' else "English"}.
"""
        
        # Call Synthesis Agent (R2.2: qua AiClient — adapter tự quyết
        # response_format theo khả năng của nó, orchestrator không nhánh.
        logger.info("Triggering LLM request for Synthesis Agent")
        synth_error = None
        synth_status = None
        synth_code = None
        synth_message = None
        res_data = None
        # R3.1: khởi tạo trước vòng lặp — attempt đầu có thể raise trước khi
        # gán `choice`/`synth_result`, và trace vẫn phải ghi được (AC4).
        choice = ''
        synth_result = None
        # R3.1: đo 1 lần cho cả vòng retry — AC1 đòi **đúng 4** trace mỗi refresh,
        # nên không ghi theo từng `attempt` (số lần retry do breaker R2.9 đếm).
        import time as _synth_time
        _synth_t0 = _synth_time.monotonic()
        _synth_prompt = f"{synth_sys.format(symbol=symbol)}\n\n{synthesis_user_prompt}"
        for attempt in range(1, PROVIDER_RETRY_ATTEMPTS + 1):
            try:
                synth_result = await ai_client.complete_resilient(
                    synth_sys.format(symbol=symbol),
                    synthesis_user_prompt,
                    model=ai_model,
                    temperature=temperature,
                    max_tokens=max(int(max_tokens or 0), SYNTHESIS_MAX_TOKENS_FLOOR),
                    timeout=25.0,
                    response_format="json",
                    policy=retry_policy,
                )
                res_data = synth_result['raw']
                choice = synth_result['text']
                finish_reason = synth_result.get('finish_reason')
                try:
                    parsed_json = json.loads(choice.strip())
                except (ValueError, TypeError) as parse_error:
                    # HTTP 200 nhưng nội dung hỏng. Phân biệt "bị cắt cụt"
                    # với "JSON sai định dạng" để thông điệp hành động chính xác.
                    if finish_reason == 'length':
                        synth_code, synth_message = TRUNCATED_RESPONSE_CODE, TRUNCATED_RESPONSE_MESSAGE
                    else:
                        synth_code, synth_message = INVALID_RESPONSE_CODE, INVALID_RESPONSE_MESSAGE
                    logger.error(
                        "Synthesis JSON khong parse: finish_reason=%s len=%s err=%s",
                        finish_reason, len(choice or ''), parse_error,
                    )
                    break
                synth_error = None
                break
            except ProviderHTTPError as _e:
                synth_error = _e
                synth_status = _e.status_code
                # Adapter báo shape hỏng (thiếu choices) ≅ response không đọc được.
                if 'bad_shape' in (_e.body_text or '') or 'invalid_json' in (_e.body_text or ''):
                    synth_code, synth_message = INVALID_RESPONSE_CODE, INVALID_RESPONSE_MESSAGE
                # N2 — hết hạn mức tài khoản KHÔNG phải lỗi tạm thời.
                # Retry chỉ tốn thêm thời gian rồi vẫn 429. Phân biệt ngay
                # để trả đúng mã lỗi có hành động (nạp tiền/đổi gói) thay vì
                # bắt người dùng "thử lại sau ít phút" vô hạn.
                if synth_status == 429:
                    _body = _e.body_text or ''
                    if _is_quota_exhausted(_body):
                        logger.error(
                            "Synthesis gap 429 HET HAN MUC (khong phai loi tam thoi); "
                            "dung retry. status=%s",
                            synth_status,
                        )
                        synth_code, synth_message = QUOTA_EXHAUSTED_CODE, QUOTA_EXHAUSTED_MESSAGE
                        break
                if not _is_retryable_status(synth_status) or attempt == PROVIDER_RETRY_ATTEMPTS:
                    break
                delay = _retry_delay_seconds(getattr(_e, 'response', None), attempt)
                logger.warning(
                    "Synthesis gap loi tam thoi (status=%s); thu lai lan %s/%s sau %.1fs",
                    synth_status, attempt + 1, PROVIDER_RETRY_ATTEMPTS, delay,
                )
                await asyncio.sleep(delay)
        # R3.1: 1 trace cho synthesis, ghi TRƯỚC mọi `raise` phía dưới — AC4 đòi lỗi
        # provider vẫn để lại dấu vết. `synth_code`/`synth_error` đã quyết định
        # thông điệp trả về cho FE, trace dùng **chính** hai biến đó ⇒ không lệch.
        _synth_failed = synth_code is not None or synth_error is not None
        record_step_trace(
            trace_ctx, 'synthesis',
            provider=getattr(ai_client, 'provider', '') or '',
            model=ai_model,
            prompt=_synth_prompt,
            response=synth_result if synth_result is not None else '',
            latency_ms=int((_synth_time.monotonic() - _synth_t0) * 1000),
            status='error' if _synth_failed else 'ok',
            error_code=(
                synth_code or (
                    f'provider_http_{synth_status}' if _synth_failed else ''
                )
            ) or '',
            routing_decision=_routing_decision,
        )
        # N2 — ưu tiên mã lỗi có sẵn. Trước đây nhánh `synth_error is not
        # None` đứng trước nên nuốt mất `synth_code`/`synth_message`, khiến
        # cả 3 ca (truncated / invalid / hết hạn mức) đều rơi về thông điệp
        # HTTP chung. Đảo thứ tự để thông điệp hành động luôn tới nơi.
        if synth_code is not None:
            raise AdvisorySynthesisError(200, '', code=synth_code, message=synth_message)
        if synth_error is not None:
            raise AdvisorySynthesisError(
                synth_status or 500,
                str(synth_error)[:500],
            )

        tokens_used = res_data.get('usage', {}).get('total_tokens', 250)
        # R0.7 AC6/AC9: giu usage CHI TIET de task ghi AIUsageRecord that.
        _tokens_in, _tokens_out, _usage_unavailable = _extract_usage(
            res_data.get('usage')
        )

        # R0.2 — signal là enum nghiêm ngặt, không đoán. Thứ tự: ưu tiên
        # `signal` do model trả, fallback sang `recommendation` (mô hình cũ
        # chỉ trả key này), cuối cùng mới fail-closed.
        raw_signal = parsed_json.get('signal')
        raw_recommendation = parsed_json.get('recommendation')
        signal = normalize_signal(raw_signal)
        if signal == SIGNAL_UNKNOWN:
            signal = normalize_signal(raw_recommendation)

        target_price = _coerce_float(parsed_json.get('target_price'))
        confidence = normalize_confidence(
            parsed_json.get('confidence_score', parsed_json.get('confidence'))
        )

        return {
            'advisory_text': parsed_json.get('summary') or parsed_json.get('recommendation') or "",
            'ai_model': ai_model,
            'tokens_used': tokens_used,
            'usage': {
                'prompt_tokens': _tokens_in,
                'completion_tokens': _tokens_out,
                'usage_unavailable': _usage_unavailable,
            },
            'metrics': metrics,
            'input_snapshot': input_snapshot,
            'feature_attribution': feature_attribution,
            'is_stale': is_stale,
            'technical_analysis': tech_res,
            'whale_analysis': flow_res,
            'sentiment_analysis': sent_res,
            'recommendation': raw_recommendation or "",
            'summary': parsed_json.get('summary') or "",
            'signal': signal,
            'signal_raw': raw_signal or '',
            'confidence_score': confidence,
            'rationale': parsed_json.get('rationale') or '',
            'risk_level': normalize_risk_level(parsed_json.get('risk_level')),
            'target_price': target_price,
        }

