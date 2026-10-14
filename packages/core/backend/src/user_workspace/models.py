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

    class KindChoices(models.TextChoices):
        MANUAL = 'manual', 'Thu cong'
        BROKER_BACKED = 'broker_backed', 'Lien ket broker'
        AGGREGATE = 'aggregate', 'Tong hop (chi doc)'

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
    # B0.2 (Wave 0, QD-C/ADR-005): ranh gioi co lap + lop tong hop.
    # `aggregate` chi doc (khong co du lieu goc) — enforce o tang view (B3.2).
    kind = models.CharField(
        max_length=16,
        choices=KindChoices.choices,
        default=KindChoices.MANUAL,
        db_index=True,
        verbose_name='Loai danh muc',
    )
    # B0.2: archive mem thay vi xoa cung (D-17 giu ledger >= 7 nam).
    # Hanh vi archive (loc mac dinh, 409 suggest) o slice sau — B0.2 chi schema.
    is_archived = models.BooleanField(
        default=False, db_index=True, verbose_name='Da luu tru')
    # LED-03 R6: NAV = stock_value + cash − debt, mà `cash` bắt đầu từ số dư
    # mở đầu. Không có trường này thì `cash` chỉ là tổng dòng tiền kể từ lúc
    # hệ thống bắt đầu ghi, và NAV luôn sai theo một hằng số không ai biết —
    # đó chính là lý do `nav` từng là `null` vĩnh viễn.
    # NULL = chưa xác định ⇒ NAV phải là NULL kèm lý do, KHÔNG phải 0.
    opening_balance = models.DecimalField(
        max_digits=20, decimal_places=2, null=True, blank=True,
        verbose_name='Số dư tiền mặt mở đầu (VNĐ)',
        help_text='Số dư tiền mặt trước thời điểm hệ thống bắt đầu ghi sổ. '
                  'Để trống nghĩa là chưa xác định — NAV sẽ là null kèm lý do.')
    opening_balance_source = models.CharField(
        max_length=32, blank=True, default='',
        verbose_name='Nguồn số dư mở đầu',
        help_text='Ví dụ: sub_account_snapshot, manual, import.')
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
    # B0.2 (Wave 0, ADR-007): tach bach holdings broker vs watchlist thu cong.
    # `manual` = user tao (khong day nguoc len broker — khong co API);
    # `derived` = he thong tu sinh tu vi the broker (Wave 1).
    source = models.CharField(
        max_length=16,
        choices=[('manual', 'Thu cong'), ('derived', 'Tu sinh tu vi the')],
        default='manual',
        db_index=True,
        verbose_name='Nguon danh sach',
    )
    provider = models.CharField(
        max_length=16,
        choices=[('dnse', 'DNSE'), ('ssi', 'SSI'), ('tcbs', 'TCBS')],
        default='',
        blank=True,
        db_index=True,
        verbose_name='Pham vi broker',
        help_text='Rong = ap dung chung; co gia tri = chi hien trong ngu canh broker do.',
    )
    broker_account = models.ForeignKey(
        'SubAccount',
        on_delete=models.SET_NULL,
        related_name='scoped_watchlists',
        null=True,
        blank=True,
        db_index=True,
        verbose_name='Tieu khoan gan kem',
        help_text='NULL = khong gan tieu khoan cu the.',
    )
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

    # B0.1 (Wave 0): lien ket tuong minh toi credential + provider chuan.
    # Giai doan expand: `broker_config` nullable, backfill sau (migration 0025);
    # contract NOT NULL o B3.4. `broker`/`broker_source` giu nguyen (deprecate sau).
    provider = models.CharField(
        max_length=16,
        # Giu dong bo voi UserBrokerConfig.ProviderChoices (khai o duoi file) —
        # khong import nguoc duoc vi SubAccount dung truoc. Gia tri chuan:
        # dnse/ssi/tcbs ( them 'tcb' o tang backfill, khong o day).
        choices=[('dnse', 'DNSE'), ('ssi', 'SSI'), ('tcbs', 'TCBS')],
        default='',
        blank=True,
        db_index=True,
        verbose_name='Nha moi gioi (chuan)',
        help_text="dnse/ssi/tcbs. Rong = chua phan loai (cho backfill).",
    )
    broker_config = models.ForeignKey(
        'UserBrokerConfig',
        on_delete=models.SET_NULL,
        related_name='sub_accounts',
        null=True,
        blank=True,
        db_index=True,
        verbose_name='Cau hinh broker',
        help_text='Credential da dung de dong bo tieu khoan nay. NULL = chua lien ket.',
    )
    last_sync_at = models.DateTimeField(
        null=True, blank=True, verbose_name='Dong bo cuoi')

    # Migration tracking
    legacy_sub_account_id = models.IntegerField(null=True, blank=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Tiểu khoản'
        verbose_name_plural = 'Tiểu khoản'
        ordering = ['-created_at']
        constraints = [
            # B0.1: so tieu khoan duy nhat theo (tenant, credential, external_id).
            # Partial (chi khi da lien ket + co external_id) de hang legacy
            # NULL/rong khong chan nhau trong giai doan expand.
            models.UniqueConstraint(
                fields=['tenant', 'broker_config', 'external_id'],
                condition=Q(broker_config__isnull=False) & ~Q(external_id=''),
                name='uniq_subaccount_tenant_config_external',
            ),
        ]

    def __str__(self) -> str:
        return f'{self.display_name} — {self.broker} ({self.user.username})'


class PortfolioBrokerBinding(models.Model):
    """
    B0.2 (Wave 0, QD-C/ADR-005): lien ket M:N tuong minh danh muc <-> tieu khoan.

    Mac dinh moi tieu khoan thuoc dung 1 danh muc `broker_backed`; gop thu cong
    (B3.1) tao them binding co `role='secondary'`. Danh muc `aggregate` chi doc
    qua cac binding (enforce o tang view, B3.2).
    """

    class RoleChoices(models.TextChoices):
        PRIMARY = 'primary', 'Chinh'
        SECONDARY = 'secondary', 'Gop them'

    portfolio = models.ForeignKey(
        Portfolio,
        on_delete=models.CASCADE,
        related_name='broker_bindings',
        verbose_name='Danh muc',
    )
    sub_account = models.ForeignKey(
        SubAccount,
        on_delete=models.CASCADE,
        related_name='portfolio_bindings',
        verbose_name='Tieu khoan',
    )
    tenant = models.ForeignKey(
        'identity_access.CoreTenant',
        on_delete=models.CASCADE,
        related_name='portfolio_broker_bindings',
        verbose_name='Tenant',
        help_text='Phai khop tenant cua ca danh muc va tieu khoan.',
        db_index=True,
    )
    role = models.CharField(
        max_length=16,
        choices=RoleChoices.choices,
        default=RoleChoices.PRIMARY,
        verbose_name='Vai tro',
    )
    is_default = models.BooleanField(
        default=False, verbose_name='Mac dinh hien thi')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Lien ket danh muc - tieu khoan'
        verbose_name_plural = 'Lien ket danh muc - tieu khoan'
        ordering = ['-created_at']
        constraints = [
            models.UniqueConstraint(
                fields=['portfolio', 'sub_account'],
                name='uniq_portfolio_broker_binding',
            ),
        ]

    def clean(self):
        super().clean()
        portfolio_tenant = getattr(getattr(self, 'portfolio', None), 'tenant_id', None)
        sub_tenant = getattr(getattr(self, 'sub_account', None), 'tenant_id', None)
        for label, got, want in (
                ('tenant/danh muc', portfolio_tenant, self.tenant_id),
                ('tenant/tieu khoan', sub_tenant, self.tenant_id)):
            if got is not None and want is not None and got != want:
                raise ValidationError(
                    {'tenant': f'tenant binding khong khop {label}.'})

    def __str__(self) -> str:
        return f'{self.portfolio_id} <-> {self.sub_account_id} ({self.role})'


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
    # SEC-02 R3: which key version protected `secrets_cipher`. The envelope in
    # `secrets_cipher` already records this, so the column is a denormalised index:
    # it lets an operator list "everything still on the old key" and re-encrypt it
    # without parsing every row, and it makes the key dependency queryable.
    secret_version = models.PositiveSmallIntegerField(
        default=1,
        db_index=True,
        verbose_name='Phiên bản khoá mã hoá',
        help_text='Key version used for secrets_cipher. 1 = legacy (derived from SECRET_KEY).',
    )
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

        from vninvest_core.utils.encryption import store

        if not secrets:
            # Clearing is a legitimate operation; it must not leave a ciphertext
            # behind that claims a key version while holding nothing.
            self.secrets_cipher = ''
            self.secret_version = 1
            return
        self.secrets_cipher = store.encrypt(json.dumps(secrets))
        # Record the version actually used, not an assumed one: whether this row
        # went out on BROKER_SECRET_KEY or fell back to legacy v1 depends on
        # deployment configuration, and rotation planning needs the truth.
        self.secret_version = store.version_of(self.secrets_cipher)

    def get_secrets(self) -> dict:
        import json

        from vninvest_core.utils.encryption import SecretKeyMissingError, decrypt_string

        if not self.secrets_cipher:
            return {}
        # A non-empty ciphertext that will not decrypt means the key it was written
        # with is gone or wrong. The old code caught ValueError/TypeError and
        # returned {}, which turned a key-rotation outage into "user has no broker
        # configured" - a silent, misleading state. A genuinely absent value is
        # handled above; malformed JSON inside a valid ciphertext is tolerated
        # because that is pre-existing data shape, not a key fault.
        raw = decrypt_string(self.secrets_cipher)
        if not raw:
            raise SecretKeyMissingError(
                f"Broker secrets for {self.user_id}/{self.provider} decrypted to an "
                f"empty value (key version {self.secret_version})"
            )
        try:
            data = json.loads(raw)
        except (ValueError, TypeError):
            return {}
        return data if isinstance(data, dict) else {}

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


# ═══════════════════════════════════════════════════════════════════════════
# WAVE 2 — LED-01..03 · LED-06
# Nguồn spec: docs/archive/docs-flat/portfolio_exec_slices/
#             PORTFOLIO_EXEC_SLICES_LEDGER_FE_20260927.md
# Lưu ý: master §0.12 vẫn trỏ `docs/PORTFOLIO_EXEC_SLICES_LEDGER_FE_20260927.md`
# — file đã bị archive (PR #65/#66). Đường dẫn archive mới là nguồn thật.
# ═══════════════════════════════════════════════════════════════════════════


class LedgerEntryImmutable(RuntimeError):
    """Sửa/xoá một dòng sổ cái đã commit.

    LED-01 R2: ledger là append-only. Sai số không được sửa tại chỗ — nó được
    bù bằng một entry `ADJUSTMENT` trỏ `reversal_of` tới dòng gốc (D-08), để
    lịch sử vẫn truy vết được ai đã đổi con số nào vào lúc nào.
    """


class AppendOnlyMixin:
    """Chặn sửa/xoá dòng đã commit — ở tầng Python VÀ ở tầng DB.

    **Vì sao cần cả hai, và vì sao lần đầu chỉ có tầng Python là không đủ.**

    Bản đầu chỉ chặn trong `save()`. Điều đó bị bỏ qua bởi:

    - `LedgerEntry(pk=<đã tồn tại>)` — truyền PK vào constructor thì Django
      đặt `_state.adding = True`, nên `save()` chạy `UPDATE` và **ghi đè dòng
      đã commit**. Đây là đường lách thật, không phải giả định.
    - `queryset.update()` / `queryset.delete()` — không đi qua `Model.save()`.
    - `bulk_update()`, raw SQL, `admin`, và cascade từ cha.
    - `bulk_create` cũng bỏ qua `clean()`, nên dữ liệu hỏng lọt qua được.

    Vì vậy `0023` tạo **trigger** Postgres chặn `UPDATE`/`DELETE` trên các bảng
    này. Trigger là lớp duy nhất sống sót qua `update()` và raw SQL. Tầng Python
    vẫn giữ lại vì nó cho thông báo lỗi dễ hiểu và chặn sớm hơn.

    Lưu ý khi test: dựng fixture bằng `Model(pk=1).save()` là idiom quen
    thuộc và **bị chặn** ở đây. Dùng `Model.objects.create(...)` — cùng kết quả
    mà không đụng luật.
    """

    def _already_committed(self):
        if self._state.adding:
            # `adding` không đủ: constructor có PK ⇒ adding=True nhưng dòng
            # có thể đã tồn tại. Hỏi DB mới là câu trả lời chắc chắn.
            if self.pk is None:
                return False
            return type(self)._default_manager.filter(pk=self.pk).exists()
        return True

    def save(self, *args, **kwargs):
        if self._already_committed():
            raise LedgerEntryImmutable(
                f'{type(self).__name__} pk={self.pk} đã commit, không sửa tại '
                f'chỗ được. Tạo bản ghi mới thay vì sửa bản ghi cũ.'
            )
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise LedgerEntryImmutable(
            f'{type(self).__name__} pk={self.pk} không xoá được. '
            f'Bản ghi đã commit là lịch sử, không phải dữ liệu tạm.'
        )


class TenantScopedByParentMixin:
    """Bắt buộc `self.tenant_id == self.portfolio.tenant_id`.

    **Vì sao cần, khi mô hình đã có cả `tenant` lẫn `portfolio`:**

    Signal `pre_save` tự điền `tenant` khi nó còn trống. Nhưng nếu caller đã
    truyền `tenant` thì hàm **return ngay** và không bao giờ so với tenant của
    `portfolio`. Kết quả: một dòng sổ cái của tenant A trỏ tới danh mục của
    tenant B, và mọi `filter(portfolio=...)` sau đó đọc ra nó. Django không thể
    chặn việc này bằng `ForeignKey` vì nó là ràng buộc **qua hai bảng**.

    Đây là bất biến tầng ứng dụng; `0023` bổ sung trigger DB là lớp thứ hai.
    """

    def clean(self):
        super().clean()
        portfolio = getattr(self, 'portfolio', None)
        if portfolio is None or self.tenant_id is None:
            return
        portfolio_tenant_id = getattr(portfolio, 'tenant_id', None)
        if portfolio_tenant_id is not None and portfolio_tenant_id != self.tenant_id:
            raise ValidationError({
                'tenant': (
                    f'tenant {self.tenant_id} không khớp tenant '
                    f'{portfolio_tenant_id} của danh mục {portfolio.pk}.'
                ),
            })


class LedgerEntry(AppendOnlyMixin, TenantScopedByParentMixin, models.Model):
    """LED-01 — dòng sổ cái bất biến.

    `Transaction` (trên) là bảng giao dịch phẳng đã có; `LedgerEntry` là lớp
    trên đó cho phép mở rộng loại dòng tiền (cổ tức, phí, thuế, corporate
    action) mà không phải nhét tất cả vào `transaction_type`.

    Ranh giới với `Transaction` — sửa cái này làm hỏng cái kia:
    - `Transaction` là **nguồn** (broker đồng bộ vào, có thể sửa khi broker
      báo sai). `LedgerEntry` là **sổ** (chỉ append).
    - LED-05 backfill `Transaction` → `LedgerEntry` một chiều. Sau khi
      backfill, `Transaction` vẫn còn và vẫn được đọc cho tới khi contract
      phase chạy — vì vậy hai bảng phải giữ cùng bộ luật validator.
    """

    class EntryType(models.TextChoices):
        BUY = 'BUY', 'Mua'
        SELL = 'SELL', 'Bán'
        DIVIDEND = 'DIVIDEND', 'Cổ tức tiền mặt'
        SPLIT = 'SPLIT', 'Chia tách'
        BONUS = 'BONUS', 'Cổ phiếu thưởng'
        FEE = 'FEE', 'Phí'
        TAX = 'TAX', 'Thuế'
        ADJUSTMENT = 'ADJUSTMENT', 'Điều chỉnh'

    class Source(models.TextChoices):
        MANUAL = 'manual', 'Nhập tay'
        BROKER = 'broker', 'Đồng bộ từ broker'
        ADJUSTMENT = 'adjustment', 'Bù sai số'
        BACKFILL = 'backfill', 'Backfill từ Transaction'

    class Market(models.TextChoices):
        """Thị trường — quyết định luật lô (LED-04 R3).

        D-35: không chặn crypto ở đây mà ở tầng giao diện; nhưng nếu crypto
        lọt vào với `VN_SPOT` thì nó nhận `lot=100` + T+2 của cổ phiếu Việt,
        sai hoàn toàn. Nên thị trường phải là dữ liệu, không phải suy luận từ
        tên mã.
        """

        VN_SPOT = 'VN_SPOT', 'Cổ phiếu niêm yết'
        VN_FLOOR = 'VN_FLOOR', 'Cổ phiếu UPCoM'
        FOREIGN = 'FOREIGN', 'Thị trường nước ngoài'
        CRYPTO = 'CRYPTO', 'Tiền mã hoá'
        UNKNOWN = 'UNKNOWN', 'Chưa xác định'

    tenant = models.ForeignKey(
        'identity_access.CoreTenant',
        on_delete=models.CASCADE,
        related_name='ledger_entries',
        verbose_name='Tenant',
        help_text='D-03: bắt buộc NOT NULL — không có entry nào tenant-less.',
    )
    portfolio = models.ForeignKey(
        Portfolio,
        on_delete=models.CASCADE,
        related_name='ledger_entries',
        verbose_name='Danh mục',
    )
    entry_type = models.CharField(
        max_length=12, choices=EntryType.choices, db_index=True, verbose_name='Loại dòng')
    symbol = models.CharField(max_length=32, db_index=True, verbose_name='Mã cổ phiếu')
    trade_date = models.DateField(db_index=True, verbose_name='Ngày giao dịch')
    quantity = models.BigIntegerField(
        validators=[MinValueValidator(0)],
        verbose_name='Số lượng',
        help_text='Số cổ phiếu. Với DIVIDEND đây là số cổ phiếu được trả cổ tức '
                  'và `price` là cổ tức mỗi cổ phiếu — xem docstring `clean()`.',
    )
    price = models.DecimalField(
        max_digits=18, decimal_places=2,
        validators=[MinValueValidator(Decimal('0'))],
        verbose_name='Giá (VNĐ)',
    )
    fee = models.DecimalField(
        max_digits=18, decimal_places=2, default=0,
        validators=[MinValueValidator(Decimal('0'))], verbose_name='Phí')
    tax = models.DecimalField(
        max_digits=18, decimal_places=2, default=0,
        validators=[MinValueValidator(Decimal('0'))], verbose_name='Thuế')
    market = models.CharField(
        max_length=10, choices=Market.choices, default=Market.UNKNOWN,
        db_index=True, verbose_name='Thị trường')
    source = models.CharField(
        max_length=12, choices=Source.choices, default=Source.MANUAL,
        db_index=True, verbose_name='Nguồn')
    external_id = models.CharField(
        max_length=100, blank=True, default='', db_index=True,
        verbose_name='Mã tham chiếu broker')
    reversal_of = models.ForeignKey(
        'self', on_delete=models.PROTECT, related_name='reversals',
        null=True, blank=True, verbose_name='Đảo của dòng')
    created_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='core_ledger_entries', verbose_name='Người tạo')
    # LED-05 R3: mỗi row do backfill ghi đều mang marker, để reverse chỉ revert
    # đúng những row do chính migration đó tạo (D-24).
    backfilled_by = models.CharField(
        max_length=64, blank=True, default='', db_index=True,
        verbose_name='Migration đã backfill dòng này')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Dòng sổ cái'
        verbose_name_plural = 'Dòng sổ cái'
        ordering = ['trade_date', 'pk']
        constraints = [
            # LED-01 R4: idempotency khi đồng bộ broker. `external_id=''` là
            # giá trị rỗng chứ không phải NULL (khớp `Transaction.external_id`
            # đang có) nên điều kiện partial loại đúng nhóm manual.
            models.UniqueConstraint(
                fields=['tenant', 'external_id'],
                condition=~Q(external_id=''),
                name='uniq_ledger_entry_tenant_external_id',
            ),
            # Một dòng chỉ được đảo đúng một lần — tránh "sửa sai số hai lần"
            # bằng hai entry ADJUSTMENT trỏ cùng một dòng gốc.
            models.UniqueConstraint(
                fields=['reversal_of'],
                condition=Q(reversal_of__isnull=False),
                name='uniq_ledger_entry_single_reversal',
            ),
        ]
        indexes = [
            models.Index(fields=['portfolio', 'symbol', 'trade_date']),
            models.Index(fields=['tenant', 'portfolio', 'trade_date']),
        ]

    def clean(self):
        """Luật theo loại dòng (LED-04 R1/R2).

        **MỘT ĐIỂM SỬA SO VỚI TÀI LIỆU — ghi lại vì đây là chỗ dễ sai nhất.**
        Slice doc LED-04 R2 viết: "`quantity > 0` cho BUY/SELL; = 0 cho DIVIDEND".
        Điều đó mâu thuẫn với D-06 và với hành vi đã chạy thật trong
        `ledger/holdings.py:266-275`, nơi `DIVIDEND` tính `gross = price * qty`
        — tức `quantity` là **số cổ phiếu được trả cổ tức** và `price` là cổ
        tức mỗi cổ phiếu. Nếu đặt `quantity = 0` cho DIVIDEND thì mọi dòng cổ
        tức từ broker (vốn luôn gửi kèm số cổ phiếu) sẽ bị từ chối.

        Vì vậy ở đây: DIVIDEND cần `quantity > 0` và `price >= 0`. Cổ tức bằng 0
        là dữ liệu vô nghĩa chứ không phải dữ liệu hợp lệ.
        """
        super().clean()
        if self.entry_type == self.EntryType.DIVIDEND:
            if self.quantity is not None and self.quantity <= 0:
                raise ValidationError(
                    {'quantity': 'Dòng cổ tức cần số cổ phiếu được trả cổ tức (> 0).'})
            return
        if self.entry_type not in (self.EntryType.BUY, self.EntryType.SELL):
            return
        if self.quantity is not None and self.quantity <= 0:
            raise ValidationError(
                {'quantity': 'Số lượng phải > 0 với dòng MUA/BÁN.'})
        if self.price is not None and self.price <= Decimal('0'):
            raise ValidationError(
                {'price': 'Giá phải > 0 với dòng MUA/BÁN.'})

    def save(self, *args, **kwargs):
        """Append-only (LED-01 R2). Logic nằm trong `AppendOnlyMixin`.

        Ghi đè này chỉ để giữ chỗ cho mô tả; hành vi thật ở mixin vì nó cần
        hỏi DB (xem `AppendOnlyMixin._already_committed` — bản đầu chỉ dựa
        vào `_state.adding` và bị lách bằng `LedgerEntry(pk=<đã tồn tại>)`).
        """
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return (f'{self.entry_type} {self.quantity} {self.symbol} @ {self.price} '
                f'({self.trade_date})')


