from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path, re_path
from drf_spectacular.openapi import OpenApiTypes
from drf_spectacular.utils import extend_schema
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView
from rest_framework.decorators import api_view
from rest_framework.response import Response

from . import views_health

# API-01 R1: 4 handler lỗi cấp Django. Xem giải thích dài ở cuối file.
# `exceptions.py` không import `urls`, nên đặt ở đầu file không gây vòng import.
from .exceptions import (
    problem_400 as _problem_400,
)
from .exceptions import (
    problem_403 as _problem_403,
)
from .exceptions import (
    problem_404 as _problem_404,
)
from .exceptions import (
    problem_500 as _problem_500,
)
from .legacy_proxy import legacy_proxy_view


@extend_schema(
    summary='admin_ops_gone',
    description='Declared so drf-spectacular stops reporting an unguessable serializer; payload shape is verified by the envelope invariant tests.',
    request=OpenApiTypes.OBJECT,
    responses={
        200: OpenApiTypes.OBJECT,
    },
)
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
    # Compat health route for legacy monitors that still probe /api/health/.
    path('api/health', views_health.health, name='api_health_compat_no_slash'),
    path('api/health/', views_health.health, name='api_health_compat'),
    path('core/v1/health', views_health.health, name='core_health'),
    path('core/v1/health/', views_health.health, name='core_health_slash'),
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
    path('core/v1/', include(('market_data.core_urls', 'market_data'), namespace='market_data')),
    path('core/v1/', include(('data_ingest.urls', 'data_ingest'), namespace='data_ingest')),
    path('core/v1/', include(('support.urls', 'support'), namespace='support')),
    path('core/v1/', include(('advertising.urls', 'advertising'), namespace='advertising')),
    
    path('core/v1/', include(('ai_analytics.urls', 'ai_analytics'), namespace='ai_analytics')),
    # Native public bootstrap routes owned by core-api domain apps.
    path('api/', include(('commercial.public_urls', 'commercial_public'), namespace='commercial_public')),
    path('api/', include(('advertising.api_urls', 'advertising_api'), namespace='advertising_api')),
    # D2: admin-ops decommissioned — all sub-paths return 410 GONE
    re_path(r'^api/admin-ops/.*$', admin_ops_gone),
    path('api/soc/', include(('service_ops.urls', 'service_ops'), namespace='service_ops')),
    # SFI-B2: Auth compat routes — handled natively, not proxied.
    path('api/', include(('identity_access.api_urls', 'identity_access_api'), namespace='identity_access_api')),
    # SFI-B1.3: Proxy catch-all — last route, unmatched /api/* forwarded to legacy backend.
    path('api/<path:remaining>', legacy_proxy_view),
]

if settings.DEBUG:
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)

# API-01 R1 / PB1: lỗi ở tầng Django trả `application/problem+json`, không HTML.
#
# `core_api_exception_handler` của DRF chỉ chạy cho exception ném ra **trong
# view DRF**. URL không khớp, method không khớp, hay exception trong middleware
# đều dừng trước đó và mặc định trả HTML — đây là nguồn của OW-01.
#
# Gán ở đây (URLconf gốc) chứ không ở app con: Django chỉ dùng handler ở
# ROOT_URLCONF. Đặt trong app con sẽ không có tác dụng gì.
#
# **Phải là callable, không phải chuỗi.** Django đọc `handler404` như thuộc tính
# module rồi gọi nó. Gán chuỗi `'vninvest_core.exceptions.problem_404'` khiến
# Django lỗi `'str' object is not callable` và **rơi về handler mặc định** —
# tức `/khong-ton-tai-xyz` vẫn trả HTML 404 dù code trông như đã cấu hình.
# Chuỗi chỉ hợp lệ cho biến `handler404` trong *settings*, không phải URLconf.
#
# Loại lỗi này **không bị test file `test_problem_json.py` bắt** vì cả 3 class
# đầu của nó `@override_settings(ROOT_URLCONF=__name__)` — tức chạy URLconf riêng
# của test. `RealRootUrlconfProblemTests` mới kiểm tra trên URLconf thật.
handler400 = _problem_400
handler403 = _problem_403
handler404 = _problem_404
handler500 = _problem_500