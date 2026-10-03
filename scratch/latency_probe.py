import os
import sys
import time
from pathlib import Path
from statistics import mean
from unittest.mock import MagicMock

import django
from django.conf import settings


REPO_ROOT = Path(__file__).resolve().parents[1]
BACKEND_ROOT = REPO_ROOT / 'backend'
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'vninvest.settings')
django.setup()


def _build_mock_advisory():
    advisory = MagicMock()
    advisory.id = 9999
    advisory.ai_summary = 'Audit Probe Summary'
    advisory.created_at.isoformat.return_value = '2026-04-21T13:45:00Z'
    return advisory


def measure_broadcast_latency(sample_size: int = 7) -> float:
    from portfolio.tasks_whale_broadcast import _broadcast_market_discovery_event

    settings.CHANNEL_LAYERS = {
        'default': {
            'BACKEND': 'channels.layers.InMemoryChannelLayer',
        }
    }

    advisory = _build_mock_advisory()

    # Warm-up to avoid first-call import/setup distortion.
    _broadcast_market_discovery_event(
        advisory=advisory,
        symbol='AUDIT',
        side='BUY',
        whale_intensity=92,
        discovery_bucket='anomaly',
    )

    latencies = []
    for _ in range(sample_size):
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
    print('=== Latency Probe: Whale Discovery Broadcast ===')
    print(f'Broadcast Function Latency: {latency_ms:.2f} ms')
    print(f'Result: {"PASS" if latency_ms < 250 else "FAIL"} (<250ms threshold)')
    return latency_ms


if __name__ == '__main__':
    measure_broadcast_latency()
