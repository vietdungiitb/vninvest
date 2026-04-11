from django.contrib import admin
from django.urls import path, include
from rest_framework_simplejwt.views import TokenRefreshView
from .health import healthcheck, market_observability_health, prefetch_health, realtime_health, streams_health
import portfolio.views as portfolio_views
from portfolio.views import AdminOpsStatsView
from portfolio.auth_views import (
    GoogleOAuthView,
    RegisterView,
    ResendVerificationEmailView,
    UserMeView,
    VerifiedEmailTokenObtainPairView,
    VerifyEmailView,
)
from portfolio.legal_views import LegalPagePublicView

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/auth/token/', VerifiedEmailTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/auth/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('api/auth/me/', UserMeView.as_view(), name='auth-me'),
    path('api/auth/register/', RegisterView.as_view(), name='auth-register'),
    path('api/auth/oauth/google/', GoogleOAuthView.as_view(), name='auth-oauth-google'),
    path('api/auth/verify-email/', VerifyEmailView.as_view(), name='auth-verify-email'),
    path('api/auth/resend-verification/', ResendVerificationEmailView.as_view(), name='auth-resend-verification'),
    path('api/portfolio/', include('portfolio.urls')),
    # Tách biệt route stock-management
    path('api/stock-management/', include('portfolio.urls_stock')),
    path('api/realtime/', include('portfolio.urls_realtime')),
    path('api/admin-sync/', include('portfolio.urls_admin_sync')),
    path('api/health/', healthcheck, name='healthcheck'),
    path('api/health/realtime/', realtime_health, name='realtime-health'),
    path('api/health/streams/', streams_health, name='streams-health'),
    path('api/health/prefetch/', prefetch_health, name='prefetch-health'),
    path('api/health/market-observability/', market_observability_health, name='market-observability-health'),
    path('api/admin-ops/stats/', AdminOpsStatsView.as_view(), name='admin-ops-stats'),
    path('api/admin-ops/runtime-kpi/', portfolio_views.admin_runtime_kpi_api, name='admin-ops-runtime-kpi'),
    path('api/admin-ops/runtime-kpi/advisory-merge/', portfolio_views.admin_runtime_kpi_advisory_merge_api, name='admin-ops-runtime-kpi-advisory-merge'),
    path('api/admin-ops/runtime-kpi/whale-pipeline/', portfolio_views.admin_runtime_kpi_whale_pipeline_api, name='admin-ops-runtime-kpi-whale-pipeline'),
    path('api/admin-ops/runtime-kpi/advisory-metrics/', portfolio_views.admin_runtime_kpi_advisory_metrics_api, name='admin-ops-runtime-kpi-advisory-metrics'),
    path('api/admin-ops/system-ai-settings/', portfolio_views.admin_system_ai_settings_api, name='admin-ops-system-ai-settings'),
    path('api/admin-ops/system-ai-settings/test-connection/', portfolio_views.admin_system_ai_test_connection_api, name='admin-ops-system-ai-test-connection'),
    path('api/admin-ops/system-ai-settings/audit-logs/', portfolio_views.admin_system_ai_audit_logs_api, name='admin-ops-system-ai-audit-logs'),
    path('api/admin-ops/prefetch/warm/', portfolio_views.warm_ticker_prefetch_api, name='admin-ops-prefetch-warm'),
    path('api/admin-ops/market-groups/sync/', portfolio_views.sync_market_groups_api, name='admin-ops-market-groups-sync'),
    path('api/ai-options/', portfolio_views.ai_options_api, name='ai-options'),
    path('api/ai-config/', portfolio_views.ai_config_api, name='ai-config'),
    path('api/ai-config/test-connection/', portfolio_views.ai_test_connection_api, name='ai-test-connection'),
    # Sprint 28 — Public legal content (no auth required)
    path('api/public/legal-pages/', LegalPagePublicView.as_view(), name='public-legal-pages'),
]
