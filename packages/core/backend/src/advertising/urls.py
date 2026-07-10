from django.urls import re_path
from rest_framework.routers import DefaultRouter
from advertising import views
from advertising.views import WidgetConfigView, WidgetAdView

# Disable format suffix patterns to avoid double registration during system checks
class NoFormatSuffixRouter(DefaultRouter):
    def get_urls(self):
        urls = []
        for prefix, viewset, basename in self.registry:
            lookup = self.get_lookup_regex(viewset)
            routes = self.get_routes(viewset)
            
            for route in routes:
                mapping = self.get_method_map(viewset, route.mapping)
                if not mapping:
                    continue
                
                regex = route.url.format(
                    prefix=prefix,
                    lookup=lookup,
                    trailing_slash=self.trailing_slash
                )
                
                view = viewset.as_view(mapping, **route.initkwargs)
                name = route.name.format(basename=basename)
                urls.append(re_path(regex, view, name=name))
        
        return urls

router = NoFormatSuffixRouter()
router.register(r'operator/ads/campaigns', views.OperatorAdCampaignViewSet, basename='operator-ad-campaign')
router.register(r'operator/ads/analytics', views.OperatorAdDailySummaryViewSet, basename='operator-ad-analytics')

# Widget public endpoints (B2: trailing slash optional via /?$ to match engine no-slash fetch)
urlpatterns = [
    re_path(r'^widget/config/?$', WidgetConfigView.as_view(), name='widget-config'),
    re_path(r'^widget/ad/?$', WidgetAdView.as_view(), name='widget-ad'),
] + router.urls
