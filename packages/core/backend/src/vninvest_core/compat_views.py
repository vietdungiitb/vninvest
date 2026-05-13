"""
Compatibility proxy views for legacy backend routes not yet migrated to core-api.

This module provides proxy views that forward requests to the legacy backend (port 8000)
for routes that haven't been migrated to core-api yet.

Example: /api/stock-management/stocks/<symbol>/chart/ is still in legacy backend.
"""
import logging
from django.conf import settings
from django.http import JsonResponse
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
import requests

logger = logging.getLogger(__name__)


class LegacyStockManagementProxyView(APIView):
    """
    Proxy view that forwards stock-management requests to legacy backend.
    
    This view handles:
    - /api/stock-management/stocks/<symbol>/chart/
    - /api/stock-management/stocks/<symbol>/overview/
    - /api/stock-management/stocks/<symbol>/order-flow/
    - /api/stock-management/stocks/<symbol>/news/
    - Any other /api/stock-management/stocks/* endpoints
    """
    
    def get_legacy_backend_url(self):
        """Get the legacy backend URL from settings."""
        return getattr(settings, 'LEGACY_BACKEND_URL', 'http://localhost:8000').rstrip('/')
    
    def forward_request(self, request, path):
        """Forward the request to the legacy backend."""
        legacy_url = self.get_legacy_backend_url()
        full_url = f"{legacy_url}/api/stock-management/{path}"
        
        try:
            # Forward headers
            headers = {}
            if 'HTTP_AUTHORIZATION' in request.META:
                headers['Authorization'] = request.META['HTTP_AUTHORIZATION']
            if 'CONTENT_TYPE' in request.META:
                headers['Content-Type'] = request.META['CONTENT_TYPE']
            
            # Forward query parameters
            params = dict(request.GET.items())
            
            response = requests.get(
                full_url,
                headers=headers,
                params=params,
                timeout=30,
            )
            
            # Return the proxied response
            return JsonResponse(
                response.json() if response.headers.get('content-type', '').startswith('application/json') else {'detail': response.text},
                status=response.status_code,
            )
        except requests.RequestException as e:
            logger.error(f"Legacy proxy error: {e}", exc_info=True)
            return JsonResponse(
                {'detail': 'Service temporarily unavailable', 'error': str(e)},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        except Exception as e:
            logger.error(f"Unexpected error in legacy proxy: {e}", exc_info=True)
            return JsonResponse(
                {'detail': 'Internal server error'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
    
    def get(self, request, path):
        """Handle GET requests to legacy endpoints."""
        return self.forward_request(request, path)
