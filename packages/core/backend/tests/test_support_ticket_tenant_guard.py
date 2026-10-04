"""B3 - GET /tickets phai fail-closed khi khong resolve duoc tenant.

## Bang chung goc

`TicketListCreateView` (support/views.py) bat buoc tenant o **nhanh POST**
(`:133-135`: `if not tenant: return 400 'Tenant context is required.'`) nhung
**khong** o nhanh GET (`:93-95` cu).

`_ticket_query_for_user(user, None)` (`:70-76`) bo **ca** hai bo loc:
- `if tenant:` -> False, khong loc theo tenant
- `if not user.is_staff:` -> is_staff True, khong loc theo requester

=> GET khong tenant = quet `SupportTicket` khong gioi han tren **tat ca** tenant.

Duong toi: `middleware.py:85-88` cho phep superuser bo qua tenant resolution;
`_resolve_superuser_tenant` (`:299-320`) no-op khi operator khong so huu tenant
nao va khong la thanh vien cua tenant nao, nen `request.tenant` khong duoc set va
`:88` return **khong co 403** (khac `:109-116` voi nguoi binh thuong).

## Hai huong deu phai chan

| Huong | Mong doi |
|---|---|
| GET khong tenant | 400 |
| POST khong tenant | 400 (da co san truoc day) |

## Hanh vi staff cross-tenant co chu dich khong phai loi

`middleware.py:86-87` noi ro superuser duoc phep doc qua tenant. Kiem tra nay
KHONG chan superuser co tenant hop le - no chi chan THIEU tenant, de dong bo voi
nhanh POST.
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
from django.test import TestCase
from rest_framework.test import APIClient

from support.models import SupportTicket


class TicketListRequiresTenantTests(TestCase):
    """GET /tickets khong duoc chay khi khong co tenant context."""

    def setUp(self):
        self.client = APIClient()

    def _get(self):
        return self.client.get('/core/v1/tickets/')

    def test_get_without_tenant_is_rejected(self):
        """Operator co quyen nhung khong resolve duoc tenant -> 400, khong phai 200."""
        op = User.objects.create_user(
            username='support-op-norent', password='testpass123',
            is_staff=True, is_superuser=True,
        )
        self.client.force_authenticate(user=op)

        # Operator deliberately owns no tenant and belongs to none, so tenant
        # resolution no-ops exactly as `_resolve_superuser_tenant` does.
        response = self._get()

        self.assertEqual(
            response.status_code, 400,
            'GET /tickets phai tra 400 khi khong resolve duoc tenant',
        )
