"""CafeF trả rỗng cũng phải gọi fallback — fail-before."""
from unittest.mock import patch

from data_ingest.tasks import rebase_symbol_from_cafef


@patch('market_data.cafef.fallback.apply_provider_fallback')
@patch('vnbroker.reference.client.bulk_year')
@patch('market_data.models.PriceRebaseRun.objects')
def test_empty_cafef_response_uses_fallback(mock_audit, mock_bulk, mock_fallback):
    mock_bulk.return_value = []  # 200 nhung khong co dong
    mock_fallback.return_value = {
        'status': 'applied_fallback', 'rows_updated': 10, 'provider': 'KBS',
    }
    result = rebase_symbol_from_cafef.run('AAH', exchange='HOSE', trigger='e2e')
    assert result['status'] == 'applied_fallback'
    mock_fallback.assert_called_once()
    assert any(
        c.kwargs.get('status') == 'applied_fallback'
        for c in mock_audit.filter.return_value.update.call_args_list
    )
