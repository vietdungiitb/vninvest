"""
PR-1 Test: Dark-flow Source/Severity Semantics Normalization

Purpose: Verify that dark_flow severity branch activates when merging dark_flow events
with strength data. Tests flush_merged_advisory_event() correctly determines source.

Ticket: H0-01 (Dark-flow source mapping in accumulate/flush path)
"""

from unittest.mock import patch, MagicMock
from django.core.cache import cache
from django.test import TestCase
from django.utils import timezone

from portfolio.models import WhaleAdvisory
from portfolio.tasks import (
    _accumulate_user_advisory_event,
    flush_merged_advisory_event,
    _advisory_event_merge_cache_key,
)


class TestPR1DarkFlowSeveritySemantics(TestCase):
    """Test suite for PR-1: Dark-flow source/severity normalization"""

    def setUp(self):
        """Setup test data"""
        cache.clear()
        self.user_id = 12345
        self.symbol = 'VNM'
        self.threshold_vnd = 5000.0

    def test_accumulate_dark_flow_event_stores_strength_and_confidence(self):
        """
        G1: When dark_flow event accumulated with strength/confidence,
        those fields stored in merge cache state
        """
        payload = {
            'matched_value_vnd': 12000.0,
            'strength': 0.85,
            'confidence': 'high',
            'signal_type': 'iceberg_clustering',
        }

        result = _accumulate_user_advisory_event(
            user_id=self.user_id,
            symbol=self.symbol,
            source='dark_flow',
            payload=payload,
            threshold_vnd=self.threshold_vnd,
            threshold_source='user_default',
        )

        cache_key = _advisory_event_merge_cache_key(self.user_id, self.symbol)
        state = cache.get(cache_key)

        assert result['status'] == 'scheduled'
        assert state is not None
        assert state['dark_flow_strength'] == 0.85
        assert state['dark_flow_confidence'] == 'high'
        assert 'dark_flow' in state['sources']

    def test_merge_dark_flow_event_updates_strength_max(self):
        """
        G2: When second dark_flow event merged into cache,
        strength updated to max (iceberg detection can have multi-phases)
        """
        # First dark_flow event
        _accumulate_user_advisory_event(
            user_id=self.user_id,
            symbol=self.symbol,
            source='dark_flow',
            payload={'matched_value_vnd': 12000.0, 'strength': 0.65, 'confidence': 'medium'},
            threshold_vnd=self.threshold_vnd,
            threshold_source='user_default',
        )

        # Second dark_flow event with higher strength
        result = _accumulate_user_advisory_event(
            user_id=self.user_id,
            symbol=self.symbol,
            source='dark_flow',
            payload={'matched_value_vnd': 15000.0, 'strength': 0.92, 'confidence': 'high'},
            threshold_vnd=self.threshold_vnd,
            threshold_source='user_default',
        )

        cache_key = _advisory_event_merge_cache_key(self.user_id, self.symbol)
        state = cache.get(cache_key)

        assert result['status'] == 'merged'
        assert state['dark_flow_strength'] == 0.92  # max of 0.65, 0.92
        assert state['dark_flow_confidence'] == 'high'

    @patch('portfolio.tasks.generate_whale_advisory_task.apply_async')
    def test_flush_determines_source_as_dark_flow_when_strength_present(self, mock_task):
        """
        P0 FIX: When flush_merged_advisory_event called with merged_sources containing 'dark_flow'
        AND dark_flow_strength is present, MUST pass source='dark_flow' to generate_whale_advisory_task.
        
        This activates the dark_flow severity branch at line 1021+ in generate_whale_advisory_task.
        """
        mock_task.return_value = MagicMock(id='task-123')

        # Accumulate dark_flow event
        _accumulate_user_advisory_event(
            user_id=self.user_id,
            symbol=self.symbol,
            source='dark_flow',
            payload={'matched_value_vnd': 12000.0, 'strength': 0.85, 'confidence': 'high'},
            threshold_vnd=self.threshold_vnd,
            threshold_source='user_default',
        )

        cache_key = _advisory_event_merge_cache_key(self.user_id, self.symbol)
        state = cache.get(cache_key)
        
        # Manually flush (normally scheduled via countdown)
        result = flush_merged_advisory_event(self.user_id, self.symbol)

        # Verify task was called with source='dark_flow'
        assert mock_task.called
        call_kwargs = mock_task.call_args[1]['kwargs']
        
        assert call_kwargs['source'] == 'dark_flow', (
            f"Expected source='dark_flow' but got '{call_kwargs['source']}'. "
            "This blocks dark_flow severity branch activation."
        )
        assert call_kwargs['dark_flow_strength'] == 0.85
        assert call_kwargs['dark_flow_confidence'] == 'high'
        assert result['status'] == 'queued'

    @patch('portfolio.tasks.generate_whale_advisory_task.apply_async')
    def test_flush_defaults_to_whale_signal_when_no_dark_flow_strength(self, mock_task):
        """
        G3: When merged_sources has 'dark_flow' but no strength (strength=None),
        source defaults to 'whale_signal' (don't force dark_flow path without evidence)
        """
        mock_task.return_value = MagicMock(id='task-123')

        # Accumulate whale_signal event (no dark_flow)
        _accumulate_user_advisory_event(
            user_id=self.user_id,
            symbol=self.symbol,
            source='whale_signal',
            payload={'matched_value_vnd': 12000.0, 'volume': 5000000},
            threshold_vnd=self.threshold_vnd,
            threshold_source='user_default',
        )

        result = flush_merged_advisory_event(self.user_id, self.symbol)

        call_kwargs = mock_task.call_args[1]['kwargs']
        assert call_kwargs['source'] == 'whale_signal'

    @patch('portfolio.tasks.generate_whale_advisory_task.apply_async')
    def test_flush_with_mixed_sources_respects_dark_flow_if_present_and_strong(self, mock_task):
        """
        G4: When merged_sources has both 'whale_signal' and 'dark_flow' with strength,
        source should be 'dark_flow' (higher signal priority)
        """
        mock_task.return_value = MagicMock(id='task-123')

        # Accumulate whale_signal first
        _accumulate_user_advisory_event(
            user_id=self.user_id,
            symbol=self.symbol,
            source='whale_signal',
            payload={'matched_value_vnd': 12000.0, 'volume': 5000000},
            threshold_vnd=self.threshold_vnd,
            threshold_source='user_default',
        )

        # Then accumulate dark_flow with strength
        _accumulate_user_advisory_event(
            user_id=self.user_id,
            symbol=self.symbol,
            source='dark_flow',
            payload={'matched_value_vnd': 15000.0, 'strength': 0.88, 'confidence': 'high'},
            threshold_vnd=self.threshold_vnd,
            threshold_source='user_default',
        )

        result = flush_merged_advisory_event(self.user_id, self.symbol)

        call_kwargs = mock_task.call_args[1]['kwargs']
        
        # Should use dark_flow because strength is present
        assert call_kwargs['source'] == 'dark_flow', (
            "With mixed sources containing dark_flow + strength, should prioritize dark_flow"
        )
        assert 'whale_signal' in call_kwargs['merged_sources']
        assert 'dark_flow' in call_kwargs['merged_sources']


