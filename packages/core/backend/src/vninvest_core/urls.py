from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path, re_path

from rest_framework.decorators import api_view
from rest_framework.response import Response

from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

from . import views_health


@api_view(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'])
def admin_ops_gone(request, *args, **kwargs):
    """D2: admin-ops endpoints decommissioned — all routes return 410 GONE."""
    return Response(
        {'detail': 'admin-ops endpoint has been decommissioned. Use /api/soc/ instead.', 'code': 'ADMIN_OPS_GONE'},
        status=410,
    )

urlpatterns = [
    path('admin/', admin.site.urls),
    # SM-P5.2: Prometheus metrics endpoint
    path('', include('django_prometheus.urls')),
    path('core/v1/health', views_health.health, name='core_health'),
    path('core/v1/capability-bootstrap', views_health.capability_bootstrap, name='core_capability_bootstrap'),
    # OpenAPI schema + Swagger UI (chỉ DEBUG hoặc internal)
    path('core/v1/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('core/v1/schema/swagger-ui/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
    path('core/v1/', include(('identity_access.urls', 'identity_access'), namespace='identity_access')),
    path('core/v1/', include(('identity_access.partner_urls', 'identity_access_partner'), namespace='identity_access_partner')),
    path('core/v1/', include(('market_serving.urls', 'market_serving'), namespace='market_serving')),
    path('core/v1/', include(('signal_intelligence.urls', 'signal_intelligence'), namespace='signal_intelligence')),
    path('core/v1/', include(('commercial.urls', 'commercial'), namespace='commercial')),
    path('core/v1/', include(('ops_audit.urls', 'ops_audit'), namespace='ops_audit')),
    path('core/v1/operator/', include(('vninvest_core.contracts.operator.urls', 'operator'), namespace='operator')),
    # SM-P4 new domain endpoints
    path('core/v1/', include(('advisory.urls', 'advisory'), namespace='advisory')),
    path('core/v1/', include(('user_workspace.urls', 'user_workspace'), namespace='user_workspace')),
    path('core/v1/', include(('market_data.urls', 'market_data'), namespace='market_data')),
    path('core/v1/', include(('data_ingest.urls', 'data_ingest'), namespace='data_ingest')),
    # Native public bootstrap routes owned by core-api domain apps.
    path('api/', include(('commercial.public_urls', 'commercial_public'), namespace='commercial_public')),
    path('api/', include(('market_data.public_urls', 'market_data_public'), namespace='market_data_public')),
    path('api/', include(('market_serving.api_urls', 'market_serving_api'), namespace='market_serving_api')),
    path('api/', include(('signal_intelligence.api_urls', 'signal_intelligence_api'), namespace='signal_intelligence_api')),
    path('api/', include(('user_workspace.urls', 'user_workspace_api'), namespace='user_workspace_api')),
    path('api/', include(('identity_access.api_urls', 'identity_access_api'), namespace='identity_access_api')),
    path('api/', include(('market_data.urls', 'market_data_api'), namespace='market_data_api')),
    # D2: admin-ops decommissioned — all sub-paths return 410 GONE
    re_path(r'^api/admin-ops/.*$', admin_ops_gone),
    path('api/soc/', include(('service_ops.urls', 'service_ops'), namespace='service_ops')),

]

if settings.DEBUG:
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
