"""
Django settings for vninvest project.
"""
import os
from datetime import timedelta
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")


def _env_int(name: str, default: int) -> int:
    value = os.getenv(name)
    if value is None:
        return default
    value = value.strip()
    if not value:
        return default
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def _env_float(name: str, default: float) -> float:
    value = os.getenv(name)
    if value is None:
        return default
    value = value.strip()
    if not value:
        return default
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _env_bool(name: str, default: bool) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    value = value.strip().lower()
    if value in {"1", "true", "yes", "on"}:
        return True
    if value in {"0", "false", "no", "off"}:
        return False
    return default

DEBUG = os.getenv("DJANGO_DEBUG", "True").lower() == "true"

_secret_key_env = os.getenv("DJANGO_SECRET_KEY", "").strip()
if _secret_key_env:
    SECRET_KEY = _secret_key_env
elif DEBUG:
    # Ephemeral key cho local dev khi chưa có .env file.
    # Mỗi lần restart sẽ gen key mới → session/cookie không persistent.
    # Chạy scripts/dev-setup.ps1 để tạo .env với key cố định.
    import secrets as _secrets
    import warnings as _warnings
    SECRET_KEY = "dev-ephemeral-" + _secrets.token_urlsafe(40)
    _warnings.warn(
        "DJANGO_SECRET_KEY chua duoc set. Dang dung ephemeral key (session se mat sau restart). "
        "Chay scripts/dev-setup.ps1 de tao backend/.env.",
        UserWarning,
        stacklevel=1,
    )
else:
    raise ValueError(
        "DJANGO_SECRET_KEY phai duoc set trong production. "
        "Tao backend/.env.production tu backend/.env.production.example."
    )

# Security defaults: strict in production, permissive in local dev.
SECURE_SSL_REDIRECT = _env_bool("DJANGO_SECURE_SSL_REDIRECT", not DEBUG)
SESSION_COOKIE_SECURE = _env_bool("DJANGO_SESSION_COOKIE_SECURE", not DEBUG)
CSRF_COOKIE_SECURE = _env_bool("DJANGO_CSRF_COOKIE_SECURE", not DEBUG)
SECURE_HSTS_SECONDS = _env_int("DJANGO_SECURE_HSTS_SECONDS", 0 if DEBUG else 3600)
SECURE_HSTS_INCLUDE_SUBDOMAINS = _env_bool("DJANGO_SECURE_HSTS_INCLUDE_SUBDOMAINS", not DEBUG)
SECURE_HSTS_PRELOAD = _env_bool("DJANGO_SECURE_HSTS_PRELOAD", False)

# X-Frame-Options mặc định SAMEORIGIN để admin hoạt động an toàn trên cùng domain.
X_FRAME_OPTIONS = os.getenv("X_FRAME_OPTIONS", "SAMEORIGIN")

ALLOWED_HOSTS = [
    host.strip()
    for host in os.getenv(
        "DJANGO_ALLOWED_HOSTS",
        "localhost,127.0.0.1,10.0.2.2,testserver",
    ).split(",")
    if host.strip()
]

# Trust reverse-proxy headers so build_absolute_uri() keeps https scheme in production.
USE_X_FORWARDED_HOST = os.getenv("USE_X_FORWARDED_HOST", "True").lower() == "true"
USE_X_FORWARDED_PORT = os.getenv("USE_X_FORWARDED_PORT", "True").lower() == "true"
SECURE_PROXY_SSL_HEADER = (
    os.getenv("SECURE_PROXY_SSL_HEADER_NAME", "HTTP_X_FORWARDED_PROTO"),
    os.getenv("SECURE_PROXY_SSL_HEADER_VALUE", "https"),
)

INSTALLED_APPS = [
    'daphne',
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    # Third-party
    'rest_framework',
    'corsheaders',
    'channels',
    # Local
    'portfolio',
    'support',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'portfolio.middleware.MarketObservabilityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'config.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [BASE_DIR / 'templates'],
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

WSGI_APPLICATION = 'config.wsgi.application'
ASGI_APPLICATION = 'config.asgi.application'

DB_ENGINE = os.getenv("DB_ENGINE", "sqlite").lower()
if DB_ENGINE == "postgres":
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.postgresql",
            "NAME": os.getenv("POSTGRES_DB", "vninvest"),
            "USER": os.getenv("POSTGRES_USER", "postgres"),
            "PASSWORD": os.getenv("POSTGRES_PASSWORD", "postgres"),
            "HOST": os.getenv("POSTGRES_HOST", "localhost"),
            "PORT": os.getenv("POSTGRES_PORT", "5432"),
            "CONN_MAX_AGE": int(os.getenv("DB_CONN_MAX_AGE", "60")),
        }
    }
else:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": BASE_DIR / os.getenv("SQLITE_DB_NAME", "db.sqlite3"),
        }
    }

AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

LANGUAGE_CODE = 'vi'
TIME_ZONE = 'Asia/Ho_Chi_Minh'
USE_I18N = True
USE_TZ = True

STATIC_URL = os.getenv("DJANGO_STATIC_URL", '/static/')
STATIC_ROOT = BASE_DIR / 'staticfiles'

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

def _get_throttle_rate(env_var: str, default: str) -> str:
    """Normalize throttle rate into DRF-safe ``num/period`` format.

    Defensive cases handled:
    - Empty / non-numeric values -> fallback to default
    - Bare number like ``120`` -> auto-normalize to ``120/minute``
    - Missing period like ``120/`` -> auto-normalize to ``120/minute``
    - Multiple slashes like ``120/minute/extra`` -> fallback to default
    - Unknown period prefix -> fallback to default
    """
    val = str(os.getenv(env_var, "")).strip()
    if not val:
        return default

    # Bare integer is auto-upgraded to per-minute to keep backward compatibility.
    if val.isdigit():
        amount = int(val)
        return f"{amount}/minute" if amount > 0 else default

    # DRF parse_rate expects exactly one slash: "num/period".
    if val.count("/") != 1:
        return default

    amount_raw, period_raw = [part.strip() for part in val.split("/", 1)]
    if not amount_raw.isdigit():
        return default

    amount = int(amount_raw)
    if amount <= 0:
        return default

    if not period_raw:
        return f"{amount}/minute"

    # DRF maps duration by the first character of period: s/m/h/d.
    if period_raw[0].lower() not in {"s", "m", "h", "d"}:
        return default

    return f"{amount}/{period_raw}"