class CashFlow(models.Model):
    """LED-01 R3 — dòng tiền tách khỏi số lượng/giá.

    **Vì sao có bảng này:** một dòng `LedgerEntry` BUY vừa có số lượng vừa có
    giá vừa có phí — nếu ta cộng từng trường để ra tiền mặt thì mỗi consumer
    phải tự biết quy tắc D-06 và rất dễ sai lệch (đó chính là lỗi cũ mà
    `ledger/holdings.py` docstring liệt kê). Ở đây mỗi entry sinh đúng một
    hoặc nhiều dòng `CashFlow` với `amount` đã ký, nên NAV chỉ cần một phép
    cộng.

    **`amount` có dấu:** dương = tiền vào tài khoản, âm = tiền ra. Giữ dấu ở
    đây thay vì suy ra từ `flow_type` để không có hai nguồn sự thật cho cùng
    một câu hỏi ("dòng này vào hay ra?").

    `flow_type` chỉ đặt tên **lý do**. Ba giá trị `BUY`/`SELL` nằm ngoài danh
    sách trong tài liệu (`dividend/fee/tax/deposit/withdrawal/interest`) nhưng
    không có chúng thì tiền mua/bán không bao giờ vào bảng này và NAV sai ngay
    từ giao dịch đầu tiên. Ghi ra đây thay vì âm thầm bỏ sót.
    """

    class FlowType(models.TextChoices):
        BUY = 'BUY', 'Mua cổ phiếu (tiền ra)'
        SELL = 'SELL', 'Bán cổ phiếu (tiền vào)'
        DIVIDEND = 'DIVIDEND', 'Cổ tức'
        FEE = 'FEE', 'Phí'
        TAX = 'TAX', 'Thuế'
        DEPOSIT = 'DEPOSIT', 'Nạp tiền'
        WITHDRAWAL = 'WITHDRAWAL', 'Rút tiền'
        INTEREST = 'INTEREST', 'Lãi tiền gửi'

    entry = models.ForeignKey(
        LedgerEntry, on_delete=models.CASCADE, related_name='cash_flows',
        verbose_name='Dòng sổ cái')
    tenant = models.ForeignKey(
        'identity_access.CoreTenant', on_delete=models.CASCADE,
        related_name='cash_flows', verbose_name='Tenant')
    flow_type = models.CharField(
        max_length=12, choices=FlowType.choices, db_index=True, verbose_name='Loại dòng tiền')
    amount = models.DecimalField(
        max_digits=20, decimal_places=2, verbose_name='Số tiền (có dấu)')
    currency = models.CharField(
        max_length=3, default='VND', verbose_name='Tiền tệ',
        help_text='D-05: chỉ VND ở R1. Multi-currency defer.')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Dòng tiền'
        verbose_name_plural = 'Dòng tiền'
        ordering = ['pk']
        indexes = [
            models.Index(fields=['tenant', 'flow_type']),
        ]

    def __str__(self) -> str:
        return f'{self.flow_type} {self.amount} {self.currency}'


