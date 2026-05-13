"""
VNInvest Core — Django settings.

Uses environment variables for all secrets/infrastructure.
Default DATABASE_URL uses SQLite for local testing convenience.
"""
import os

import dj_database_url
from django.core.exceptions import ImproperlyConfigured

from .env_validation import validate_production_settings, get_frontend_url

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

# C4 Fix: Validate all required environment variables in production
validate_production_settings(DEBUG)

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'rest_framework',
    'corsheaders',
    'django_celery_beat',
    # SFI-B7: WebSocket support
    'channels',
    'vninvest_core.apps.VninvestCoreConfig',  # Project-level app for management commands
    'identity_access',
    'market_serving',
    'signal_intelligence',
    'commercial',
    'tenant_lifecycle',
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
    'identity_access.middleware.TenantQuotaMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
]

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

ROOT_URLCONF = 'vninvest_core.urls'
WSGI_APPLICATION = 'vninvest_core.wsgi.application'

# Trust the reverse proxy termination so Django sees the public HTTPS scheme
# and host when performing CSRF origin checks and secure redirects.
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
USE_X_FORWARDED_HOST = True

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

# Transitional admin bridge: core-api can delegate selected operator writes
# to the legacy backend so existing SSOT helpers stay authoritative.
LEGACY_BACKEND_URL = os.environ.get('LEGACY_BACKEND_URL', '').strip().rstrip('/')

# SM-P2.1: CoreRouter — routes core model writes to 'default'; blocks writes to legacy_readonly.
DATABASE_ROUTERS = ['vninvest_core.db_router.CoreRouter']

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

# C4 Fix: FRONTEND_URL — required in production, defaults to localhost:3000 in dev
FRONTEND_URL = get_frontend_url(DEBUG)

# SFI-B5: AI Advisory configuration — all credentials from env; never hardcoded.
OPENAI_API_KEY = os.environ.get('OPENAI_API_KEY', '')
OPENAI_DEFAULT_MODEL = os.environ.get('OPENAI_DEFAULT_MODEL', 'gpt-4o-mini')
ADVISORY_TOKEN_BUDGET = int(os.environ.get('ADVISORY_TOKEN_BUDGET', '2000'))

LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'Asia/Ho_Chi_Minh'
USE_I18N = False
USE_TZ = True

STATIC_URL = '/static/'
STATIC_ROOT = os.path.join(BASE_DIR, 'staticfiles')

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

REST_FRAMEWORK = {
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.CursorPagination',
    'PAGE_SIZE': 50,
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'identity_access.authentication.CorePATAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
        'identity_access.permissions.IsTenantActive',
    ],
    'DEFAULT_RENDERER_CLASSES': [
        'rest_framework.renderers.JSONRenderer',
    ],
    'DEFAULT_VERSIONING_CLASS': 'rest_framework.versioning.NamespaceVersioning',
    # A5 Fix: Custom exception handler for standard error envelopes (Constitution R4)
    'EXCEPTION_HANDLER': 'vninvest_core.exceptions.core_api_exception_handler',
}

CORS_ALLOW_ALL_ORIGINS = False
# SM-P1.4: CORS_ALLOWED_ORIGINS must be explicit in production.
# In dev (DEBUG=True) with no env var, allow localhost origins for convenience.
_cors_origins_default = (
    'http://localhost:3000,http://127.0.0.1:3000,'
    'http://localhost:80,http://127.0.0.1:80,'
    'http://localhost,http://127.0.0.1'
) if DEBUG else ''
_cors_origins_raw = os.environ.get('CORS_ALLOWED_ORIGINS', _cors_origins_default)
CORS_ALLOWED_ORIGINS = [o.strip() for o in _cors_origins_raw.split(',') if o.strip()]

if not DEBUG and not CORS_ALLOWED_ORIGINS:
    raise ImproperlyConfigured(
        "CORS_ALLOWED_ORIGINS must be set in production. "
        "Set CORS_ALLOWED_ORIGINS env var (comma-separated origins)."
    )

# CSRF origin checks must know the public host(s) in production, but local dev
# should work out of the box on localhost without extra env wiring.
_csrf_trusted_origins_default = (
    'http://localhost,http://127.0.0.1,'
    'http://localhost:80,http://127.0.0.1:80,'
    'http://localhost:3000,http://127.0.0.1:3000,'
    'http://localhost:3001,http://127.0.0.1:3001,'
    'http://localhost:8080,http://127.0.0.1:8080'
) if DEBUG else ''
_csrf_trusted_origins_raw = os.environ.get('CSRF_TRUSTED_ORIGINS', _csrf_trusted_origins_default)
CSRF_TRUSTED_ORIGINS = [o.strip() for o in _csrf_trusted_origins_raw.split(',') if o.strip()]