REST_FRAMEWORK = {
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
    ],
    'DEFAULT_AUTHENTICATION_CLASSES': [
        # PAT-only architecture: all tokens are issued by core-api as PATs (vni_ prefix).
        # JWTAuthentication removed — core-api is the single auth entry point.
        'core_pat_auth.LegacyCorePATAuthentication',
    ],
    # Keep production API responses strictly JSON to avoid loading browsable API
    # static assets through frontend routing.
    'DEFAULT_RENDERER_CLASSES': [
        'rest_framework.renderers.JSONRenderer',
    ],
    'DEFAULT_THROTTLE_CLASSES': [
        'rest_framework.throttling.ScopedRateThrottle',
    ],
    'DEFAULT_THROTTLE_RATES': {
        'realtime': _get_throttle_rate('DRF_REALTIME_RATE', '60/minute'),
        'realtime_ticker': _get_throttle_rate('DRF_REALTIME_TICKER_RATE', '120/minute'),
        'realtime_ticker_batch': _get_throttle_rate('DRF_REALTIME_TICKER_BATCH_RATE', '60/minute'),
        'realtime_intraday': _get_throttle_rate('DRF_REALTIME_INTRADAY_RATE', '90/minute'),
        'realtime_price_board': _get_throttle_rate('DRF_REALTIME_PRICE_BOARD_RATE', '120/minute'),
        'realtime_breadth': _get_throttle_rate('DRF_REALTIME_BREADTH_RATE', '90/minute'),
        'realtime_whale_feed': _get_throttle_rate('DRF_REALTIME_WHALE_FEED_RATE', '90/minute'),
        'realtime_whale_aggregate': _get_throttle_rate('DRF_REALTIME_WHALE_AGG_RATE', '120/minute'),
        'realtime_rvol': _get_throttle_rate('DRF_REALTIME_RVOL_RATE', '60/minute'),
        'realtime_chart': _get_throttle_rate('DRF_REALTIME_CHART_RATE', '90/minute'),
        'realtime_ops_metrics': _get_throttle_rate('DRF_REALTIME_OPS_METRICS_RATE', '30/minute'),
        'auth': '10/minute',
        'auth_password_reset_request': _get_throttle_rate('DRF_AUTH_PASSWORD_RESET_REQUEST_RATE', '5/hour'),
        'auth_password_reset_confirm': _get_throttle_rate('DRF_AUTH_PASSWORD_RESET_CONFIRM_RATE', '10/hour'),
        'auth_resend_verification': _get_throttle_rate('DRF_AUTH_RESEND_VERIFICATION_RATE', '3/hour'),
        'support_ticket_create': _get_throttle_rate('DRF_SUPPORT_TICKET_CREATE_RATE', '5/hour'),
        'support_ticket_reply': _get_throttle_rate('DRF_SUPPORT_TICKET_REPLY_RATE', '30/hour'),
    },
}

# CORS / CSRF (frontend origins)
CORS_ALLOWED_ORIGINS = [origin.strip() for origin in os.getenv("CORS_ALLOWED_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000,http://localhost:3001,http://127.0.0.1:3001").split(",") if origin.strip()]
CSRF_TRUSTED_ORIGINS = [origin.strip() for origin in os.getenv("CSRF_TRUSTED_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000,http://localhost:3001,http://127.0.0.1:3001").split(",") if origin.strip()]

# Optional hard override for Google OAuth callback URL to avoid redirect_uri_mismatch behind proxies.
GOOGLE_OAUTH_REDIRECT_URI = os.getenv('GOOGLE_OAUTH_REDIRECT_URI', '').strip()
FRONTEND_BASE_URL = os.getenv("FRONTEND_BASE_URL", "http://localhost:3000")
EMAIL_VERIFICATION_TOKEN_MAX_AGE_SECONDS = _env_int("EMAIL_VERIFICATION_TOKEN_MAX_AGE_SECONDS", 86400)
PASSWORD_RESET_TOKEN_MAX_AGE_SECONDS = _env_int("PASSWORD_RESET_TOKEN_MAX_AGE_SECONDS", 3600)
DEFAULT_FROM_EMAIL = os.getenv("DEFAULT_FROM_EMAIL", "noreply@vninvest.local")
SYSTEM_EMAIL_FALLBACK_ENABLED = _env_bool("SYSTEM_EMAIL_FALLBACK_ENABLED", DEBUG)
SYSTEM_EMAIL_FALLBACK_HOST = os.getenv("SYSTEM_EMAIL_FALLBACK_HOST", "")
SYSTEM_EMAIL_FALLBACK_PORT = _env_int("SYSTEM_EMAIL_FALLBACK_PORT", 1025)
SYSTEM_EMAIL_FALLBACK_USERNAME = os.getenv("SYSTEM_EMAIL_FALLBACK_USERNAME", "")
SYSTEM_EMAIL_FALLBACK_PASSWORD = os.getenv("SYSTEM_EMAIL_FALLBACK_PASSWORD", "")
SYSTEM_EMAIL_FALLBACK_USE_TLS = _env_bool("SYSTEM_EMAIL_FALLBACK_USE_TLS", False)
SYSTEM_EMAIL_FALLBACK_USE_SSL = _env_bool("SYSTEM_EMAIL_FALLBACK_USE_SSL", False)
SYSTEM_EMAIL_FALLBACK_TIMEOUT_SECONDS = _env_int("SYSTEM_EMAIL_FALLBACK_TIMEOUT_SECONDS", 20)
SYSTEM_EMAIL_FALLBACK_FROM_EMAIL = os.getenv("SYSTEM_EMAIL_FALLBACK_FROM_EMAIL", DEFAULT_FROM_EMAIL)
SYSTEM_EMAIL_FALLBACK_FROM_NAME = os.getenv("SYSTEM_EMAIL_FALLBACK_FROM_NAME", "VNInvest")
SYSTEM_EMAIL_FALLBACK_REPLY_TO = os.getenv("SYSTEM_EMAIL_FALLBACK_REPLY_TO", "")

# Celery / Redis
CELERY_BROKER_URL = os.getenv("CELERY_BROKER_URL", "redis://localhost:6379/0")
CELERY_RESULT_BACKEND = os.getenv("CELERY_RESULT_BACKEND", CELERY_BROKER_URL)


def _redis_url_with_db(redis_url: str, db_index: int, fallback: str) -> str:
    candidate = str(redis_url or "").strip()
    if not candidate:
        return fallback
    prefix, separator, suffix = candidate.rpartition("/")
    if not separator:
        return fallback
    db_part = suffix.split("?", 1)[0]
    if not db_part.isdigit():
        return fallback
    query = suffix[len(db_part):]
    return f"{prefix}/{db_index}{query}"

# Django cache — dùng Redis db=2 (riêng, không đụng Celery db=0)
# Nếu Redis không chạy thì tự động fallback sang LocMemCache
_CACHE_REDIS_URL = os.getenv("CACHE_REDIS_URL", "redis://localhost:6379/2")
try:
    import redis as _redis_probe
    _redis_probe.from_url(_CACHE_REDIS_URL).ping()
    CACHES = {
        "default": {
            "BACKEND": "django.core.cache.backends.redis.RedisCache",
            "LOCATION": _CACHE_REDIS_URL,
            "KEY_PREFIX": "vninvest",
            "TIMEOUT": 30,
        }
    }
