"""
data_ingest serializers for REST API.
"""
from rest_framework import serializers
from .models import IngestJob, IngestRun


class IngestRunSerializer(serializers.ModelSerializer):
    class Meta:
        model = IngestRun
        fields = [
            'id',
            'job',
            'state',
            'rows_upserted',
            'rows_skipped',
            'error_message',
            'started_at',
            'finished_at',
            'meta',
        ]
        read_only_fields = [
            'id',
            'started_at',
            'finished_at',
            'rows_upserted',
            'rows_skipped',
            'error_message',
        ]


class IngestJobSerializer(serializers.ModelSerializer):
    last_run = serializers.SerializerMethodField()

    class Meta:
        model = IngestJob
        fields = [
            'id',
            'name',
            'source',
            'status',
            'schedule_seconds',
            'config',
            'created_at',
            'updated_at',
            'last_run',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_last_run(self, obj):
        last_run = obj.runs.order_by('-started_at').first()
        return IngestRunSerializer(last_run).data if last_run else None


class TriggerIngestRequestSerializer(serializers.Serializer):
    """Request schema for manual ingest trigger endpoints."""
    days = serializers.IntegerField(default=1, min_value=1, max_value=365)
    symbols = serializers.ListField(
        child=serializers.CharField(max_length=10),
        required=False,
        allow_empty=True,
    )

    def validate_symbols(self, value):
        if value and len(value) > 100:
            raise serializers.ValidationError('Maximum 100 symbols allowed')
        return value or None


class IngestTriggerResponseSerializer(serializers.Serializer):
    """Response schema for ingest trigger endpoints."""
    task_id = serializers.CharField()
    job_id = serializers.IntegerField(allow_null=True)
    service_run_log_id = serializers.IntegerField(allow_null=True, required=False)
    status = serializers.CharField()
    started_at = serializers.DateTimeField()
    message = serializers.CharField()
