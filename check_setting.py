import django
import os

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.conf import settings
print(f"TICKER_CACHE_MISS_ALLOW_DEGRADED: {settings.TICKER_CACHE_MISS_ALLOW_DEGRADED}")
