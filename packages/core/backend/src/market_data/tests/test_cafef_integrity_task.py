"""Background paced import — no sleep in request path, gate before publish."""
from unittest.mock import patch

from data_ingest.tasks import import_cafef_year_paced

_CLEAN = {'ok': True, 'violations': [], 'counts': {}, 'rows': 2, 'cafef_rows': 2}
_DIRTY = {'ok': False, 'violations': ['factor_out_of_bounds'], 'counts': {},
          'rows': 2, 'cafef_rows': 2}


def test_task_imports_then_reports_applied():
    with patch('market_data.cafef.importer.run_import',
               return_value={'inserted': 5, 'updated': 0}) as importer, \
         patch('market_data.cafef.integrity.collect_rows', return_value=[]), \
         patch('market_data.cafef.integrity.audit_rows', return_value=_CLEAN):
        result = import_cafef_year_paced.run('HOSE', 2026)
    assert result['status'] == 'applied'
    assert result['violations'] == []
    importer.assert_called_once_with('HOSE', 2026, dry_run=False)


def test_task_reports_integrity_blocked_without_raising():
    with patch('market_data.cafef.importer.run_import', return_value={'inserted': 5}), \
         patch('market_data.cafef.integrity.collect_rows', return_value=[]), \
         patch('market_data.cafef.integrity.audit_rows', return_value=_DIRTY):
        result = import_cafef_year_paced.run('HOSE', 2026)
    assert result['status'] == 'integrity_blocked'
    assert result['violations'] == ['factor_out_of_bounds']


def test_dry_run_skips_integrity_scan():
    with patch('market_data.cafef.importer.run_import',
               return_value={'row_count': 100, 'dry_run': True}), \
         patch('market_data.cafef.integrity.collect_rows') as collect:
        result = import_cafef_year_paced.run('HOSE', 2026, dry_run=True)
    assert result['status'] == 'dry_run'
    collect.assert_not_called()
