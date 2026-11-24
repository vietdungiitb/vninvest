"""M0 — change_pct golden từ cột 'Thay đổi' của CafeF (TDD)."""
from datetime import date

from django.test import SimpleTestCase

from market_data.cafef.contract import normalize_row

ROW = {
    'Mã': 'TPB', 'Ngày': '04/01/2022',
    'Giá đóng cửa': 42.75, 'Giá điều chỉnh': 17.94,
    'Thay đổi': '+1,65 (+4,01%)',
    'Khối lượng khớp lệnh': 11034900, 'Giá trị khớp lệnh': 467.26,
    'Khối lượng thỏa thuận': 0, 'Giá trị thỏa thuận': 0.0,
    'Giá mở cửa': 41.5, 'Giá cao nhất': 43.25, 'Giá thấp nhất': 41.3,
}


class CafefChangePctTests(SimpleTestCase):
    def test_change_pct_parsed_from_text(self):
        row = normalize_row('TPB', ROW)
        self.assertEqual(row['change_pct'], 4.01)

    def test_change_pct_zero_string(self):
        raw = dict(ROW)
        raw['Thay đổi'] = '0 (0,00%)'
        self.assertEqual(normalize_row('TPB', raw)['change_pct'], 0.0)
