"""
Identity & Access models for packages/core.

Mirrors the logical shape of CoreTenant, CoreServiceAccount, CorePATCredential
from backend/portfolio/models.py, but lives in its own bounded context.

ISOLATION RULE: No imports from backend.portfolio or backend.* are allowed here.
"""
import hashlib
import hmac
import os
import secrets

from django.contrib.auth.models import User
from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone


def _generate_public_id(prefix: str) -> str:
    """Generate a short unique public identifier."""
    return f'{prefix}_{secrets.token_hex(10)}'


def _build_pat_secret() -> str:
    """Generate a cryptographically secure PAT secret string."""
    return 'vni_' + secrets.token_urlsafe(48)


def _extract_pat_prefix(raw_secret: str) -> str:
    """Return the first 12 characters of the PAT as the indexable prefix."""
    return str(raw_secret or '')[:12]


def _hash_pat_secret(raw_secret: str) -> str:
    """HMAC-SHA256 hash of the PAT secret using a pepper from environment."""
    pepper = os.environ.get('CORE_PAT_PEPPER', 'dev-pat-pepper-replace-in-production')
    return hmac.new(pepper.encode(), raw_secret.encode(), hashlib.sha256).hexdigest()


class CoreTenant(models.Model):
    class StatusChoices(models.TextChoices):
        ACTIVE = 'active', 'Active'
        TRIAL = 'trial', 'Trial'
        SUSPENDED = 'suspended', 'Suspended'
        DEPROVISIONED = 'deprovisioned', 'Deprovisioned'
        PENDING_ACTIVATION = 'pending_activation', 'Pending Activation'

    class PlanChoices(models.TextChoices):
        FREE = 'free', 'Free'
        STARTER = 'starter', 'Starter'
        PRO = 'pro', 'Pro'
        ENTERPRISE = 'enterprise', 'Enterprise'
        CUSTOM = 'custom', 'Custom'
        INTERNAL = 'internal', 'Internal (Staff)'

    public_id = models.CharField(
        max_length=36,
        unique=True,
        db_index=True,
        editable=False,
        verbose_name='Tenant public UUID',
    )
    owner_user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name='core_tenant',
        verbose_name='Tenant owner',
    )
    tenant_code = models.CharField(
        max_length=96,
        unique=True,
        db_index=True,
        verbose_name='Tenant code',
    )
    display_name = models.CharField(max_length=120, verbose_name='Display name')
    plan = models.CharField(
        max_length=32,
        choices=PlanChoices.choices,
        default=PlanChoices.FREE,
        db_index=True,
    )
    status = models.CharField(
        max_length=32,
        choices=StatusChoices.choices,
        default=StatusChoices.ACTIVE,
        db_index=True,
    )
    features = models.JSONField(default=list, blank=True, verbose_name='Feature flags')
    trial_ends_at = models.DateTimeField(null=True, blank=True)
    activated_at = models.DateTimeField(null=True, blank=True)
    suspended_at = models.DateTimeField(null=True, blank=True)
    billing_period_start = models.DateField(null=True, blank=True)
    billing_period_end = models.DateField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Core Tenant'
        verbose_name_plural = 'Core Tenants'
        ordering = ['display_name', 'pk']
        indexes = [
            models.Index(fields=['status', 'plan']),
        ]

    def __str__(self):
        return f'{self.display_name} ({self.public_id})'

    @property
    def tenant_id(self) -> str:
        return self.public_id

    def save(self, *args, **kwargs):
        if not self.public_id:
            import uuid
            self.public_id = str(uuid.uuid4())
        super().save(*args, **kwargs)


class CoreServiceAccount(models.Model):
    class StatusChoices(models.TextChoices):
        ACTIVE = 'active', 'Active'
        DISABLED = 'disabled', 'Disabled'

    public_id = models.CharField(
        max_length=36,
        unique=True,
        db_index=True,
        editable=False,
        verbose_name='Service account public id',
    )
    tenant = models.ForeignKey(
        CoreTenant,
        on_delete=models.CASCADE,
        related_name='service_accounts',
        verbose_name='Tenant',
    )
    name = models.CharField(max_length=120, verbose_name='Service account name')
    status = models.CharField(
        max_length=24,
        choices=StatusChoices.choices,
        default=StatusChoices.ACTIVE,
        db_index=True,
    )
    scopes = models.JSONField(default=list, blank=True, verbose_name='Allowed scopes')
    metadata = models.JSONField(default=dict, blank=True, verbose_name='Non-sensitive metadata')
    last_rotated_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Core Service Account'
        verbose_name_plural = 'Core Service Accounts'
        ordering = ['-created_at', '-pk']
        indexes = [
            models.Index(fields=['tenant', 'status']),
        ]

    def __str__(self):
        return f'{self.name} ({self.status})'

    def save(self, *args, **kwargs):
        if not self.public_id:
            import uuid
            self.public_id = str(uuid.uuid4())
        super().save(*args, **kwargs)

    def clean(self):
        super().clean()
        if self.scopes is not None and not isinstance(self.scopes, list):
            raise ValidationError({'scopes': 'scopes must be a list.'})
        if self.metadata is not None and not isinstance(self.metadata, dict):
            raise ValidationError({'metadata': 'metadata must be an object.'})


