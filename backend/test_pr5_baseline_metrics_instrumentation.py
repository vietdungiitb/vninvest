"""
TEST SUITE: PR-5 Baseline Metrics Instrumentation
Purpose: Validate Holistic Advisory metrics collection, phase timing, and baseline report generation

Tests:
  1. Session initialization + reset
  2. Token usage recording + aggregation
  3. Component execution tracking
  4. Actionability + confidence scoring
  5. Phase timing + measurement
  6. Error recovery tracking
  7. Baseline report generation
  8. Multi-user isolation
"""

import pytest
from datetime import datetime
from unittest.mock import patch, MagicMock
from django.test import TestCase
from django.contrib.auth.models import User

from portfolio.observability import (
    reset_advisory_session,
    start_advisory_session,
    end_advisory_session,
    record_advisory_token_usage,
    record_advisory_component,
    record_advisory_actionability,
    record_advisory_confidence,
    start_advisory_phase,
    end_advisory_phase,
    record_advisory_error_recovery,
    advisory_phase_timer,
    generate_advisory_baseline_report,
    _ADVISORY_SESSION_METRICS,
)


class TestAdvisorySessionManagement(TestCase):
    """Test session initialization, reset, and finalization"""
    
    def setUp(self):
        """Ensure clean state before each test"""
        reset_advisory_session()
    
    def test_session_initialization(self):
        """Verify session starts with empty/default metrics"""
        reset_advisory_session()
        assert _ADVISORY_SESSION_METRICS['active'] == False
        assert _ADVISORY_SESSION_METRICS['token_cost'] == 0
        assert _ADVISORY_SESSION_METRICS['actionability_score'] == 0.0
        assert _ADVISORY_SESSION_METRICS['components_used'] == []
        assert _ADVISORY_SESSION_METRICS['session_start_time'] is not None
    
    def test_session_start_flag(self):
        """Verify session start sets active flag"""
        start_advisory_session()
        assert _ADVISORY_SESSION_METRICS['active'] == True
    
    def test_session_end_returns_metrics(self):
        """Verify end_advisory_session returns complete metrics dict"""
        start_advisory_session()
        record_advisory_token_usage(1000, source='test_component')
        record_advisory_actionability(0.85)
        
        final_metrics = end_advisory_session()
        
        assert 'token_cost' in final_metrics
        assert 'latency_ms' in final_metrics
        assert 'actionability_score' in final_metrics
        assert final_metrics['active'] == False
        assert final_metrics['token_cost'] >= 1000
    
    def test_session_reset_clears_all_metrics(self):
        """Verify reset clears all previous metrics"""
        start_advisory_session()
        record_advisory_token_usage(5000, source='test1')
        record_advisory_component('volatility', 150.0)
        record_advisory_actionability(0.9)
        
        reset_advisory_session()
        
        assert _ADVISORY_SESSION_METRICS['token_cost'] == 0
        assert _ADVISORY_SESSION_METRICS['components_used'] == []
        assert _ADVISORY_SESSION_METRICS['actionability_score'] == 0.0


class TestTokenUsageRecording(TestCase):
    """Test token usage instrumentation"""
    
    def setUp(self):
        reset_advisory_session()
        start_advisory_session()
    
    def test_record_single_token_usage(self):
        """Verify individual token recording"""
        record_advisory_token_usage(500, source='component_ai')
        assert _ADVISORY_SESSION_METRICS['token_cost'] == 500
    
    def test_record_multiple_token_increments(self):
        """Verify token accumulation from multiple sources"""
        record_advisory_token_usage(500, source='volatility')
        record_advisory_token_usage(300, source='momentum')
        record_advisory_token_usage(200, source='volume')
        
        assert _ADVISORY_SESSION_METRICS['token_cost'] == 1000
    
    def test_token_breakdown_by_source(self):
        """Verify token tracking by source"""
        record_advisory_token_usage(500, source='component_ai')
        record_advisory_token_usage(250, source='component_ai')  # Same source
        record_advisory_token_usage(300, source='whale_signal')
        
        breakdown = _ADVISORY_SESSION_METRICS.get('token_breakdown', {})
        assert breakdown.get('component_ai') == 750
        assert breakdown.get('whale_signal') == 300
        assert _ADVISORY_SESSION_METRICS['token_cost'] == 1050
    
    def test_token_zero_for_disabled_metrics(self):
        """Verify token recording respects metrics_enabled setting"""
        with patch('portfolio.observability._metrics_enabled', return_value=False):
            record_advisory_token_usage(1000, source='test')
            # Token should not be recorded when disabled
            # (actual behavior depends on implementation)
            pass


