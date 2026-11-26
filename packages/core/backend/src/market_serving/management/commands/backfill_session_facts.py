"""Backfill SessionFacts/SessionFactsBucket lịch sử từ WhaleAlertCanonical (SSOT)."""

import datetime as dt

from django.core.management.base import BaseCommand, CommandError

from market_serving.session_facts_engine import compute_session_facts_for_all_active


class Command(BaseCommand):
    help = 'Backfill 1D history cho SessionFactsBucket (dry-run mặc định).'

    def add_arguments(self, parser):
        parser.add_argument('--symbol', required=True)
        parser.add_argument('--from', dest='from_date', required=True)
        parser.add_argument('--to', dest='to_date', required=True)
        parser.add_argument('--apply', action='store_true', dest='apply')

    def handle(self, *args, **opts):
        try:
            start = dt.date.fromisoformat(opts['from_date'])
            end = dt.date.fromisoformat(opts['to_date'])
        except ValueError as exc:
            raise CommandError(f'invalid date: {exc}')
        if start > end:
            raise CommandError('--from must be <= --to')

        dry = not opts['apply']
        total_upserted = 0
        last_day = None
        day = start
        while day <= end:
            if dry:
                self.stdout.write(f'DRYRUN {day} {opts["symbol"]}')
            else:
                result = compute_session_facts_for_all_active(
                    session_date=day, symbol=opts['symbol'], refresh_coverage=False,
                )
                if result.get('status') != 'ok':
                    self.stderr.write(f'PARTIAL {day}: {result}')
                total_upserted += int(result.get('upserted', 0))
                if result.get('upserted', 0):
                    last_day = day
                self.stdout.write(f'APPLY {day}: upserted={result.get("upserted", 0)}')
            day += dt.timedelta(days=1)

        if not dry and last_day is not None:
            from market_data.global_symbol_coverage import refresh_global_symbol_coverage
            refresh_global_symbol_coverage(opts['symbol'], reference_trade_date=last_day)
            self.stdout.write(f'coverage refreshed once at {last_day}')

        self.stdout.write(
            self.style.SUCCESS(f'done symbol={opts["symbol"]} dry={dry} upserted={total_upserted}')
        )
