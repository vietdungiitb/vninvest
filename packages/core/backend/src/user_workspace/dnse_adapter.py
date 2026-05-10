"""
dnse_adapter.py — Thin glue giữa VNInvest Core và vnbroker DNSE broker path.

Quy tắc cứng:
- Tất cả HTTP/signature logic DNSE phải nằm trong `vnbroker`, không tái hiện ở đây.
- File này chỉ đóng vai trò glue: lấy credential đã giải mã, gọi vnbroker, trả kết quả.
- Không log credential hay token dưới bất kỳ hình thức nào.
- Public market data phải dùng multi-provider vnbroker route, không hard-code sang DNSE-only.
"""
from __future__ import annotations

import logging
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from .models import DNSECredential

logger = logging.getLogger(__name__)


class DNSEAdapterError(Exception):
    """Lỗi chung của DNSE adapter."""


def _get_vnbroker_dnse_login():
    """
    Lazy import vnbroker DNSE login.
    """
    try:
        from vnbroker.brokers.dnse import login as dnse_login
        return dnse_login
    except ImportError:
        try:
            from vnbroker import login as dnse_login
            return dnse_login
        except ImportError:
            return None


def bootstrap_dnse_session(credential: "DNSECredential") -> dict:
    """
    Khởi tạo phiên giao dịch DNSE.
    """
    username = credential.get_username()
    password = credential.get_password()

    if not username or not password:
        return {
            "ok": False,
            "session": None,
            "error": "Credential chưa được cấu hình đầy đủ.",
        }

    dnse_login = _get_vnbroker_dnse_login()
    if dnse_login is None:
        logger.info("dnse_adapter: vnbroker DNSE login chưa khả dụng, returning stub session.")
        return {
            "ok": True,
            "session": {"stub": True, "username": "[redacted]"},
            "error": None,
        }

    try:
        session = dnse_login(username=username, password=password)
        return {"ok": True, "session": session, "error": None}
    except Exception:
        logger.warning("dnse_adapter: bootstrap_dnse_session thất bại.")
        return {"ok": False, "session": None, "error": "Đăng nhập DNSE thất bại."}
