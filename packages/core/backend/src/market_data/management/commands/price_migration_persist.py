"""M4 — persist CafeF → DailyPrice theo lô, bộ nhớ O(batch).

Mặc định DRY-RUN (chỉ đếm). --apply bắt buộc PRICE_MIGRATION_PAUSED=1
(maintenance window M3). Mỗi lô là 1 transaction; lưu inserted_keys để rollback S6.
"""
import json
import os
from collections import Counter
from datetime import date

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from market_data.cafef.persist import classify_row
from market_data.models import CafefDailyPrice, DailyPrice, StockProfile

BATCH = 2000
LEGACY_FIELDS = ('id', 'symbol', 'date', 'close', 'adj_close', 'open', 'high',
                 'low', 'volume', 'value', 'change_pct', 'price_source')
CAFEF_FIELDS = ('close_raw', 'close_adjusted', 'open_raw', 'high_raw',
                'low_raw', 'volume', 'value', 'change_pct')
WRITE_FIELDS = ('close', 'adj_close', 'open', 'high', 'low', 'volume',
                'value', 'change_pct', 'adj_factor', 'price_source')


class Command(BaseCommand):
    help = 'Persist giá CafeF sang DailyPrice. Dry-run mặc định.'

    def add_arguments(self, parser):
        parser.add_argument('--exchange', required=True, choices=['HOSE', 'HNX', 'UPCOM'])
        parser.add_argument('--year', type=int, required=True)
        parser.add_argument('--apply', action='store_true')
        parser.add_argument('--out', default='')
        parser.add_argument('--inserted-keys-out', default='')

    def _paged(self, qs, fields):
        last = 0
        while True:
            chunk = list(qs.filter(id__gt=last).order_by('id').values(*fields)[:BATCH])
            if not chunk:
                break
            yield from chunk
            last = chunk[-1]['id']

    def handle(self, *args, **opts):
        if opts['apply'] and os.getenv('PRICE_MIGRATION_PAUSED', '0') != '1':
            raise CommandError('--apply requires PRICE_MIGRATION_PAUSED=1 (maintenance window)')

        year = opts['year']
        # Res-3: exchange là tham số BẮT BUỘC — lọc symbol theo StockProfile.exchange
        # (DailyPrice/CafefDailyPrice không có cột exchange).
        symbols = set(StockProfile.objects.filter(
            exchange=opts['exchange']).values_list('symbol', flat=True))
        if not symbols:
            raise CommandError(
                f'no symbols for exchange={opts["exchange"]} — refused to process all exchanges')

        # M6c hotfix: date__year sinh EXTRACT(YEAR FROM date) ⇒ Seq Scan toàn
        # bảng (EXPLAIN cost 153014, đo 2026-11-25). Dùng range để ăn index
        # `market_data_dailyprice_date_e5322378` / cafef tương ứng.
        date_from = date(year, 1, 1)
        date_to = date(year, 12, 31)

        # Pass 1: chỉ id + price_source cho legacy; id cho cafef (O(n) nhỏ).
        legacy = {}
        for r in self._paged(
            DailyPrice.objects.filter(date__range=(date_from, date_to), symbol__in=symbols),
            ('id', 'symbol', 'date', 'price_source')
        ):
            legacy[(r['symbol'], r['date'])] = (r['id'], r['price_source'])
        cafef = {}
        for r in self._paged(
            CafefDailyPrice.objects.filter(date__range=(date_from, date_to), symbol__in=symbols),
            ('id', 'symbol', 'date')
        ):
            cafef[(r['symbol'], r['date'])] = r['id']

        legacy_keys, cafef_keys = set(legacy), set(cafef)
        matched = legacy_keys & cafef_keys
        db_only = legacy_keys - cafef_keys
        cafef_only = cafef_keys - legacy_keys

        counts = Counter({'update': len(matched), 'keep_unmapped': len(db_only),
                          'insert': len(cafef_only)})
        inserted_keys = []

        if opts['apply']:
            self._write_updates(matched, legacy, year, db_only)
            self._write_inserts(cafef_only, inserted_keys)

        report = {
            'exchange': opts['exchange'], 'year': year,
            'dry_run': not opts['apply'],
            'matched': len(matched), 'db_only': len(db_only),
            'cafef_only': len(cafef_only), 'counts': dict(counts),
            'inserted_keys_count': len(inserted_keys) if opts['apply'] else len(cafef_only),
            'assert_updated_equals_matched': counts['update'] == len(matched),
            'verify_after_apply': {
                'note': 'assert_updated_equals_matched LA TAUTOLOGY — phải đối chiếu DB sau apply',
                'expected_cafef_rows': len(matched) + len(cafef_only),
                'checksum_symbols': sorted(symbols)[:20],
            },
        }
        text = json.dumps(report, ensure_ascii=False, indent=2)
        if opts['out']:
            with open(opts['out'], 'w', encoding='utf-8') as fh:
                fh.write(text)
        if opts['inserted_keys_out']:
            with open(opts['inserted_keys_out'], 'w', encoding='utf-8') as fh:
                for line in (inserted_keys if opts['apply']
                             else sorted(f'{s}:{d.isoformat()}' for s, d in cafef_only)):
                    fh.write(line + '\n')
        self.stdout.write(text)

    def _write_updates(self, matched, legacy, year, db_only):
        id_to_key = {legacy[k][0]: k for k in matched}
        keys = list(id_to_key)
        for start in range(0, len(keys), BATCH):
            chunk = keys[start:start + BATCH]
            legacy_rows = {r['id']: r for r in DailyPrice.objects.filter(
                id__in=chunk).values(*LEGACY_FIELDS)}
            chunk_symbols = {id_to_key[pk][0] for pk in chunk if pk in id_to_key}
            chunk_dates = {id_to_key[pk][1] for pk in chunk if pk in id_to_key}
            cafef_rows = {
                (r['symbol'], r['date']): r
                for r in CafefDailyPrice.objects.filter(
                    symbol__in=chunk_symbols, date__in=chunk_dates).values(
                    'symbol', 'date', *CAFEF_FIELDS)
            }
            objs = []
            for pk in chunk:
                old = legacy_rows.get(pk)
                key = id_to_key.get(pk)
                if old is None or key is None:
                    continue
                new = cafef_rows.get(key)
                if new is None:
                    continue
                plan = classify_row(old, new, 'cafef')
                obj = DailyPrice(pk=pk)
                for field in WRITE_FIELDS:
                    setattr(obj, field, plan.get(f'{field}_new', plan.get(field)))
                objs.append(obj)
            with transaction.atomic():
                DailyPrice.objects.bulk_update(objs, fields=WRITE_FIELDS, batch_size=BATCH)

        # DB-only: dọn adj_close hỏng + đánh dấu (batch, không giữ list lớn).
        un_ids = [legacy[k][0] for k in db_only]
        for start in range(0, len(un_ids), BATCH):
            with transaction.atomic():
                DailyPrice.objects.filter(id__in=un_ids[start:start + BATCH]).update(
                    adj_close=None, price_source='unmapped_cafef')

    def _write_inserts(self, cafef_only, inserted_keys):
        keys = sorted(cafef_only, key=lambda k: (k[0], k[1]))
        for start in range(0, len(keys), BATCH):
            chunk = keys[start:start + BATCH]
            chunk_symbols = {k[0] for k in chunk}
            chunk_dates = {k[1] for k in chunk}
            cafef_rows = {
                (r['symbol'], r['date']): r
                for r in CafefDailyPrice.objects.filter(
                    symbol__in=chunk_symbols, date__in=chunk_dates).values(
                    'symbol', 'date', *CAFEF_FIELDS)
            }
            objs = []
            for key in chunk:
                new = cafef_rows.get(key)
                if new is None:
                    continue
                plan = classify_row(None, new, 'cafef')
                objs.append(DailyPrice(
                    symbol=key[0], date=key[1],
                    close=plan['close_new'], adj_close=plan['adj_close_new'],
                    open=plan['open_new'], high=plan['high_new'], low=plan['low_new'],
                    volume=plan['volume_new'], value=plan['value_new'],
                    change_pct=plan['change_pct_new'],
                    adj_factor=plan['adj_factor'], price_source='cafef',
                ))
                inserted_keys.append(f'{key[0]}:{key[1].isoformat()}')
            with transaction.atomic():
                DailyPrice.objects.bulk_create(objs, batch_size=BATCH)

        if True:  # _write_inserts chỉ được gọi khi --apply
            # Res-4: gate đĩa tối thiểu 20 GB. VACUUM ANALYZE phải chạy RIÊNG
            # ngoài command này — pgbouncer /dev/shm chỉ 64MB ⇒ VACUUM lỗi
            # "could not resize shared memory segment" (đo 2026-11-25).
            stat = os.statvfs('/')
            free_gb = stat.f_bavail * stat.f_frsize / (1024 ** 3)
            if free_gb < 20:
                self.stderr.write(f'WARNING: disk free {free_gb:.1f} GB < 20 GB after apply')
