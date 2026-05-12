from __future__ import annotations

import os
import sys
from dataclasses import dataclass
from decimal import Decimal

from django.conf import settings
from django.contrib.auth.models import User
from django.db import transaction
from django.utils import timezone

# Setup path for packages/core imports
_core_backend_src = os.path.normpath(
    os.path.join(os.path.dirname(__file__), '../../packages/core/backend/src')
)
if os.path.exists(_core_backend_src) and _core_backend_src not in sys.path:
    sys.path.insert(0, _core_backend_src)

# Core models (AUTHORITY)
try:
    from user_workspace.models import Portfolio
except (ImportError, RuntimeError):
    class Portfolio:
        pass

# Legacy models (remaining)
from .models import SubAccount, UserConfig


STARTER_TEMPLATE_VERSION = 'v1'

STARTER_PORTFOLIO_TEMPLATES = (
    {
        'name': 'Tich luy dai han',
        'description': 'Danh muc mac dinh cho chien luoc nam giu dai han.',
    },
    {
        'name': 'Giao dich ngan han',
        'description': 'Danh muc mac dinh cho giao dich ngan han va toi uu diem vao/ra.',
    },
    {
        'name': 'Theo doi va thu nghiem',
        'description': 'Danh muc mac dinh de lam quen ung dung va thu nghiem chien luoc.',
    },
)

STARTER_SUBACCOUNT_TEMPLATES = (
    {
        'name': 'Tien mat',
        'type': SubAccount.TypeChoices.CASH,
        'margin_ratio': Decimal('1.000'),
    },
    {
        'name': 'Chuyen biet',
        'type': SubAccount.TypeChoices.SPECIAL,
        'margin_ratio': Decimal('1.000'),
    },
    {
        'name': 'Margin',
        'type': SubAccount.TypeChoices.MARGIN,
        'margin_ratio': Decimal('0.500'),
    },
)


@dataclass
class StarterProvisionResult:
    template_version: str
    reason: str
    created_portfolios: int
    created_subaccounts: int
    ensured_portfolios: int
    ensured_subaccounts: int

    @property
    def applied(self) -> bool:
        return self.created_portfolios > 0 or self.created_subaccounts > 0


@transaction.atomic
def provision_starter_portfolios_for_user(
    user: User,
    *,
    template_version: str = STARTER_TEMPLATE_VERSION,
    force: bool = False,
) -> StarterProvisionResult:
    if user is None or not getattr(user, 'pk', None):
        raise ValueError('user must be a persisted User instance')

    user_config, _ = UserConfig.objects.get_or_create(user=user)
    if user_config.starter_portfolios_seeded and not force:
        ensured_portfolios = Portfolio.objects.filter(
            user=user,
            name__in=[template['name'] for template in STARTER_PORTFOLIO_TEMPLATES],
        ).count()
        ensured_subaccounts = SubAccount.objects.filter(
            portfolio__user=user,
            portfolio__name__in=[template['name'] for template in STARTER_PORTFOLIO_TEMPLATES],
            name__in=[template['name'] for template in STARTER_SUBACCOUNT_TEMPLATES],
        ).count()
        return StarterProvisionResult(
            template_version=template_version,
            reason='already_seeded',
            created_portfolios=0,
            created_subaccounts=0,
            ensured_portfolios=ensured_portfolios,
            ensured_subaccounts=ensured_subaccounts,
        )

    created_portfolios = 0
    created_subaccounts = 0

    for portfolio_template in STARTER_PORTFOLIO_TEMPLATES:
        portfolio, portfolio_created = Portfolio.objects.get_or_create(
            user=user,
            name=portfolio_template['name'],
            defaults={'description': portfolio_template['description']},
        )
        if portfolio_created:
            created_portfolios += 1

        for subaccount_template in STARTER_SUBACCOUNT_TEMPLATES:
            _subaccount, subaccount_created = SubAccount.objects.get_or_create(
                portfolio=portfolio,
                name=subaccount_template['name'],
                defaults={
                    'type': subaccount_template['type'],
                    'margin_ratio': subaccount_template['margin_ratio'],
                },
            )
            if subaccount_created:
                created_subaccounts += 1

    ensured_portfolios = Portfolio.objects.filter(
        user=user,
        name__in=[template['name'] for template in STARTER_PORTFOLIO_TEMPLATES],
    ).count()
    ensured_subaccounts = SubAccount.objects.filter(
        portfolio__user=user,
        portfolio__name__in=[template['name'] for template in STARTER_PORTFOLIO_TEMPLATES],
        name__in=[template['name'] for template in STARTER_SUBACCOUNT_TEMPLATES],
    ).count()

    user_config.starter_portfolios_seeded = True
    user_config.starter_portfolios_seeded_at = timezone.now()
    user_config.starter_portfolios_template_version = template_version
    user_config.save(
        update_fields=[
            'starter_portfolios_seeded',
            'starter_portfolios_seeded_at',
            'starter_portfolios_template_version',
            'updated_at',
        ]
    )

    return StarterProvisionResult(
        template_version=template_version,
        reason='seeded',
        created_portfolios=created_portfolios,
        created_subaccounts=created_subaccounts,
        ensured_portfolios=ensured_portfolios,
        ensured_subaccounts=ensured_subaccounts,
    )


def should_provision_starter_portfolios_for_user(
    user: User,
    *,
    enabled: bool | None = None,
    canary_percent: int | None = None,
) -> bool:
    if not user or not getattr(user, 'pk', None):
        return False
    if user.is_superuser:
        return False

    is_enabled = settings.STARTER_PORTFOLIOS_ENABLED if enabled is None else bool(enabled)
    if not is_enabled:
        return False

    percent = settings.STARTER_PORTFOLIOS_CANARY_PERCENT if canary_percent is None else canary_percent
    try:
        percent = int(percent)
    except (TypeError, ValueError):
        percent = 0
    percent = max(0, min(100, percent))

    if percent >= 100:
        return True
    if percent <= 0:
        return False
    return (int(user.id) % 100) < percent
