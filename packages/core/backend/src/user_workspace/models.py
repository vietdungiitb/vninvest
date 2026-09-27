"""
User Workspace domain models for packages/core.

Portfolio, Transaction, Watchlist/WatchlistItem replacing legacy counterparts.

ISOLATION RULE: No imports from backend.portfolio or backend.* allowed.
TENANT ISOLATION: All user-scoped models now have explicit tenant FK to identity_access.CoreTenant.
"""
import logging
from decimal import Decimal

from django.contrib.auth.models import User
from django.core.exceptions import ValidationError
from django.core.validators import MinValueValidator
from django.db import models
from django.db.models import Q
from django.utils import timezone

logger = logging.getLogger(__name__)


class Portfolio(models.Model):
    """
    Danh mục đầu tư của một người dùng trong core SaaS.
    Mirrors legacy Portfolio model.
    TENANT ISOLATION: explicit FK to CoreTenant via tenant field.
    """

    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='core_portfolios',
        verbose_name='Người dùng',
    )
    tenant = models.ForeignKey(
        'identity_access.CoreTenant',
        on_delete=models.CASCADE,
        related_name='core_portfolios',
        null=False,
        blank=True,
        verbose_name='Người dùng SaaS (Tenant)',
        help_text='Tenant owner of this portfolio. Must be set after migration.',
    )
    name = models.CharField(max_length=100, verbose_name='Tên danh mục')
    description = models.TextField(blank=True, default='', verbose_name='Mô tả')
    is_default = models.BooleanField(default=False, verbose_name='Danh mục mặc định')
    # Migration tracking
    legacy_portfolio_id = models.IntegerField(null=True, blank=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Ngày tạo')
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Danh mục đầu tư'
        verbose_name_plural = 'Danh mục đầu tư'
        ordering = ['-created_at']

    def __str__(self) -> str:
        return f'{self.name} ({self.user.username})'


class Transaction(models.Model):
    """
    Giao dịch trong danh mục đầu tư core SaaS.

    P0-DATA-02: enforce giá/khối lượng/phí/thuế ở tầng model.
    - `MinValueValidator` trên field ⇒ chặn âm ở **mọi** loại lệnh, và DRF
      `ModelSerializer` tự kế thừa (nên API chặn luôn, không cần sửa
      `serializers.py`).
    - `clean()` bổ sung luật theo loại: BUY/SELL bắt buộc `quantity > 0` và
      `price > 0`. `DIVIDEND` là cash flow (plan D-06 — cổ tức KHÔNG giảm cost
      basis) nên không ép giá > 0.
    - Oversell **không** kiểm ở đây: model không đủ ngữ cảnh portfolio/ledger
      (plan `IMPLEMENTATION_PLAN_PORTFOLIO_COMMERCIAL_HARDENING_20260925.md:277`).
    """

    class TransactionType(models.TextChoices):
        BUY = 'BUY', 'Mua'
        SELL = 'SELL', 'Bán'
        DIVIDEND = 'DIVIDEND', 'Cổ tức tiền mặt'

    portfolio = models.ForeignKey(
        Portfolio,
        on_delete=models.CASCADE,
        related_name='transactions',
        verbose_name='Danh mục',
    )
    tenant = models.ForeignKey(
        'identity_access.CoreTenant',
        on_delete=models.CASCADE,
        related_name='transactions',
        null=False,
        blank=True,
        verbose_name='Người dùng SaaS (Tenant)',
        help_text='Tenant owner. Set from portfolio.tenant or directly.',
        db_index=True,
    )
    symbol = models.CharField(max_length=32, db_index=True, verbose_name='Mã cổ phiếu')
    transaction_type = models.CharField(
        max_length=10,
        choices=TransactionType.choices,
        verbose_name='Loại lệnh',
    )
    date = models.DateField(db_index=True, verbose_name='Ngày giao dịch')
    price = models.DecimalField(
        max_digits=18,
        decimal_places=2,
        validators=[MinValueValidator(Decimal('0'))],
        verbose_name='Giá khớp (VNĐ)',
    )
    quantity = models.BigIntegerField(
        validators=[MinValueValidator(0)],
        verbose_name='Số lượng cổ phiếu',
    )
    fee = models.DecimalField(
        max_digits=18,
        decimal_places=2,
        default=0,
        validators=[MinValueValidator(Decimal('0'))],
        verbose_name='Phí giao dịch',
    )
    tax = models.DecimalField(
        max_digits=18,
        decimal_places=2,
        default=0,
        validators=[MinValueValidator(Decimal('0'))],
        verbose_name='Thuế',
    )
    external_id = models.CharField(max_length=100, blank=True, default='', db_index=True, verbose_name='Mã tham chiếu broker')
    note = models.TextField(blank=True, default='', verbose_name='Ghi chú')
    # Migration tracking
    legacy_transaction_id = models.IntegerField(null=True, blank=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Giao dịch'
        verbose_name_plural = 'Giao dịch'
        ordering = ['-date', '-pk']
        indexes = [
            models.Index(fields=['portfolio', 'symbol', 'date']),
        ]

    def clean(self):
        """Luật theo loại lệnh — chỉ chạy khi gọi `full_clean()`.

        Ghi chú: `full_clean()` KHÔNG được gọi tự động khi `.save()`, nên đường
        API phải dựa vào `validators` ở field (DRF `ModelSerializer` có gọi).
        Ràng buộc theo loại ở tầng API cần thêm `validate()` trong
        `serializers.py` — file ngoài phạm vi slice này, đã báo coordinator.
        """
        super().clean()
        if self.transaction_type not in (self.TransactionType.BUY, self.TransactionType.SELL):
            return
        if self.quantity is not None and self.quantity <= 0:
            raise ValidationError(
                {'quantity': 'Số lượng phải > 0 với giao dịch MUA/BÁN.'})
        if self.price is not None and self.price <= Decimal('0'):
            raise ValidationError(
                {'price': 'Giá phải > 0 với giao dịch MUA/BÁN.'})

    def __str__(self) -> str:
        return f'{self.transaction_type} {self.quantity} {self.symbol} @ {self.price}'


class Watchlist(models.Model):
    """
    Danh sách theo dõi cổ phiếu cá nhân.
    Mirrors legacy WatchlistGroup model.
    TENANT ISOLATION: explicit FK to CoreTenant via tenant field.
    """

    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='core_watchlists',
        verbose_name='Người dùng',
    )
    tenant = models.ForeignKey(
        'identity_access.CoreTenant',
        on_delete=models.CASCADE,
        related_name='core_watchlists',
        null=False,
        blank=True,
        verbose_name='Người dùng SaaS (Tenant)',
        help_text='Tenant owner of this watchlist. Must be set after migration.',
    )
    name = models.CharField(max_length=100, verbose_name='Tên danh sách')
    description = models.TextField(blank=True, default='', verbose_name='Mô tả')
    is_default = models.BooleanField(default=False, verbose_name='Danh sách mặc định')
    # Migration tracking
    legacy_group_id = models.IntegerField(null=True, blank=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Danh sách theo dõi'
        verbose_name_plural = 'Danh sách theo dõi'
        ordering = ['name']

    def __str__(self) -> str:
        return f'{self.name} ({self.user.username})'


class WatchlistItem(models.Model):
    """
    Một mã cổ phiếu trong danh sách theo dõi core.
    """

    watchlist = models.ForeignKey(
        Watchlist,
        on_delete=models.CASCADE,
        related_name='items',
        verbose_name='Danh sách',
    )
    symbol = models.CharField(max_length=32, db_index=True, verbose_name='Mã cổ phiếu')
    note = models.CharField(max_length=255, blank=True, default='', verbose_name='Ghi chú')
    added_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Mã theo dõi'
        verbose_name_plural = 'Mã theo dõi'
        unique_together = [('watchlist', 'symbol')]
        ordering = ['-added_at']

    def __str__(self) -> str:
        return f'{self.symbol} ({self.watchlist.name})'


class TrackedSymbol(models.Model):
    """
    Native tracked symbol entity for stock-management compat routes.

    This remains distinct from WatchlistItem because tracked symbols carry
    per-symbol override state and an optional source group reference.
    """

    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='core_tracked_symbols',
        verbose_name='Người dùng',
    )
    tenant = models.ForeignKey(
        'identity_access.CoreTenant',
        on_delete=models.CASCADE,
        related_name='core_tracked_symbols',
        null=False,
        blank=True,
        verbose_name='Người dùng SaaS (Tenant)',
        help_text='Tenant owner of this tracked symbol. Must be set after migration.',
    )
    symbol = models.CharField(max_length=32, db_index=True, verbose_name='Mã cổ phiếu')
    source_watchlist = models.ForeignKey(
        Watchlist,
        on_delete=models.SET_NULL,
        related_name='tracked_symbols',
        null=True,
        blank=True,
        verbose_name='Nhóm nguồn',
    )
    whale_alert_threshold_million = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        default=None,
        validators=[MinValueValidator(Decimal('1'))],
        verbose_name='Ngưỡng whale riêng (triệu VNĐ)',
    )
    is_active = models.BooleanField(default=True, db_index=True, verbose_name='Bật theo dõi')
    is_stale = models.BooleanField(
        default=False,
        verbose_name='Dữ liệu cũ?',
        help_text='Đánh dấu nếu thống kê cần được tính toán lại.',
    )
    legacy_tracked_symbol_id = models.IntegerField(
        null=True,
        blank=True,
        db_index=True,
        verbose_name='ID tracked legacy',
    )
    added_at = models.DateTimeField(auto_now_add=True, verbose_name='Ngày thêm')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='Ngày cập nhật')

    class Meta:
        verbose_name = 'Mã theo dõi'
        verbose_name_plural = 'Mã theo dõi'
        ordering = ['-added_at', '-pk']
        unique_together = [('user', 'symbol')]
        indexes = [
            models.Index(fields=['tenant', 'symbol', 'is_active']),
            models.Index(fields=['user', 'symbol', 'is_active']),
        ]

    def __str__(self) -> str:
        return f'{self.symbol} ({self.user.username})'