class PositionSnapshot(AppendOnlyMixin, TenantScopedByParentMixin, models.Model):
    """LED-02 — ảnh chụp vị thế tại một ngày.

    Vì sao cần: `compute_ledger()` chạy lại toàn bộ lịch sử mỗi lần đọc. Với
    danh mục vài nghìn giao dịch thì tốn, và quan trọng hơn — **con số hôm nay
    sẽ khác hôm qua nếu thêm một giao dịch cũ**. Không có bảng này thì không
    trả lời được "hôm đó tôi đang giữ bao nhiêu", tức không vẽ được đường NAV
    lịch sử.

    **`weight` được tính lúc ghi snapshot**, chia cho tổng `market_value` của
    **cùng ngày đó** trong **cùng portfolio**. Nó là snapshot của một thời điểm,
    không phải hàm của trạng thái hiện tại — đọc lại 3 tháng sau mà tính lại
    `weight` từ giá hôm nay sẽ ra con số sai.
    """

    tenant = models.ForeignKey(
        'identity_access.CoreTenant', on_delete=models.CASCADE,
        related_name='position_snapshots', verbose_name='Tenant')
    portfolio = models.ForeignKey(
        Portfolio, on_delete=models.CASCADE, related_name='position_snapshots',
        verbose_name='Danh mục')
    symbol = models.CharField(max_length=32, db_index=True, verbose_name='Mã')
    as_of_date = models.DateField(db_index=True, verbose_name='Ngày chụp')
    quantity = models.DecimalField(max_digits=20, decimal_places=4, default=0)
    avg_cost = models.DecimalField(max_digits=20, decimal_places=2, default=0)
    current_price = models.DecimalField(
        max_digits=20, decimal_places=2, null=True, blank=True,
        verbose_name='Giá hiện tại',
        help_text='NULL khi chưa có giá — không dùng 0 để tránh số giả.')
    market_value = models.DecimalField(max_digits=20, decimal_places=2, null=True, blank=True)
    unrealized_pnl = models.DecimalField(
        max_digits=20, decimal_places=2, null=True, blank=True)
    realized_pnl_cum = models.DecimalField(max_digits=20, decimal_places=2, default=0)
    weight = models.DecimalField(
        max_digits=9, decimal_places=6, null=True, blank=True,
        verbose_name='Tỷ trọng (0..1)')
    calculation_version = models.CharField(
        max_length=32, verbose_name='Phiên bản thuật toán')
    source = models.CharField(max_length=16, default='computed', verbose_name='Nguồn')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Ảnh chụp vị thế'
        verbose_name_plural = 'Ảnh chụp vị thế'
        ordering = ['-as_of_date', 'symbol']
        constraints = [
            models.UniqueConstraint(
                fields=['portfolio', 'symbol', 'as_of_date'],
                name='uniq_position_snapshot_portfolio_symbol_date',
            ),
        ]

    def __str__(self) -> str:
        return f'{self.symbol} @ {self.as_of_date}'


