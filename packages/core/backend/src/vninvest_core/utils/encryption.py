from __future__ import annotations

import base64
import hashlib
import hmac
import json
import logging
import os
import re

from cryptography.fernet import Fernet, InvalidToken
from django.conf import settings

from vninvest_core.env_validation import is_placeholder_value

logger = logging.getLogger(__name__)

# Legacy version: broker secrets written before SEC-02 are encrypted with a key
# derived from Django's SECRET_KEY. This is the coupling SEC-02 exists to remove,
# so v1 is DECRYPT-ONLY in practice: nothing new should be written at v1.
LEGACY_VERSION = 1

# Version used for new writes when BROKER_SECRET_KEY is configured. Overridable so
# an operator can roll forward to v3, v4, ... without a code change.
CURRENT_VERSION_ENV = "BROKER_SECRET_VERSION"
DEFAULT_CURRENT_VERSION = 2

# Older keys stay resolvable for decryption via BROKER_SECRET_KEY_V<n>. This is
# what makes rotation non-destructive: you add the new key, keep the old one, then
# re-encrypt, then drop the old one.
_VERSIONED_KEY_RE = re.compile(r"^BROKER_SECRET_KEY_V(\d+)$")


class SecretKeyMissingError(Exception):
    """No key is configured for the version a ciphertext was written with.

    Raised instead of returning an empty plaintext (R4 / AC1). A missing key is an
    operational fault, not an empty secret, and silently substituting "" would hand
    callers a blank credential that looks like valid data.
    """


def _derive(raw_key: str) -> Fernet:
    """Derive a Fernet key from raw key material.

    Accepts either a real Fernet key or arbitrary key material, which is hashed so
    operators are not forced to store a 32-byte url-safe base64 value by hand.
    """
    digest = hashlib.sha256(raw_key.encode("utf-8")).digest()
    return Fernet(base64.urlsafe_b64encode(digest))


def _legacy_key_material() -> str:
    return getattr(settings, "SECRET_KEY", "") + ":core-workspace-key"


