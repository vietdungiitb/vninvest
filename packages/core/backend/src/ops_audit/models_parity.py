"""
ParityLog & ParityReport models for Phase 3 Shadow Run tracking.

Tracks parity between legacy backend and core-api responses during 3-day
shadow run verification phase. Used to compute daily parity_score and
determine go/no-go for production cutover.
"""

from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator


class ParityLog(models.Model):
    """
    Single request-pair log: captures legacy vs core response comparison.
    
    Created for EVERY request during Phase 3 shadow run.
    Used to compute daily aggregated parity_score.
    """
    
    PARITY_STATUS_CHOICES = [
        ('match', 'Match'),
        ('warning', 'Warning'),
        ('mismatch', 'Mismatch'),
        ('error', 'Error'),
    ]
    
    # Request identifiers
    x_request_id = models.CharField(
        max_length=255, 
        db_index=True, 
        help_text="Propagated X-Request-ID across legacy + core"
    )
    endpoint = models.CharField(
        max_length=255, 
        db_index=True,
        help_text="API endpoint path (e.g., /api/portfolios/)"
    )
    method = models.CharField(max_length=10, help_text="HTTP method (GET, POST, etc)")
    tenant_id = models.CharField(max_length=255, blank=True, help_text="Tenant ID for multi-tenant isolation")
    
    # Legacy backend response
    legacy_status = models.IntegerField(help_text="HTTP status from legacy backend")
    legacy_response_time_ms = models.FloatField(help_text="Response time in milliseconds")
    legacy_row_count = models.IntegerField(null=True, blank=True, help_text="Number of rows in legacy response")
    legacy_payload_hash = models.CharField(
        max_length=64, 
        help_text="SHA256 hash of response body"
    )
    
    # Core API response
    core_status = models.IntegerField(help_text="HTTP status from core API")
    core_response_time_ms = models.FloatField(help_text="Response time in milliseconds")
    core_row_count = models.IntegerField(null=True, blank=True, help_text="Number of rows in core response")
    core_payload_hash = models.CharField(
        max_length=64,
        help_text="SHA256 hash of response body"
    )
    
    # Comparison results
    parity_status = models.CharField(
        max_length=20,
        choices=PARITY_STATUS_CHOICES,
        help_text="match | warning | mismatch | error"
    )
    status_match = models.BooleanField(help_text="HTTP status codes match")
    structure_match = models.BooleanField(help_text="JSON structure match")
    row_count_match = models.BooleanField(help_text="Row counts match")
    payload_match = models.BooleanField(help_text="Payload hash match (exact data match)")
    latency_delta_ms = models.FloatField(help_text="core_response_time_ms - legacy_response_time_ms")
    
    # Scoring
    parity_score = models.FloatField(
        validators=[MinValueValidator(0.0), MaxValueValidator(1.0)],
        help_text="Parity score: 0.0 (complete mismatch) to 1.0 (perfect match)"
    )
    
    # Notes
    mismatch_reason = models.TextField(
        blank=True,
        help_text="Description of mismatch if parity_status != 'match'"
    )
    
    # Metadata
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    
    class Meta:
        db_table = 'ops_audit_parity_log'
        indexes = [
            models.Index(fields=['created_at', 'endpoint']),
            models.Index(fields=['parity_status', 'created_at']),
            models.Index(fields=['x_request_id']),
        ]
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.endpoint} {self.parity_status} ({self.parity_score:.2%})"


