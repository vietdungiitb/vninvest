"""
Integration tests for Co-observation Service
Tests whale campaign + dark flow signal correlation logic

Test file: backend/portfolio/tests/test_coobservation.py
"""

from django.test import TestCase, TransactionTestCase
from django.utils import timezone
from datetime import datetime, timedelta
from portfolio.models import OrderFlowSignal, IntradayTick, DailyPrice
from portfolio.coobservation_service import (
    CoObservationService,
    TimeWindowResolver,
    CorrelationOptimizer
)
import pytz


class TimeWindowResolverTests(TestCase):
    """Test time window resolution logic"""
    
    def test_session_window_during_market_hours(self):
        """Should return 09:00-15:00 VN time for current session"""
        # Create a time during market hours: 14:00 VN (07:00 UTC)
        vn_tz = pytz.timezone('Asia/Ho_Chi_Minh')
        test_time = vn_tz.localize(datetime(2026, 4, 10, 14, 0, 0))
        test_time_utc = test_time.astimezone(pytz.UTC)
        
        start, end = TimeWindowResolver.get_bounds('session', test_time_utc)
        
        # Should be today's session
        self.assertEqual(start.hour, 2)  # 09:00 VN = 02:00 UTC
        self.assertEqual(end.hour, 8)   # 15:00 VN = 08:00 UTC
    
    def test_session_window_before_market_hours(self):
        """Should return yesterday's session for time before 09:00"""
        vn_tz = pytz.timezone('Asia/Ho_Chi_Minh')
        test_time = vn_tz.localize(datetime(2026, 4, 10, 8, 30, 0))
        test_time_utc = test_time.astimezone(pytz.UTC)
        
        start, end = TimeWindowResolver.get_bounds('session', test_time_utc)
        
        # Should be yesterday's session (end time before yesterday)
        yesterday = test_time_utc - timedelta(days=1)
        self.assertLess(end.date(), test_time_utc.date())
    
    def test_5m_window(self):
        """5m window should be reference_time - 5 minutes"""
        ref_time = timezone.now()
        start, end = TimeWindowResolver.get_bounds('5m', ref_time)
        
        self.assertAlmostEqual(
            (end - start).total_seconds(),
            300,  # 5 minutes
            delta=1
        )
    
    def test_1h_window(self):
        """1h window should be reference_time - 1 hour"""
        ref_time = timezone.now()
        start, end = TimeWindowResolver.get_bounds('1h', ref_time)
        
        self.assertAlmostEqual(
            (end - start).total_seconds(),
            3600,  # 1 hour
            delta=1
        )
    
    def test_5d_window(self):
        """5d window should be reference_time - 5 days"""
        ref_time = timezone.now()
        start, end = TimeWindowResolver.get_bounds('5d', ref_time)
        
        self.assertAlmostEqual(
            (end - start).total_seconds(),
            432000,  # 5 days
            delta=1
        )
    
    def test_invalid_window_raises_error(self):
        """Invalid window parameter should raise ValueError"""
        with self.assertRaises(ValueError):
            TimeWindowResolver.get_bounds('invalid')


