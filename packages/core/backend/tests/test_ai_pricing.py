"""R2.7 - AICostRate + snapshot gia.

AC-ID theo `IMPLEMENTATION_PLAN_AI_COMMAND_CENTER_COMMERCIAL_20260925.md:947-952`
(R2.7). AC4 (UI hien thoi diem + nguon gia) la FE - xem `test_ai_usage_pricing_ui` bang
component test, khong nam trong file BE nay.
"""
import io
import json
import os
import tempfile
from decimal import Decimal

from django.test import TestCase
from django.utils import timezone

from advisory.models import AICostRate
from advisory.pricing import (
    PRICING_PROVIDER_TIERED,
    format_cost_for_display,
    import_pricing_file,
    pricing_snapshot,
    resolve_cost,
)


def _rate(provider, model, in_rate, out_rate, source=AICostRate.PricingSourceChoices.MANUAL, days=0):
    from datetime import timedelta

    return AICostRate.objects.create(
        provider=provider,
        model=model,
        usd_per_1k_input=Decimal(str(in_rate)),
        usd_per_1k_output=Decimal(str(out_rate)),
        effective_from=timezone.now() - timedelta(days=days),
        pricing_source=source,
    )


class NoRateTableTests(TestCase):
    """AC1: bang gia rong => cost=0, pricing_available=False."""

    def test_ac1_no_rate_row_returns_zero_not_fabricated(self):
        cost, available = resolve_cost('openai', 'gpt-4o-mini', 150)
        self.assertEqual(cost, Decimal('0'))
        self.assertFalse(available)

    def test_ac1_empty_table_still_zero(self):
        _rate('openai', 'gpt-4o-mini', 0.15, 0.6, days=5)
        cost, available = resolve_cost('openai', 'totally-unknown-model', 1000)
        self.assertEqual(cost, Decimal('0'))
        self.assertFalse(available)


class CostArithmeticTests(TestCase):
    """AC2: cost dung 6 chu so thap phan."""

    def test_ac2_input_and_output_weighted(self):
        rate = _rate('openai', 'gpt-4o-mini', 0.15, 0.6)
        snapshot = pricing_snapshot('openai', 'gpt-4o-mini', 1000, 500)
        self.assertEqual(snapshot['cost'], Decimal('0.450000'))
        self.assertTrue(snapshot['pricing_available'])
        self.assertEqual(snapshot['source'], AICostRate.PricingSourceChoices.MANUAL)
        self.assertEqual(snapshot['effective_from'], rate.effective_from)
        self.assertEqual(snapshot['rate_id'], rate.id)
        self.assertFalse(snapshot['tiered'])

    def test_ac2_total_tokens_fallback_counts_all_as_input(self):
        # Tuong thich 2 chu so R0.7: goi chi co `tokens_total` => tinh theo
        # bang input. Duong tinh that do tasks.py dung bang tach input/output.
        _rate('openai', 'gpt-4o-mini', 0.15, 0.6)
        cost, available = resolve_cost('openai', 'gpt-4o-mini', 1500)
        self.assertEqual(cost, Decimal('0.225000'))
        self.assertTrue(available)

    def test_ac2_split_matches_snapshot(self):
        _rate('openai', 'gpt-4o-mini', 0.15, 0.6)
        cost, available = resolve_cost(
            'openai', 'gpt-4o-mini', 0, tokens_in=1000, tokens_out=500,
        )
        self.assertEqual(cost, Decimal('0.450000'))
        self.assertTrue(available)

    def test_ac2_six_decimal_places_always(self):
        _rate('openai', 'odd-model', 0.000123, 0.000456)
        cost, _ = resolve_cost('openai', 'odd-model', 1)
        self.assertEqual(cost.as_tuple().exponent, -6)
        self.assertEqual(str(cost), '0.000000')

    def test_ac2_rounds_to_six_not_truncates_beyond_precision(self):
        _rate('openai', 'round-model', 1, 0)
        cost, available = resolve_cost('openai', 'round-model', 3333)
        self.assertEqual(cost, Decimal('3.333000'))
        self.assertTrue(available)

    def test_ac2_negative_tokens_treated_zero_not_credit(self):
        _rate('openai', 'gpt-4o-mini', 1, 1)
        cost, available = resolve_cost('openai', 'gpt-4o-mini', -500)
        self.assertEqual(cost, Decimal('0.000000'))
        self.assertTrue(available)