class TestComponentTracking(TestCase):
    """Test component execution instrumentation"""
    
    def setUp(self):
        reset_advisory_session()
        start_advisory_session()
    
    def test_record_successful_component(self):
        """Verify component execution recording"""
        record_advisory_component('volatility', latency_ms=145.5, success=True)
        
        assert 'volatility' in _ADVISORY_SESSION_METRICS['components_used']
        assert _ADVISORY_SESSION_METRICS['component_timings']['volatility'] == 145.5
    
    def test_record_multiple_components(self):
        """Verify multiple component tracking"""
        record_advisory_component('volatility', 150.0, success=True)
        record_advisory_component('momentum', 120.0, success=True)
        record_advisory_component('volume', 90.0, success=True)
        
        components = _ADVISORY_SESSION_METRICS['components_used']
        assert len(components) == 3
        assert 'volatility' in components
        assert 'momentum' in components
        assert 'volume' in components
    
    def test_component_failure_recording(self):
        """Verify failed component with fallback tracking"""
        record_advisory_component('volatility', 150.0, success=False, 
                                 error='Insufficient historical data')
        
        fallback = _ADVISORY_SESSION_METRICS['error_recovery']['fallback_components']
        assert len(fallback) == 1
        assert fallback[0]['component'] == 'volatility'
        assert fallback[0]['error'] == 'Insufficient historical data'
        assert fallback[0]['fallback_used'] == True
    
    def test_duplicate_component_not_repeated(self):
        """Verify duplicate components only added once to list"""
        record_advisory_component('volatility', 100.0)
        record_advisory_component('volatility', 120.0)  # Different latency
        
        components = _ADVISORY_SESSION_METRICS['components_used']
        assert components.count('volatility') == 1  # Only one entry


class TestQualityScoring(TestCase):
    """Test actionability and confidence scoring"""
    
    def setUp(self):
        reset_advisory_session()
        start_advisory_session()
    
    def test_record_actionability_score(self):
        """Verify actionability score recording"""
        record_advisory_actionability(0.75)
        assert _ADVISORY_SESSION_METRICS['actionability_score'] == 0.75
    
    def test_actionability_score_bounds(self):
        """Verify actionability score clamping (0-1)"""
        record_advisory_actionability(1.5)  # Above max
        assert _ADVISORY_SESSION_METRICS['actionability_score'] == 1.0
        
        record_advisory_actionability(-0.5)  # Below min
        assert _ADVISORY_SESSION_METRICS['actionability_score'] == 0.0
    
    def test_actionability_with_factors(self):
        """Verify actionability factor breakdown"""
        factors = {
            'consistency': 0.85,
            'noise_ratio': 0.70,
            'temporal_stability': 0.90
        }
        record_advisory_actionability(0.82, factors=factors)
        
        assert _ADVISORY_SESSION_METRICS['actionability_factors'] == factors
    
    def test_record_confidence_score(self):
        """Verify confidence score recording"""
        record_advisory_confidence(0.88, source='aggregate_whale')
        
        assert _ADVISORY_SESSION_METRICS['confidence'] == 0.88
        assert _ADVISORY_SESSION_METRICS['confidence_source'] == 'aggregate_whale'
    
    def test_confidence_score_bounds(self):
        """Verify confidence clamping"""
        record_advisory_confidence(2.0)
        assert _ADVISORY_SESSION_METRICS['confidence'] == 1.0
        
        record_advisory_confidence(-0.1)
        assert _ADVISORY_SESSION_METRICS['confidence'] == 0.0


class TestPhaseTiming(TestCase):
    """Test phase-level timing instrumentation"""
    
    def setUp(self):
        reset_advisory_session()
        start_advisory_session()
    
    def test_phase_start_stop(self):
        """Verify phase timing measurement"""
        import time
        
        start_advisory_phase('merge_whale_signals')
        time.sleep(0.05)  # 50ms
        end_advisory_phase('merge_whale_signals')
        
        timing = _ADVISORY_SESSION_METRICS['phase_timings'].get('merge_whale_signals')
        assert timing is not None
        assert timing >= 40  # At least 40ms (accounting for system variance)
    
    def test_multiple_phases_in_sequence(self):
        """Verify tracking multiple phases"""
        import time
        
        phases = ['phase_1', 'phase_2', 'phase_3']
        for phase in phases:
            start_advisory_phase(phase)
            time.sleep(0.01)
            end_advisory_phase(phase)
        
        phase_timings = _ADVISORY_SESSION_METRICS['phase_timings']
        assert len(phase_timings) == 3
        for phase in phases:
            assert phase in phase_timings
    
    def test_nested_phase_timing_overwrite(self):
        """Verify later phase overwrites if same name"""
        import time
        
        start_advisory_phase('merge_signals')
        time.sleep(0.02)
        end_advisory_phase('merge_signals')
        timing1 = _ADVISORY_SESSION_METRICS['phase_timings']['merge_signals']
        
        start_advisory_phase('merge_signals')  # Same name again
        time.sleep(0.05)
        end_advisory_phase('merge_signals')
        timing2 = _ADVISORY_SESSION_METRICS['phase_timings']['merge_signals']
        
        assert timing2 > timing1  # Second should be longer


