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
from datetime import timedelta

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
        ROTATING = 'rotating', 'Rotating'
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
    is_human_session = models.BooleanField(default=False, db_index=True)
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
        is_human_session: bool = False,
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
            is_human_session=bool(is_human_session),
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

    def mark_rotating(self, *, grace_period_seconds: int = 3600, reason: str = ''):
        grace_seconds = max(0, int(grace_period_seconds or 0))
        if grace_seconds == 0:
            self.revoke_pat(reason=reason)
            return None

        grace_until = timezone.now() + timedelta(seconds=grace_seconds)
        if self.expires_at and self.expires_at < grace_until:
            grace_until = self.expires_at

        self.status = self.StatusChoices.ROTATING
        self.expires_at = grace_until
        self.audit_reason = str(reason or '').strip()
        self.save(update_fields=['status', 'expires_at', 'audit_reason', 'updated_at'])
        return grace_until


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


class TenantMember(models.Model):
    """
    Represents a user's membership in a tenant.
    
    Owner is implicitly a member (CoreTenant.owner_user) and is not required
    to have a TenantMember row. Other users become members by accepting invites.
    """
    class RoleChoices(models.TextChoices):
        OWNER = 'owner', 'Owner'
        ADMIN = 'admin', 'Admin'
        EDITOR = 'editor', 'Editor'
        VIEWER = 'viewer', 'Viewer'

    public_id = models.CharField(
        max_length=36,
        unique=True,
        db_index=True,
        editable=False,
    )
    tenant = models.ForeignKey(
        CoreTenant,
        on_delete=models.CASCADE,
        related_name='members',
    )
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='tenant_memberships',
    )
    role = models.CharField(
        max_length=32,
        choices=RoleChoices.choices,
        default=RoleChoices.VIEWER,
        db_index=True,
    )
    invited_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='tenant_invitations_sent',
    )
    joined_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Tenant Member'
        verbose_name_plural = 'Tenant Members'
        unique_together = [('tenant', 'user')]
        indexes = [
            models.Index(fields=['tenant', 'role']),
            models.Index(fields=['user', 'tenant']),
        ]

    def __str__(self) -> str:
        return f'{self.user.username} → {self.tenant.display_name} ({self.role})'

    def save(self, *args, **kwargs):
        if not self.public_id:
            import uuid
            self.public_id = str(uuid.uuid4())
        super().save(*args, **kwargs)


class TenantInvite(models.Model):
    """
    Represents a pending invitation for a user to join a tenant.
    
    Owner generates an invite token, sends it to the invitee (email), and 
    invitee accepts via `POST /api/core/v1/tenant-members/invites/{token}/accept/`.
    """
    class StatusChoices(models.TextChoices):
        PENDING = 'pending', 'Pending'
        ACCEPTED = 'accepted', 'Accepted'
        DECLINED = 'declined', 'Declined'
        EXPIRED = 'expired', 'Expired'

    public_id = models.CharField(
        max_length=36,
        unique=True,
        db_index=True,
        editable=False,
    )
    tenant = models.ForeignKey(
        CoreTenant,
        on_delete=models.CASCADE,
        related_name='invites',
    )
    invited_email = models.EmailField(max_length=254)
    invited_user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='tenant_invites_received',
    )
    inviter = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='tenant_invites_sent',
    )
    token = models.CharField(max_length=64, unique=True, db_index=True)
    role = models.CharField(
        max_length=32,
        choices=TenantMember.RoleChoices.choices,
        default=TenantMember.RoleChoices.VIEWER,
    )
    status = models.CharField(
        max_length=32,
        choices=StatusChoices.choices,
        default=StatusChoices.PENDING,
        db_index=True,
    )
    expires_at = models.DateTimeField()
    accepted_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Tenant Invite'
        verbose_name_plural = 'Tenant Invites'
        indexes = [
            models.Index(fields=['tenant', 'status']),
            models.Index(fields=['invited_email', 'status']),
        ]

    def __str__(self) -> str:
        return f'Invite {self.invited_email} → {self.tenant.display_name} ({self.status})'

    def save(self, *args, **kwargs):
        if not self.public_id:
            import uuid
            self.public_id = str(uuid.uuid4())
        super().save(*args, **kwargs)

    @property
    def is_expired(self) -> bool:
        """Check if invite token has expired."""
        return timezone.now() > self.expires_at

    @classmethod
    def generate_token(cls) -> str:
        """Generate a secure 64-char invite token."""
        return secrets.token_urlsafe(48)


