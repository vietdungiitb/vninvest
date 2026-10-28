"""
SOC Serializers — DRF model serializers cho 6 core models.
"""
from rest_framework import serializers

from .models import (
    ConfigChangeAudit,
    OwnershipRecord,
    ScrapeMatrix,
    ScrapeMatrixCell,
    ServiceConfig,
    ServiceDefinition,
    ServiceHealth,
    ServiceRunLog,
)


class ServiceDefinitionSerializer(serializers.ModelSerializer):
    class Meta:
        model = ServiceDefinition
        fields = [
            'id', 'service_key', 'name', 'domain',
            'description', 'owner_team', 'tags',
            'is_active', 'is_deprecated', 'deprecation_note',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class ServiceConfigSerializer(serializers.ModelSerializer):
    service_key = serializers.SlugRelatedField(
        source='service', slug_field='service_key', read_only=True,
    )

    class Meta:
        model = ServiceConfig
        fields = [
            'id', 'service', 'service_key', 'config_schema_version',
            'config_payload', 'applied_by', 'applied_at',
            'change_reason', 'is_current',
        ]
        read_only_fields = ['id', 'applied_at', 'applied_by']


class ServiceHealthSerializer(serializers.ModelSerializer):
    service_key = serializers.SlugRelatedField(
        source='service', slug_field='service_key', read_only=True,
    )

    class Meta:
        model = ServiceHealth
        fields = [
            'id', 'service', 'service_key', 'status',
            'last_check_at', 'last_success_at',
            'consecutive_failures', 'avg_response_ms', 'detail',
            'slo_target', 'uptime_30d', 'burn_rate_1h', 'error_budget_remaining',
        ]
        read_only_fields = ['id', 'last_check_at']


class ServiceRunLogSerializer(serializers.ModelSerializer):
    service_key = serializers.SlugRelatedField(
        source='service', slug_field='service_key', read_only=True,
    )

    class Meta:
        model = ServiceRunLog
        fields = [
            'id', 'service', 'service_key', 'celery_task_id',
            'status', 'started_at', 'finished_at', 'duration_seconds',
            'input_summary', 'output_summary', 'error_detail',
        ]
        read_only_fields = ['id', 'started_at']


class OwnershipRecordSerializer(serializers.ModelSerializer):
    class Meta:
        model = OwnershipRecord
        fields = [
            'id', 'domain', 'owner_team', 'write_mode',
            'write_surface', 'locked_fields', 'compatibility_domains',
            'deprecation_notes', 'updated_at',
        ]
        read_only_fields = ['id', 'updated_at']


class ConfigChangeAuditSerializer(serializers.ModelSerializer):
    service_key = serializers.SlugRelatedField(
        source='service', slug_field='service_key', read_only=True,
    )

    class Meta:
        model = ConfigChangeAudit
        fields = [
            'id', 'service', 'service_key', 'action',
            'actor', 'actor_ip',
            'before_snapshot', 'after_snapshot',
            'change_summary', 'timestamp', 'request_id',
        ]
        read_only_fields = [
            'id', 'actor', 'actor_ip', 'timestamp', 'request_id',
        ]


class ScrapeMatrixSerializer(serializers.ModelSerializer):
    progress_pct = serializers.FloatField(read_only=True)

    class Meta:
        model = ScrapeMatrix
        fields = [
            'id', 'cycle_id', 'status', 'providers',
            'started_at', 'completed_at',
            'total_rows', 'done_rows', 'failed_rows', 'progress_pct',
        ]
        read_only_fields = fields


class ScrapeMatrixCellSerializer(serializers.ModelSerializer):
    cycle_id = serializers.SlugRelatedField(
        source='matrix', slug_field='cycle_id', read_only=True,
    )

    class Meta:
        model = ScrapeMatrixCell
        fields = [
            'id', 'cycle_id', 'symbol_group_id', 'provider',
            'status', 'worker_id', 'claimed_at', 'done_at',
            'symbols_processed', 'error_detail',
        ]
        read_only_fields = fields