class SnapshotTests(TestCase):
    """AC3: doi gia sau khong sua record da ghi."""

    def test_ac3_new_rate_does_not_retro_apply_to_old_records(self):
        old = _rate('openai', 'gpt-4o-mini', 0.15, 0.6, days=30)
        from ai_analytics.models import AIUsageRecord

        record = AIUsageRecord.objects.create(
            action=AIUsageRecord.ActionChoices.ADVISORY,
            provider='openai',
            model='gpt-4o-mini',
            tokens_in=1000,
            tokens_out=500,
            cost=Decimal('0.450000'),
            status='ok',
            pricing_available=True,
        )
        _rate('openai', 'gpt-4o-mini', 1.0, 4.0, days=0)
        record.refresh_from_db()
        self.assertEqual(record.cost, Decimal('0.450000'))
        self.assertEqual(
            resolve_cost('openai', 'gpt-4o-mini', 0, tokens_in=1000, tokens_out=500)[0],
            Decimal('3.000000'),  # gia moi 1.0/1k in + 4.0/1k out
        )
        self.assertEqual(old.usd_per_1k_input, Decimal('0.150000'))

    def test_ac3_latest_effective_from_wins(self):
        _rate('openai', 'gpt-4o-mini', 0.15, 0.6, days=30)
        _rate('openai', 'gpt-4o-mini', 0.2, 0.8, days=1)
        self.assertEqual(resolve_cost('openai', 'gpt-4o-mini', 1000)[0], Decimal('0.200000'))


class CopilotTierTests(TestCase):
    """AC6: copilot khong bao gio tinh theo token."""

    def test_ac6_copilot_never_priced_by_token(self):
        cost, available = resolve_cost('copilot', 'gpt-5', 100000)
        self.assertEqual(cost, Decimal('0'))
        self.assertFalse(available)

    def test_ac6_copilot_wins_even_when_row_exists(self):
        _rate('copilot', 'gpt-5', 99.0, 99.0, source=AICostRate.PricingSourceChoices.COPILOT_TIER)
        cost, available = resolve_cost('copilot', 'gpt-5', 100000)
        self.assertEqual(cost, Decimal('0'))
        self.assertFalse(available)

    def test_ac6_copilot_label_is_tier_not_dollar(self):
        label = format_cost_for_display('copilot', 'gpt-5', 1000, 0, False)
        self.assertIn(PRICING_PROVIDER_TIERED['copilot'], label)
        self.assertNotIn('$', label)


class ImportFileTests(TestCase):
    """AC5: import tu file JSON idempotent."""

    payload = [
        {'provider': 'openai', 'model': 'gpt-4o-mini',
         'usd_per_1k_input': '0.15', 'usd_per_1k_output': '0.6',
         'effective_from': '2026-01-01T00:00:00Z', 'pricing_source': 'litellm'},
        {'provider': 'gemini', 'model': 'gemini-3.8-flash',
         'usd_per_1k_input': '0.075', 'usd_per_1k_output': '0.3',
         'effective_from': '2026-01-01T00:00:00Z', 'pricing_source': 'openrouter'},
    ]

    def _write(self, payload):
        fh = tempfile.NamedTemporaryFile('w', suffix='.json', delete=False, encoding='utf-8')
        fh.write(json.dumps(payload))
        fh.close()
        self.addCleanup(os.unlink, fh.name)
        return fh.name

    def test_ac5_import_then_reimport_is_noop(self):
        path = self._write(self.payload)
        first = import_pricing_file(path)
        self.assertEqual(first, {'created': 2, 'updated': 0, 'skipped': 0, 'invalid': 0})
        second = import_pricing_file(path)
        self.assertEqual(second, {'created': 0, 'updated': 0, 'skipped': 2, 'invalid': 0})
        self.assertEqual(AICostRate.objects.count(), 2)

    def test_ac5_conflict_is_reported_not_silently_overwritten(self):
        path = self._write(self.payload)
        import_pricing_file(path)
        changed = [dict(self.payload[0], usd_per_1k_input='9.99'), self.payload[1]]
        result = import_pricing_file(self._write(changed))
        self.assertEqual(result['updated'], 0)
        self.assertEqual(result['skipped'], 2)
        rate = AICostRate.objects.get(provider='openai', model='gpt-4o-mini')
        self.assertEqual(rate.usd_per_1k_input, Decimal('0.150000'))

    def test_ac5_invalid_rows_counted_not_raised(self):
        path = self._write([{'provider': 'openai'}])
        result = import_pricing_file(path)
        self.assertEqual(result, {'created': 0, 'updated': 0, 'skipped': 0, 'invalid': 1})
        self.assertEqual(AICostRate.objects.count(), 0)

    def test_ac5_missing_file_raises_readable(self):
        with self.assertRaises(FileNotFoundError):
            import_pricing_file('/nonexistent/pricing.json')