class PriceAlert(models.Model):
    """
    Cảnh báo giá cho một mã cổ phiếu.
    Mirrors legacy PriceAlertRule model.
    TENANT ISOLATION: explicit FK to CoreTenant via tenant field.
    """

    class AlertType(models.TextChoices):
        ABOVE = 'ABOVE', 'Giá vượt quá'
        BELOW = 'BELOW', 'Giá giảm dưới'
        EQUAL = 'EQUAL', 'Bằng giá'

    class AlertStatus(models.TextChoices):
        ACTIVE = 'ACTIVE', 'Đang hoạt động'
        TRIGGERED = 'TRIGGERED', 'Đã kích hoạt'
        EXPIRED = 'EXPIRED', 'Hết hạn'
        DISABLED = 'DISABLED', 'Vô hiệu'

    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='core_price_alerts',
        verbose_name='Người dùng',
    )
    tenant = models.ForeignKey(
        'identity_access.CoreTenant',
        on_delete=models.CASCADE,
        related_name='core_price_alerts',
        null=False,
        blank=True,
        verbose_name='Người dùng SaaS (Tenant)',
        help_text='Tenant owner of this price alert. Must be set after migration.',
    )
    symbol = models.CharField(max_length=32, db_index=True, verbose_name='Mã cổ phiếu')
    alert_type = models.CharField(
        max_length=10,
        choices=AlertType.choices,
        default=AlertType.ABOVE,
        verbose_name='Loại cảnh báo',
    )
    price_threshold = models.DecimalField(
        max_digits=18,
        decimal_places=2,
        verbose_name='Ngưỡng giá (VNĐ)',
    )
    status = models.CharField(
        max_length=10,
        choices=AlertStatus.choices,
        default=AlertStatus.ACTIVE,
        db_index=True,
        verbose_name='Trạng thái',
    )
    is_enabled = models.BooleanField(default=True, db_index=True, verbose_name='Bật/Tắt')
    cooldown_seconds = models.PositiveIntegerField(
        default=300,
        verbose_name='Cooldown (giây)',
        help_text='Số giây tối thiểu giữa hai lần kích hoạt liên tiếp.',
    )
    
    # Notification settings
    notify_email = models.BooleanField(default=True, verbose_name='Thông báo qua email')
    notify_sms = models.BooleanField(default=False, verbose_name='Thông báo qua SMS')
    notify_push = models.BooleanField(default=False, verbose_name='Thông báo Push')
    
    # Tracking
    last_triggered_at = models.DateTimeField(null=True, blank=True, verbose_name='Lần kích hoạt cuối')
    legacy_rule_id = models.IntegerField(null=True, blank=True, db_index=True, verbose_name='ID Rule cũ')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Ngày tạo')
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Cảnh báo giá'
        verbose_name_plural = 'Cảnh báo giá'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', 'symbol', 'status']),
            models.Index(fields=['tenant', 'symbol', 'status']),
        ]

    def __str__(self) -> str:
        return f'{self.symbol} {self.get_alert_type_display()} {self.price_threshold} ({self.user.username})'


