import json
import logging
from celery import shared_task
from django.utils import timezone

from advisory.models import AdvisoryComponent, AdvisorySession
from advisory.orchestrator import (
    SIGNAL_UNPARSEABLE_CODE,
    SIGNAL_UNPARSEABLE_MESSAGE,
    AdvisorySynthesisError,
    _coerce_float,
)
from advisory.signal_norm import (
    SCHEMA_VERSION,
    SIGNAL_UNKNOWN,
    normalize_confidence,
    normalize_risk_level,
    normalize_signal,
)
from identity_access.models import UserProfile

logger = logging.getLogger(__name__)

#: key bắt buộc có mặt trong `structured_output` (schema v2)
REQUIRED_STRUCTURED_KEYS = (
    'signal',
    'confidence_score',
    'summary',
    'rationale',
    'recommendation',
    'risk_level',
    'target_price',
    'schema_version',
)


def _build_structured_output(orch_res: dict, advisory_text: str = '') -> dict:
    """Dựng `structured_output` từ kết quả orchestrator + fallback JSON parse.

    - Ưu tiên giá trị orchestrator đã chuẩn hoá (`signal`, `confidence_score`).
    - Nếu orchestrator chưa có `signal` (model cũ chỉ trả `recommendation`),
      fallback sang `recommendation` rồi mới về `advisory_text` nếu nó thực sự
      là JSON object.
    - Không tự bịa `confidence_score`: thiếu thì để `None`.
    """
    result = dict(orch_res or {})
    parsed_extra = {}

    # advisory_text chỉ parse được khi bản thân nó là JSON object (mô hình cũ
    # hay trả nguyên JSON). Trước đây mọi lần parse đều raise rồi bị nuốt.
    if not result.get('signal') and advisory_text:
        try:
            maybe_json = json.loads(advisory_text)
            if isinstance(maybe_json, dict):
                parsed_extra = maybe_json
        except (ValueError, TypeError):
            parsed_extra = {}

    def pick(key, default=None):
        value = result.get(key)
        if value in (None, ''):
            value = parsed_extra.get(key, default)
        return value

    raw_signal = result.get('signal') or parsed_extra.get('signal') or ''
    signal = normalize_signal(raw_signal) if raw_signal not in (None, '') else SIGNAL_UNKNOWN
    if signal == SIGNAL_UNKNOWN:
        signal = normalize_signal(pick('recommendation') or '')
    if signal == SIGNAL_UNKNOWN:
        signal = normalize_signal(pick('signal_raw') or '')

    return {
        'signal': signal,
        'signal_raw': str(pick('signal_raw', '') or ''),
        'confidence_score': normalize_confidence(
            result.get('confidence_score', parsed_extra.get('confidence_score'))
        ),
        'summary': str(pick('summary', '') or ''),
        'rationale': str(pick('rationale', '') or ''),
        'recommendation': str(pick('recommendation', '') or ''),
        'risk_level': normalize_risk_level(pick('risk_level')),
        'target_price': _coerce_float(pick('target_price')),
        'feature_attribution': pick('feature_attribution', {}) or {},
        'input_snapshot': pick('input_snapshot', {}) or {},
        'components': pick('components', []) or [],
        'advisory_text': str(advisory_text or ''),
        'schema_version': SCHEMA_VERSION,
        'normalized_by': 'signal_norm.normalize_signal',
    }



def _sanitize_effective_context_for_session(effective_context: dict) -> dict:
    sanitized_context = dict(effective_context or {})
    for sensitive_key in ('api_key', 'encrypted_api_key', 'secret_key'):
        if sensitive_key in sanitized_context:
            sanitized_context[sensitive_key] = '[redacted]'
    return sanitized_context

@shared_task(name="advisory.reset_daily_token_budgets")
def reset_daily_token_budgets():
    logger.info("reset_daily_token_budgets: no-op (enforcement date-scoped in views.py)")
    return "noop: enforcement date-scoped in views.py"


