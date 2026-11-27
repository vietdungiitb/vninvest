"""Kiểm tra toàn vẹn giá — chạy được trong CI và trên staging.

Exit code 0 khi sạch, CommandError (exit 1) khi có violation. Không ghi DB.
"""
import json
from decimal import Decimal

from django.core.management.base import BaseCommand, CommandError

from market_data.cafef.integrity import audit_rows, collect_rows


class Command(BaseCommand):
    help = 'Audit các bất biến giá; fail (exit 1) khi phát hiện vi phạm.'

    def add_arguments(self, parser):
        parser.add_argument('--since', type=str, default=None,
                            help='Chỉ quét ngày >= since (ISO).')
        parser.add_argument('--symbol', type=str, default=None)
        parser.add_argument('--limit', type=int, default=None)
        parser.add_argument('--min-coverage', type=Decimal, default=None)
        parser.add_argument('--json', action='store_true', dest='as_json')

    def handle(self, *args, **opts):
        rows = collect_rows(
            since=opts['since'], symbol=opts['symbol'], limit=opts['limit'],
        )
        report = audit_rows(rows, min_coverage=opts['min_coverage'])
        report['since'] = opts['since']
        if opts['as_json']:
            self.stdout.write(json.dumps(report, default=str))
        else:
            self.stdout.write(
                f"rows={report['rows']} cafef_rows={report['cafef_rows']} "
                f"violations={','.join(report['violations']) or 'none'}"
            )
        if not report['ok']:
            raise CommandError(
                'price_integrity:' + ','.join(report['violations'])
            )
        self.stdout.write(self.style.SUCCESS('price_integrity: ok'))
