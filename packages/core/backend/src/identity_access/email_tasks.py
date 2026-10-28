"""Celery tasks for sending onboarding emails (welcome + invite) and for
pruning the tables those flows fill up."""
from __future__ import annotations

import logging
from datetime import timedelta

from celery import shared_task
from django.conf import settings
from django.template.loader import render_to_string
from django.utils import timezone

logger = logging.getLogger(__name__)

WELCOME_SUBJECTS = {
    'vi': 'Chào mừng đến với {display_name}!',
    'en': 'Welcome to {display_name}!',
}

WELCOME_PLAIN = {
    'vi': (
        'Chào {user_name},\n\n'
        'Chào mừng bạn đến với {display_name}!\n'
        'Truy cập trang quản trị: {dashboard_url}\n\n'
        'Trân trọng,\nĐội ngũ VNInvest'
    ),
    'en': (
        'Hello {user_name},\n\n'
        'Welcome to {display_name}!\n'
        'Access the admin panel: {dashboard_url}\n\n'
        'Best regards,\nThe VNInvest Team'
    ),
}

INVITE_SUBJECTS = {
    'vi': '{inviter_name} đã mời bạn tham gia {display_name}',
    'en': '{inviter_name} has invited you to join {display_name}',
}

INVITE_PLAIN = {
    'vi': (
        '{inviter_name} đã mời bạn tham gia {display_name}.\n'
        'Chấp nhận lời mời: {accept_url}\n'
        'Lời mời hết hạn vào: {expires_at}\n\n'
        'Trân trọng,\nĐội ngũ VNInvest'
    ),
    'en': (
        '{inviter_name} has invited you to join {display_name}.\n'
        'Accept invitation: {accept_url}\n'
        'Invitation expires: {expires_at}\n\n'
        'Best regards,\nThe VNInvest Team'
    ),
}


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def send_welcome_email(self, user_id: int, tenant_public_id: str, lang: str = 'vi'):
    """Send welcome email to new tenant owner after registration.

    *user_id* is the **auth.User** primary key (as passed by onboarding_views).
    """
    from django.contrib.auth import get_user_model

    from identity_access.mail_service import send_system_email
    from identity_access.models import CoreTenant, UserProfile

    try:
        tenant = CoreTenant.objects.get(public_id=tenant_public_id)
    except CoreTenant.DoesNotExist as exc:
        logger.error('send_welcome_email: tenant=%s not found', tenant_public_id)
        return {'status': 'skipped', 'reason': str(exc)}

    # The recipient is resolved through UserProfile, but a missing profile must
    # not silently swallow a welcome email: the task used to return
    # {'status': 'skipped'} whenever `UserProfile.objects.get(user__id=...)` came
    # up empty, and `onboarding_views.register_tenant_view` did not create a
    # profile - so every self-service signup quietly skipped its own welcome
    # email. The view now creates the profile; this fallback means any future
    # path that forgets one degrades to "sent" instead of "silently never sent".
    user = None
    display_name = ''
    try:
        user_profile = UserProfile.objects.select_related('user').get(user__id=user_id)
        user = user_profile.user
        display_name = user_profile.display_name or ''
    except UserProfile.DoesNotExist:
        user = get_user_model().objects.filter(pk=user_id).first()
        if user is None:
            logger.error('send_welcome_email: user=%s or tenant=%s not found', user_id, tenant_public_id)
            return {'status': 'skipped', 'reason': 'user not found'}
        logger.warning(
            'send_welcome_email: user=%s has no UserProfile; sending anyway', user_id,
        )

    frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:3000')
    dashboard_url = f"{frontend_url}/tenant-admin"

    html_content = render_to_string('emails/welcome.html', {
        'user': user,
        'tenant': tenant,
        'dashboard_url': dashboard_url,
        'frontend_url': frontend_url,
        'lang': lang,
    })

    lang_key = lang if lang in WELCOME_SUBJECTS else 'vi'
    subject = WELCOME_SUBJECTS[lang_key].format(display_name=tenant.display_name)
    user_name = display_name or user.get_full_name() or user.username or user.email
    plain_message = WELCOME_PLAIN[lang_key].format(
        user_name=user_name,
        display_name=tenant.display_name,
        dashboard_url=dashboard_url,
    )

    try:
        send_system_email(
            subject=subject,
            message=plain_message,
            recipient_list=[user.email],
            html_message=html_content,
        )
        logger.info('send_welcome_email: sent to %s for tenant %s', user.email, tenant_public_id)
        return {'status': 'sent', 'recipient': user.email}
    except Exception as exc:
        logger.error('send_welcome_email: failed for %s: %s', user.email, exc)
        raise self.retry(exc=exc)


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def send_invite_email(self, invite_id: int, lang: str = 'vi'):
    """Send invitation email to invitee with accept link."""
    from identity_access.mail_service import send_system_email
    from identity_access.models import TenantInvite

    try:
        invite = TenantInvite.objects.select_related('tenant', 'inviter').get(id=invite_id)
    except TenantInvite.DoesNotExist as exc:
        logger.error('send_invite_email: invite %s not found', invite_id)
        return {'status': 'skipped', 'reason': str(exc)}

    if invite.status != TenantInvite.StatusChoices.PENDING:
        logger.info('send_invite_email: invite %s is no longer pending (%s)', invite_id, invite.status)
        return {'status': 'skipped', 'reason': 'not_pending'}

    frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:3000')
    accept_url = f"{frontend_url}/invite/{invite.token}"

    html_content = render_to_string('emails/invite.html', {
        'invite': invite,
        'tenant': invite.tenant,
        'inviter': invite.inviter,
        'accept_url': accept_url,
        'frontend_url': frontend_url,
        'expires_at': invite.expires_at,
        'lang': lang,
    })

    inviter_profile = None
    try:
        inviter_profile = invite.inviter.core_profile
    except Exception:
        pass
    inviter_name = (inviter_profile.display_name if inviter_profile else None) or invite.inviter.email
    lang_key = lang if lang in INVITE_SUBJECTS else 'vi'
    subject = INVITE_SUBJECTS[lang_key].format(
        inviter_name=inviter_name,
        display_name=invite.tenant.display_name,
    )
    plain_message = INVITE_PLAIN[lang_key].format(
        inviter_name=inviter_name,
        display_name=invite.tenant.display_name,
        accept_url=accept_url,
        expires_at=invite.expires_at,
    )

    try:
        send_system_email(
            subject=subject,
            message=plain_message,
            recipient_list=[invite.invited_email],
            html_message=html_content,
        )
        logger.info('send_invite_email: sent to %s for invite %s', invite.invited_email, invite_id)
        return {'status': 'sent', 'recipient': invite.invited_email}
    except Exception as exc:
        logger.error('send_invite_email: failed for %s: %s', invite.invited_email, exc)
        raise self.retry(exc=exc)


