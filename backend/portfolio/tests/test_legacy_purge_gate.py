from pathlib import Path

from django.test import SimpleTestCase


class LegacyPrefetchPurgeGateTests(SimpleTestCase):
    def test_no_legacy_prefetch_symbols_in_runtime_paths(self):
        backend_root = Path(__file__).resolve().parents[2]
        targets = [
            backend_root / 'config' / 'settings.py',
            backend_root / 'portfolio' / 'tasks.py',
            backend_root / 'portfolio' / 'tasks_prefetch.py',
            backend_root / 'portfolio' / 'views_admin_runtime.py',
        ]

        forbidden_tokens = {
            'prefetch-ticker-price-board',
            'portfolio.tasks.prefetch_ticker_price_board',
            'def prefetch_ticker_price_board(',
            'legacy_views = _legacy_views_module()',
            'def _legacy_views_module(',
        }

        for path in targets:
            content = path.read_text(encoding='utf-8')
            for token in forbidden_tokens:
                self.assertNotIn(
                    token,
                    content,
                    msg=f'Legacy token {token!r} still present in {path.name}',
                )
