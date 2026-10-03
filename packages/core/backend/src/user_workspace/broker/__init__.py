"""B1.1: user_workspace.broker — substrate cấu hình đa-broker (dnse/ssi/tcbs)."""
from . import dnse, ssi, tcbs
from .base import (
    PREVIEW_VISIBLE_CHARS,
    PROVIDER_SECRET_KEYS,
    mask_secrets_preview,
    mask_value,
)

SCHEMAS = {
    'dnse': dnse,
    'ssi': ssi,
    'tcbs': tcbs,
}

__all__ = [
    'PREVIEW_VISIBLE_CHARS',
    'PROVIDER_SECRET_KEYS',
    'SCHEMAS',
    'dnse',
    'ssi',
    'tcbs',
    'mask_secrets_preview',
    'mask_value',
]
