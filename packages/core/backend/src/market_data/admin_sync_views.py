"""
Admin Operations: Market Groups Sync Views.

Real implementation for syncing market groups from upstream (vnbroker)
into the GlobalSymbolRegistry and triggering the GlobalSymbolPlanner
for data ingestion.
"""

import logging
from typing import Any

from django.conf import settings
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from user_workspace.permissions import TenantScopePermission
from .global_symbol_planner import create_global_planner_run
from .global_symbol_registry import sync_admin_group_symbol_set, sync_system_default_symbol_group
from .vnbroker_adapter import fetch_symbol_group_members

logger = logging.getLogger(__name__)


class AdminOpsMarketGroupsSyncView(APIView):
    """
    POST /core/v1/market-data/admin-groups/sync/
    
    Sync all market groups from upstream (vnbroker) into GlobalSymbolRegistry asynchronously.
    """
    permission_classes = [permissions.IsAdminUser, TenantScopePermission]

    def post(self, request) -> Response:
        from data_ingest.tasks import sync_market_groups
        mode = request.data.get('mode', 'active')
        if mode not in ('active', 'all'):
            mode = 'active'
            
        task_result = sync_market_groups.delay(user_id=request.user.id, mode=mode)
        
        return Response({
            "ok": True,
            "status": "accepted",
            "task_id": task_result.id,
            "message": "Đang đồng bộ danh sách mã chứng khoán trong nền..."
        }, status=status.HTTP_202_ACCEPTED)


class AdminOpsMarketGroupsPreviewView(APIView):
    """
    GET /core/v1/market-data/admin-groups/preview/
    
    Preview what symbols would be synced without actually syncing.
    Useful for dry-run validation.
    """
    permission_classes = [permissions.IsAdminUser, TenantScopePermission]

    def get(self, request) -> Response:
        exchange_groups = getattr(settings, 'MARKET_DATA_SYNC_EXCHANGE_GROUPS', ['HOSE', 'HNX', 'UPCOM'])
        index_groups = getattr(settings, 'MARKET_DATA_SYNC_INDEX_GROUPS', ['VN30', 'VN100'])
        
        preview = {}
        total_estimated = 0
        
        for group in exchange_groups + index_groups:
            try:
                symbols = fetch_symbol_group_members(group)
                preview[group] = {
                    "count": len(symbols),
                    "symbols": symbols[:20],  # First 20 for preview
                    "truncated": len(symbols) > 20,
                }
                total_estimated += len(symbols)
            except Exception as e:
                preview[group] = {"count": 0, "error": str(e)}
        
        return Response({
            "estimated_total_symbols": total_estimated,
            "groups": preview,
        })


class AdminOpsSystemDefaultsSeedView(APIView):
    """
    POST /core/v1/market-data/system-defaults/seed/
    
    Seed system default groups (VN30, VN100) into GlobalSymbolRegistry.
    This ensures priority tiering works correctly for core indices.
    """
    permission_classes = [permissions.IsAdminUser, TenantScopePermission]

    def post(self, request) -> Response:
        results = {}
        errors = []
        
        for group_id in ('vn30', 'vn100'):
            try:
                symbols = fetch_symbol_group_members(group_id.upper())
                if symbols:
                    synced = sync_system_default_symbol_group(group_id, symbols)
                    results[group_id] = {"seeded": len(synced), "symbols": symbols}
                else:
                    results[group_id] = {"seeded": 0, "warning": "No symbols returned"}
            except Exception as e:
                error_msg = f"Failed to seed {group_id}: {str(e)}"
                logger.error(error_msg)
                errors.append(error_msg)
                results[group_id] = {"seeded": 0, "error": str(e)}
        
        return Response({
            "ok": len(errors) == 0,
            "results": results,
            "errors": errors,
        }, status=status.HTTP_200_OK if len(errors) == 0 else status.HTTP_207_MULTI_STATUS)
