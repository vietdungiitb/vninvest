"""
Sức khỏe runtime + circuit breaker THEO TỪNG nhà cung cấp dữ liệu (VNBroker).

Vì sao cần module này
---------------------
Trước 2026-10-19, toàn bộ trạng thái provider chỉ tồn tại ở dạng *công thức*:

- `ServiceHealth` là OneToOne theo **service** (`vnbroker_quote`), không theo
  provider ⇒ không biết VCI/KBS/DNSE ai đang chết.
- Probe domain `vnbroker` chỉ kiểm tra `has_current_config`
  (`service_ops/tasks.py:120`) ⇒ `avg_response_ms` là độ trễ của *endpoint probe*,
  KHÔNG phải độ trễ gọi provider.
- `circuit_breaker_threshold` / `_window_seconds` / `_cooldown_seconds` trong
  `VnbrokerDomainConfig` **không có consumer nào** — chỉ được validate rồi bỏ.

⇒ Console VNBroker phải tự chế số liệu (`1000/avg_response_ms`, map
`status → error_rate`) và badge circuit breaker luôn hiện "CLOSED" (audit
Entry 384 §D1 F-04/F-05/F-06/F-11, và F-26: config SOC không có hiệu lực runtime).

Module này là tầng đo THẬT:
1. `get_soc_vnbroker_config()` — cầu nối config SOC (`ServiceConfig`) → runtime.
2. `record_provider_success/failure()` — ghi kết quả mỗi lần gọi provider.
3. `is_circuit_open()` — quyết định có bỏ qua provider hay không.
4. `probe_provider()` — gọi provider thật để đo độ trễ (nút "Thử nghiệm kết nối").
"""
from __future__ import annotations

import logging
import time
from typing import Any

from django.utils import timezone

logger = logging.getLogger(__name__)

# Ngưỡng mặc định khi config SOC chưa có (hoặc đọc lỗi) — PHẢI khớp
# `VnbrokerDomainConfig` để hai nguồn không lệch nhau.
DEFAULT_CIRCUIT_THRESHOLD = 5
DEFAULT_CIRCUIT_WINDOW_SECONDS = 60
DEFAULT_CIRCUIT_COOLDOWN_SECONDS = 300

# Ký hiệu provider trong DB dùng chữ thường (khớp `normalize_provider_id`).
_PROVIDER_LABELS = {'vci': 'VCI', 'kbs': 'KBS', 'dnse': 'DNSE'}


def _default_config() -> dict[str, Any]:
    return {
        'timeout': {'connect': 10.0, 'read': 30.0, 'write': 10.0, 'pool': 5.0},
        'max_retries': 3,
        'retry_delay_seconds': 2.0,
        'preferred_provider': 'vci',
        'fallback_providers': ['kbs', 'dnse'],
        'enabled': True,
        'circuit_breaker_threshold': DEFAULT_CIRCUIT_THRESHOLD,
        'circuit_breaker_window_seconds': DEFAULT_CIRCUIT_WINDOW_SECONDS,
        'circuit_breaker_cooldown_seconds': DEFAULT_CIRCUIT_COOLDOWN_SECONDS,
        'requests_per_minute': 60,
        'burst_limit': 10,
        'per_provider_config': {},
    }


def get_soc_vnbroker_config() -> dict[str, Any]:
    """
    Đọc config SOC đang áp dụng cho domain `vnbroker` — cầu nối để cấu hình mà
    operator sửa trong console CÓ hiệu lực thật với runtime (fix F-26).

    Nếu chưa có config nào (hoặc lỗi DB) ⇒ trả về mặc định, KHÔNG raise.
    """
    try:
        from service_ops.domain_configs.vnbroker import VnbrokerDomainConfig
        from service_ops.models import ServiceConfig
        from service_ops.registry import SOC_DOMAIN_PRIMARY_SERVICE_KEYS

        service_key = SOC_DOMAIN_PRIMARY_SERVICE_KEYS['vnbroker']
        current = ServiceConfig.objects.filter(
            service__service_key=service_key,
            is_current=True,
        ).first()
        if current is None:
            return VnbrokerDomainConfig().to_dict()
        return VnbrokerDomainConfig.from_dict(current.config_payload or {}).to_dict()
    except Exception as exc:  # noqa: BLE001 — runtime không được chết vì SOC config
        logger.warning('get_soc_vnbroker_config failed, dùng mặc định: %s', exc)
        return _default_config()


def _get_model():
    from .models import VnbrokerProviderHealth

    return VnbrokerProviderHealth


