"""
OpenCore Celery Tasks

Async tasks chạy định kỳ để:
1. Sync DPI data
2. Generate invoices
3. Reset monthly quotas
4. Check license expiry
5. Process analytics
"""

from celery import shared_task
from celery.utils.log import get_task_logger
from django.contrib.auth.models import User
from django.utils import timezone
from django.core.mail import send_mail
from datetime import timedelta

from .opencore_dpi import DPILicense, DPIAuditLog, DPIUsageMetrics
from .opencore_analytics import DPIQuotaTracker, DPIAnalyticsSnapshot
from .opencore_revenue import DPIInvoice, generate_monthly_invoice, DPISubscription

logger = get_task_logger(__name__)


@shared_task(bind=True, max_retries=3)
def sync_all_dpi_licenses(self):
    """
    Daily sync of all DPI licenses.
    Check expiry, grace period, and status updates.
    """
    now = timezone.now()
    updated = 0
    expired = 0
    grace = 0
    
    try:
        licenses = DPILicense.objects.all()
        
        for license in licenses:
            old_status = license.status
            
            # Check if expired
            if license.status == 'active' and now > license.expiry_date:
                license.status = 'expired'
                license.is_in_grace = False
                expired += 1
                
                # Log the expiry
                DPIAuditLog.objects.create(
                    license=license,
                    action='license_expired',
                    created_by='system'
                )
            
            # Check grace period
            elif license.status == 'grace' and license.grace_until and now > license.grace_until:
                license.status = 'expired'
                expired += 1
            
            # Warn if approaching expiry (7 days)
            elif license.status == 'active':
                days_left = (license.expiry_date - now).days
                if days_left <= 7 and days_left > 0:
                    send_license_warning_email(license.user, days_left)
            
            if old_status != license.status:
                license.save()
                updated += 1
        
        logger.info(f"DPI sync complete: {updated} changed, {expired} expired")
        return {
            'status': 'success',
            'updated': updated,
            'expired': expired,
            'grace_period': grace
        }
    
    except Exception as exc:
        logger.error(f"Error in sync_all_dpi_licenses: {exc}")
        self.retry(exc=exc, countdown=60)


@shared_task(bind=True, max_retries=3)
def reset_monthly_quotas(self):
    """
    Reset monthly quotas on the 1st of each month.
    Called by Celery Beat on schedule.
    """
    now = timezone.now()
    if now.day != 1:
        logger.warning("reset_monthly_quotas called on non-1st day")
        return
    
    reset_count = 0
    try:
        quotas = DPIQuotaTracker.objects.all()
        
        for quota in quotas:
            # Create new quota for this month
            period_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
            period_end = (period_start + timedelta(days=32)).replace(day=1) - timedelta(seconds=1)
            
            quota.period_start = period_start
            quota.period_end = period_end
            quota.api_calls_used = 0
            quota.api_weight_used = 0
            quota.is_exceeded = False
            quota.warned_at = None
            quota.save()
            
            reset_count += 1
        
        logger.info(f"Reset {reset_count} monthly quotas")
        return {'status': 'success', 'reset_count': reset_count}
    
    except Exception as exc:
        logger.error(f"Error resetting quotas: {exc}")
        self.retry(exc=exc, countdown=60)


@shared_task(bind=True, max_retries=3)
def generate_monthly_invoices(self):
    """
    Generate invoices for all active subscriptions on monthly billing.
    Called on the last day of the month (or first day of next month).
    """
    now = timezone.now()
    created_count = 0
    
    try:
        subscriptions = DPISubscription.objects.filter(
            billing_cycle='monthly',
            auto_renew=True
        )
        
        for subscription in subscriptions:
            user = subscription.user
            
            # Get usage metrics
            quota = DPIQuotaTracker.get_or_create_current(user)
            
            # Generate invoice
            invoice = generate_monthly_invoice(user, quota.api_calls_used)
            if invoice:
                created_count += 1
                logger.info(f"Created invoice {invoice.invoice_number} for {user.username}")
        
        logger.info(f"Generated {created_count} invoices")
        return {'status': 'success', 'created_invoices': created_count}
    
    except Exception as exc:
        logger.error(f"Error generating invoices: {exc}")
        self.retry(exc=exc, countdown=300)


