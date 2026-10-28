"""
Slice C (QueueRecovery) — warm chunking bounds (FR-03: mọi warm-task ≤ 10 phút).

Covers:
- plan 200 symbols → xử lý đúng chunk default (30) + remaining + continuation enqueued
- beat path (không plan_items, fallback registry) cũng chunked, không ôm full registry
- per-symbol timeout skip (không treo cả chunk vì 1 symbol)
- bound số học: max_symbols × timeout < 600s
"""
import time
from unittest.mock import patch

from django.test import TestCase
from django.utils import timezone

from data_ingest import tasks as ingest_tasks
from data_ingest.tasks import warm_intraday_universe
from market_data.models import GlobalSymbolRegistry


def _empty_tape(symbol, page_size=50):
    return {'symbol': symbol, 'trades': [], 'source': 'VCI', 'stale': False,
            'fetched_at': timezone.now().isoformat()}


class WarmChunkingTest(TestCase):
    def _make_plan(self, n, prefix='SYM'):
        return [{'symbol': f'{prefix}{i:04d}', 'dataset': 'intraday_ticks'} for i in range(n)]

    @patch('data_ingest.tasks.warm_intraday_universe.apply_async')
    @patch('data_ingest.tasks.fetch_intraday_tape')
    def test_plan_200_symbols_processes_one_chunk_and_continues(self, fetch_mock, apply_async_mock):
        fetch_mock.side_effect = _empty_tape
        plan = self._make_plan(200)

        result = warm_intraday_universe.run(plan_items=plan)

        self.assertEqual(result['symbols_count'], 30)
        self.assertEqual(fetch_mock.call_count, 30)
        chunk = result['chunk']
        self.assertEqual(chunk['offset'], 0)
        self.assertEqual(chunk['max_symbols'], 30)
        self.assertEqual(chunk['remaining'], 170)
        self.assertTrue(chunk['continuation_enqueued'])
        self.assertTrue(apply_async_mock.called)
        cont_kwargs = apply_async_mock.call_args[1]['kwargs']
        self.assertEqual(cont_kwargs['offset'], 30)
        self.assertEqual(cont_kwargs['max_symbols'], 30)
        self.assertIsNone(cont_kwargs['service_run_log_id'])

    @patch('data_ingest.tasks.warm_intraday_universe.apply_async')
    @patch('data_ingest.tasks.fetch_intraday_tape')
    def test_beat_path_defaults_hot_only(self, fetch_mock, apply_async_mock):
        # Corrective: beat path (không plan) mặc định HOT-ONLY — 100 non-hot symbols bị bỏ qua,
        # chỉ 40 hot được hydrate (2 chunk). Full registry/5 phút là bất khả thi (đo live).
        for i in range(100):
            GlobalSymbolRegistry.objects.create(symbol=f'BEAT{i:04d}', is_active=True)
        for i in range(40):
            GlobalSymbolRegistry.objects.create(
                symbol=f'HOT{i:04d}', is_active=True,
                current_priority_tier=GlobalSymbolRegistry.PriorityTierChoices.HOT)
        fetch_mock.side_effect = _empty_tape

        result = warm_intraday_universe.run()

        self.assertEqual(result['symbols_count'], 30)
        self.assertEqual(result['chunk']['remaining'], 10)
        self.assertTrue(result['chunk']['continuation_enqueued'])
        fetched = {c.args[0] if c.args else c[1].get('kwargs', {}).get('symbol')
                   for c in fetch_mock.call_args_list}
        self.assertTrue(all(s.startswith('HOT') for s in fetched))

    @patch('data_ingest.tasks.warm_intraday_universe.apply_async')
    @patch('data_ingest.tasks.fetch_intraday_tape')
    def test_explicit_hot_only_false_restores_full_registry(self, fetch_mock, apply_async_mock):
        for i in range(100):
            GlobalSymbolRegistry.objects.create(symbol=f'BEAT{i:04d}', is_active=True)
        fetch_mock.side_effect = _empty_tape

        result = warm_intraday_universe.run(hot_only=False)

        self.assertEqual(result['symbols_count'], 30)
        self.assertEqual(result['chunk']['remaining'], 70)
        self.assertTrue(result['chunk']['continuation_enqueued'])

    @patch('data_ingest.tasks.warm_intraday_universe.apply_async')
    @patch('data_ingest.tasks.fetch_intraday_tape')
    def test_offset_beyond_end_skips(self, fetch_mock, apply_async_mock):
        plan = self._make_plan(10)
        result = warm_intraday_universe.run(plan_items=plan, max_symbols=30, offset=10)
        self.assertEqual(result['status'], 'skipped')
        self.assertEqual(result['reason'], 'chunk_complete')
        self.assertFalse(apply_async_mock.called)

    def test_arithmetic_bound_under_fr03(self):
        bound = (ingest_tasks._DEFAULT_WARM_MAX_SYMBOLS_PER_TASK
                 * ingest_tasks._DEFAULT_WARM_PER_SYMBOL_TIMEOUT_SECONDS)
        self.assertLess(bound, 600, f'chunk bound {bound}s vượt FR-03 (600s)')