class PasswordResetToken(models.Model):
    """
    Model to persist password reset tokens securely in database.
    
    Replaces in-memory token store to survive application restarts.
    Tokens are HMAC-hashed for security and deleted after use or expiration.
    """
    
    email = models.EmailField(
        max_length=254,
        db_index=True,
        verbose_name='Email',
    )
    token_hash = models.CharField(
        max_length=64,
        unique=True,
        db_index=True,
        verbose_name='Token HMAC-SHA256 hash',
    )
    created_at = models.DateTimeField(
        auto_now_add=True,
        db_index=True,
        verbose_name='Created at',
    )
    expires_at = models.DateTimeField(
        db_index=True,
        verbose_name='Expires at',
    )
    used = models.BooleanField(
        default=False,
        db_index=True,
        verbose_name='Token has been used',
    )
    used_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name='Timestamp token was used',
    )
    
    class Meta:
        verbose_name = 'Password Reset Token'
        verbose_name_plural = 'Password Reset Tokens'
        indexes = [
            models.Index(fields=['email', 'expires_at', 'used']),
        ]
        ordering = ['-created_at']
    
    def __str__(self) -> str:
        status = 'used' if self.used else ('expired' if self.is_expired else 'valid')
        return f'{self.email} ({status})'
    
    @property
    def is_expired(self) -> bool:
        """Check if token has expired."""
        return timezone.now() > self.expires_at
    
    @property
    def is_valid(self) -> bool:
        """Check if token is still valid (not used, not expired)."""
        return not self.used and not self.is_expired
    
    @classmethod
    def generate_and_save(cls, email: str, hours: int = 1) -> tuple:
        """
        Generate a new password reset token and save it.
        
        Returns: (token_object, raw_token_string)
        Note: raw_token_string is shown only once and should be sent via email.
        """
        raw_token = secrets.token_urlsafe(32)
        token_hash = hashlib.sha256(raw_token.encode()).hexdigest()
        
        token_obj = cls.objects.create(
            email=email,
            token_hash=token_hash,
            expires_at=timezone.now() + timezone.timedelta(hours=hours),
        )
        return token_obj, raw_token
    
    @classmethod
    def verify_and_mark_used(cls, raw_token: str) -> 'PasswordResetToken':
        """
        Verify a raw token, check validity, and mark as used.
        
        Returns: token object if valid, raises ValueError otherwise.
        """
        if not raw_token:
            raise ValueError('Token is required')
        
        token_hash = hashlib.sha256(raw_token.encode()).hexdigest()
        try:
            token = cls.objects.get(token_hash=token_hash)
        except cls.DoesNotExist:
            raise ValueError('Invalid or revoked token')
        
        if token.used:
            raise ValueError('Token has already been used')
        
        if token.is_expired:
            raise ValueError('Token has expired')
        
        # Mark as used
        token.used = True
        token.used_at = timezone.now()
        token.save(update_fields=['used', 'used_at'])
        return token
    
    @classmethod
    def cleanup_expired(cls) -> int:
        """Delete all expired tokens. Returns count deleted."""
        expired_count, _ = cls.objects.filter(
            expires_at__lt=timezone.now(),
            used=False
        ).delete()
        return expired_count


# ---------------------------------------------------------------------------
# DNSE Backfill Credentials (D02)
# ---------------------------------------------------------------------------

def _get_fernet():
    """Trả về Fernet instance từ DNSE_CREDENTIAL_FERNET_KEY env var. Raise nếu thiếu key."""
    from cryptography.fernet import Fernet
    key = os.environ.get('DNSE_CREDENTIAL_FERNET_KEY', '').strip()
    if not key:
        raise RuntimeError('DNSE_CREDENTIAL_FERNET_KEY env var is required but not set')
    return Fernet(key.encode() if isinstance(key, str) else key)


def _encrypt_credential(plaintext: str) -> bytes:
    """Mã hoá credential string → Fernet bytes. Raise nếu thiếu key."""
    if not plaintext:
        raise ValueError('Credential plaintext must not be empty')
    return _get_fernet().encrypt(plaintext.encode('utf-8'))


