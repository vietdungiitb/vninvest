import os

from django.conf import settings
from django.core.management.base import CommandError


def runtime_environment_name() -> str:
    if not settings.DEBUG:
        return 'production'
    return 'development'


def is_demo_seed_allowed_by_env() -> bool:
    return str(os.getenv('ALLOW_DEMO_SEED', 'false')).strip().lower() == 'true'


def assert_demo_seed_allowed(*, command_name: str, allow_production_flag: bool = False) -> None:
    if settings.DEBUG:
        return
    if allow_production_flag:
        return
    if is_demo_seed_allowed_by_env():
        return

    raise CommandError(
        f"Blocked demo seed command '{command_name}' on production-like environment. "
        "Set ALLOW_DEMO_SEED=true or pass --allow-production if you intentionally execute this command."
    )