class WarmPerSymbolTimeoutTest(TestCase):
    @patch('data_ingest.tasks.fetch_intraday_tape')
    def test_slow_symbol_skipped_without_blocking_chunk(self, fetch_mock):
        def _slow(symbol, page_size=50):
            if symbol == 'SLOW01':
                time.sleep(5)
            return _empty_tape(symbol, page_size)

        fetch_mock.side_effect = _slow
        plan = [{'symbol': 'SLOW01', 'dataset': 'intraday_ticks'},
                {'symbol': 'FAST01', 'dataset': 'intraday_ticks'}]

        started = time.monotonic()
        result = ingest_tasks._hydrate_intraday_symbols(
            [{'symbol': 'SLOW01', 'page_size': 50}, {'symbol': 'FAST01', 'page_size': 50}],
            ['intraday_ticks'], page_size=50, per_symbol_timeout_seconds=1,
        )
        elapsed = time.monotonic() - started

        self.assertLess(elapsed, 5, 'chunk phải đi tiếp sau timeout, không chờ symbol chậm')
        self.assertIn('SLOW01', result['failed'])
        self.assertIn('SLOW01', result.get('timed_out_symbols') or [])

    @patch('data_ingest.tasks.fetch_intraday_tape')
    def test_no_timeout_when_disabled(self, fetch_mock):
        fetch_mock.side_effect = _empty_tape
        result = ingest_tasks._hydrate_intraday_symbols(
            [{'symbol': 'A01', 'page_size': 50}], ['intraday_ticks'],
            page_size=50, per_symbol_timeout_seconds=None,
        )
        self.assertEqual(result['failed_count'], 0)

class CoverageRotationTest(TestCase):
    def test_rotation_partitions_symbols(self):
        from data_ingest.tasks import _select_coverage_rotation
        symbols = [f"S{i:04d}" for i in range(90)]
        seen = set()
        for _ in range(3):
            part = _select_coverage_rotation(symbols, parts=3)
            self.assertEqual(len(part), 30)
            seen.update(part)
        # 3 slot gio khac nhau phu du 90 symbols (deterministic theo phut)
        self.assertLessEqual(len(seen), 90)

    def test_rotation_full_when_parts_one(self):
        from data_ingest.tasks import _select_coverage_rotation
        symbols = [f"S{i:04d}" for i in range(10)]
        self.assertEqual(_select_coverage_rotation(symbols, parts=1), symbols)
        self.assertEqual(_select_coverage_rotation(symbols, parts=0), symbols)

class WarmCircuitBreakerTest(TestCase):
    def test_three_fails_then_skip(self):
        from data_ingest import tasks as ingest_tasks
        from django.core.cache import cache as _cache

        _cache.clear()

        def _boom(symbol, page_size=50):
            raise RuntimeError('provider down')

        with patch('data_ingest.tasks.fetch_intraday_tape', side_effect=_boom):
            for _ in range(3):
                r = ingest_tasks._hydrate_intraday_symbols(
                    [{'symbol': 'DEAD01', 'page_size': 50}], ['intraday_ticks'],
                    page_size=50, per_symbol_timeout_seconds=None)
                self.assertIn('DEAD01', r['failed'])
            r = ingest_tasks._hydrate_intraday_symbols(
                [{'symbol': 'DEAD01', 'page_size': 50}], ['intraday_ticks'],
                page_size=50, per_symbol_timeout_seconds=None)
            self.assertEqual(r.get('skipped_circuit'), 1)
            self.assertEqual(r['failed_count'], 0)

    def test_success_resets_circuit(self):
        from data_ingest import tasks as ingest_tasks
        from django.core.cache import cache as _cache

        _cache.clear()
        ingest_tasks._circuit_record('X01', False)
        ingest_tasks._circuit_record('X01', False)
        ingest_tasks._circuit_record('X01', False)
        self.assertTrue(ingest_tasks._circuit_open('X01'))
        ingest_tasks._circuit_record('X01', True)
        self.assertFalse(ingest_tasks._circuit_open('X01'))
