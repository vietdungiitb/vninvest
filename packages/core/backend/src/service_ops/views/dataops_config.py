from .dataops_base import *
from .dataops_base import _build_market_data_ownership_payload

class DataOpsRuntimeConfigApplyRequestSerializer(serializers.Serializer):
    config_payload = serializers.JSONField()

class DataOpsRuntimeConfigResponseSerializer(serializers.Serializer):
    config = serializers.JSONField()
    ownership = DataOpsOwnershipSerializer()
    updated_at = serializers.DateTimeField(allow_null=True)

@extend_schema_view(
    get=extend_schema(
        summary='Lấy runtime config DataOps market-data',
        description=(
            'Trả về runtime config hiệu lực của market-data queue tiers cùng ownership payload. '
            'Đây là canonical read path cho frontend runtime config/admin panel.'
        ),
        responses={
            200: DataOpsRuntimeConfigResponseSerializer,
            401: OpenApiTypes.OBJECT,
        },
        examples=[
            OpenApiExample(
                'Runtime config read',
                value={
                    'config': {
                        'decay_days': 7,
                        'parity_snapshot_retention_days': 30,
                        'hot_user_demand': {'poll_interval_seconds': 30, 'max_batch_size': 50},
                    },
                    'ownership': {
                        'domain': 'dataops_market_data',
                        'can_apply': True,
                        'write_surface': 'soc_dataops',
                    },
                    'updated_at': '2026-05-15T11:00:00Z',
                },
            )
        ],
    ),
    post=extend_schema(
        summary='Apply runtime config DataOps market-data',
        description=(
            'Apply runtime config cho market-data queue tiers qua canonical operator path. '
            'Request phải đi qua ownership guard và tạo ConfigChangeAudit ở backend.'
        ),
        request=DataOpsRuntimeConfigApplyRequestSerializer,
        responses={
            201: DataOpsRuntimeConfigResponseSerializer,
            400: OpenApiTypes.OBJECT,
            401: OpenApiTypes.OBJECT,
            403: OpenApiTypes.OBJECT,
        },
        examples=[
            OpenApiExample(
                'Runtime config apply',
                value={
                    'config_payload': {
                        'decay_days': 9,
                        'parity_snapshot_retention_days': 14,
                        'hot_user_demand': {'poll_interval_seconds': 20, 'max_batch_size': 40},
                        'warm_liquid_market': {'poll_interval_seconds': 180, 'max_batch_size': 110},
                    }
                },
                request_only=True,
            )
        ],
    ),
)
class DataOpsRuntimeConfigView(SOCBaseView, ConfigApplyMixin):
    def get(self, request):
        config, updated_at = get_market_data_runtime_config()
        return Response({
            'config': config.to_dict(),
            'ownership': _build_market_data_ownership_payload(),
            'updated_at': updated_at.isoformat() if updated_at else None,
        })

    def post(self, request):
        result = self.apply_config(
            request,
            service_key=SOC_DOMAIN_PRIMARY_SERVICE_KEYS['matrix'],
            domain=DATAOPS_MARKET_DATA_DOMAIN,
            config_payload=request.data.get('config_payload', {}),
            config_class=MarketDataRuntimeConfig,
            audit_action=request.data.get('audit_action', 'apply'),
        )
        if isinstance(result, Response):
            return result
        _, svc_config = result
        return Response({
            'config': svc_config.config_payload,
            'ownership': _build_market_data_ownership_payload(),
            'updated_at': svc_config.applied_at.isoformat(),
        }, status=status.HTTP_201_CREATED)


class DataOpsRuntimeConfigPreviewRequestSerializer(serializers.Serializer):
    config_payload = serializers.JSONField()


class DataOpsRuntimeConfigPreviewResponseSerializer(serializers.Serializer):
    projected_config = serializers.JSONField()
    validation_errors = serializers.ListField(child=serializers.CharField(), required=False)
    is_valid = serializers.BooleanField()
    ownership = DataOpsOwnershipSerializer()

