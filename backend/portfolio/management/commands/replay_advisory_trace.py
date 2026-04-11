import json
from pathlib import Path
from typing import Any

from django.contrib.auth.models import User
from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from portfolio.models import AdvisoryAggregateAuditLog, AdvisoryAggregateSnapshot, WhaleAdvisory


def _safe_int(value: Any) -> int | None:
    try:
        if value is None:
            return None
        return int(value)
    except Exception:
        return None


def _matches_trace(log: AdvisoryAggregateAuditLog, advisory_id: int | None, snapshot_id: int | None) -> bool:
    before_state = log.before_state_json or {}
    after_state = log.after_state_json or {}
    metadata = log.metadata_json or {}

    candidates = {
        _safe_int(before_state.get('advisory_id')),
        _safe_int(after_state.get('advisory_id')),
        _safe_int(metadata.get('advisory_id')),
    }
    snapshot_candidates = {
        _safe_int(before_state.get('snapshot_id')),
        _safe_int(after_state.get('snapshot_id')),
        _safe_int(metadata.get('snapshot_id')),
    }

    advisory_match = advisory_id is None or advisory_id in candidates
    snapshot_match = snapshot_id is None or snapshot_id in snapshot_candidates
    return advisory_match and snapshot_match


class Command(BaseCommand):
    help = 'Replay advisory decision trace by advisory_id or snapshot_id.'

    def add_arguments(self, parser):
        parser.add_argument('--advisory-id', type=int, default=0, help='WhaleAdvisory id to replay.')
        parser.add_argument('--snapshot-id', type=int, default=0, help='AdvisoryAggregateSnapshot id to replay.')
        parser.add_argument('--username', default='', help='Optional username guardrail.')
        parser.add_argument('--symbol', default='', help='Optional symbol guardrail.')
        parser.add_argument('--max-logs', type=int, default=30, help='Max matched audit logs in output (default: 30).')
        parser.add_argument('--output', default='', help='Optional output JSON path.')

    def handle(self, *args, **options):
        advisory_id = int(options.get('advisory_id') or 0) or None
        snapshot_id = int(options.get('snapshot_id') or 0) or None
        username = str(options.get('username') or '').strip()
        symbol_guard = str(options.get('symbol') or '').strip().upper()
        max_logs = max(int(options.get('max_logs') or 0), 1)
        output = str(options.get('output') or '').strip()

        if advisory_id is None and snapshot_id is None:
            raise CommandError('Provide at least one of --advisory-id or --snapshot-id.')

        advisory = None
        snapshot = None

        if advisory_id is not None:
            try:
                advisory = WhaleAdvisory.objects.select_related('user', 'aggregate_snapshot').get(pk=advisory_id)
            except WhaleAdvisory.DoesNotExist as exc:
                raise CommandError(f'WhaleAdvisory not found: {advisory_id}') from exc
            snapshot = advisory.aggregate_snapshot
            if snapshot is not None and snapshot_id is None:
                snapshot_id = snapshot.id

        if snapshot_id is not None and snapshot is None:
            try:
                snapshot = AdvisoryAggregateSnapshot.objects.select_related('user').get(pk=snapshot_id)
            except AdvisoryAggregateSnapshot.DoesNotExist as exc:
                raise CommandError(f'AdvisoryAggregateSnapshot not found: {snapshot_id}') from exc

        if advisory is None and snapshot is not None:
            advisory = (
                WhaleAdvisory.objects.select_related('user')
                .filter(aggregate_snapshot=snapshot)
                .order_by('-created_at')
                .first()
            )
            if advisory is not None and advisory_id is None:
                advisory_id = advisory.id

        owner = None
        if advisory is not None and advisory.user_id is not None:
            owner = advisory.user
        elif snapshot is not None:
            owner = snapshot.user

        if owner is None:
            raise CommandError('Trace owner cannot be resolved (missing user linkage).')

        if username:
            try:
                expected_user = User.objects.get(username=username)
            except User.DoesNotExist as exc:
                raise CommandError(f'User not found: {username}') from exc
            if expected_user.id != owner.id:
                raise CommandError(
                    f'Username mismatch: requested={username} trace_owner={owner.username}'
                )

        trace_symbol = ''
        if advisory is not None:
            trace_symbol = str(advisory.symbol or '').strip().upper()
        elif snapshot is not None:
            trace_symbol = str(snapshot.symbol or '').strip().upper()

        if symbol_guard and symbol_guard != trace_symbol:
            raise CommandError(f'Symbol mismatch: requested={symbol_guard} trace_symbol={trace_symbol}')

        logs_qs = AdvisoryAggregateAuditLog.objects.filter(user=owner, symbol=trace_symbol).order_by('-created_at')
        matched_logs = []
        for log in logs_qs.iterator():
            if _matches_trace(log, advisory_id=advisory_id, snapshot_id=snapshot_id):
                matched_logs.append(log)
                if len(matched_logs) >= max_logs:
                    break

        report = {
            'generated_at': timezone.now().isoformat(),
            'trace': {
                'user': owner.username,
                'symbol': trace_symbol,
                'advisory_id': advisory_id,
                'snapshot_id': snapshot_id,
                'replay_ready': bool(snapshot_id),
            },
            'advisory': {
                'id': advisory.id if advisory else None,
                'created_at': advisory.created_at.isoformat() if advisory and advisory.created_at else None,
                'source': advisory.source if advisory else '',
                'severity': advisory.severity if advisory else '',
                'threshold': float(advisory.threshold or 0) if advisory else 0.0,
                'aggregate_snapshot_id': advisory.aggregate_snapshot_id if advisory else None,
            },
            'snapshot': {
                'id': snapshot.id if snapshot else None,
                'snapshot_seq': snapshot.snapshot_seq if snapshot else None,
                'created_at': snapshot.created_at.isoformat() if snapshot and snapshot.created_at else None,
                'expires_at': snapshot.expires_at.isoformat() if snapshot and snapshot.expires_at else None,
                'state_json': snapshot.state_json if snapshot else {},
            },
            'audit_logs': [
                {
                    'id': log.id,
                    'created_at': log.created_at.isoformat() if log.created_at else None,
                    'reason': log.reason,
                    'actor': log.actor,
                    'actor_id': log.actor_id,
                    'before_state_json': log.before_state_json,
                    'after_state_json': log.after_state_json,
                    'metadata_json': log.metadata_json,
                }
                for log in matched_logs
            ],
            'counts': {
                'matched_audit_logs': len(matched_logs),
                'max_logs': max_logs,
            },
        }

        rendered = json.dumps(report, ensure_ascii=False, indent=2)
        if output:
            output_path = Path(output)
            output_path.parent.mkdir(parents=True, exist_ok=True)
            output_path.write_text(rendered, encoding='utf-8')
            self.stdout.write(self.style.SUCCESS(f'Replay trace written to {output_path}'))
        else:
            self.stdout.write(rendered)
