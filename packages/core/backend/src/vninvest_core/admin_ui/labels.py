"""Nhãn tiếng Việt cho model Django admin.

Vì sao cần
----------
`USE_I18N = False` (settings.py:326) ⇒ `{% translate %}` trong template admin
**không dịch**; nhãn hiển thị là `verbose_name` tiếng Anh mặc định của Django.
Trước đây chỉ `SystemMailConfigAdmin` có nhãn tiếng Việt
(`identity_access/admin.py:234-264`), còn 33 ModelAdmin kia hiện tên kỹ thuật
tiếng Anh cho người vận hành Việt Nam.

Vì sao **không** bật `USE_I18N`
------------------------------
Đó là thay đổi hệ thống toàn repo, ảnh hưởng mọi response API (header
`Content-Language`, format ngày/số mặc định). Nằm ngoài phạm vi admin —
xem PLAN §6 Q3. Ở đây ta dùng bảng tra cục bộ, thuần, kiểm thử được.

Quy tắc (`AGENTS.md` Constraints)
---------------------------------
- Tiếng Việt **đủ dấu**.
- Mô tả nghiệp vụ, không dùng tên kỹ thuật.
- Tránh trùng nghĩa giữa các mục (bài học đã viết trong
  `docs/ADMIN_UI_IMPLEMENTATION_STEPS.md:116-129` — "Nhóm thị trường" vs
  "Danh sách theo dõi cá nhân" từng gây hiểu nhầm).
"""

from __future__ import annotations