except Exception:
    CACHES = {
        "default": {
            "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
            "LOCATION": "vninvest-cache",
        }
    }
CELERY_ACCEPT_CONTENT = ["json"]
CELERY_TASK_SERIALIZER = "json"
CELERY_RESULT_SERIALIZER = "json"
CELERY_TIMEZONE = TIME_ZONE
WATCHLIST_SYNC_ENABLED = os.getenv("WATCHLIST_SYNC_ENABLED", "False").lower() == "true"
WATCHLIST_SYNC_MINUTES = _env_int("WATCHLIST_SYNC_MINUTES", 15)
WATCHLIST_SYNC_DAYS = _env_int("WATCHLIST_SYNC_DAYS", 5)
ONBOARDING_TRIAL_APPLY_ON_SIGNUP = os.getenv("ONBOARDING_TRIAL_APPLY_ON_SIGNUP", "True").lower() == "true"
ONBOARDING_TRIAL_AUTO_DOWNGRADE_ENABLED = os.getenv("ONBOARDING_TRIAL_AUTO_DOWNGRADE_ENABLED", "True").lower() == "true"
ONBOARDING_TRIAL_AUTO_DOWNGRADE_MINUTES = _env_int("ONBOARDING_TRIAL_AUTO_DOWNGRADE_MINUTES", 15)
ONBOARDING_TRIAL_AUTO_DOWNGRADE_BATCH_SIZE = _env_int("ONBOARDING_TRIAL_AUTO_DOWNGRADE_BATCH_SIZE", 500)
STARTER_PORTFOLIOS_ENABLED = os.getenv("STARTER_PORTFOLIOS_ENABLED", "True").lower() == "true"
STARTER_PORTFOLIOS_CANARY_PERCENT = max(0, min(100, _env_int("STARTER_PORTFOLIOS_CANARY_PERCENT", 100)))
ENABLE_NEW_MARKET_VIEWS = True  # Legacy _toggle_market_view removed; market_views is the only routing path
MARKET_VIEWS_CANARY_PERCENT = _env_int("MARKET_VIEWS_CANARY_PERCENT", 100)
ENABLE_NEW_TRADING_VIEWS = os.getenv("ENABLE_NEW_TRADING_VIEWS", "False").lower() == "true"
ENABLE_REALTIME_CONNECTION_MANAGER = os.getenv("ENABLE_REALTIME_CONNECTION_MANAGER", "False").lower() == "true"
MARKET_OBSERVABILITY_ENABLED = os.getenv("MARKET_OBSERVABILITY_ENABLED", "True").lower() == "true"
MARKET_OBSERVABILITY_LATENCY_WINDOW = _env_int("MARKET_OBSERVABILITY_LATENCY_WINDOW", 300)
REALTIME_TICKER_CACHE_ONLY = os.getenv("REALTIME_TICKER_CACHE_ONLY", "True").lower() == "true"
TICKER_FRESHNESS_SECONDS = _env_int("TICKER_FRESHNESS_SECONDS", 15)
TICKER_STALE_SERVE_SECONDS = _env_int("TICKER_STALE_SERVE_SECONDS", 90)
TICKER_CACHE_MISS_STATUS_CODE = _env_int("TICKER_CACHE_MISS_STATUS_CODE", 503)
TICKER_CACHE_MISS_ALLOW_DEGRADED = os.getenv("TICKER_CACHE_MISS_ALLOW_DEGRADED", "False").lower() == "true"
INTRADAY_STALE_MAX_SECONDS_DEFAULT = _env_int("INTRADAY_STALE_MAX_SECONDS_DEFAULT", 15)
INTRADAY_STALE_MAX_SECONDS_VN30 = _env_int("INTRADAY_STALE_MAX_SECONDS_VN30", 10)

# Market Data Service Unification (MDSU) Rollout Flags
FEATURE_FLAGS = {
    "MDSU_BACKFILL_ENABLED": _env_bool("MDSU_BACKFILL_ENABLED", False),
    "MDSU_ANALYTICS_ENABLED": _env_bool("MDSU_ANALYTICS_ENABLED", False),
    "MDSU_AI_ENABLED": _env_bool("MDSU_AI_ENABLED", False),
}

TICKER_UNIVERSE_REFRESH_SECONDS = _env_int("TICKER_UNIVERSE_REFRESH_SECONDS", 60)
TICKER_UNIVERSE_SYMBOL_LIMIT = _env_int("TICKER_UNIVERSE_SYMBOL_LIMIT", 1800)
TICKER_PREFETCH_HOT_LIMIT = _env_int("TICKER_PREFETCH_HOT_LIMIT", 200)
TICKER_PREFETCH_WARM_LIMIT = _env_int("TICKER_PREFETCH_WARM_LIMIT", 600)
TICKER_PREFETCH_HOT_INTERVAL_SECONDS = _env_int("TICKER_PREFETCH_HOT_INTERVAL_SECONDS", 5)
TICKER_PREFETCH_WARM_INTERVAL_SECONDS = _env_int("TICKER_PREFETCH_WARM_INTERVAL_SECONDS", 10)
TICKER_PREFETCH_COLD_INTERVAL_SECONDS = _env_int("TICKER_PREFETCH_COLD_INTERVAL_SECONDS", 30)
TICKER_PREFETCH_HOT_SHARDS = _env_int("TICKER_PREFETCH_HOT_SHARDS", 4)
TICKER_PREFETCH_WARM_SHARDS = _env_int("TICKER_PREFETCH_WARM_SHARDS", 6)
TICKER_PREFETCH_COLD_SHARDS = _env_int("TICKER_PREFETCH_COLD_SHARDS", 6)
TICKER_PREFETCH_BATCH_SIZE_HOT = _env_int("TICKER_PREFETCH_BATCH_SIZE_HOT", 50)
TICKER_PREFETCH_BATCH_SIZE_WARM = _env_int("TICKER_PREFETCH_BATCH_SIZE_WARM", 60)
TICKER_PREFETCH_BATCH_SIZE_COLD = _env_int("TICKER_PREFETCH_BATCH_SIZE_COLD", 60)
TICKER_UPSTREAM_SOFT_CAP_PER_MINUTE = _env_int("TICKER_UPSTREAM_SOFT_CAP_PER_MINUTE", 400)
TICKER_UPSTREAM_WARNING_CAP_PER_MINUTE = _env_int("TICKER_UPSTREAM_WARNING_CAP_PER_MINUTE", 500)
TICKER_UPSTREAM_HARD_CAP_PER_MINUTE = _env_int("TICKER_UPSTREAM_HARD_CAP_PER_MINUTE", 600)
TICKER_PREFETCH_EMERGENCY_OVERRIDE_ENABLED = os.getenv("TICKER_PREFETCH_EMERGENCY_OVERRIDE_ENABLED", "False").lower() == "true"
TICKER_PREFETCH_EMERGENCY_DISABLE_COLD = os.getenv("TICKER_PREFETCH_EMERGENCY_DISABLE_COLD", "True").lower() == "true"
TICKER_PREFETCH_EMERGENCY_INTERVAL_MULTIPLIER = max(_env_float("TICKER_PREFETCH_EMERGENCY_INTERVAL_MULTIPLIER", 2.0), 1.0)
OFFPEAK_VNSTOCK_INGEST_ENABLED = os.getenv("OFFPEAK_VNSTOCK_INGEST_ENABLED", "True").lower() == "true"
OFFPEAK_VNSTOCK_INGEST_CRON_HOUR = _env_int("OFFPEAK_VNSTOCK_INGEST_CRON_HOUR", 18)
OFFPEAK_VNSTOCK_INGEST_CRON_MINUTE = _env_int("OFFPEAK_VNSTOCK_INGEST_CRON_MINUTE", 10)
OFFPEAK_VNSTOCK_INGEST_DAYS = _env_int("OFFPEAK_VNSTOCK_INGEST_DAYS", 5)
OFFPEAK_VNSTOCK_INGEST_MAX_SYMBOLS = _env_int("OFFPEAK_VNSTOCK_INGEST_MAX_SYMBOLS", 300)

