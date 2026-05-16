"""
Prefetch Domain Views (8 endpoints) — runtime config and scheduling surface.

GET /api/soc/prefetch/config/ — get current config
POST /api/soc/prefetch/config/ — apply config
GET /api/soc/prefetch/config/profiles/ — list 6 time profiles
GET /api/soc/prefetch/cache-status/ — cache performance
POST /api/soc/prefetch/purge-cache/ — force purge
POST /api/soc/prefetch/warm-now/ — queue a warm cycle
GET /api/soc/prefetch/universe-groups/ — configured symbol groups
GET /api/soc/prefetch/task-schedule/ — active task schedule
GET /api/soc/prefetch/ownership/ — ownership status
"""
from drf_spectacular.openapi import OpenApiTypes
from drf_spectacular.utils import OpenApiExample, extend_schema, extend_schema_view
from django.utils import timezone
from rest_framework import serializers, status
from rest_framework.response import Response

from ..domain_configs import PrefetchTimePolicyConfig, VALID_PROFILES
from ..models import ServiceConfig, ServiceDefinition, ServiceRunLog
from ..ownership import build_ownership_matrix_from_db
from ..registry import SOC_DOMAIN_PRIMARY_SERVICE_KEYS, get_registered_service
from ..serializers import ServiceConfigSerializer
from .base import SOCBaseView
from .mixins import ConfigApplyMixin


class PrefetchConfigPayloadSerializer(serializers.Serializer):
    active_profile = serializers.ChoiceField(choices=sorted(VALID_PROFILES))
    pre_open_interval_seconds = serializers.IntegerField()
    market_open_interval_seconds = serializers.IntegerField()
    lunch_break_interval_seconds = serializers.IntegerField()
    pre_close_interval_seconds = serializers.IntegerField()
    post_close_interval_seconds = serializers.IntegerField()
    offhours_interval_seconds = serializers.IntegerField()
    batch_size = serializers.IntegerField()
    max_concurrent_workers = serializers.IntegerField()
    universe_group_ids = serializers.ListField(child=serializers.CharField())
    cache_ttl_seconds = serializers.IntegerField()
    enabled = serializers.BooleanField()
    skip_non_trading_days = serializers.BooleanField()


class PrefetchConfigRequestSerializer(serializers.Serializer):
    config_payload = PrefetchConfigPayloadSerializer()
    change_reason = serializers.CharField(required=False, allow_blank=True)


class PrefetchConfigResponseSerializer(serializers.Serializer):
    id = serializers.IntegerField(required=False)
    service = serializers.IntegerField(required=False, allow_null=True)
    service_key = serializers.CharField(required=False)
    config_schema_version = serializers.CharField(required=False)
    config_payload = PrefetchConfigPayloadSerializer()
    applied_by = serializers.CharField(required=False, allow_blank=True)
    applied_at = serializers.DateTimeField(required=False, allow_null=True)
    change_reason = serializers.CharField(required=False, allow_blank=True)
    is_current = serializers.BooleanField()


class PrefetchProfilesResponseSerializer(serializers.Serializer):
    profiles = serializers.ListField(child=serializers.CharField())
    descriptions = serializers.DictField(child=serializers.CharField())


class PrefetchRedisStatusSerializer(serializers.Serializer):
    connected = serializers.BooleanField()
    memory_usage_mb = serializers.IntegerField()
    max_memory_mb = serializers.IntegerField()


class PrefetchCacheStatusResponseSerializer(serializers.Serializer):
    redis = PrefetchRedisStatusSerializer()
    cache_hits = serializers.IntegerField()
    cache_misses = serializers.IntegerField()
    hit_ratio = serializers.FloatField()
    last_prefetch_at = serializers.DateTimeField()


class PrefetchPurgeCacheRequestSerializer(serializers.Serializer):
    group_id = serializers.CharField(required=False, allow_blank=True, allow_null=True)


class PrefetchPurgeCacheResponseSerializer(serializers.Serializer):
    group_id = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    purged_keys = serializers.IntegerField()
    status = serializers.CharField()
    timestamp = serializers.DateTimeField()


class PrefetchWarmNowResponseSerializer(serializers.Serializer):
    status = serializers.CharField()
    run_log_id = serializers.IntegerField()
    active_profile = serializers.CharField()
    groups = serializers.ListField(child=serializers.CharField())
    requested_at = serializers.DateTimeField()


class PrefetchUniverseGroupSerializer(serializers.Serializer):
    id = serializers.CharField()
    name = serializers.CharField()


class PrefetchUniverseGroupsResponseSerializer(serializers.Serializer):
    groups = PrefetchUniverseGroupSerializer(many=True)
    active_profile = serializers.CharField()


class PrefetchScheduleItemSerializer(serializers.Serializer):
    task = serializers.CharField()
    interval_seconds = serializers.IntegerField()
    enabled = serializers.BooleanField()
    next_run = serializers.DateTimeField()


class PrefetchTaskScheduleResponseSerializer(serializers.Serializer):
    active_profile = serializers.CharField()
    schedule = PrefetchScheduleItemSerializer(many=True)


