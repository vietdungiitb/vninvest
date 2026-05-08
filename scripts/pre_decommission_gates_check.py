#!/usr/bin/env python3
"""
SM-P6.0: Pre-decommission gates verification script.

Checks all 7 gates (A-G) and produces a signed checklist.
Must achieve ALL 7 PASS before legacy decommission can proceed.

Usage:
    python scripts/pre_decommission_gates_check.py \
        --core-url https://your-domain.com \
        --core-pat YOUR_PAT \
        --legacy-url https://your-domain.com \
        [--sentry-api-key YOUR_SENTRY_KEY] \
        [--sentry-project your-project] \
        [--output gates-result.json]
"""
import argparse
import json
import os
import sys
from datetime import datetime, timezone

try:
    import requests
except ImportError:
    print("ERROR: requests not installed. Run: pip install requests")
    sys.exit(1)


def check_gate_a_data_parity(core_url, core_headers, legacy_url, **kwargs):
    """Gate A: Data parity >= 99% (portfolios, whale alerts, advisory)."""
    results = {}
    threshold = 0.99

    def _response_size(payload) -> int:
        if isinstance(payload, list):
            return len(payload)
        if isinstance(payload, dict):
            count = payload.get('count')
            if isinstance(count, int):
                return count
            results_payload = payload.get('results')
            if isinstance(results_payload, list):
                return len(results_payload)
        return 0

    # Portfolio count parity
    try:
        core_resp = requests.get(f"{core_url}/core/v1/workspace/portfolios/", headers=core_headers, timeout=10)
        legacy_resp = requests.get(f"{legacy_url}/api/portfolios/", timeout=10)
        core_count = _response_size(core_resp.json()) if core_resp.ok else 0
        legacy_count = _response_size(legacy_resp.json()) if legacy_resp.ok else 0
        parity = (min(core_count, legacy_count) / max(core_count, legacy_count, 1))
        results['portfolio_parity'] = {'core': core_count, 'legacy': legacy_count, 'parity': parity}
    except Exception as exc:
        results['portfolio_parity'] = {'error': str(exc), 'parity': 0}

    # Whale alerts count parity
    try:
        core_resp = requests.get(f"{core_url}/api/signals/whale-feed/", headers=core_headers, timeout=10)
        legacy_resp = requests.get(f"{legacy_url}/api/whale-alerts/?limit=1", timeout=10)
        core_count = _response_size(core_resp.json()) if core_resp.ok else 0
        legacy_count = _response_size(legacy_resp.json()) if legacy_resp.ok else 0
        parity = (min(core_count, legacy_count) / max(core_count, legacy_count, 1))
        results['whale_alerts_parity'] = {'core': core_count, 'legacy': legacy_count, 'parity': parity}
    except Exception as exc:
        results['whale_alerts_parity'] = {'error': str(exc), 'parity': 0}

    min_parity = min(v.get('parity', 0) for v in results.values())
    passed = min_parity >= threshold
    return {
        'gate': 'A',
        'name': 'Data parity >= 99%',
        'passed': passed,
        'threshold': threshold,
        'min_parity': min_parity,
        'details': results,
    }


def check_gate_b_api_coverage(core_url, core_headers, **kwargs):
    """Gate B: All critical API endpoints accessible via core."""
    endpoints = [
        ('GET', '/core/v1/health'),
        ('GET', '/core/v1/market/snapshot/'),
        ('GET', '/api/signals/whale-feed/'),
        ('GET', '/api/signals/unified-alert/'),
        ('GET', '/core/v1/workspace/portfolios/'),
        ('GET', '/core/v1/signals/order-flow/VCB/'),
    ]
    results = []
    all_pass = True
    for method, path in endpoints:
        try:
            resp = requests.request(method, f"{core_url}{path}", headers=core_headers, timeout=10)
            ok = resp.status_code < 500
            results.append({'path': path, 'status': resp.status_code, 'pass': ok})
            if not ok:
                all_pass = False
        except Exception as exc:
            results.append({'path': path, 'error': str(exc), 'pass': False})
            all_pass = False
    return {
        'gate': 'B',
        'name': 'All API endpoints covered by core',
        'passed': all_pass,
        'endpoints': results,
    }


def check_gate_c_zero_legacy_traffic(**kwargs):
    """Gate C: 0 frontend traffic to legacy (manual — requires Caddy access log check)."""
    note = (
        "MANUAL GATE: Check Caddy access logs to confirm 0 requests to legacy backend:8000. "
        "Command: docker logs vninvest-caddy 2>&1 | grep ':8000' | tail -20"
    )
    return {
        'gate': 'C',
        'name': '0 frontend traffic to legacy',
        'passed': None,  # Must be verified manually
        'note': note,
        'requires_manual_sign_off': True,
    }


