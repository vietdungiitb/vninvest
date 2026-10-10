"""Định dạng hiển thị cho Django admin.

Vì sao không dùng `django.utils.formats`
---------------------------------------
`settings.LANGUAGE_CODE = 'en-us'` và `USE_I18N = False`. `number_format()` của
Django bám theo locale **đang hoạt động**, mà locale đang hoạt động ở đây là
`en-us` ⇒ ra `1,240,000.00`. D08 §14.2 yêu cầu `1.240.000`. Bật `vi` locale toàn
cục lại là thay đổi hệ thống (ngoài phạm vi — xem PLAN §6 Q3), nên phần định
dạng Việt ở đây **tự tính**, thuần, không phụ thuộc locale ⇒ test được.

Quy ước (D08 §14.2)
-------------------
- Số: dấu **chấm** phân tách hàng nghìn, dấu **phẩy** thập phân.
- Tiền: ký hiệu **trước** (`199.000 ₫`), không phải sau.
- Ngày: `dd/mm/YYYY`, giờ `HH:mm`.
"""

from __future__ import annotations

import datetime as dt
from decimal import Decimal, InvalidOperation

from django.utils.html import format_html
from django.utils.safestring import SafeString

#: Dấu gạch dài — thay cho chuỗi rỗng khi trường nullable không có giá trị.
#: Trước đây 37 `readonly_fields` và mọi `list_display` để trống ⇒ người đọc
#: không phân biệt được "không có" với "cắt ngang".
EMPTY_DASH = "—"

#: Ký hiệu tiền theo ISO 4217 mà repo dùng (xem `commercial/models.py`).
CURRENCY_SYMBOLS = {
    "VND": "₫",
    "USD": "$",
    "EUR": "€",
}


def empty_dash() -> SafeString:
    """Giá trị hiển thị cho trường rỗng. Luôn kèm nhãn cho screen reader."""
    return format_html('<span class="vn-empty">{}</span>', EMPTY_DASH)


def _to_decimal(value) -> Decimal | None:
    """Ép về `Decimal`, trả `None` nếu không chuyển được (không ném lỗi)."""
    if value is None or value == "":
        return None
    try:
        return Decimal(str(value))
    except (InvalidOperation, ValueError, TypeError):
        return None


def decimal_vi(value, decimals: int = 2) -> SafeString:
    """Định dạng số theo chuẩn Việt: `1.240.000,50`."""
    number = _to_decimal(value)
    if number is None:
        return empty_dash()
    negative = number < 0
    quantized = abs(number).quantize(Decimal(1).scaleb(-decimals))
    whole, _, fraction = f"{quantized:f}".partition(".")
    grouped = f"{int(whole):,}".replace(",", ".")
    text = f"{grouped},{fraction}" if decimals > 0 else grouped
    return format_html("{}{}", "-" if negative else "", text)


def money_vi(value, currency: str = "VND", decimals: int | None = None) -> SafeString:
    """Định dạng tiền theo chuẩn Việt: `1.240.000 ₫`.

    D08 §14.2 ghi rõ: đúng là `199.000 ₫`, **sai** là `₫199.000` — tức số đứng
    trước, ký hiệu đứng sau. (Cụm "ký hiệu trước" trong bảng tiếng Việt dễ đọc
    nhầm là "ký hiệu đặt trước số"; ví dụ mẫu mới là chuẩn. Test
    `test_S3_AC4_money_vi_...` khoá lại hành vi này.)

    `decimals=None` ⇒ mặc định 0 với VND (đơn vị không có phần thập phân) và 2
    với các loại tiền tệ khác.
    """
    number = _to_decimal(value)
    if number is None:
        return empty_dash()
    if decimals is None:
        decimals = 0 if currency.upper() == "VND" else 2
    symbol = CURRENCY_SYMBOLS.get(currency.upper(), currency.upper())
    negative = number < 0
    quantized = abs(number).quantize(Decimal(1).scaleb(-decimals))
    whole, _, fraction = f"{quantized:f}".partition(".")
    grouped = f"{int(whole):,}".replace(",", ".")
    text = f"{grouped},{fraction}" if decimals > 0 else grouped
    return format_html("{}{} {}", "-" if negative else "", text, symbol)


