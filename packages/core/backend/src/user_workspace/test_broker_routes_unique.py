"""PA-1 P1-CONTRACT-00 — 6 broker route bị đăng ký trùng trong `urls.py`.

Chạy: python manage.py test user_workspace.test_broker_routes_unique

`urls.py` từng có 2 khối **byte-identical** (`broker-providers`,
`broker-config-schema`, `broker-config`, `broker-test-connection`,
`broker-status`, `broker-job-status`) — trùng cả `name` lẫn path pattern.
Vì byte-identical nên chưa misroute live, nhưng là cạm bẫn drift: sửa khối
trên mà quên khối dưới thì route public và route nội bộ lệch âm thầm.

Test ở đây khoá 3 bất biến:
  1. mỗi `name` xuất hiện đúng 1 lần trong `urlpatterns`
  2. mỗi path pattern xuất hiện đúng 1 lần
  3. mỗi broker path resolve ra đúng 1 view, và đúng view đã đăng ký

Giá trị trong `EXPECTED` là `str(URLPattern.pattern)` — dạng Django thật sự
dùng (`broker/<str:provider>/config/`), không phải dạng `reverse` kwarg.
"""
from collections import Counter

from django.test import SimpleTestCase
from django.urls import resolve, reverse

from user_workspace import urls as uw_urls

#: Mount prefix của `user_workspace.urls` trong `vninvest_core/urls.py:45`.
MOUNT = '/core/v1/'
#: `vninvest_core/urls.py:45` include() app_name='user_workspace' ⇒ namespace bắt buộc.
NAMESPACE = 'user_workspace'

#: name -> (str(URLPattern.pattern), kwargs cho reverse())
EXPECTED = {
    'broker-providers': ('broker/providers/', {}),
    'broker-config-schema': ('broker/config-schema/<str:provider>/', {'provider': 'dnse'}),
    'broker-config': ('broker/<str:provider>/config/', {'provider': 'dnse'}),
    'broker-test-connection': ('broker/<str:provider>/test-connection/', {'provider': 'dnse'}),
    'broker-status': ('broker/<str:provider>/status/', {'provider': 'dnse'}),
    'broker-job-status': ('broker/jobs/<str:job_id>/', {'job_id': 'job-1'}),
    'dnse-broker-sync-accounts': ('broker/dnse/sync-accounts/', {}),
    'dnse-broker-sync-balances': ('broker/dnse/sync-balances/', {}),
    'dnse-broker-reconcile-transactions': ('broker/dnse/reconcile-transactions/', {}),
    'dnse-broker-send-email-otp': ('broker/dnse/send-email-otp/', {}),
    'dnse-broker-create-trading-token': ('broker/dnse/create-trading-token/', {}),
    'dnse-broker-place-order': ('broker/dnse/place-order/', {}),
    'dnse-broker-token-status': ('broker/dnse/token-status/', {}),
    'broker-retail-gold': ('broker/retail/gold/', {}),
    'broker-retail-fx': ('broker/retail/exchange-rate/', {}),
}


def _view_name(view):
    return getattr(view, '__name__', None) or repr(view)


class BrokerRouteUniquenessTests(SimpleTestCase):
    def setUp(self):
        self.patterns = list(uw_urls.urlpatterns)

    def test_no_duplicate_url_names(self):
        names = [p.name for p in self.patterns if p.name]
        duplicated = sorted(name for name, count in Counter(names).items() if count > 1)
        self.assertEqual(duplicated, [], f"URL name đăng ký trùng: {duplicated}")

    def test_no_duplicate_route_patterns(self):
        patterns = [str(p.pattern) for p in self.patterns]
        duplicated = sorted(pat for pat, count in Counter(patterns).items() if count > 1)
        self.assertEqual(duplicated, [], f"path pattern đăng ký trùng: {duplicated}")

    def test_every_broker_name_registered_exactly_once(self):
        registered = Counter(p.name for p in self.patterns if p.name)
        wrong = {name: registered[name] for name in EXPECTED if registered[name] != 1}
        self.assertEqual(wrong, {}, f"broker route thiếu hoặc trùng: {wrong}")

    def test_broker_paths_are_stable(self):
        """Khoá path public — đổi là vỡ client cũ, phải có handoff riêng."""
        actual = {p.name: str(p.pattern) for p in self.patterns if p.name in EXPECTED}
        expected = {name: pattern for name, (pattern, _kw) in EXPECTED.items()}
        self.assertEqual(actual, expected)

    def test_each_broker_path_resolves_to_one_view(self):
        for name, (_pattern, kwargs) in EXPECTED.items():
            with self.subTest(name=name):
                entry = next(p for p in self.patterns if p.name == name)
                url = reverse(f'{NAMESPACE}:{name}', kwargs=kwargs) if kwargs \
                    else reverse(f'{NAMESPACE}:{name}')
                self.assertTrue(url.startswith(MOUNT), url)
                match = resolve(url)
                self.assertEqual(
                    _view_name(match.func), _view_name(entry.callback),
                    f"{name}: URL '{url}' resolve ra view khác view đã đăng ký",
                )
