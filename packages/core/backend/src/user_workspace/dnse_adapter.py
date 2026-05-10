"""
dnse_adapter.py — Thin glue giữa VNInvest Core và vnbroker DNSE LightSpeed API path.

Auth flow chuẩn (DNSE LightSpeed API):
  POST /v2/authentication/token
  Body: { "client_id": "...", "client_secret": "..." }
  Response: { "access_token": "...", "token_type": "Bearer", "expires_in": 3600 }

Quy tắc cứng:
- Tất cả HTTP/signature logic DNSE phải nằm trong `vnbroker`, không tái hiện ở đây.
- File này chỉ glue: lấy client_id/secret đã giải mã, gọi vnbroker, trả kết quả.
- KHÔNG dùng username/password tài khoản cá nhân — đó là retail login, không phải API.
- KHÔNG log client_id, client_secret, hay access_token.
- KHÔNG có stub fallback ghi dữ liệu giả — khi vnbroker unavailable phải raise lỗi rõ.
- Public market data phải dùng multi-provider vnbroker route, không hard-code sang DNSE-only.
"""
from __future__ import annotations

import logging
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from .models import DNSECredential

logger = logging.getLogger(__name__)

DNSE_TOKEN_ENDPOINT = "https://openapi.dnse.com.vn/v2/authentication/token"


class DNSEAdapterError(Exception):
    """Lỗi glue layer khi kết nối với DNSE LightSpeed API."""


class DNSECredentialMissingError(DNSEAdapterError):
    """Credential chưa được cấu hình — client_id hoặc client_secret trống."""


class DNSEVnbrokerUnavailableError(DNSEAdapterError):
    """vnbroker DNSE connector chưa được cài hoặc không import được."""


def _get_vnbroker_dnse_token():
    """
    Lazy import vnbroker DNSE token exchange function.
    Trả về callable hoặc raise DNSEVnbrokerUnavailableError — KHÔNG trả None.
    """
    try:
        from vnbroker.brokers.dnse import get_access_token
        return get_access_token
    except ImportError:
        pass
    try:
        from vnbroker.connector.dnse import get_access_token
        return get_access_token
    except ImportError:
        pass
    raise DNSEVnbrokerUnavailableError(
        "vnbroker DNSE connector chưa khả dụng. "
        "Cài đặt vnbroker >= phiên bản hỗ trợ LightSpeed API trước khi kích hoạt DNSE sync."
    )


def bootstrap_dnse_session(credential: "DNSECredential") -> dict:
    """
    Lấy Bearer access_token từ DNSE LightSpeed API bằng client_id + client_secret.

    Returns:
        {"ok": True, "access_token": "<token>", "expires_in": 3600}

    Raises:
        DNSECredentialMissingError: nếu credential chưa đầy đủ.
        DNSEVnbrokerUnavailableError: nếu vnbroker không import được.
        DNSEAdapterError: nếu DNSE API từ chối hoặc lỗi mạng.
    """
    if not credential.has_credentials():
        raise DNSECredentialMissingError(
            "DNSE LightSpeed credential chưa được cấu hình. "
            "Vui lòng cung cấp Client ID và Client Secret từ trang quản lý EntradeX."
        )

    client_id = credential.get_client_id()
    client_secret = credential.get_client_secret()

    if not client_id or not client_secret:
        raise DNSECredentialMissingError(
            "Giải mã credential thất bại — client_id hoặc client_secret trống sau khi giải mã."
        )

    get_access_token = _get_vnbroker_dnse_token()

    try:
        result = get_access_token(client_id=client_id, client_secret=client_secret)
    except DNSEVnbrokerUnavailableError:
        raise
    except Exception as exc:
        logger.warning("dnse_adapter: bootstrap_dnse_session thất bại — %s", type(exc).__name__)
        raise DNSEAdapterError(
            "Không thể lấy access_token từ DNSE LightSpeed API. Kiểm tra Client ID/Secret và kết nối mạng."
        ) from exc

    access_token = result.get("access_token") if isinstance(result, dict) else result
    if not access_token:
        raise DNSEAdapterError(
            "DNSE LightSpeed API không trả về access_token hợp lệ."
        )

    return {
        "ok": True,
        "access_token": access_token,
        "expires_in": result.get("expires_in", 3600) if isinstance(result, dict) else 3600,
    }