# ---------------------------------------------------------------------------
# Nhãn model. Key = `app_label.model_name` (KHÔNG phải tên class Python).
# Model không có trong bản đồ vẫn hiện bình thường — bản đồ là **bổ sung**,
# không phải chốt chặn (thêm model mới không được làm admin trắng).
# ---------------------------------------------------------------------------
MODEL_LABELS: dict[str, str] = {
    # ── Nguồn dữ liệu thị trường ────────────────────────────────────────────
    "market_data.StockProfile": "Hồ sơ mã chứng khoán",
    "market_data.DailyPrice": "Giá đóng cửa hằng ngày",
    "market_data.VnbrokerRuntimeConfig": "Cấu hình chạy vnbroker",
    "market_serving.SymbolSnapshot": "Ảnh chụp giá theo phiên",
    "market_serving.SessionFacts": "Số liệu tổng hợp phiên",
    # ── Hạ tầng thu thập ───────────────────────────────────────────────────
    "data_ingest.IngestJob": "Lệnh thu thập dữ liệu",
    "data_ingest.IngestRun": "Lần chạy thu thập",
    # ── Sức khoẻ dịch vụ ───────────────────────────────────────────────────
    "service_ops.ServiceDefinition": "Định nghĩa dịch vụ",
    "service_ops.ServiceConfig": "Cấu hình dịch vụ",
    "service_ops.ServiceHealth": "Trạng thái dịch vụ",
    "service_ops.ServiceHealthCheckLog": "Nhật ký kiểm tra sức khoẻ",
    "service_ops.ServiceRunLog": "Nhật ký chạy dịch vụ",
    "service_ops.MarketDataParitySnapshot": "Đối soát dữ liệu thị trường",
    "service_ops.OwnershipRecord": "Sổ sở hữu dữ liệu",
    "service_ops.ConfigChangeAudit": "Nhật ký đổi cấu hình",
    "service_ops.ScrapeMatrix": "Ma trận thu thập",
    "service_ops.ScrapeMatrixCell": "Ô ma trận thu thập",
    "service_ops.CustomSymbolGroup": "Nhóm mã tuỳ chỉnh",
    "service_ops.CachedSymbolGroup": "Nhóm mã đã đồng bộ",
    "service_ops.CachedSymbolGroupMember": "Mã thuộc nhóm đồng bộ",
    "service_ops.BackfillExecutionRun": "Lần chạy backfill",
    "service_ops.BackfillExecutionBatch": "Lô backfill",
    # ── Tín hiệu ───────────────────────────────────────────────────────────
    "signal_intelligence.UnifiedAlert": "Cảnh báo thống nhất",
    "signal_intelligence.WhaleAlertCanonical": "Cảnh báo cá voi (chuẩn hoá)",
    "signal_intelligence.OrderFlowEvent": "Sự kiện dòng lệnh",
    # ── Khách hàng ─────────────────────────────────────────────────────────
    "identity_access.CoreTenant": "Tổ chức",
    "identity_access.TenantSettings": "Cài đặt tổ chức",
    "identity_access.TenantMember": "Thành viên",
    "identity_access.TenantInvite": "Lời mời thành viên",
    "identity_access.UserProfile": "Hồ sơ người dùng",
    "identity_access.CoreServiceAccount": "Tài khoản dịch vụ",
    "identity_access.CorePATCredential": "Khoá API",
    "identity_access.SystemMailConfig": "Cấu hình gửi mail",
    "identity_access.MailConfigAuditLog": "Nhật ký cấu hình mail",
    "commercial.Subscription": "Gói thuê bao",
    "commercial.QuotaRecord": "Hạn mức sử dụng",
    "commercial.Invoice": "Hoá đơn",
    "tenant_lifecycle.TenantLifecycleEvent": "Sự kiện vòng đời tổ chức",
    # ── Danh mục ───────────────────────────────────────────────────────────
    "user_workspace.Portfolio": "Danh mục đầu tư",
    "user_workspace.Transaction": "Giao dịch",
    "user_workspace.Watchlist": "Danh sách theo dõi cá nhân",
    "user_workspace.WatchlistItem": "Mã trong danh sách theo dõi",
    # ── AI ─────────────────────────────────────────────────────────────────
    "advisory.SystemAISettings": "Cấu hình AI hệ thống",
    "advisory.AdvisorySession": "Phiên tư vấn",
    "advisory.AdvisoryRecord": "Kết quả tư vấn",
    "advisory.AdvisoryComponent": "Thành phần tư vấn",
    "advisory.UserAICredential": "Khoá API AI của người dùng",
    "ai_agents.AgentRegistry": "Danh bạ tác tử AI",
    "ai_analytics.AIUsageRecord": "Bản ghi dùng AI",
    "ai_analytics.AIUsageSummary": "Tổng hợp dùng AI",
    # ── Hỗ trợ ─────────────────────────────────────────────────────────────
    "support.SupportTicket": "Yêu cầu hỗ trợ",
    "support.TicketMessage": "Tin nhắn yêu cầu",
    "support.TicketAttachment": "Tệp đính kèm",
    "support.TicketAuditLog": "Nhật ký yêu cầu",
    "support.TicketCategory": "Phân loại yêu cầu",
    "support.TicketPriority": "Mức ưu tiên",
    "support.TicketStatus": "Trạng thái yêu cầu",
    "support.TicketCounter": "Bộ đếm mã yêu cầu",
    "support.SenderRole": "Vai trò người gửi",
    "support.SupportTicketCounter": "Bộ đếm mã yêu cầu",
    # ── Quảng cáo ──────────────────────────────────────────────────────────
    "advertising.AdCampaign": "Chiến dịch quảng cáo",
    "advertising.AdDailySummary": "Tổng hợp quảng cáo ngày",
    "advertising.AdImpressionLog": "Nhật ký hiển thị quảng cáo",
    "advertising.AdClickLog": "Nhật ký nhấp quảng cáo",
    # ── Nhật ký hệ thống ───────────────────────────────────────────────────
    "ops_audit.AuditEvent": "Sự kiện kiểm toán",
    "ops_audit.RequestTrace": "Truy vết yêu cầu",
    # ── Tác vụ nền (django_celery_beat tự đăng ký, không thuộc app của ta) ───
    "django_celery_beat.PeriodicTask": "Tác vụ định kỳ",
    "django_celery_beat.ClockedSchedule": "Lịch theo mốc thời gian",
    "django_celery_beat.CrontabSchedule": "Lịch cron",
    "django_celery_beat.SolarSchedule": "Lịch theo sự kiện thiên văn",
    "django_celery_beat.IntervalSchedule": "Lịch theo khoảng thời gian",
    # ── WAVE 16: 46 model mở admin (xem `docs/PLAN_DJANGO_ADMIN_UIUX_20261010.md`
    #    O6). Trước wave này 46 model này KHÔNG có admin nên cũng không có nhãn.
    # ── Danh tính & truy cập ──────────────────────────────────────────────
    "identity_access.TenantCustomRole": "Vai trò tuỳ biến",
    "identity_access.UsageAlertConfig": "Cấu hình cảnh báo hạn mức",
    "identity_access.TenantSSOConfig": "Cấu hình SSO của tenant",
    "identity_access.TenantWebhookConfig": "Cấu hình webhook của tenant",
    "identity_access.WebhookDelivery": "Lần gửi webhook",
    # ── Bí mật ─────────────────────────────────────────────────────────────
    "identity_access.SystemBrokerCredential": "Khoá API broker hệ thống",
    "identity_access.UserDNSECredential": "Khoá API DNSE của người dùng",
    "user_workspace.DNSECredential": "Khoá API DNSE của tài khoản",
    "user_workspace.UserBrokerConfig": "Cấu hình broker của người dùng",
    # ── Token & đăng nhập ──────────────────────────────────────────────────
    "identity_access.PasswordResetToken": "Token đặt lại mật khẩu",
    "identity_access.EmailVerificationToken": "Token xác minh email",
    "identity_access.LoginAttempt": "Lần thử đăng nhập",
    # ── Nhật ký & hàng đợi sự kiện ─────────────────────────────────────────
    "identity_access.PATAuditLog": "Nhật ký gọi API bằng PAT",
    "identity_access.OutboxEvent": "Sự kiện hàng đợi",
    "identity_access.ProcessedEvent": "Sự kiện đã xử lý",
    "identity_access.ReportDeliveryLog": "Lần gửi báo cáo",
    "identity_access.ScheduledReport": "Báo cáo định kỳ",
    "advisory.AIAuditLog": "Nhật ký trung tâm điều hành AI",
    "commercial.VNPayIPNLog": "Nhật ký IPN VNPay",
    "ops_audit.ApiCallRollup": "Tổng hợp lượt gọi API",
    # ── Thanh toán & hạn mức ───────────────────────────────────────────────
    "commercial.PaymentTransaction": "Giao dịch thanh toán",
    "commercial.QuotaHistory": "Lịch sử hạn mức",
    # ── Dữ liệu thị trường nội bộ ──────────────────────────────────────────
    "market_data.IntradayBar": "Nến trong ngày",
    "market_data.IntradayTick": "Tick giao dịch trong ngày",
    "market_data.GlobalSymbolRegistry": "Danh bạ mã toàn cục",
    "market_data.GlobalSymbolDemandSource": "Nguồn nhu cầu mã",
    "market_data.GlobalSymbolCoverage": "Độ phủ dữ liệu của mã",
    "market_serving.SessionFactsBucket": "Bucket số liệu phiên",
    # ── Tín hiệu & thông báo ───────────────────────────────────────────────
    "signal_intelligence.MarketAnomalyEvent": "Sự kiện bất thường thị trường",
    "signal_intelligence.AdvisorySignalEvent": "Tín hiệu khuyến nghị",
    "signal_intelligence.UserAlertDelivery": "Thông báo đã gửi",
    "signal_intelligence.UserAlertPreference": "Tuỳ chọn thông báo",
    # ── Danh mục & tài khoản ───────────────────────────────────────────────
    "user_workspace.TrackedSymbol": "Mã đang theo dõi",
    "user_workspace.PriceAlert": "Cảnh báo giá",
    "user_workspace.SubAccount": "Tài khoản con",
    "user_workspace.AccountSnapshot": "Ảnh chụp tài khoản",
    # ── Sổ cái & dòng tiền ────────────────────────────────────────────────
    "user_workspace.LedgerEntry": "Bút toán sổ cái",
    "user_workspace.CashFlow": "Dòng tiền",
    "user_workspace.PositionSnapshot": "Ảnh chụp vị thế",
    "user_workspace.ValuationSnapshot": "Ảnh chụp giá trị danh mục",
    # ── Bộ lọc & hạ tầng vận hành ─────────────────────────────────────────
    "user_workspace.ScreenerRule": "Quy tắc lọc cổ phiếu",
    "user_workspace.ScreenerRunHistory": "Lịch sử chạy bộ lọc",
    "user_workspace.ScreenerSchedule": "Lịch chạy bộ lọc",
    "user_workspace.IdempotencyRecord": "Bản ghi chống xử lý trùng",
    "user_workspace.QuarantinedRecord": "Bản ghi bị cách ly",
    # ── Nhãn hiệu ──────────────────────────────────────────────────────────
    "advertising.TrademarkConfig": "Cấu hình watermark nhãn hiệu",
}