class ValuationSnapshot(AppendOnlyMixin, TenantScopedByParentMixin, models.Model):
    """LED-03 — NAV chụp theo ngày.

    Công thức (LED-03 R2): ``nav = stock_value + cash - debt``

    Trong đó ``cash = opening_balance + Σ CashFlow.amount`` cho tới ngày chụp.
    `opening_balance` là **nguồn gốc** của tiền mặt (LED-03 R3): số dư mở đầu
    là một sự kiện đã xảy ra trước khi hệ thống bắt đầu ghi, nên không thể suy
    ra nó từ lịch sử giao dịch. Không có nó thì `nav = NULL` kèm `nav_reason`,
    tuyệt đối không trả 0 (LED-03 R5 / AC4).
    """

    tenant = models.ForeignKey(
        'identity_access.CoreTenant', on_delete=models.CASCADE,
        related_name='valuation_snapshots', verbose_name='Tenant')
    portfolio = models.ForeignKey(
        Portfolio, on_delete=models.CASCADE, related_name='valuation_snapshots',
        verbose_name='Danh mục')
    as_of_date = models.DateField(db_index=True, verbose_name='Ngày chụp')
    # `stock_value` / `cash` / `debt` NULLABLE — cố ý.
    #
    # Bản đầu để chúng `NOT NULL DEFAULT 0`. Đó là một cái bẫy cấu trúc: `nav`
    # nullable đúng, nhưng tới ngày không định giá được, schema **chỉ còn một
    # đáp án hợp lệ** và nó là con số 0 bịa. Không có ràng buộc DB nào thay thế
    # được cho việc cho phép biểu diễn "chưa biết".
    stock_value = models.DecimalField(
        max_digits=20, decimal_places=2, null=True, blank=True,
        verbose_name='Giá trị cổ phiếu')
    cash = models.DecimalField(
        max_digits=20, decimal_places=2, null=True, blank=True, verbose_name='Tiền mặt')
    debt = models.DecimalField(
        max_digits=20, decimal_places=2, null=True, blank=True, default=0,
        verbose_name='Nợ',
        help_text='Cash account = 0. Margin defer sang LIV-03 (LED-03 PB3).')
    nav = models.DecimalField(
        max_digits=20, decimal_places=2, null=True, blank=True,
        verbose_name='NAV')
    nav_reason = models.CharField(
        max_length=64, blank=True, default='',
        verbose_name='Lý do chưa có NAV')
    opening_balance = models.DecimalField(
        max_digits=20, decimal_places=2, null=True, blank=True,
        verbose_name='Số dư mở đầu')
    currency = models.CharField(max_length=3, default='VND')
    calculation_version = models.CharField(max_length=32, verbose_name='Phiên bản thuật toán')
    source = models.CharField(max_length=16, default='computed', verbose_name='Nguồn')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Ảnh chụp định giá'
        verbose_name_plural = 'Ảnh chụp định giá'
        ordering = ['-as_of_date']
        constraints = [
            models.UniqueConstraint(
                fields=['portfolio', 'as_of_date'],
                name='uniq_valuation_snapshot_portfolio_date',
            ),
        ]

    def __str__(self) -> str:
        return f'NAV {self.nav} @ {self.as_of_date}'


