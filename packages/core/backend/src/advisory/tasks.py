import json
import logging
from celery import shared_task
from django.utils import timezone

from advisory.ai_clients import FactoryError, get_ai_client
from advisory.copilot_tokens import CopilotTokenManager
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


def _refund_advisory_quota(record) -> bool:
    """Hoan 1 lan goi quota cho tenant da tieu.

    Tach rieng khoi `generate_advisory_task` de test duoc truc tiep - truoc do
    nam trong `except`, khong goi duoc tu test nao.

    Tra True neu co ghi nho giam.
    """
    if record.user_id is None:
        return False

    from commercial.models import QuotaRecord
    from identity_access.models import CoreTenant, TenantMember
    from django.utils import timezone as _tz
    from calendar import monthrange as _mr

    # Resolve the tenant that ACTUALLY consumed the quota.
    #
    # Owner first: `CoreTenant.owner_user` is a OneToOneField and an owner is an
    # implicit member (`TenantMember` docstring: "not required to have a
    # TenantMember row").
    _tenant = CoreTenant.objects.filter(owner_user=record.user).first()
    if _tenant is None:
        memberships = list(
            TenantMember.objects.filter(user=record.user)
            .select_related('tenant')
            .values_list('tenant_id', flat=True)
        )
        # Ambiguous membership: crediting an arbitrary tenant is exactly the class
        # of bug this function exists to remove, so refuse instead of guessing.
        # Refusing only forfeits a refund; guessing corrupts another tenant's
        # balance.
        if len(memberships) != 1:
            logger.error(
                'Advisory quota refund skipped: user %s belongs to %d tenants '
                '(tenant_ids=%s). AdvisoryRecord has no tenant FK, so the charging '
                'tenant cannot be recovered. Refusing to guess.',
                record.user_id, len(memberships), memberships,
            )
            return False
        _tenant = CoreTenant.objects.filter(pk=memberships[0]).first()
    if _tenant is None:
        return False

    # The charging path derives its period from the advisory's `session_date`
    # (`advisory/views.py:_manual_trigger_period`), not from "today". Using the
    # current month credited the wrong period for a back-dated advisory.
    session_date = record.session_date or _tz.localdate()
    _qs = session_date.replace(day=1)
    _qe = session_date.replace(day=_mr(session_date.year, session_date.month)[1])
    _qrec, _ = QuotaRecord.objects.get_or_create(
        tenant=_tenant,
        period_start=_qs,
        period_end=_qe,
        defaults={'api_calls_used': 0, 'api_calls_limit': -1},
    )
    if _qrec.api_calls_used > 0:
        _qrec.api_calls_used -= 1
        _qrec.save(update_fields=['api_calls_used', 'updated_at'])
        return True
    return False


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


# ---------------------------------------------------------------- R2.6 health

#: Ngưỡng R2.6. Tắt sớm = mất dịch vụ khi provider đang deploy; bật lại sớm =
#: đẩy traffic vào deployment còn hỏng. Hai ngưỡng khác nhau là chủ ý.
EVICT_AFTER_CONSECUTIVE_FAILURES = 3
RESTORE_AFTER_CONSECUTIVE_SUCCESSES = 2


def _record_health_audit(action: str, detail: str) -> None:
    """Audit cho evict/restore. Lỗi audit không được làm hỏng task health."""
    try:
        from advisory.models import AIAuditLog

        AIAuditLog.objects.create(action=action, actor='system', diff_summary=detail[:255])
    except Exception:
        logger.exception('AI health audit write failed (non-blocking)')


def _apply_health_outcome(deployment, *, ok: bool) -> None:
    """AC2/AC3: cập nhật chuỗi đếm + health_state. KHÔNG đụng `enabled` -
    việc bật/tắt do _apply_evict_or_restore quyết định ở MỘT chỗ duy nhất."""
    from advisory.models import AIDeployment

    deployment.consecutive_failures = 0 if ok else deployment.consecutive_failures + 1
    deployment.consecutive_successes = deployment.consecutive_successes + 1 if ok else 0
    if ok:
        if deployment.consecutive_successes >= RESTORE_AFTER_CONSECUTIVE_SUCCESSES:
            deployment.health_state = AIDeployment.HealthChoices.HEALTHY
    elif deployment.health_state != AIDeployment.HealthChoices.UNHEALTHY:
        # Lần lỗi đầu chỉ hạ cấp xuống degraded, chưa tắt - chống false-positive
        # khi provider đang deploy (rủi ro plan đã nêu ở R2.6).
        deployment.health_state = AIDeployment.HealthChoices.DEGRADED
    deployment.last_health_at = timezone.now()
    deployment.save(update_fields=[
        'consecutive_failures', 'consecutive_successes', 'health_state', 'last_health_at',
    ])