def _decrypt_credential(ciphertext: bytes) -> str:
    """Giải mã Fernet bytes → plaintext string. Raise nếu sai key hoặc corrupt."""
    return _get_fernet().decrypt(ciphertext).decode('utf-8')


class UserDNSECredential(models.Model):
    """
    Lưu trữ DNSE API credential của user (hoặc system provider) dưới dạng Fernet-encrypted.

    Hard rules (AGENTS.md §14):
    - Không log api_key / api_secret ở bất kỳ đâu.
    - is_system_provider=True chỉ admin (is_staff) được set — enforce ở view layer.
    - DNSE_CREDENTIAL_FERNET_KEY là bắt buộc trong environment.
    - Credential không được truyền qua Celery args — task chỉ nhận user_id.
    """

    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name='core_dnse_credential',
        verbose_name='Người dùng',
    )
    api_key_encrypted = models.BinaryField(verbose_name='API Key (Fernet-encrypted)')
    api_secret_encrypted = models.BinaryField(verbose_name='API Secret (Fernet-encrypted)')
    is_system_provider = models.BooleanField(
        default=False,
        db_index=True,
        verbose_name='Là system provider (chỉ admin set)',
    )
    is_verified = models.BooleanField(
        default=False,
        verbose_name='Đã xác minh kết nối DNSE',
    )
    last_verified_at = models.DateTimeField(null=True, blank=True, verbose_name='Xác minh lần cuối')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'User DNSE Credential'
        verbose_name_plural = 'User DNSE Credentials'
        constraints = [
            models.UniqueConstraint(
                fields=['is_system_provider'],
                condition=models.Q(is_system_provider=True),
                name='unique_active_system_provider',
            ),
        ]

    def __str__(self) -> str:
        tag = '[SYSTEM]' if self.is_system_provider else ''
        return f'UserDNSECredential({self.user.username}{tag})'

    def set_credentials(self, api_key: str, api_secret: str) -> None:
        """Mã hoá và lưu api_key, api_secret. Không log giá trị thực."""
        self.api_key_encrypted = _encrypt_credential(api_key)
        self.api_secret_encrypted = _encrypt_credential(api_secret)

    def get_api_key(self) -> str:
        """Giải mã và trả về api_key. Raise nếu sai key."""
        return _decrypt_credential(bytes(self.api_key_encrypted))

    def get_api_secret(self) -> str:
        """Giải mã và trả về api_secret. Raise nếu sai key."""
        return _decrypt_credential(bytes(self.api_secret_encrypted))


def get_system_provider_credentials() -> 'tuple[str, str] | None':
    """
    Trả về (client_id, client_secret) của admin system provider từ
    user_workspace.DNSECredential — dùng credential của admin is_staff=True.
    Task backfill phải abort khi hàm này trả về None.
    """
    try:
        from user_workspace.models import DNSECredential as _WorkspaceDNSECred
        cred = (
            _WorkspaceDNSECred.objects
            .filter(user__is_staff=True, is_active=True)
            .select_related('user')
            .order_by('user__date_joined')
            .first()
        )
        if cred is None:
            return None
        return cred.get_client_id(), cred.get_client_secret()
    except Exception:
        return None


# ---------------------------------------------------------------------------
# SaaS Native User Registration & Dynamic Mail System (Slice 1)
# ---------------------------------------------------------------------------
import uuid
from vninvest_core.utils.crypto import encrypt_secret, decrypt_secret

