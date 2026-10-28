"""R2.6 - chọn deployment cho 1 request + decision log.

Ba chiến lược (`latency` / `cost` / `weighted`), **deterministic**: cùng đầu vào +
cùng seed ⇒ cùng kết quả, và hoà thì búng tên (AC4). Không có chiến lược nào được
chọn trong im lặng — chiến lược lạ ⇒ `ValueError`.

"Không có deployment nào khoẻ" ⇒ `NoHealthyDeploymentError` với
`error_code='no_healthy_deployment'` (AC6) — **không** im lặng rơi về provider hỏng.

`AI_ROUTING_DISABLED=True` ⇒ bỏ toàn bộ router, trả về đúng 1 deployment như hành
vi trước R2.6, kể cả deployment `unhealthy` (AC7): bộ lọc sức khoẻ chính là thứ
gây false-positive khi provider đang deploy nên muốn tắt thì phải tắt trọn vẹn.
"""

from __future__ import annotations

import logging
import random
from typing import Optional
from collections.abc import Iterable

from django.conf import settings as django_settings

from advisory.models import AIDeployment

logger = logging.getLogger(__name__)

STRATEGY_LATENCY = 'latency'
STRATEGY_COST = 'cost'
STRATEGY_WEIGHTED = 'weighted'
ROUTING_STRATEGIES = (STRATEGY_LATENCY, STRATEGY_COST, STRATEGY_WEIGHTED)

STRATEGY_DISABLED = 'disabled'
STRATEGY_DEFAULT = STRATEGY_LATENCY
WEIGHTED_SEED = 7          # cố định ⇒ AC4 deterministic
ERROR_NO_HEALTHY_DEPLOYMENT = 'no_healthy_deployment'


class NoHealthyDeploymentError(RuntimeError):
    """Không deployment nào dùng được — 503 với `error_code` riêng (AC6)."""

    error_code = ERROR_NO_HEALTHY_DEPLOYMENT
    status_code = 503

    def __init__(self, detail: str = ''):
        self.user_message = detail or (
            'Không có tuyến AI nào đang hoạt động. Hãy thử lại sau hoặc liên hệ quản trị.'
        )
        super().__init__(f'{self.error_code}: {self.user_message}')


def routing_disabled() -> bool:
    """Cờ tắt router. Mặc định bật router (chỉ khi có > 1 deployment mới thấy khác biệt)."""
    return bool(getattr(django_settings, 'AI_ROUTING_DISABLED', False))


def default_strategy() -> str:
    configured = str(getattr(django_settings, 'AI_ROUTING_STRATEGY', STRATEGY_DEFAULT)).strip().lower()
    if configured not in ROUTING_STRATEGIES:
        logger.warning(
            'AI_ROUTING_STRATEGY=%s không hợp lệ (%s) ⇒ dùng %s',
            configured, list(ROUTING_STRATEGIES), STRATEGY_DEFAULT,
        )
        return STRATEGY_DEFAULT
    return configured


def candidates(deployments: Iterable[AIDeployment], *, disabled: bool = False) -> list:
    """Ứng viên hợp lệ. Tắt router ⇒ giữ nguyên danh sách (hành vi cũ)."""
    rows = list(deployments)
    if disabled:
        return rows
    return [
        row for row in rows
        if row.enabled and row.health_state != AIDeployment.HealthChoices.UNHEALTHY
    ]


def _latency_of(row: AIDeployment) -> float:
    # Chưa có số đo ⇒ coi như vô hạn để không "thắng" do thiếu dữ liệu.
    value = row.latency_ms or 0
    return float(value) if value > 0 else float('inf')


def _cost_of(row: AIDeployment) -> float:
    # cost chưa biết (0/null) ⇒ đẩy xuống cuối, không giả định là miễn phí.
    value = row.cost_per_1k
    if value is None:
        return float('inf')
    value = float(value)
    return value if value > 0 else float('inf')


def choose_deployment(
    deployments: Iterable[AIDeployment], *, strategy: str = STRATEGY_DEFAULT, seed: int = WEIGHTED_SEED,
) -> Optional[AIDeployment]:
    """Chọn 1 deployment. Trả `None` nếu không có ứng viên nào (không âm thầm rơi về provider hỏng)."""
    rows = candidates(deployments, disabled=routing_disabled())
    if not rows:
        return None

    if strategy == STRATEGY_LATENCY:
        return min(rows, key=lambda r: (_latency_of(r), r.name))
    if strategy == STRATEGY_COST:
        return min(rows, key=lambda r: (_cost_of(r), r.name))
    if strategy == STRATEGY_WEIGHTED:
        rng = random.Random(f'{seed}:{len(rows)}')
        weighted = [(r, max(int(r.weight or 0), 0)) for r in rows]
        pool = [r for r, w in weighted if w > 0]
        if not pool:
            return min(rows, key=lambda r: r.name)
        picked = rng.choices(pool, weights=[w for r, w in weighted if w > 0], k=1)[0]
        return picked
    raise ValueError(
        f'Chiến lược routing lạ: {strategy!r}. Hợp lệ: {list(ROUTING_STRATEGIES)}.'
    )


def _describe(row: AIDeployment) -> dict:
    return {
        'name': row.name,
        'provider': row.provider,
        'model': row.model,
        'latency_ms': int(row.latency_ms or 0),
        'cost_per_1k': str(row.cost_per_1k or '0'),
        'weight': int(row.weight or 0),
        'health_state': row.health_state,
        'enabled': bool(row.enabled),
    }


def routing_decision(
    deployments: Iterable[AIDeployment], *, strategy: str = STRATEGY_DEFAULT,
) -> dict:
    """Quyết định routing + log để ghi vào trace (AC5).

    Trả `{strategy, candidates, chosen, reason}`. Không có ứng viên ⇒ raise
    `NoHealthyDeploymentError` (AC6).
    """
    rows = list(deployments)
    disabled = routing_disabled()
    pool = candidates(rows, disabled=disabled)
    if not pool:
        raise NoHealthyDeploymentError(
            'Không có deployment AI nào bật và khoẻ để chọn.'
            if not disabled else 'Chưa cấu hình deployment AI nào.'
        )
    effective = STRATEGY_DISABLED if disabled else strategy
    chosen = choose_deployment(rows, strategy=strategy)
    if strategy == STRATEGY_LATENCY:
        reason = (
            f'chọn theo latency thấp nhất ({int(chosen.latency_ms or 0)}ms) '
            f'trong {len(pool)} ứng viên khoẻ'
        )
    elif strategy == STRATEGY_COST:
        reason = (
            f'chọn theo chi phí thấp nhất ({chosen.cost_per_1k}/1k token) '
            f'trong {len(pool)} ứng viên khoẻ'
        )
    elif strategy == STRATEGY_WEIGHTED:
        reason = (
            f'chọn theo trọng số (weight={int(chosen.weight or 0)}, seed cố định) '
            f'trong {len(pool)} ứng viên khoẻ'
        )
    else:
        reason = f'chiến lược không hợp lệ {strategy!r}'
    if disabled:
        reason = f'router đang TẮT (AI_ROUTING_DISABLED) ⇒ dùng deployment duy nhất; {reason}'
    return {
        'strategy': effective,
        'candidates': [_describe(r) for r in pool],
        'chosen': chosen.name,
        'reason': reason,
        'chosen_deployment_id': chosen.pk,
    }