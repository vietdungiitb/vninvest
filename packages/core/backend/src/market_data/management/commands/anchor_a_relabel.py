"""Anchor A (Owner D-08): gom toan chuỗi của 963 mã về MỘT basis fallback.

Ops command — KHÔNG phải Django migration. Bảng backup là artifact vận hành,
tạo bằng DDL trong lệnh này; rollback bằng SQL in ra từ --rollback-sql.
"""
from datetime import date, datetime
from decimal import Decimal

from django.core.management.base import BaseCommand, CommandError
from django.db import connection, transaction
from django.db.models import F
from django.utils.timezone import now

from market_data.models import DailyPrice

BACKUP_TABLE = 'market_data_anchora_backup_20261128'
FIELDS = (
    'price_source', 'adj_close', 'adj_factor',
    'is_adjusted', 'adj_as_of', 'adj_version',
)
EXPECTED_SYMBOLS = 963
EXPECTED_ROWS = 2_652_748


def target_symbols():
    return list(
        DailyPrice.objects.filter(
            date__gte='2026-01-01', price_source='unmapped_cafef',
        ).order_by().values_list('symbol', flat=True).distinct()
    )


def build_relabel_plan(rows, now_value=None):
    """Trả (rows_sẽ_ghi, skip_count). Row có adj_close sẵn KHÔNG bị đụng."""
    updates, skips = [], 0
    stamp = now_value or now()
    for row in rows:
        if row.adj_close is not None:
            skips += 1
            continue
        row.price_source = 'vnbroker_fallback'
        row.adj_close = row.close
        row.adj_factor = Decimal('1')
        row.is_adjusted = True
        row.adj_as_of = stamp
        row.adj_version = F('adj_version') + 1
        updates.append(row)
    return updates, skips


def iter_keyset_batches(qs, batch: int = 5000):
    """Duyệt theo id, không nạp toàn bảng vào RAM (apply 2,65M dòng)."""
    last = 0
    while True:
        chunk = list(qs.filter(id__gt=last).order_by('id')[:batch])
        if not chunk:
            break
        yield chunk
        last = chunk[-1].id


def _backup_exists():
    with connection.cursor() as cur:
        cur.execute(
            "SELECT 1 FROM information_schema.tables "
            "WHERE table_name = %s", [BACKUP_TABLE],
        )
        return cur.fetchone() is not None


def _backup_count():
    with connection.cursor() as cur:
        cur.execute(f'SELECT COUNT(*) FROM {BACKUP_TABLE}')
        return cur.fetchone()[0]


class Command(BaseCommand):
    help = 'Anchor A: relabel toàn chuỗi 963 mã sang vnbroker_fallback (có backup).'

    def add_arguments(self, parser):
        parser.add_argument('--dry-run', action='store_true')
        parser.add_argument('--backup', action='store_true')
        parser.add_argument('--apply', action='store_true')
        parser.add_argument('--rollback-sql', action='store_true')
        parser.add_argument('--limit', type=int, default=0,
                            help='Giới hạn symbol khi chạy thử trên DB riêng.')

    def handle(self, *args, **opts):
        symbols = target_symbols()
        if opts['limit']:
            symbols = symbols[:opts['limit']]
        qs = DailyPrice.objects.filter(symbol__in=symbols)
        total = qs.count()
        self.stdout.write(
            f'symbols={len(symbols)} rows={total} '
            f'(full expected {EXPECTED_SYMBOLS}/{EXPECTED_ROWS})'
        )

        if opts['rollback_sql']:
            self.stdout.write(
                f'UPDATE market_data_dailyprice d SET '
                f'price_source=b.price_source, adj_close=b.adj_close, '
                f'adj_factor=b.adj_factor, is_adjusted=b.is_adjusted, '
                f'adj_as_of=b.adj_as_of, adj_version=b.adj_version '
                f'FROM {BACKUP_TABLE} b WHERE d.id=b.id;'
            )
            return

        if opts['backup']:
            if _backup_exists():
                raise CommandError(f'backup {BACKUP_TABLE} already exists — refuse to overwrite')
            with connection.cursor() as cur:
                cur.execute(
                    f'CREATE TABLE {BACKUP_TABLE} AS '
                    f'SELECT d.id, d.price_source, d.adj_close, d.adj_factor, '
                    f'd.is_adjusted, d.adj_as_of, d.adj_version '
                    f'FROM market_data_dailyprice d '
                    f'WHERE d.symbol IN %s', [tuple(symbols)],
                )
            self.stdout.write(self.style.SUCCESS(f'backup rows={_backup_count()}'))
            return

        if opts['apply']:
            if not _backup_exists():
                raise CommandError(f'backup {BACKUP_TABLE} missing — refuse to apply')
            backed = _backup_count()
            if opts['limit'] == 0 and backed != EXPECTED_ROWS:
                raise CommandError(
                    f'backup rows={backed} != expected {EXPECTED_ROWS} — refuse to apply'
                )
            # Fail-closed TRƯỚC mọi ghi: có bất kỳ adj_close sẵn ⇒ halt.
            preexisting = qs.filter(adj_close__isnull=False).count()
            if preexisting:
                raise CommandError(
                    f'adj_close_present={preexisting} > 0 — halt, 0 UPDATE'
                )
            applied, skips = 0, 0
            for chunk in iter_keyset_batches(qs, batch=5000):
                updates, chunk_skips = build_relabel_plan(chunk)
                skips += chunk_skips
                if chunk_skips:
                    raise CommandError(
                        f'skip_count={skips} > 0 — halt immediately, 0 further UPDATE'
                    )
                with transaction.atomic():
                    DailyPrice.objects.bulk_update(updates, FIELDS, batch_size=1000)
                applied += len(updates)
            self.stdout.write(
                self.style.SUCCESS(f'applied rows={applied} skips={skips}')
            )
            return

        # default = dry-run, không ghi
        updates, skips = build_relabel_plan(list(qs[:2000]))
        self.stdout.write(
            f'dry_run sample=2000 would_update={len(updates)} skip={skips} '
            f'backup_exists={_backup_exists()}'
        )