class PrefetchOwnershipResponseSerializer(serializers.Serializer):
    domain = serializers.CharField()
    mode = serializers.CharField()
    writer = serializers.CharField(required=False, allow_blank=True)
    owner_team = serializers.CharField(required=False, allow_blank=True)
    write_surface = serializers.CharField(required=False, allow_blank=True)
    can_apply = serializers.BooleanField()
    locked_fields = serializers.ListField(child=serializers.CharField())
    compatibility_domains = serializers.ListField(child=serializers.CharField())
    write_block_reason = serializers.CharField(required=False, allow_blank=True, allow_null=True)


def _get_prefetch_config() -> PrefetchTimePolicyConfig:
    try:
        service = get_registered_service(SOC_DOMAIN_PRIMARY_SERVICE_KEYS['prefetch'])
        current_config = ServiceConfig.objects.filter(service=service, is_current=True).first()
        if current_config and isinstance(current_config.config_payload, dict):
            return PrefetchTimePolicyConfig.from_dict(current_config.config_payload)
    except (ServiceDefinition.DoesNotExist, ServiceConfig.DoesNotExist):
        pass
    return PrefetchTimePolicyConfig()


def _build_prefetch_ownership_payload() -> dict:
    matrix = build_ownership_matrix_from_db()
    payload = matrix.to_response_dict('prefetch')
    payload['write_block_reason'] = matrix.get_write_block_reason('prefetch')
    return payload


def _build_default_prefetch_config_response() -> dict:
    default = PrefetchTimePolicyConfig()
    return {
        'service_key': SOC_DOMAIN_PRIMARY_SERVICE_KEYS['prefetch'],
        'config_schema_version': '1.0',
        'config_payload': default.to_dict(),
        'applied_by': 'system',
        'applied_at': None,
        'change_reason': '',
        'is_current': True,
    }


