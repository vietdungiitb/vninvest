"""WSGI config for vninvest_core."""
import os

from django.core.wsgi import get_wsgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'vninvest_core.settings')
application = get_wsgi_application()