class SubAccount(models.Model):
    """
    SFI-B4: Tiểu khoản môi giới (broker sub-account) của người dùng.
    """

    class TypeChoices(models.TextChoices):
        CASH = '1', 'Tiền mặt'
        MARGIN = '6', 'Ký quỹ'
        SPECIAL = '3', 'Đặc biệt'

    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='core_sub_accounts',
        verbose_name='Người dùng',
    )
    tenant = models.ForeignKey(
        'identity_access.CoreTenant',
        on_delete=models.CASCADE,
        related_name='sub_accounts',
        null=False,
        blank=True,
        verbose_name='Người dùng SaaS (Tenant)',
        help_text='Tenant owner. Set from portfolio.tenant or user primary tenant.',
        db_index=True,
    )
    portfolio = models.ForeignKey(
        Portfolio,
        on_delete=models.CASCADE,
        related_name='sub_accounts',
        null=True,
        blank=True,
        verbose_name='Danh mục',
    )
    broker = models.CharField(max_length=50, verbose_name='Tên công ty chứng khoán')
    account_number = models.CharField(max_length=64, blank=True, default='', verbose_name='Số tài khoản')
    name = models.CharField(max_length=100, blank=True, default='', verbose_name='Tên (legacy)')
    display_name = models.CharField(max_length=100, verbose_name='Tên hiển thị')
    type = models.CharField(
        max_length=10,
        choices=TypeChoices.choices,
        default=TypeChoices.CASH,
        verbose_name='Loại tài khoản'
    )
    is_active = models.BooleanField(default=True, verbose_name='Đang hoạt động')
    
    # DNSE Integration fields
    external_id = models.CharField(max_length=100, blank=True, default='', db_index=True, verbose_name='Broker Account ID')
    broker_source = models.CharField(max_length=50, blank=True, default='', verbose_name='Nguồn Broker')
    sync_status = models.JSONField(default=dict, blank=True, verbose_name='Trạng thái đồng bộ')

    # Migration tracking
    legacy_sub_account_id = models.IntegerField(null=True, blank=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Tiểu khoản'
        verbose_name_plural = 'Tiểu khoản'
        ordering = ['-created_at']

    def __str__(self) -> str:
        return f'{self.display_name} — {self.broker} ({self.user.username})'


class DNSECredential(models.Model):
    """
    SFI-DNSE: Lưu trữ thông tin xác thực DNSE LightSpeed API của người dùng.

    DEPRECATED (B1.1): read-only kể từ broker-config Đợt 1 — nguồn thật là `UserBrokerConfig`
    (provider='dnse'). Không tạo row mới ở code mới; sẽ drop sau 1 release.
    Xem `docs/IMPLEMENTATION_PLAN_BROKER_CONFIG_20260923.md`.

    Auth flow chuẩn: POST /v2/authentication/token với client_id + client_secret
    → nhận access_token (Bearer), cache ngắn hạn trong Redis.

    TUYỆT ĐỐI không lưu username/password tài khoản cá nhân DNSE —
    đó là retail login flow, không phải LightSpeed API integration.

    Dữ liệu được mã hóa Fernet trước khi lưu xuống DB.
    """
    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name='dnse_credential',
        verbose_name='Người dùng',
    )
    # LightSpeed API credentials — lấy từ trang quản lý EntradeX/LightSpeed
    client_id_cipher = models.TextField(blank=True, default='', verbose_name='Client ID (Encrypted)')
    client_secret_cipher = models.TextField(blank=True, default='', verbose_name='Client Secret (Encrypted)')

    is_active = models.BooleanField(default=True, verbose_name='Đang hoạt động')
    last_sync_at = models.DateTimeField(null=True, blank=True, verbose_name='Đồng bộ cuối')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'DNSE LightSpeed Credential'
        verbose_name_plural = 'DNSE LightSpeed Credentials'

    def __str__(self):
        return f"DNSE LightSpeed Credential for {self.user.username}"

    def set_client_id(self, raw_val: str) -> None:
        from vninvest_core.utils.encryption import encrypt_string
        self.client_id_cipher = encrypt_string(raw_val)

    def get_client_id(self) -> str:
        from vninvest_core.utils.encryption import decrypt_string
        return decrypt_string(self.client_id_cipher)

    def set_client_secret(self, raw_val: str) -> None:
        from vninvest_core.utils.encryption import encrypt_string
        self.client_secret_cipher = encrypt_string(raw_val)

    def get_client_secret(self) -> str:
        from vninvest_core.utils.encryption import decrypt_string
        return decrypt_string(self.client_secret_cipher)

    def has_credentials(self) -> bool:
        """Kiểm tra đã cấu hình đủ client_id và client_secret chưa."""
        return bool(self.client_id_cipher and self.client_secret_cipher)


