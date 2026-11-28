"""Phase 3 wiring — sync_corporate_actions dùng AdjustmentService (fail-before)."""
from unittest.mock import patch

from data_ingest.tasks import sync_corporate_actions


def _patches():
    return (
        patch('market_data.corporate_actions.adjustment.apply_adjustment_service'),
        patch('market_data.corporate_actions.ingest.fetch_corporate_actions',
              return_value=[]),
        patch('market_data.corporate_actions.ingest.upsert_corporate_actions',
              return_value=(0, 0)),
        patch('data_ingest.tasks.CorporateAction.objects') if hasattr(
            __import__('data_ingest.tasks', fromlist=['x']), 'CorporateAction') else
        patch('market_data.models.CorporateAction.objects'),
    )


def test_task_uses_service_and_halts_on_partial_event():
    service, fetch, upsert, ca = _patches()
    with service as svc, fetch, upsert, ca as mock_ca:
        mock_ca.filter.return_value.aggregate.return_value = {'ex_date__max': None}
        svc.side_effect = ValueError('PARTIAL_EVENT')
        result = sync_corporate_actions.run('FPT')
    assert result['status'] == 'halted_partial'
    assert result['applied'] == 0


def test_task_reports_applied_from_service():
    service, fetch, upsert, ca = _patches()
    with service as svc, fetch, upsert, ca as mock_ca:
        mock_ca.filter.return_value.aggregate.return_value = {'ex_date__max': None}
        svc.return_value = {'status': 'applied', 'rows_updated': 42}
        result = sync_corporate_actions.run('FPT')
    assert result['status'] == 'applied'
    assert result['applied'] == 42