class CorePATCredential(models.Model):
    class StatusChoices(models.TextChoices):
        ACTIVE = 'active', 'Active'
        REVOKED = 'revoked', 'Revoked'
        EXPIRED = 'expired', 'Expired'

    public_id = models.CharField(
        max_length=36,
        unique=True,
        db_index=True,
        editable=False,
        verbose_name='PAT public id',
    )
    service_account = models.ForeignKey(
        CoreServiceAccount,
        on_delete=models.CASCADE,
        related_name='pat_credentials',
        verbose_name='Service account',
    )
    label = models.CharField(max_length=120, blank=True, default='', verbose_name='Display label')
    token_prefix = models.CharField(max_length=12, verbose_name='Safe token prefix (12 chars)')
    token_secret_hash = models.CharField(max_length=64, verbose_name='Token secret HMAC-SHA256 hash')
    scopes = models.JSONField(default=list, blank=True, verbose_name='Effective scopes')
    status = models.CharField(
        max_length=24,
        choices=StatusChoices.choices,
        default=StatusChoices.ACTIVE,
        db_index=True,
    )
    expires_at = models.DateTimeField(null=True, blank=True)
    last_used_at = models.DateTimeField(null=True, blank=True)
    revoked = models.BooleanField(default=False, db_index=True)
    revoked_at = models.DateTimeField(null=True, blank=True)
    audit_reason = models.CharField(max_length=255, blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Core PAT Credential'
        verbose_name_plural = 'Core PAT Credentials'
        ordering = ['-created_at', '-pk']
        indexes = [
            models.Index(fields=['service_account', 'status']),
            models.Index(fields=['token_prefix']),
        ]

    def __str__(self):
        return f'{self.public_id or "pat"} ({self.status})'

    def save(self, *args, **kwargs):
        if not self.public_id:
            import uuid
            self.public_id = str(uuid.uuid4())
        super().save(*args, **kwargs)

    @property
    def effective_status(self) -> str:
        if self.revoked:
            return self.StatusChoices.REVOKED
        if self.expires_at and self.expires_at <= timezone.now():
            return self.StatusChoices.EXPIRED
        return self.status

    @classmethod
    def resolve_from_raw_secret(cls, raw_secret: str):
        """Resolve a PAT credential from raw secret. Returns credential or None."""
        secret = str(raw_secret or '').strip()
        if not secret:
            return None
        prefix = _extract_pat_prefix(secret)
        if not prefix:
            return None
        expected_hash = _hash_pat_secret(secret)
        candidates = (
            cls.objects
            .select_related('service_account', 'service_account__tenant')
            .filter(token_prefix=prefix, revoked=False)
            .order_by('-created_at')
        )
        for credential in candidates:
            if hmac.compare_digest(str(credential.token_secret_hash or ''), expected_hash):
                return credential
        return None

    @classmethod
    def issue_for_service_account(
        cls,
        *,
        service_account: 'CoreServiceAccount',
        scopes: list,
        expires_at=None,
        label: str = '',
        audit_reason: str = '',
    ):
        """Issue a new PAT and return (credential, raw_secret). raw_secret shown once only."""
        raw_secret = _build_pat_secret()
        credential = cls.objects.create(
            service_account=service_account,
            label=str(label or '').strip(),
            token_prefix=_extract_pat_prefix(raw_secret),
            token_secret_hash=_hash_pat_secret(raw_secret),
            scopes=list(scopes or []),
            expires_at=expires_at,
            audit_reason=str(audit_reason or '').strip(),
        )
        service_account.last_rotated_at = timezone.now()
        service_account.save(update_fields=['last_rotated_at', 'updated_at'])
        return credential, raw_secret

    def revoke_pat(self, *, reason: str = '') -> None:
        self.revoked = True
        self.revoked_at = timezone.now()
        self.status = self.StatusChoices.REVOKED
        self.audit_reason = str(reason or '').strip()
        self.save(update_fields=['revoked', 'revoked_at', 'status', 'audit_reason', 'updated_at'])


class UserProfile(models.Model):
    """
    Extended profile for a Django User within the SaaS core.

    Mirrors UserConfig from the legacy backend, but lives in core identity_access.
    Provides per-user display preferences and metadata for the SaaS platform.

    ISOLATION RULE: No FK to backend.portfolio models.
    """

    class LanguageChoices(models.TextChoices):
        VI = 'vi', 'Tiếng Việt'
        EN = 'en', 'English'

    class ThemeChoices(models.TextChoices):
        DARK = 'dark', 'Dark'
        LIGHT = 'light', 'Light'

    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name='core_profile',
        verbose_name='Người dùng',
    )
    tenant = models.ForeignKey(
        CoreTenant,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='user_profiles',
        verbose_name='Tenant',
    )
    display_name = models.CharField(max_length=120, blank=True, verbose_name='Tên hiển thị')
    language = models.CharField(
        max_length=8,
        choices=LanguageChoices.choices,
        default=LanguageChoices.VI,
        verbose_name='Ngôn ngữ',
    )
    theme = models.CharField(
        max_length=10,
        choices=ThemeChoices.choices,
        default=ThemeChoices.DARK,
        verbose_name='Chủ đề giao diện',
    )
    whale_alert_threshold = models.DecimalField(
        max_digits=12,
        decimal_places=0,
        default=500,
        verbose_name='Ngưỡng lệnh cá mập (triệu VNĐ)',
    )
    preferences = models.JSONField(default=dict, blank=True, verbose_name='Tuỳ chọn bổ sung')
    # Source field for migration tracking
    legacy_user_id = models.IntegerField(null=True, blank=True, db_index=True, verbose_name='Legacy user ID')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'User Profile'
        verbose_name_plural = 'User Profiles'

    def __str__(self) -> str:
        return f'UserProfile({self.user.username})'