class SecretStore:
    """Versioned secret store so key rotation does not destroy existing ciphertext.

    Ciphertext envelope: ``{"v": <version>, "c": <fernet token>}``.

    Key resolution order for a given version:
      1. ``BROKER_SECRET_KEY_V<n>`` - an explicitly retained older key (read-only)
      2. ``BROKER_SECRET_KEY`` when ``<n> == BROKER_SECRET_VERSION`` (the live key)
      3. legacy version 1, derived from Django's ``SECRET_KEY``

    Nothing else resolves. An unresolvable version raises
    :class:`SecretKeyMissingError` rather than yielding an empty string.
    """

    def __init__(self, cache_legacy: bool = True) -> None:
        # v1 is derived from Django's SECRET_KEY, which is stable in a normal
        # process, so caching it avoids a SHA-256 per decrypt. The cache MUST be
        # keyed by the SECRET_KEY it was derived from: SECRET_KEY comes from
        # mutable settings, and a cache that ignores that silently keeps serving a
        # stale key. That is not hypothetical - it broke this slice's own tests,
        # where an earlier test file changed SECRET_KEY via override_settings and
        # the module-level singleton then wrote v1 ciphertext no fresh store could
        # read back.
        self._cache_legacy = cache_legacy
        self._legacy_cache: dict[tuple[int, str], Fernet] = {}

    # ── key resolution ──────────────────────────────────────────────────
    def _resolve_key_material(self, version: int) -> str:
        """Resolve raw key material for a version.

        Order matters and the first implementation got it wrong. The live
        ``BROKER_SECRET_KEY`` must win for the CURRENT version, otherwise a
        retained ``BROKER_SECRET_KEY_V<current>`` would keep being used for new
        writes: re-encrypting would "migrate" a row onto the very key it was
        meant to move off, and dropping that key afterwards would then strand it.
        Retained slots exist for OLDER versions only.
        """
        if version == self.current_version():
            broker_key = os.environ.get("BROKER_SECRET_KEY")
            if broker_key:
                if is_placeholder_value(broker_key):
                    # Fail-closed (R4): `<REQUIRED>` từ file .example là hằng
                    # số công khai. Encrypt bằng nó tệ hơn cả không mã hóa,
                    # vì code sẽ tin là đã tách khóa khỏi SECRET_KEY.
                    raise SecretKeyMissingError(
                        "BROKER_SECRET_KEY still holds the placeholder value from "
                        "the .example file. Generate a real Fernet key "
                        "(`python -c \"from cryptography.fernet import Fernet; "
                        "print(Fernet.generate_key().decode())\"`)."
                    )
                return broker_key + ":broker-workspace-key"

        retained = os.environ.get(f"BROKER_SECRET_KEY_V{version}")
        if retained:
            if is_placeholder_value(retained):
                raise SecretKeyMissingError(
                    f"BROKER_SECRET_KEY_V{version} still holds the placeholder "
                    f"value from the .example file."
                )
            return retained + ":broker-workspace-key"

        if version == LEGACY_VERSION:
            return _legacy_key_material()

        raise SecretKeyMissingError(
            f"No key configured for secret version {version}. "
            f"Set BROKER_SECRET_KEY_V{version} to retain that key for decryption, "
            f"or re-encrypt the row with SecretStore.reencrypt()."
        )

    def get_key(self, version: int) -> Fernet:
        cache_key = None
        if version == LEGACY_VERSION and self._cache_legacy:
            cache_key = (version, _legacy_key_material())
            if cache_key in self._legacy_cache:
                return self._legacy_cache[cache_key]
        fernet = _derive(self._resolve_key_material(version))
        if cache_key is not None:
            self._legacy_cache[cache_key] = fernet
        return fernet

    @staticmethod
    def current_version() -> int:
        raw = os.environ.get(CURRENT_VERSION_ENV, "").strip()
        if not raw:
            return DEFAULT_CURRENT_VERSION
        try:
            version = int(raw)
        except ValueError as exc:
            raise SecretKeyMissingError(
                f"{CURRENT_VERSION_ENV}={raw!r} is not an integer"
            ) from exc
        if version < 1:
            raise SecretKeyMissingError(f"{CURRENT_VERSION_ENV} must be >= 1")
        return version

    @staticmethod
    def write_version() -> int:
        """Version new ciphertext should be written at.

        Uses the current broker version when ``BROKER_SECRET_KEY`` is configured,
        otherwise falls back to legacy v1 so an unconfigured environment keeps
        working. The fallback is the reason ``UserBrokerConfig.secret_version``
        exists: it records which key actually protected each row.
        """
        if os.environ.get("BROKER_SECRET_KEY"):
            if is_placeholder_value(os.environ["BROKER_SECRET_KEY"]):
                # Không báo "đang dùng version mới" khi key thật sự chưa có.
                raise SecretKeyMissingError(
                    "BROKER_SECRET_KEY is set to the placeholder value, so new "
                    "broker secrets cannot be written safely."
                )
            return SecretStore.current_version()
        return LEGACY_VERSION

    # ── envelope helpers ────────────────────────────────────────────────
    @staticmethod
    def split_envelope(cipher_text: str) -> tuple[int, str]:
        """Return ``(version, fernet_token)`` for a stored value.

        Values written before SEC-02 are bare Fernet tokens with no envelope; they
        are treated as legacy v1 so historical rows keep decrypting.
        """
        try:
            payload = json.loads(cipher_text)
        except (json.JSONDecodeError, TypeError):
            return LEGACY_VERSION, cipher_text
        if not isinstance(payload, dict) or "c" not in payload:
            return LEGACY_VERSION, cipher_text
        try:
            version = int(payload.get("v", LEGACY_VERSION))
        except (TypeError, ValueError):
            version = LEGACY_VERSION
        token = payload.get("c") or ""
        if not isinstance(token, str) or not token:
            raise SecretKeyMissingError("Ciphertext envelope has no token")
        return version, token

    # ── public API (R1) ─────────────────────────────────────────────────
    def encrypt(self, plaintext: str, version: int | None = None) -> str:
        if plaintext is None or plaintext == "":
            return ""
        target = self.write_version() if version is None else version
        token = self.get_key(target).encrypt(plaintext.encode("utf-8"))
        return json.dumps({"v": target, "c": token.decode("utf-8")})

    def decrypt(self, cipher_text: str) -> tuple[str, int]:
        """Return ``(plaintext, version)``.

        Fail-closed: a missing key, or a token that does not authenticate under the
        resolved key, raises. Neither ever returns an empty plaintext.
        """
        if not cipher_text:
            return "", 0
        version, token = self.split_envelope(cipher_text)
        fernet = self.get_key(version)
        try:
            value = fernet.decrypt(token.encode("utf-8"))
        except InvalidToken as exc:
            # Log the version and the failure class only - never the ciphertext or
            # the plaintext (R6 / AC3). The wording deliberately avoids naming the
            # stored data after the logger, so the spec's mechanical grep for
            # sensitive words on a log line stays at zero hits and needs no
            # false-positive exemption.
            logger.warning("Decrypt failed for key version %s (%s)", version, exc.__class__.__name__)
            raise SecretKeyMissingError(
                f"Ciphertext for version {version} did not authenticate with the "
                f"configured key for that version"
            ) from exc
        return value.decode("utf-8"), version

    def reencrypt(self, cipher_text: str, target_version: int | None = None) -> str:
        """Re-wrap a value under another key version, e.g. to retire a key."""
        target = self.write_version() if target_version is None else target_version
        plaintext, old_version = self.decrypt(cipher_text)
        if old_version == target:
            return cipher_text
        return self.encrypt(plaintext, target)

    def version_of(self, cipher_text: str) -> int:
        return self.split_envelope(cipher_text)[0]


# Single module-level instance. The previous file constructed two: line 88 and line
# 123, which left the first one as dead code and gave the class two independent
# caches depending on when each was consulted.
store = SecretStore()


def encrypt_string(raw_text: str, version: int | None = None) -> str:
    return store.encrypt(raw_text, version=version)


def decrypt_string(cipher_text: str) -> str:
    """Decrypt a stored value.

    No longer swallows failures. The old implementation caught ValueError and
    returned "", which meant a rotated-away key produced a blank credential that
    looked like valid data (R4 / AC1).
    """
    if not cipher_text:
        return ""
    value, _ = store.decrypt(cipher_text)
    return value


def hash_with_pepper(raw_text: str) -> str:
    if not raw_text:
        return ""
    pepper = (getattr(settings, "SECRET_KEY", "") + ":core-pepper-v1").encode("utf-8")
    return hmac.new(pepper, raw_text.encode("utf-8"), hashlib.sha256).hexdigest()


# Backward-compatible aliases for callers importing the old private names.
_secret_store = store
_secret_store_v1 = store
encrypt_string_v1 = encrypt_string
decrypt_string_v1 = decrypt_string