class SystemMailConfig(models.Model):
    PROVIDER_SMTP = 'smtp'
    PROVIDER_GMAIL = 'gmail_api'
    PROVIDER_CHOICES = [
        (PROVIDER_SMTP, 'SMTP Server'),
        (PROVIDER_GMAIL, 'Google Gmail API (Service Account DWD)'),
    ]

    class TestStatusChoices(models.TextChoices):
        NEVER = 'never', 'Chưa kiểm tra'
        SUCCESS = 'success', 'Thành công'
        FAILED = 'failed', 'Thất bại'

    name = models.CharField(max_length=120, blank=True, default='', verbose_name='Tên cấu hình')

    provider = models.CharField(
        max_length=24,
        choices=PROVIDER_CHOICES,
        default=PROVIDER_SMTP,
        verbose_name="Mail Provider"
    )
    is_active = models.BooleanField(default=False, db_index=True, verbose_name="Active Configuration")
    from_email = models.EmailField(max_length=255, verbose_name="Sender Email (From)")
    from_name = models.CharField(max_length=255, blank=True, default='', verbose_name='Sender Name')
    reply_to_email = models.EmailField(max_length=255, blank=True, default='', verbose_name='Reply-To Email')
    timeout_seconds = models.IntegerField(default=20, verbose_name='Timeout (seconds)')
    
    # SMTP Parameters
    smtp_host = models.CharField(max_length=255, blank=True, null=True, verbose_name="SMTP Host")
    smtp_port = models.IntegerField(default=587, blank=True, null=True, verbose_name="SMTP Port")
    smtp_username = models.CharField(max_length=255, blank=True, null=True, verbose_name="SMTP Username")
    smtp_password_encrypted = models.BinaryField(blank=True, null=True, verbose_name="SMTP Password (Encrypted)")
    smtp_use_tls = models.BooleanField(default=True, verbose_name="Use TLS")
    smtp_use_ssl = models.BooleanField(default=False, verbose_name="Use SSL")

    # Google API Service Account Parameters
    google_service_account_json_encrypted = models.BinaryField(blank=True, null=True, verbose_name="Service Account JSON (Encrypted)")
    google_delegated_user_email = models.EmailField(max_length=255, blank=True, null=True, verbose_name="Delegated Admin Email")
    google_client_id = models.CharField(max_length=255, blank=True, default='', verbose_name='Google Client ID')
    google_client_secret_encrypted = models.BinaryField(blank=True, null=True, verbose_name='Google Client Secret (Encrypted)')
    google_refresh_token_encrypted = models.BinaryField(blank=True, null=True, verbose_name='Google Refresh Token (Encrypted)')
    google_account_email = models.EmailField(max_length=255, blank=True, default='', verbose_name='Google Account Email')
    google_token_scope = models.TextField(blank=True, default='', verbose_name='Google OAuth Scope')
    oauth_connected_at = models.DateTimeField(null=True, blank=True, verbose_name='OAuth Connected At')
    token_last_refreshed_at = models.DateTimeField(null=True, blank=True, verbose_name='Token Last Refreshed At')
    token_last_error = models.TextField(blank=True, default='', verbose_name='Token Last Error')

    # Test Result Fields
    last_tested_at = models.DateTimeField(null=True, blank=True, verbose_name='Last tested at')
    last_test_status = models.CharField(
        max_length=20,
        choices=TestStatusChoices.choices,
        default=TestStatusChoices.NEVER,
        verbose_name='Last test status',
    )
    last_test_message = models.TextField(blank=True, default='', verbose_name='Last test message')

    # Audit Trail Fields
    last_modified_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='mail_configs_modified',
        verbose_name="Last modified by staff"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'core_system_mail_config'
        verbose_name = 'System Mail Configuration'
        verbose_name_plural = 'System Mail Configurations'
        constraints = [
            # SQL level constraint: Chỉ cho phép duy nhất 1 bản ghi có is_active=True
            models.UniqueConstraint(
                fields=['is_active'],
                condition=models.Q(is_active=True),
                name='unique_active_system_mail_config'
            )
        ]

    def __str__(self) -> str:
        label = self.name.strip() or self.from_name.strip() or self.from_email
        return f'{self.provider} Config ({label}) - Active={self.is_active}'

    def set_smtp_password(self, password: str):
        self.smtp_password_encrypted = encrypt_secret(password) if password else None

    def get_smtp_password(self) -> str:
        return decrypt_secret(self.smtp_password_encrypted) if self.smtp_password_encrypted else ""

    def set_google_client_secret(self, secret: str):
        self.google_client_secret_encrypted = encrypt_secret(secret) if secret else None

    def get_google_client_secret(self) -> str:
        return decrypt_secret(self.google_client_secret_encrypted) if self.google_client_secret_encrypted else ''

    def set_google_refresh_token(self, token: str):
        self.google_refresh_token_encrypted = encrypt_secret(token) if token else None

    def get_google_refresh_token(self) -> str:
        return decrypt_secret(self.google_refresh_token_encrypted) if self.google_refresh_token_encrypted else ''

    def clear_google_refresh_token(self):
        self.google_refresh_token_encrypted = None

    def set_google_service_account_json(self, json_str: str):
        self.google_service_account_json_encrypted = encrypt_secret(json_str) if json_str else None

    def get_google_service_account_json(self) -> str:
        return decrypt_secret(self.google_service_account_json_encrypted) if self.google_service_account_json_encrypted else ""

    @property
    def has_google_oauth_credentials(self) -> bool:
        return bool(self.google_client_id and self.get_google_client_secret())

    @property
    def has_google_refresh_token(self) -> bool:
        return bool(self.get_google_refresh_token())

    @property
    def has_google_service_account(self) -> bool:
        return bool(self.get_google_service_account_json())

    def clean(self):
        super().clean()
        if self.provider == self.PROVIDER_SMTP:
            if not all([self.smtp_host, self.smtp_port, self.smtp_username]):
                raise ValidationError("Cấu hình SMTP yêu cầu điền đầy đủ host, port và username.")
        elif self.provider == self.PROVIDER_GMAIL:
            has_oauth_fields = bool(self.google_client_id or self.google_client_secret_encrypted or self.google_refresh_token_encrypted)
            has_dwd_fields = bool(self.google_service_account_json_encrypted or self.google_delegated_user_email)

            if has_oauth_fields:
                if not self.google_client_id:
                    raise ValidationError("Cấu hình Google OAuth2 yêu cầu Google Client ID.")
                if not self.google_client_secret_encrypted:
                    raise ValidationError("Cấu hình Google OAuth2 yêu cầu Google Client Secret.")
            elif has_dwd_fields:
                if not self.google_delegated_user_email:
                    raise ValidationError("Cấu hình Google Gmail API yêu cầu đầy đủ Email ủy quyền (DWD).")
            else:
                raise ValidationError("Cấu hình Google Gmail API yêu cầu bộ thông tin OAuth2 hoặc Service Account DWD.")