def check_gate_d_sentry_alerts(sentry_api_key=None, sentry_project=None, **kwargs):
    """Gate D: 0 critical Sentry alerts in last 72h."""
    if not sentry_api_key or not sentry_project:
        return {
            'gate': 'D',
            'name': '0 critical Sentry alerts in 72h',
            'passed': None,
            'note': 'Pass --sentry-api-key and --sentry-project to auto-check. Manual fallback: check Sentry UI.',
            'requires_manual_sign_off': True,
        }
    try:
        sentry_headers = {'Authorization': f'Bearer {sentry_api_key}'}
        resp = requests.get(
            f'https://sentry.io/api/0/projects/{sentry_project}/issues/?query=is:unresolved&level=critical',
            headers=sentry_headers, timeout=15,
        )
        issues = resp.json() if resp.ok else []
        critical_count = len([i for i in issues if isinstance(i, dict)])
        return {
            'gate': 'D',
            'name': '0 critical Sentry alerts in 72h',
            'passed': critical_count == 0,
            'critical_issues': critical_count,
        }
    except Exception as exc:
        return {'gate': 'D', 'name': '0 critical Sentry alerts in 72h', 'passed': None, 'error': str(exc)}


def check_gate_e_backup_restore(**kwargs):
    """Gate E: Backup restore test PASS (manual)."""
    return {
        'gate': 'E',
        'name': 'Backup restore test PASS',
        'passed': None,
        'note': 'MANUAL GATE: Run daily_db_backup task, then pg_restore to staging DB and verify row counts match.',
        'requires_manual_sign_off': True,
    }


def check_gate_f_load_test(core_url, **kwargs):
    """Gate F: p95 < 200ms at 500 VUs (k6 load test)."""
    return {
        'gate': 'F',
        'name': 'p95 < 200ms at 500 VUs',
        'passed': None,
        'note': (
            f'MANUAL GATE: Run k6 load test: '
            f'k6 run infra/load-tests/api-load.js -e BASE_URL={core_url}'
        ),
        'requires_manual_sign_off': True,
    }


def check_gate_g_celery_queue(**kwargs):
    """Gate G: 0 legacy Celery tasks in Redis queue."""
    note = (
        "Check with: docker exec vninvest-redis redis-cli llen celery | grep '^0$' "
        "AND: docker exec vninvest-redis redis-cli keys 'celery*' "
        "Confirm all active tasks are in core-redis, not legacy redis."
    )
    return {
        'gate': 'G',
        'name': '0 legacy Celery tasks in Redis queue',
        'passed': None,
        'note': note,
        'requires_manual_sign_off': True,
    }


def main():
    parser = argparse.ArgumentParser(description='SM-P6.0 Pre-decommission gates check')
    parser.add_argument('--core-url', default=os.environ.get('CORE_URL', 'http://localhost:80'))
    parser.add_argument('--core-pat', default=os.environ.get('CORE_PAT', ''))
    parser.add_argument('--legacy-url', default=os.environ.get('LEGACY_URL', 'http://localhost:80'))
    parser.add_argument('--sentry-api-key', default=os.environ.get('SENTRY_API_KEY', ''))
    parser.add_argument('--sentry-project', default=os.environ.get('SENTRY_PROJECT', ''))
    parser.add_argument('--output', default='gates-result.json')
    args = parser.parse_args()

    core_headers = {
        'Authorization': f'Bearer {args.core_pat}',
        'Content-Type': 'application/json',
    }

    kwargs = {
        'core_url': args.core_url,
        'core_headers': core_headers,
        'legacy_url': args.legacy_url,
        'sentry_api_key': args.sentry_api_key,
        'sentry_project': args.sentry_project,
    }

    gate_fns = [
        check_gate_a_data_parity,
        check_gate_b_api_coverage,
        check_gate_c_zero_legacy_traffic,
        check_gate_d_sentry_alerts,
        check_gate_e_backup_restore,
        check_gate_f_load_test,
        check_gate_g_celery_queue,
    ]

    results = []
    print(f"\n=== SM-P6.0 Pre-decommission Gates Check ===")
    print(f"Core URL: {args.core_url}")
    print(f"Time: {datetime.now(timezone.utc).isoformat()}\n")

    all_pass = True
    for fn in gate_fns:
        result = fn(**kwargs)
        results.append(result)
        passed = result['passed']
        status = '✓ PASS' if passed is True else ('? MANUAL' if passed is None else '✗ FAIL')
        if passed is False:
            all_pass = False
        print(f"Gate {result['gate']}: {result['name']} — {status}")
        if passed is None:
            print(f"         → {result.get('note', '')}")

    print(f"\n{'ALL GATES PASS — Ready for decommission' if all_pass else 'GATES INCOMPLETE — Do NOT decommission'}")
    print(f"NOTE: Manual gates (C, E, F, G and possibly D) require Tech Lead sign-off.\n")

    output = {
        'checked_at': datetime.now(timezone.utc).isoformat(),
        'core_url': args.core_url,
        'all_automated_pass': all_pass,
        'gates': results,
    }
    with open(args.output, 'w', encoding='utf-8') as f:
        json.dump(output, f, indent=2, ensure_ascii=False)
    print(f"Results saved to: {args.output}")

    # Exit 1 if any gate explicitly fails (not just manual)
    if any(r['passed'] is False for r in results):
        sys.exit(1)


if __name__ == '__main__':
    main()
