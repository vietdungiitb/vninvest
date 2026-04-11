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

SECRET_KEY = os.getenv("DJANGO_SECRET_KEY", "django-insecure-change-this-in-production-use-env-variable")
DEBUG = os.getenv("DJANGO_DEBUG", "True").lower() == "true"

# Security defaults: strict in production, permissive in local dev.
SECURE_SSL_REDIRECT = _env_bool("DJANGO_SECURE_SSL_REDIRECT", not DEBUG)
SESSION_COOKIE_SECURE = _env_bool("DJANGO_SESSION_COOKIE_SECURE", not DEBUG)
CSRF_COOKIE_SECURE = _env_bool("DJANGO_CSRF_COOKIE_SECURE", not DEBUG)
SECURE_HSTS_SECONDS = _env_int("DJANGO_SECURE_HSTS_SECONDS", 0 if DEBUG else 3600)
SECURE_HSTS_INCLUDE_SUBDOMAINS = _env_bool("DJANGO_SECURE_HSTS_INCLUDE_SUBDOMAINS", not DEBUG)
SECURE_HSTS_PRELOAD = _env_bool("DJANGO_SECURE_HSTS_PRELOAD", False)

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

STATIC_URL = 'static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

REST_FRAMEWORK = {
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
    ],
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ],
    'DEFAULT_THROTTLE_CLASSES': [
        'rest_framework.throttling.ScopedRateThrottle',
    ],
    'DEFAULT_THROTTLE_RATES': {
        'realtime': os.getenv('DRF_REALTIME_RATE', '60/minute'),
        'realtime_ticker': os.getenv('DRF_REALTIME_TICKER_RATE', '120/minute'),
        'realtime_intraday': os.getenv('DRF_REALTIME_INTRADAY_RATE', '90/minute'),
        'realtime_price_board': os.getenv('DRF_REALTIME_PRICE_BOARD_RATE', '120/minute'),
        'realtime_breadth': os.getenv('DRF_REALTIME_BREADTH_RATE', '90/minute'),
        'realtime_whale_feed': os.getenv('DRF_REALTIME_WHALE_FEED_RATE', '90/minute'),
        'realtime_whale_aggregate': os.getenv('DRF_REALTIME_WHALE_AGG_RATE', '120/minute'),
        'realtime_rvol': os.getenv('DRF_REALTIME_RVOL_RATE', '60/minute'),
        'realtime_chart': os.getenv('DRF_REALTIME_CHART_RATE', '90/minute'),
        'auth': '10/minute',
    },
}

SIMPLE_JWT = {
    # Access token dài hơn để WS reconnect không bị 401 sau 5 phút
    'ACCESS_TOKEN_LIFETIME': timedelta(hours=2),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
    # Rotate refresh token mỗi lần dùng → client.js sẽ lưu token mới
    'ROTATE_REFRESH_TOKENS': True,
    # Không cần blacklist app (chưa cài)
    'BLACKLIST_AFTER_ROTATION': False,
    'UPDATE_LAST_LOGIN': False,
}

# CORS / CSRF (frontend origins)
CORS_ALLOWED_ORIGINS = [origin.strip() for origin in os.getenv("CORS_ALLOWED_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000,http://localhost:3001,http://127.0.0.1:3001").split(",") if origin.strip()]
CSRF_TRUSTED_ORIGINS = [origin.strip() for origin in os.getenv("CSRF_TRUSTED_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000,http://localhost:3001,http://127.0.0.1:3001").split(",") if origin.strip()]

# Optional hard override for Google OAuth callback URL to avoid redirect_uri_mismatch behind proxies.
GOOGLE_OAUTH_REDIRECT_URI = os.getenv('GOOGLE_OAUTH_REDIRECT_URI', '').strip()
FRONTEND_BASE_URL = os.getenv("FRONTEND_BASE_URL", "http://localhost:3000")
EMAIL_VERIFICATION_TOKEN_MAX_AGE_SECONDS = _env_int("EMAIL_VERIFICATION_TOKEN_MAX_AGE_SECONDS", 86400)
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
ENABLE_NEW_MARKET_VIEWS = os.getenv("ENABLE_NEW_MARKET_VIEWS", "False").lower() == "true"
MARKET_VIEWS_CANARY_PERCENT = _env_int("MARKET_VIEWS_CANARY_PERCENT", 100)
ENABLE_NEW_TRADING_VIEWS = os.getenv("ENABLE_NEW_TRADING_VIEWS", "False").lower() == "true"
ENABLE_REALTIME_CONNECTION_MANAGER = os.getenv("ENABLE_REALTIME_CONNECTION_MANAGER", "False").lower() == "true"
MARKET_OBSERVABILITY_ENABLED = os.getenv("MARKET_OBSERVABILITY_ENABLED", "True").lower() == "true"
MARKET_OBSERVABILITY_LATENCY_WINDOW = _env_int("MARKET_OBSERVABILITY_LATENCY_WINDOW", 300)