# ---------------------------------------------------------------------------
# Nhãn giá trị trạng thái. Key là giá trị **kỹ thuật** trong DB, nên khai tất
# cả biến thể hoa/thường để không phụ thuộc cách viết trong model.
# Chỉ dùng khi model **không** có `choices` sẵn (model có `choices` thì Django
# tự hiển thị `get_FOO_display()` — đừng ghi đè, sẽ thành 2 nguồn sự thật).
# ---------------------------------------------------------------------------
STATUS_LABELS: dict[str, str] = {
    # Vòng đời chung
    "active": "Đang hoạt động",
    "inactive": "Ngừng hoạt động",
    "pending": "Đang chờ",
    "in_progress": "Đang xử lý",
    "processing": "Đang xử lý",
    "queued": "Trong hàng đợi",
    "syncing": "Đang đồng bộ",
    "running": "Đang chạy",
    "completed": "Hoàn tất",
    "succeeded": "Thành công",
    "success": "Thành công",
    "failed": "Thất bại",
    "failure": "Thất bại",
    "error": "Lỗi",
    "cancelled": "Đã huỷ",
    "canceled": "Đã huỷ",
    "rejected": "Bị từ chối",
    "accepted": "Đã chấp nhận",
    "resolved": "Đã xử lý",
    "closed": "Đã đóng",
    "open": "Đang mở",
    # Tài khoản / khoá
    "revoked": "Đã thu hồi",
    "expired": "Đã hết hạn",
    "rotating": "Đang xoay vòng",
    "healthy": "Bình thường",
    "degraded": "Suy giảm",
    "unhealthy": "Bất thường",
    "down": "Mất kết nối",
    "stale": "Cũ",
    # Thanh toán
    "paid": "Đã thanh toán",
    "unpaid": "Chưa thanh toán",
    "past_due": "Quá hạn",
    "trial": "Dùng thử",
    # Kỹ thuật
    "quarantined": "Bị cách ly",
    "deleted": "Đã xoá",
    "ready": "Sẵn sàng",
    "connected": "Đã kết nối",
    "verified": "Đã xác minh",
    "granted": "Đã cấp",
}