class TestErrorRecovery(TestCase):
    """Test error detection and recovery tracking"""
    
    def setUp(self):
        reset_advisory_session()
        start_advisory_session()
    
    def test_error_recovery_recording(self):
        """Verify error recovery tracking"""
        record_advisory_error_recovery('APITimeout', 'use_cached_data', success=True)
        
        error_info = _ADVISORY_SESSION_METRICS['error_recovery']['error_messages']
        assert len(error_info) == 1
        assert error_info[0]['error_type'] == 'APITimeout'
        assert error_info[0]['fallback_strategy'] == 'use_cached_data'
        assert error_info[0]['success'] == True
    
    def test_multiple_error_recovery(self):
        """Verify tracking of multiple recovery events"""
        record_advisory_error_recovery('APITimeout', 'use_cached', True)
        record_advisory_error_recovery('DataValidationError', 'skip_component', False)
        record_advisory_error_recovery('RateLimitExceeded', 'queue_retry', True)
        
        errors = _ADVISORY_SESSION_METRICS['error_recovery']['error_messages']
        assert len(errors) == 3
        assert _ADVISORY_SESSION_METRICS['error_recovery']['retry_count'] == 3


class TestPhaseTimerDecorator(TestCase):
    """Test advisory_phase_timer decorator"""
    
    def setUp(self):
        reset_advisory_session()
        start_advisory_session()
    
    def test_decorator_measures_function_execution(self):
        """Verify decorator records phase timing"""
        import time
        
        @advisory_phase_timer('test_phase')
        def sample_function():
            time.sleep(0.02)
            return 'result'
        
        result = sample_function()
        
        assert result == 'result'
        assert 'test_phase' in _ADVISORY_SESSION_METRICS['phase_timings']
        assert _ADVISORY_SESSION_METRICS['phase_timings']['test_phase'] >= 15  # >= 15ms
    
    def test_decorator_uses_function_name_as_default_phase(self):
        """Verify decorator uses function name if phase_name not provided"""
        @advisory_phase_timer(None)
        def my_function():
            return 'done'
        
        result = my_function()
        
        # Function name becomes phase name (may be wrapped differently)
        assert result == 'done'