class OutboxEvent(models.Model):
    STATUS_PENDING = 'pending'
    STATUS_PROCESSED = 'processed'
    STATUS_FAILED = 'failed'
    STATUS_CHOICES = [
        (STATUS_PENDING, 'Pending'),
        (STATUS_PROCESSED, 'Processed'),
        (STATUS_FAILED, 'Failed'),
    ]

    event_id = models.UUIDField(default=uuid.uuid4, unique=True, primary_key=True, editable=False)
    event_type = models.CharField(max_length=100, db_index=True)
    payload = models.JSONField(verbose_name="Event JSON Payload")
    status = models.CharField(max_length=24, choices=STATUS_CHOICES, default=STATUS_PENDING, db_index=True)
    retry_count = models.IntegerField(default=0)
    last_error = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    processed_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        db_table = 'core_outbox_event'
        ordering = ['created_at']
        verbose_name = 'Outbox Event'
        verbose_name_plural = 'Outbox Events'

    def __str__(self) -> str:
        return f'Event {self.event_type} ({self.status})'


class ProcessedEvent(models.Model):
    event_id = models.UUIDField(unique=True, primary_key=True, editable=False)
    processed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'core_processed_event'
        verbose_name = 'Processed Event'
        verbose_name_plural = 'Processed Events'

    def __str__(self) -> str:
        return f'Processed {self.event_id}'


class MailConfigAuditLog(models.Model):
    operator_user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='mail_config_audits')
    action = models.CharField(max_length=50) # create, update, activate, deactivate
    target_config_id = models.IntegerField()
    description = models.TextField()
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'core_mail_config_audit_log'
        ordering = ['-timestamp']
        verbose_name = 'Mail Config Audit Log'
        verbose_name_plural = 'Mail Config Audit Logs'

    def __str__(self) -> str:
        return f'{self.operator_user.username} - {self.action} - Config ID {self.target_config_id}'


class EmailVerificationToken(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='email_verification_tokens')
    token_hash = models.CharField(max_length=64, unique=True, db_index=True) # SHA-256 hash of token
    is_used = models.BooleanField(default=False)
    attempts = models.IntegerField(default=0)
    expires_at = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'core_email_verification_token'
        verbose_name = 'Email Verification Token'
        verbose_name_plural = 'Email Verification Tokens'

    def __str__(self) -> str:
        return f'Token for {self.user.username} - Used: {self.is_used}'