class UsageRecordIntegrationTests(TestCase):
    """Duong ghi that cua R0.7 (`tasks._write_advisory_usage_record`) lay gia tu day."""

    def _write(self, **kwargs):
        from advisory.tasks import _write_advisory_usage_record

        payload = dict(
            user=None, provider='openai', model='gpt-4o-mini',
            tokens_in=1000, tokens_out=500, latency_ms=120,
            record_status='ok',
        )
        payload.update(kwargs)
        _write_advisory_usage_record(**payload)
        from ai_analytics.models import AIUsageRecord

        return AIUsageRecord.objects.get()

    def test_record_cost_uses_split_input_output(self):
        _rate('openai', 'gpt-4o-mini', 0.15, 0.6)
        record = self._write()
        self.assertEqual(record.cost, Decimal('0.450000'))
        self.assertTrue(record.pricing_available)

    def test_record_without_rate_is_zero_and_flagged(self):
        record = self._write()
        self.assertEqual(record.cost, Decimal('0'))
        self.assertFalse(record.pricing_available)

    def test_record_copilot_zero_not_dollar(self):
        _rate('copilot', 'gpt-5', 12.0, 12.0, source=AICostRate.PricingSourceChoices.COPILOT_TIER)
        record = self._write(provider='copilot', model='gpt-5', tokens_in=5000, tokens_out=5000)
        self.assertEqual(record.cost, Decimal('0'))
        self.assertFalse(record.pricing_available)

    def test_record_pricing_failure_does_not_break_task(self):
        # Bang gia hong (chua migrate / DB het) => usage van duoc ghi voi cost 0,
        # co se khong lam task ghi usage no.
        from unittest import mock

        import advisory.pricing as pricing_module

        class _BrokenObjects:
            @staticmethod
            def filter(*args, **kwargs):
                raise RuntimeError('db down')

        class _BrokenRates:
            objects = _BrokenObjects()
            PricingSourceChoices = AICostRate.PricingSourceChoices

        with mock.patch.object(pricing_module, 'AICostRate', _BrokenRates):
            snapshot = pricing_module.pricing_snapshot('openai', 'gpt-4o-mini', 1000, 500)
        self.assertEqual(snapshot['cost'], Decimal('0.000000'))
        self.assertFalse(snapshot['pricing_available'])

    def test_record_write_swallows_pricing_error(self):
        from unittest import mock

        from advisory.tasks import _write_advisory_usage_record
        from ai_analytics.models import AIUsageRecord

        with mock.patch(
            'advisory.pricing.pricing_snapshot', side_effect=RuntimeError('boom'),
        ):
            # Khong nem ra ngoaii - task ghi usage khong bi gia hop lam hong (R0.7).
            _write_advisory_usage_record(
                user=None, provider='openai', model='gpt-4o-mini',
                tokens_in=1000, tokens_out=500, latency_ms=10, record_status='ok',
            )
        self.assertEqual(AIUsageRecord.objects.count(), 0)