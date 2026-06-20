from django.urls import include, path

urlpatterns = [
    path('api/admin-ops/', include('vninvest_core.contracts.admin_ops.urls', namespace='admin_ops')),
]
