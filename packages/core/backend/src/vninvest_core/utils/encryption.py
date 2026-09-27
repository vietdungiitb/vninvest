from __future__ import annotations

import os
import base64
import hashlib
import hmac
import json
import logging
from typing import Tuple
from cryptography.fernet import Fernet, InvalidToken
from django.conf import settings

logger = logging.getLogger(__name__)


class SecretStore:
    """
    SecretStore với versioning để rotate key không phá ciphertext cũ.
    
    Mỗi secret được lưu dưới dạng: {"v": version, "c": ciphertext}
    """
    
    def __init__(self):
        self._key_cache = {}
    
    def _get_key(self, version: int) -> Fernet:
        # v1 (legacy) can be cached - derived from SECRET_KEY
        # v2 (broker) should NOT be cached - depends on BROKER_SECRET_KEY env var
        if version == 1 and version in self._key_cache:
            return self._key_cache[version]
        
        if version == 1:
            secret = (getattr(settings, "SECRET_KEY", "") + ":core-workspace-key").encode("utf-8")
        elif version == 2:
            broker_key = os.environ.get("BROKER_SECRET_KEY")
            if not broker_key:
                raise ValueError("BROKER_SECRET_KEY not configured")
            secret = (broker_key + ":broker-workspace-key").encode("utf-8")
        else:
            raise ValueError(f"Unknown secret version: {version}")
        
        digest = hashlib.sha256(secret).digest()
        key = base64.urlsafe_b64encode(digest)
        fernet = Fernet(key)
        if version == 1:
            self._key_cache[version] = fernet
        return fernet
    
    def encrypt(self, plaintext: str, version: int = 2) -> str:
        if not plaintext:
            return ""
        fernet = self._get_key(version)
        token = fernet.encrypt(plaintext.encode("utf-8"))
        payload = {"v": version, "c": token.decode("utf-8")}
        return json.dumps(payload)
    
    def decrypt(self, cipher_text: str) -> Tuple[str, int]:
        if not cipher_text:
            return "", 0
        
        try:
            payload = json.loads(cipher_text)
        except json.JSONDecodeError:
            payload = {"v": 1, "c": cipher_text}
        
        version = payload.get("v", 1)
        ciphertext = payload.get("c", "")
        
        if not ciphertext:
            raise ValueError("Empty ciphertext")
        
        try:
            fernet = self._get_key(version)
            value = fernet.decrypt(ciphertext.encode("utf-8"))
            return value.decode("utf-8"), version
        except (InvalidToken, ValueError, TypeError) as e:
            logger.warning(f"Decrypt failed for version {version}: {e}")
            raise ValueError(f"Decryption failed for version {version}") from e
    
    def reencrypt(self, cipher_text: str, target_version: int = 2) -> str:
        plaintext, old_version = self.decrypt(cipher_text)
        if old_version == target_version:
            return cipher_text
        return self.encrypt(plaintext, target_version)


# Global instance
_secret_store = SecretStore()


def _build_fernet() -> "Fernet":
    from cryptography.fernet import Fernet
    secret = (getattr(settings, "SECRET_KEY", "") + ":core-workspace-key").encode("utf-8")
    digest = hashlib.sha256(secret).digest()
    key = base64.urlsafe_b64encode(digest)
    return Fernet(key)


def encrypt_string(raw_text: str) -> str:
    if not raw_text:
        return ""
    return _secret_store.encrypt(raw_text, version=1)


def decrypt_string(cipher_text: str) -> str:
    if not cipher_text:
        return ""
    try:
        value, _ = _secret_store.decrypt(cipher_text)
        return value
    except (ValueError, TypeError):
        return ""


def hash_with_pepper(raw_text: str) -> str:
    if not raw_text:
        return ""
    pepper = (getattr(settings, "SECRET_KEY", "") + ":core-pepper-v1").encode("utf-8")
    return hmac.new(pepper, raw_text.encode("utf-8"), hashlib.sha256).hexdigest()


# Global instance
_secret_store = SecretStore()

# Aliases for backward compatibility
_secret_store_v1 = _secret_store
encrypt_string_v1 = encrypt_string
decrypt_string_v1 = decrypt_string