class ParityReport(models.Model):
    """
    Daily aggregated parity report for a single endpoint.
    
    Created once per day (EOD) by celery task shadow_run_daily_parity_report.
    Aggregates all ParityLog entries for that endpoint during the day.
    Used to determine daily go/no-go.
    """
    
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('computing', 'Computing'),
        ('complete', 'Complete'),
        ('error', 'Error'),
    ]
    
    RECOMMENDATION_CHOICES = [
        ('green', 'GREEN - Proceed to next day'),
        ('yellow', 'YELLOW - Extend shadow run 1 day'),
        ('red', 'RED - Abort, investigate, reschedule'),
    ]
    
    # Report identifiers
    endpoint = models.CharField(max_length=255, db_index=True)
    report_date = models.DateField(auto_now_add=True, db_index=True, help_text="Date of report (UTC)")
    
    # Aggregated metrics
    total_requests = models.IntegerField(help_text="Total request pairs logged")
    match_count = models.IntegerField(help_text="Requests with parity_status='match'")
    warning_count = models.IntegerField(help_text="Requests with parity_status='warning'")
    mismatch_count = models.IntegerField(help_text="Requests with parity_status='mismatch'")
    error_count = models.IntegerField(help_text="Requests with parity_status='error'")
    
    # Score metrics
    avg_parity_score = models.FloatField(
        validators=[MinValueValidator(0.0), MaxValueValidator(1.0)],
        help_text="Average parity_score across all requests"
    )
    min_parity_score = models.FloatField(
        validators=[MinValueValidator(0.0), MaxValueValidator(1.0)],
        help_text="Minimum parity_score for the day"
    )
    median_latency_delta_ms = models.FloatField(help_text="Median latency difference (core - legacy)")
    
    # Success criteria
    parity_pass = models.BooleanField(
        help_text="True if avg_parity_score >= 0.99"
    )
    
    # Recommendation
    recommendation = models.CharField(
        max_length=20,
        choices=RECOMMENDATION_CHOICES,
        default='pending',
        help_text="go/no-go recommendation based on parity metrics"
    )
    
    # Report status
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='pending',
        help_text="pending | computing | complete | error"
    )
    
    # Details
    critical_failures = models.JSONField(
        default=dict,
        help_text="Summary of critical failures (status code mismatch, etc)"
    )
    notes = models.TextField(
        blank=True,
        help_text="Free-text notes from report generator"
    )
    
    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'ops_audit_parity_report'
        indexes = [
            models.Index(fields=['report_date', 'endpoint']),
            models.Index(fields=['parity_pass']),
        ]
        ordering = ['-report_date', 'endpoint']
        unique_together = [('endpoint', 'report_date')]
    
    def __str__(self):
        rec = self.recommendation.split(' ')[0] if self.recommendation else '?'
        return f"{self.endpoint} {self.report_date} {rec} ({self.avg_parity_score:.2%})"


class ParityPhaseCheckpoint(models.Model):
    """
    Tracks Phase 3 overall progress across all 3 days.
    
    Used to determine when all 3 days are complete and whether
    parity >= 99% for all days (GREEN = proceed to Phase 4).
    """
    
    PHASE_STATUS_CHOICES = [
        ('pending', 'Pending - Waiting for day 1'),
        ('day1', 'Day 1 - In progress'),
        ('day1_complete', 'Day 1 - Complete'),
        ('day2', 'Day 2 - In progress'),
        ('day2_complete', 'Day 2 - Complete'),
        ('day3', 'Day 3 - In progress'),
        ('day3_complete', 'Day 3 - Complete'),
        ('review', 'Review phase - Awaiting sign-off'),
        ('complete', 'Complete - Ready for Phase 4'),
    ]
    
    FINAL_DECISION_CHOICES = [
        ('pending', 'Pending'),
        ('green', 'GREEN - Proceed to Phase 4'),
        ('red', 'RED - Extend or abort'),
    ]
    
    # Phase metadata
    phase_name = models.CharField(
        max_length=20,
        default='Phase 3',
        help_text="Phase identifier"
    )
    phase_status = models.CharField(
        max_length=20,
        choices=PHASE_STATUS_CHOICES,
        default='pending'
    )
    
    # 3-day tracking
    day1_date = models.DateField(null=True, blank=True, help_text="First trading day of shadow run")
    day2_date = models.DateField(null=True, blank=True)
    day3_date = models.DateField(null=True, blank=True, help_text="Third trading day of shadow run")
    
    # Parity results
    day1_parity_score = models.FloatField(
        null=True,
        blank=True,
        validators=[MinValueValidator(0.0), MaxValueValidator(1.0)]
    )
    day2_parity_score = models.FloatField(
        null=True,
        blank=True,
        validators=[MinValueValidator(0.0), MaxValueValidator(1.0)]
    )
    day3_parity_score = models.FloatField(
        null=True,
        blank=True,
        validators=[MinValueValidator(0.0), MaxValueValidator(1.0)]
    )
    
    # Final assessment
    all_days_complete = models.BooleanField(
        default=False,
        help_text="True when all 3 days have reports"
    )
    all_days_pass = models.BooleanField(
        default=False,
        help_text="True when all 3 days parity >= 99%"
    )
    
    final_decision = models.CharField(
        max_length=20,
        choices=FINAL_DECISION_CHOICES,
        default='pending',
        help_text="Final go/no-go for Phase 4"
    )
    tech_lead_sign_off = models.BooleanField(
        default=False,
        help_text="Tech Lead confirmation for Phase 4 cutover"
    )
    sign_off_date = models.DateTimeField(null=True, blank=True)
    sign_off_by = models.CharField(
        max_length=255,
        blank=True,
        help_text="Tech Lead username/email"
    )
    
    # Notes
    summary = models.TextField(
        blank=True,
        help_text="Executive summary of Phase 3 results"
    )
    
    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'ops_audit_parity_phase_checkpoint'
        ordering = ['-created_at']
    
    def __str__(self):
        return f"Phase 3 {self.phase_status}"
