"""
Prefetch Domain Views (7 endpoints) — stub implementation.

GET /api/soc/prefetch/config/ — get current config
POST /api/soc/prefetch/config/ — apply config
GET /api/soc/prefetch/config/profiles/ — list 6 time profiles
GET /api/soc/prefetch/cache-status/ — cache performance
POST /api/soc/prefetch/purge-cache/ — force purge
GET /api/soc/prefetch/universe-groups/ — configured symbol groups
GET /api/soc/prefetch/task-schedule/ — active task schedule
"""
from rest_framework import status
from rest_framework.response import Response
from django.utils import timezone

from ..models import ServiceDefinition, ServiceConfig
from ..serializers import ServiceConfigSerializer
from ..domain_configs import PrefetchTimePolicyConfig, VALID_PROFILES
from .base import SOCBaseView
from .mixins import ConfigApplyMixin


class PrefetchConfigView(SOCBaseView, ConfigApplyMixin):
    """GET/POST /api/soc/prefetch/config/"""

    def get(self, request):
        """GET current prefetch config."""
        try:
            service = ServiceDefinition.objects.get(service_key='prefetch_policy')
            current_config = ServiceConfig.objects.filter(
                service=service, is_current=True
            ).first()
            if current_config:
                return Response(ServiceConfigSerializer(current_config).data)
        except (ServiceDefinition.DoesNotExist, ServiceConfig.DoesNotExist):
            pass
        default = PrefetchTimePolicyConfig()
        return Response({
            'config_payload': default.to_dict(),
            'is_current': True,
        })

    def post(self, request):
        """POST apply prefetch config."""
        config_payload = request.data.get('config_payload', {})
        result = self.apply_config(
            request,
            service_key='prefetch_policy',
            domain='prefetch',
            config_payload=config_payload,
            config_class=PrefetchTimePolicyConfig,
        )
        if isinstance(result, Response):
            return result
        service, svc_config = result
        return Response(
            ServiceConfigSerializer(svc_config).data,
            status=status.HTTP_201_CREATED,
        )


class PrefetchProfilesView(SOCBaseView):
    """GET /api/soc/prefetch/config/profiles/"""

    def get(self, request):
        """List 6 trading time profiles."""
        return Response({
            'profiles': sorted(VALID_PROFILES),
            'descriptions': {
                'pre_open': 'Before market open (08:00-09:00)',
                'market_open': 'Market open (09:00-11:30)',
                'lunch_break': 'Lunch break (11:30-13:00)',
                'pre_close': 'Pre-close (14:30-15:00)',
                'post_close': 'After close (15:00-18:00)',
                'offhours': 'Offhours (18:00-08:00)',
            },
        })


class PrefetchCacheStatusView(SOCBaseView):
    """GET /api/soc/prefetch/cache-status/"""

    def get(self, request):
        """Cache performance stats."""
        return Response({
            'redis': {
                'connected': True,
                'memory_usage_mb': 125,
                'max_memory_mb': 256,
            },
            'cache_hits': 15234,
            'cache_misses': 3421,
            'hit_ratio': 0.816,
            'last_prefetch_at': timezone.now().isoformat(),
        })


class PrefetchPurgeCacheView(SOCBaseView):
    """POST /api/soc/prefetch/purge-cache/"""

    def post(self, request):
        """Force purge cache for symbol group."""
        group_id = request.data.get('group_id')
        # Placeholder
        return Response({
            'group_id': group_id,
            'purged_keys': 456,
            'status': 'success',
            'timestamp': timezone.now().isoformat(),
        })


class PrefetchUniverseGroupsView(SOCBaseView):
    """GET /api/soc/prefetch/universe-groups/"""

    def get(self, request):
        """Configured symbol groups."""
        return Response({
            'groups': [
                {'id': 1, 'name': 'Top 100', 'symbol_count': 100},
                {'id': 2, 'name': 'VN30', 'symbol_count': 30},
            ],
        })


class PrefetchTaskScheduleView(SOCBaseView):
    """GET /api/soc/prefetch/task-schedule/"""

    def get(self, request):
        """Active Celery task schedule."""
        return Response({
            'schedule': [
                {
                    'task': 'prefetch_market_open',
                    'interval_seconds': 30,
                    'enabled': True,
                    'next_run': timezone.now().isoformat(),
                },
            ],
        })
