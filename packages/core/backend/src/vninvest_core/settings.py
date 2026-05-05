"""
VNInvest Core — Django settings.

Uses environment variables for all secrets/infrastructure.
Default DATABASE_URL uses SQLite for local testing convenience.
"""
import os

import dj_database_url
from django.core.exceptions import ImproperlyConfigured

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

_secret_key_default = 'dev-only-insecure-key-replace-in-production'
SECRET_KEY = os.environ.get('DJANGO_SECRET_KEY', _secret_key_default)
DEBUG = os.environ.get('DJANGO_DEBUG', 'false').strip().lower() in ('1', 'true', 'yes')

# SM-P1.3: ALLOWED_HOSTS — must be explicitly set in production (no wildcard default).
_allowed_hosts_raw = os.environ.get('DJANGO_ALLOWED_HOSTS', '*' if DEBUG else '').split(',')
ALLOWED_HOSTS = [h.strip() for h in _allowed_hosts_raw if h.strip()]

if not DEBUG:
    if not ALLOWED_HOSTS or ALLOWED_HOSTS == ['*']:
        raise ImproperlyConfigured(
            "DJANGO_ALLOWED_HOSTS must be set to an explicit non-wildcard value in production. "
            "Set DJANGO_ALLOWED_HOSTS env var (comma-separated)."
        )
    if SECRET_KEY == _secret_key_default:
        raise ImproperlyConfigured(
            "DJANGO_SECRET_KEY must be changed from the insecure default in production."
        )
    _pat_pepper = os.environ.get('CORE_PAT_PEPPER', '')
    if not _pat_pepper:
        raise ImproperlyConfigured(
            "CORE_PAT_PEPPER must be set in production for secure PAT hashing."
        )
    del _pat_pepper

INSTALLED_APPS = [
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'rest_framework',
    'corsheaders',
    'django_celery_beat',
    # SFI-B7: WebSocket support
    'channels',
    'identity_access',
    'market_serving',
    'signal_intelligence',
    'commercial',
    'ops_audit',
    'data_ingest',
    'advisory',
    'user_workspace',
    'market_data',
]

MIDDLEWARE = [
    'ops_audit.middleware.RequestTraceMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
]

ROOT_URLCONF = 'vninvest_core.urls'
WSGI_APPLICATION = 'vninvest_core.wsgi.application'

DATABASES = {
    'default': {
        **dj_database_url.config(
            default=os.environ.get(
                'CORE_DATABASE_URL',
                'sqlite:///' + os.path.join(BASE_DIR, 'core_dev.sqlite3'),
            )
        ),
        'CONN_MAX_AGE': int(os.environ.get('CORE_DB_CONN_MAX_AGE', '60')),
    },
}

# Legacy read-only connection for materializers (cutover period).
# Set LEGACY_DATABASE_URL in env; if absent, materializers run in degraded/skip mode.
_legacy_db_url = os.environ.get('LEGACY_DATABASE_URL', '')
if _legacy_db_url:
    DATABASES['legacy_readonly'] = {
        **dj_database_url.parse(_legacy_db_url),
        'CONN_MAX_AGE': int(os.environ.get('LEGACY_DB_CONN_MAX_AGE', '30')),
    }

# SM-P2.1: CoreRouter — routes core model writes to 'default'; blocks writes to legacy_readonly.
DATABASE_ROUTERS = ['vninvest_core.db_router.CoreRouter']

# SFI-B1.4: Legacy proxy target URL.
# In dev: defaults to internal backend service. Must be set explicitly in production.
LEGACY_BACKEND_URL = os.environ.get('LEGACY_BACKEND_URL', 'http://backend:8000')

# SFI-B2.1: Email backend — use SMTP in production, console fallback for dev/test.
EMAIL_BACKEND = os.environ.get(
    'EMAIL_BACKEND',
    'django.core.mail.backends.console.EmailBackend',
)
EMAIL_HOST = os.environ.get('EMAIL_HOST', 'mailpit')
EMAIL_PORT = int(os.environ.get('EMAIL_PORT', '1025'))
EMAIL_USE_TLS = os.environ.get('EMAIL_USE_TLS', 'false').lower() in ('1', 'true', 'yes')
EMAIL_HOST_USER = os.environ.get('EMAIL_HOST_USER', '')
EMAIL_HOST_PASSWORD = os.environ.get('EMAIL_HOST_PASSWORD', '')
DEFAULT_FROM_EMAIL = os.environ.get('DEFAULT_FROM_EMAIL', 'noreply@vninvest.local')

# SFI-B5: AI Advisory configuration — all credentials from env; never hardcoded.
OPENAI_API_KEY = os.environ.get('OPENAI_API_KEY', '')
OPENAI_DEFAULT_MODEL = os.environ.get('OPENAI_DEFAULT_MODEL', 'gpt-4o-mini')
ADVISORY_TOKEN_BUDGET = int(os.environ.get('ADVISORY_TOKEN_BUDGET', '2000'))

LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'Asia/Ho_Chi_Minh'
USE_I18N = False
USE_TZ = True

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

REST_FRAMEWORK = {
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.CursorPagination',
    'PAGE_SIZE': 50,
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'identity_access.authentication.CorePATAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
    ],
    'DEFAULT_RENDERER_CLASSES': [
        'rest_framework.renderers.JSONRenderer',
    ],
    'DEFAULT_VERSIONING_CLASS': 'rest_framework.versioning.NamespaceVersioning',
}

CORS_ALLOW_ALL_ORIGINS = False
# SM-P1.4: CORS_ALLOWED_ORIGINS must be explicit in production.
# In dev (DEBUG=True) with no env var, allow localhost origins for convenience.
_cors_origins_default = 'http://localhost:3000,http://127.0.0.1:3000' if DEBUG else ''
_cors_origins_raw = os.environ.get('CORS_ALLOWED_ORIGINS', _cors_origins_default)
CORS_ALLOWED_ORIGINS = [o.strip() for o in _cors_origins_raw.split(',') if o.strip()]

if not DEBUG and not CORS_ALLOWED_ORIGINS:
    raise ImproperlyConfigured(
        "CORS_ALLOWED_ORIGINS must be set in production. "
        "Set CORS_ALLOWED_ORIGINS env var (comma-separated origins)."
    )

REDIS_URL = os.environ.get('REDIS_URL', 'redis://localhost:6379/1')

# SM-P2.4: Django cache layer using Redis.
CACHES = {
    'default': {
        'BACKEND': 'django.core.cache.backends.redis.RedisCache',
        'LOCATION': REDIS_URL,
        'TIMEOUT': int(os.environ.get('CACHE_DEFAULT_TTL', '60')),
        'KEY_PREFIX': 'core',
    },
}

CELERY_BROKER_URL = REDIS_URL
CELERY_RESULT_BACKEND = REDIS_URL
CELERY_TASK_SERIALIZER = 'json'
CELERY_RESULT_SERIALIZER = 'json'
CELERY_ACCEPT_CONTENT = ['json']
CELERY_TIMEZONE = TIME_ZONE

# SM-P2.2: Beat schedule for materializer tasks.
from celery.schedules import crontab  # noqa: E402

CELERY_BEAT_SCHEDULE = {
    'materialize-symbol-snapshot-60s': {
        'task': 'market_serving.materializers.materialize_symbol_snapshot',
        'schedule': 60.0,  # every 60 seconds
    },
    'materialize-session-facts-5m': {
        'task': 'market_serving.materializers.materialize_session_facts',
        'schedule': 300.0,  # every 5 minutes
    },
    'materialize-unified-alerts-2m': {
        'task': 'market_serving.materializers.materialize_unified_alerts',
        'schedule': 120.0,  # every 2 minutes
    },
    # SM-P5.5: Daily DB backup at 02:00 AM Hanoi time
    'daily-db-backup-2am': {
        'task': 'ops_audit.tasks.daily_db_backup',
        'schedule': crontab(hour=2, minute=0),
    },
}

LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'handlers': {
        'console': {'class': 'logging.StreamHandler'},
    },
    'root': {
        'handlers': ['console'],
        'level': 'WARNING',
    },
}

# SM-P5.3: Sentry error tracking.
_sentry_dsn = os.environ.get('SENTRY_DSN', '')
if _sentry_dsn:
    import sentry_sdk  # noqa: E402
    from sentry_sdk.integrations.django import DjangoIntegration  # noqa: E402
    from sentry_sdk.integrations.celery import CeleryIntegration  # noqa: E402
    sentry_sdk.init(
        dsn=_sentry_dsn,
        integrations=[DjangoIntegration(), CeleryIntegration()],
        traces_sample_rate=float(os.environ.get('SENTRY_TRACES_SAMPLE_RATE', '0.1')),
        send_default_pii=False,
        environment=os.environ.get('CORE_ENV', 'development'),
    )

# SM-P5.2: Django-Prometheus — exposes /metrics/ endpoint.
INSTALLED_APPS.append('django_prometheus')
MIDDLEWARE.insert(0, 'django_prometheus.middleware.PrometheusBeforeMiddleware')
MIDDLEWARE.append('django_prometheus.middleware.PrometheusAfterMiddleware')
# SFI-B7: Django Channels — Redis channel layer for WebSocket.
_redis_url = os.environ.get('REDIS_URL', 'redis://redis:6379/0')
CHANNEL_LAYERS = {
    'default': {
        'BACKEND': 'channels_redis.core.RedisChannelLayer',
        'CONFIG': {
            'hosts': [_redis_url],
        },
    },
}
ASGI_APPLICATION = 'vninvest_core.asgi.application'