@shared_task(name="advisory.generate_advisory_task")
def generate_advisory_task(record_id: str, effective_context: dict, symbol: str):
    """
    Asynchronously runs the advisory Multi-Agent orchestrator using the effective
    AI context and stores the resulting analysis in the AdvisoryRecord.
    """
    from advisory.models import AdvisoryRecord
    from advisory.orchestrator import AdvisoryOrchestrator
    try:
        record = AdvisoryRecord.objects.get(advisory_id=record_id)
        orch_res = AdvisoryOrchestrator.run(effective_context, symbol)
        record.advisory_text = orch_res.get('advisory_text', '')
        record.tokens_used = orch_res.get('tokens_used', 0)
        record.generated_at = timezone.now()

        # R0.3 — dựng structured_output có kiểm soát. Trước đây copy key "nếu có"
        # nên `signal`/`confidence_score` biến mất âm thầm vì orchestrator cũ
        # không trả 2 key đó -> serializer trả None vĩnh viễn -> FE suy ra
        # side=UNKNOWN cho mọi tín hiệu.
        structured = _build_structured_output(orch_res, record.advisory_text)

        # R0.2/R0.10 — signal không đọc được thì fail-closed: KHÔNG ghi record
        # là `generated` vì như vậy UI sẽ hiển thị một khuyến nghị không có
        # chiều, và order ticket sẽ bị chặn ở trạng thái giả.
        if structured.get('signal') == SIGNAL_UNKNOWN:
            record.status = 'failed'
            record.error_message = SIGNAL_UNPARSEABLE_MESSAGE
            record.structured_output = {
                **structured,
                'error': {
                    'error_code': SIGNAL_UNPARSEABLE_CODE,
                    'user_message': SIGNAL_UNPARSEABLE_MESSAGE,
                    'signal_raw': orch_res.get('signal_raw') or '',
                },
            }
            record.save()
            logger.warning(
                "advisory.generate_advisory_task: signal unparseable for %s (%s); "
                "record marked failed instead of emitting a directionless signal",
                symbol, structured.get('signal_raw') or orch_res.get('signal_raw') or '',
            )
            return

        record.status = 'generated'
        record.structured_output = structured
        record.save()


        if record.user_id is None:
            logger.warning("Skipping advisory session materialization for %s because record.user is null", record_id)
            return

        sanitized_context = _sanitize_effective_context_for_session(effective_context)
        session, _ = AdvisorySession.objects.update_or_create(
            user=record.user,
            symbol=record.symbol,
            session_date=record.session_date,
            defaults={
                'status': AdvisorySession.StatusChoices.COMPLETED,
                'ai_model': orch_res.get('ai_model') or record.ai_model or effective_context.get('ai_model') or 'gpt-4o-mini',
                'tokens_used': record.tokens_used,
                'token_budget': int(effective_context.get('token_budget') or effective_context.get('max_tokens') or 2000),
                'context_snapshot': {
                    **(record.context_snapshot or {}),
                    'advisory_record_id': str(record.advisory_id),
                    'effective_ai_context': sanitized_context,
                    'advisory_text': record.advisory_text,
                    'tokens_used': record.tokens_used,
                    'generated_at': record.generated_at.isoformat() if record.generated_at else timezone.now().isoformat(),
                },
            },
        )

        AdvisoryComponent.objects.update_or_create(
            session=session,
            component_type=AdvisoryComponent.ComponentType.RAW_CONTEXT,
            order=0,
            defaults={
                'content': str(sanitized_context),
                'metadata': {'source': 'generate_advisory_task', 'kind': 'effective_ai_context'},
            },
        )
        AdvisoryComponent.objects.update_or_create(
            session=session,
            component_type=AdvisoryComponent.ComponentType.SUMMARY,
            order=1,
            defaults={
                'content': record.advisory_text,
                'metadata': {'source': 'generate_advisory_task', 'kind': 'advisory_summary'},
            },
        )
        
        # Save detailed Multi-Agent analysis components if present
        if 'technical_analysis' in orch_res:
            AdvisoryComponent.objects.update_or_create(
                session=session,
                component_type=AdvisoryComponent.ComponentType.TECHNICAL,
                order=2,
                defaults={
                    'content': orch_res['technical_analysis'],
                    'metadata': {'source': 'generate_advisory_task', 'kind': 'technical_analysis'},
                },
            )
        if 'whale_analysis' in orch_res:
            AdvisoryComponent.objects.update_or_create(
                session=session,
                component_type=AdvisoryComponent.ComponentType.WHALE,
                order=3,
                defaults={
                    'content': orch_res['whale_analysis'],
                    'metadata': {'source': 'generate_advisory_task', 'kind': 'whale_analysis'},
                },
            )
        if 'recommendation' in orch_res:
            AdvisoryComponent.objects.update_or_create(
                session=session,
                component_type=AdvisoryComponent.ComponentType.RECOMMENDATION,
                order=4,
                defaults={
                    'content': orch_res['recommendation'],
                    'metadata': {'source': 'generate_advisory_task', 'kind': 'recommendation'},
                },
            )
    except Exception as e:
        logger.error(f"Advisory generation failed for record {record_id}: {e}")
        try:
            failed_record = AdvisoryRecord.objects.get(advisory_id=record_id)
            if failed_record.user_id is not None:
                from commercial.models import QuotaRecord
                from identity_access.models import CoreTenant
                from django.utils import timezone as _tz
                from calendar import monthrange as _mr
                _tenant = CoreTenant.objects.filter(owner_user=failed_record.user).first()
                if _tenant:
                    _today = _tz.localdate()
                    _qs = _today.replace(day=1)
                    _qe = _today.replace(day=_mr(_today.year, _today.month)[1])
                    _qrec, _ = QuotaRecord.objects.get_or_create(
                        tenant=_tenant, period_start=_qs, period_end=_qe,
                        defaults={'api_calls_used': 0, 'api_calls_limit': -1},
                    )
                    if _qrec.api_calls_used > 0:
                        _qrec.api_calls_used -= 1
                        _qrec.save(update_fields=['api_calls_used', 'updated_at'])
        except Exception:
            logger.exception('Advisory quota refund failed (non-blocking)')
        try:
            record = AdvisoryRecord.objects.get(advisory_id=record_id)
            record.status = 'failed'
            # R0.10 — lỗi provider phải mang mã + thông điệp hành động để FE
            # hiển thị được (DoD A6). Trước đây chỉ lưu `str(e)` nên UI không có
            # gì để phân biệt "sai cấu hình" với "dịch vụ tạm thời lỗi".
            if isinstance(e, AdvisorySynthesisError):
                record.error_message = e.user_message
                structured = record.structured_output if isinstance(record.structured_output, dict) else {}
                record.structured_output = {**structured, 'error': e.public_payload()}
            else:
                record.error_message = str(e)
            record.save(update_fields=['status', 'error_message', 'structured_output', 'updated_at'])
        except Exception:
            logger.exception('Advisory failure record update failed for %s', record_id)