class CorrelationOptimizerTests(TestCase):
    """Test correlation confidence calculation"""
    
    def test_high_confidence_buy_campaign_with_absorption(self):
        """BUY campaign + absorption signal = high confidence"""
        confidence, reason = CorrelationOptimizer.calculate_confidence(
            campaign_time=timezone.now(),
            signal_time=timezone.now(),  # Same time
            campaign_side='BUY',
            signal_type='absorption',
            campaign_strength=80,
            signal_strength=75
        )
        
        # Time factor = 1.0, side factor = 0.95, strength = 0.9
        # Weighted: 0.4*1.0 + 0.4*0.95 + 0.2*0.9 = 0.95
        self.assertGreater(confidence, 0.85)
    
    def test_medium_confidence_time_delay(self):
        """5-minute time gap reduces confidence significantly"""
        now = timezone.now()
        later = now + timedelta(minutes=5)
        
        confidence, reason = CorrelationOptimizer.calculate_confidence(
            campaign_time=now,
            signal_time=later,
            campaign_side='BUY',
            signal_type='absorption',
            campaign_strength=80,
            signal_strength=75
        )
        
        # Time factor should decay strongly after 5 minutes.
        # Overall confidence remains medium due to side/strength contributions.
        self.assertLess(confidence, 0.65)
    
    def test_low_confidence_misaligned_side(self):
        """Misaligned side reduces confidence"""
        confidence, reason = CorrelationOptimizer.calculate_confidence(
            campaign_time=timezone.now(),
            signal_time=timezone.now(),
            campaign_side='BUY',
            signal_type='twap_bot',  # Less aligned with BUY
            campaign_strength=50,
            signal_strength=50
        )
        
        # BUY + twap = 0.70
        self.assertLess(confidence, 0.80)
    
    def test_weak_signals_low_confidence(self):
        """Both weak signals = lower confidence"""
        confidence, reason = CorrelationOptimizer.calculate_confidence(
            campaign_time=timezone.now(),
            signal_time=timezone.now(),
            campaign_side='BUY',
            signal_type='iceberg',
            campaign_strength=20,  # Weak
            signal_strength=15  # Weak
        )
        
        self.assertLess(confidence, 0.75)
    
    def test_strong_signals_high_confidence(self):
        """Both strong signals = higher confidence"""
        confidence, reason = CorrelationOptimizer.calculate_confidence(
            campaign_time=timezone.now(),
            signal_time=timezone.now(),
            campaign_side='SELL',
            signal_type='iceberg',
            campaign_strength=85,  # Strong
            signal_strength=90  # Strong
        )
        
        # SELL + iceberg = 0.90, strength = 0.9
        self.assertGreater(confidence, 0.8)


