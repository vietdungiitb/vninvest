"""
SFI-B7: ASGI application config with Django Channels WebSocket support.

Architecture:
- HTTP requests → Django WSGI application (via ASGIHandler)
- WebSocket /ws/* → Channels ProtocolTypeRouter → AuthMiddlewareStack → URLRouter

Note: gunicorn runs WSGI (wsgi:application) for HTTP.
      daphne/uvicorn can be added for WS support in production.
      This file provides the ASGI entrypoint for when full ASGI is needed.
"""
import os
import socket

# Prevent socket blocking operations from hanging indefinitely
socket.setdefaulttimeout(60.0)

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'vninvest_core.settings')

# P3: Ensure Celery app is initialized before Django ASGI — @shared_task relies on current_app.

from channels.auth import AuthMiddlewareStack
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.security.websocket import AllowedHostsOriginValidator
from django.core.asgi import get_asgi_application
from django.urls import path

# Import consumers AFTER Django setup
from signal_intelligence.consumers import MarketTickerConsumer, RealtimeConsumer

_django_asgi_app = get_asgi_application()

application = ProtocolTypeRouter({
    'http': _django_asgi_app,
    'websocket': AllowedHostsOriginValidator(
        AuthMiddlewareStack(
            URLRouter([
                path('ws/realtime/', RealtimeConsumer.as_asgi()),
                path('ws/market/<str:symbol>/', MarketTickerConsumer.as_asgi()),
            ])
        )
    ),
})
