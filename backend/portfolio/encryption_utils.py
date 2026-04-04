from __future__ import annotations

import base64
import hashlib
from cryptography.fernet import Fernet, InvalidToken
from django.conf import settings


def _build_fernet() -> Fernet:
    # Derive stable 32-byte key from SECRET_KEY; no extra env needed.
    secret = (getattr(settings, 'SECRET_KEY', '') + ':portfolio-ai-key').encode('utf-8')
    digest = hashlib.sha256(secret).digest()
    key = base64.urlsafe_b64encode(digest)
    return Fernet(key)


def encrypt_text(raw_text: str) -> str:
    if not raw_text:
        return ''
    token = _build_fernet().encrypt(raw_text.encode('utf-8'))
    return token.decode('utf-8')


def decrypt_text(cipher_text: str) -> str:
    if not cipher_text:
        return ''
    try:
        value = _build_fernet().decrypt(cipher_text.encode('utf-8'))
        return value.decode('utf-8')
    except (InvalidToken, ValueError, TypeError):
        return ''
