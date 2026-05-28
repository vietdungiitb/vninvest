from .dataops_base import *

class DataOpsInventoryView(SOCBaseView):
    """GET /api/soc/dataops/inventory/ — data warehouse inventory stats."""

    @extend_schema(
        summary='Thống kê kho dữ liệu thị trường',
        description='Trả về inventory toàn bộ dữ liệu thị trường trong DB: tổng quan, phân bổ theo năm, và coverage theo nhóm.',
        responses={200: OpenApiTypes.OBJECT, 401: OpenApiTypes.OBJECT, 403: OpenApiTypes.OBJECT},
    )
    def get(self, request):
        from datetime import timedelta
        from django.db.models import Min, Max, Count
        from django.db.models.functions import TruncYear
        from market_data.models import DailyPrice
        from market_serving.models import SymbolSnapshot
        from market_data.vnbroker_adapter import fetch_symbol_group_members
        from ..matrix_coordinator import PREDEFINED_SYMBOL_GROUPS
        from ..models import CustomSymbolGroup

        # ── Tổng quan DailyPrice ────────────────────────────────────────────
        dp_agg = DailyPrice.objects.aggregate(
            earliest=Min('date'), latest=Max('date'),
            total_rows=Count('id'), total_symbols=Count('symbol', distinct=True),
        )
        cal_days = (
            (dp_agg['latest'] - dp_agg['earliest']).days + 1
            if dp_agg['earliest'] and dp_agg['latest'] else 0
        )

        # ── Phân bổ theo năm ────────────────────────────────────────────────
        by_year_qs = (
            DailyPrice.objects.annotate(yr=TruncYear('date'))
            .values('yr')
            .annotate(rows=Count('id'), symbols=Count('symbol', distinct=True))
            .order_by('yr')
        )
        by_year = [
            {'year': str(r['yr'])[:4], 'rows': r['rows'], 'symbols': r['symbols']}
            for r in by_year_qs
        ]

        # ── Coverage theo nhóm (30-ngày gần nhất) ──────────────────────────
        cutoff = dp_agg['latest'] - timedelta(days=30) if dp_agg['latest'] else None
        groups_data = []
        all_groups = list(PREDEFINED_SYMBOL_GROUPS) + [
            {'id': cg.group_id, 'name': cg.name, 'type': 'custom'}
            for cg in CustomSymbolGroup.objects.filter(is_active=True).order_by('name')
        ]
        for g in all_groups:
            try:
                syms = fetch_symbol_group_members(g['id'])
                total = len(syms)
                agg = DailyPrice.objects.filter(symbol__in=syms).aggregate(
                    earliest=Min('date'), latest=Max('date'),
                    rows=Count('id'), covered=Count('symbol', distinct=True),
                )
                recent = (
                    DailyPrice.objects.filter(symbol__in=syms, date__gte=cutoff)
                    .values('symbol').distinct().count()
                    if cutoff else 0
                )
                group_days = (
                    (agg['latest'] - agg['earliest']).days + 1
                    if agg['earliest'] and agg['latest'] else 0
                )
                groups_data.append({
                    'id': g['id'], 'name': g['name'], 'type': g.get('type', 'index'),
                    'symbol_count': total, 'covered_symbols': agg['covered'] or 0,
                    'recent_symbols': recent, 'total_rows': agg['rows'] or 0,
                    'earliest_date': agg['earliest'].isoformat() if agg['earliest'] else None,
                    'latest_date': agg['latest'].isoformat() if agg['latest'] else None,
                    'calendar_days': group_days,
                })
            except Exception:
                groups_data.append({
                    'id': g['id'], 'name': g['name'], 'type': g.get('type', 'index'),
                    'symbol_count': 0, 'covered_symbols': 0, 'recent_symbols': 0,
                    'total_rows': 0, 'earliest_date': None, 'latest_date': None, 'calendar_days': 0,
                })

        # ── Các loại dữ liệu khác ───────────────────────────────────────────
        snapshot_count = SymbolSnapshot.objects.aggregate(
            total=Count('id'), symbols=Count('symbol', distinct=True)
        )
        from market_serving.models import SessionFacts
        session_agg = SessionFacts.objects.aggregate(
            total=Count('id'), symbols=Count('symbol', distinct=True),
            earliest=Min('session_date'), latest=Max('session_date'),
        )
        data_types = [
            {
                'name': 'DailyPrice', 'label': 'Giá ngày (OHLCV)',
                'total_rows': dp_agg['total_rows'] or 0,
                'symbols': dp_agg['total_symbols'] or 0,
                'earliest_date': dp_agg['earliest'].isoformat() if dp_agg['earliest'] else None,
                'latest_date': dp_agg['latest'].isoformat() if dp_agg['latest'] else None,
            },
            {
                'name': 'SymbolSnapshot', 'label': 'Snapshot giá realtime',
                'total_rows': snapshot_count['total'] or 0,
                'symbols': snapshot_count['symbols'] or 0,
                'earliest_date': None, 'latest_date': None,
            },
            {
                'name': 'SessionFacts', 'label': 'Facts phiên giao dịch',
                'total_rows': session_agg['total'] or 0,
                'symbols': session_agg['symbols'] or 0,
                'earliest_date': session_agg['earliest'].isoformat() if session_agg['earliest'] else None,
                'latest_date': session_agg['latest'].isoformat() if session_agg['latest'] else None,
            },
        ]

        return Response({
            'summary': {
                'total_rows': dp_agg['total_rows'] or 0,
                'total_symbols': dp_agg['total_symbols'] or 0,
                'earliest_date': dp_agg['earliest'].isoformat() if dp_agg['earliest'] else None,
                'latest_date': dp_agg['latest'].isoformat() if dp_agg['latest'] else None,
                'calendar_days': cal_days,
            },
            'by_year': by_year,
            'by_group': groups_data,
            'data_types': data_types,
        })