class UserBrokerConfig(models.Model):
    """
    B1.1: Store cấu hình broker ĐA NHÀ (dnse/ssi/tcbs) duy nhất cho mỗi người dùng.

    Gộp 2 store DNSE song song (user_workspace.DNSECredential + identity_access.UserDNSECredential)
    — 2 bảng cũ giữ lại read-only 1 release (xem DEPRECATED bên dưới), mọi đọc/ghi mới đi qua đây.

    Toàn bộ secret lưu trong `secrets_cipher` (dict → JSON → Fernet qua
    vninvest_core.utils.encryption, key dẫn xuất từ SECRET_KEY). Response/API KHÔNG BAO GIỜ
    trả secret — chỉ preview mask (xem broker/base.py).
    """

    class ProviderChoices(models.TextChoices):
        DNSE = 'dnse', 'DNSE'
        SSI = 'ssi', 'SSI'
        TCBS = 'tcbs', 'TCBS'

    class StatusChoices(models.TextChoices):
        NEVER_CONNECTED = 'never_connected', 'Chưa kết nối'
        CONNECTED = 'connected', 'Đã kết nối'
        UNVERIFIED = 'unverified', 'Chờ xác minh (thiếu OTP)'
        EXPIRED = 'expired', 'Hết hạn phiên'
        ERROR = 'error', 'Lỗi'

    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='broker_configs',
        verbose_name='Người dùng',
        db_index=True,
    )
    # P0-ISO-03: broker credential phải tenant-scoped. Giai đoạn expand nên
    # `null=True` (plan TEN-04 "cột nullable trước, backfill sau, contract sau
    # canary"); row ambiguous/backfill chưa resolve được sẽ giữ NULL + nằm trong
    # `QuarantinedRecord`. KHÔNG đoán bừa tenant.
    tenant = models.ForeignKey(
        'identity_access.CoreTenant',
        on_delete=models.CASCADE,
        related_name='broker_configs',
        null=True,
        blank=True,
        db_index=True,
        verbose_name='Người dùng SaaS (Tenant)',
        help_text='Tenant sở hữu credential. NULL = chưa resolve được, xem QuarantinedRecord.',
    )
    provider = models.CharField(
        max_length=16,
        choices=ProviderChoices.choices,
        db_index=True,
        verbose_name='Nhà môi giới',
    )
    label = models.CharField(
        max_length=100,
        default='Mặc định',
        verbose_name='Tên gợi nhớ',
    )
    secrets_cipher = models.TextField(blank=True, default='', verbose_name='Secrets (Fernet-encrypted JSON)')
    prefs = models.JSONField(default=dict, blank=True, verbose_name='Tùy chọn (tài khoản mặc định, sync, notify)')
    status = models.CharField(
        max_length=20,
        choices=StatusChoices.choices,
        default=StatusChoices.NEVER_CONNECTED,
        db_index=True,
        verbose_name='Trạng thái kết nối',
    )
    last_verified_at = models.DateTimeField(null=True, blank=True, verbose_name='Xác minh lần cuối')
    last_error = models.TextField(blank=True, default='', verbose_name='Lỗi gần nhất')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Cấu hình Broker người dùng'
        verbose_name_plural = 'Cấu hình Broker người dùng'
        constraints = [
            # Credential là duy nhất theo (tenant, user, provider, label).
            models.UniqueConstraint(
                fields=['tenant', 'user', 'provider', 'label'],
                name='uniq_broker_config_tenant_user_provider_label',
            ),
            # Giai đoạn expand: row chưa có tenant vẫn phải giữ unique cũ
            # (user, provider, label) — Postgres coi NULL là khác nhau nên
            # constraint thứ nhất không bảo vệ được nhóm này.
            models.UniqueConstraint(
                fields=['user', 'provider', 'label'],
                condition=Q(tenant__isnull=True),
                name='uniq_broker_config_legacy_no_tenant',
            ),
        ]

    def __str__(self):
        return f"UserBrokerConfig({self.user.username}/{self.provider}/{self.label})"

    # ── Secrets helpers (Fernet JSON dict) ──────────────────────────────
    def set_secrets(self, secrets: dict) -> None:
        import json
        from vninvest_core.utils.encryption import encrypt_string
        self.secrets_cipher = encrypt_string(json.dumps(secrets or {}))

    def get_secrets(self) -> dict:
        import json
        from vninvest_core.utils.encryption import decrypt_string
        raw = decrypt_string(self.secrets_cipher)
        if not raw:
            return {}
        try:
            data = json.loads(raw)
            return data if isinstance(data, dict) else {}
        except (ValueError, TypeError):
            return {}

    def has_secrets(self) -> bool:
        return bool(self.get_secrets())

    def masked_preview(self) -> dict:
        """Preview an toàn cho response: secret → ****, non-secret giữ nguyên."""
        from .broker import mask_secrets_preview  # noqa: PLC0415 (tránh circular import)
        return mask_secrets_preview(self.provider, self.get_secrets())