class IdempotencyRecord(models.Model):
    """LED-06 — bản ghi idempotency có ràng buộc UNIQUE ở tầng DB.

    Thay cho cache-based idempotency của `services/idempotency.py`. Cache
    không giải quyết được race thật: `cache.add` chỉ atomic **trong một
    process**, còn production chạy nhiều worker ⇒ hai request song song có thể
    cùng thắng một key và tạo hai lệnh. UNIQUE constraint thì không thể thắng
    được ở bất kỳ số process nào.

    `request_hash` là điều kiện để phân biệt retry hợp lệ với client tái sử
    dụng nhầm key: cùng key + cùng hash ⇒ trả lại response cũ; cùng key +
    khác hash ⇒ `409` (SAFE-02 R7).
    """

    tenant = models.ForeignKey(
        'identity_access.CoreTenant', on_delete=models.CASCADE,
        related_name='idempotency_records', verbose_name='Tenant')
    actor = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name='idempotency_records',
        verbose_name='Tác nhân')
    scope = models.CharField(max_length=64, verbose_name='Phạm vi thao tác')
    key = models.CharField(max_length=255, verbose_name='Idempotency-Key')
    request_hash = models.CharField(max_length=64, verbose_name='Hash payload')
    response_code = models.PositiveSmallIntegerField(
        null=True, blank=True, verbose_name='Mã trả về')
    response_body = models.JSONField(
        null=True, blank=True, verbose_name='Body đã trả')
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    # D-12: TTL 7 ngày cho order. Hết hạn thì key được tái dùng được — nên
    # việc dọn là xoá theo `expires_at`, KHÔNG phải "giữ mãi".
    expires_at = models.DateTimeField(db_index=True, verbose_name='Hết hạn lúc')

    class Meta:
        verbose_name = 'Bản ghi idempotency'
        verbose_name_plural = 'Bản ghi idempotency'
        ordering = ['-created_at']
        constraints = [
            models.UniqueConstraint(
                fields=['tenant', 'actor', 'scope', 'key'],
                name='uniq_idempotency_tenant_actor_scope_key',
            ),
        ]

    def __str__(self) -> str:
        return f'{self.scope}:{self.key} ({self.actor_id})'


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
@receiver(pre_save, sender=LedgerEntry)
@receiver(pre_save, sender=CashFlow)
@receiver(pre_save, sender=PositionSnapshot)
@receiver(pre_save, sender=ValuationSnapshot)
@receiver(pre_save, sender=IdempotencyRecord)
@receiver(pre_save, sender=Watchlist)
@receiver(pre_save, sender=TrackedSymbol)
@receiver(pre_save, sender=PriceAlert)
@receiver(pre_save, sender=ScreenerRule)
@receiver(pre_save, sender=ScreenerRunHistory)
@receiver(pre_save, sender=ScreenerSchedule)
def resolve_tenant_for_user_workspace_models(sender, instance, **kwargs):
    resolve_tenant_for_user_workspace_instance(instance)