@extend_schema(
    summary='Preview runtime config DataOps (dry-run)',
    description=(
        'Validate và hiển thị projected config sau khi apply — không lưu vào DB. '
        'Dùng để operator kiểm tra trước khi thực sự apply.'
    ),
    request=DataOpsRuntimeConfigPreviewRequestSerializer,
    responses={
        200: DataOpsRuntimeConfigPreviewResponseSerializer,
        400: OpenApiTypes.OBJECT,
        401: OpenApiTypes.OBJECT,
        403: OpenApiTypes.OBJECT,
    },
)
class DataOpsRuntimeConfigPreviewView(SOCBaseView):
    """POST /api/soc/dataops/runtime-config/preview/ — dry-run validation."""

    def post(self, request):
        config_payload = request.data.get('config_payload', {})
        current_config, _ = get_market_data_runtime_config()
        current_dict = current_config.to_dict()

        validation_errors = []
        projected_dict = current_dict
        if not isinstance(config_payload, dict):
            validation_errors.append('config_payload phải là object.')
        else:
            try:
                projected = MarketDataRuntimeConfig.from_dict({**current_dict, **config_payload})
                projected_dict = projected.to_dict()
            except Exception as exc:
                validation_errors.append(str(exc))

        if validation_errors:
            return Response({
                'projected_config': projected_dict,
                'validation_errors': validation_errors,
                'is_valid': False,
                'ownership': _build_market_data_ownership_payload(),
            }, status=status.HTTP_400_BAD_REQUEST)

        return Response({
            'projected_config': projected_dict,
            'validation_errors': [],
            'is_valid': True,
            'ownership': _build_market_data_ownership_payload(),
        })

class DataOpsRuntimeConfigSchemaFieldSerializer(serializers.Serializer):
    key = serializers.CharField()
    type = serializers.CharField()
    min = serializers.IntegerField(allow_null=True, required=False)
    max = serializers.IntegerField(allow_null=True, required=False)
    default = serializers.IntegerField(allow_null=True, required=False)
    help = serializers.CharField(allow_blank=True, required=False)

class DataOpsRuntimeConfigSchemaResponseSerializer(serializers.Serializer):
    fields = DataOpsRuntimeConfigSchemaFieldSerializer(many=True)

@extend_schema(
    summary='Schema runtime config DataOps market-data',
    description=(
        'Trả về mô tả từng trường config (key, type, min, max, default, help) — '
        'frontend render form động theo schema này, fallback hard-code khi 404.'
    ),
    responses={
        200: DataOpsRuntimeConfigSchemaResponseSerializer,
        401: OpenApiTypes.OBJECT,
    },
)
class DataOpsRuntimeConfigSchemaView(SOCBaseView):
    """GET /api/soc/dataops/runtime-config/schema/ — form schema (C6 — CFG-09)."""

    def get(self, request):
        return Response({'fields': MarketDataRuntimeConfig.get_schema()})

class DataOpsRuntimeConfigAuditSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    service_key = serializers.CharField()
    action = serializers.CharField(allow_null=True)
    actor = serializers.CharField(allow_null=True)
    actor_ip = serializers.CharField(allow_null=True, required=False)
    timestamp = serializers.DateTimeField(allow_null=True)
    change_summary = serializers.CharField(allow_blank=True, allow_null=True)
    before_snapshot = serializers.JSONField(allow_null=True)
    after_snapshot = serializers.JSONField(allow_null=True)
    request_id = serializers.CharField(allow_blank=True, allow_null=True, required=False)

class DataOpsRuntimeConfigAuditResponseSerializer(serializers.Serializer):
    count = serializers.IntegerField()
    next = serializers.CharField(allow_null=True, required=False)
    previous = serializers.CharField(allow_null=True, required=False)
    results = DataOpsRuntimeConfigAuditSerializer(many=True)

@extend_schema(
    summary='Audit log runtime config DataOps',
    description=(
        'Trả về lịch sử thay đổi config của DataOps market-data domain, '
        'sắp xếp theo thứ tự mới nhất.'
    ),
    responses={
        200: DataOpsRuntimeConfigAuditResponseSerializer,
        401: OpenApiTypes.OBJECT,
        403: OpenApiTypes.OBJECT,
    },
)
class DataOpsRuntimeConfigAuditView(SOCBaseView):
    """GET /api/soc/dataops/runtime-config/audit/ — change history."""

    def get(self, request):
        service_key = SOC_DOMAIN_PRIMARY_SERVICE_KEYS['matrix']
        audits = ConfigChangeAudit.objects.filter(
            service__service_key=service_key,
        ).select_related('service').order_by('-timestamp', '-id')
        page = self.paginate_queryset(audits, request)
        data = [
            {
                'id': audit.id,
                'service_key': audit.service.service_key if audit.service else service_key,
                'action': audit.action,
                'actor': audit.actor,
                'actor_ip': audit.actor_ip,
                'timestamp': audit.timestamp.isoformat() if audit.timestamp else None,
                'change_summary': audit.change_summary,
                'before_snapshot': audit.before_snapshot,
                'after_snapshot': audit.after_snapshot,
                'request_id': audit.request_id,
            }
            for audit in page
        ]
        return self.get_paginated_response(data)
