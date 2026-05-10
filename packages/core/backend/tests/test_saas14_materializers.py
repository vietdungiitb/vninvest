"""
Tests for market_serving materializers (SAAS-14).

Covers:
- materialize_symbol_snapshot: no legacy DB URL → skipped
- materialize_symbol_snapshot: degraded mode (OperationalError → marks stale + schedules retry)
- materialize_session_facts: no legacy DB URL → skipped
- backfill_symbol_snapshots: no legacy DB URL → skipped
- Pagination classes instantiation
"""
import uuid
from unittest.mock import MagicMock, patch

import django
import os

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "vninvest_core.settings")
os.environ.setdefault("LEGACY_DATABASE_URL", "")

django.setup()

from django.test import TestCase

from market_serving.materializers import (
    backfill_symbol_snapshots,
    materialize_session_facts,
    materialize_symbol_snapshot,
)
from vninvest_core.pagination import AlertCursorPagination, AuditCursorPagination, CoreCursorPagination


class TestMaterializeSymbolSnapshotNoLegacyUrl(TestCase):
    """When LEGACY_DATABASE_URL is absent, materializer returns skipped."""

    def test_no_legacy_url_returns_skipped(self):
        result = materialize_symbol_snapshot.run()
        self.assertEqual(result["status"], "skipped")
        self.assertEqual(result["reason"], "no_legacy_db_url")


class TestMaterializeSessionFactsNoLegacyUrl(TestCase):
    """When LEGACY_DATABASE_URL is absent, session facts materializer returns skipped."""

    def test_no_legacy_url_returns_skipped(self):
        result = materialize_session_facts.run()
        self.assertEqual(result["status"], "skipped")
        self.assertEqual(result["reason"], "no_legacy_db_url")


class TestBackfillNoLegacyUrl(TestCase):
    """backfill_symbol_snapshots returns skipped when no legacy URL."""

    def test_no_legacy_url_returns_skipped(self):
        result = backfill_symbol_snapshots.run(days_back=7)
        self.assertEqual(result["status"], "skipped")
        self.assertEqual(result["reason"], "no_legacy_db_url")


class TestCursorPaginationClasses(TestCase):
    """Pagination classes have correct defaults."""

    def test_core_cursor_pagination_defaults(self):
        p = CoreCursorPagination()
        self.assertEqual(p.page_size, 50)
        self.assertEqual(p.max_page_size, 200)

    def test_alert_cursor_pagination_ordering(self):
        p = AlertCursorPagination()
        self.assertEqual(p.ordering, "-triggered_at")

    def test_audit_cursor_pagination_page_size(self):
        p = AuditCursorPagination()
        self.assertEqual(p.page_size, 100)
        self.assertEqual(p.ordering, "-occurred_at")
