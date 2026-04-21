import time
from statistics import mean
from unittest.mock import MagicMock

from django.test import SimpleTestCase, override_settings

from portfolio.tasks_whale_broadcast import _broadcast_market_discovery_event


@override_settings(
    CHANNEL_LAYERS={
        'default': {
            'BACKEND': 'channels.layers.InMemoryChannelLayer',
        }
    }
)
class LatencyAuditTest(SimpleTestCase):
    def _build_advisory(self):
        advisory = MagicMock()
        advisory.id = 9999
        advisory.ai_summary = 'Audit Probe Summary'
        advisory.created_at.isoformat.return_value = '2026-04-21T13:45:00Z'
        return advisory

    def test_broadcast_latency(self):
        """
        Technical Audit: Measure discovery broadcast function latency.
        Requirement: < 250ms.
        """
        advisory = self._build_advisory()

        # Warm-up once to reduce one-time setup noise from the channel layer.
        _broadcast_market_discovery_event(
            advisory=advisory,
            symbol='AUDIT',
            side='BUY',
            whale_intensity=92,
            discovery_bucket='anomaly',
        )

        latencies = []
        for _ in range(7):
            start_time = time.perf_counter()
            _broadcast_market_discovery_event(
                advisory=advisory,
                symbol='AUDIT',
                side='BUY',
                whale_intensity=92,
                discovery_bucket='anomaly',
            )
            end_time = time.perf_counter()
            latencies.append((end_time - start_time) * 1000)

        latency_ms = mean(latencies)

        print(f'\nBroadcast Function Latency: {latency_ms:.2f} ms')
        self.assertLess(latency_ms, 250, f'Latency {latency_ms:.2f} ms exceeds 250ms threshold')