def _warn_tenant_blind(helper: str, user) -> None:
    """Gọi helper không truyền `tenant` ⇒ hành vi tenant-blind (giai đoạn expand).

    KHÔNG raise: `views_broker.py:97,122,133,147,162` và `views_dnse.py:150,415`
    nằm ngoài phạm vi slice này và vẫn gọi 2/3 tham số. Raise sẽ làm hỏng
    các route đang chạy; thay vào đó ghi cảnh báo để lộ call site cần migrate.
    """
    logger.warning(
        '%s() được gọi KHÔNG có tenant ⇒ lookup tenant-blind cho user=%s. '
        'Call site phải truyền tenant= để cô lập credential theo tenant.',
        helper, getattr(user, 'pk', user),
    )


def get_user_broker_config(user, provider: str, label: str = 'Mặc định', tenant=None):
    """Lấy config broker của user (None nếu chưa có).

    `tenant=None` ⇒ hành vi cũ (tenant-blind) + log cảnh báo, giữ tương thích
    ngược cho call site chưa migrate. Truyền `tenant` ⇒ chỉ trả config của
    tenant đó, không bao giờ rò config tenant khác.
    """
    if tenant is None:
        _warn_tenant_blind('get_user_broker_config', user)
        return UserBrokerConfig.objects.filter(
            user=user, provider=provider, label=label).first()
    return UserBrokerConfig.objects.filter(
        user=user, provider=provider, label=label, tenant=tenant).first()


