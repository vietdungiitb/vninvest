"""
SM-P2.1: CoreRouter — database routing for packages/core.

Routing rules:
  - All model writes go to 'default' (core DB).
  - Materializer tasks explicitly use 'legacy_readonly' connection — no routing needed.
  - Any attempt to write to 'legacy_readonly' raises RuntimeError (hard block).

HARD CONSTRAINT (AGENTS.md §8.1): Không ghi vào legacy DB từ core containers.
"""

# Apps that live in core DB
_CORE_APPS = frozenset({
    'identity_access',
    'market_serving',
    'signal_intelligence',
    'commercial',
    'service_ops',
    'tenant_lifecycle',
    'ops_audit',
    'data_ingest',
    'advisory',
    'user_workspace',
    'market_data',
    'auth',
    'contenttypes',
    'sessions',
    'admin',
    'token_blacklist',
    'django_celery_beat',
    'advertising',
    'ai_agents',
    'ai_analytics',
})


class CoreRouter:
    """
    Directs all core app models to the 'default' core database.
    Blocks any write operations against the 'legacy_readonly' database.
    """

    def db_for_read(self, model, **hints) -> str | None:
        if model._meta.app_label in _CORE_APPS:
            return 'default'
        return None

    def db_for_write(self, model, **hints) -> str | None:
        if model._meta.app_label in _CORE_APPS:
            return 'default'
        # Any other app tried to write: block
        raise RuntimeError(
            f"CoreRouter: write to '{model._meta.app_label}.{model.__name__}' rejected — "
            "core containers must not write to legacy DB. "
            "(SM-P2.1 / AGENTS.md §8.1)"
        )

    def allow_migrate(self, db, app_label, model_name=None, **hints) -> bool | None:
        if db == 'legacy_readonly':
            # Never migrate legacy DB from core containers
            return False
        if app_label in _CORE_APPS:
            return db == 'default'
        return None