if not DEBUG and not CSRF_TRUSTED_ORIGINS:
    raise ImproperlyConfigured(
        "CSRF_TRUSTED_ORIGINS must be set in production. "
        "Set CSRF_TRUSTED_ORIGINS env var (comma-separated origins)."
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

# SM-P2.2: Beat schedule for materializer tasks + realtime data collection.
from celery.schedules import crontab  # noqa: E402

from vninvest_core.queue_policy import SCHEDULER_QUEUE_MAP, TASK_ROUTES

CELERY_TASK_ROUTES = TASK_ROUTES

CELERY_BEAT_SCHEDULE = {
    'flush-quota-counters': {
        'task': 'commercial.tasks.flush_quota_counters',
        'schedule': 60.0,
        'options': {'queue': SCHEDULER_QUEUE_MAP['flush-quota-counters']},
    },
    'generate-monthly-invoices': {
        'task': 'commercial.tasks.generate_monthly_invoices',
        'schedule': crontab(day_of_month='1', hour='0', minute='5'),
        'options': {'queue': SCHEDULER_QUEUE_MAP['generate-monthly-invoices']},
    },
    'check-overdue-invoices': {
        'task': 'commercial.tasks.check_overdue_invoices',
        'schedule': crontab(hour='8', minute='0'),
        'options': {'queue': SCHEDULER_QUEUE_MAP['check-overdue-invoices']},
    },
    'auto-expire-trials': {
        'task': 'tenant_lifecycle.tasks.auto_expire_trials',
        'schedule': crontab(hour='1', minute='0'),
        'options': {'queue': SCHEDULER_QUEUE_MAP['auto-expire-trials']},
    },
    'auto-suspend-quota-overflow': {
        'task': 'tenant_lifecycle.tasks.auto_suspend_quota_overflow',
        'schedule': 3600.0,
        'options': {'queue': SCHEDULER_QUEUE_MAP['auto-suspend-quota-overflow']},
    },
    'send-trial-expiry-warning': {
        'task': 'tenant_lifecycle.tasks.send_trial_expiry_warning',
        'schedule': crontab(hour='9', minute='0'),
        'options': {'queue': SCHEDULER_QUEUE_MAP['send-trial-expiry-warning']},
    },
    'auto-deprovision-stale': {
        'task': 'tenant_lifecycle.tasks.auto_deprovision_stale',
        'schedule': crontab(day_of_week='0', hour='2', minute='0'),
        'options': {'queue': SCHEDULER_QUEUE_MAP['auto-deprovision-stale']},
    },
    # === Materializer tasks (market_serving) ===
    'materialize-symbol-snapshot-60s': {
        'task': 'market_serving.materializers.materialize_symbol_snapshot',
        'schedule': 60.0,  # every 60 seconds
        'options': {'queue': SCHEDULER_QUEUE_MAP['materialize-symbol-snapshot-60s']},
    },
    'materialize-pre-open-snapshots-20m': {
        'task': 'market_serving.materializers.materialize_pre_open_snapshots',
        'schedule': crontab(hour=8, minute=40, day_of_week='1-5'),  # 08:40 ICT = pre-open -20m
        'options': {'queue': SCHEDULER_QUEUE_MAP['materialize-pre-open-snapshots-20m']},
    },
    'materialize-session-facts-5m': {
        'task': 'market_serving.materializers.materialize_session_facts',
        'schedule': 300.0,  # every 5 minutes
        'options': {'queue': SCHEDULER_QUEUE_MAP['materialize-session-facts-5m']},
    },
    'materialize-unified-alerts-2m': {
        'task': 'market_serving.materializers.materialize_unified_alerts',
        'schedule': 120.0,  # every 2 minutes
        'options': {'queue': SCHEDULER_QUEUE_MAP['materialize-unified-alerts-2m']},
    },
    
    # === Ops/Admin tasks ===
    # SM-P5.5: Daily DB backup at 02:00 AM Hanoi time
    'daily-db-backup-2am': {
        'task': 'ops_audit.tasks.daily_db_backup',
        'schedule': crontab(hour=2, minute=0),
    },

    # === C1: Native ingest — price board every 60s ===
    # Replaces legacy-worker as sole SymbolSnapshot update source.
    'ingest-price-board-60s': {
        'task': 'data_ingest.tasks.fetch_and_upsert_price_board',
        'schedule': 60.0,
        'options': {'queue': SCHEDULER_QUEUE_MAP.get('ingest-price-board-60s', 'realtime_prefetch')},
    },

    # === Daily OHLCV backfill — after HOSE close (17:00 ICT = UTC+7) ===
    # Upserts 365 days of daily candles for all tracked symbols via VCI+KBS parallel.
    'daily-backfill-prices-1700': {
        'task': 'data_ingest.tasks.backfill_daily_prices',
        'schedule': crontab(hour=10, minute=5),  # 17:05 ICT (UTC+7) = 10:05 UTC
        'kwargs': {'days': 365},
        'options': {'queue': SCHEDULER_QUEUE_MAP.get('daily-backfill-prices-1700', 'enrichment_offhours')},
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