def set_user_broker_secrets(user, provider: str, secrets: dict, label: str = 'Mặc định',
                            tenant=None):
    """Tạo/cập nhật secrets (Fernet) cho config broker của user. Không log secret.

    `tenant=None` ⇒ hành vi cũ + log cảnh báo (tương thích ngược).
    """
    if tenant is None:
        _warn_tenant_blind('set_user_broker_secrets', user)
        config, _ = UserBrokerConfig.objects.get_or_create(
            user=user, provider=provider, label=label,
            defaults={'status': UserBrokerConfig.StatusChoices.NEVER_CONNECTED},
        )
    else:
        config, _ = UserBrokerConfig.objects.get_or_create(
            user=user, provider=provider, label=label, tenant=tenant,
            defaults={'status': UserBrokerConfig.StatusChoices.NEVER_CONNECTED},
        )
    config.set_secrets(secrets)
    config.save(update_fields=['secrets_cipher', 'updated_at'])
    return config


class AccountSnapshot(models.Model):
    """
    SFI-DNSE: Lưu snapshot tài khoản định kỳ.
    """
    sub_account = models.ForeignKey(
        SubAccount,
        on_delete=models.CASCADE,
        related_name='snapshots',
        verbose_name='Tiểu khoản',
    )
    date = models.DateField(db_index=True, verbose_name='Ngày')
    net_equity = models.DecimalField(max_digits=20, decimal_places=2, default=0, verbose_name='NAV')
    cash_balance = models.DecimalField(max_digits=20, decimal_places=2, default=0, verbose_name='Số dư tiền')
    stock_value = models.DecimalField(max_digits=20, decimal_places=2, default=0, verbose_name='Giá trị chứng khoán')
    debt = models.DecimalField(max_digits=20, decimal_places=2, default=0, verbose_name='Nợ')
    
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Account Snapshot'
        verbose_name_plural = 'Account Snapshots'
        unique_together = [('sub_account', 'date')]
        ordering = ['-date']

    def __str__(self):
        return f"{self.sub_account.display_name} @ {self.date}"

    @property
    def nav(self):
        return self.net_equity


class QuarantinedRecord(models.Model):
    """
    Lưu trữ tạm thời các bản ghi mồ côi (không có tenant) được phát hiện trong quá trình kiểm toán tiền di trú.
    Giúp Operator đối soát thủ công và làm sạch dữ liệu.
    """
    model_name = models.CharField(max_length=100, db_index=True, verbose_name="Tên Model")
    original_id = models.IntegerField(db_index=True, verbose_name="ID gốc")
    data = models.JSONField(verbose_name="Dữ liệu bản ghi thô")
    reason = models.TextField(verbose_name="Lý do cô lập")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Ngày cô lập")

    class Meta:
        verbose_name = "Bản ghi cô lập"
        verbose_name_plural = "Bản ghi cô lập"
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"{self.model_name} #{self.original_id} - {self.reason}"


class ScreenerRule(models.Model):
    """
    Bộ lọc động (screener) do user tự định nghĩa, lưu dưới dạng JSON.
    TENANT ISOLATION: explicit FK to CoreTenant.
    """
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='screener_rules',
        verbose_name='Người dùng',
    )
    tenant = models.ForeignKey(
        'identity_access.CoreTenant',
        on_delete=models.CASCADE,
        related_name='screener_rules',
        null=False,
        blank=True,
        verbose_name='Người dùng SaaS (Tenant)',
        help_text='Tenant owner of this screener rule.',
    )
    name = models.CharField(max_length=100, verbose_name='Tên bộ lọc')
    rules_json = models.JSONField(verbose_name='Luật lọc (JSON)')
    is_active = models.BooleanField(default=True, verbose_name='Kích hoạt')
    # W8 P3 preset cộng đồng: rule public trong cùng tenant hiện ở catalog chung.
    is_public = models.BooleanField(default=False, db_index=True, verbose_name='Chia sẻ cộng đồng')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Bộ lọc động'
        verbose_name_plural = 'Bộ lọc động'
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.name} ({self.user.username})'


