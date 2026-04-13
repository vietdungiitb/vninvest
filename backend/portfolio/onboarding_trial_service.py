from __future__ import annotations

import logging

from dataclasses import dataclass
from datetime import timedelta
from typing import Optional

from django.contrib.auth.models import User
from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from .models import OnboardingPlanPolicy, PlanAssignmentLog, UserConfig


logger = logging.getLogger(__name__)


@dataclass
class TrialApplyResult:
    applied: bool
    reason: str
    plan: str = ""


def get_active_onboarding_policy(now=None) -> Optional[OnboardingPlanPolicy]:
    current = now or timezone.now()
    return (
        OnboardingPlanPolicy.objects.filter(is_active=True)
        .filter(Q(effective_from__isnull=True) | Q(effective_from__lte=current))
        .filter(Q(effective_to__isnull=True) | Q(effective_to__gt=current))
        .order_by("-updated_at")
        .first()
    )


def _create_plan_assignment_log(
    *,
    user: User,
    old_plan: str,
    new_plan: str,
    old_expires_at,
    new_expires_at,
    reason: str,
    actor_type: str,
    actor_user: Optional[User] = None,
    metadata: Optional[dict] = None,
) -> PlanAssignmentLog:
    return PlanAssignmentLog.objects.create(
        user=user,
        old_plan=old_plan or "",
        new_plan=new_plan,
        old_expires_at=old_expires_at,
        new_expires_at=new_expires_at,
        reason=reason,
        actor_type=actor_type,
        actor_user=actor_user,
        metadata_json=metadata or {},
    )


def apply_onboarding_trial_for_new_user(
    user: User,
    signup_method: str = "email_password",
    actor_user: Optional[User] = None,
) -> TrialApplyResult:
    if user.is_superuser:
        logger.info(
            "event=onboarding_trial_skipped reason=superuser_excluded user_id=%s signup_method=%s",
            user.id,
            signup_method,
        )
        return TrialApplyResult(applied=False, reason="superuser_excluded")

    policy = get_active_onboarding_policy()
    if policy is None:
        logger.info(
            "event=onboarding_trial_skipped reason=no_active_policy user_id=%s signup_method=%s",
            user.id,
            signup_method,
        )
        return TrialApplyResult(applied=False, reason="no_active_policy")

    user_config, _ = UserConfig.objects.get_or_create(user=user)

    # Do not override paid users.
    if user_config.plan_source == UserConfig.PlanSourceChoices.PAID:
        logger.info(
            "event=onboarding_trial_skipped reason=paid_plan_preserved user_id=%s signup_method=%s current_plan=%s",
            user.id,
            signup_method,
            user_config.plan,
        )
        return TrialApplyResult(applied=False, reason="paid_plan_preserved", plan=user_config.plan)

    old_plan = user_config.plan
    old_expires_at = user_config.plan_expires_at

    now = timezone.now()
    new_expire_at = now + timedelta(days=policy.trial_duration_days)

    user_config.plan = policy.trial_plan
    user_config.plan_expires_at = new_expire_at
    user_config.plan_source = UserConfig.PlanSourceChoices.ONBOARDING_TRIAL
    user_config.plan_assigned_at = now
    user_config.downgraded_at = None
    user_config.save(
        update_fields=[
            "plan",
            "plan_expires_at",
            "plan_source",
            "plan_assigned_at",
            "downgraded_at",
            "updated_at",
        ]
    )

    _create_plan_assignment_log(
        user=user,
        old_plan=old_plan,
        new_plan=user_config.plan,
        old_expires_at=old_expires_at,
        new_expires_at=user_config.plan_expires_at,
        reason=PlanAssignmentLog.ReasonChoices.SIGNUP_TRIAL,
        actor_type=PlanAssignmentLog.ActorTypeChoices.SYSTEM,
        actor_user=actor_user,
        metadata={
            "signup_method": signup_method,
            "policy_id": policy.id,
            "duration_days": policy.trial_duration_days,
        },
    )

    logger.info(
        "event=onboarding_trial_assigned user_id=%s policy_id=%s plan=%s expires_at=%s signup_method=%s",
        user.id,
        policy.id,
        user_config.plan,
        user_config.plan_expires_at.isoformat() if user_config.plan_expires_at else "",
        signup_method,
    )

    return TrialApplyResult(applied=True, reason="trial_applied", plan=user_config.plan)


@transaction.atomic
def process_expired_onboarding_trials(batch_size: int = 500, now=None) -> dict:
    current = now or timezone.now()
    policy = get_active_onboarding_policy(now=current)
    fallback_plan = (policy.fallback_plan if policy else UserConfig.PlanChoices.FREE)

    qs = (
        UserConfig.objects.select_for_update(skip_locked=True)
        .select_related("user")
        .filter(plan_source=UserConfig.PlanSourceChoices.ONBOARDING_TRIAL)
        .filter(plan_expires_at__isnull=False, plan_expires_at__lte=current)
        .filter(auto_downgrade_enabled=True, plan_locked_by_admin=False)
        .filter(user__is_superuser=False)
        .order_by("plan_expires_at")[: max(int(batch_size), 1)]
    )

    processed = 0
    downgraded = 0
    skipped = 0

    for cfg in qs:
        processed += 1
        old_plan = cfg.plan
        old_expires_at = cfg.plan_expires_at

        # Preserve paid plan in case source changed while waiting in queue.
        if cfg.plan_source == UserConfig.PlanSourceChoices.PAID:
            skipped += 1
            logger.info(
                "event=onboarding_trial_skipped reason=paid_plan_preserved user_id=%s stage=expiry",
                cfg.user_id,
            )
            continue

        cfg.plan = fallback_plan
        cfg.plan_expires_at = None
        cfg.plan_source = UserConfig.PlanSourceChoices.SYSTEM_DEFAULT
        cfg.downgraded_at = current
        cfg.save(update_fields=["plan", "plan_expires_at", "plan_source", "downgraded_at", "updated_at"])

        _create_plan_assignment_log(
            user=cfg.user,
            old_plan=old_plan,
            new_plan=cfg.plan,
            old_expires_at=old_expires_at,
            new_expires_at=None,
            reason=PlanAssignmentLog.ReasonChoices.TRIAL_EXPIRED,
            actor_type=PlanAssignmentLog.ActorTypeChoices.SYSTEM,
            actor_user=None,
            metadata={
                "fallback_plan": fallback_plan,
                "policy_id": policy.id if policy else None,
            },
        )
        downgraded += 1
        logger.info(
            "event=onboarding_trial_downgraded user_id=%s old_plan=%s new_plan=%s fallback_plan=%s",
            cfg.user_id,
            old_plan,
            cfg.plan,
            fallback_plan,
        )

    result = {
        "processed": processed,
        "downgraded": downgraded,
        "skipped": skipped,
        "fallback_plan": fallback_plan,
    }
    logger.info(
        "event=onboarding_trial_expiry_summary processed=%s downgraded=%s skipped=%s fallback_plan=%s",
        processed,
        downgraded,
        skipped,
        fallback_plan,
    )
    return result