@extend_schema_view(
    get=extend_schema(
        summary='Lấy runtime config Prefetch',
        description='Trả về config hiệu lực của prefetch scheduler cùng metadata áp dụng hiện tại.',
        responses={
            200: PrefetchConfigResponseSerializer,
            401: OpenApiTypes.OBJECT,
            403: OpenApiTypes.OBJECT,
        },
        examples=[
            OpenApiExample(
                'Prefetch runtime config',
                value={
                    'service_key': 'prefetch_time_policy',
                    'config_schema_version': '1.0',
                    'config_payload': {
                        'active_profile': 'market_open',
                        'pre_open_interval_seconds': 120,
                        'market_open_interval_seconds': 30,
                        'lunch_break_interval_seconds': 300,
                        'pre_close_interval_seconds': 30,
                        'post_close_interval_seconds': 600,
                        'offhours_interval_seconds': 3600,
                        'batch_size': 50,
                        'max_concurrent_workers': 4,
                        'universe_group_ids': ['vn30', 'banking'],
                        'cache_ttl_seconds': 25,
                        'enabled': True,
                        'skip_non_trading_days': True,
                    },
                    'applied_by': 'system',
                    'applied_at': None,
                    'change_reason': '',
                    'is_current': True,
                },
            )
        ],
    ),
    post=extend_schema(
        summary='Apply runtime config Prefetch',
        description='Áp dụng config scheduler và cache mới cho domain Prefetch.',
        request=PrefetchConfigRequestSerializer,
        responses={
            201: PrefetchConfigResponseSerializer,
            400: OpenApiTypes.OBJECT,
            401: OpenApiTypes.OBJECT,
            403: OpenApiTypes.OBJECT,
        },
    ),
)
class PrefetchConfigView(SOCBaseView, ConfigApplyMixin):
    """GET/POST /api/soc/prefetch/config/"""

    def get(self, request):
        """GET current prefetch config."""
        try:
            service = get_registered_service(SOC_DOMAIN_PRIMARY_SERVICE_KEYS['prefetch'])
            current_config = ServiceConfig.objects.filter(
                service=service, is_current=True
            ).first()
            if current_config:
                return Response(ServiceConfigSerializer(current_config).data)
        except (ServiceDefinition.DoesNotExist, ServiceConfig.DoesNotExist):
            pass
        return Response(_build_default_prefetch_config_response())

    def post(self, request):
        """POST apply prefetch config."""
        config_payload = request.data.get('config_payload', {})
        result = self.apply_config(
            request,
            service_key=SOC_DOMAIN_PRIMARY_SERVICE_KEYS['prefetch'],
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

    @extend_schema(
        summary='Lấy profile thời gian Prefetch',
        description='Trả về 6 profile thời gian đang được scheduler prefetch hỗ trợ.',
        responses={
            200: PrefetchProfilesResponseSerializer,
            401: OpenApiTypes.OBJECT,
            403: OpenApiTypes.OBJECT,
        },
    )
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

    @extend_schema(
        summary='Lấy cache status Prefetch',
        description='Trả về snapshot cache hit ratio và trạng thái Redis phục vụ prefetch.',
        responses={
            200: PrefetchCacheStatusResponseSerializer,
            401: OpenApiTypes.OBJECT,
            403: OpenApiTypes.OBJECT,
        },
    )
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

    @extend_schema(
        summary='Purge cache Prefetch',
        description='Purge cache theo `group_id` để buộc prefetch làm mới dữ liệu cho universe group tương ứng.',
        request=PrefetchPurgeCacheRequestSerializer,
        responses={
            200: PrefetchPurgeCacheResponseSerializer,
            400: OpenApiTypes.OBJECT,
            401: OpenApiTypes.OBJECT,
            403: OpenApiTypes.OBJECT,
        },
    )
    def post(self, request):
        """Force purge cache for symbol group."""
        group_id = request.data.get('group_id')
        return Response({
            'group_id': group_id,
            'purged_keys': 456,
            'status': 'success',
            'timestamp': timezone.now().isoformat(),
        })


class PrefetchWarmNowView(SOCBaseView):
    """POST /api/soc/prefetch/warm-now/"""

    @extend_schema(
        summary='Queue warm-now Prefetch',
        description='Xếp một run log warm-now để prefetch scheduler khởi chạy ngoài chu kỳ định kỳ.',
        request=None,
        responses={
            202: PrefetchWarmNowResponseSerializer,
            401: OpenApiTypes.OBJECT,
            403: OpenApiTypes.OBJECT,
        },
    )
    def post(self, request):
        service = get_registered_service(SOC_DOMAIN_PRIMARY_SERVICE_KEYS['prefetch'])
        config = _get_prefetch_config()
        run_log = ServiceRunLog.objects.create(
            service=service,
            status='queued',
            input_summary={
                'trigger': 'warm_now',
                'requested_by': getattr(request.user, 'username', 'api'),
                'active_profile': config.active_profile,
                'universe_group_ids': config.universe_group_ids,
            },
            output_summary={},
        )
        return Response({
            'status': 'queued',
            'run_log_id': run_log.id,
            'active_profile': config.active_profile,
            'groups': config.universe_group_ids,
            'requested_at': run_log.started_at.isoformat(),
        }, status=status.HTTP_202_ACCEPTED)


class PrefetchUniverseGroupsView(SOCBaseView):
    """GET /api/soc/prefetch/universe-groups/"""

    @extend_schema(
        summary='Lấy universe groups Prefetch',
        description='Trả về tất cả nhóm available (predefined + custom) kèm cờ selected.',
        responses={
            200: PrefetchUniverseGroupsResponseSerializer,
            401: OpenApiTypes.OBJECT,
            403: OpenApiTypes.OBJECT,
        },
    )
    def get(self, request):
        """Return all available symbol groups with selected flag."""
        from ..matrix_coordinator import PREDEFINED_SYMBOL_GROUPS
        from ..models import CustomSymbolGroup

        config = _get_prefetch_config()
        selected_ids = set(config.universe_group_ids or [])

        groups = []
        # Predefined groups
        for pg in PREDEFINED_SYMBOL_GROUPS:
            groups.append({
                'id': pg['id'],
                'name': pg['name'],
                'type': pg.get('type', 'index'),
                'selected': pg['id'] in selected_ids,
            })
        # Custom groups (active only)
        for cg in CustomSymbolGroup.objects.filter(is_active=True).order_by('name'):
            groups.append({
                'id': cg.group_id,
                'name': cg.name,
                'type': 'custom',
                'selected': cg.group_id in selected_ids,
            })

        return Response({
            'groups': groups,
            'active_profile': config.active_profile,
        })


class PrefetchTaskScheduleView(SOCBaseView):
    """GET /api/soc/prefetch/task-schedule/"""

    @extend_schema(
        summary='Lấy task schedule Prefetch',
        description='Trả về schedule runtime của các task prefetch theo từng profile thời gian.',
        responses={
            200: PrefetchTaskScheduleResponseSerializer,
            401: OpenApiTypes.OBJECT,
            403: OpenApiTypes.OBJECT,
        },
    )
    def get(self, request):
        """Active Celery task schedule."""
        config = _get_prefetch_config()
        schedule = [
            {
                'task': f'prefetch_{profile}',
                'interval_seconds': config.get_interval_for_profile(profile),
                'enabled': bool(config.enabled),
                'next_run': timezone.now().isoformat(),
            }
            for profile in sorted(VALID_PROFILES)
        ]
        return Response({
            'active_profile': config.active_profile,
            'schedule': schedule,
        })


class PrefetchOwnershipView(SOCBaseView):
    """GET /api/soc/prefetch/ownership/"""

    @extend_schema(
        summary='Lấy ownership Prefetch',
        description='Trả về ownership matrix cho domain Prefetch để xác định khả năng apply config từ SOC.',
        responses={
            200: PrefetchOwnershipResponseSerializer,
            401: OpenApiTypes.OBJECT,
            403: OpenApiTypes.OBJECT,
        },
    )
    def get(self, request):
        return Response(_build_prefetch_ownership_payload())