def percent_vi(value, decimals: int = 2) -> SafeString:
    """Định dạng phần trăm theo chuẩn Việt, **giữ dấu**: `+1,25%` / `-1,25%`.

    Dấu là thông tin, không phải trang trí: cột phần trăm mà không dấu thì đọc
    không biết tăng hay giảm — cùng nguyên tắc "không chỉ dựa vào màu"
    (D08 §13) áp dụng cho **ký hiệu chữ**.

    ⚠ Lỗi đã sửa: bản đầu `abs()` rồi chỉ thêm `+` khi dương ⇒ **mất dấu âm**
    và biến `-1,25%` thành `1,25%`. Bắt được bởi test
    `test_percent_vi_keeps_sign`.
    """
    number = _to_decimal(value)
    if number is None:
        return empty_dash()
    sign = "+" if number > 0 else ("-" if number < 0 else "")
    body = f"{decimal_vi(abs(number), decimals)}"
    return format_html("{}{}%", sign, body)


def datetime_vi(value, with_time: bool = True) -> SafeString:
    """Định dạng ngày giờ Việt Nam: `dd/mm/YYYY` hoặc `dd/mm/YYYY HH:mm`."""
    if not value:
        return empty_dash()
    if isinstance(value, dt.datetime):
        aware = getattr(value, "tzinfo", None) is not None
        if aware:
            value = dt.datetime.fromtimestamp(value.timestamp())
        text = value.strftime("%d/%m/%Y %H:%M" if with_time else "%d/%m/%Y")
        return format_html('<span class="vn-mono">{}</span>', text)
    if isinstance(value, dt.date):
        return format_html('<span class="vn-mono">{}</span>', value.strftime("%d/%m/%Y"))
    return empty_dash()


def badge(text, tone: str = "neutral") -> SafeString:
    """Badge trạng thái — **luôn có chữ**, không bao giờ chỉ là chấm màu.

    D08 §13 liệt kê "Không chỉ dựa vào màu — hạn mức có nhãn chữ" là yêu cầu
    WCAG 1.4.1. Một ô màu trống mà không có chữ là thông tin chỉ truyền qua
    kênh thị giác.
    """
    return format_html(
        '<span class="vn-badge vn-badge--{}">{}</span>',
        tone,
        text if text not in (None, "") else EMPTY_DASH,
    )


#: Ngữ nghĩa tone. Dùng chung để mọi cột trạng thái ánh xạ nhất quán — trước
#: đây mỗi `admin.py` tự quyết định nên cùng một trạng thái có thể hiện khác
#: nhau giữa hai màn hình.
TONE_SUCCESS = frozenset(
    {
        "active", "completed", "success", "succeeded", "ok", "healthy",
        "paid", "accepted", "resolved", "connected", "verified", "true",
        "ready", "done", "sent", "activated", "granted",
    }
)
TONE_DANGER = frozenset(
    {
        "failed", "failure", "error", "cancelled", "canceled", "revoked",
        "expired", "rejected", "blocked", "unhealthy", "down", "critical",
        "quarantined", "false", "deleted",
    }
)
TONE_WARNING = frozenset(
    {
        "pending", "warning", "degraded", "partial", "stale", "rotating",
        "trial", "past_due", "medium", "high", "in_progress", "processing",
        "quota_exceeded", "deferred", "queued",
    }
)
TONE_PRIMARY = frozenset({"info", "running", "active_job", "syncing"})


def tone_for(value: str | None) -> str:
    """Suy ra tone từ giá trị trạng thái. Trả `"neutral"` nếu không khớp.

    Không **đoán** tone cho giá trị lạ — trả `neutral` (màu trung tính) để một
    trạng thái mới không bị tô sai màu. Đây là hàm **thuần**, test được.
    """
    if value is None:
        return "neutral"
    key = str(value).strip().lower()
    if key in TONE_SUCCESS:
        return "success"
    if key in TONE_DANGER:
        return "danger"
    if key in TONE_WARNING:
        return "warning"
    if key in TONE_PRIMARY:
        return "primary"
    return "neutral"


def badge_for(value, label: str | None = None) -> SafeString:
    """Badge suy ra tone tự động từ giá trị trạng thái.

    `label` cho phép hiển thị nhãn tiếng Việt thay cho giá trị kỹ thuật
    (xem `labels.STATUS_LABELS`).
    """
    if value is None or value == "":
        return empty_dash()
    if isinstance(value, bool):
        text = "Có" if value else "Không"
        return badge(text, TONE_SUCCESS if value else TONE_DANGER)
    text = label if label is not None else str(value)
    return badge(text, tone_for(value))