@shared_task(bind=True, max_retries=3)
def create_analytics_snapshots(self):
    """
    Create daily analytics snapshots for each user.
    Called once per day at midnight UTC.
    """
    now = timezone.now()
    snapshot_count = 0
    
    try:
        users = User.objects.filter(is_active=True)
        
        for user in users:
            # Get daily stats
            today = now.date()
            
            # Count API calls today
            api_calls = user.api_call_logs.filter(
                created_at__date=today
            ).count()
            
            # Count features used
            features_used = user.feature_usage.filter(
                updated_at__date=today
            ).count()
            
            # Create snapshot
            snapshot, created = DPIAnalyticsSnapshot.objects.get_or_create(
                user=user,
                snapshot_date=today,
                defaults={
                    'api_calls_today': api_calls,
                    'features_used': features_used,
                }
            )
            
            if created:
                snapshot_count += 1
        
        logger.info(f"Created {snapshot_count} analytics snapshots")
        return {'status': 'success', 'snapshots_created': snapshot_count}
    
    except Exception as exc:
        logger.error(f"Error creating snapshots: {exc}")
        self.retry(exc=exc, countdown=300)


@shared_task
def check_overquota_users():
    """
    Check for users exceeding quota and send warning/enforcement.
    """
    warn_threshold = 0.9  # Warn at 90%
    block_threshold = 1.0  # Block at 100%
    
    now = timezone.now()
    warned_count = 0
    blocked_count = 0
    
    try:
        quotas = DPIQuotaTracker.objects.filter(is_exceeded=False)
        
        for quota in quotas:
            usage_percent = quota.api_calls_used / quota.api_call_limit if quota.api_call_limit > 0 else 0
            
            # Warning at 90%
            if usage_percent >= warn_threshold and not quota.warned_at:
                quota.warned_at = now
                quota.save()
                send_quota_warning_email(quota.user, usage_percent)
                warned_count += 1
            
            # Block at 100%
            elif usage_percent >= block_threshold:
                quota.is_exceeded = True
                quota.save()
                send_quota_exceeded_email(quota.user)
                blocked_count += 1
        
        logger.info(f"Quota check: {warned_count} warned, {blocked_count} blocked")
        return {
            'status': 'success',
            'warned': warned_count,
            'blocked': blocked_count
        }
    except Exception as exc:
        logger.error(f"Error checking quotas: {exc}")


@shared_task
def cleanup_old_audit_logs():
    """
    Archive and delete old audit logs (>90 days).
    """
    cutoff_date = timezone.now() - timedelta(days=90)
    
    try:
        deleted_count, _ = DPIAuditLog.objects.filter(
            created_at__lt=cutoff_date
        ).delete()
        
        logger.info(f"Deleted {deleted_count} old audit logs")
        return {'status': 'success', 'deleted': deleted_count}
    except Exception as exc:
        logger.error(f"Error cleaning audit logs: {exc}")


# ============================================================================
# Helper functions
# ============================================================================

def send_license_warning_email(user: User, days_left: int):
    """Send license expiry warning email."""
    try:
        subject = f"Your vninvest license expires in {days_left} days"
        message = f"""
Hi {user.first_name or user.username},

Your vninvest license will expire in {days_left} days on {(timezone.now() + timedelta(days=days_left)).date()}.

To continue using premium features, please renew your subscription.
Visit: https://vninvest.com/account/subscription

Best regards,
vninvest Team
        """
        send_mail(subject, message, 'noreply@vninvest.com', [user.email])
        logger.info(f"Sent expiry warning to {user.username}")
    except Exception as e:
        logger.error(f"Error sending warning email to {user.username}: {e}")


def send_quota_warning_email(user: User, usage_percent: float):
    """Send quota warning email."""
    try:
        subject = "You're approaching your API quota limit"
        message = f"""
Hi {user.first_name or user.username},

You've used {usage_percent*100:.1f}% of your monthly API quota.

To avoid service interruption, consider upgrading your plan or waiting for next month.

Current plan: https://vninvest.com/account/subscription
        """
        send_mail(subject, message, 'noreply@vninvest.com', [user.email])
        logger.info(f"Sent quota warning to {user.username}")
    except Exception as e:
        logger.error(f"Error sending quota warning to {user.username}: {e}")


def send_quota_exceeded_email(user: User):
    """Send quota exceeded email."""
    try:
        subject = "Your API quota has been exceeded"
        message = f"""
Hi {user.first_name or user.username},

Your monthly API quota has been exceeded and your API access is temporarily limited.

To restore full access, please upgrade your plan or wait until next month.

Upgrade: https://vninvest.com/account/subscription
        """
        send_mail(subject, message, 'noreply@vninvest.com', [user.email])
        logger.info(f"Sent quota exceeded notice to {user.username}")
    except Exception as e:
        logger.error(f"Error sending exceeded email to {user.username}: {e}")
