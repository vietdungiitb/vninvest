"""
VNInvest Core — Django settings.

Uses environment variables for all secrets/infrastructure.
Default DATABASE_URL uses SQLite for local testing convenience.
"""
import os
import sys

TESTING = 'test' in sys.argv or any('test' in arg for arg in sys.argv)

import dj_database_url
from django.core.exceptions import ImproperlyConfigured

from .env_validation import validate_production_settings, get_frontend_url, prod_cookie_security_settings

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

# BL-02: Password strength — Django validators, always on (incl. dev).
AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator', 'OPTIONS': {'min_length': 10}},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

# C4 Fix: Validate all required environment variables in production
validate_production_settings(DEBUG)

# BL-02: Session/cookie/transport security — secure-by-default in prod,
# explicit insecure values rejected (fail-closed). Dev keeps Django defaults.
if not DEBUG:
    globals().update(prod_cookie_security_settings())
else:
    SESSION_COOKIE_AGE = int(os.environ.get('DJANGO_SESSION_COOKIE_AGE', '1209600') or '1209600')

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'rest_framework',
    'drf_spectacular',
    'drf_spectacular_sidecar',
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
    'service_ops',
    'support',
    'advertising',
    'ai_agents',
    'ai_analytics',
]

MIDDLEWARE = [
    'ops_audit.middleware.RequestTraceMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'identity_access.middleware.TenantResolutionMiddleware',
    'identity_access.middleware.TenantQuotaMiddleware',
    'identity_access.middleware.RateLimitHeadersMiddleware',
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

# SFI-B1.4: Legacy backend URL — core-api transparent proxy forwards unmatched /api/* here.
# Single source of truth (BL-08: merged duplicate assignment); may be empty (proxy then 502s).
LEGACY_BACKEND_URL = os.environ.get('LEGACY_BACKEND_URL', '').strip().rstrip('/')

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

# SaaS Native User Registration & Chống Spam settings (Slice 2)
BLOCKED_DISPOSABLE_DOMAINS = {
    'mailinator.com', '10minutemail.com', 'yopmail.com', 'trashmail.com', 
    'guerrillamail.com', 'tempmail.com', 'temp-mail.org', 'sharklasers.com', 
    'getairmail.com', '10minutemail.co', 'tempmail.net'
}
TURNSTILE_SECRET_KEY = os.environ.get('TURNSTILE_SECRET_KEY', '').strip()
STRICT_TURNSTILE_ENFORCEMENT = os.environ.get('STRICT_TURNSTILE_ENFORCEMENT', str(not DEBUG)).strip().lower() in ('true', '1', 'yes')


# SFI-B5: AI Advisory configuration — all credentials from env; never hardcoded.
OPENAI_API_KEY = os.environ.get('OPENAI_API_KEY', '')
OPENAI_DEFAULT_MODEL = os.environ.get('OPENAI_DEFAULT_MODEL', 'gpt-4o-mini')
ADVISORY_TOKEN_BUDGET = int(os.environ.get('ADVISORY_TOKEN_BUDGET', '2000'))
AI_FALLBACK_DAILY_QUOTA = int(os.environ.get('AI_FALLBACK_DAILY_QUOTA', '5'))

# Advertising & Trademark admin feature flag (gradual rollout).
# Set ADVERTISING_ADMIN_ENABLED=false to hide the admin panel and revoke
# its CASL abilities entirely. Defaults to enabled.
ADVERTISING_ADMIN_ENABLED = os.environ.get(
    'ADVERTISING_ADMIN_ENABLED', 'true'
).strip().lower() in ('1', 'true', 'yes')

# COC-56: SOC health probe endpoints (P0) — allows real HTTP probing per domain/service_key.
# Example: SOC_HEALTH_ENDPOINTS='{"vnbroker":"http://vnbroker:8080/health","prefetch":"http://prefetch:8080/health"}'
# or per service_key: '{"vnbroker_quote":"http://..."}'. Empty = no HTTP probe (DB-only, legacy).
import json as _json_health
try:
    _raw_health_endpoints = _json_health.loads(os.environ.get('SOC_HEALTH_ENDPOINTS', '{}') or '{}')
    SOC_HEALTH_ENDPOINTS = _raw_health_endpoints if isinstance(_raw_health_endpoints, dict) else {}
except _json_health.JSONDecodeError:
    SOC_HEALTH_ENDPOINTS = {}
SOC_HEALTH_PROBE_TIMEOUT_SECONDS = int(os.environ.get('SOC_HEALTH_PROBE_TIMEOUT_SECONDS', '5') or '5')
# Phase 3 Step 5: SLO alert dedup cooldown (hours). Prevents alert storms on repeated degradation status.
SOC_ALERT_COOLDOWN_HOURS = int(os.environ.get('SOC_ALERT_COOLDOWN_HOURS', '4') or '4')
# Phase 3 Step 3: default SLO availability target (99.9%).
SOC_SLO_TARGET = float(os.environ.get('SOC_SLO_TARGET', '0.999') or '0.999')

# Stripe Billing Integration
STRIPE_SECRET_KEY = os.environ.get('STRIPE_SECRET_KEY', '')
STRIPE_WEBHOOK_SECRET = os.environ.get('STRIPE_WEBHOOK_SECRET', '')
STRIPE_PUBLISHABLE_KEY = os.environ.get('STRIPE_PUBLISHABLE_KEY', '')

# Stripe Price IDs mapping (plan_code -> Stripe Price ID)
STRIPE_PRICE_IDS = {
    'starter': os.environ.get('STRIPE_PRICE_ID_STARTER', ''),
    'pro': os.environ.get('STRIPE_PRICE_ID_PRO', ''),
    'enterprise': os.environ.get('STRIPE_PRICE_ID_ENTERPRISE', ''),
}

LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'Asia/Ho_Chi_Minh'
USE_I18N = False
USE_TZ = True

STATIC_URL = '/static/'
STATIC_ROOT = os.path.join(BASE_DIR, 'staticfiles')
STORAGES = {
    'default': {'BACKEND': 'django.core.files.storage.FileSystemStorage'},
    'staticfiles': {'BACKEND': 'whitenoise.storage.CompressedManifestStaticFilesStorage'},
}

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

REST_FRAMEWORK = {
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.CursorPagination',
    'PAGE_SIZE': 50,
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'identity_access.authentication.CorePATAuthentication',
        'rest_framework.authentication.SessionAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
        'identity_access.permissions.IsTenantActive',
    ],
    'DEFAULT_RENDERER_CLASSES': [
        'rest_framework.renderers.JSONRenderer',
    ],
    # URLs already carry the public API version (/core/v1/*), and disabling
    # namespace-based negotiation keeps drf-spectacular from generating an empty schema.
    # A5 Fix: Custom exception handler for standard error envelopes (Constitution R4)
    'EXCEPTION_HANDLER': 'vninvest_core.exceptions.core_api_exception_handler',
    'DEFAULT_SCHEMA_CLASS': 'drf_spectacular.openapi.AutoSchema',
    'DEFAULT_THROTTLE_CLASSES': [
        'identity_access.throttles.PATRateThrottle',
        'rest_framework.throttling.UserRateThrottle',
    ] if not TESTING else [],
    'DEFAULT_THROTTLE_RATES': {
        'user': '999999/day' if TESTING else ('999999/day' if DEBUG else '1000/hour'),
        'ingest_admin_trigger': '999999/day' if TESTING else '10/hour',
        # D03/D04: DNSE backfill throttle (AGENTS §14.9)
        'system_backfill_trigger': '999999/day' if TESTING else '30/hour',
        'user_backfill_trigger': '999999/day' if TESTING else '5/hour',
        # Independent realtime polling bucket — does not consume 'user' quota
        'realtime_data': '999999/day' if TESTING else '120/min',
        # Independent SOC operator read bucket — does not consume 'user' quota
        'soc_operator_read': '999999/day' if TESTING else '120/min',
        # Alert-center signals bucket (D6) — per-view throttle on signal_intelligence alert views.
        'signals': '999999/day' if TESTING else '60/min',
        # Independent SOC stream bucket — SSE long-lived fallback, 60/min connect limit (F4)
        'soc_stream': '999999/day' if TESTING else '60/min',
        # Independent alert-center stream bucket — user-scoped SSE (S7), mirrors soc_stream
        'alert_center_stream': '999999/day' if TESTING else '60/min',
        # Independent auth-bootstrap bucket — /auth/me/ and capabilities must never
        # be blocked by operational polling exhausting the global 'user' bucket
        'auth_bootstrap': '999999/day' if TESTING else '60/min',
        'notification': '999999/day' if TESTING else '3/second',
        'tenant_invite': '999999/day' if TESTING else '10/hour',
        'advisory_refresh': '999999/day' if TESTING else '10/hour',
        # R0.11 — bucket riêng cho đặt lệnh chứng khoán. Không dùng chung
        # bucket 'user' để một vòng poll nặng của client khác không chặn nhầm
        # việc đặt lệnh, và ngược lại spam đặt lệnh không làm cạn quota khác.
        'broker_order': '999999/day' if TESTING else '30/min',
    },
}

