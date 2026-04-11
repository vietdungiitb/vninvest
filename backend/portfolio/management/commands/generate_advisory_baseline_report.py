import json
from pathlib import Path

from django.contrib.auth.models import User
from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from portfolio.models import AdvisoryAggregateAuditLog
from portfolio.observability import generate_advisory_baseline_report


class Command(BaseCommand):
    help = 'Generate Holistic Advisory baseline metrics report from AdvisoryAggregateAuditLog samples.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--username',
            required=True,
            help='Username to generate baseline report for.',
        )
        parser.add_argument(
            '--symbol',
            default='',
            help='Optional symbol filter. If omitted, aggregate all symbols for the user.',
        )
        parser.add_argument(
            '--days',
            type=int,
            default=30,
            help='Look back N days for audit-log samples (default: 30).',
        )
        parser.add_argument(
            '--limit',
            type=int,
            default=200,
            help='Maximum number of samples to include (default: 200).',
        )
        parser.add_argument(
            '--output',
            default='',
            help='Optional path to write the JSON report.',
        )

    def handle(self, *args, **options):
        username = str(options.get('username') or '').strip()
        symbol = str(options.get('symbol') or '').strip().upper()
        days = max(int(options.get('days') or 0), 1)
        limit = max(int(options.get('limit') or 0), 1)
        output = str(options.get('output') or '').strip()

        try:
            user = User.objects.get(username=username)
        except User.DoesNotExist as exc:
            raise CommandError(f'User not found: {username}') from exc

        cutoff = timezone.now() - timezone.timedelta(days=days)
        audit_qs = AdvisoryAggregateAuditLog.objects.filter(
            user=user,
            created_at__gte=cutoff,
        ).order_by('-created_at')
        if symbol:
            audit_qs = audit_qs.filter(symbol=symbol)

        logs = list(audit_qs[:limit])
        metrics_samples = []
        sampled_symbols = set()
        for log in logs:
            metadata = log.metadata_json or {}
            if not isinstance(metadata, dict):
                continue
            if 'latency_ms' not in metadata and 'token_cost' not in metadata:
                continue
            metrics_samples.append(metadata)
            sampled_symbols.add(log.symbol)

        if not metrics_samples:
            raise CommandError(
                f'No advisory metrics samples found for username={username} '
                f'symbol={symbol or "ALL"} days={days} limit={limit}'
            )

        report_symbol = symbol or 'ALL'
        report = generate_advisory_baseline_report(user, report_symbol, metrics_samples)
        report['source'] = {
            'username': username,
            'symbol_filter': symbol or None,
            'days': days,
            'limit': limit,
            'sampled_symbols': sorted(sampled_symbols),
            'audit_log_rows_scanned': len(logs),
            'metrics_samples_used': len(metrics_samples),
        }

        rendered = json.dumps(report, ensure_ascii=False, indent=2)
        if output:
            output_path = Path(output)
            output_path.parent.mkdir(parents=True, exist_ok=True)
            output_path.write_text(rendered, encoding='utf-8')
            self.stdout.write(self.style.SUCCESS(f'Baseline report written to {output_path}'))
        else:
            self.stdout.write(rendered)
