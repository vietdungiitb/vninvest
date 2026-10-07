"""S-00a - 3 route portfolio workspace phai ton tai va tro dung view.

Tien de bi phan bien: 3 view class (`PortfolioEquityCurveView`,
`PortfolioAllocationView`, `PortfolioChartView`) da ton tai VA da duoc import
vao `urls.py` tu truoc, nhung KHONG co `path()` nao tro toi chung.
Bai test nay chan de chung khong bi xoa ngan sau khi merge.

Fail-truoc/pass-sau:
  - Swap `urls.py` ve ban goc (git show HEAD~N:...urls.py) => 3 route bien mat,
    reverse() nem NoReverseMatch => FAIL.
  - Ban moi => PASS.
"""

from django.test import SimpleTestCase
from django.urls import resolve, reverse

from user_workspace.portfolio_analytics_views import (
    PortfolioAllocationView,
    PortfolioChartView,
    PortfolioEquityCurveView,
    PortfolioHoldingsView,
)

# `holdings` la route co san truoc khu vuc - lay lam chuan so sanh.
# Namespace bat buoc: cac route duoc include voi `app_name='user_workspace'`
# nen `reverse('portfolio-equity-curve')` khong co namespace -> NoReverseMatch
# du duong pattern co dang dung. Xac nhan bang lenh:
#   python -c "from django.urls import reverse; reverse('user_workspace:portfolio-chart', kwargs={'portfolio_id':7})"
CASES = [
    ("portfolio-holdings", PortfolioHoldingsView),
    ("portfolio-equity-curve", PortfolioEquityCurveView),
    ("portfolio-allocation", PortfolioAllocationView),
    ("portfolio-chart", PortfolioChartView),
]
NS = "user_workspace"


def _reverse(name, portfolio_id=7):
    return reverse(f"{NS}:{name}", kwargs={"portfolio_id": portfolio_id})


class PortfolioWorkspaceRouteTests(SimpleTestCase):
    def test_every_workspace_route_reverses(self):
        for name, _view_cls in CASES:
            with self.subTest(route=name):
                self.assertTrue(name.startswith("portfolio-"))
                path = _reverse(name)
                self.assertIn("/workspace/portfolios/7/", path)

    def test_route_resolves_to_the_expected_view_class(self):
        for name, view_cls in CASES:
            with self.subTest(route=name):
                match = resolve(_reverse(name))
                resolved = getattr(match.func, "cls", None)
                self.assertIs(
                    resolved,
                    view_cls,
                    f"{name} resolve sang {resolved} thay vi {view_cls}",
                )

    def test_equity_curve_and_chart_are_distinct_routes(self):
        self.assertNotEqual(
            _reverse("portfolio-equity-curve"),
            _reverse("portfolio-chart"),
        )

    def test_all_four_views_require_authentication(self):
        for _name, view_cls in CASES:
            with self.subTest(view=view_cls.__name__):
                perms = [p.__name__ for p in view_cls.permission_classes]
                self.assertIn("IsAuthenticated", perms)
                # Read-only: KHONG duoc gan WorkspacePermission (phep ghi).
                self.assertNotIn("WorkspacePermission", perms)
