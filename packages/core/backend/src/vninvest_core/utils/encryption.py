from __future__ import annotations

import base64
import hashlib
import hmac
from cryptography.fernet import Fernet, InvalidToken
from django.conf import settings


def _build_fernet() -> Fernet:
    # Derive stable 32-byte key from SECRET_KEY; no extra env needed.
    # Note: Use a different suffix for core to avoid accidental collision if keys ever mix,
    # though here we use the same concept as the project's encryption helper.
    secret = (getattr(settings, 'SECRET_KEY', '') + ':core-workspace-key').encode('utf-8')
    digest = hashlib.sha256(secret).digest()
    key = base64.urlsafe_b64encode(digest)
    return Fernet(key)


def encrypt_string(raw_text: str) -> str:
    if not raw_text:
        return ''
    token = _build_fernet().encrypt(raw_text.encode('utf-8'))
    return token.decode('utf-8')


def decrypt_string(cipher_text: str) -> str:
    if not cipher_text:
        return ''
    try:
        value = _build_fernet().decrypt(cipher_text.encode('utf-8'))
        return value.decode('utf-8')
    except (InvalidToken, ValueError, TypeError):
        return ''


def hash_with_pepper(raw_text: str) -> str:
    """
    Tạo one-way HMAC bằng SHA-256 kết hợp với pepper sinh từ SECRET_KEY.
    """
    if not raw_text:
        return ''
    pepper = (getattr(settings, 'SECRET_KEY', '') + ':core-pepper-v1').encode('utf-8')
    return hmac.new(pepper, raw_text.encode('utf-8'), hashlib.sha256).hexdigest()
