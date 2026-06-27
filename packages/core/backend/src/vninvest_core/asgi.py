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

from channels.auth import AuthMiddlewareStack
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.security.websocket import AllowedHostsOriginValidator
from django.core.asgi import get_asgi_application
from django.urls import path

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'vninvest_core.settings')

# Import consumers AFTER Django setup
from signal_intelligence.consumers import MarketTickerConsumer  # noqa: E402

_django_asgi_app = get_asgi_application()

application = ProtocolTypeRouter({
    'http': _django_asgi_app,
    'websocket': AllowedHostsOriginValidator(
        AuthMiddlewareStack(
            URLRouter([
                path('ws/market/<str:symbol>/', MarketTickerConsumer.as_asgi()),
            ])
        )
    ),
})
