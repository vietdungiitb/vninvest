"""Dry-run diff DailyPrice vs CafefDailyPrice — KHÔNG ghi DB, bộ nhớ O(batch).

Chạy 2 pass keyset-pagination: pass 1 hash legacy (symbol,date) → (close,adj_close,...);
pass 2 với CafeF, chỉ giữ aggregate + sample. Không nạp全 bảng vào RAM.
"""
import hashlib
import json
from collections import Counter

from django.core.management.base import BaseCommand

from market_data.cafef.diff import classify_db_only, diff_row, ratio_stats
from market_data.models import CafefDailyPrice, DailyPrice


class Command(BaseCommand):
    help = 'Dry-run diff trước chuyển đổi giá; output JSON, không ghi DB.'

    def add_arguments(self, parser):
        parser.add_argument('--year', type=int, required=True)
        parser.add_argument('--limit', type=int, default=0)
        parser.add_argument('--out', type=str, default='')

    def _paged(self, qs, fields, batch=2000):
        last = 0
        while True:
            chunk = list(qs.filter(id__gt=last).order_by('id').values(*fields)[:batch])
            if not chunk:
                break
            yield from chunk
            last = chunk[-1]['id']

    def handle(self, *args, **opts):
        year = opts['year']
        legacy_fields = ('id', 'symbol', 'date', 'close', 'adj_close', 'open',
                         'high', 'low', 'volume', 'value')
        cafef_fields = ('id', 'symbol', 'date', 'close_raw', 'close_adjusted',
                        'open_raw', 'high_raw', 'low_raw', 'volume', 'value')

        # Pass 1: legacy compact map (chỉ 2 số cần đối chiếu) — ~400k entry nhỏ.
        legacy = {}
        n_legacy = 0
        for r in self._paged(DailyPrice.objects.filter(date__year=year), legacy_fields):
            n_legacy += 1
            legacy[(r['symbol'], r['date'])] = (
                float(r['close']) if r['close'] is not None else None,
                float(r['adj_close']) if r['adj_close'] is not None else None,
            )
            if opts['limit'] and n_legacy >= opts['limit']:
                break

        fields_changed = Counter()
        ratio_values = []
        matched = adj_missing = 0
        sample = []
        seen = set()
        n_cafef = 0
        for r in self._paged(CafefDailyPrice.objects.filter(date__year=year), cafef_fields):
            n_cafef += 1
            key = (r['symbol'], r['date'])
            seen.add(key)
            old = legacy.get(key)
            new = {
                'close_raw': r['close_raw'], 'close_adjusted': r['close_adjusted'],
                'open_raw': r['open_raw'], 'high_raw': r['high_raw'], 'low_raw': r['low_raw'],
                'volume': r['volume'], 'value': r['value'],
            }
            if old is None:
                continue
            matched += 1
            old_map = {'close': old[0], 'adj_close': old[1], 'open': None,
                       'high': None, 'low': None, 'volume': None, 'value': None}
            d = diff_row(key[0], key[1].isoformat(), old_map, new)
            fields_changed.update(d['changed_fields'])
            if d['adj_close_missing']:
                adj_missing += 1
            if d['close_ratio'] is not None:
                ratio_values.append(d['close_ratio'])
            if len(sample) < 5:
                sample.append(d)

        legacy_keys = set(legacy)
        db_only = legacy_keys - seen
        cafef_only = seen - legacy_keys
        groups = Counter(classify_db_only(s) for s, _ in db_only)
        stats = ratio_stats(ratio_values)

        report = {
            'year': year,
            'legacy_rows': n_legacy,
            'cafef_rows': n_cafef,
            'matched': matched,
            'db_only': len(db_only),
            'cafef_only': len(cafef_only),
            'db_only_groups': dict(groups),
            'db_only_sample': [f'{s}:{d.isoformat()}' for s, d in list(db_only)[:20]],
            'cafef_only_sample': [f'{s}:{d.isoformat()}' for s, d in list(cafef_only)[:20]],
            'fields_changed': dict(fields_changed),
            'adj_close_missing': adj_missing,
            'ratio_stats': stats,
            'halt': stats['halt'],
            'sample': sample,
            'fingerprint': hashlib.sha256(
                f'{year}:{n_legacy}:{n_cafef}:{matched}'.encode()).hexdigest()[:16],
        }
        text = json.dumps(report, ensure_ascii=False, indent=2, default=str)
        if opts['out']:
            with open(opts['out'], 'w', encoding='utf-8') as fh:
                fh.write(text)
        self.stdout.write(text)
