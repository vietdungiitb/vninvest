from django.contrib import admin
from django.urls import include, path

from . import views_health

urlpatterns = [
    path('admin/', admin.site.urls),
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
    # Native public bootstrap routes owned by core-api domain apps.
    path('api/', include(('commercial.public_urls', 'commercial_public'), namespace='commercial_public')),
    path('api/', include(('market_data.public_urls', 'market_data_public'), namespace='market_data_public')),
    path('api/', include(('market_serving.api_urls', 'market_serving_api'), namespace='market_serving_api')),
    path('api/', include(('signal_intelligence.api_urls', 'signal_intelligence_api'), namespace='signal_intelligence_api')),
    path('api/', include(('user_workspace.urls', 'user_workspace_api'), namespace='user_workspace_api')),
    path('api/', include(('identity_access.api_urls', 'identity_access_api'), namespace='identity_access_api')),
    path('api/', include(('market_data.urls', 'market_data_api'), namespace='market_data_api')),
    # Compat layer: maps legacy frontend API paths to core views or graceful stubs.
    # Must be LAST so native routes take precedence.
    path('api/', include('vninvest_core.compat_urls')),
]
