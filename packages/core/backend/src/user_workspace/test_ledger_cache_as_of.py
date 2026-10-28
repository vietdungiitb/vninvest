"""P0: `meta.as_of` phai la `date` tren CA duong cache-hit va cache-miss.

`_serialize` doi `as_of` `date` -> `str` de luu cache. `_deserialize` phai doi
nguoc lai ve `date`, neu khong thi `build_meta` go `.isoformat()` tren `str` =>
`AttributeError` => **HTTP 500**.

`_serialize` chay o moi duong ghi cache, `_deserialize` chay o moi duong doc
cache. "Chi request tinh tay" la duong cache-miss, nen bug nao chi lo duong
**cache-hit** — tuc moi request thu 2 tro di cua portfolio co holdings.

`test_ledger_holdings.py` hien goan `get_cached_ledger(..., use_cache=False)`
(`:280`, `:295`, `:386`) nen bo qua cache va khong bat duoc bug nay. File nay
chap dunh duong cache-hit bang cache backend that.

Dotted path: `user_workspace.test_ledger_cache_as_of`
"""

from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.test import TestCase
from django.utils import timezone

from identity_access.models import CoreTenant
from user_workspace.ledger.services import build_meta, get_cached_ledger
from user_workspace.models import Portfolio, Transaction

User = get_user_model()


class LedgerCacheAsOfTypeTests(TestCase):
    """`as_of` phai la `date` o ca hai duong, khong chi duong doc truc tiep."""

    def setUp(self):
        cache.clear()
        self.user = User.objects.create_user(
            username='ledger-cache-user',
            email='ledger-cache@test.local',
            password='pass123',
        )
        self.tenant = CoreTenant.objects.create(
            owner_user=self.user,
            tenant_code='ledger-cache-tenant',
            display_name='ledger cache tenant',
            status=CoreTenant.StatusChoices.ACTIVE,
        )
        self.portfolio = Portfolio.objects.create(
            user=self.user, tenant=self.tenant, name='Danh mục ledger cache',
        )
        Transaction.objects.create(
            portfolio=self.portfolio,
            tenant=self.tenant,
            symbol='VCB',
            transaction_type=Transaction.TransactionType.BUY,
            date=timezone.localdate() - timezone.timedelta(days=2),
            price=Decimal('50000'),
            quantity=120,
            fee=Decimal('1000'),
        )

    def tearDown(self):
        cache.clear()

    def test_miss_then_hit_agree_on_as_of_type(self):
        miss = get_cached_ledger(self.portfolio.id, self.tenant, use_cache=True)
        hit = get_cached_ledger(self.portfolio.id, self.tenant, use_cache=True)

        self.assertEqual(miss['meta']['from_cache'], False)
        self.assertEqual(hit['meta']['from_cache'], True, 'lan 2 phai la cache-hit')
        self.assertIsInstance(miss['meta']['as_of'], type(timezone.localdate()))
        self.assertIsInstance(
            hit['meta']['as_of'], type(timezone.localdate()),
            'cache-hit phai giu kieu date, khong phai str',
        )

    def test_build_meta_survives_cache_hit(self):
        """Regression P0: len goi 500 `AttributeError: 'str' has no attribute isoformat`."""
        get_cached_ledger(self.portfolio.id, self.tenant, use_cache=True)  # warm
        cached = get_cached_ledger(self.portfolio.id, self.tenant, use_cache=True)

        meta = build_meta(cached)

        self.assertEqual(meta['as_of'], str(timezone.localdate() - timezone.timedelta(days=2)))
        self.assertEqual(meta['as_of_precision'], 'date')

    def test_build_meta_output_identical_miss_vs_hit(self):
        miss_meta = build_meta(get_cached_ledger(self.portfolio.id, self.tenant, use_cache=True))
        hit_meta = build_meta(get_cached_ledger(self.portfolio.id, self.tenant, use_cache=True))

        for key in ('as_of', 'as_of_precision', 'as_of_reason', 'portfolio_id', 'tenant_id'):
            self.assertEqual(miss_meta[key], hit_meta[key], f'khoa {key} lech giua miss va hit')
        self.assertEqual(hit_meta['from_cache'], True)
        self.assertEqual(miss_meta['from_cache'], False)

    def test_as_of_none_when_portfolio_has_no_transactions(self):
        empty = Portfolio.objects.create(
            user=self.user, tenant=self.tenant, name='Danh mục rỗng',
        )
        meta = build_meta(get_cached_ledger(empty.id, self.tenant, use_cache=True))

        self.assertIsNone(meta['as_of'])
        self.assertIsNone(meta['as_of_precision'])
        self.assertEqual(meta['as_of_reason'], 'no_transactions')

    def test_deserialize_is_idempotent_across_many_reads(self):
        """Nhiet doc cache lien tiep khong lam hong type."""
        for _ in range(5):
            ledger = get_cached_ledger(self.portfolio.id, self.tenant, use_cache=True)
            self.assertIsInstance(ledger['meta']['as_of'], type(timezone.localdate()))

    def test_ledger_decimal_fields_survive_cache_hit(self):
        """`_deserialize` da restore Decimal truoc do; as_of phai khop muc do."""
        hit = get_cached_ledger(self.portfolio.id, self.tenant, use_cache=True)
        self.assertIsInstance(hit['cash'], Decimal)
        self.assertIsInstance(hit['holdings']['VCB']['avg_cost'], Decimal)
