import logging
from celery import shared_task
from django.utils import timezone

from advisory.models import AdvisoryComponent, AdvisorySession
from identity_access.models import UserProfile

logger = logging.getLogger(__name__)


def _sanitize_effective_context_for_session(effective_context: dict) -> dict:
    sanitized_context = dict(effective_context or {})
    for sensitive_key in ('api_key', 'encrypted_api_key', 'secret_key'):
        if sensitive_key in sanitized_context:
            sanitized_context[sensitive_key] = '[redacted]'
    return sanitized_context

@shared_task(name="advisory.reset_daily_token_budgets")
def reset_daily_token_budgets():
    """Tác vụ tự động reset lượng token tiêu hao hàng ngày về 0.
    
    Tác vụ quét qua toàn bộ các phiên hoạt động và đặt lại bộ đếm giới hạn để 
    ngăn ngừa tình trạng khóa nhầm định ngạch.
    """
    now = timezone.now()
    logger.info(f"Khởi động tác vụ đặt lại định mức tiêu hao token AI: {now}")
    
    # 1. Đặt lượng token_used của tất cả các AdvisorySession trong ngày về 0
    updated_sessions = AdvisorySession.objects.all().update(tokens_used=0)
    
    # 2. Reset các trường ghi nhận lượng tiêu hao token trong ngày của UserProfile (nếu có)
    # Ví dụ: reset trường preferences.daily_tokens_used nếu được lưu trực tiếp tại Profile
    profiles_to_reset = UserProfile.objects.filter(preferences__has_key='daily_tokens_used')
    updated_profiles = 0
    for profile in profiles_to_reset:
        profile.preferences['daily_tokens_used'] = 0
        profile.save(update_fields=['preferences'])
        updated_profiles += 1
    
    logger.info(
        f"Đặt lại định mức thành công cho {updated_sessions} phiên tư vấn "
        f"và {updated_profiles} tài khoản người dùng hoạt động."
    )
    return f"Reset {updated_sessions} sessions and {updated_profiles} profiles."


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
        record.status = 'generated'
        record.tokens_used = orch_res.get('tokens_used', 0)
        record.generated_at = timezone.now()
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
                'token_budget': int(effective_context.get('max_tokens') or 2000),
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
            record = AdvisoryRecord.objects.get(advisory_id=record_id)
            record.status = 'failed'
            record.error_message = str(e)
            record.save()
        except Exception:
            pass