def _normalize(provider: str | None) -> str:
    return str(provider or '').strip().lower()


def get_provider_health(provider: str):
    """Trả về dòng health của provider (hoặc None nếu chưa có lần gọi nào)."""
    model = _get_model()
    return model.objects.filter(provider=_normalize(provider)).first()


def list_provider_health():
    """Trả về tất cả dòng health đã ghi (mới nhất trước)."""
    model = _get_model()
    return list(model.objects.all().order_by('provider'))


def _derive_status(consecutive_failures: int, circuit_state: str, total_requests: int) -> str:
    model = _get_model()
    choices = model.StatusChoices
    if circuit_state == model.CircuitStateChoices.OPEN:
        return choices.UNHEALTHY
    if consecutive_failures > 0:
        return choices.DEGRADED
    if total_requests > 0:
        return choices.HEALTHY
    return choices.UNKNOWN


def record_provider_success(provider: str, latency_ms: float | None = None) -> None:
    """Ghi 1 lần gọi provider THÀNH CÔNG."""
    model = _get_model()
    key = _normalize(provider)
    now = timezone.now()
    row = model.objects.filter(provider=key).first()
    if row is None:
        row = model(provider=key, label=_PROVIDER_LABELS.get(key, key.upper()))
    row.total_requests = row.total_requests + 1
    row.consecutive_failures = 0
    row.circuit_state = model.CircuitStateChoices.CLOSED
    row.circuit_opened_at = None
    row.last_success_at = now
    row.last_check_at = now
    row.last_error = ''
    if latency_ms is not None:
        row.latency_ms = round(float(latency_ms), 2)
    row.status = _derive_status(0, model.CircuitStateChoices.CLOSED, row.total_requests)
    row.save()


def record_provider_failure(
    provider: str,
    error: str = '',
    rate_limited: bool = False,
) -> None:
    """Ghi 1 lần gọi provider THẤT BẠI + cập nhật circuit breaker."""
    model = _get_model()
    key = _normalize(provider)
    now = timezone.now()
    config = get_soc_vnbroker_config()
    threshold = int(config.get('circuit_breaker_threshold') or DEFAULT_CIRCUIT_THRESHOLD)

    row = model.objects.filter(provider=key).first()
    if row is None:
        row = model(provider=key, label=_PROVIDER_LABELS.get(key, key.upper()))

    row.total_requests = row.total_requests + 1
    row.failed_requests = row.failed_requests + 1
    if rate_limited:
        row.rate_limited_requests = row.rate_limited_requests + 1
    row.consecutive_failures = row.consecutive_failures + 1
    row.last_check_at = now
    row.last_error = str(error or '')[:500]

    if row.consecutive_failures >= max(1, threshold):
        row.circuit_state = model.CircuitStateChoices.OPEN
        if row.circuit_opened_at is None:
            row.circuit_opened_at = now
    else:
        row.circuit_state = model.CircuitStateChoices.CLOSED

    row.status = _derive_status(row.consecutive_failures, row.circuit_state, row.total_requests)
    row.save()


def is_circuit_open(provider: str) -> bool:
    """
    Provider có đang bị NGẮT hay không.

    - `closed` → gọi bình thường.
    - `open` và chưa hết cooldown → **bỏ qua provider** (trả True).
    - `open` nhưng đã hết cooldown → chuyển `half_open` để thử lại 1 lần.
    """
    model = _get_model()
    row = get_provider_health(provider)
    if row is None:
        return False
    if row.circuit_state != model.CircuitStateChoices.OPEN:
        return False

    config = get_soc_vnbroker_config()
    cooldown = int(
        config.get('circuit_breaker_cooldown_seconds') or DEFAULT_CIRCUIT_COOLDOWN_SECONDS
    )
    opened_at = row.circuit_opened_at
    if opened_at is None:
        return True
    elapsed = (timezone.now() - opened_at).total_seconds()
    if elapsed >= max(1, cooldown):
        row.circuit_state = model.CircuitStateChoices.HALF_OPEN
        row.save(update_fields=['circuit_state', 'updated_at'])
        return False
    return True