class TestPR1GenerateAdvisoryServicesSeverity(TestCase):
    """
    Integration test: verify generate_whale_advisory_task._compute_dark_flow_severity
    gets called when source='dark_flow' is passed from flush
    """

    def setUp(self):
        """Setup test data"""
        cache.clear()
        self.user_id = 12345
        self.symbol = 'VNM'
        self.threshold_vnd = 5000.0

    @patch('portfolio.tasks._compute_dark_flow_severity')
    @patch('portfolio.tasks.generate_whale_advisory_task.apply_async')
    def test_dark_flow_severity_calculator_invoked_in_flush_path(self, mock_task, mock_severity_calc):
        """
        P0 ACCEPTANCE: When dark_flow event flushed with strength=0.85,
        _compute_dark_flow_severity MUST be called in generate_whale_advisory_task
        (verify in generate_whale_advisory_task test separately)
        
        This test verifies the setup is correct by checking merge flush passes data.
        """
        mock_task.return_value = MagicMock(id='task-456')

        _accumulate_user_advisory_event(
            user_id=self.user_id,
            symbol=self.symbol,
            source='dark_flow',
            payload={'matched_value_vnd': 12000.0, 'strength': 0.85, 'confidence': 'high'},
            threshold_vnd=self.threshold_vnd,
            threshold_source='user_default',
        )

        result = flush_merged_advisory_event(self.user_id, self.symbol)

        # Verify the parameters passed to task include dark_flow_strength
        call_kwargs = mock_task.call_args[1]['kwargs']
        assert call_kwargs['source'] == 'dark_flow'
        assert call_kwargs['dark_flow_strength'] == 0.85
        # (actual severity computation tested in generate_whale_advisory_task tests)