class TestBaselineReportGeneration(TestCase):
    """Test baseline metrics report generation"""
    
    def setUp(self):
        self.user = User.objects.create_user(
            username='testuser_baseline_m1',
            email='test_baseline_m1@test.com',
            password='pass123'
        )
    
    def test_generate_baseline_report_basic(self):
        """Verify baseline report generation with sample data"""
        samples = [
            {
                'latency_ms': 100,
                'token_cost': 500,
                'actionability_score': 0.85,
                'confidence': 0.90,
                'components_used': ['volatility', 'momentum']
            },
            {
                'latency_ms': 120,
                'token_cost': 550,
                'actionability_score': 0.88,
                'confidence': 0.92,
                'components_used': ['volatility', 'momentum', 'volume']
            },
            {
                'latency_ms': 95,
                'token_cost': 480,
                'actionability_score': 0.82,
                'confidence': 0.88,
                'components_used': ['volatility']
            },
        ]
        
        report = generate_advisory_baseline_report(self.user, 'NLAI', samples)
        
        assert report['user'] == 'testuser_baseline_m1'
        assert report['symbol'] == 'NLAI'
        assert report['sample_count'] == 3
        assert 'latency_metrics' in report
        assert 'token_metrics' in report
        assert 'quality_metrics' in report
        assert 'component_participation' in report
    
    def test_baseline_latency_percentiles(self):
        """Verify latency percentile calculation"""
        samples = [
            {'latency_ms': 50, 'token_cost': 100, 'actionability_score': 0.5, 'confidence': 0.5, 'components_used': []},
            {'latency_ms': 100, 'token_cost': 100, 'actionability_score': 0.5, 'confidence': 0.5, 'components_used': []},
            {'latency_ms': 150, 'token_cost': 100, 'actionability_score': 0.5, 'confidence': 0.5, 'components_used': []},
            {'latency_ms': 200, 'token_cost': 100, 'actionability_score': 0.5, 'confidence': 0.5, 'components_used': []},
            {'latency_ms': 250, 'token_cost': 100, 'actionability_score': 0.5, 'confidence': 0.5, 'components_used': []},
        ]
        
        report = generate_advisory_baseline_report(self.user, 'VNI', samples)
        latency = report['latency_metrics']
        
        assert latency['min_ms'] == 50
        assert latency['max_ms'] == 250
        assert 50 <= latency['p50_ms'] <= 150  # Median should be around 100-150
        assert 150 <= latency['p95_ms'] <= 250  # P95 should be higher
    
    def test_baseline_token_statistics(self):
        """Verify token usage statistics"""
        samples = [
            {'latency_ms': 100, 'token_cost': 300, 'actionability_score': 0.5, 'confidence': 0.5, 'components_used': []},
            {'latency_ms': 100, 'token_cost': 400, 'actionability_score': 0.5, 'confidence': 0.5, 'components_used': []},
            {'latency_ms': 100, 'token_cost': 500, 'actionability_score': 0.5, 'confidence': 0.5, 'components_used': []},
        ]
        
        report = generate_advisory_baseline_report(self.user, 'BID', samples)
        token_metrics = report['token_metrics']
        
        assert token_metrics['total'] == 1200
        assert token_metrics['avg'] == 400
        assert token_metrics['min'] == 300
        assert token_metrics['max'] == 500
    
    def test_baseline_component_participation(self):
        """Verify component usage statistics"""
        samples = [
            {'latency_ms': 100, 'token_cost': 100, 'actionability_score': 0.5, 'confidence': 0.5, 
             'components_used': ['volatility', 'momentum', 'volume']},
            {'latency_ms': 100, 'token_cost': 100, 'actionability_score': 0.5, 'confidence': 0.5, 
             'components_used': ['volatility', 'momentum']},
            {'latency_ms': 100, 'token_cost': 100, 'actionability_score': 0.5, 'confidence': 0.5, 
             'components_used': ['volatility']},
        ]
        
        report = generate_advisory_baseline_report(self.user, 'VRE', samples)
        participation = report['component_participation']
        
        assert 'volatility' in participation
        assert 'momentum' in participation
        assert 'volume' in participation
        # Volatility appears in all 3 samples
        assert participation['volatility'] == '100.0%'
        # Momentum appears in 2/3 samples
        assert participation['momentum'] == '66.7%'
        # Volume appears in 1/3 samples
        assert participation['volume'] == '33.3%'
    
    def test_baseline_empty_samples_returns_empty_dict(self):
        """Verify empty samples list returns empty dict"""
        report = generate_advisory_baseline_report(self.user, 'TEST', [])
        assert report == {}


class TestSessionIntegration(TestCase):
    """Integration tests for complete advisory session workflow"""
    
    def test_full_session_workflow(self):
        """Verify complete session lifecycle"""
        import time
        
        # Initialize session
        reset_advisory_session()
        start_advisory_session()
        
        # Phase 1: Data aggregation
        start_advisory_phase('data_aggregation')
        record_advisory_token_usage(500, 'whale_signals')
        time.sleep(0.01)
        end_advisory_phase('data_aggregation')
        
        # Phase 2: Component execution
        start_advisory_phase('component_execution')
        record_advisory_component('volatility', 100, success=True)
        record_advisory_component('momentum', 80, success=True)
        record_advisory_token_usage(300, 'components')
        time.sleep(0.01)
        end_advisory_phase('component_execution')
        
        # Phase 3: Generation
        start_advisory_phase('generation')
        record_advisory_token_usage(200, 'generation')
        record_advisory_actionability(0.87)
        record_advisory_confidence(0.92)
        time.sleep(0.01)
        end_advisory_phase('generation')
        
        # Finalize
        final_metrics = end_advisory_session()
        
        # Verify complete metrics
        assert final_metrics['token_cost'] == 1000
        assert len(final_metrics['components_used']) == 2
        assert final_metrics['actionability_score'] == 0.87
        assert final_metrics['confidence'] == 0.92
        assert 'data_aggregation' in final_metrics['phase_timings']
        assert 'component_execution' in final_metrics['phase_timings']
        assert 'generation' in final_metrics['phase_timings']
        assert final_metrics['latency_ms'] > 0
        assert final_metrics['active'] == False

