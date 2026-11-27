"""Rebase phải gọi fallback khi CafeF fetch_error, không trả fetch_error裸."""
from unittest.mock import patch

from data_ingest.tasks import rebase_symbol_from_cafef


@patch('market_data.cafef.fallback.apply_provider_fallback')
@patch('vnbroker.reference.client.bulk_year')
@patch('market_data.models.PriceRebaseRun.objects')
def test_fetch_error_uses_provider_fallback(mock_audit, mock_bulk, mock_fallback):
    mock_bulk.side_effect = RuntimeError('HTTP 503')
    mock_fallback.return_value = {
        'status': 'applied_fallback', 'rows_updated': 3, 'provider': 'KBS',
    }
    result = rebase_symbol_from_cafef.run('TPB', exchange='HOSE', trigger='e2e')
    assert result['status'] == 'applied_fallback'
    assert result['rows_updated'] == 3
    mock_fallback.assert_called_once()
    update = mock_audit.filter.return_value.update
    assert any(
        c.kwargs.get('status') == 'applied_fallback'
        for c in update.call_args_list
    )


@patch('market_data.cafef.fallback.apply_provider_fallback')
@patch('vnbroker.reference.client.bulk_year')
@patch('market_data.models.PriceRebaseRun.objects')
def test_failure_of_fallback_stays_halted(mock_audit, mock_bulk, mock_fallback):
    mock_bulk.side_effect = RuntimeError('HTTP 503')
    mock_fallback.return_value = {'status': 'halted_data_error', 'reason': 'insufficient_coverage'}
    result = rebase_symbol_from_cafef.run('TPB', exchange='HOSE', trigger='e2e')
    assert result['status'] == 'fetch_error'
    assert result['fallback_status'] == 'halted_data_error'
    assert result['fallback_reason'] == 'insufficient_coverage'
    assert 'HTTP 503' in result['reason']
