"""WSGI config for vninvest_core."""
import os
import socket

# Prevent socket blocking operations from hanging indefinitely
socket.setdefaulttimeout(60.0)

from django.contrib.staticfiles.handlers import StaticFilesHandler
from django.core.wsgi import get_wsgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'vninvest_core.settings')
application = StaticFilesHandler(get_wsgi_application())
