"""
test_order_flow_source_parity.py — A2.3 Source parity validation for Sprint 34

Phạm vi:
  - Validate contract parity for /api/stock-management/stocks/<symbol>/order-flow/ endpoint
  - Ensure deterministic identity (event_id) stable across paginated reads
  - Verify pagination contract (limit/offset/cursor/has_more/next_cursor) consistent
  - Confirm severity mapping and field presence independent of data ordering
"""

from datetime import datetime, timezone
from unittest.mock import patch

from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from portfolio.models import OrderFlowSignal

User = get_user_model()


class SourceParityTestBase(TestCase):
    """Base class for source parity validation tests."""

    def setUp(self):
        """Set up test environment with authenticated client and pro DPI license."""
        from django.utils import timezone as tz
        from portfolio.opencore_dpi import DPILicense, DPIPlan

        self.client = APIClient()
        self.user = User.objects.create_user(username="parity-test", password="Test@123456")
        pro_plan, _ = DPIPlan.objects.update_or_create(
            name='pro',
            defaults={
                'description': 'pro test plan',
                'display_name': 'Professional',
                'annual_price_usd': 99,
                'monthly_price_usd': 9.99,
                'max_watchlist_items': 50,
                'max_portfolio_accounts': 5,
                'max_alerts': 100,
                'max_api_calls_per_month': 100000,
                'features': {
                    'sma': True, 'rsi': True, 'volume_profile': True,
                    'whale_momentum': True, 'dark_pool_flow': True,
                    'correlation_matrix': True, 'volatility_surface': True,
                    'sentiment_score': True, 'predictive_ml': True,
                    'cross_market_alpha': True, 'fund_flow_analysis': True,
                    'hedging_strategy': True,
                },
                'is_active': True,
            },
        )
        DPILicense.objects.update_or_create(
            user=self.user,
            defaults={
                'plan': pro_plan,
                'status': 'active',
                'billing_cycle': 'annual',
                'start_date': tz.now(),
                'expiry_date': tz.now() + tz.timedelta(days=30),
                'grace_until': None,
            },
        )
        self.user = User.objects.get(pk=self.user.pk)
        self.client.force_authenticate(user=self.user)
        self.symbol = 'ACB'
        self.base_time = datetime(2026, 4, 10, 10, 0, 0, tzinfo=timezone.utc)

    def _create_test_signals(self, count: int = 25):
        """Create deterministic test signals for parity validation."""
        signals = []
        for i in range(count):
            signal = OrderFlowSignal.objects.create(
                symbol=self.symbol,
                signal_type='mixed' if i % 2 == 0 else 'absorption',
                strength=40 + (i % 30),
                confidence='medium',
                tick_rate=25.5 + i,
                small_order_ratio=0.45,
                cvd_at_signal=1000000 + (i * 1000),
                price_at_signal=100.5 + (i * 0.1),
                window_seconds=300,
                event_id=f'dark_flow:{self.symbol}:{datetime.utcnow().isoformat()}:{i}',
                severity=self._compute_severity(40 + (i % 30)),
            )
            signals.append(signal)
        return signals

    def _compute_severity(self, strength: float) -> str:
        """Compute severity based on strength."""
        if strength < 40:
            return 'info'
        elif strength < 70:
            return 'warning'
        else:
            return 'urgent'


class TestSourceParityPrimaryStream(SourceParityTestBase):
    """Validate primary source pagination contract (A2.3-P)."""

    @patch('portfolio.order_flow.detect_dark_flow')
    @patch('portfolio.order_flow.compute_cvd_series')
    def test_five_page_traversal_no_duplicates(self, mock_cvd, mock_detect):
        """A2.3-P1: Validate 5-page traversal with no duplicate/missing events."""
        mock_cvd.return_value = {}
        mock_detect.return_value = {'signal_type': 'none', 'components': {}}
        
        signals = self._create_test_signals(count=25)
        
        all_event_ids = []
        cursor = None
        
        for page in range(5):
            params = {'limit': 5}
            if cursor:
                params['cursor'] = cursor
            
            response = self.client.get(f'/api/stock-management/stocks/{self.symbol}/order-flow/', params)
            self.assertEqual(response.status_code, 200)
            
            data = response.json()
            page_signals = data.get('signals', [])
            page_ids = [s.get('event_id') for s in page_signals]
            all_event_ids.extend(page_ids)
            
            # Verify pagination semantics
            pagination = data.get('pagination', {})
            if pagination.get('has_more'):
                self.assertIsNotNone(pagination.get('next_cursor'))
                cursor = pagination.get('next_cursor')
            else:
                self.assertIsNone(pagination.get('next_cursor'))
                break
        
        # Verify no duplicates
        unique_ids = set([eid for eid in all_event_ids if eid])
        self.assertEqual(len(all_event_ids), len(unique_ids), 'Found duplicate events')
        self.assertEqual(len(all_event_ids), 25)

    @patch('portfolio.order_flow.detect_dark_flow')
    @patch('portfolio.order_flow.compute_cvd_series')
    def test_cursor_replay_consistent(self, mock_cvd, mock_detect):
        """A2.3-P2: Cursor replay returns identical record sequence."""
        mock_cvd.return_value = {}
        mock_detect.return_value = {'signal_type': 'none', 'components': {}}
        
        signals = self._create_test_signals(count=15)
        
        # First traversal
        sequence1 = []
        cursor = None
        for _ in range(10):
            params = {'limit': 3}
            if cursor:
                params['cursor'] = cursor
            response = self.client.get(f'/api/stock-management/stocks/{self.symbol}/order-flow/', params)
            data = response.json()
            
            for s in data.get('signals', []):
                sequence1.append((s.get('event_id'), s.get('id')))
            
            if not data['pagination']['has_more']:
                break
            cursor = data['pagination']['next_cursor']
        
        # Second traversal
        sequence2 = []
        cursor = None
        for _ in range(10):
            params = {'limit': 3}
            if cursor:
                params['cursor'] = cursor
            response = self.client.get(f'/api/stock-management/stocks/{self.symbol}/order-flow/', params)
            data = response.json()
            
            for s in data.get('signals', []):
                sequence2.append((s.get('event_id'), s.get('id')))
            
            if not data['pagination']['has_more']:
                break
            cursor = data['pagination']['next_cursor']
        
        self.assertEqual(sequence1, sequence2, 'Cursor replay inconsistency')


