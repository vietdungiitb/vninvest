from django.contrib import admin
from django.urls import path, include
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator
from django.views import View
import subprocess

@method_decorator(csrf_exempt, name='dispatch')
class SyncStockProfileView(View):
    def post(self, request, *args, **kwargs):
        try:
            # Gọi lệnh đồng bộ mã chứng khoán
            result = subprocess.run([
                'python', 'manage.py', 'sync_stockprofile'
            ], capture_output=True, text=True, cwd='.')
            if result.returncode == 0:
                return JsonResponse({'success': True, 'output': result.stdout})
            else:
                return JsonResponse({'success': False, 'error': result.stderr}, status=500)
        except Exception as e:
            return JsonResponse({'success': False, 'error': str(e)}, status=500)

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/auth/token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/auth/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('api/', include('portfolio.urls')),
    # Tách biệt route stock-management
    path('api/stock-management/', include('portfolio.urls_stock')),
    path('api/sync-stockprofile/', SyncStockProfileView.as_view(), name='sync-stockprofile'),
]
