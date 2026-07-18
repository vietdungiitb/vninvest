"""Celery tasks for sending onboarding emails (welcome + invite)."""
from __future__ import annotations

import logging

from celery import shared_task
from django.conf import settings
from django.template.loader import render_to_string

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
    from identity_access.models import CoreTenant, UserProfile
    from identity_access.mail_service import send_system_email

    try:
        user_profile = UserProfile.objects.select_related('user').get(user__id=user_id)
        tenant = CoreTenant.objects.get(public_id=tenant_public_id)
    except (UserProfile.DoesNotExist, CoreTenant.DoesNotExist) as exc:
        logger.error('send_welcome_email: user=%s or tenant=%s not found', user_id, tenant_public_id)
        return {'status': 'skipped', 'reason': str(exc)}

    user = user_profile.user
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
    user_name = user_profile.display_name or user.email
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
    from identity_access.models import TenantInvite
    from identity_access.mail_service import send_system_email

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