#: Chỉ mục tra cứu **chữ thường**, dựng 1 lần lúc import.
#:
#: `MODEL_LABELS` khai báo bằng tên lớp Python cho dễ đọc
#: (`identity_access.CoreTenant`), còn `Model._meta.model_name` của Django là
#: chữ thường (`coretenant`). Tra thẳng dict gốc ⇒ **luôn trượt** — đã xảy ra,
#: bắt được bởi `test_S4_AC5_model_label_is_vietnamese_with_diacritics`
#: (nhận `''` thay vì `'Tổ chức'`). Thêm khoá hạ chữ thường khi dựng.
_LABEL_INDEX: dict[str, str] = {key.lower(): value for key, value in MODEL_LABELS.items()}


def label_for(app_label: str, model_name: str = "") -> str:
    """Nhãn tiếng Việt của model; trả `""` khi không có nhãn.

    Trả `""` khi không có nhãn — caller tự fallback về hành vi mặc định của
    Django, để model mới chưa khai báo vẫn hiện bình thường.
    """
    return _LABEL_INDEX.get(_label_key(app_label, model_name), "")


def _label_key(app_label: str, model_name: str = "") -> str:
    """Chuẩn hoá khoá tra cứu, nhận cả `"app.Model"` lẫn `("app", "model")`."""
    if isinstance(app_label, str) and "." in app_label and not model_name:
        app_label, _, model_name = app_label.partition(".")
    return f"{app_label}.{model_name}".lower()


def status_label(value: str | None) -> str | None:
    """Dịch giá trị trạng thái kỹ thuật sang tiếng Việt, hoặc `None` nếu lạ."""
    if value is None:
        return None
    return STATUS_LABELS.get(str(value).strip().lower())