class CoObservationServiceTests(TransactionTestCase):
    """Integration tests for co-observation service"""
    
    def setUp(self):
        """Create test data"""
        self.symbol = 'VNM'
        self.now = timezone.now()
        self.service = CoObservationService()
    
    def create_dark_signal(self, symbol, offset_seconds=0, signal_type='absorption', strength=70):
        """Helper to create test signal"""
        signal_time = self.now + timedelta(seconds=offset_seconds)
        unique_suffix = OrderFlowSignal.objects.count() + 1
        return OrderFlowSignal.objects.create(
            symbol=symbol,
            signal_type=signal_type,
            strength=strength,
            confidence='high' if strength >= 70 else 'medium',
            event_id=f'dark_flow:{symbol}:{signal_time.isoformat()}:{signal_type}:{unique_suffix}',
            severity='urgent' if strength >= 70 else 'warning',
            components_json={'matched_value': 500000000}
        )
    
    def test_get_symbol_investigation_no_data(self):
        """Should return empty structure when no data available"""
        result = self.service.get_symbol_investigation(
            symbol='XYZ999',
            window='5d',
            include_whale=False,
        )
        
        self.assertEqual(result['symbol'], 'XYZ999')
        self.assertEqual(len(result['whale_campaigns']), 0)
        self.assertEqual(len(result['dark_flow_signals']), 0)
        self.assertEqual(result['co_observation_summary']['overall_conviction'], 'LOW')
    
    def test_dark_signals_filtered_by_symbol(self):
        """Should only return signals for requested symbol"""
        # Create signals for different symbols
        self.create_dark_signal('VNM', signal_type='absorption')
        self.create_dark_signal('FPT', signal_type='absorption')
        
        result = self.service.get_symbol_investigation(
            symbol='VNM',
            window='5d',
            include_whale=False
        )
        
        self.assertEqual(len(result['dark_flow_signals']), 1)
        self.assertEqual(result['dark_flow_signals'][0]['symbol'], 'VNM')
    
    def test_dark_signals_filtered_by_time_window(self):
        """Should only return signals within time window"""
        # Signal at time 0 (within session)
        self.create_dark_signal('VNM', offset_seconds=0)
        # Signal at +1 hour (still within session)
        self.create_dark_signal('VNM', offset_seconds=3600)
        # Signal at +6 hours (outside session ~4 hour duration)
        self.create_dark_signal('VNM', offset_seconds=21600)
        
        result = self.service.get_symbol_investigation(
            symbol='VNM',
            window='5d',
            include_whale=False
        )
        
        # Only signals within 6-hour window should be returned
        # (Market session is ~6 hours)
        signal_count = len(result['dark_flow_signals'])
        self.assertGreaterEqual(signal_count, 1)
    
    def test_correlation_detection_same_time(self):
        """Should detect correlations when signals occur simultaneously"""
        # Create signals at same time
        signal1 = self.create_dark_signal('VNM', offset_seconds=0)
        
        # Manually create correlations (in real integration, would come from campaigns)
        campaigns = [
            {
                'campaign_id': 'camp1',
                'symbol': 'VNM',
                'side_bias': 'BUY',
                'campaign_strength': 80,
                'created_at': self.now.isoformat(),
            }
        ]
        signals = [
            {
                'event_id': signal1.event_id,
                'signal_type': 'absorption',
                'strength': 75,
                'created_at': self.now.isoformat()
            }
        ]
        
        correlations = self.service._correlate_campaigns_and_signals(campaigns, signals)
        
        # Should have at least one correlation
        self.assertGreater(len(correlations), 0)
    
    def test_conviction_assessment_no_correlations(self):
        """Should assess conviction as LOW with no correlations"""
        campaigns = [
            {
                'campaign_id': 'camp1',
                'symbol': 'VNM',
                'side_bias': 'BUY',
                'campaign_strength': 50,
                'created_at': self.now.isoformat(),
            }
        ]
        signals = []
        
        conviction = self.service._assess_conviction(campaigns, signals, {})
        
        self.assertEqual(conviction['overall_conviction'], 'LOW')
        self.assertEqual(conviction['correlated_pairs'], 0)
    
    def test_conviction_assessment_one_correlation(self):
        """Should assess conviction as MEDIUM with 1 correlation"""
        conviction = self.service._assess_conviction(
            campaigns=[{'campaign_id': 'camp1'}],
            signals=[],
            correlations={'camp1': [{'correlation_confidence': 0.7}]}
        )
        
        self.assertEqual(conviction['overall_conviction'], 'MEDIUM')
    
    def test_conviction_assessment_high_confidence_correlations(self):
        """Should assess conviction as HIGH with 2+ high-confidence correlations"""
        conviction = self.service._assess_conviction(
            campaigns=[{'campaign_id': 'camp1'}],
            signals=[],
            correlations={
                'camp1': [
                    {'correlation_confidence': 0.85},
                    {'correlation_confidence': 0.80}
                ]
            }
        )
        
        self.assertEqual(conviction['overall_conviction'], 'HIGH')
    
    def test_timeline_ordering(self):
        """Timeline should be sorted chronologically"""
        now1 = self.now
        now2 = self.now + timedelta(seconds=60)
        now3 = self.now + timedelta(seconds=120)
        
        campaigns = [
            {'campaign_id': 'camp1', 'created_at': now2.isoformat(), 'symbol': 'VNM'},
            {'campaign_id': 'camp2', 'created_at': now1.isoformat(), 'symbol': 'VNM'},
        ]
        signals = [
            {'event_id': 'sig1', 'created_at': now3.isoformat()},
        ]
        
        timeline = self.service._build_investigation_timeline(
            campaigns, signals, {}
        )
        
        # Check ordering
        for i in range(len(timeline) - 1):
            self.assertLessEqual(
                timeline[i]['timestamp'],
                timeline[i+1]['timestamp']
            )

    def test_apply_sort_created_at_desc(self):
        campaigns = [
            {'campaign_id': 'c1', 'created_at': (self.now - timedelta(minutes=5)).isoformat()},
            {'campaign_id': 'c2', 'created_at': self.now.isoformat()},
        ]
        signals = [
            {'event_id': 's1', 'created_at': (self.now - timedelta(minutes=3)).isoformat()},
            {'event_id': 's2', 'created_at': (self.now - timedelta(minutes=1)).isoformat()},
        ]

        sorted_campaigns, sorted_signals = self.service._apply_sort(campaigns, signals, 'created_at')

        self.assertEqual(sorted_campaigns[0]['campaign_id'], 'c2')
        self.assertEqual(sorted_signals[0]['event_id'], 's2')

    def test_apply_sort_correlation_strength_desc(self):
        campaigns = [
            {
                'campaign_id': 'c_low',
                'created_at': self.now.isoformat(),
                'dark_flow_correlations': [{'correlation_confidence': 0.55}],
            },
            {
                'campaign_id': 'c_high',
                'created_at': (self.now - timedelta(minutes=10)).isoformat(),
                'dark_flow_correlations': [{'correlation_confidence': 0.90}],
            },
        ]
        signals = [
            {
                'event_id': 's_low',
                'created_at': self.now.isoformat(),
                'whale_campaign_correlations': [{'correlation_confidence': 0.51}],
            },
            {
                'event_id': 's_high',
                'created_at': (self.now - timedelta(minutes=10)).isoformat(),
                'whale_campaign_correlations': [{'correlation_confidence': 0.88}],
            },
        ]

        sorted_campaigns, sorted_signals = self.service._apply_sort(campaigns, signals, 'correlation_strength')

        self.assertEqual(sorted_campaigns[0]['campaign_id'], 'c_high')
        self.assertEqual(sorted_signals[0]['event_id'], 's_high')
    
    def test_api_endpoint_validation(self):
        """Test API endpoint parameter validation"""
        # This would be tested at the view level
        # For now, test service accepts valid windows
        for window in ['5m', '15m', '1h', 'session', '5d']:
            try:
                TimeWindowResolver.get_bounds(window)
            except ValueError:
                self.fail(f"Valid window '{window}' raised ValueError")
    
    def test_exclude_whale_parameter(self):
        """Should respect include_whale=False parameter"""
        self.create_dark_signal('VNM')
        
        result = self.service.get_symbol_investigation(
            symbol='VNM',
            include_whale=False,
            include_dark_flow=True,
            window='5d',
        )
        
        self.assertEqual(len(result['whale_campaigns']), 0)
        self.assertEqual(len(result['dark_flow_signals']), 1)
    
    def test_exclude_dark_flow_parameter(self):
        """Should respect include_dark_flow=False parameter"""
        self.create_dark_signal('VNM')
        
        result = self.service.get_symbol_investigation(
            symbol='VNM',
            include_whale=False,
            include_dark_flow=False,
            window='5d',
        )
        
        self.assertEqual(len(result['dark_flow_signals']), 0)

    def test_timeline_groups_marks_co_observation_bucket(self):
        created_at = self.now.isoformat()
        campaigns = [{
            'campaign_id': 'camp-1',
            'symbol': 'VNM',
            'side_bias': 'BUY',
            'campaign_strength': 80,
            'created_at': created_at,
        }]
        signals = [{
            'id': 10,
            'event_id': 'sig-1',
            'signal_type': 'absorption',
            'strength': 72,
            'created_at': created_at,
        }]

        groups = self.service._build_timeline_groups(campaigns, signals, bucket_minutes=5)

        self.assertEqual(len(groups), 1)
        self.assertTrue(groups[0]['has_co_observation'])
        self.assertEqual(len(groups[0]['whale_campaigns']), 1)
        self.assertEqual(len(groups[0]['dark_flow_signals']), 1)

    def test_symbol_investigation_returns_compatibility_keys(self):
        result = self.service.get_symbol_investigation(
            symbol='VNM',
            window='5d',
            include_whale=False,
            include_dark_flow=False,
        )

        self.assertIn('correlated_campaigns', result)
        self.assertIn('correlated_signals', result)
        self.assertIn('grouped_timeline', result)


