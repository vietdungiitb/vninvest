from datetime import timedelta

from django.test import override_settings
from django.test import SimpleTestCase
from django.utils import timezone

from portfolio.realtime.compute import WhaleSignal, build_whale_payload
from portfolio.whale_scoring import calculate_display_score, calculate_event_score, classify_severity, resolve_whale_score_config


class WhaleScoringTests(SimpleTestCase):
    def test_event_score_is_deterministic_for_same_input(self):
        config = resolve_whale_score_config()
        trade = {'matched_value': 2_000_000_000, 'threshold': 500_000_000, 'side': 'buy'}
        context = {'threshold_vnd': 500_000_000, 'side': 'buy'}

        first = calculate_event_score(trade=trade, context=context, config=config)
        second = calculate_event_score(trade=trade, context=context, config=config)

        self.assertEqual(first['event_score'], second['event_score'])
        self.assertEqual(first['score_breakdown'], second['score_breakdown'])
        self.assertEqual(first['weights_version'], config['version'])

    def test_display_score_applies_time_decay_and_severity(self):
        config = resolve_whale_score_config()
        occurred_at = timezone.now() - timedelta(minutes=30)

        result = calculate_display_score(event_score=80, occurred_at=occurred_at, now=timezone.now(), config=config)

        self.assertLess(result['display_score'], 80)
        self.assertGreaterEqual(result['age_seconds'], 1800)
        self.assertIn(result['severity'], {'low', 'medium', 'high', 'extreme'})

    def test_classify_severity_uses_band_contract(self):
        config = resolve_whale_score_config()

        self.assertEqual(classify_severity(10, config), 'low')
        self.assertEqual(classify_severity(35, config), 'medium')
        self.assertEqual(classify_severity(55, config), 'high')
        self.assertEqual(classify_severity(90, config), 'extreme')

    def test_whale_payload_includes_scoring_contract_fields(self):
        occurred_at = timezone.now().isoformat()
        payload = build_whale_payload(
            signal=WhaleSignal(
                symbol='FPT',
                matched_value=5_400_000_000,
                side='BUY',
                threshold=500_000_000,
                ts=occurred_at,
            ),
            seq=12,
        )

        self.assertEqual(payload['event_type'], 'whale_alert')
        normalized_ts = payload['ts']
        self.assertEqual(payload['event_id'], f'whale:FPT:{normalized_ts}:buy:5400000000')
        self.assertEqual(payload['symbol'], 'FPT')
        self.assertEqual(payload['side'], 'buy')
        self.assertEqual(payload['config_version'], 'threshold-v1')
        self.assertEqual(payload['source'], 'intraday-engine')
        self.assertEqual(payload['size_class'], 'shark')
        self.assertIn('event_score', payload)
        self.assertIn('display_score', payload)
        self.assertIn('severity', payload)
        self.assertIn('weights_version', payload)
        self.assertLessEqual(payload['display_score'], payload['event_score'])
        self.assertIn(payload['severity'], {'low', 'medium', 'high', 'extreme'})

    @override_settings(WHALE_SCORE_PROFILE='v1')
    def test_profile_v1_keeps_default_contract(self):
        config = resolve_whale_score_config()
        self.assertEqual(config['profile'], 'v1')
        self.assertEqual(config['version'], 'weights-v1')
        self.assertEqual(classify_severity(76, config), 'extreme')

    @override_settings(WHALE_SCORE_PROFILE='v2')
    def test_profile_v2_uses_stricter_extreme_band(self):
        config = resolve_whale_score_config()
        self.assertEqual(config['profile'], 'v2')
        self.assertEqual(config['version'], 'weights-v2')
        self.assertEqual(classify_severity(80, config), 'high')
        self.assertEqual(classify_severity(84, config), 'extreme')

    @override_settings(WHALE_SCORE_PROFILE='v2')
    def test_profile_v2_reduces_near_threshold_buy_boost(self):
        trade = {'matched_value': 560_000_000, 'threshold': 500_000_000, 'side': 'buy'}
        context = {'threshold_vnd': 500_000_000, 'side': 'buy'}

        with override_settings(WHALE_SCORE_PROFILE='v1'):
            v1_score = calculate_event_score(trade=trade, context=context, config=resolve_whale_score_config())

        v2_score = calculate_event_score(trade=trade, context=context, config=resolve_whale_score_config())

        self.assertLess(v2_score['event_score'], v1_score['event_score'])
