"""
User Workspace domain models for packages/core.

Portfolio, Transaction, Watchlist/WatchlistItem replacing legacy counterparts.

ISOLATION RULE: No imports from backend.portfolio or backend.* allowed.
TENANT ISOLATION: All user-scoped models now have explicit tenant FK to identity_access.CoreTenant.
"""
from decimal import Decimal

from django.contrib.auth.models import User
from django.core.validators import MinValueValidator
from django.db import models
from django.utils import timezone


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
    price = models.DecimalField(max_digits=18, decimal_places=2, verbose_name='Giá khớp (VNĐ)')
    quantity = models.BigIntegerField(verbose_name='Số lượng cổ phiếu')
    fee = models.DecimalField(max_digits=18, decimal_places=2, default=0, verbose_name='Phí giao dịch')
    tax = models.DecimalField(max_digits=18, decimal_places=2, default=0, verbose_name='Thuế')
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
        EXPIRED = 'expired', 'Hết hạn phiên'
        ERROR = 'error', 'Lỗi'

    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='broker_configs',
        verbose_name='Người dùng',
        db_index=True,
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
        unique_together = [('user', 'provider', 'label')]

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


def get_user_broker_config(user, provider: str, label: str = 'Mặc định'):
    """Lấy config broker của user (None nếu chưa có). Dùng chung cho mọi view."""
    return UserBrokerConfig.objects.filter(user=user, provider=provider, label=label).first()


def set_user_broker_secrets(user, provider: str, secrets: dict, label: str = 'Mặc định'):
    """Tạo/cập nhật secrets (Fernet) cho config broker của user. Không log secret."""
    config, _ = UserBrokerConfig.objects.get_or_create(
        user=user, provider=provider, label=label,
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

@receiver(pre_save, sender=Portfolio)
@receiver(pre_save, sender=Transaction)
@receiver(pre_save, sender=Watchlist)
@receiver(pre_save, sender=TrackedSymbol)
@receiver(pre_save, sender=PriceAlert)
@receiver(pre_save, sender=SubAccount)
@receiver(pre_save, sender=ScreenerRule)
@receiver(pre_save, sender=ScreenerRunHistory)
@receiver(pre_save, sender=ScreenerSchedule)
def resolve_tenant_for_user_workspace_models(sender, instance, **kwargs):
    if getattr(instance, 'tenant_id', None):
        return

    # Try resolving from owner/associated user
    user = getattr(instance, 'user', None)
    if not user:
        portfolio = getattr(instance, 'portfolio', None)
        if portfolio:
            if getattr(portfolio, 'tenant_id', None):
                instance.tenant_id = portfolio.tenant_id
                return
            user = getattr(portfolio, 'user', None)
            
        watchlist = getattr(instance, 'watchlist', None)
        if watchlist:
            if getattr(watchlist, 'tenant_id', None):
                instance.tenant_id = watchlist.tenant_id
                return
            user = getattr(watchlist, 'user', None)

    if user:
        # Try core_profile first
        profile = getattr(user, 'core_profile', None)
        if profile and getattr(profile, 'tenant_id', None):
            instance.tenant = profile.tenant
            return
        # Look up UserProfile directly
        from identity_access.models import UserProfile, CoreTenant
        profile = UserProfile.objects.filter(user=user).first()
        if profile and getattr(profile, 'tenant_id', None):
            instance.tenant = profile.tenant
            return
        
        # Find any tenant owned by user
        tenant = CoreTenant.objects.filter(owner_user=user).first()
        if tenant:
            instance.tenant = tenant
            return
            
        # Find any active tenant the user belongs to
        from identity_access.models import TenantMember
        member = TenantMember.objects.filter(user=user).first()
        if member and getattr(member, 'tenant_id', None):
            instance.tenant_id = member.tenant_id
            return

        # Fallback: create a tenant for the user
        tenant = CoreTenant.objects.create(
            tenant_code=f"auto-{user.username}",
            display_name=f"Auto Tenant for {user.username}",
            owner_user=user
        )
        instance.tenant = tenant
        # Create UserProfile if not exists
        UserProfile.objects.get_or_create(user=user, defaults={'tenant': tenant})