CELERY_BEAT_SCHEDULE = {}
# Realtime ticker scheduler theo universe + shard (canonical path).
# Legacy single-scan prefetch scheduler is retired to enforce SSOT runtime.
TICKER_PREFETCH_SHARD_SCHEDULER_ENABLED = True
_TICKER_PREFETCH_SCHEDULER_INTERVAL_SECONDS = _env_int("TICKER_PREFETCH_SCHEDULER_INTERVAL_SECONDS", 3)
CELERY_BEAT_SCHEDULE["build-realtime-symbol-universe-snapshot"] = {
    "task": "portfolio.tasks.build_realtime_symbol_universe_snapshot",
    "schedule": timedelta(seconds=max(TICKER_UNIVERSE_REFRESH_SECONDS, 10)),
}
CELERY_BEAT_SCHEDULE["schedule-realtime-prefetch-shards"] = {
    "task": "portfolio.tasks.schedule_realtime_prefetch_shards",
    "schedule": timedelta(seconds=max(_TICKER_PREFETCH_SCHEDULER_INTERVAL_SECONDS, 1)),
}

if OFFPEAK_VNSTOCK_INGEST_ENABLED:
    from celery.schedules import crontab as _crontab_offpeak

    CELERY_BEAT_SCHEDULE["offpeak-vnstock-ingest"] = {
        "task": "portfolio.tasks.offpeak_vnstock_ingest",
        "schedule": _crontab_offpeak(
            hour=max(0, min(23, OFFPEAK_VNSTOCK_INGEST_CRON_HOUR)),
            minute=max(0, min(59, OFFPEAK_VNSTOCK_INGEST_CRON_MINUTE)),
            day_of_week='1-5',
        ),
        "kwargs": {
            "days": max(OFFPEAK_VNSTOCK_INGEST_DAYS, 1),
            "max_symbols": max(OFFPEAK_VNSTOCK_INGEST_MAX_SYMBOLS, 1),
            "trigger": "beat",
        },
        "options": {"expires": 3600},
    }
ORDER_FLOW_DETECTION_ENABLED = os.getenv("ORDER_FLOW_DETECTION_ENABLED", "True").lower() == "true"
ORDER_FLOW_DETECTION_INTERVAL_SECONDS = _env_int("ORDER_FLOW_DETECTION_INTERVAL_SECONDS", 30)
if ORDER_FLOW_DETECTION_ENABLED:
    CELERY_BEAT_SCHEDULE["detect-order-flow"] = {
        "task": "portfolio.tasks.detect_and_store_order_flow",
        "schedule": timedelta(seconds=max(ORDER_FLOW_DETECTION_INTERVAL_SECONDS, 30)),
    }

REVERSAL_DETECTION_ENABLED = os.getenv("REVERSAL_DETECTION_ENABLED", "True").lower() == "true"
REVERSAL_DETECTION_INTERVAL_SECONDS = _env_int("REVERSAL_DETECTION_INTERVAL_SECONDS", 30)
WHALE_ALERT_DETECTION_ENABLED = os.getenv(
    "WHALE_ALERT_DETECTION_ENABLED",
    os.getenv("REVERSAL_DETECTION_ENABLED", "True"),
).lower() == "true"
WHALE_ALERT_DETECTION_INTERVAL_SECONDS = _env_int(
    "WHALE_ALERT_DETECTION_INTERVAL_SECONDS",
    REVERSAL_DETECTION_INTERVAL_SECONDS,
)
if WHALE_ALERT_DETECTION_ENABLED:
    CELERY_BEAT_SCHEDULE["detect-global-whale-alerts"] = {
        "task": "portfolio.tasks.detect_and_store_global_whale_alerts",
        "schedule": timedelta(seconds=max(WHALE_ALERT_DETECTION_INTERVAL_SECONDS, 30)),
    }

MISSION_CONTROL_SCHEDULED_ROLLOUTS_ENABLED = os.getenv("MISSION_CONTROL_SCHEDULED_ROLLOUTS_ENABLED", "True").lower() == "true"
MISSION_CONTROL_SCHEDULED_ROLLOUTS_INTERVAL_SECONDS = _env_int(
    "MISSION_CONTROL_SCHEDULED_ROLLOUTS_INTERVAL_SECONDS", 60
)
MISSION_CONTROL_ANOMALY_MONITOR_ENABLED = os.getenv("MISSION_CONTROL_ANOMALY_MONITOR_ENABLED", "True").lower() == "true"
MISSION_CONTROL_ANOMALY_MONITOR_INTERVAL_SECONDS = _env_int(
    "MISSION_CONTROL_ANOMALY_MONITOR_INTERVAL_SECONDS", 60
)
if MISSION_CONTROL_SCHEDULED_ROLLOUTS_ENABLED:
    CELERY_BEAT_SCHEDULE["activate-due-whale-config-rollouts"] = {
        "task": "portfolio.tasks.activate_due_whale_config_rollouts",
        "schedule": timedelta(seconds=max(MISSION_CONTROL_SCHEDULED_ROLLOUTS_INTERVAL_SECONDS, 30)),
    }
if MISSION_CONTROL_ANOMALY_MONITOR_ENABLED:
    CELERY_BEAT_SCHEDULE["monitor-whale-config-anomalies"] = {
        "task": "portfolio.tasks.monitor_whale_config_anomalies",
        "schedule": timedelta(seconds=max(MISSION_CONTROL_ANOMALY_MONITOR_INTERVAL_SECONDS, 30)),
    }
