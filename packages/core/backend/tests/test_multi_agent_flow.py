import os
import sys
from datetime import date

_src_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'src'))
if _src_dir not in sys.path:
    sys.path.insert(0, _src_dir)

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'vninvest_core.settings')

import django
django.setup()

from django.test import TestCase, override_settings
from advisory.advisory_helpers import (
    _parse_prompt_config,
    build_ohlcv_lookback_context,
    build_cvd_lookback_context
)
from advisory.orchestrator import AdvisoryOrchestrator
from market_data.models import DailyPrice
from market_serving.models import SessionFacts, SymbolSnapshot


class MultiAgentFlowTests(TestCase):
    def test_parse_prompt_config_validates_and_clamps(self):
        # 1. Invalid input returns default configuration
        config_null = _parse_prompt_config(None)
        self.assertEqual(config_null["version"], 2)
        self.assertTrue(config_null["sources"]["technical"]["enabled"])
        self.assertEqual(config_null["sources"]["technical"]["lookback"], 20)

        # 2. Clamps lookback outside valid bounds
        raw_config = {
            "sources": {
                "technical": {"enabled": True, "lookback": 120, "indicators": ["rsi", "invalid_indicator"]},
                "whale": {"enabled": False, "lookback": -50}
            }
        }
        parsed = _parse_prompt_config(raw_config)
        self.assertEqual(parsed["sources"]["technical"]["lookback"], 60) # clamped to max 60
        self.assertEqual(parsed["sources"]["whale"]["lookback"], 1) # clamped to min 1
        self.assertFalse(parsed["sources"]["whale"]["enabled"])
        
        # 3. Filters invalid indicators
        self.assertIn("rsi", parsed["sources"]["technical"]["indicators"])
        self.assertNotIn("invalid_indicator", parsed["sources"]["technical"]["indicators"])

    def test_build_ohlcv_lookback_context_formats_correctly(self):
        symbol = "VIC"
        # Seed 3 DailyPrice records
        DailyPrice.objects.create(symbol=symbol, date=date(2026, 6, 18), open=10000, high=10500, low=9900, close=10200, volume=100000)
        DailyPrice.objects.create(symbol=symbol, date=date(2026, 6, 19), open=10200, high=10300, low=10100, close=10250, volume=150000)
        DailyPrice.objects.create(symbol=symbol, date=date(2026, 6, 20), open=10250, high=10800, low=10250, close=10700, volume=200000)

        context = build_ohlcv_lookback_context(symbol, limit=20)
        # Should contain date strings and close values
        self.assertIn("VIC", context)
        self.assertIn("2026-06-18", context)
        self.assertIn("2026-06-20", context)
        self.assertIn("10,700", context)
        self.assertIn("200,000", context)

    def test_build_cvd_lookback_context_formats_correctly(self):
        symbol = "VNM"
        # Seed 2 SessionFacts records
        SessionFacts.objects.create(symbol=symbol, session_date=date(2026, 6, 19), cvd_normalized=0.15, buy_strength=0.55, institutional_strength=0.45, whale_net_flow=1500000000)
        SessionFacts.objects.create(symbol=symbol, session_date=date(2026, 6, 20), cvd_normalized=-0.08, buy_strength=0.48, institutional_strength=0.38, whale_net_flow=-500000000)

        context = build_cvd_lookback_context(symbol, limit=20)
        self.assertIn("VNM", context)
        self.assertIn("2026-06-19", context)
        self.assertIn("2026-06-20", context)
        self.assertIn("0.150", context)
        self.assertIn("48.0%", context)
        self.assertIn("1,500,000,000", context)

    @override_settings(DEBUG=True)
    def test_orchestrator_mock_fallback_runs_correctly(self):
        symbol = "HPG"
        # Seed snapshots & facts
        SymbolSnapshot.objects.create(symbol=symbol, session_date=date(2026, 6, 20), price=28000, price_change_pct=0.02, volume=12000000)
        SessionFacts.objects.create(symbol=symbol, session_date=date(2026, 6, 20), cvd_normalized=0.25, buy_strength=0.58, institutional_strength=0.52, whale_net_flow=3000000000)

        effective_context = {
            "ai_model": "gpt-4o-mini",
            "api_key": "mock_key",
            "language": "vi",
            "prompt_config": None
        }

        result = AdvisoryOrchestrator.run(effective_context, symbol)
        self.assertEqual(result["ai_model"], "gpt-4o-mini")
        self.assertIn("HPG", result["advisory_text"])
        self.assertIn("MUA", result["advisory_text"])
        self.assertIn("whale_analysis", result)
        self.assertIn("technical_analysis", result)
        self.assertIn("sentiment_analysis", result)
        self.assertIn("recommendation", result)
