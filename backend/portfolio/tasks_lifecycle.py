from __future__ import annotations

import logging

from celery import shared_task
from django.utils import timezone

from portfolio.models import UserConfig
from portfolio.onboarding_trial_service import process_expired_onboarding_trials

logger = logging.getLogger(__name__)


@shared_task(bind=True, name='portfolio.tasks.process_plan_lifecycle_transitions', autoretry_for=(Exception,), retry_backoff=True, retry_kwargs={'max_retries': 1})
def process_plan_lifecycle_transitions(self) -> dict:
    """
    Daily transition flow: trial -> grace, then grace expiry -> free.
    """
    from portfolio.models import UserPlanLifecycle

    now = timezone.now()
    transitions = {'trial_to_grace': 0, 'grace_expired': 0, 'errors': 0}

    try:
        expired_trials = UserPlanLifecycle.objects.filter(
            trial_ends_at__lte=now,
            grace_ends_at__isnull=True,
        )

        for lifecycle in expired_trials:
            try:
                grace_deadline = lifecycle.trial_ends_at + timezone.timedelta(days=7)
                lifecycle.grace_ends_at = grace_deadline
                lifecycle.save(update_fields=['grace_ends_at', 'updated_at'])
                transitions['trial_to_grace'] += 1
                logger.info('Transition trial->grace: user=%s, grace_ends=%s', lifecycle.user.id, grace_deadline)
            except Exception as exc:
                logger.error('Error transitioning trial for user=%s: %s', lifecycle.user.id, exc)
                transitions['errors'] += 1

        expired_graces = UserPlanLifecycle.objects.filter(
            grace_ends_at__lte=now,
        )

        for lifecycle in expired_graces:
            try:
                user_cfg = UserConfig.objects.get(user=lifecycle.user)
                if user_cfg.plan != 'free':
                    user_cfg.plan = 'free'
                    user_cfg.save(update_fields=['plan', 'updated_at'])
                    logger.info(
                        'Downgrade after grace: user=%s, from_plan=%s, to=free',
                        lifecycle.user.id, user_cfg.plan,
                    )
                transitions['grace_expired'] += 1
            except Exception as exc:
                logger.error('Error expiring grace for user=%s: %s', lifecycle.user.id, exc)
                transitions['errors'] += 1
    except Exception as exc:
        logger.error('process_plan_lifecycle_transitions general error: %s', exc)
        transitions['errors'] += 1

    return {'status': 'ok', **transitions}


@shared_task(bind=True, name='portfolio.tasks.process_expired_onboarding_trials_task', autoretry_for=(Exception,), retry_backoff=True, retry_kwargs={'max_retries': 1})
def process_expired_onboarding_trials_task(self, batch_size: int = 500) -> dict:
    """Downgrade expired onboarding trials to fallback plan in bounded batches."""
    result = process_expired_onboarding_trials(batch_size=batch_size)
    logger.info(
        'event=onboarding_trial_expiry_task_run processed=%s downgraded=%s skipped=%s fallback_plan=%s batch_size=%s',
        result.get('processed', 0),
        result.get('downgraded', 0),
        result.get('skipped', 0),
        result.get('fallback_plan', ''),
        batch_size,
    )
    return {'status': 'ok', **result}
