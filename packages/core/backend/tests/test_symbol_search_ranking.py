"""N3 — xếp hạng kết quả tìm kiếm mã chứng khoán.

Bằng chứng trước khi sửa (2026-09-26, `StockProfile` 1399 mã active): gõ `VIC`
trả về `ABS, ACS, AST` — vì `icontains` khớp cả chuỗi con trong TÊN CÔNG TY
("Se**rvic**e", "**Arc**hitec**ts**", "Tase**co** A**vi**on**s") và
`order_by('symbol')` đẩy mã đúng xuống cuối. Gõ `SSI` cũng vậy ("**Pro**ce**ss**ing").

Hậu quả với người dùng: gõ đúng mã cổ phiếu mà mã đó không nằm ở đầu danh
sách, dễ kết luận chức năng tìm kiếm hỏng — đúng thứ mà tính năng "tìm & phân
tích mã bất kỳ" cần để dùng được.

Ưu tiên sau khi sửa: khớp CHÍNH XÁC mã > mã bắt đầu bằng chuỗi > tên công ty.
`symbol` giữ làm khoá phụ để thứ tự tất định — bắt buộc với cursor pagination.
"""

import os
import sys

_src_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'src'))
if _src_dir not in sys.path:
    sys.path.insert(0, _src_dir)

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'vninvest_core.settings')

import django
django.setup()

from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient

from market_data.tests.envelope import unwrapped_json
from market_data.models import StockProfile


class SymbolSearchRankingTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(username='n3-search-owner', password='testpass123')
        self.client.force_authenticate(user=self.user)
        # Tên công ty cố tình chứa chuỗi con của mã đang tìm, đúng như dữ liệu
        # thật gây lỗi trước đây.
        StockProfile.objects.create(
            symbol='ABS', company_name='BinhThuan Agriculture Service JSC',
            exchange='HOSE', status='active',
        )
        StockProfile.objects.create(
            symbol='VIC', company_name='Vingroup Joint Stock Company',
            exchange='HOSE', status='active',
        )
        StockProfile.objects.create(
            symbol='VICB', company_name='Vingroup Secondary JSC',
            exchange='UPCOM', status='active',
        )
        StockProfile.objects.create(
            symbol='VICR', company_name='Viet Rong Group JSC',
            exchange='HOSE', status='active',
        )
        StockProfile.objects.create(
            symbol='HPG', company_name='Hoa Phat Group JSC',
            exchange='HOSE', status='active',
        )

    def _search(self, query, page_size=10):
        resp = self.client.get(f'/core/v1/market-data/symbols/?q={query}&page_size={page_size}')
        self.assertEqual(resp.status_code, 200)
        return [row['symbol'] for row in unwrapped_json(resp)['results']]

    def test_exact_symbol_match_is_first(self):
        symbols = self._search('VIC')
        self.assertEqual(symbols[0], 'VIC', f'Ma khop chinh xac phai dung dau, nhan duoc {symbols}')

    def test_prefix_matches_follow_exact_match(self):
        symbols = self._search('VIC')
        # Ngay sau VIC phai la cac ma BAT DAU bang "VIC", theo thu tu alphabet.
        # ABS (khop ten) dung sau chung, khong chen giua.
        self.assertEqual(symbols[1:3], ['VICB', 'VICR'])

    def test_company_name_match_comes_last(self):
        symbols = self._search('VIC')
        # "BinhThuan Agriculture Service" chua "vic" trong ten -> xep sau.
        self.assertIn('ABS', symbols)
        self.assertGreater(symbols.index('ABS'), symbols.index('VIC'))
        self.assertGreater(symbols.index('ABS'), symbols.index('VICR'))

    def test_search_by_company_name_still_works(self):
        symbols = self._search('Vingroup')
        self.assertEqual(symbols[0], 'VIC')

    def test_query_is_case_insensitive(self):
        self.assertEqual(self._search('vic')[0], 'VIC')
        self.assertEqual(self._search('ViC')[0], 'VIC')

    def test_list_without_query_stays_ordered_by_symbol(self):
        resp = self.client.get('/core/v1/market-data/symbols/?page_size=10')
        self.assertEqual(resp.status_code, 200)
        symbols = [row['symbol'] for row in unwrapped_json(resp)['results']]
        self.assertEqual(symbols, sorted(symbols), 'Khong co q thi phai giu thu tu symbol')

    def test_cursor_pagination_has_no_duplicates_and_keeps_ranking(self):
        page1 = self.client.get('/core/v1/market-data/symbols/?q=VIC&page_size=2')
        self.assertEqual(page1.status_code, 200)
        body1 = unwrapped_json(page1)
        self.assertEqual([r['symbol'] for r in body1['results']], ['VIC', 'VICB'])
        self.assertIsNotNone(body1.get('next'))

        page2 = self.client.get(body1['next'])
        self.assertEqual(page2.status_code, 200)
        body2 = unwrapped_json(page2)
        self.assertEqual([r['symbol'] for r in body2['results']], ['VICR', 'ABS'])

        seen = [r['symbol'] for r in body1['results']] + [r['symbol'] for r in body2['results']]
        self.assertEqual(len(seen), len(set(seen)), f'Trang chong lap: {seen}')

    def test_inactive_symbol_never_appears(self):
        StockProfile.objects.create(
            symbol='ZZZ', company_name='Should Not Appear', exchange='HOSE', status='inactive',
        )
        self.assertNotIn('ZZZ', self._search('Should'))
