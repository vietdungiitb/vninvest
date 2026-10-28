"""
Celery tasks for Phase 3 Shadow Run parity verification.

Key tasks:
1. shadow_run_parity_check_task: Perform dual-read from core-api, compare, log parity
2. shadow_run_daily_parity_report: Aggregate daily parity logs, compute score, recommend go/no-go
3. shadow_run_phase3_checkpoint: Track overall Phase 3 status across 3 days
"""

import hashlib
import json
import logging
import time
from typing import Any

import httpx
from celery import shared_task
from django.db import transaction
from django.db.models import Avg, Min

logger = logging.getLogger(__name__)


@shared_task(
    bind=True,
    max_retries=2,
    default_retry_delay=5,
    time_limit=30,  # Hard timeout
    soft_time_limit=25,
)
def shadow_run_parity_check_task(
    self,
    request_context: dict[str, Any],
    legacy_context: dict[str, Any],
    core_api_base: str,
    shadow_timeout_s: float = 5.0,
) -> dict[str, Any]:
    """
    Perform dual-read parity check: legacy response vs core API response.
    
    Flow:
    1. Extract x-request-id from request_context
    2. Make shadow request to core-api with same params
    3. Compare responses: status, structure, payload, latency
    4. Compute parity_score (0.0-1.0)
    5. Log to ParityLog table
    
    Args:
        request_context: {'method', 'path', 'query_string', 'headers', 'x_request_id'}
        legacy_context: {'status', 'elapsed_ms', 'payload'}
        core_api_base: Base URL for core-api (e.g., 'http://core-api:8000')
        shadow_timeout_s: Timeout for shadow request
    
    Returns:
        {'status': 'ok'|'retry'|'failed', 'parity_score': 0.0-1.0, 'log_id': ...}
    """
    
    x_request_id = request_context.get('x_request_id', '')
    method = request_context.get('method', 'GET')
    path = request_context.get('path', '')
    query_string = request_context.get('query_string', '')
    headers = request_context.get('headers', {})
    
    legacy_status = legacy_context.get('status', 0)
    legacy_elapsed_ms = legacy_context.get('elapsed_ms', 0)
    legacy_payload = legacy_context.get('payload', '')
    
    logger.info(f"Starting parity check: {x_request_id} {method} {path}")
    
    try:
        # 1. Make shadow request to core-api
        core_response_obj = _make_core_shadow_request(
            method=method,
            path=path,
            query_string=query_string,
            headers=headers,
            core_api_base=core_api_base,
            timeout_s=shadow_timeout_s,
            x_request_id=x_request_id,
        )
        
        if not core_response_obj:
            logger.warning(f"Core shadow request timed out or failed: {x_request_id}")
            return {
                'status': 'failed',
                'reason': 'core_request_timeout',
                'parity_score': 0.0,
            }
        
        core_status = core_response_obj['status']
        core_elapsed_ms = core_response_obj['elapsed_ms']
        core_payload = core_response_obj['payload']
        
        # 2. Compare responses
        comparison_result = _compare_responses(
            legacy_status=legacy_status,
            legacy_payload=legacy_payload,
            core_status=core_status,
            core_payload=core_payload,
            legacy_elapsed_ms=legacy_elapsed_ms,
            core_elapsed_ms=core_elapsed_ms,
        )
        
        # 3. Log to ParityLog
        from ops_audit.models import ParityLog
        
        parity_log = ParityLog.objects.create(
            x_request_id=x_request_id,
            endpoint=path,
            method=method,
            legacy_status=legacy_status,
            legacy_response_time_ms=legacy_elapsed_ms,
            legacy_row_count=comparison_result.get('legacy_row_count'),
            legacy_payload_hash=_compute_payload_hash(legacy_payload),
            core_status=core_status,
            core_response_time_ms=core_elapsed_ms,
            core_row_count=comparison_result.get('core_row_count'),
            core_payload_hash=_compute_payload_hash(core_payload),
            parity_status=comparison_result['parity_status'],
            status_match=comparison_result['status_match'],
            structure_match=comparison_result['structure_match'],
            row_count_match=comparison_result.get('row_count_match', True),
            payload_match=comparison_result['payload_match'],
            latency_delta_ms=comparison_result['latency_delta_ms'],
            parity_score=comparison_result['parity_score'],
            mismatch_reason=comparison_result.get('mismatch_reason', ''),
        )
        
        logger.info(
            f"Parity check complete: {x_request_id} "
            f"score={comparison_result['parity_score']:.2%} status={parity_log.parity_status}"
        )
        
        return {
            'status': 'ok',
            'parity_score': comparison_result['parity_score'],
            'log_id': parity_log.id,
        }
    
    except Exception as e:
        logger.error(f"Parity check failed: {e}", exc_info=True)
        
        # Retry once on transient errors
        if self.request.retries < self.max_retries:
            raise self.retry(exc=e)
        
        return {
            'status': 'failed',
            'reason': str(e),
            'parity_score': 0.0,
        }


