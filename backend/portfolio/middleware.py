from time import perf_counter

from .observability import record_market_http_observation


class MarketObservabilityMiddleware:
    """Collects latency/status metrics for market hot-path HTTP endpoints."""

    MARKET_PREFIXES = (
        '/api/realtime/',
        '/api/stock-management/stocks/',
    )

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        start = perf_counter()
        status_code = 500
        try:
            response = self.get_response(request)
            status_code = int(getattr(response, 'status_code', 500) or 500)
            return response
        except Exception:
            status_code = 500
            raise
        finally:
            request_path = str(getattr(request, 'path', '') or '')
            if request_path.startswith(self.MARKET_PREFIXES):
                latency_ms = (perf_counter() - start) * 1000.0
                resolver_match = getattr(request, 'resolver_match', None)
                endpoint_name = getattr(resolver_match, 'url_name', None)
                endpoint = endpoint_name or request_path
                record_market_http_observation(endpoint=endpoint, status_code=status_code, latency_ms=latency_ms)
