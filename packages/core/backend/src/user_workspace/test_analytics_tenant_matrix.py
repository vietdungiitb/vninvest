"""
PA-2 / P0-ISO-01 — ma trận tenant cho 4 endpoint analytics reachable.

Bối cảnh: `portfolio_analytics_views._get_user_portfolio()` chỉ lọc
`pk` + `user`, không lọc `request.tenant`. Người dùng đa tenant đọc được
holdings/NAV của portfolio thuộc tenant khác chỉ cần biết id.

Ma trận cover:
  - AC1  user thuộc Tenant A (owner) + Tenant B (member) đọc portfolio_A
        với header `X-Tenant-ID: B`  ⇒ phải 404 (không 403, tránh oracle).
  - AC2  cùng ma trận cho cả 4 endpoint có route thật.
  - AC3  `request.tenant is None` ⇒ fail-closed.
  - AC4  portfolio của user khác cùng tenant ⇒ 404.

Tenant context lấy từ `TenantResolutionMiddleware` thật (session + header
`X-Tenant-ID`), không giả lập: đó chính là đường đi production.
"""
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from identity_access.models import CoreTenant, TenantMember
from market_serving.models import SymbolSnapshot
from user_workspace.models import Portfolio, Transaction
from user_workspace.tests.envelope import unwrapped_json

User = get_user_model()

# 4 endpoint CÓ route trong `user_workspace/urls.py:54-57`.
# 4 view còn lại (chart/equity-curve/allocation/sync) chỉ được import ở
# `urls.py:9-13`, không nằm trong `urlpatterns` ⇒ code chết, ngoài ma trận HTTP.
REACHABLE_SUFFIXES = ('holdings/', 'summary/', 'analytics/', 'technicals/')


def _make_tenant(code, owner):
    return CoreTenant.objects.create(
        owner_user=owner,
        tenant_code=code,
        display_name=code,
        status=CoreTenant.StatusChoices.ACTIVE,
    )


