"""Ghim hình dạng response mà 2 chỗ đang **ghi thêm key sau khi paginate**.

Vì sao cần
----------
Cả hai chỗ này dùng mẫu:

    response = paginator.get_paginated_response(...)
    response.data['symbol'] = ...      # market_data/views.py:118
    response.data['job_key'] = ...     # service_ops/views/scheduler.py:269

Key được ghi **ngang hàng** với `results`, tức nằm ở cấp trên cùng cùng với
`next`/`previous`. Hôm nay đúng.

Nhưng nếu sau này phân trang được bọc `{data: {results, next, previous}, meta}`
(đúng như kế hoạch API-02 đang cân nhắc cho họ F6), thì `response.data['symbol']`
sẽ ghi ra **ngoài** `data` — key chui lên một tầng so với hôm nay. Không có lỗi,
không có test đỏ; chỉ client đọc `data.symbol` là **không còn**.

Đây là loại "sai chỗ, không sai giá trị" — không ai phát hiện bằng mắt, và người
dùng thấy `undefined` nên nhiều khi thành `0`.

Test ở đây **ghim** vị trí hiện tại. Khi ai đó đổi hình dạng F6 mà quên sửa 2
chỗ này, test đỏ ngay thay vì để lỗi xuất hiện trên UI.
"""

from decimal import Decimal
from pathlib import Path

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIRequestFactory, force_authenticate

User = get_user_model()


class PaginatedResponseSiblingsTests(TestCase):
    """`symbol` và `job_key` phải nằm cùng cấp với `results` — như hôm nay."""

    def test_market_data_paginated_response_puts_symbol_beside_results(self):
        from market_data.models import DailyPrice
        from market_data.views import DailyPriceListView

        user = User.objects.create_user(username='f6a', password='x')
        DailyPrice.objects.create(
            symbol='VNM', date='2026-05-10', open=Decimal('74000'),
            high=Decimal('76000'), low=Decimal('73500'),
            close=Decimal('75000'), volume=1000)

        factory = APIRequestFactory()
        request = factory.get('/x/')
        force_authenticate(request, user=user)
        request.user = user

        # `symbol` là kwarg của URL, không phải query param —
        # `market_data/urls.py:9`: `daily-prices/<str:symbol>/`.
        out = DailyPriceListView.as_view()(request, symbol='VNM')
        self.assertEqual(out.status_code, 200)
        data = out.data

        # Hình dạng hôm nay — key ngang hàng với `results`.
        self.assertIn('results', data)
        self.assertIn('symbol', data)
        self.assertNotIn(
            'data', data,
            'nếu `symbol` đã chui xuống `data.symbol` thì client đọc '
            '`data.symbol` đang là undefined — F6 đã bị bọc mà chỗ này '
            'chưa được sửa')
        self.assertEqual(data['symbol'], 'VNM')

    def test_scheduler_still_writes_job_key_beside_results(self):
        """Chỉ ghim **quy tắc**, không cần dựng dữ liệu scheduler.

        Cố ý không gọi view: phần cần ghim là **vị trí ghi key**, và điều đó thể
        hiện ngay trong mã. Gọi view sẽ thêm phụ thuộc Celery/Redis vào một test
        vốn chỉ nói về hình dạng envelope.
        """
        source = (
            Path(__file__).resolve().parents[1] / 'src'
            / 'service_ops' / 'views' / 'scheduler.py'
        ).read_text(encoding='utf-8')

        self.assertIn(
            "response.data['job_key'] = job_key", source,
            'scheduler.py không còn ghi `job_key` cạnh `results` — nếu vừa đổi '
            'thì phải xem lại vị trí ghi so với hình dạng envelope F6')
