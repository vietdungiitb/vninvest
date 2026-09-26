"""Django app configuration for vninvest_core."""
from django.apps import AppConfig


class VninvestCoreConfig(AppConfig):
    """Configuration for vninvest_core application."""

    default_auto_field = 'django.db.models.BigAutoField'
    name = 'vninvest_core'

    def ready(self):
        # Registers the production misconfiguration checks (empty trusted-proxy
        # list, missing Turnstile secret, unreachable onboarding path, unscheduled
        # token pruning). Imported for the @register side effect only.
        from . import checks  # noqa: F401