def get_circuit_snapshot() -> dict[str, Any]:
    """
    Ảnh chụp circuit breaker cho console.

    Trả về đúng shape mà FE đọc:
    `{source, circuit_breaker: {status, failures, threshold, window_seconds, cooldown_seconds},
      per_provider: {provider: {status, failures}}}`
    """
    model = _get_model()
    config = get_soc_vnbroker_config()
    threshold = int(config.get('circuit_breaker_threshold') or DEFAULT_CIRCUIT_THRESHOLD)
    window = int(config.get('circuit_breaker_window_seconds') or DEFAULT_CIRCUIT_WINDOW_SECONDS)
    cooldown = int(
        config.get('circuit_breaker_cooldown_seconds') or DEFAULT_CIRCUIT_COOLDOWN_SECONDS
    )

    rows = list_provider_health()
    per_provider: dict[str, dict[str, Any]] = {}
    failures = 0
    open_providers: list[str] = []

    for row in rows:
        # Đồng bộ trạng thái mạch với thời gian thực (cooldown đã hết thì mở lại).
        if row.circuit_state == model.CircuitStateChoices.OPEN:
            opened_at = row.circuit_opened_at
            elapsed = (timezone.now() - opened_at).total_seconds() if opened_at else None
            if elapsed is None or elapsed >= max(1, cooldown):
                row.circuit_state = model.CircuitStateChoices.HALF_OPEN
                row.save(update_fields=['circuit_state', 'updated_at'])
        per_provider[row.provider] = {
            'status': row.circuit_state,
            'failures': row.consecutive_failures,
        }
        failures = max(failures, row.consecutive_failures)
        if row.circuit_state == model.CircuitStateChoices.OPEN:
            open_providers.append(row.provider)

    return {
        'source': 'runtime' if rows else 'unavailable',
        'circuit_breaker': {
            'status': 'open' if open_providers else 'closed',
            'failures': failures,
            'threshold': threshold,
            'window_seconds': window,
            'cooldown_seconds': cooldown,
        },
        'per_provider': per_provider,
        'open_providers': open_providers,
    }


def build_provider_health_payload() -> dict[str, Any]:
    """Payload cho `GET /operator/soc/vnbroker/provider-health/`."""
    rows = list_provider_health()
    providers = []
    for row in rows:
        total = row.total_requests
        success = max(0, total - row.failed_requests)
        providers.append({
            'provider': row.provider,
            'label': row.label or row.provider.upper(),
            'status': row.status,
            'latency_ms': row.latency_ms,
            'success_rate': round(success * 100.0 / total, 2) if total else None,
            'error_rate': round(row.failed_requests * 100.0 / total, 2) if total else None,
            'total_requests': total,
            'failed_requests': row.failed_requests,
            'rate_limited_requests': row.rate_limited_requests,
            'consecutive_failures': row.consecutive_failures,
            'last_success_at': row.last_success_at.isoformat() if row.last_success_at else None,
            'last_check_at': row.last_check_at.isoformat() if row.last_check_at else None,
            'last_error': row.last_error,
            'circuit_state': row.circuit_state,
        })
    return {
        'checked_at': timezone.now().isoformat(),
        'source': 'runtime' if rows else 'unavailable',
        'providers': providers,
    }


def probe_provider(provider: str, symbol: str = 'VNM') -> dict[str, Any]:
    """
    Gọi provider THẬT và đo độ trễ — nguồn cho nút "Thử nghiệm kết nối".

    Không raise: lỗi được ghi vào health row rồi trả về `status='error'`.
    """
    key = _normalize(provider)
    started = time.perf_counter()
    try:
        from .vnbroker_adapter import _fetch_realtime_price_with_quote_class, _load_quote_class

        quote_class = _load_quote_class(key)
        # `record_outcome=False` — probe tự ghi 1 lần duy nhất với tổng độ trễ
        # đo được (ghi ở cả hai nơi sẽ đếm đôi).
        payload = _fetch_realtime_price_with_quote_class(
            str(symbol or 'VNM').strip().upper(),
            key,
            quote_class,
            record_outcome=False,
        )
    except Exception as exc:  # noqa: BLE001 — probe không được làm sập endpoint
        latency_ms = round((time.perf_counter() - started) * 1000, 2)
        message = str(exc)[:500]
        record_provider_failure(key, message)
        return {
            'provider': key,
            'status': 'error',
            'latency_ms': latency_ms,
            'error': message,
        }

    latency_ms = round((time.perf_counter() - started) * 1000, 2)
    if not payload:
        record_provider_failure(key, 'Provider trả về rỗng.')
        return {
            'provider': key,
            'status': 'error',
            'latency_ms': latency_ms,
            'error': 'Provider trả về rỗng.',
        }
    record_provider_success(key, latency_ms)
    return {
        'provider': key,
        'status': 'ok',
        'latency_ms': latency_ms,
        'error': '',
    }
