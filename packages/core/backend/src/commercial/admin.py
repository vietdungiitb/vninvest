from django.contrib import admin

from vninvest_core.admin_ui import (
    VNAdminMixin,
    VNReadOnlyMixin,
    badge_for,
    decimal_vi,
    money_vi,
)

from .models import Invoice, QuotaRecord, Subscription


@admin.register(Subscription)
class SubscriptionAdmin(VNAdminMixin, admin.ModelAdmin):
    list_display = ('tenant', 'plan', 'status_badge', 'current_period_start',
                    'current_period_end', 'cancel_at_period_end')
    list_filter = ('status', 'plan', 'cancel_at_period_end')
    search_fields = ('tenant__display_name', 'tenant__tenant_code')
    readonly_fields = ('created_at', 'updated_at')
    # AC S3-AC7: `tenant` nằm trong `list_display` ⇒ phải `select_related` để
    # không N+1 khi duyệt danh sách.
    list_select_related = ('tenant',)
    date_hierarchy = 'current_period_start'
    ordering = ('-created_at',)

    @admin.display(description='Trạng thái', ordering='status')
    def status_badge(self, obj):
        return badge_for(obj.status)


@admin.register(QuotaRecord)
class QuotaRecordAdmin(VNAdminMixin, admin.ModelAdmin):
    list_display = ('tenant', 'period_start', 'period_end',
                    'api_calls_used_display', 'api_calls_limit_display', 'symbols_used')
    list_filter = ('period_start',)
    search_fields = ('tenant__display_name', 'tenant__tenant_code')
    readonly_fields = ('updated_at',)
    list_select_related = ('tenant',)
    date_hierarchy = 'period_start'
    ordering = ('-period_start',)

    @admin.display(description='Lời gọi đã dùng')
    def api_calls_used_display(self, obj):
        return decimal_vi(obj.api_calls_used, decimals=0)

    @admin.display(description='Hạn mức lời gọi')
    def api_calls_limit_display(self, obj):
        return decimal_vi(obj.api_calls_limit, decimals=0)


@admin.register(Invoice)
class InvoiceAdmin(VNAdminMixin, admin.ModelAdmin):
    list_display = ('invoice_number', 'tenant', 'status_badge',
                    'amount_due_display', 'period_start', 'due_date', 'paid_at')
    list_filter = ('status', 'currency')
    search_fields = ('invoice_number', 'tenant__display_name', 'tenant__tenant_code')
    readonly_fields = ('created_at', 'updated_at')
    list_select_related = ('tenant',)
    date_hierarchy = 'period_start'
    ordering = ('-created_at',)

    @admin.display(description='Trạng thái', ordering='status')
    def status_badge(self, obj):
        return badge_for(obj.status)

    @admin.display(description='Số tiền còn nợ', ordering='amount_due')
    def amount_due_display(self, obj):
        # AC S3-AC4: `199.000 ₫` — ký hiệu TRƯỚC, dấu chấm phân tách hàng nghìn.
        # Số dương ẩn phần dư cho VND (đơn vị không có phần thập phân).
        return money_vi(obj.amount_due, obj.currency or 'VND')

# --- Import cho khoi WAVE 16 -------------------------------------
from .models import (
    PaymentTransaction,
    VNPayIPNLog,
    QuotaHistory,
)
from vninvest_core.admin_ui import (
    badge_for,
    VNAdminMixin,
    VNReadOnlyMixin,
)


def _ws_badge(value, mapping=None):
    """Badge có chữ theo bảng màu riêng của nhóm.

    Tách riêng thay vì dùng thẳng `badge_for(..., color=...)` để chỗ gọi
    được đọc là "trạng thái này tô màu này" thay vì lặp lại chuỗi màu.
    """
    if value in (None, ""):
        return "—"
    return badge_for(value, color=(mapping or {}).get(str(value), "blue"))

# --- Thanh toán & hạn mức ---------------------------------------------------
@admin.register(PaymentTransaction)
class PaymentTransactionAdmin(VNReadOnlyMixin, admin.ModelAdmin):
    """Giao dịch thanh toán VNPay — chỉ đọc.

    Không cho sửa tay: số tiền và trạng thái thanh toán phải khớp với
    bên VNPay. Mọi điều chỉnh đi qua quy trình hoàn tiền.
    """

    list_display = ('created_at', 'txn_ref', 'tenant', 'invoice', 'amount', 'plan', 'status', 'vnp_transaction_no')
    list_filter = ('status', 'plan', 'created_at', 'tenant')
    search_fields = ('txn_ref', 'vnp_transaction_no', 'error_code')
    autocomplete_fields = ('invoice', 'tenant')
    ordering = ('-created_at',)
    date_hierarchy = 'created_at'
    list_per_page = 100

    @admin.display(description='Trạng thái', ordering='status')
    def status(self, obj):
        return _ws_badge(obj.status, {
            'pending': 'yellow', 'success': 'green', 'failed': 'red', 'refunded': 'blue',
        })


@admin.register(VNPayIPNLog)
class VNPayIPNLogAdmin(VNReadOnlyMixin, admin.ModelAdmin):
    """Log IPN VNPay — bằng chứng đối soát, chỉ đọc."""

    list_display = ('created_at', 'txn_ref', 'is_valid_signature', 'processed', 'error_message')
    list_filter = ('is_valid_signature', 'processed', 'created_at')
    search_fields = ('txn_ref', 'error_message', 'raw_query')
    ordering = ('-created_at',)
    date_hierarchy = 'created_at'
    list_per_page = 100


@admin.register(QuotaHistory)
class QuotaHistoryAdmin(VNReadOnlyMixin, admin.ModelAdmin):
    """Ảnh chụp hạn mức tiêu thụ theo ngày — chỉ đọc."""

    list_display = ('date', 'tenant', 'meter_code', 'consumed_amount', 'entitled_amount', 'remaining_amount', 'risk_state', 'hard_stop')
    list_filter = ('date', 'meter_code', 'risk_state', 'hard_stop', 'tenant')
    search_fields = ('meter_code', 'meter_name', 'tenant__tenant_code')
    autocomplete_fields = ('tenant',)
    ordering = ('-date', 'meter_code')
    date_hierarchy = 'date'
    list_per_page = 100

    @admin.display(description='Rủi ro', ordering='risk_state')
    def risk_state(self, obj):
        return _ws_badge(obj.risk_state, {
            'normal': 'green', 'warning': 'yellow', 'critical': 'red',
        })