class ScreenerRunHistory(models.Model):
    """
    P2.3: Lịch sử chạy screener per-user (Q5, D10).
    Lưu mỗi lần POST /screener/rules/<id>/run/ 200 (kể cả 202→completed, lưu sau khi task xong).
    BE giữ 100/user, FE localStorage giữ 20 gần nhất (fallback).
    """

    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='screener_run_histories',
        verbose_name='Người dùng',
    )
    tenant = models.ForeignKey(
        'identity_access.CoreTenant',
        on_delete=models.CASCADE,
        related_name='screener_run_histories',
        null=False,
        blank=True,
        verbose_name='Tenant',
    )
    rule = models.ForeignKey(
        ScreenerRule,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='run_histories',
        verbose_name='Rule',
    )
    rule_name = models.CharField(max_length=100, verbose_name='Tên rule lúc chạy')
    run_at = models.DateTimeField(auto_now_add=True, db_index=True, verbose_name='Thời gian chạy')
    matched_count = models.IntegerField(verbose_name='Số mã khớp')
    total_scanned = models.IntegerField(verbose_name='Tổng quét')
    window_days = models.IntegerField(null=True, blank=True, verbose_name='Window days')
    session_date = models.DateField(null=True, blank=True, verbose_name='Phiên')
    # matched: List[HistoryRow] {symbol, close, action, score} — như localStorage
    matched = models.JSONField(default=list, verbose_name='Matched rows (HistoryRow[])')
    params = models.JSONField(default=dict, verbose_name='Scan params {sort,order,page,limit,include_ai}')

    class Meta:
        verbose_name = 'Lịch sử chạy screener'
        verbose_name_plural = 'Lịch sử chạy screener'
        ordering = ['-run_at']
        indexes = [
            models.Index(fields=['user', 'tenant', '-run_at']),
            models.Index(fields=['rule', '-run_at']),
        ]

    def __str__(self):
        return f'{self.rule_name} {self.run_at:%Y-%m-%d %H:%M} ({self.matched_count}/{self.total_scanned})'


def _compute_next_run(run_time, weekdays):
    """Next datetime (Asia/Ho_Chi_Minh naive→aware) matching run_time + weekdays."""
    from datetime import datetime, timedelta, time as _time
    from django.utils import timezone

    now = timezone.now()
    if not weekdays:
        weekdays = [0, 1, 2, 3, 4]
    hh = run_time.hour if isinstance(run_time, _time) else 18
    mm = run_time.minute if isinstance(run_time, _time) else 0
    for delta in range(0, 8):
        day = now + timedelta(days=delta)
        if day.weekday() not in weekdays:
            continue
        cand = day.replace(hour=hh, minute=mm, second=0, microsecond=0)
        if cand > now:
            return cand
    return now + timedelta(days=1)


class ScreenerSchedule(models.Model):
    """
    P2.4: Lịch quét định kỳ per-user (Q6, D11).
    run_time + weekdays (preset, không cron tự do để tránh dep croniter).
    Beat task `screener_scheduled_run` (5m) check next_run_at <= now.
    """

    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='screener_schedules',
        verbose_name='Người dùng',
    )
    tenant = models.ForeignKey(
        'identity_access.CoreTenant',
        on_delete=models.CASCADE,
        related_name='screener_schedules',
        null=False,
        blank=True,
        verbose_name='Tenant',
    )
    name = models.CharField(max_length=100, verbose_name='Tên lịch')
    rule_ids = models.JSONField(default=list, verbose_name='Rule IDs [int]')
    run_time = models.TimeField(verbose_name='Giờ chạy (ICT)')
    weekdays = models.JSONField(default=list, verbose_name='Ngày trong tuần [0=Mon..6=Sun]')
    is_active = models.BooleanField(default=True, db_index=True, verbose_name='Kích hoạt')
    notify_channels = models.JSONField(default=list, verbose_name='Kênh TB [in_app,email]')

    def save(self, *args, **kwargs):
        from datetime import time as _time

        if self.run_time is None:
            self.run_time = _time(18, 0)
        if not self.weekdays:
            self.weekdays = [0, 1, 2, 3, 4]
        if not self.notify_channels:
            self.notify_channels = ['in_app']
        if self.next_run_at is None and self.is_active:
            self.next_run_at = _compute_next_run(self.run_time, self.weekdays)
        super().save(*args, **kwargs)
    last_run_at = models.DateTimeField(null=True, blank=True, verbose_name='Chạy cuối')
    next_run_at = models.DateTimeField(null=True, blank=True, db_index=True, verbose_name='Chạy tiếp')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Lịch quét screener'
        verbose_name_plural = 'Lịch quét screener'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', 'tenant', 'is_active']),
            models.Index(fields=['is_active', 'next_run_at']),
        ]

    def __str__(self):
        return f'{self.name} {self.run_time} {self.weekdays} ({self.user.username})'


from django.db.models.signals import pre_save
from django.dispatch import receiver