class TestSourceParityFields(SourceParityTestBase):
    """Validate field presence (A2.3-M)."""

    @patch('portfolio.order_flow.detect_dark_flow')
    @patch('portfolio.order_flow.compute_cvd_series')
    def test_required_fields_present(self, mock_cvd, mock_detect):
        """A2.3-M1: All required fields present in signals."""
        mock_cvd.return_value = {}
        mock_detect.return_value = {'signal_type': 'none', 'components': {}}
        
        signals = self._create_test_signals(count=10)
        
        response = self.client.get(f'/api/stock-management/stocks/{self.symbol}/order-flow/', {'limit': 10})
        self.assertEqual(response.status_code, 200)
        
        data = response.json()
        required_fields = {'id', 'symbol', 'signal_type', 'strength', 'created_at', 'severity'}
        
        for signal in data.get('signals', []):
            present = set(signal.keys()) & required_fields
            self.assertEqual(len(present), len(required_fields), 
                f'Missing fields: {required_fields - present}')


class TestSourceParityErrorHandling(SourceParityTestBase):
    """Validate error handling (A2.3-E)."""

    @patch('portfolio.order_flow.detect_dark_flow')
    @patch('portfolio.order_flow.compute_cvd_series')
    def test_invalid_cursor_graceful(self, mock_cvd, mock_detect):
        """A2.3-E1: Invalid cursor handled gracefully."""
        mock_cvd.return_value = {}
        mock_detect.return_value = {'signal_type': 'none', 'components': {}}
        
        signals = self._create_test_signals(count=10)
        
        response = self.client.get(f'/api/stock-management/stocks/{self.symbol}/order-flow/',
            {'cursor': 'invalid_xyz', 'limit': 5})
        
        self.assertIn(response.status_code, [200, 400])

    @patch('portfolio.order_flow.detect_dark_flow')
    @patch('portfolio.order_flow.compute_cvd_series')
    def test_limit_clamping(self, mock_cvd, mock_detect):
        """A2.3-E2: Limit parameter clamped to max 50."""
        mock_cvd.return_value = {}
        mock_detect.return_value = {'signal_type': 'none', 'components': {}}
        
        signals = self._create_test_signals(count=100)
        
        response = self.client.get(f'/api/stock-management/stocks/{self.symbol}/order-flow/',
            {'limit': 500})
        
        self.assertEqual(response.status_code, 200)
        returned = len(response.json().get('signals', []))
        self.assertLessEqual(returned, 50)


class TestSourceParityIdentity(SourceParityTestBase):
    """Validate event identity stability (A2.3-S)."""

    @patch('portfolio.order_flow.detect_dark_flow')
    @patch('portfolio.order_flow.compute_cvd_series')
    def test_event_id_stable(self, mock_cvd, mock_detect):
        """A2.3-S1: event_id remains stable across reads."""
        mock_cvd.return_value = {}
        mock_detect.return_value = {'signal_type': 'none', 'components': {}}
        
        signals = self._create_test_signals(count=10)
        
        response1 = self.client.get(f'/api/stock-management/stocks/{self.symbol}/order-flow/', {'limit': 10})
        ids1 = {s.get('event_id') for s in response1.json().get('signals', [])}
        
        response2 = self.client.get(f'/api/stock-management/stocks/{self.symbol}/order-flow/', {'limit': 10})
        ids2 = {s.get('event_id') for s in response2.json().get('signals', [])}
        
        self.assertEqual(ids1, ids2)

    @patch('portfolio.order_flow.detect_dark_flow')
    @patch('portfolio.order_flow.compute_cvd_series')
    def test_severity_valid(self, mock_cvd, mock_detect):
        """A2.3-S2: Severity values are valid."""
        mock_cvd.return_value = {}
        mock_detect.return_value = {'signal_type': 'none', 'components': {}}
        
        signals = self._create_test_signals(count=10)
        
        response = self.client.get(f'/api/stock-management/stocks/{self.symbol}/order-flow/', {'limit': 10})
        
        valid_severities = {'info', 'warning', 'urgent'}
        for signal in response.json().get('signals', []):
            self.assertIn(signal.get('severity'), valid_severities)


class TestSourceParityContractVersion(SourceParityTestBase):
    """Validate contract versioning (A2.3-V)."""

    @patch('portfolio.order_flow.detect_dark_flow')
    @patch('portfolio.order_flow.compute_cvd_series')
    def test_response_structure(self, mock_cvd, mock_detect):
        """A2.3-V1: Response structure matches contract."""
        mock_cvd.return_value = {}
        mock_detect.return_value = {'signal_type': 'none', 'components': {}}
        
        signals = self._create_test_signals(count=5)
        
        response = self.client.get(f'/api/stock-management/stocks/{self.symbol}/order-flow/', {'limit': 5})
        self.assertEqual(response.status_code, 200)
        
        data = response.json()
        self.assertIn('signals', data)
        self.assertIn('pagination', data)
        self.assertIn('symbol', data)
