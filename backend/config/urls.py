from django.contrib import admin
from django.urls import path, include
from rest_framework_simplejwt.views import TokenRefreshView
from .health import healthcheck, prefetch_health, realtime_health, streams_health
import portfolio.views as portfolio_views
from portfolio.views import AdminOpsStatsView
from portfolio.auth_views import (
    RegisterView,
    ResendVerificationEmailView,
    UserMeView,
    VerifiedEmailTokenObtainPairView,
    VerifyEmailView,
)

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/auth/token/', VerifiedEmailTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/auth/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('api/auth/me/', UserMeView.as_view(), name='auth-me'),
    path('api/auth/register/', RegisterView.as_view(), name='auth-register'),
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
    path('api/admin-ops/stats/', AdminOpsStatsView.as_view(), name='admin-ops-stats'),
    path('api/admin-ops/market-groups/sync/', portfolio_views.sync_market_groups_api, name='admin-ops-market-groups-sync'),
]
