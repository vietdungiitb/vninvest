"""
License Service — ECDSA P-256 signing for vni1.* license blobs.

Extracted from scripts/issue-license.js logic. Used by LicenseKey model
and commercial views for minting/verifying license keys.
"""
import base64
import hashlib
import json
import time
from datetime import datetime, timezone

from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec


class LicenseService:
    """Mint and verify vni1.* signed license blobs."""

    def __init__(self, private_key_path: str):
        with open(private_key_path, "rb") as f:
            self._private_key = serialization.load_pem_private_key(
                f.read(), password=None
            )

    def mint(
        self,
        tier: str,
        domain: str,
        expires_at: datetime,
        capabilities: list[str] | None = None,
    ) -> str:
        """Mint a signed vni1.* license blob."""
        payload = {
            "tier": tier,
            "domain": domain,
            "exp": int(expires_at.timestamp()),
            "iat": int(timezone.now().timestamp()),
        }
        if capabilities:
            payload["caps"] = capabilities

        payload_b64 = base64.urlsafe_b64encode(
            json.dumps(payload).encode()
        ).rstrip(b"=").decode()

        signature = self._private_key.sign(
            payload_b64.encode(), ec.ECDSA(hashes.SHA256())
        )
        sig_b64 = base64.urlsafe_b64encode(signature).rstrip(b"=").decode()

        return f"vni1.{payload_b64}.{sig_b64}"

    @staticmethod
    def decode_payload(blob: str) -> dict | None:
        """Decode payload without verification (for display)."""
        parts = blob.split(".")
        if len(parts) != 3 or parts[0] != "vni1":
            return None
        try:
            padded = parts[1] + "=" * (4 - len(parts[1]) % 4)
            return json.loads(base64.urlsafe_b64decode(padded))
        except (ValueError, json.JSONDecodeError):
            return None

    @staticmethod
    def is_expired(blob: str) -> bool:
        payload = LicenseService.decode_payload(blob)
        if not payload or "exp" not in payload:
            return True
        return payload["exp"] < int(timezone.now().timestamp())