"""
VNInvest Core — Django settings.

Uses environment variables for all secrets/infrastructure.
Default DATABASE_URL uses SQLite for local testing convenience.
"""
import os

import dj_database_url

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

SECRET_KEY = os.environ.get('DJANGO_SECRET_KEY', 'dev-only-insecure-key-replace-in-production')
DEBUG = os.environ.get('DJANGO_DEBUG', 'false').strip().lower() in ('1', 'true', 'yes')
ALLOWED_HOSTS = os.environ.get('DJANGO_ALLOWED_HOSTS', '*').split(',')

INSTALLED_APPS = [
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'rest_framework',
    'corsheaders',
    'identity_access',
    'market_serving',
    'signal_intelligence',
    'commercial',
    'ops_audit',
]

MIDDLEWARE = [
    'ops_audit.middleware.RequestTraceMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
]

ROOT_URLCONF = 'vninvest_core.urls'
WSGI_APPLICATION = 'vninvest_core.wsgi.application'

DATABASES = {
    'default': dj_database_url.config(
        default=os.environ.get(
            'CORE_DATABASE_URL',
            'sqlite:///' + os.path.join(BASE_DIR, 'core_dev.sqlite3'),
        )
    ),
}

# Legacy read-only connection for materializers (cutover period).
# Set LEGACY_DATABASE_URL in env; if absent, materializers run in degraded/skip mode.
_legacy_db_url = os.environ.get('LEGACY_DATABASE_URL', '')
if _legacy_db_url:
    DATABASES['legacy_readonly'] = dj_database_url.parse(_legacy_db_url)

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

CORS_ALLOW_ALL_ORIGINS = DEBUG

REDIS_URL = os.environ.get('REDIS_URL', 'redis://localhost:6379/1')

CELERY_BROKER_URL = REDIS_URL
CELERY_RESULT_BACKEND = REDIS_URL
CELERY_TASK_SERIALIZER = 'json'
CELERY_RESULT_SERIALIZER = 'json'
CELERY_ACCEPT_CONTENT = ['json']
CELERY_TIMEZONE = TIME_ZONE

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
