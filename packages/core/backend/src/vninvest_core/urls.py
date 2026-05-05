from django.urls import include, path

from . import views_health
from .legacy_proxy import legacy_proxy_view

urlpatterns = [
    # SM-P5.2: Prometheus metrics endpoint
    path('', include('django_prometheus.urls')),
    path('core/v1/health', views_health.health, name='core_health'),
    path('core/v1/capability-bootstrap', views_health.capability_bootstrap, name='core_capability_bootstrap'),
    path('core/v1/', include(('identity_access.urls', 'identity_access'), namespace='identity_access')),
    path('core/v1/', include(('identity_access.partner_urls', 'identity_access_partner'), namespace='identity_access_partner')),
    path('core/v1/', include(('market_serving.urls', 'market_serving'), namespace='market_serving')),
    path('core/v1/', include(('signal_intelligence.urls', 'signal_intelligence'), namespace='signal_intelligence')),
    path('core/v1/', include(('commercial.urls', 'commercial'), namespace='commercial')),
    path('core/v1/', include(('ops_audit.urls', 'ops_audit'), namespace='ops_audit')),
    # SM-P4 new domain endpoints
    path('core/v1/', include(('advisory.urls', 'advisory'), namespace='advisory')),
    path('core/v1/', include(('user_workspace.urls', 'user_workspace'), namespace='user_workspace')),
    path('core/v1/', include(('market_data.urls', 'market_data'), namespace='market_data')),
    # Legacy compat routes (SM-P4.2)
    path('api/', include(('identity_access.compat_urls', 'identity_access_compat'), namespace='identity_access_compat')),
    path('api/', include(('vninvest_core.compat_portfolio', 'compat_portfolio'), namespace='compat_portfolio')),
    # SFI-B3: Market & Realtime compat routes (native core-api, no proxy)
    path('api/', include(('market_serving.compat_urls', 'market_serving_compat'), namespace='market_serving_compat')),
    path('api/', include(('signal_intelligence.compat_urls', 'signal_intelligence_compat'), namespace='signal_intelligence_compat')),
    path('api/', include(('market_data.compat_urls', 'market_data_compat'), namespace='market_data_compat')),
    # SFI-B4: Portfolio & Workspace compat routes
    path('api/', include(('user_workspace.compat_urls', 'user_workspace_compat'), namespace='user_workspace_compat')),
    # SFI-B1.3: Transparent proxy — MUST be last. Forwards unhandled /api/* to legacy backend.
    # Remove individual prefixes from legacy_proxy.PROXY_EXCLUDED_PREFIXES as domains migrate natively.
    path('api/<path:remaining>', legacy_proxy_view, name='legacy_proxy'),
]