ADVISORY_MANUAL_TRIGGER_COOLDOWN_SECONDS = 60
ADVISORY_MANUAL_TRIGGER_USER_COOLDOWN_SECONDS = 10
ADVISORY_TOKEN_BUDGET = 2000

SPECTACULAR_SETTINGS = {
    'TITLE': 'VNInvest Core API',
    'DESCRIPTION': 'OpenAPI schema cho VNInvest Core — market data, signals, advisory.',
    'VERSION': '1.0.0',
    'SERVE_INCLUDE_SCHEMA': False,
    'COMPONENT_SPLIT_REQUEST': True,
    'SORT_OPERATIONS': False,
    'SWAGGER_UI_DIST': 'SIDECAR',
    'SWAGGER_UI_FAVICON_HREF': 'SIDECAR',
    'REDOC_DIST': 'SIDECAR',
}

CORS_ALLOW_ALL_ORIGINS = False
# SM-P1.4: CORS_ALLOWED_ORIGINS must be explicit in production.
# In dev (DEBUG=True) with no env var, allow localhost origins for convenience.
_cors_origins_default = (
    'http://localhost:3000,http://127.0.0.1:3000,'
    'http://localhost:5173,http://127.0.0.1:5173,'
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

# Dynamic CORS allowance toggle for API endpoints (/core/v1/* and /api/*)
CORS_API_DYNAMIC_ALLOW = os.environ.get('CORS_API_DYNAMIC_ALLOW', 'true').strip().lower() in ('true', '1', 'yes')

# CSRF origin checks must know the public host(s) in production, but local dev
# should work out of the box on localhost without extra env wiring.
_csrf_trusted_origins_default = (
    'http://localhost,http://127.0.0.1,'
    'http://localhost:80,http://127.0.0.1:80,'
    'http://localhost:3000,http://127.0.0.1:3000,'
    'http://localhost:3001,http://127.0.0.1:3001,'
    'http://localhost:5173,http://127.0.0.1:5173,'
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

# CPS-P01: Global market-data daily bootstrap policy for missing coverage symbols.
GLOBAL_MARKET_DATA_DAILY_BOOTSTRAP_DAYS_DEFAULT = 365
GLOBAL_MARKET_DATA_DAILY_BOOTSTRAP_DAYS_MIN = 1
GLOBAL_MARKET_DATA_DAILY_BOOTSTRAP_DAYS_MAX = 3650
try:
    _daily_bootstrap_days_raw = int(
        os.environ.get(
            'GLOBAL_MARKET_DATA_DAILY_BOOTSTRAP_DAYS',
            str(GLOBAL_MARKET_DATA_DAILY_BOOTSTRAP_DAYS_DEFAULT),
        )
    )
except (TypeError, ValueError):
    _daily_bootstrap_days_raw = GLOBAL_MARKET_DATA_DAILY_BOOTSTRAP_DAYS_DEFAULT
GLOBAL_MARKET_DATA_DAILY_BOOTSTRAP_DAYS = max(
    min(_daily_bootstrap_days_raw, GLOBAL_MARKET_DATA_DAILY_BOOTSTRAP_DAYS_MAX),
    GLOBAL_MARKET_DATA_DAILY_BOOTSTRAP_DAYS_MIN,
)

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
CELERY_TIMEZONE = TIME_ZONE
# P3: Disable broker connection pool — prevents pool exhaustion under long-running ASGI.
CELERY_BROKER_POOL_LIMIT = None

import sys
if TESTING:
    CELERY_TASK_ALWAYS_EAGER = True
    try:
        import celery
        celery.current_app.conf.task_always_eager = True
    except Exception:
        pass
    CACHES = {
        'default': {
            'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
            'LOCATION': 'unique-snowflake',
        }
    }


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
    'snapshot-quota-history': {
        'task': 'commercial.tasks.snapshot_quota_history',
        'schedule': crontab(minute=55, hour=23),
        'options': {'queue': SCHEDULER_QUEUE_MAP['snapshot-quota-history']},
    },
    'aggregate-api-call-rollup': {
        'task': 'ops_audit.tasks.aggregate_api_call_rollup',
        'schedule': 300.0,  # every 5 minutes
        'options': {'queue': SCHEDULER_QUEUE_MAP['aggregate-api-call-rollup']},
    },
    'flush-pat-audit-log': {
        'task': 'identity_access.tasks.flush_pat_audit_log',
        'schedule': 10.0,
        'options': {'queue': SCHEDULER_QUEUE_MAP['flush-pat-audit-log']},
    },
    'cross-ref-pat-audit-events': {
        'task': 'identity_access.tasks.cross_ref_pat_audit_events',
        'schedule': 60.0,
        'options': {'queue': SCHEDULER_QUEUE_MAP['cross-ref-pat-audit-events']},
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
    'process-outbox-events-30s': {
        'task': 'data_ingest.tasks.process_outbox_events',
        'schedule': 30.0,  # Runs every 30 seconds
        'options': {'queue': SCHEDULER_QUEUE_MAP['process-outbox-events-30s']},
    },
    'send-trial-expiry-warning': {
        'task': 'tenant_lifecycle.tasks.send_trial_expiry_warning',
        'schedule': crontab(hour='9', minute='0'),
        'options': {'queue': SCHEDULER_QUEUE_MAP['send-trial-expiry-warning']},
    },
    'check-usage-thresholds': {
        'task': 'commercial.tasks.check_usage_thresholds',
        'schedule': 300.0,  # every 5 minutes
        'options': {'queue': SCHEDULER_QUEUE_MAP['check-usage-thresholds']},
    },
    'auto-deprovision-stale': {
        'task': 'tenant_lifecycle.tasks.auto_deprovision_stale',
        'schedule': crontab(day_of_week='0', hour='2', minute='0'),
        'options': {'queue': SCHEDULER_QUEUE_MAP['auto-deprovision-stale']},
    },
    # === Materializer tasks (market_serving) ===
    # Corrective live-measured: full snapshot run đo được 7+ phút (3100 DailyPrice queries
    # + 1551 update_or_create) > interval 60s → tự flood. Interval env-tunable default 300s
    # + bulk rewrite ở vnbroker_materializer (2 batch queries + 1 bulk upsert). Tên job giữ
    # nguyên để không vỡ contract (beat_reconcile đồng bộ interval số).
    'materialize-symbol-snapshot-60s': {
        'task': 'market_serving.materializers.materialize_symbol_snapshot',
        'schedule': float(os.getenv('SNAPSHOT_INTERVAL_SECONDS', '300') or 300),
        'options': {'queue': SCHEDULER_QUEUE_MAP['materialize-symbol-snapshot-60s']},
        'expire_seconds': int(os.getenv('SNAPSHOT_EXPIRE_SECONDS', '600') or 600),
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
    
    # === Native SaaS realtime prefetch (replaces legacy portfolio prefetch) ===
    # Slice B (QueueRecovery): expire_seconds = per-message TTL (giây) mà beat_reconcile.py
    # đồng bộ vào PeriodicTask.expire_seconds (django-celery-beat 2.9+: worker discard tin quá hạn
    # lúc pop — broker list vẫn tích trong downtime nhưng drain tức thì sau restart, không thực thi cũ).
    'schedule-realtime-prefetch-shards': {
        'task': 'market_serving.realtime_prefetch.schedule_realtime_prefetch_shards',
        'schedule': 3.0,  # every 3 seconds (main scheduler)
        'options': {'queue': SCHEDULER_QUEUE_MAP.get('schedule-realtime-prefetch-shards', 'realtime_prefetch')},
        'expire_seconds': int(os.getenv('REALTIME_SCHEDULER_EXPIRE_SECONDS', '30') or 30),
    },
    
    # === Ops/Admin tasks ===
    # SM-P5.5: Daily DB backup at 02:00 AM Hanoi time
    'daily-db-backup-2am': {
        'task': 'ops_audit.tasks.daily_db_backup',
        'schedule': crontab(hour=2, minute=0),
    },

    # === Market-data SSOT queue-tier scheduler ===
    # The task runs every 30s and evaluates tier-specific runtime cadence from ServiceConfig.
    'market-data-queue-tier-scheduler-30s': {
        'task': 'service_ops.run_market_data_queue_tier_scheduler',
        'schedule': 30.0,
        'options': {'queue': SCHEDULER_QUEUE_MAP.get('market-data-queue-tier-scheduler-30s', 'manual_on_demand')},
    },
    'market-data-parity-snapshot-retention-cleanup-hourly': {
        'task': 'service_ops.cleanup_market_data_parity_snapshots',
        'schedule': 3600.0,
        'options': {
            'queue': SCHEDULER_QUEUE_MAP.get(
                'market-data-parity-snapshot-retention-cleanup-hourly',
                'manual_on_demand',
            )
        },
    },
    # P19: monitor retention health anomalies and emit alert-center system alerts every 2h
    'market-data-parity-retention-health-monitor-2h': {
        'task': 'service_ops.monitor_market_data_parity_retention_health',
        'schedule': 7200.0,
        'options': {
            'queue': SCHEDULER_QUEUE_MAP.get(
                'market-data-parity-retention-health-monitor-2h',
                'manual_on_demand',
            )
        },
    },
    'reconcile-stale-running-service-run-logs-5m': {
        'task': 'service_ops.reconcile_stale_running_service_run_logs',
        'schedule': 300.0,
        'options': {
            'queue': SCHEDULER_QUEUE_MAP.get(
                'reconcile-stale-running-service-run-logs-5m',
                'manual_on_demand',
            )
        },
    },
    'reconcile-beat-schedule-5m': {
        'task': 'service_ops.reconcile_beat_schedule_ssot',
        'schedule': 300.0,
        'options': {'queue': 'manual_on_demand'},
        'kwargs': {},
    },
    # === Task thăm dò sức khỏe hệ thống dịch vụ SOC ===
    'service-ops-health-check-60s': {
        'task': 'service_ops.health_check_all_services',
        'schedule': 60.0,
        'options': {
            'queue': SCHEDULER_QUEUE_MAP.get(
                'service-ops-health-check-60s',
                'manual_on_demand',
            )
        },
    },

    # === C1: Native ingest — price board every 60s ===
    # Replaces legacy-worker as sole SymbolSnapshot update source.
    # Corrective live-measured: full run đo được 144s > 60s (tự flood). Interval env-tunable,
    # default 180s + coverage xoay vòng 1/3 (full refresh ~9 phút). Đổi tên job giữ nguyên để
    # không vỡ contract (beat_reconcile đồng bộ interval số, xem beat_reconcile.py).
    'ingest-price-board-60s': {
        'task': 'data_ingest.tasks.fetch_and_upsert_price_board',
        'schedule': float(os.getenv('PRICE_BOARD_INTERVAL_SECONDS', '180') or 180),
        'options': {'queue': SCHEDULER_QUEUE_MAP.get('ingest-price-board-60s', 'enrichment_eod')},
        'expire_seconds': int(os.getenv('PRICE_BOARD_EXPIRE_SECONDS', '300') or 300),
    },

    # === C2: Native intraday tick hydration — every 5 minutes ===
    # Persistent counterpart of the price-cache prefetch (C1).
    # Same SSOT GlobalSymbolRegistry universe → fetch_intraday_tape (KBS/VCI/DNSE)
    # → bulk_create IntradayTick.  After hydration, the existing
    # detect-whale-alerts-5m and materialize-session-facts-5m tasks
    # pick up fresh rows automatically — closing the gap where IntradayTick
    # for the current session was only filled by the weekly DNSE backfill.
    # schedule_realtime_prefetch_shards also enqueues this with throttling
    # as belt-and-suspenders (see realtime_prefetch.py hydrate leg).
    # Corrective v4: beat warm (full→hot-only sau Slice C) vẫn đẻ 2 chunk/5 phút trong khi
    # hydrate-leg đã cover hot/10 phút — trùng lặp. Interval env-tunable (reconcile sync số).
    'warm-intraday-realtime-5m': {
        'task': 'data_ingest.tasks.warm_intraday_universe',
        'schedule': float(os.getenv('WARM_INTRADAY_BEAT_INTERVAL_SECONDS', '300') or 300),
        'options': {'queue': SCHEDULER_QUEUE_MAP.get('warm-intraday-realtime-5m', 'realtime_prefetch')},
        'expire_seconds': int(os.getenv('WARM_INTRADAY_EXPIRE_SECONDS', '600') or 600),
    },

    # === Daily OHLCV backfill — after HOSE close (17:00 ICT = UTC+7) ===
    # Upserts 365 days of daily candles for all tracked symbols via VCI+KBS parallel.
    'daily-backfill-prices-1700': {
        'task': 'data_ingest.tasks.backfill_daily_prices',
        'schedule': crontab(hour=17, minute=5),  # 17:05 ICT (UTC+7)
        'kwargs': {'days': 365, '_scheduler_job_key': 'daily-backfill-prices-1700'},
        'options': {'queue': SCHEDULER_QUEUE_MAP.get('daily-backfill-prices-1700', 'enrichment_offhours')},
    },

    # === DNSE intraday tape backfill 90 ngày — Chủ nhật 01:00 ICT (Sat 18:00 UTC) ===
    # Orchestrator: resolve VN100, presence-check, queue missing (symbol, date) slots.
    # Subtasks chạy queue manual_on_demand; orchestrator chạy enrichment_offhours.
    # Enabled=True — chạy hàng tuần để fill gap tự động.
    'dnse-quarterly-backfill-intraday': {
        'task': 'data_ingest.tasks.enqueue_dnse_quarterly_backfill',
        'schedule': crontab(hour=1, minute=0, day_of_week=0),  # Sun 01:00 ICT
        'kwargs': {'days_back': 90, 'symbols_group': 'vn100_watchlist', '_scheduler_job_key': 'dnse-quarterly-backfill-intraday'},
        'options': {'queue': SCHEDULER_QUEUE_MAP.get('dnse-quarterly-backfill-intraday', 'enrichment_offhours')},
    },

    # === Deep history bootstrap — weekly Sun 03:00 ICT (Sat 20:00 UTC) ===
    # Fills OHLCV coverage gaps for all active global registry symbols.
    # Uses days=1825 (5 years) so newly registered symbols always get full depth.
    # Runs only once per week (off-market, off-peak) to avoid API quota pressure.
    'deep-history-bootstrap-weekly': {
        'task': 'data_ingest.tasks.backfill_daily_prices',
        'schedule': crontab(hour=3, minute=0, day_of_week=0),  # Sun 03:00 ICT
        'kwargs': {'days': 1825, '_scheduler_job_key': 'deep-history-bootstrap-weekly'},
        'options': {'queue': SCHEDULER_QUEUE_MAP.get('deep-history-bootstrap-weekly', 'enrichment_offhours')},
    },

    # === Pre-5-year historical backfill to market inception — weekly Sun 04:00 ICT ===
    # Complements deep-history-bootstrap-weekly (latest 5 years) by filling older history
    # from market inception up to the day before the rolling 5-year window.
    'pre5y-history-backfill-weekly': {
        'task': 'data_ingest.tasks.backfill_pre5y_to_market_inception',
        'schedule': crontab(hour=4, minute=0, day_of_week=0),  # Sun 04:00 ICT
        'kwargs': {
            'market_inception_date': '2000-07-28',
            'recent_years': 5,
            '_scheduler_job_key': 'pre5y-history-backfill-weekly',
        },
        'options': {'queue': SCHEDULER_QUEUE_MAP.get('pre5y-history-backfill-weekly', 'enrichment_offhours')},
    },

    # === P3-T03: Daily ingest_daily_prices (shadow run) ===
    # Wrapper around backfill_daily_prices with observability/monitoring.
    # Disabled by default; enable during shadow run (3-day parity testing).
    # Once parity is confirmed, remove 'daily-backfill-prices-1700' and keep this one.
    'ingest-daily-prices-1705': {
        'task': 'data_ingest.tasks.ingest_daily_prices',
        'schedule': crontab(hour=17, minute=10),  # 17:10 ICT
        'kwargs': {'days': 1},
        'options': {'queue': SCHEDULER_QUEUE_MAP.get('ingest-daily-prices-1705', 'enrichment_offhours')},
        'enabled': False,  # Disabled by default for P3-T03 (enable during shadow run)
    },

    # === Signal intelligence: market anomaly (price shock) detection — every 5 minutes ===
    # Generates UnifiedAlert for symbols with abs(price_change_pct) >= 1% from SymbolSnapshot.
    'detect-market-anomaly-alerts-5m': {
        'task': 'signal_intelligence.materializers.materialize_market_anomaly_alerts',
        'schedule': 300.0,  # every 5 minutes
        'options': {'queue': SCHEDULER_QUEUE_MAP.get('detect-market-anomaly-alerts-5m', 'manual_on_demand')},
    },

    # === Signal intelligence: whale / dark flow detection from IntradayTick — every 5 minutes ===
    # Reads IntradayTick aggregates and creates OrderFlowEvent records (whale_buy, whale_sell, dark_flow).
    # Required for alert center to surface whale and dark flow alerts.
    'detect-whale-alerts-5m': {
        'task': 'signal_intelligence.tasks.detect_and_store_global_whale_alerts',
        'schedule': 300.0,  # every 5 minutes
        'options': {'queue': SCHEDULER_QUEUE_MAP.get('detect_and_store_global_whale_alerts', 'analytics_heavy')},
    },

    # === Signal intelligence: order flow imbalance detection — every 5 minutes ===
    'detect-order-flow-5m': {
        'task': 'signal_intelligence.tasks.detect_order_flow',
        'schedule': 300.0,
        'options': {'queue': SCHEDULER_QUEUE_MAP.get('detect_order_flow', 'analytics_heavy')},
    },

    # === Signal intelligence: materialize whale feed → WhaleAlertCanonical + UnifiedAlert — every 5 min ===
    # Runs AFTER detect-whale-alerts-5m to convert OrderFlowEvent(whale_buy/sell) → WhaleAlertCanonical.
    'materialize-whale-feed-5m': {
        'task': 'signal_intelligence.materializers.materialize_whale_feed_aggregate',
        'schedule': 300.0,
        'options': {'queue': SCHEDULER_QUEUE_MAP.get('detect_and_store_global_whale_alerts', 'analytics_heavy')},
    },

    # === Signal intelligence: materialize unified alerts (real) — every 2 minutes ===
    # NOTE: Overrides the NOOP placeholder in market_serving.materializers.
    # This is the real task that syncs WhaleAlertCanonical + OrderFlowEvent(dark_flow) → UnifiedAlert.
    'materialize-unified-alerts-signal-2m': {
        'task': 'signal_intelligence.materializers.materialize_unified_alerts',
        'schedule': 120.0,  # every 2 minutes
        'options': {'queue': SCHEDULER_QUEUE_MAP.get('materialize-unified-alerts-2m', 'analytics_heavy')},
    },
    # === Signal intelligence: materialize AI signal alerts — every 5 minutes ===
    'materialize-ai-signal-alerts-5m': {
        'task': 'signal_intelligence.materializers.materialize_ai_signal_alerts',
        'schedule': 300.0,
        'options': {'queue': SCHEDULER_QUEUE_MAP.get('materialize-ai-signal-alerts-5m', 'analytics_heavy')},
    },
    # === Advisory: reset daily token budgets — daily at 00:00 (UTC+7 / Asia/Ho_Chi_Minh) ===
    'reset-daily-token-budgets-0000': {
        'task': 'advisory.reset_daily_token_budgets',
        'schedule': crontab(hour=0, minute=0),
        'options': {'queue': SCHEDULER_QUEUE_MAP.get('reset-daily-token-budgets-0000', 'manual_on_demand')},
    },
    # === P2.4: screener scheduled run — every 5 minutes (Q6, D11) ===
    'screener-scheduled-run-5m': {
        'task': 'user_workspace.screener_tasks.screener_scheduled_run',
        'schedule': 300.0,
        'options': {'queue': SCHEDULER_QUEUE_MAP.get('screener-scheduled-run-5m', 'manual_on_demand')},
    },
}

# BL-15: resolve log format safely (unknown values fall back, never crash boot).
_LOG_FORMAT = os.environ.get('LOG_FORMAT', '').strip().lower()
if _LOG_FORMAT not in ('json', 'text'):
    _LOG_FORMAT = 'text' if DEBUG else 'json'
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'json': {'()': 'vninvest_core.json_logging.JsonFormatter'},
        'text': {'format': '[{asctime}] {levelname} {name}: {message}', 'style': '{'},
    },
    'handlers': {
        # BL-15: JSON in prod (default), plain text in dev unless overridden.
        'console': {
            'class': 'logging.StreamHandler',
            'formatter': _LOG_FORMAT,
        },
    },
    'root': {
        'handlers': ['console'],
        'level': 'WARNING',
    },
}
del _LOG_FORMAT

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

# =========================================================================
# SAAS NATIVE USER REGISTRATION ANTI-ABUSE CONFIGURATIONS (R3 & R7)
# =========================================================================
# Registration rate limit thresholds (per minute)
REGISTER_IP_LIMIT_THRESHOLD = int(os.environ.get('REGISTER_IP_LIMIT_THRESHOLD', 3))
REGISTER_SUBNET_LIMIT_THRESHOLD = int(os.environ.get('REGISTER_SUBNET_LIMIT_THRESHOLD', 10))
REGISTER_EMAIL_LIMIT_THRESHOLD = int(os.environ.get('REGISTER_EMAIL_LIMIT_THRESHOLD', 2))

# Email verification settings
EMAIL_VERIFICATION_TOKEN_TTL_MINUTES = int(os.environ.get('EMAIL_VERIFICATION_TOKEN_TTL_MINUTES', 30))
EMAIL_VERIFICATION_MAX_ATTEMPTS = int(os.environ.get('EMAIL_VERIFICATION_MAX_ATTEMPTS', 5))
EMAIL_VERIFICATION_LOCKOUT_TIMEOUT = int(os.environ.get('EMAIL_VERIFICATION_LOCKOUT_TIMEOUT', 1800)) # 30 minutes in seconds
EMAIL_VERIFICATION_RESEND_COOLDOWN = int(os.environ.get('EMAIL_VERIFICATION_RESEND_COOLDOWN', 60)) # seconds

# Strict Cloudflare Turnstile enforcement settings
STRICT_TURNSTILE_ENFORCEMENT = os.environ.get('STRICT_TURNSTILE_ENFORCEMENT', 'false').lower() == 'true'

# =========================================================================
# SAAS NATIVE USER LOGIN ANTI-ABUSE CONFIGURATIONS
# =========================================================================
# Login rate limit thresholds (per minute)
LOGIN_IP_LIMIT_THRESHOLD = int(os.environ.get('LOGIN_IP_LIMIT_THRESHOLD', 5))
LOGIN_SUBNET_LIMIT_THRESHOLD = int(os.environ.get('LOGIN_SUBNET_LIMIT_THRESHOLD', 15))
LOGIN_USER_LIMIT_THRESHOLD = int(os.environ.get('LOGIN_USER_LIMIT_THRESHOLD', 3))