if WATCHLIST_SYNC_ENABLED:
    CELERY_BEAT_SCHEDULE["sync-all-watch-assets"] = {
        "task": "portfolio.tasks.sync_all_watch_assets",
        "schedule": timedelta(minutes=max(WATCHLIST_SYNC_MINUTES, 1)),
        "args": (WATCHLIST_SYNC_DAYS,),
    }
if ONBOARDING_TRIAL_AUTO_DOWNGRADE_ENABLED:
    CELERY_BEAT_SCHEDULE["process-expired-onboarding-trials"] = {
        "task": "portfolio.tasks.process_expired_onboarding_trials_task",
        "schedule": timedelta(minutes=max(ONBOARDING_TRIAL_AUTO_DOWNGRADE_MINUTES, 1)),
        "args": (max(ONBOARDING_TRIAL_AUTO_DOWNGRADE_BATCH_SIZE, 1),),
    }
ADVISORY_AUTO_GENERATION_ENABLED = os.getenv("ADVISORY_AUTO_GENERATION_ENABLED", "True").lower() == "true"
ADVISORY_AUTO_GENERATION_INTERVAL_MINUTES = _env_int("ADVISORY_AUTO_GENERATION_INTERVAL_MINUTES", 240)
ADVISORY_AUTO_GENERATION_BATCH_SIZE = _env_int("ADVISORY_AUTO_GENERATION_BATCH_SIZE", 200)
if ADVISORY_AUTO_GENERATION_ENABLED:
    CELERY_BEAT_SCHEDULE["auto-generate-advisories"] = {
        "task": "portfolio.tasks.auto_generate_advisories_for_all_tracked",
        "schedule": timedelta(minutes=max(ADVISORY_AUTO_GENERATION_INTERVAL_MINUTES, 15)),
        "kwargs": {"batch_size": max(ADVISORY_AUTO_GENERATION_BATCH_SIZE, 1)},
        "options": {"expires": max(ADVISORY_AUTO_GENERATION_INTERVAL_MINUTES * 60 // 2, 300)},
    }

# Stream consumer batch — chạy mỗi 5 giây khi REALTIME_ENABLED=true
STREAM_CONSUMER_INTERVAL = _env_int("STREAM_CONSUMER_INTERVAL", 5)
_REALTIME_ENABLED_FLAG = os.getenv("REALTIME_ENABLED", "False").lower() == "true"
REALTIME_INTRADAY_POLL_ENABLED = os.getenv("REALTIME_INTRADAY_POLL_ENABLED", "True").lower() == "true"
REALTIME_INTRADAY_POLL_SYMBOL_LIMIT = _env_int("REALTIME_INTRADAY_POLL_SYMBOL_LIMIT", 1200)
REALTIME_INTRADAY_SKIP_IF_PREFETCH_FRESH_ENABLED = os.getenv("REALTIME_INTRADAY_SKIP_IF_PREFETCH_FRESH_ENABLED", "True").lower() == "true"
REALTIME_INTRADAY_SKIP_IF_PREFETCH_FRESH_SECONDS = _env_int("REALTIME_INTRADAY_SKIP_IF_PREFETCH_FRESH_SECONDS", 8)
INTRADAY_TICK_KEEP_DAYS = _env_int("INTRADAY_TICK_KEEP_DAYS", 7)

# Stream consumer schedules — luôn đăng ký, runtime gate trong task quyết định chạy/bỏ qua.
CELERY_BEAT_SCHEDULE["stream-consumer-db-writer"] = {
    "task": "portfolio.tasks.run_stream_consumer_batch",
    "schedule": timedelta(seconds=STREAM_CONSUMER_INTERVAL),
    "args": ("db-writer",),
}
CELERY_BEAT_SCHEDULE["stream-consumer-ws-broadcaster"] = {
    "task": "portfolio.tasks.run_stream_consumer_batch",
    "schedule": timedelta(seconds=STREAM_CONSUMER_INTERVAL),
    "args": ("ws-broadcaster",),
}
CELERY_BEAT_SCHEDULE["stream-consumer-alert-engine"] = {
    "task": "portfolio.tasks.run_stream_consumer_batch",
    "schedule": timedelta(seconds=STREAM_CONSUMER_INTERVAL),
    "args": ("alert-engine",),
}
CELERY_BEAT_SCHEDULE["stream-trim"] = {
    "task": "portfolio.tasks.trim_streams",
    "schedule": timedelta(minutes=5),
}

# Cleanup IntradayTick lúc 18:30 hàng ngày (sau giờ đóng cửa thị trường) — luôn chạy,
# runtime gate intraday_tick_auto_cleanup_enabled trong task quyết định.
from celery.schedules import crontab as _crontab_intraday_cleanup
CELERY_BEAT_SCHEDULE["eod-cleanup-ticks"] = {
    "task": "portfolio.tasks.cleanup_old_intraday_ticks",
    "schedule": _crontab_intraday_cleanup(hour=18, minute=30),
}
CELERY_BEAT_SCHEDULE["cleanup-signal-service-runs"] = {
    "task": "portfolio.tasks.cleanup_old_signal_service_runs",
    "schedule": _crontab_intraday_cleanup(hour=19, minute=15),
}
# SM-P5.6: Auto-create next month's IntradayTick partition on the 20th at 02:15 AM
CELERY_BEAT_SCHEDULE["create-next-month-partition"] = {
    "task": "portfolio.create_next_month_partition",
    "schedule": _crontab_intraday_cleanup(day_of_month=20, hour=2, minute=15),
}

if _REALTIME_ENABLED_FLAG:
    # Thu thập + publish realtime mỗi 10 giây (giảm áp lực upstream và ws fanout)
    _REALTIME_POLL_INTERVAL = _env_int("REALTIME_POLL_INTERVAL", 10)
    CELERY_BEAT_SCHEDULE["collect-and-publish-realtime"] = {
        "task": "portfolio.tasks.collect_and_publish_realtime",
        "schedule": timedelta(seconds=_REALTIME_POLL_INTERVAL),
    }

# ============================================================================
# OpenCore Celery Beat Tasks
# ============================================================================
_OPENCORE_ENABLED = os.getenv("OPENCORE_ENABLED", "True").lower() == "true"
if _OPENCORE_ENABLED:
    # Sync all DPI licenses daily (check expiry, grace period, status)
    CELERY_BEAT_SCHEDULE["opencore-sync-licenses"] = {
        "task": "portfolio.opencore_celery_tasks.sync_all_dpi_licenses",
        "schedule": timedelta(hours=24),  # Daily
    }
    
    # Reset monthly quotas on the 1st of each month
    _OPENCORE_QUOTA_RESET_HOUR = _env_int("OPENCORE_QUOTA_RESET_HOUR", 0)
    from celery.schedules import crontab
    CELERY_BEAT_SCHEDULE["opencore-reset-monthly-quotas"] = {
        "task": "portfolio.opencore_celery_tasks.reset_monthly_quotas",
        "schedule": crontab(day_of_month=1, hour=_OPENCORE_QUOTA_RESET_HOUR, minute=0),
    }
    
    # Generate monthly invoices on the 1st of each month
    CELERY_BEAT_SCHEDULE["opencore-generate-invoices"] = {
        "task": "portfolio.opencore_celery_tasks.generate_monthly_invoices",
        "schedule": crontab(day_of_month=1, hour=_OPENCORE_QUOTA_RESET_HOUR, minute=5),
    }
    
    # Tạo analytics snapshot hằng ngày lúc 00:00 ICT (nửa đêm giờ Việt Nam)
    CELERY_BEAT_SCHEDULE["opencore-analytics-snapshot"] = {
        "task": "portfolio.opencore_celery_tasks.create_analytics_snapshots",
        "schedule": crontab(hour=0, minute=0),  # 00:00 ICT — CELERY_TIMEZONE = 'Asia/Ho_Chi_Minh'
    }
    
    # Check for over-quota users every hour
    CELERY_BEAT_SCHEDULE["opencore-check-overquota"] = {
        "task": "portfolio.opencore_celery_tasks.check_overquota_users",
        "schedule": timedelta(hours=1),
    }
    
    # Cleanup old audit logs weekly
    CELERY_BEAT_SCHEDULE["opencore-cleanup-logs"] = {
        "task": "portfolio.opencore_celery_tasks.cleanup_old_audit_logs",
        "schedule": timedelta(days=7),
    }
    
    # Xử lý vòng đời plan hằng ngày lúc 07:00 ICT
    CELERY_BEAT_SCHEDULE["opencore-process-plan-lifecycle"] = {
        "task": "portfolio.tasks.process_plan_lifecycle_transitions",
        "schedule": crontab(hour=7, minute=0),  # 07:00 ICT — CELERY_TIMEZONE = 'Asia/Ho_Chi_Minh'
    }

# Sync StockProfile.industry + company_name từ MarketSnapshot lúc 07:15 ICT hằng ngày
STOCK_PROFILE_SYNC_ENABLED = os.getenv("STOCK_PROFILE_SYNC_ENABLED", "True").lower() == "true"
if STOCK_PROFILE_SYNC_ENABLED:
    from celery.schedules import crontab as _crontab_profile_sync
    CELERY_BEAT_SCHEDULE["sync-stock-profiles-from-snapshot"] = {
        "task": "portfolio.tasks_stock_profile_sync.sync_stock_profiles_from_snapshot",
        # 07:15 ICT — dùng trực tiếp vì CELERY_TIMEZONE = TIME_ZONE = 'Asia/Ho_Chi_Minh'
        "schedule": _crontab_profile_sync(hour=7, minute=15),
        "options": {"expires": 3600},
    }

# Sprint35 Layer 3: Portfolio Daily News Digest sau 16:05 ICT (Mon-Fri)
PORTFOLIO_NEWS_DIGEST_ENABLED = os.getenv("PORTFOLIO_NEWS_DIGEST_ENABLED", "True").lower() == "true"
PORTFOLIO_NEWS_DIGEST_BATCH_SIZE = _env_int("PORTFOLIO_NEWS_DIGEST_BATCH_SIZE", 200)
if PORTFOLIO_NEWS_DIGEST_ENABLED:
    from celery.schedules import crontab as _crontab_sprint35
    CELERY_BEAT_SCHEDULE["portfolio-daily-news-digest"] = {
        "task": "portfolio.tasks.generate_all_portfolio_news_digests_task",
        "schedule": _crontab_sprint35(hour=16, minute=5, day_of_week='1-5'),  # 16:05 ICT Mon-Fri
        "kwargs": {"batch_size": PORTFOLIO_NEWS_DIGEST_BATCH_SIZE},
        "options": {"expires": 3600},  # bỏ qua nếu task cũ vẫn đang chạy
    }

# ── PR-2: W6 Whale Signal Backtesting — 16:30 ICT = 09:30 UTC (Mon-Fri) ────
SIGNAL_VERIFICATION_ENABLED = os.getenv("SIGNAL_VERIFICATION_ENABLED", "True").lower() == "true"
if SIGNAL_VERIFICATION_ENABLED:
    from celery.schedules import crontab as _crontab_sigver
    CELERY_BEAT_SCHEDULE["verify-signals-daily"] = {
        "task": "portfolio.tasks_signal_verification.verify_signals_daily",
        # 16:30 ICT — dùng trực tiếp vì CELERY_TIMEZONE = TIME_ZONE = 'Asia/Ho_Chi_Minh'
        "schedule": _crontab_sigver(hour=16, minute=30, day_of_week='1-5'),
        "options": {"expires": 3600},
    }

# ── PR-3: AI4 Sentiment Analysis — mỗi 30 phút ──────────────────────────────
SENTIMENT_SYNC_ENABLED = os.getenv("SENTIMENT_SYNC_ENABLED", "True").lower() == "true"
SENTIMENT_SYNC_INTERVAL_MINUTES = int(os.getenv("SENTIMENT_SYNC_INTERVAL_MINUTES", "30"))
if SENTIMENT_SYNC_ENABLED:
    CELERY_BEAT_SCHEDULE["sync-news-sentiment"] = {
        "task": "portfolio.tasks_sentiment.sync_news_sentiment",
        "schedule": timedelta(minutes=max(SENTIMENT_SYNC_INTERVAL_MINUTES, 15)),
        "options": {"expires": SENTIMENT_SYNC_INTERVAL_MINUTES * 60},
    }

# ── Watchlist Strategy Indicators — mỗi 10 giây (Phase B) ──────────────────
WATCHLIST_INDICATORS_ENABLED = os.getenv("WATCHLIST_INDICATORS_ENABLED", "True").lower() == "true"
if WATCHLIST_INDICATORS_ENABLED:
    CELERY_BEAT_SCHEDULE["compute-watchlist-indicators"] = {
        "task": "portfolio.compute_watchlist_indicators",
        "schedule": timedelta(seconds=10),
        "options": {"expires": 9},  # bỏ qua nếu task cũ chưa xong
    }

# Realtime feature flags (Sprint 11)
REALTIME_ENABLED = os.getenv("REALTIME_ENABLED", "False").lower() == "true"
REALTIME_DEFAULT_WHALE_THRESHOLD = _env_int("REALTIME_DEFAULT_WHALE_THRESHOLD", 500000000)
REALTIME_REDIS_URL = os.getenv("REALTIME_REDIS_URL", CELERY_BROKER_URL)
REALTIME_CHANNEL_LAYER = os.getenv("REALTIME_CHANNEL_LAYER", "redis").lower()
CHANNEL_LAYER_CAPACITY = _env_int("CHANNEL_LAYER_CAPACITY", 500)
CHANNEL_LAYER_EXPIRY = _env_int("CHANNEL_LAYER_EXPIRY", 60)
CHANNEL_LAYER_GROUP_EXPIRY = _env_int("CHANNEL_LAYER_GROUP_EXPIRY", 300)
CHANNEL_LAYER_TICKER_CAPACITY = _env_int("CHANNEL_LAYER_TICKER_CAPACITY", 200)
REALTIME_BROADCAST_DEGRADE_ENABLED = os.getenv("REALTIME_BROADCAST_DEGRADE_ENABLED", "True").lower() == "true"
REALTIME_BROADCAST_DEGRADE_PENDING_THRESHOLD = _env_int("REALTIME_BROADCAST_DEGRADE_PENDING_THRESHOLD", 2000)
REALTIME_BROADCAST_DEGRADE_BATCH_THRESHOLD = _env_int("REALTIME_BROADCAST_DEGRADE_BATCH_THRESHOLD", 200)
# Throttle: chỉ broadcast khi giá thay đổi >= X% HOẶC đã quá Y giây kể từ lần cuối.
REALTIME_BROADCAST_MIN_CHANGE_PCT = _env_float("REALTIME_BROADCAST_MIN_CHANGE_PCT", 0.1)
REALTIME_BROADCAST_FORCE_INTERVAL_S = _env_int("REALTIME_BROADCAST_FORCE_INTERVAL_S", 5)

# vnstock bootstrap/cache hardening flags
VNSTOCK_PROVIDER_CACHE_ENABLED = os.getenv("VNSTOCK_PROVIDER_CACHE_ENABLED", "True").lower() == "true"
VNSTOCK_CLIENT_CACHE_ENABLED = os.getenv("VNSTOCK_CLIENT_CACHE_ENABLED", "True").lower() == "true"
VNSTOCK_PROVIDER_CACHE_TTL_SECONDS = _env_int("VNSTOCK_PROVIDER_CACHE_TTL_SECONDS", 900)
VNSTOCK_CLIENT_CACHE_TTL_SECONDS = _env_int("VNSTOCK_CLIENT_CACHE_TTL_SECONDS", 900)
VNSTOCK_CLIENT_CACHE_MAXSIZE = _env_int("VNSTOCK_CLIENT_CACHE_MAXSIZE", 512)
VNSTOCK_BOOTSTRAP_LOG_SUPPRESS_ENABLED = os.getenv("VNSTOCK_BOOTSTRAP_LOG_SUPPRESS_ENABLED", "True").lower() == "true"

# Realtime stabilization flags (2026-04-17)
REALTIME_WS_PLAN_CACHE_ENABLED = os.getenv("REALTIME_WS_PLAN_CACHE_ENABLED", "True").lower() == "true"
REALTIME_WS_AUTH_CACHE_ENABLED = os.getenv("REALTIME_WS_AUTH_CACHE_ENABLED", "False").lower() == "true"
REALTIME_STREAM_NATIVE_TICKER_PATH_ENABLED = os.getenv("REALTIME_STREAM_NATIVE_TICKER_PATH_ENABLED", "False").lower() == "true"
REALTIME_STREAM_PENDING_RECLAIM_ENABLED = os.getenv("REALTIME_STREAM_PENDING_RECLAIM_ENABLED", "False").lower() == "true"
REALTIME_WS_AUTH_CACHE_TTL_SECONDS = _env_int("REALTIME_WS_AUTH_CACHE_TTL_SECONDS", 120)
STREAM_PENDING_RECLAIM_IDLE_MS = _env_int("STREAM_PENDING_RECLAIM_IDLE_MS", 60000)
STREAM_PENDING_RECLAIM_BATCH = _env_int("STREAM_PENDING_RECLAIM_BATCH", 50)
WHALE_SCORE_PROFILE = os.getenv("WHALE_SCORE_PROFILE", "v1").strip().lower()

# Redis Streams — db=1 (riêng với Celery db=0 và Cache db=2)
STREAM_REDIS_URL = os.getenv(
    "STREAM_REDIS_URL",
    _redis_url_with_db(REALTIME_REDIS_URL, 1, "redis://localhost:6379/1"),
)
STREAM_MAX_LEN = _env_int("STREAM_MAX_LEN", 10000)
STREAM_MAX_LEN_HARD_CAP = _env_int("STREAM_MAX_LEN_HARD_CAP", 20000)
STREAM_CONSUMER_BATCH = _env_int("STREAM_CONSUMER_BATCH", 100)
STREAM_SNAPSHOT_TTL = _env_int("STREAM_SNAPSHOT_TTL", 60)
STREAM_BLOCK_MS = _env_int("STREAM_BLOCK_MS", 2000)
STREAM_STALE_AFTER_SECONDS = _env_int("STREAM_STALE_AFTER_SECONDS", 30)

# Open Core quota enforcement (Slice B)
OPEN_CORE_QUOTA_ENFORCEMENT_ENABLED = os.getenv("OPEN_CORE_QUOTA_ENFORCEMENT_ENABLED", "False").lower() == "true"
OPEN_CORE_QUOTA_CAPS_BY_TIER = {
    "community": {
        "api_calls_per_day": _env_int("OPEN_CORE_COMMUNITY_API_CALLS_PER_DAY", 300),
        "ai_regenerate_per_day": _env_int("OPEN_CORE_COMMUNITY_AI_REGENERATE_PER_DAY", 0),
        "whale_symbols_max": _env_int("OPEN_CORE_COMMUNITY_WHALE_SYMBOLS_MAX", 10),
        "exports_per_day": _env_int("OPEN_CORE_COMMUNITY_EXPORTS_PER_DAY", 0),
    },
    "pro_individual": {
        "api_calls_per_day": _env_int("OPEN_CORE_PRO_INDIVIDUAL_API_CALLS_PER_DAY", 3000),
        "ai_regenerate_per_day": _env_int("OPEN_CORE_PRO_INDIVIDUAL_AI_REGENERATE_PER_DAY", 30),
        "whale_symbols_max": _env_int("OPEN_CORE_PRO_INDIVIDUAL_WHALE_SYMBOLS_MAX", 25),
        "exports_per_day": _env_int("OPEN_CORE_PRO_INDIVIDUAL_EXPORTS_PER_DAY", 20),
    },
    "pro_team": {
        "api_calls_per_day": _env_int("OPEN_CORE_PRO_TEAM_API_CALLS_PER_DAY", 10000),
        "ai_regenerate_per_day": _env_int("OPEN_CORE_PRO_TEAM_AI_REGENERATE_PER_DAY", 120),
        "whale_symbols_max": _env_int("OPEN_CORE_PRO_TEAM_WHALE_SYMBOLS_MAX", 100),
        "exports_per_day": _env_int("OPEN_CORE_PRO_TEAM_EXPORTS_PER_DAY", 100),
    },
    "admin": {
        "api_calls_per_day": -1,
        "ai_regenerate_per_day": -1,
        "whale_symbols_max": -1,
        "exports_per_day": -1,
    },
}

# ---------- OpenClaw AI Advisory ----------
OPENCLAW_API_KEY  = os.getenv("OPENCLAW_API_KEY", "")
OPENCLAW_BASE_URL = os.getenv("OPENCLAW_BASE_URL", "https://api.openclaw.ai/v1")
OPENCLAW_MODEL    = os.getenv("OPENCLAW_MODEL", "openclaw-finance-v1")
# Cooldown: tránh gọi AI 2 lần cho cùng symbol trong khoảng thời gian này (giây)
WHALE_ADVISORY_COOLDOWN_SECONDS = _env_int("WHALE_ADVISORY_COOLDOWN_SECONDS", 900)  # 15 phút
# Khi không có Celery worker, cho phép endpoint refresh chạy fallback đồng bộ.
# Khuyến nghị:
# - Staging: True để giảm false-negative khi worker restart.
# - Production: True nếu ưu tiên UX tạo advisory ngay; False nếu muốn fail-fast (503) khi worker down.
WHALE_ADVISORY_SYNC_FALLBACK_IF_NO_WORKER = os.getenv("WHALE_ADVISORY_SYNC_FALLBACK_IF_NO_WORKER", "True").lower() == "true"
# Stock workspace AI advisory session:
# - force sync create on first session call to avoid queue-only bootstrap.
# - keep sync fallback when queue worker is temporarily unavailable.
# Default async-first to prevent web worker blocking and 504 timeouts.
STOCK_AI_ADVISORY_FORCE_SYNC_FIRST_CREATE = os.getenv("STOCK_AI_ADVISORY_FORCE_SYNC_FIRST_CREATE", "False").lower() == "true"
STOCK_AI_ADVISORY_SYNC_FALLBACK_IF_NO_WORKER = os.getenv("STOCK_AI_ADVISORY_SYNC_FALLBACK_IF_NO_WORKER", "False").lower() == "true"
HOLISTIC_ADVISORY_V1_ENABLED = os.getenv("HOLISTIC_ADVISORY_V1_ENABLED", "True").lower() == "true"
HOLISTIC_ADVISORY_V1_COHORT_MODE = os.getenv("HOLISTIC_ADVISORY_V1_COHORT_MODE", "all").strip().lower()
HOLISTIC_ADVISORY_V1_COHORT_USERNAMES = [
    item.strip().lower()
    for item in os.getenv("HOLISTIC_ADVISORY_V1_COHORT_USERNAMES", "").split(",")
    if item.strip()
]
HOLISTIC_GOVERNANCE_DELTA_WARNING_THRESHOLD = _env_float("HOLISTIC_GOVERNANCE_DELTA_WARNING_THRESHOLD", 2.0)
HOLISTIC_GOVERNANCE_DELTA_CRITICAL_THRESHOLD = _env_float("HOLISTIC_GOVERNANCE_DELTA_CRITICAL_THRESHOLD", 4.0)
HOLISTIC_GOVERNANCE_DELTA_COOLDOWN_THRESHOLD = _env_float("HOLISTIC_GOVERNANCE_DELTA_COOLDOWN_THRESHOLD", 2.0)
STOCK_AI_ADVISORY_SESSION_V2_ENABLED = os.getenv("STOCK_AI_ADVISORY_SESSION_V2_ENABLED", "False").lower() == "true"
STOCK_AI_ADVISORY_BENCHMARKS_ENABLED = os.getenv("STOCK_AI_ADVISORY_BENCHMARKS_ENABLED", "False").lower() == "true"
MISSION_CONTROL_ANOMALY_LOOKBACK_MINUTES = _env_int("MISSION_CONTROL_ANOMALY_LOOKBACK_MINUTES", 5)
MISSION_CONTROL_ANOMALY_BASELINE_MINUTES = _env_int("MISSION_CONTROL_ANOMALY_BASELINE_MINUTES", 30)
MISSION_CONTROL_ANOMALY_MIN_TICK_EVENTS = _env_int("MISSION_CONTROL_ANOMALY_MIN_TICK_EVENTS", 3)
MISSION_CONTROL_ANOMALY_MIN_ADVISORIES = _env_int("MISSION_CONTROL_ANOMALY_MIN_ADVISORIES", 1)
MISSION_CONTROL_ANOMALY_SPIKE_RATIO = _env_float("MISSION_CONTROL_ANOMALY_SPIKE_RATIO", 3.0)
MISSION_CONTROL_ANOMALY_ADVISORY_SPIKE_RATIO = _env_float("MISSION_CONTROL_ANOMALY_ADVISORY_SPIKE_RATIO", 2.0)
MISSION_CONTROL_ANOMALY_ABSOLUTE_NOTIONAL_VND = float(
    _env_float("MISSION_CONTROL_ANOMALY_ABSOLUTE_NOTIONAL_VND", 5000000000.0)
)

# ===========================================================================
# Logging — Trong DEBUG, chỉ show 5xx từ django.request (tắt 404 WARNING spam)
# ===========================================================================
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
        },
    },
    'loggers': {
        'django.request': {
            'handlers': ['console'],
            # ERROR = chỉ hiện 5xx; WARNING = cả 4xx (rất nhiễu khi debug)
            'level': 'ERROR' if DEBUG else 'WARNING',
            'propagate': False,
        },
    },
}
MISSION_CONTROL_ANOMALY_SYMBOL_SCAN_LIMIT = _env_int("MISSION_CONTROL_ANOMALY_SYMBOL_SCAN_LIMIT", 200)

if REALTIME_CHANNEL_LAYER == "inmemory":
    CHANNEL_LAYERS = {
        "default": {
            "BACKEND": "channels.layers.InMemoryChannelLayer",
            "CONFIG": {
                "capacity": CHANNEL_LAYER_CAPACITY,
            },
        }
    }
else:
    CHANNEL_LAYERS = {
        "default": {
            "BACKEND": "channels_redis.core.RedisChannelLayer",
            "CONFIG": {
                "hosts": [REALTIME_REDIS_URL],
                "capacity": CHANNEL_LAYER_CAPACITY,
                "expiry": CHANNEL_LAYER_EXPIRY,
                "group_expiry": CHANNEL_LAYER_GROUP_EXPIRY,
                "channel_capacity": {
                    "ticker_*": CHANNEL_LAYER_TICKER_CAPACITY,
                },
            },
        }
    }
