from django.contrib import admin
from django.urls import path, include
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from .health import healthcheck

urlpatterns = [
    path('admin/', admin.site.urls),
    path('health/', healthcheck, name='healthcheck'),
    path('api/auth/token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/auth/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('api/', include('portfolio.urls')),
]