def resolve_tenant_for_user_workspace_instance(instance):
    """SSOT resolve `instance.tenant` cho mọi model user_workspace. Trả tenant hoặc None.

    P0-DATA-01: bản cũ (trước đây nằm trực tiếp trong receiver) chọn tenant bằng
    `.first()`:
    - `CoreTenant.objects.filter(owner_user=user).first()`
    - `TenantMember.objects.filter(user=user).first()`

    ⇒ user thuộc N tenant bị gán **một tenant tùy ý** ⇒ dữ liệu tài chính rơi
    sai scope. Vi phạm nguyên tắc bất di bất dịch của plan
    `IMPLEMENTATION_PLAN_PORTFOLIO_COMMERCIAL_HARDENING_20260925.md:54`
    ("không có `first tenant`/`first portfolio` fallback").

    Nay:
    - Chuỗi `portfolio`/`watchlist` → dùng tenant của parent.
    - User thuộc **đúng 1** tenant → dùng tenant đó.
    - User thuộc **≥2** tenant → KHÔNG đoán ⇒ để NULL ⇒ NOT NULL nổ
      `IntegrityError` ⇒ từ chối.
    - User thuộc **0** tenant → giữ hành vi cũ: tự tạo tenant (xem
      `_autoprovision_tenant_for`).
    """
    if getattr(instance, 'tenant_id', None):
        return instance.tenant

    for attr in ('portfolio', 'watchlist'):
        parent = getattr(instance, attr, None)
        if parent is None:
            continue
        parent_tenant_id = getattr(parent, 'tenant_id', None)
        if parent_tenant_id:
            instance.tenant_id = parent_tenant_id
            return parent.tenant
        user = getattr(parent, 'user', None)
        if user is not None:
            break
    else:
        user = getattr(instance, 'user', None)

    if user is None:
        return None

    from identity_access.models import CoreTenant, TenantMember, UserProfile

    candidate_ids = set(
        CoreTenant.objects.filter(owner_user=user).values_list('id', flat=True))
    candidate_ids.update(
        UserProfile.objects.filter(user=user)
        .exclude(tenant__isnull=True)
        .values_list('tenant_id', flat=True))
    candidate_ids.update(
        TenantMember.objects.filter(user=user).values_list('tenant_id', flat=True))

    if len(candidate_ids) == 1:
        instance.tenant_id = candidate_ids.pop()
        return instance.tenant

    if not candidate_ids:
        return _autoprovision_tenant_for(user, CoreTenant, UserProfile, instance)

    logger.warning(
        '%s user=%s: user thuộc %d tenant %s — KHÔNG tự chọn. Dữ liệu sẽ bị từ '
        'chối bởi NOT NULL (đúng hơn là ghi vào tenant sai).',
        type(instance).__name__, getattr(user, 'pk', user),
        len(candidate_ids), sorted(candidate_ids),
    )
    return None


def _autoprovision_tenant_for(user, CoreTenant, UserProfile, instance):
    """User chưa thuộc tenant nào ⇒ tự tạo 1 tenant riêng (quyết định sản phẩm).

    GIỮ NGUYÊN hành vi của code cũ (`models.py:952-960` trước đây) vì
    `user_workspace/tests.py:331-348` dựa vào nó — nằm ngoài phạm vi slice này.

    RỦI RO CÒN LẠI (đã ghi backlog, không tự sửa vì ngoài phạm vi):
    đây là **ghi dữ liệu như side effect của `save()`**. Đúng hơn là tenant phải
    được tạo ở luồng đăng ký (`identity_access/views/register.py`) — cần ticket
    riêng cho coordinator.

    Khác với bản cũ: dùng `get_or_create` theo `tenant_code` để không đụng
    unique constraint khi hai save chạy đồng thời.
    """
    tenant, _created = CoreTenant.objects.get_or_create(
        tenant_code=f'auto-{user.username}',
        defaults={
            'display_name': f'Auto Tenant for {user.username}',
            'owner_user': user,
        },
    )
    UserProfile.objects.get_or_create(user=user, defaults={'tenant': tenant})
    instance.tenant = tenant
    logger.info(
        'Auto-provision tenant %s cho user %s khi tạo %s (user chưa thuộc tenant nào).',
        tenant.tenant_code, getattr(user, 'pk', user), type(instance).__name__,
    )
    return tenant


@receiver(pre_save, sender=Portfolio)
@receiver(pre_save, sender=Transaction)
@receiver(pre_save, sender=Watchlist)
@receiver(pre_save, sender=TrackedSymbol)
@receiver(pre_save, sender=PriceAlert)
@receiver(pre_save, sender=ScreenerRule)
@receiver(pre_save, sender=ScreenerRunHistory)
@receiver(pre_save, sender=ScreenerSchedule)
def resolve_tenant_for_user_workspace_models(sender, instance, **kwargs):
    resolve_tenant_for_user_workspace_instance(instance)



