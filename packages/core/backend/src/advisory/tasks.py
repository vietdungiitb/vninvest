from celery import shared_task
from django.utils import timezone
import logging
from advisory.models import AdvisorySession
from identity_access.models import UserProfile

logger = logging.getLogger(__name__)

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
    except Exception as e:
        logger.error(f"Advisory generation failed for record {record_id}: {e}")
        try:
            record = AdvisoryRecord.objects.get(advisory_id=record_id)
            record.status = 'failed'
            record.error_message = str(e)
            record.save()
        except Exception:
            pass

