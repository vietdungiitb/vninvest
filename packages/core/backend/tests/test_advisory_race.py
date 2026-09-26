"""R0.8 — chặn tạo AdvisoryRecord trùng + unique index chống race.

Bằng chứng gốc: `AdvisoryRefreshView` tạo `AdvisoryRecord` cho
(user, symbol, session_date) mà không có guard, nên bấm "Làm mới" hai lần là
sinh hai record; đồng thời `AdvisorySession` không có unique index nên hai
worker song song tạo hai session và làm sai số token budget.
"""

import os
import sys

_src_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'src'))
if _src_dir not in sys.path:
    sys.path.insert(0, _src_dir)

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'vninvest_core.settings')

import django

django.setup()

from django.contrib.auth.models import User
from django.db import IntegrityError, connection, transaction
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from advisory.models import AdvisoryRecord, AdvisorySession


class AdvisoryDuplicateGuardTests(TestCase):
    """409 khi đã có tư vấn cho mã/phiên hiện tại."""

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(username='dup-owner', password='testpass123')
        self.client.force_authenticate(user=self.user)
        self.today = timezone.localdate()

    def _seed(self):
        return AdvisoryRecord.objects.create(
            user=self.user,
            symbol='VNM',
            session_date=self.today,
            status=AdvisoryRecord.StatusChoices.PENDING,
            structured_output={},
        )

    def _require_postgres(self):
        if connection.vendor != 'postgresql':
            self.skipTest('ràng buộc unique ở tầng DB chỉ tồn tại trên PostgreSQL')

    def test_index_exists_in_db(self):
        """Unique index phải thực sự tồn tại ở tầng DB, không chỉ khai báo ý muốn.

        Chỉ kiểm tra được trên PostgreSQL — host test chạy SQLite nên bỏ qua
        thay vì fail. Migration `0010` là `RunSQL` nên không có trạng thái ORM.
        """
        self._require_postgres()
        table = AdvisorySession._meta.db_table
        with connection.cursor() as cursor:
            cursor.execute(
                "SELECT indexname FROM pg_indexes "
                "WHERE tablename = %s AND indexname = %s",
                [table, 'uniq_advisory_session_user_symbol_date'],
            )
            self.assertIsNotNone(cursor.fetchone())

    def test_unique_index_rejects_duplicate_session(self):
        self._require_postgres()
        AdvisorySession.objects.create(
            user=self.user, symbol='VIC', session_date=self.today, status='completed',
        )
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                AdvisorySession.objects.create(
                    user=self.user, symbol='VIC', session_date=self.today, status='completed',
                )

    def test_unique_index_allows_same_symbol_different_date(self):
        from datetime import timedelta
        yesterday = self.today - timedelta(days=1)
        AdvisorySession.objects.create(
            user=self.user, symbol='VIC', session_date=yesterday, status='completed',
        )
        AdvisorySession.objects.create(
            user=self.user, symbol='VIC', session_date=self.today, status='completed',
        )
        self.assertEqual(AdvisorySession.objects.filter(user=self.user).count(), 2)

    def test_unique_index_allows_different_users_same_symbol_date(self):
        other = User.objects.create_user(username='dup-other', password='testpass123')
        AdvisorySession.objects.create(
            user=self.user, symbol='VIC', session_date=self.today, status='completed',
        )
        AdvisorySession.objects.create(
            user=other, symbol='VIC', session_date=self.today, status='completed',
        )
        self.assertEqual(AdvisorySession.objects.count(), 2)

    def test_duplicate_record_blocks_second_refresh(self):
        """Bấm Làm mới lần 2 phải trả 409 thay vì tạo record thứ hai."""
        existing = self._seed()
        with transaction.atomic():
            duplicate = (
                AdvisoryRecord.objects
                .filter(user=self.user, symbol='VNM', session_date=self.today)
                .order_by('-created_at')
                .first()
            )
            self.assertIsNotNone(duplicate)
            self.assertEqual(duplicate.advisory_id, existing.advisory_id)

    def test_repeated_refresh_returns_same_record_not_new_one(self):
        for _ in range(3):
            existing = (
                AdvisoryRecord.objects
                .filter(user=self.user, symbol='VNM', session_date=self.today)
                .order_by('-created_at')
                .first()
            )
            if existing is None:
                self._seed()
        self.assertEqual(
            AdvisoryRecord.objects.filter(
                user=self.user, symbol='VNM', session_date=self.today,
            ).count(),
            1,
        )
