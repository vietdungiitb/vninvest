"""
Django settings for vninvest project.
"""
import os
from datetime import timedelta
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")

SECRET_KEY = os.getenv("DJANGO_SECRET_KEY", "django-insecure-change-this-in-production-use-env-variable")
DEBUG = os.getenv("DJANGO_DEBUG", "True").lower() == "true"

ALLOWED_HOSTS = [host.strip() for host in os.getenv("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1").split(",") if host.strip()]

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
        'realtime': '60/minute',
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
WATCHLIST_SYNC_MINUTES = int(os.getenv("WATCHLIST_SYNC_MINUTES", "15"))
WATCHLIST_SYNC_DAYS = int(os.getenv("WATCHLIST_SYNC_DAYS", "5"))

CELERY_BEAT_SCHEDULE = {}
if WATCHLIST_SYNC_ENABLED:
    CELERY_BEAT_SCHEDULE["sync-all-watch-assets"] = {
        "task": "portfolio.tasks.sync_all_watch_assets",
        "schedule": timedelta(minutes=max(WATCHLIST_SYNC_MINUTES, 1)),
        "args": (WATCHLIST_SYNC_DAYS,),
    }

# Stream consumer batch — chạy mỗi 3 giây khi REALTIME_ENABLED=true
STREAM_CONSUMER_INTERVAL = int(os.getenv("STREAM_CONSUMER_INTERVAL", "3"))
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
    _REALTIME_POLL_INTERVAL = int(os.getenv("REALTIME_POLL_INTERVAL", "5"))
    CELERY_BEAT_SCHEDULE["collect-and-publish-realtime"] = {
        "task": "portfolio.tasks.collect_and_publish_realtime",
        "schedule": timedelta(seconds=_REALTIME_POLL_INTERVAL),
    }

# Realtime feature flags (Sprint 11)
REALTIME_ENABLED = os.getenv("REALTIME_ENABLED", "False").lower() == "true"
REALTIME_DEFAULT_WHALE_THRESHOLD = int(os.getenv("REALTIME_DEFAULT_WHALE_THRESHOLD", "500000000"))
REALTIME_REDIS_URL = os.getenv("REALTIME_REDIS_URL", CELERY_BROKER_URL)
REALTIME_CHANNEL_LAYER = os.getenv("REALTIME_CHANNEL_LAYER", "redis").lower()

# Redis Streams — db=1 (riêng với Celery db=0 và Cache db=2)
STREAM_REDIS_URL = os.getenv("STREAM_REDIS_URL", "redis://localhost:6379/1")
STREAM_MAX_LEN = int(os.getenv("STREAM_MAX_LEN", "50000"))
STREAM_CONSUMER_BATCH = int(os.getenv("STREAM_CONSUMER_BATCH", "100"))
STREAM_SNAPSHOT_TTL = int(os.getenv("STREAM_SNAPSHOT_TTL", "60"))
STREAM_BLOCK_MS = int(os.getenv("STREAM_BLOCK_MS", "2000"))

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