class AnalyticsTenantMatrixApiTestCase(TestCase):
    """User đa tenant: chỉ đọc được portfolio của tenant đang chọn."""

    def setUp(self):
        self.user = User.objects.create_user(
            username='pa2-multi-tenant-user',
            email='pa2-multi@test.local',
            password='pass123',
        )
        self.other_user = User.objects.create_user(
            username='pa2-same-tenant-peer',
            email='pa2-peer@test.local',
            password='pass123',
        )
        # `CoreTenant.owner_user` là OneToOne ⇒ mỗi user chỉ sở hữu 1 tenant.
        self.tenant_b_owner = User.objects.create_user(
            username='pa2-tenant-b-owner',
            email='pa2-b-owner@test.local',
            password='pass123',
        )

        self.tenant_a = _make_tenant('pa2-tenant-a', self.user)
        self.tenant_b = _make_tenant('pa2-tenant-b', self.tenant_b_owner)
        # user là active member của B (không chỉ sở hữu) để chứng minh
        # membership là thật chứ không chỉ vai trò owner.
        TenantMember.objects.create(
            tenant=self.tenant_b,
            user=self.user,
            role=TenantMember.RoleChoices.EDITOR,
        )

        self.portfolio_a = Portfolio.objects.create(
            user=self.user, tenant=self.tenant_a, name='PA2 danh muc A',
        )
        self.portfolio_b = Portfolio.objects.create(
            user=self.user, tenant=self.tenant_b, name='PA2 danh muc B',
        )
        self.peer_portfolio_in_a = Portfolio.objects.create(
            user=self.other_user, tenant=self.tenant_a, name='PA2 danh muc cua ban',
        )

        Transaction.objects.create(
            portfolio=self.portfolio_a,
            tenant=self.tenant_a,
            symbol='VCB',
            transaction_type=Transaction.TransactionType.BUY,
            date=timezone.localdate(),
            price=Decimal('50000'),
            quantity=120,
            fee=Decimal('1000'),
        )
        Transaction.objects.create(
            portfolio=self.peer_portfolio_in_a,
            tenant=self.tenant_a,
            symbol='BID',
            transaction_type=Transaction.TransactionType.BUY,
            date=timezone.localdate(),
            price=Decimal('40000'),
            quantity=50,
        )

        SymbolSnapshot.objects.create(
            symbol='VCB',
            session_date=timezone.localdate(),
            price=Decimal('52000'),
            price_change=Decimal('1500'),
            price_change_pct=Decimal('2.9700'),
            volume=250000,
            reference_price=Decimal('50500'),
            high=Decimal('52200'),
            low=Decimal('49800'),
            market_status=SymbolSnapshot.MarketStatusChoices.OPEN,
            source=SymbolSnapshot.SourceChoices.CORE,
            stale=False,
        )

    def _session_client(self, user, tenant):
        """Client đã đăng nhập + header `X-Tenant-ID` của tenant đang chọn.

        `force_login` để `AuthenticationMiddleware` gắn user thật, nhờ đó
        `TenantResolutionMiddleware` resolve tenant và gán `request.tenant`
        y hệt production.
        """
        client = APIClient()
        client.force_login(user)
        if tenant is not None:
            client.defaults['HTTP_X_TENANT_ID'] = tenant.public_id
        return client

    def test_ac1_cross_tenant_holdings_returns_404(self):
        """AC1 — đọc portfolio của tenant A trong khi đang chọn tenant B."""
        client = self._session_client(self.user, self.tenant_b)

        response = client.get(
            f'/core/v1/workspace/portfolios/{self.portfolio_a.id}/holdings/',
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_404_NOT_FOUND,
            msg=(
                'P0-ISO-01 chưa đóng: portfolio thuộc tenant A đọc được khi request '
                f'chọn tenant B. status={response.status_code} body={response.content!r}'
            ),
        )
        self.assertNotIn(b'VCB', response.content)

    def test_ac2_matrix_all_four_reachable_endpoints(self):
        """AC2 — cùng phát hiện trên cả 4 endpoint có route thật."""
        client = self._session_client(self.user, self.tenant_b)

        for suffix in REACHABLE_SUFFIXES:
            with self.subTest(suffix=suffix):
                response = client.get(
                    f'/core/v1/workspace/portfolios/{self.portfolio_a.id}/{suffix}',
                )
                self.assertEqual(
                    response.status_code,
                    status.HTTP_404_NOT_FOUND,
                    msg=f'{suffix} trả {response.status_code} thay vì 404',
                )
                self.assertNotIn(b'VCB', response.content)

    def test_ac2_own_tenant_still_readable(self):
        """Đối chiếu — chọn đúng tenant của portfolio thì vẫn đọc được."""
        client = self._session_client(self.user, self.tenant_a)
        response = client.get(
            f'/core/v1/workspace/portfolios/{self.portfolio_a.id}/holdings/',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(unwrapped_json(response)[0]['symbol'], 'VCB')

    def test_ac2_other_tenant_own_portfolio_still_readable(self):
        """Đối chiếu — tenant B đọc được portfolio B của chính mình."""
        Transaction.objects.create(
            portfolio=self.portfolio_b,
            tenant=self.tenant_b,
            symbol='ACB',
            transaction_type=Transaction.TransactionType.BUY,
            date=timezone.localdate(),
            price=Decimal('10000'),
            quantity=10,
        )
        client = self._session_client(self.user, self.tenant_b)
        response = client.get(
            f'/core/v1/workspace/portfolios/{self.portfolio_b.id}/holdings/',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(unwrapped_json(response)[0]['symbol'], 'ACB')

    def test_ac3_missing_tenant_context_fails_closed(self):
        """AC3 — `request.tenant is None` thì không trả dữ liệu của tenant nào.

        `force_authenticate` chỉ thao tác trên DRF Request dựng trong view, nên
        `TenantResolutionMiddleware` không thấy user và không gán
        `request.tenant`. Đây cũng chính là đường đi khi auth bằng PAT mà
        middleware không resolve được tenant.
        """
        client = APIClient()
        client.force_authenticate(user=self.user)

        for suffix in REACHABLE_SUFFIXES:
            with self.subTest(suffix=suffix):
                response = client.get(
                    f'/core/v1/workspace/portfolios/{self.portfolio_a.id}/{suffix}',
                )
                self.assertEqual(
                    response.status_code,
                    status.HTTP_404_NOT_FOUND,
                    msg=(
                        f'{suffix} trả {response.status_code} khi không có tenant '
                        'context — phải fail-closed'
                    ),
                )
                self.assertNotIn(b'VCB', response.content)

    def test_ac4_peer_portfolio_same_tenant_returns_404(self):
        """AC4 — portfolio của user khác trong CÙNG tenant vẫn 404."""
        client = self._session_client(self.user, self.tenant_a)
        response = client.get(
            f'/core/v1/workspace/portfolios/{self.peer_portfolio_in_a.id}/holdings/',
        )
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertNotIn(b'BID', response.content)

    def test_anonymous_still_rejected(self):
        """Không nới lỏng `IsAuthenticated` khi thêm filter tenant."""
        anonymous = APIClient()
        for suffix in REACHABLE_SUFFIXES:
            with self.subTest(suffix=suffix):
                response = anonymous.get(
                    f'/core/v1/workspace/portfolios/{self.portfolio_a.id}/{suffix}',
                )
                self.assertIn(
                    response.status_code,
                    {status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN},
                )


class NoTenantContextMeansNoDataApiTestCase(TestCase):
    """`request.tenant is None` ⇒ 404, kể cả khi portfolio CÙNG user.

    Ghi nhận một hệ quả của AC-3 cần người đọc biết:

    - Signal `user_workspace/models.py:780-844` (`resolve_tenant_for_user_workspace_models`)
      đảm bảo `Portfolio.tenant` **không bao giờ NULL**: nếu không resolve được
      từ profile / tenant sở hữu / membership thì nó **tạo tenant mới**
      (`models.py:836-841`). Vì vậy không dựng được row `tenant IS NULL` qua ORM,
      và cột `tenant_id` là `NOT NULL` (`migrations/0012_...`). Trường hợp đó
      không có test được — ghi ở evidence thay vì viết test giả.
    - `force_authenticate` của DRF chỉ thao tác trên `Request` dựng trong view,
      nên `TenantResolutionMiddleware` (tầng Django) không gán `request.tenant`.
      Test cũ `user_workspace/test_portfolio_analytics_native_routes.py:29` dùng
      đúng cách đó, và trước PA-2 nó nhận 200. Sau PA-2 nó nhận 404.
      Đây là hành vi **cố ý** (fail-closed), nhưng fixture của test cũ không còn
      mô tả một request hợp lệ nữa ⇒ cần coordinator cập nhật.
    """

    def setUp(self):
        self.user = User.objects.create_user(
            username='pa2-no-tenant-ctx',
            email='pa2-no-tenant-ctx@test.local',
            password='pass123',
        )
        # Signal tự tạo tenant `auto-pa2-no-tenant-ctx` cho user ⇒ portfolio
        # luôn có tenant, nhưng request dưới đây không mang tenant context.
        self.portfolio = Portfolio.objects.create(
            user=self.user, name='PA2 danh muc cung user',
        )
        self.assertIsNotNone(self.portfolio.tenant_id)

    def test_same_owner_without_tenant_context_is_404(self):
        client = APIClient()
        client.force_authenticate(user=self.user)

        response = client.get(
            f'/core/v1/workspace/portfolios/{self.portfolio.id}/holdings/',
        )

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_session_login_without_header_resolves_owner_tenant(self):
        """Đối chiếu: không header thì middleware resolve tenant sở hữu ⇒ 200.

        Chứng minh 404 ở test trên là do THIẾU context, không phải do portfolio
        sai tenant.
        """
        Transaction.objects.create(
            portfolio=self.portfolio,
            symbol='CTG',
            transaction_type=Transaction.TransactionType.BUY,
            date=timezone.localdate(),
            price=Decimal('30000'),
            quantity=20,
        )
        client = APIClient()
        client.force_login(self.user)

        response = client.get(
            f'/core/v1/workspace/portfolios/{self.portfolio.id}/holdings/',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(unwrapped_json(response)[0]['symbol'], 'CTG')
