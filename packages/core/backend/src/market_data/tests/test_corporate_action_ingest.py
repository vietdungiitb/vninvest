"""Task 3 — ingest VCI trực tiếp, dedup/idempotent, fallback ID (fail-before)."""
from datetime import date
from decimal import Decimal
from unittest.mock import patch

import pandas as pd
from django.test import TestCase

from market_data.corporate_actions.ingest import (
    SUPPORTED_EVENT_CODES,
    ProviderAuthError,
    fetch_corporate_actions,
    get_provider_token,
    make_fallback_event_id,
    normalize_provider_error,
    upsert_corporate_actions,
)
from market_data.models import CorporateAction


def _events_frame(rows):
    return pd.DataFrame(rows)


def _div_row(event_id='id-001', title='Trả cổ tức bằng tiền mặt - 950 VND', amount='950', ex='2024-09-24'):
    return {
        'id': event_id,
        'event_code': 'DIV',
        'exright_date': ex,
        'event_title_vi': title,
        'event_name_vi': 'Trả cổ tức bằng tiền mặt',
    }


class IngestTests(TestCase):
    @patch('vnbroker.explorer.vci.company.Company')
    def test_fetch_uses_vci_directly(self, vci_cls):
        vci_cls.return_value.events.return_value = _events_frame([_div_row()])
        rows = fetch_corporate_actions('VNM', date(2024, 1, 1))
        vci_cls.assert_called_once_with('VNM')
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]['source'], 'VCI')
        self.assertEqual(rows[0]['source_event_id'], 'id-001')
        self.assertEqual(rows[0]['cash_amount_per_share'], Decimal('950'))
        self.assertEqual(rows[0]['parse_status'], 'parsed_from_text')

    @patch('vnbroker.explorer.vci.company.Company')
    def test_idempotent_refetch(self, vci_cls):
        vci_cls.return_value.events.return_value = _events_frame([_div_row(title='old title')])
        rows = fetch_corporate_actions('VNM', date(2024, 1, 1))
        upsert_corporate_actions('VNM', rows)
        rows[0]['raw_title'] = 'new title'
        upsert_corporate_actions('VNM', rows)
        qs = CorporateAction.objects.filter(source_event_id='id-001')
        self.assertEqual(qs.count(), 1)
        self.assertEqual(qs.first().raw_title, 'new title')
        self.assertTrue(qs.first().is_latest)

    @patch('vnbroker.explorer.vci.company.Company')
    def test_all_providers_empty_keeps_existing(self, vci_cls):
        self._seed(source='VCI', event_id='id-old')
        vci_cls.return_value.events.return_value = pd.DataFrame()
        created, updated = upsert_corporate_actions('VNM', fetch_corporate_actions('VNM', date(2024, 1, 1)))
        self.assertEqual((created, updated), (0, 0))
        row = CorporateAction.objects.get(source_event_id='id-old')
        self.assertEqual(row.source, 'VCI')

    def _seed(self, source='VCI', event_id='id-old', **overrides):
        data = dict(
            symbol='VNM', action_type='DIV', ex_date=date(2024, 9, 24),
            cash_amount_per_share=Decimal('950.00'), currency='VND', source=source,
            source_event_id=event_id, raw_title='seed title', parse_status='parsed_from_text',
        )
        data.update(overrides)
        return CorporateAction.objects.create(**data)

    @patch.dict('os.environ', {'TCBS_TOKEN': 'fake-token'})
    def test_tcbs_token_from_env(self):
        self.assertEqual(get_provider_token('TCBS'), 'fake-token')
        self.assertIsNone(get_provider_token('UNKNOWN'))

    def test_tcbs_provider_auth_error_mapped(self):
        error = normalize_provider_error(RuntimeError('Token hết hạn/không hợp lệ hoặc provider từ chối quyền'))
        self.assertIsInstance(error, ProviderAuthError)
        self.assertEqual(error.code, 'PROVIDER_AUTH')
        self.assertIn('env', str(error).lower())

    def test_event_code_coverage(self):
        self.assertEqual(tuple(SUPPORTED_EVENT_CODES), ('DIV', 'ISS'))

    @patch('vnbroker.explorer.vci.company.Company')
    def test_unknown_event_code_skipped(self, vci_cls):
        row = _div_row()
        row['event_code'] = 'SPLIT'
        vci_cls.return_value.events.return_value = _events_frame([row])
        with self.assertLogs('market_data.corporate_actions.ingest', level='WARNING'):
            rows = fetch_corporate_actions('VNM', date(2024, 1, 1))
        self.assertEqual(rows, [])

    @patch('vnbroker.explorer.vci.company.Company')
    def test_fallback_id_collision_two_div_same_ex_date(self, vci_cls):
        a = _div_row(event_id='', amount='950')
        b = _div_row(event_id='', title='Trả cổ tức bằng tiền mặt - 1,500 VND', amount='1500')
        for row in (a, b):
            row.pop('id')
        vci_cls.return_value.events.return_value = _events_frame([a, b])
        rows = fetch_corporate_actions('VNM', date(2024, 1, 1))
        self.assertEqual(len(rows), 2)
        self.assertNotEqual(rows[0]['source_event_id'], rows[1]['source_event_id'])
        upsert_corporate_actions('VNM', rows)
        self.assertEqual(CorporateAction.objects.filter(symbol='VNM', ex_date=date(2024, 9, 24)).count(), 2)

    def test_fallback_normalize_stable(self):
        first = make_fallback_event_id('VNM', date(2024, 9, 24), 'DIV', Decimal('1500'), None)
        second = make_fallback_event_id('VNM', date(2024, 9, 24), 'DIV', Decimal('1500.00'), None)
        self.assertEqual(first, second)

    @patch('vnbroker.explorer.vci.company.Company')
    def test_fallback_amount_change_supersedes_old(self, vci_cls):
        import pandas as pd
        row = _div_row(event_id='', title='same title', amount='950')
        row.pop('id')
        vci_cls.return_value.events.return_value = _events_frame([row])
        upsert_corporate_actions('VNM', fetch_corporate_actions('VNM', date(2024, 1, 1)))
        old = CorporateAction.objects.get(source_event_id__startswith='fb-')
        row['event_title_vi'] = 'same title'
        row['event_title_vi_override'] = '1500 VND'
        vci_cls.return_value.events.return_value = _events_frame([dict(row, **{'event_title_vi': 'same title - 1500 VND'})])
        upsert_corporate_actions('VNM', fetch_corporate_actions('VNM', date(2024, 1, 1)))
        old.refresh_from_db()
        self.assertFalse(old.is_latest)
        self.assertTrue(CorporateAction.objects.filter(is_latest=True, raw_title__contains='1500 VND').exists())

    def test_dnse_not_used_as_source(self):
        self.assertNotIn('DNSE', SUPPORTED_EVENT_CODES)
