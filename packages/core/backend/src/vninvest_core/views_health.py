"""Health and capability-bootstrap views for core/v1."""
import json
import os
from datetime import datetime, timezone

from django.http import JsonResponse
from django.views.decorators.http import require_GET


@require_GET
def health(request):
    return JsonResponse({
        'status': 'ok',
        'package': 'vninvest-core',
        'timestamp': datetime.now(timezone.utc).isoformat(),
        'request_id': request.META.get('X_REQUEST_ID', ''),
    })


@require_GET
def capability_bootstrap(request):
    build_target = os.environ.get('CORE_BUILD_TARGET', 'saas').strip().lower() or 'saas'
    return JsonResponse({
        'snapshot_version': '2026-05-03',
        'build_target': build_target,
        'navigation': {
            'visible_routes': [
                'dashboard', 'portfolio', 'watchlist',
                'whale-alerts', 'ai-advisory', 'operations-center',
            ],
        },
        'surfaces': {
            'show_operations_center': True,
            'show_ai_command_center': True,
        },
        'api_base': '/core/v1',
    })