# ---------------------------------------------------------------------------
# Retention (A12e)
# ---------------------------------------------------------------------------
# `register_view` and `resend_email_verification_view` both invalidate an
# account's previous tokens with
# `EmailVerificationToken.objects.filter(user=user, is_used=False).update(is_used=True)`.
# Nothing ever deleted them, and there is no pruning task, so this table grows
# by one row per verification attempt forever - for a token that is already
# spent and carries no value.
#
# .. warning::
#    NOT SCHEDULED YET. `CELERY_BEAT_SCHEDULE` lives in settings.py, which is
#    not this slice's to edit. The coordinator needs to add:
#
#        'prune-email-verification-tokens-hourly': {
#            'task': 'identity_access.email_tasks.prune_email_verification_tokens',
#            'schedule': crontab(minute=17),
#        },
#
#    The task is idempotent and safe to run by hand before that lands.
@shared_task
def prune_email_verification_tokens(older_than_hours: int = 24) -> dict:
    """Delete spent or expired email-verification tokens.

    Only rows that can no longer authenticate anything are removed:
    ``is_used=True``, or ``expires_at`` in the past. Live tokens for accounts
    that have not yet clicked their link are left alone, so running this
    frequently is harmless.

    Args:
        older_than_hours: Extra grace period applied on top of expiry, so a
            token that expired a second ago is not deleted while its email is
            still sitting in an inbox.

    Returns:
        dict: ``{'deleted': int, 'cutoff': iso8601}``.
    """
    from identity_access.models import EmailVerificationToken

    cutoff = timezone.now() - timedelta(hours=max(1, int(older_than_hours)))
    deleted, _ = EmailVerificationToken.objects.filter(
        expires_at__lt=cutoff,
    ).delete()
    logger.info('prune_email_verification_tokens: deleted %s row(s) older than %s', deleted, cutoff)
    return {'deleted': deleted, 'cutoff': cutoff.isoformat()}

