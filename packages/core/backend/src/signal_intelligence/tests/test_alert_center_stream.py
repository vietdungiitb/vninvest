"""AlertCenter user-scoped SSE stream tests — S7."""
from datetime import timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from signal_intelligence.models import UnifiedAlert
from user_workspace.models import Watchlist, WatchlistItem

User = get_user_model()


def _read_stream_content(response, max_bytes=20000) -> str:
    chunks = []
    for chunk in response.streaming_content:
        chunks.append(chunk.decode() if isinstance(chunk, bytes) else str(chunk))
        if sum(len(c) for c in chunks) > max_bytes:
            break
    return ''.join(chunks)


class AlertCenterStreamTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.user = User.objects.create_user(username='stream-scoped-user', password='password123')
        watchlist = Watchlist.objects.create(user=cls.user, name='Stream', is_default=True)
        WatchlistItem.objects.create(watchlist=watchlist, symbol='VCI')
        cls.blank = User.objects.create_user(username='stream-blank-user', password='password123')
        now = timezone.now()
        cls.vci = UnifiedAlert.objects.create(
            alert_type=UnifiedAlert.AlertTypeChoices.WHALE, symbol='VCI',
            severity=UnifiedAlert.SeverityChoices.HIGH, confidence=0.9,
            title='Whale VCI', body='Body', value=Decimal('2000000000'),
            direction=UnifiedAlert.DirectionChoices.BUY,
            session_date=now.date(), triggered_at=now - timedelta(minutes=5),
            source_ref='stream-s7-vci',
        )
        UnifiedAlert.objects.create(
            alert_type=UnifiedAlert.AlertTypeChoices.DARK_FLOW, symbol='HPG',
            severity=UnifiedAlert.SeverityChoices.MEDIUM, confidence=0.8,
            title='Dark HPG', body='Body', value=Decimal('900000000'),
            direction=UnifiedAlert.DirectionChoices.SELL,
            session_date=now.date(), triggered_at=now - timedelta(minutes=2),
            source_ref='stream-s7-hpg',
        )

    def setUp(self):
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def test_unauthenticated_returns_401(self):
        self.client.force_authenticate(user=None)
        rsp = self.client.get('/core/v1/signals/alert-center/stream/?max_loops=1')
        self.assertEqual(rsp.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_scope_filters_to_user_symbols(self):
        content = _read_stream_content(
            self.client.get('/core/v1/signals/alert-center/stream/?since=0&max_loops=2'))
        self.assertIn('event: alert-center', content)
        self.assertIn('"symbol": "VCI"', content)
        self.assertNotIn('"symbol": "HPG"', content)

    def test_blank_user_receives_no_events(self):
        self.client.force_authenticate(user=self.blank)
        content = _read_stream_content(
            self.client.get('/core/v1/signals/alert-center/stream/?since=0&max_loops=2'))
        self.assertNotIn('event: alert-center', content)

    def test_since_resumes_and_default_starts_at_max(self):
        max_id = UnifiedAlert.objects.order_by('-pk').first().pk
        content = _read_stream_content(
            self.client.get(f'/core/v1/signals/alert-center/stream/?since={max_id}&max_loops=2'))
        self.assertNotIn('"symbol": "VCI"', content)
        content2 = _read_stream_content(
            self.client.get('/core/v1/signals/alert-center/stream/?since=0&max_loops=2'))
        self.assertIn('"symbol": "VCI"', content2)

    def test_max_loops_terminates_with_headers(self):
        rsp = self.client.get('/core/v1/signals/alert-center/stream/?max_loops=1')
        self.assertEqual(rsp.status_code, status.HTTP_200_OK)
        self.assertEqual(rsp['Content-Type'], 'text/event-stream')
        self.assertEqual(rsp['Cache-Control'], 'no-cache')
        content = _read_stream_content(rsp)
        self.assertIn('retry: 3000', content)
