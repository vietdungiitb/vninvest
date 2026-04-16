from django.test import SimpleTestCase
import pandas as pd

from portfolio.realtime.tick_producer import TickProducer


class _FakePipeline:
    def __init__(self):
        self.calls = []

    def xadd(self, key, fields, maxlen=None, approximate=None):
        self.calls.append((key, fields, maxlen, approximate))

    def execute(self):
        return True


class _FakeRedisClient:
    def __init__(self):
        self.pipe = _FakePipeline()

    def pipeline(self, transaction=False):
        return self.pipe


class TickProducerTests(SimpleTestCase):
    def test_push_intraday_ticks_pushes_oldest_first_so_latest_stream_entry_is_newest_trade(self):
        producer = TickProducer()
        fake_client = _FakeRedisClient()
        producer._client = fake_client

        df = pd.DataFrame([
            {'ts': '2026-04-16T07:20:54Z', 'price': 81.3, 'volume': 600, 'side': 'BUY', 'price_unit': 'THOUSAND_VND'},
            {'ts': '2026-04-16T07:20:53Z', 'price': 81.3, 'volume': 30100, 'side': 'BUY', 'price_unit': 'THOUSAND_VND'},
            {'ts': '2026-04-16T07:20:50Z', 'price': 81.2, 'volume': 300, 'side': 'SELL', 'price_unit': 'THOUSAND_VND'},
        ])

        pushed = producer.push_intraday_ticks('MWG', df)

        self.assertEqual(pushed, 3)
        ts_order = [call[1]['ts'] for call in fake_client.pipe.calls]
        self.assertEqual(ts_order, [
            '2026-04-16T07:20:50Z',
            '2026-04-16T07:20:53Z',
            '2026-04-16T07:20:54Z',
        ])