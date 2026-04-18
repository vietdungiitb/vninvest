from django.http import JsonResponse
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAdminUser, IsAuthenticated
from rest_framework.response import Response

from .models import MarketGroupSyncLog


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def sync_stockprofile_api(request):
    from . import views as legacy_views

    result = legacy_views.sync_stock_profiles(
        requested_by=request.user,
        mode=request.query_params.get('mode', 'all'),
    )
    return JsonResponse(
        {
            'success': result['success'],
            'message': result['message'],
            'warning': result.get('warning'),
            'source': result.get('source'),
            'total_symbols': result.get('total_symbols', 0),
            'created_symbols': result.get('created_symbols', 0),
            'updated_symbols': result.get('updated_symbols', 0),
            'error': result.get('error', ''),
        },
        status=200 if result['success'] else 500,
    )


@api_view(['POST'])
@permission_classes([IsAdminUser])
def sync_stock_profiles_from_snapshot_api(request):
    """
    POST /api/admin-ops/stockprofile/sync-snapshot/
    Trigger đồng bộ StockProfile.industry + company_name từ MarketSnapshot (KBS).
    Đồng thời ghi dữ liệu static vào Redis để heatmap đọc nhanh.
    Yêu cầu is_staff.
    """
    from portfolio.tasks_stock_profile_sync import sync_stock_profiles_from_snapshot

    symbols_raw = request.data.get('symbols')
    symbols = [s.strip().upper() for s in symbols_raw if s] if isinstance(symbols_raw, list) else None

    result = sync_stock_profiles_from_snapshot.delay(symbols=symbols)
    return Response(
        {
            'success': True,
            'message': 'Task đồng bộ StockProfile từ MarketSnapshot đã được enqueue.',
            'task_id': result.id,
            'symbols_requested': len(symbols) if symbols else 'all',
        },
        status=status.HTTP_202_ACCEPTED,
    )


@api_view(['POST'])
@permission_classes([IsAdminUser])
def sync_market_groups_api(request):
    """
    POST /api/admin-ops/market-groups/sync/
    Trigger đồng bộ nhóm thị trườ ng (sectors, market caps) toàn hệ thống.
    Yêu cầu is_staff.
    """
    mode = request.query_params.get('mode', 'all')
    clear_existing = request.query_params.get('clear', 'false').lower() == 'true'

    from . import views as legacy_views

    result = legacy_views.sync_market_groups(
        requested_by=request.user,
        mode=mode,
        clear_existing=clear_existing,
        scope=MarketGroupSyncLog.ScopeChoices.GLOBAL,
    )

    if result.get('warning') and result.get('success'):
        resp_status = status.HTTP_207_MULTI_STATUS
    elif result.get('success'):
        resp_status = status.HTTP_200_OK
    else:
        resp_status = status.HTTP_500_INTERNAL_SERVER_ERROR

    return Response(
        {
            'success': result.get('success', False),
            'message': result.get('message', ''),
            'warning': result.get('warning'),
            'source': result.get('source'),
            'created_groups': result.get('created_groups_count', 0),
            'updated_groups': result.get('updated_groups_count', 0),
            'added_symbols': result.get('added_symbols_count', 0),
            'error': result.get('error', ''),
        },
        status=resp_status,
    )