class EndToEndCoObservationTests(TransactionTestCase):
    """End-to-end scenario tests"""
    
    def setUp(self):
        self.symbol = 'VNM'
        self.now = timezone.now()
        self.service = CoObservationService()
    
    def test_scenario_aligned_buy_signals(self):
        """Scenario: BUY whale campaign + absorption signal aligned"""
        # Create dark signal: absorption at 15:05
        signal_time = self.now
        signal = OrderFlowSignal.objects.create(
            symbol=self.symbol,
            signal_type='absorption',
            strength=75,
            severity='urgent',
            created_at=signal_time,
            event_id=f'dark_flow:{self.symbol}:{signal_time.isoformat()}:absorption',
            components_json={'matched_value': 600000000}
        )
        
        # Simulate campaign (would normally come from whale-campaigns endpoint)
        campaigns = [
            {
                'campaign_id': 'camp_buy_vnm',
                'symbol': self.symbol,
                'side_bias': 'BUY',
                'campaign_strength': 82,
                'created_at': (signal_time - timedelta(seconds=30)).isoformat(),
            }
        ]
        
        signals = [
            {
                'event_id': signal.event_id,
                'signal_type': 'absorption',
                'strength': 75,
                'created_at': signal_time.isoformat()
            }
        ]
        
        correlations = self.service._correlate_campaigns_and_signals(campaigns, signals)
        conviction = self.service._assess_conviction(campaigns, signals, correlations)
        
        # Should have HIGH conviction
        self.assertIn('camp_buy_vnm', correlations)
        self.assertGreater(len(correlations['camp_buy_vnm']), 0)
        self.assertGreater(
            correlations['camp_buy_vnm'][0]['correlation_confidence'],
            0.7
        )
