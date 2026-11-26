"""Idempotent backfill of historical SessionFacts & SessionFactsBucket rows."""
from datetime import date, timedelta

from django.core.management.base import BaseCommand, CommandError
from django.utils.dateparse import parse_date
from django.utils.timezone import localdate

from market_serving.session_facts_engine import compute_session_facts_for_all_active


class Command(BaseCommand):
    help = 'Backfill SessionFacts and SessionFactsBucket (5m..1D) from historical WhaleAlertCanonical rows.'

    def add_arguments(self, parser):
        parser.add_argument('--symbol', type=str, default=None, help='Optional single symbol to backfill.')
        parser.add_argument('--from-date', type=str, default=None, help='Inclusive start date (YYYY-MM-DD).')
        parser.add_argument('--to-date', type=str, default=None, help='Inclusive end date (YYYY-MM-DD).')
        parser.add_argument('--days', type=int, default=None, help='Lookback days from today when --from-date is omitted.')
        parser.add_argument('--dry-run', action='store_true', help='Print target session dates without writing.')

    def handle(self, *args, **options):
        from signal_intelligence.models import WhaleAlertCanonical

        symbol = str(options.get('symbol') or '').strip().upper() or None
        raw_from = options.get('from_date')
        raw_to = options.get('to_date')
        days = options.get('days')
        dry_run = bool(options.get('dry_run'))

        from_date: date | None = None
        to_date: date | None = None
        if raw_from:
            from_date = parse_date(str(raw_from).strip())
            if from_date is None:
                raise CommandError(f'Invalid --from-date: {raw_from}')
        elif days is not None:
            if days < 0:
                raise CommandError('--days must be non-negative')
            from_date = localdate() - timedelta(days=int(days))

        if raw_to:
            to_date = parse_date(str(raw_to).strip())
            if to_date is None:
                raise CommandError(f'Invalid --to-date: {raw_to}')

        qs = WhaleAlertCanonical.objects.filter(alert__source_ref__startswith='whale_tick:')
        if symbol is not None:
            qs = qs.filter(symbol=symbol)
        if from_date is not None:
            qs = qs.filter(session_date__gte=from_date)
        if to_date is not None:
            qs = qs.filter(session_date__lte=to_date)

        session_dates = list(
            qs.order_by('session_date').values_list('session_date', flat=True).distinct()
        )
        if not session_dates:
            self.stdout.write('backfill_session_facts_buckets: 0 session dates matched.')
            return

        if dry_run:
            self.stdout.write(
                f'backfill_session_facts_buckets [dry-run]: dates={len(session_dates)} '
                f'from={session_dates[0].isoformat()} to={session_dates[-1].isoformat()} symbol={symbol or "ALL"}'
            )
            return

        total_upserted = 0
        total_skipped = 0
        total_errors = 0
        total_dates = len(session_dates)
        for idx, target_date in enumerate(session_dates):
            summary = compute_session_facts_for_all_active(
                session_date=target_date,
                symbol=symbol,
                refresh_coverage=(idx == total_dates - 1),
            )
            total_upserted += int(summary.get('upserted') or 0)
            total_skipped += int(summary.get('skipped') or 0)
            total_errors += int(summary.get('errors') or 0)

        self.stdout.write(
            f'backfill_session_facts_buckets: dates={total_dates} upserted={total_upserted} '
            f'skipped={total_skipped} errors={total_errors}'
        )
        if total_errors > 0:
            raise CommandError(f'backfill_session_facts_buckets finished with {total_errors} error(s).')