CELERY_BEAT_SCHEDULE = {}
# Pre-fetch ticker cache: chạy luôn luôn để tránh gọi vnstock trong HTTP request handler
# 1 call/20s cho tất cả symbols thay vì 1 call/request — tránh thread pool exhaustion
_TICKER_PREFETCH_INTERVAL = _env_int("TICKER_PREFETCH_INTERVAL", 20)
CELERY_BEAT_SCHEDULE["prefetch-ticker-price-board"] = {
    "task": "portfolio.tasks.prefetch_ticker_price_board",
    "schedule": timedelta(seconds=max(_TICKER_PREFETCH_INTERVAL, 10)),
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
if REVERSAL_DETECTION_ENABLED:
    CELERY_BEAT_SCHEDULE["detect-whale-reversal"] = {
        "task": "portfolio.tasks.detect_whale_reversal",
        "schedule": timedelta(seconds=max(REVERSAL_DETECTION_INTERVAL_SECONDS, 30)),
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

# Stream consumer batch — chạy mỗi 3 giây khi REALTIME_ENABLED=true
STREAM_CONSUMER_INTERVAL = _env_int("STREAM_CONSUMER_INTERVAL", 3)
_REALTIME_ENABLED_FLAG = os.getenv("REALTIME_ENABLED", "False").lower() == "true"
if _REALTIME_ENABLED_FLAG:
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
    CELERY_BEAT_SCHEDULE["eod-cleanup-ticks"] = {
        "task": "portfolio.tasks.cleanup_old_intraday_ticks",
        "schedule": timedelta(hours=24),
        "kwargs": {"keep_days": 7},
    }
    # Thu thập + publish realtime mỗi 5 giây (giống polling cũ nhưng cũng push vào Stream)
    _REALTIME_POLL_INTERVAL = _env_int("REALTIME_POLL_INTERVAL", 5)
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
    
    # Create daily analytics snapshots at midnight UTC
    CELERY_BEAT_SCHEDULE["opencore-analytics-snapshot"] = {
        "task": "portfolio.opencore_celery_tasks.create_analytics_snapshots",
        "schedule": crontab(hour=0, minute=0),  # Midnight UTC
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
    
    # Process trial/grace plan lifecycle transitions daily (7am UTC)
    CELERY_BEAT_SCHEDULE["opencore-process-plan-lifecycle"] = {
        "task": "portfolio.tasks.process_plan_lifecycle_transitions",
        "schedule": crontab(hour=7, minute=0),  # Daily at 7am UTC
    }

# Realtime feature flags (Sprint 11)
REALTIME_ENABLED = os.getenv("REALTIME_ENABLED", "False").lower() == "true"
REALTIME_DEFAULT_WHALE_THRESHOLD = _env_int("REALTIME_DEFAULT_WHALE_THRESHOLD", 500000000)
REALTIME_REDIS_URL = os.getenv("REALTIME_REDIS_URL", CELERY_BROKER_URL)
REALTIME_CHANNEL_LAYER = os.getenv("REALTIME_CHANNEL_LAYER", "redis").lower()

# Redis Streams — db=1 (riêng với Celery db=0 và Cache db=2)
STREAM_REDIS_URL = os.getenv("STREAM_REDIS_URL", "redis://localhost:6379/1")
STREAM_MAX_LEN = _env_int("STREAM_MAX_LEN", 50000)
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
STOCK_AI_ADVISORY_FORCE_SYNC_FIRST_CREATE = os.getenv("STOCK_AI_ADVISORY_FORCE_SYNC_FIRST_CREATE", "True").lower() == "true"
STOCK_AI_ADVISORY_SYNC_FALLBACK_IF_NO_WORKER = os.getenv("STOCK_AI_ADVISORY_SYNC_FALLBACK_IF_NO_WORKER", "True").lower() == "true"
STOCK_AI_ADVISORY_SESSION_V2_ENABLED = os.getenv("STOCK_AI_ADVISORY_SESSION_V2_ENABLED", "False").lower() == "true"
MISSION_CONTROL_ANOMALY_LOOKBACK_MINUTES = _env_int("MISSION_CONTROL_ANOMALY_LOOKBACK_MINUTES", 5)
MISSION_CONTROL_ANOMALY_BASELINE_MINUTES = _env_int("MISSION_CONTROL_ANOMALY_BASELINE_MINUTES", 30)
MISSION_CONTROL_ANOMALY_MIN_TICK_EVENTS = _env_int("MISSION_CONTROL_ANOMALY_MIN_TICK_EVENTS", 3)
MISSION_CONTROL_ANOMALY_MIN_ADVISORIES = _env_int("MISSION_CONTROL_ANOMALY_MIN_ADVISORIES", 1)
MISSION_CONTROL_ANOMALY_SPIKE_RATIO = _env_float("MISSION_CONTROL_ANOMALY_SPIKE_RATIO", 3.0)
MISSION_CONTROL_ANOMALY_ADVISORY_SPIKE_RATIO = _env_float("MISSION_CONTROL_ANOMALY_ADVISORY_SPIKE_RATIO", 2.0)
MISSION_CONTROL_ANOMALY_ABSOLUTE_NOTIONAL_VND = float(
    _env_float("MISSION_CONTROL_ANOMALY_ABSOLUTE_NOTIONAL_VND", 5000000000.0)
)
MISSION_CONTROL_ANOMALY_SYMBOL_SCAN_LIMIT = _env_int("MISSION_CONTROL_ANOMALY_SYMBOL_SCAN_LIMIT", 200)

if REALTIME_CHANNEL_LAYER == "inmemory":
    CHANNEL_LAYERS = {
        "default": {
            "BACKEND": "channels.layers.InMemoryChannelLayer",
        }
    }
else:
    CHANNEL_LAYERS = {
        "default": {
            "BACKEND": "channels_redis.core.RedisChannelLayer",
            "CONFIG": {
                "hosts": [REALTIME_REDIS_URL],
            },
        }
    }