@shared_task(
    time_limit=60,
    soft_time_limit=55,
)
def shadow_run_daily_parity_report() -> dict[str, Any]:
    """
    EOD task: Aggregate daily parity logs and generate ParityReport.
    
    Runs at 2:30 AM UTC daily (after trading close + 30min buffer).
    
    Flow:
    1. Query all ParityLog entries for today
    2. Group by endpoint
    3. For each endpoint: compute avg/min parity_score, match/error counts
    4. Create ParityReport entry
    5. Recommend go/no-go based on parity >= 99%
    
    Returns:
        {'status': 'ok'|'error', 'reports_created': N, 'green_count': N, 'yellow_count': N, 'red_count': N}
    """
    
    from ops_audit.models import ParityLog, ParityReport
    from django.utils import timezone
    
    logger.info("Starting daily parity report generation")
    
    try:
        today = timezone.now().date()
        
        # 1. Query all parity logs from today
        today_logs = ParityLog.objects.filter(
            created_at__date=today
        )
        
        if not today_logs.exists():
            logger.info(f"No parity logs for {today}, skipping report")
            return {
                'status': 'ok',
                'reports_created': 0,
                'reason': 'no_logs_today',
            }
        
        # 2. Group by endpoint and aggregate
        endpoints = today_logs.values_list('endpoint', flat=True).distinct()
        
        reports_created = 0
        green_count = 0
        yellow_count = 0
        red_count = 0
        
        for endpoint in endpoints:
            endpoint_logs = today_logs.filter(endpoint=endpoint)
            
            # Compute metrics
            total_requests = endpoint_logs.count()
            match_count = endpoint_logs.filter(parity_status='match').count()
            warning_count = endpoint_logs.filter(parity_status='warning').count()
            mismatch_count = endpoint_logs.filter(parity_status='mismatch').count()
            error_count = endpoint_logs.filter(parity_status='error').count()
            
            avg_parity = endpoint_logs.aggregate(Avg('parity_score'))['parity_score__avg'] or 0.0
            min_parity = endpoint_logs.aggregate(Min('parity_score'))['parity_score__min'] or 0.0
            
            latencies = list(endpoint_logs.values_list('latency_delta_ms', flat=True))
            latencies_sorted = sorted(latencies)
            median_latency = latencies_sorted[len(latencies) // 2] if latencies else 0.0
            
            # Determine parity_pass (>= 99%)
            parity_pass = avg_parity >= 0.99
            
            # Recommend go/no-go
            if avg_parity >= 0.99:
                recommendation = 'green'
                green_count += 1
            elif avg_parity >= 0.95:
                recommendation = 'yellow'
                yellow_count += 1
            else:
                recommendation = 'red'
                red_count += 1
            
            # Identify critical failures
            critical_failures = {}
            status_mismatches = endpoint_logs.filter(status_match=False).count()
            if status_mismatches > 0:
                critical_failures['status_mismatch_count'] = status_mismatches
            
            structure_mismatches = endpoint_logs.filter(structure_match=False).count()
            if structure_mismatches > 0:
                critical_failures['structure_mismatch_count'] = structure_mismatches
            
            # 3. Create ParityReport entry
            with transaction.atomic():
                report, created = ParityReport.objects.update_or_create(
                    endpoint=endpoint,
                    report_date=today,
                    defaults={
                        'total_requests': total_requests,
                        'match_count': match_count,
                        'warning_count': warning_count,
                        'mismatch_count': mismatch_count,
                        'error_count': error_count,
                        'avg_parity_score': float(avg_parity),
                        'min_parity_score': float(min_parity),
                        'median_latency_delta_ms': float(median_latency),
                        'parity_pass': parity_pass,
                        'recommendation': recommendation,
                        'status': 'complete',
                        'critical_failures': critical_failures,
                        'notes': f"Generated {total_requests} requests, "
                                f"{match_count} match, {warning_count} warning, "
                                f"{mismatch_count} mismatch, {error_count} error",
                    }
                )
            
            reports_created += 1
            logger.info(
                f"Report created: {endpoint} {today} score={avg_parity:.2%} rec={recommendation}"
            )
        
        logger.info(
            f"Daily parity reports complete: {reports_created} reports, "
            f"{green_count} GREEN, {yellow_count} YELLOW, {red_count} RED"
        )
        
        return {
            'status': 'ok',
            'reports_created': reports_created,
            'green_count': green_count,
            'yellow_count': yellow_count,
            'red_count': red_count,
        }
    
    except Exception as e:
        logger.error(f"Daily parity report failed: {e}", exc_info=True)
        return {
            'status': 'error',
            'reason': str(e),
        }


# Helper functions


def _make_core_shadow_request(
    method: str,
    path: str,
    query_string: str,
    headers: dict[str, str],
    core_api_base: str,
    timeout_s: float,
    x_request_id: str,
) -> dict[str, Any] | None:
    """
    Make HTTP request to core-api with same parameters as legacy request.
    
    Returns:
        {'status': int, 'elapsed_ms': float, 'payload': str} or None on timeout
    """
    
    try:
        url = f"{core_api_base}{path}"
        if query_string:
            url += f"?{query_string}"
        
        # Prepare headers
        request_headers = dict(headers)
        request_headers['X-Request-ID'] = x_request_id
        request_headers['X-Shadow-Run'] = 'true'  # Mark as shadow request
        
        # Make request
        start_time = time.time()
        with httpx.Client(timeout=timeout_s) as client:
            response = client.request(
                method=method,
                url=url,
                headers=request_headers,
            )
        elapsed_ms = (time.time() - start_time) * 1000
        
        return {
            'status': response.status_code,
            'elapsed_ms': elapsed_ms,
            'payload': response.text,
        }
    
    except httpx.TimeoutException:
        logger.warning(f"Core shadow request timeout: {x_request_id} {path}")
        return None
    except Exception as e:
        logger.error(f"Core shadow request failed: {e}")
        return None


def _compare_responses(
    legacy_status: int,
    legacy_payload: str,
    core_status: int,
    core_payload: str,
    legacy_elapsed_ms: float,
    core_elapsed_ms: float,
) -> dict[str, Any]:
    """
    Compare legacy vs core response and compute parity score.
    
    Returns:
        {
            'parity_status': 'match'|'warning'|'mismatch'|'error',
            'status_match': bool,
            'structure_match': bool,
            'row_count_match': bool,
            'payload_match': bool,
            'latency_delta_ms': float,
            'parity_score': 0.0-1.0,
            'mismatch_reason': str,
            'legacy_row_count': int | None,
            'core_row_count': int | None,
        }
    """
    
    result = {
        'status_match': legacy_status == core_status,
        'parity_status': 'match',
        'mismatch_reason': '',
    }
    
    # Check status codes
    if not result['status_match']:
        result['parity_status'] = 'error'
        result['mismatch_reason'] = f"Status mismatch: legacy={legacy_status}, core={core_status}"
        result['parity_score'] = 0.0
        result['structure_match'] = False
        result['row_count_match'] = False
        result['payload_match'] = False
        result['latency_delta_ms'] = core_elapsed_ms - legacy_elapsed_ms
        return result
    
    # Check payload match
    legacy_hash = _compute_payload_hash(legacy_payload)
    core_hash = _compute_payload_hash(core_payload)
    result['payload_match'] = legacy_hash == core_hash
    
    # Check JSON structure
    result['structure_match'] = _compare_json_structure(legacy_payload, core_payload)
    
    # Try to extract row counts from JSON
    legacy_row_count = _extract_row_count(legacy_payload)
    core_row_count = _extract_row_count(core_payload)
    result['legacy_row_count'] = legacy_row_count
    result['core_row_count'] = core_row_count
    result['row_count_match'] = legacy_row_count == core_row_count if legacy_row_count else True
    
    # Calculate latency delta
    result['latency_delta_ms'] = core_elapsed_ms - legacy_elapsed_ms
    
    # Compute parity score (0.0-1.0)
    score_components = []
    score_components.append(1.0 if result['status_match'] else 0.0)  # Status: 25%
    score_components.append(1.0 if result['structure_match'] else 0.5)  # Structure: 25%
    score_components.append(1.0 if result['payload_match'] else 0.0)  # Payload: 25%
    score_components.append(1.0 if abs(result['latency_delta_ms']) < 500 else 0.5)  # Latency: 25%
    
    result['parity_score'] = sum(score_components) / len(score_components)
    
    # Determine parity_status
    if result['parity_score'] == 1.0:
        result['parity_status'] = 'match'
    elif result['parity_score'] >= 0.8:
        result['parity_status'] = 'warning'
        result['mismatch_reason'] = "Partial match detected"
    elif result['parity_score'] >= 0.5:
        result['parity_status'] = 'mismatch'
        result['mismatch_reason'] = "Significant difference detected"
    else:
        result['parity_status'] = 'error'
        result['mismatch_reason'] = "Complete mismatch"
    
    return result


def _compute_payload_hash(payload: str) -> str:
    """Compute SHA256 hash of payload."""
    return hashlib.sha256(payload.encode('utf-8')).hexdigest()


def _compare_json_structure(legacy_payload: str, core_payload: str) -> bool:
    """Compare JSON structure without comparing values."""
    try:
        legacy_obj = json.loads(legacy_payload)
        core_obj = json.loads(core_payload)
        return _compare_structure_recursive(legacy_obj, core_obj)
    except json.JSONDecodeError:
        return False


def _compare_structure_recursive(obj1, obj2) -> bool:
    """Recursively compare JSON structure."""
    if type(obj1) != type(obj2):
        return False
    
    if isinstance(obj1, dict):
        if set(obj1.keys()) != set(obj2.keys()):
            return False
        return all(_compare_structure_recursive(obj1[k], obj2[k]) for k in obj1.keys())
    
    if isinstance(obj1, list):
        if len(obj1) != len(obj2):
            return False
        return all(_compare_structure_recursive(obj1[i], obj2[i]) for i in range(len(obj1)))
    
    return True


def _extract_row_count(payload: str) -> int | None:
    """Extract row count from JSON response (for list endpoints)."""
    try:
        obj = json.loads(payload)
        
        # Try common patterns
        if isinstance(obj, dict):
            # Pattern 1: {'count': N, 'results': [...]}
            if 'count' in obj:
                return int(obj['count'])
            # Pattern 2: {'results': [...]}
            if 'results' in obj and isinstance(obj['results'], list):
                return len(obj['results'])
            # Pattern 3: Direct list
            if isinstance(obj, list):
                return len(obj)
        elif isinstance(obj, list):
            return len(obj)
        
        return None
    except (json.JSONDecodeError, ValueError, TypeError) as e:
        logger.debug('_extract_row_count: failed to parse payload: %s', e)
        return None
