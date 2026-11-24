"""C2 parser: đọc XLSX CafeF thật (in-memory) → dict chuẩn hoá (TDD)."""
from datetime import date

from django.test import SimpleTestCase

from market_data.cafef.parser import parse_xlsx_rows


class CafefParserTests(SimpleTestCase):
    @staticmethod
    def _xlsx(rows):
        import io
        import pandas as pd

        buf = io.BytesIO()
        pd.DataFrame(rows).to_excel(buf, index=False, engine='openpyxl')
        return buf.getvalue()

    def test_parse_xlsx_golden_two_dates(self):
        rows = [
            {
                'Mã': 'TPB', 'Ngày': '04/01/2022',
                'Giá đóng cửa': 42.75, 'Giá điều chỉnh': 17.94,
                'Thay đổi': '+1,65 (+4,01%)',
                'Khối lượng khớp lệnh': 11034900, 'Giá trị khớp lệnh': 467.26,
                'Khối lượng thỏa thuận': 0, 'Giá trị thỏa thuận': 0.0,
                'Giá mở cửa': 41.5, 'Giá cao nhất': 43.25, 'Giá thấp nhất': 41.3,
            },
            {
                'Mã': 'TPB', 'Ngày': '01/04/2022',
                'Giá đóng cửa': 41.25, 'Giá điều chỉnh': 17.31,
                'Thay đổi': '0 (0,00%)',
                'Khối lượng khớp lệnh': 5000000, 'Giá trị khớp lệnh': 206.25,
                'Khối lượng thỏa thuận': 0, 'Giá trị thỏa thuận': 0.0,
                'Giá mở cửa': 41.0, 'Giá cao nhất': 41.5, 'Giá thấp nhất': 40.5,
            },
        ]
        result = parse_xlsx_rows(self._xlsx(rows))
        self.assertEqual(len(result), 2)
        self.assertEqual(result[0]['date'], date(2022, 1, 4))
        self.assertEqual(str(result[0]['close_raw']), '42750.00')
        self.assertEqual(result[0]['value'], 467260000000)
        self.assertEqual(result[1]['date'], date(2022, 4, 1))
        self.assertEqual(str(result[1]['close_raw']), '41250.00')

    def test_bad_date_row_is_skipped_with_reason(self):
        rows = [{
            'Mã': 'TPB', 'Ngày': '12/30/2022',
            'Giá đóng cửa': 42.75, 'Giá điều chỉnh': 17.94,
            'Thay đổi': '', 'Khối lượng khớp lệnh': 1, 'Giá trị khớp lệnh': 0.0,
            'Khối lượng thỏa thuận': 0, 'Giá trị thỏa thuận': 0.0,
            'Giá mở cửa': 42.0, 'Giá cao nhất': 43.0, 'Giá thấp nhất': 41.0,
        }]
        result, rejected = parse_xlsx_rows(self._xlsx(rows), with_rejected=True)
        self.assertEqual(result, [])
        self.assertEqual(len(rejected), 1)
