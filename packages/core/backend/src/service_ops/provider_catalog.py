"""Canonical provider catalog for SOC operator surfaces."""

from __future__ import annotations

import os
from typing import Iterable


PROVIDER_CATALOG = (
    {
        'id': 'vci',
        'label': 'VCI',
        'surfaces': frozenset({'matrix', 'vnbroker'}),
        'credential_mode': 'builtin',
        'required_runtime_envs': (),
        'default_selected': True,
    },
    {
        'id': 'kbs',
        'label': 'KBS',
        'surfaces': frozenset({'matrix', 'vnbroker'}),
        'credential_mode': 'builtin',
        'required_runtime_envs': (),
        'default_selected': True,
    },
    {
        'id': 'dnse',
        'label': 'DNSE',
        'surfaces': frozenset({'matrix', 'vnbroker'}),
        'credential_mode': 'api-key',
        'required_runtime_envs': (
            'SOC_MATRIX_DNSE_API_ID',
            'SOC_MATRIX_DNSE_API_KEY',
        ),
        'default_selected': True,
    },
)

PROVIDERS_BY_ID = {provider['id']: provider for provider in PROVIDER_CATALOG}


def normalize_provider_id(provider_id: str | None) -> str:
    return str(provider_id or '').strip().lower()


def get_supported_provider_ids(surface: str | None = None) -> tuple[str, ...]:
    if not surface:
        return tuple(provider['id'] for provider in PROVIDER_CATALOG)
    return tuple(
        provider['id']
        for provider in PROVIDER_CATALOG
        if surface in provider['surfaces']
    )


def get_default_provider_ids(surface: str | None = None) -> tuple[str, ...]:
    return tuple(
        provider['id']
        for provider in PROVIDER_CATALOG
        if provider.get('default_selected', False)
        and (surface is None or surface in provider['surfaces'])
    )


def find_unsupported_provider_ids(
    provider_ids: Iterable[str] | None,
    surface: str | None = None,
) -> list[str]:
    if not provider_ids:
        return []

    supported = set(get_supported_provider_ids(surface))
    unsupported = []
    for provider_id in provider_ids:
        normalized = normalize_provider_id(provider_id)
        if normalized and normalized not in supported and normalized not in unsupported:
            unsupported.append(normalized)
    return unsupported


def normalize_provider_ids(
    provider_ids: Iterable[str] | None,
    surface: str | None = None,
) -> list[str]:
    supported = set(get_supported_provider_ids(surface))
    normalized = []
    source = provider_ids or get_default_provider_ids(surface)
    for provider_id in source:
        normalized_id = normalize_provider_id(provider_id)
        if normalized_id and normalized_id in supported and normalized_id not in normalized:
            normalized.append(normalized_id)
    return normalized


def get_missing_runtime_envs(provider_id: str) -> list[str]:
    provider = PROVIDERS_BY_ID[provider_id]
    return [
        env_name
        for env_name in provider['required_runtime_envs']
        if not str(os.getenv(env_name, '') or '').strip()
    ]


def build_provider_status(
    provider_id: str,
    *,
    surface: str | None = None,
    active_provider_ids: Iterable[str] | None = None,
) -> dict:
    normalized_id = normalize_provider_id(provider_id)
    provider = PROVIDERS_BY_ID[normalized_id]
    missing_envs = get_missing_runtime_envs(normalized_id)
    runtime_ready = len(missing_envs) == 0
    active_ids = set(normalize_provider_ids(active_provider_ids))

    readiness_reason = 'Provider sẵn sàng cho runtime hiện tại.'
    if missing_envs:
        readiness_reason = (
            f"Thiếu runtime secret: {', '.join(missing_envs)}. "
            "DNSE chỉ dùng được sau khi cấp API ID/KEY ở môi trường chạy."
        )

    return {
        'provider': normalized_id,
        'label': provider['label'],
        'enabled': surface is None or surface in provider['surfaces'],
        'in_active_cycle': normalized_id in active_ids,
        'runtime_ready': runtime_ready,
        'credential_mode': provider['credential_mode'],
        'requires_runtime_credentials': bool(provider['required_runtime_envs']),
        'required_runtime_envs': list(provider['required_runtime_envs']),
        'runtime_gate': 'ready' if runtime_ready else 'missing_credentials',
        'readiness_reason': readiness_reason,
        'default_selected': bool(provider.get('default_selected', False) and runtime_ready),
        'supports_matrix': 'matrix' in provider['surfaces'],
        'supports_vnbroker': 'vnbroker' in provider['surfaces'],
    }


def list_provider_statuses(
    surface: str,
    *,
    active_provider_ids: Iterable[str] | None = None,
) -> list[dict]:
    return [
        build_provider_status(
            provider_id,
            surface=surface,
            active_provider_ids=active_provider_ids,
        )
        for provider_id in get_supported_provider_ids(surface)
    ]


def get_unready_provider_messages(provider_ids: Iterable[str] | None) -> list[str]:
    messages = []
    for provider_id in normalize_provider_ids(provider_ids):
        missing_envs = get_missing_runtime_envs(provider_id)
        if missing_envs:
            messages.append(
                f"Provider '{provider_id}' chưa sẵn sàng: thiếu {', '.join(missing_envs)}."
            )
    return messages