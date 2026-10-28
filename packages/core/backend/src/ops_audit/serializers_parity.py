"""
Serializers for Phase 3 Shadow Run parity models.
"""

from rest_framework import serializers

from ops_audit.models import (
    ParityLog,
    ParityPhaseCheckpoint,
    ParityReport,
)


class ParityLogSerializer(serializers.ModelSerializer):
    """Serializer for ParityLog entries."""
    
    class Meta:
        model = ParityLog
        fields = [
            'id',
            'x_request_id',
            'endpoint',
            'method',
            'legacy_status',
            'legacy_response_time_ms',
            'legacy_row_count',
            'legacy_payload_hash',
            'core_status',
            'core_response_time_ms',
            'core_row_count',
            'core_payload_hash',
            'parity_status',
            'status_match',
            'structure_match',
            'row_count_match',
            'payload_match',
            'latency_delta_ms',
            'parity_score',
            'mismatch_reason',
            'created_at',
        ]
        read_only_fields = [
            'id',
            'created_at',
        ]


class ParityReportSerializer(serializers.ModelSerializer):
    """Serializer for daily ParityReport entries."""
    
    class Meta:
        model = ParityReport
        fields = [
            'id',
            'endpoint',
            'report_date',
            'total_requests',
            'match_count',
            'warning_count',
            'mismatch_count',
            'error_count',
            'avg_parity_score',
            'min_parity_score',
            'median_latency_delta_ms',
            'parity_pass',
            'recommendation',
            'status',
            'critical_failures',
            'notes',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'id',
            'created_at',
            'updated_at',
        ]


class ParityPhaseCheckpointSerializer(serializers.ModelSerializer):
    """Serializer for Phase 3 checkpoint tracking."""
    
    class Meta:
        model = ParityPhaseCheckpoint
        fields = [
            'id',
            'phase_name',
            'phase_status',
            'day1_date',
            'day2_date',
            'day3_date',
            'day1_parity_score',
            'day2_parity_score',
            'day3_parity_score',
            'all_days_complete',
            'all_days_pass',
            'final_decision',
            'tech_lead_sign_off',
            'sign_off_date',
            'sign_off_by',
            'summary',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'id',
            'created_at',
            'updated_at',
        ]
