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
    
    Sync all market groups from upstream (vnbroker) into GlobalSymbolRegistry.
    This replaces the stub endpoint that returned {"status": "accepted"}.
    
    Process:
    1. Fetch symbols for each exchange/group from vnbroker
    2. Sync to GlobalSymbolRegistry via sync_admin_group_symbol_set()
    3. Trigger GlobalSymbolPlanner for data ingestion (daily_prices, price_board_snapshot)
    4. Return sync summary with counts
    """
    permission_classes = [permissions.IsAdminUser, TenantScopePermission]

    def post(self, request) -> Response:
        # 0. Sync StockProfile metadata and update default watchlist groups for the user
        from market_data.vnbroker_adapter import fetch_listing_symbols
        from market_data.models import StockProfile
        try:
            logger.info("Syncing StockProfile metadata from upstream listing client...")
            symbols_data = fetch_listing_symbols()
            if symbols_data:
                existing_profiles = {p.symbol: p for p in StockProfile.objects.all()}
                to_create = []
                to_update = []
                for item in symbols_data:
                    sym = item.get('symbol')
                    if not sym:
                        continue
                    exchange = item.get('exchange', 'HOSE') or 'HOSE'
                    company_name = item.get('company_name', '')
                    industry = item.get('industry', '') or ''
                    if sym in existing_profiles:
                        profile = existing_profiles[sym]
                        changed = False
                        if profile.exchange != exchange:
                            profile.exchange = exchange
                            changed = True
                        if profile.company_name != company_name:
                            profile.company_name = company_name
                            changed = True
                        if profile.industry != industry:
                            profile.industry = industry
                            changed = True
                        if profile.status != StockProfile.StatusChoices.ACTIVE:
                            profile.status = StockProfile.StatusChoices.ACTIVE
                            changed = True
                        if changed:
                            to_update.append(profile)
                    else:
                        to_create.append(StockProfile(
                            symbol=sym,
                            exchange=exchange,
                            company_name=company_name,
                            industry=industry,
                            status=StockProfile.StatusChoices.ACTIVE
                        ))
                if to_create:
                    StockProfile.objects.bulk_create(to_create, batch_size=500)
                if to_update:
                    StockProfile.objects.bulk_update(to_update, ['exchange', 'company_name', 'industry', 'status'], batch_size=500)
                logger.info(f"Bulk synced StockProfile metadata: created {len(to_create)}, updated {len(to_update)}")
        except Exception as e:
            logger.error(f"Failed to sync StockProfile metadata during admin sync: {e}")

        try:
            from market_data.stock_mgmt_native_views import seed_default_watchlist_groups
            logger.info(f"Re-seeding default watchlist groups for user {request.user.username}...")
            seed_default_watchlist_groups(request.user, force_recreate=True)
        except Exception as e:
            logger.error(f"Failed to re-seed default watchlist groups during admin sync: {e}")

        # Configuration for groups to sync
        exchange_groups = getattr(settings, 'MARKET_DATA_SYNC_EXCHANGE_GROUPS', ['HOSE', 'HNX', 'UPCOM'])
        sector_groups = getattr(settings, 'MARKET_DATA_SYNC_SECTOR_GROUPS', [])
        index_groups = getattr(settings, 'MARKET_DATA_SYNC_INDEX_GROUPS', ['VN30', 'VN100'])
        
        all_synced_symbols = set()
        sync_results = {}
        errors = []
        
        # 1. Sync exchange-based groups (HOSE, HNX, UPCOM)
        for exchange in exchange_groups:
            try:
                logger.info(f"Fetching symbols for exchange: {exchange}")
                symbols = fetch_symbol_group_members(exchange)
                if symbols:
                    synced = sync_admin_group_symbol_set(
                        group_name=exchange.lower(),
                        symbols=symbols,
                        group_type="EXCHANGE",
                        description=f"All symbols on {exchange}",
                    )
                    count = len(synced)
                    all_synced_symbols.update(symbols)
                    sync_results[exchange] = {"synced": count, "symbols": symbols}
                    logger.info(f"Synced {count} symbols for {exchange}")
                else:
                    sync_results[exchange] = {"synced": 0, "symbols": [], "warning": "No symbols returned"}
            except Exception as e:
                error_msg = f"Failed to sync {exchange}: {str(e)}"
                logger.error(error_msg)
                errors.append(error_msg)
                sync_results[exchange] = {"synced": 0, "error": str(e)}
        
        # 2. Sync sector groups (if configured)
        for sector in sector_groups:
            try:
                logger.info(f"Fetching symbols for sector: {sector}")
                symbols = fetch_symbol_group_members(sector)
                if symbols:
                    synced = sync_admin_group_symbol_set(
                        group_name=sector.lower().replace(' ', '_'),
                        symbols=symbols,
                        group_type="SECTOR",
                        description=f"Sector: {sector}",
                    )
                    count = len(synced)
                    all_synced_symbols.update(symbols)
                    sync_results[sector] = {"synced": count, "symbols": symbols}
                    logger.info(f"Synced {count} symbols for sector {sector}")
            except Exception as e:
                error_msg = f"Failed to sync sector {sector}: {str(e)}"
                logger.error(error_msg)
                errors.append(error_msg)
                sync_results[sector] = {"synced": 0, "error": str(e)}
        
        # 3. Sync index groups (VN30, VN100)
        for index_name in index_groups:
            try:
                logger.info(f"Fetching symbols for index: {index_name}")
                symbols = fetch_symbol_group_members(index_name)
                if symbols:
                    synced = sync_admin_group_symbol_set(
                        group_name=index_name.lower(),
                        symbols=symbols,
                        group_type="INDEX",
                        description=f"Index: {index_name}",
                    )
                    count = len(synced)
                    all_synced_symbols.update(symbols)
                    sync_results[index_name] = {"synced": count, "symbols": symbols}
                    logger.info(f"Synced {count} symbols for index {index_name}")
            except Exception as e:
                error_msg = f"Failed to sync index {index_name}: {str(e)}"
                logger.error(error_msg)
                errors.append(error_msg)
                sync_results[index_name] = {"synced": 0, "error": str(e)}
        
        # 4. Also sync system default groups (VN30, VN100) for priority tiering
        try:
            for group_id in ('vn30', 'vn100'):
                symbols = fetch_symbol_group_members(group_id.upper())
                if symbols:
                    sync_system_default_symbol_group(group_id, symbols)
        except Exception as e:
            logger.warning(f"Failed to sync system default groups: {e}")
        
        # 5. Trigger GlobalSymbolPlanner for data ingestion
        planner_result = None
        if all_synced_symbols:
            try:
                logger.info(f"Triggering GlobalSymbolPlanner for {len(all_synced_symbols)} symbols")
                planner_result = create_global_planner_run(
                    symbols=list(all_synced_symbols),
                    datasets=['daily_prices', 'price_board_snapshot'],
                    mode='missing_only',
                    force_refresh=False,
                    reason='admin_market_groups_sync',
                    execution_mode='async',
                )
                logger.info(f"Planner triggered: {planner_result.get('run_id')}")
            except Exception as e:
                error_msg = f"Failed to trigger planner: {str(e)}"
                logger.error(error_msg)
                errors.append(error_msg)
        
        total_synced = sum(r.get('synced', 0) for r in sync_results.values())
        
        return Response({
            "ok": len(errors) == 0,
            "total_symbols_synced": total_synced,
            "unique_symbols": len(all_synced_symbols),
            "groups": sync_results,
            "planner": planner_result,
            "errors": errors,
            "message": f"Synced {total_synced} symbols across {len(sync_results)} groups" + 
                       (f" ({len(errors)} errors)" if errors else ""),
        }, status=status.HTTP_200_OK if len(errors) == 0 else status.HTTP_207_MULTI_STATUS)


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
