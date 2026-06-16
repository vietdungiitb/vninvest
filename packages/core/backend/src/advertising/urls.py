from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework.urlpatterns import format_suffix_patterns
from advertising import views

# Disable format suffix patterns to avoid double registration during system checks
class NoFormatSuffixRouter(DefaultRouter):
    def get_urls(self):
        # Copy of DefaultRouter.get_urls but without format_suffix_patterns
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
                urls.append(path(regex, view, name=name))
        
        # Don't call format_suffix_patterns
        return urls

router = NoFormatSuffixRouter()
router.register(r'operator/ads/campaigns', views.OperatorAdCampaignViewSet, basename='operator-ad-campaign')
router.register(r'operator/ads/analytics', views.OperatorAdDailySummaryViewSet, basename='operator-ad-analytics')

urlpatterns = router.urls