def _apply_evict_or_restore(deployment) -> str:
    """AC2: tắt sau 3 lần thất bại liên tiếp. AC3: bật lại sau 2 lần thành công liên tiếp."""
    from advisory.models import AIAuditLog, AIDeployment

    if (
        deployment.consecutive_failures >= EVICT_AFTER_CONSECUTIVE_FAILURES
        and deployment.enabled
    ):
        deployment.enabled = False
        deployment.auto_evicted = True
        deployment.health_state = AIDeployment.HealthChoices.UNHEALTHY
        deployment.save(update_fields=['enabled', 'auto_evicted', 'health_state'])
        _record_health_audit(
            AIAuditLog.ActionChoices.DEPLOYMENT_EVICTED,
            f'{deployment.name} bị tắt sau {deployment.consecutive_failures} probe thất bại liên tiếp',
        )
        return 'evicted'
    if (
        deployment.consecutive_successes >= RESTORE_AFTER_CONSECUTIVE_SUCCESSES
        and deployment.auto_evicted
        and not deployment.enabled
    ):
        deployment.enabled = True
        deployment.auto_evicted = False
        deployment.health_state = AIDeployment.HealthChoices.HEALTHY
        deployment.save(update_fields=['enabled', 'auto_evicted', 'health_state'])
        _record_health_audit(
            AIAuditLog.ActionChoices.DEPLOYMENT_RESTORED,
            f'{deployment.name} được bật lại sau {deployment.consecutive_successes} probe thành công liên tiếp',
        )
        return 'restored'
    return ''


@shared_task(name="advisory.probe_deployments_health")
def probe_deployments_health():
    """R2.6 AC1: probe mọi deployment cần theo dõi bằng AiClient.probe().

    Theo dõi = `enabled` **hoặc** `auto_evicted`. Bỏ `auto_evicted` thì deployment
    bị evict không bao giờ được probe lại => mất dịch vụ vĩnh viễn sau một sự cố
    nhất thời. Deployment quản trị TẮT TAY (`enabled=False`, `auto_evicted=False`)
    thì không đụng tới - tôn trọng ý quản trị.

    AC8: probe **dùng chung** session token copilot (CopilotTokenManager cache ở
    cấp module) nên N deployment copilot không đổi token N lần.
    """
    import asyncio

    from django.db.models import Q

    from advisory.models import AIDeployment, AIHealthCheck

    deployments = list(AIDeployment.objects.filter(Q(enabled=True) | Q(auto_evicted=True)))
    if not deployments:
        return {'probed': 0, 'note': 'khong co deployment can probe'}

    summary = {'probed': len(deployments), 'evicted': [], 'restored': []}
    for deployment in deployments:
        ok, latency_ms, error_code, detail = False, 0, 'probe_not_run', ''
        try:
            client = get_ai_client(
                deployment.provider, ai_model=deployment.model, timeout=15.0,
            )
            result = asyncio.run(client.probe())
            ok = bool(result.get('ok'))
            latency_ms = int(result.get('latency_ms') or 0)
            error_code = str(result.get('error_code') or '')[:48]
            detail = str(result.get('detail') or '')[:255]
        except FactoryError as exc:
            error_code, detail = 'factory_error', str(exc)[:255]
        except Exception as exc:
            error_code, detail = 'probe_raised', str(exc)[:255]

        AIHealthCheck.objects.create(
            deployment=deployment, ok=ok, latency_ms=latency_ms,
            error_code=error_code, detail=detail,
        )
        if ok and latency_ms:
            deployment.latency_ms = latency_ms
            deployment.save(update_fields=['latency_ms'])
        _apply_health_outcome(deployment, ok=ok)
        action = _apply_evict_or_restore(deployment)
        if action == 'evicted':
            summary['evicted'].append(deployment.name)
        elif action == 'restored':
            summary['restored'].append(deployment.name)
    return summary

@shared_task(name="advisory.generate_advisory_task")
def generate_advisory_task(record_id: str, effective_context: dict, symbol: str):
    """
    Asynchronously runs the advisory Multi-Agent orchestrator using the effective
    AI context and stores the resulting analysis in the AdvisoryRecord.
    """
    import time as _time

    from advisory.models import AdvisoryRecord
    from advisory.orchestrator import AdvisoryOrchestrator, _extract_usage
    try:
        record = AdvisoryRecord.objects.get(advisory_id=record_id)
        _start = _time.monotonic()
        orch_res = AdvisoryOrchestrator.run(effective_context, symbol)
        _latency_ms = max(1, int((_time.monotonic() - _start) * 1000))
        # R0.7 AC6: moi lan goi provider that (thanh cong) deu de lai 1 record.
        _tokens_in, _tokens_out, _unavailable = _extract_usage(orch_res.get('usage'))
        _write_advisory_usage_record(
            user=record.user,
            provider=(effective_context or {}).get('ai_provider') or '',
            model=orch_res.get('ai_model') or (effective_context or {}).get('ai_model') or '',
            tokens_in=_tokens_in,
            tokens_out=_tokens_out,
            latency_ms=_latency_ms,
            record_status='success',
            usage_unavailable=_unavailable,
        )
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
        # R0.7 AC7: loi provider (401/429/...) la luc can quan sat nhat —
        # van ghi record voi status='error', tokens 0 (khong bia).
        try:
            _failed_ctx = effective_context or {}
            _failed_user = None
            try:
                from advisory.models import AdvisoryRecord as _AR

                _failed_rec = (
                    _AR.objects.filter(advisory_id=record_id)
                    .select_related('user')
                    .first()
                )
                _failed_user = _failed_rec.user if _failed_rec else None
            except Exception:
                _failed_user = None
            _write_advisory_usage_record(
                user=_failed_user,
                provider=_failed_ctx.get('ai_provider') or '',
                model=_failed_ctx.get('ai_model') or '',
                tokens_in=0,
                tokens_out=0,
                latency_ms=0,
                record_status='error',
                usage_unavailable=True,
            )
        except Exception:
            logger.exception('AI error usage record write failed (non-blocking)')
        try:
            failed_record = AdvisoryRecord.objects.get(advisory_id=record_id)
            _refund_advisory_quota(failed_record)
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

