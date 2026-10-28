from .app_manifest import CORE_APP_MANIFEST, get_core_manifest

# Lazy import of celery_app to avoid circular import during settings loading
def __getattr__(name):
    if name == "celery_app":
        from .celery import app as celery_app
        return celery_app
    raise AttributeError(f"module '{__name__}' has no attribute '{name}'")

__all__ = ["CORE_APP_MANIFEST", "celery_app", "get_core_manifest"]