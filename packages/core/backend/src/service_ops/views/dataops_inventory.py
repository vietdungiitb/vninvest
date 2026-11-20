from django.core.cache import cache

from vninvest_core.api_envelope import envelope_response

from ..envelope import envelope
from .dataops_base import *

#: Inventory là báo cáo thay đổi chậm (dữ liệu ngày), nhưng aggregation quét
#: 4.5M row DailyPrice mất ~28s. Cache 5 phút trên Redis (dùng chung mọi worker)
#: để FE polling 15s không tính lại liên tục. Fail-soft khi Redis lỗi.
_INVENTORY_CACHE_KEY = 'soc:dataops:inventory:v1'
_INVENTORY_CACHE_TTL = 300


#: PREDEFINED_SYMBOL_GROUPS dùng id thấp (`vn50`), nhưng cache lưu tên provider
#: (`VNX50` / group_code `X50`). Ánh xạ ở đây thay vì gọi provider ngoài.
_DB_GROUP_NAME_ALIASES = {'top100': 'VN100', 'vn50': 'VNX50'}


def _db_group_symbols(group_id):
    """Trả thành viên nhóm từ DB cache — KHÔNG gọi vnbroker/KBS.

    `CachedSymbolGroup` + `CachedSymbolGroupMember` là SSOT đã sync từ provider
    (22 nhóm / ~4k mã trên staging). Gọi `fetch_symbol_group_members()` ở đây
    từng làm request inventory treo khi KBS chậm ⇒ FE dính skeleton vĩnh viễn.
    """
    from ..models import CachedSymbolGroup, CustomSymbolGroup

    gid = str(group_id or '').strip().lower()
    if gid.startswith('custom_'):
        try:
            custom = CustomSymbolGroup.objects.get(slug=gid[len('custom_'):], is_active=True)
        except CustomSymbolGroup.DoesNotExist:
            return []
        return custom.clean_symbols()

    name = _DB_GROUP_NAME_ALIASES.get(gid, gid.upper())
    group = (
        CachedSymbolGroup.objects.filter(is_active=True, group_name__iexact=name).first()
        or CachedSymbolGroup.objects.filter(is_active=True, group_code__iexact=gid.upper()).first()
    )
    if group is None:
        return []
    return list(group.members.values_list('symbol', flat=True))


class DataOpsInventoryView(SOCBaseView):
    """GET /api/soc/dataops/inventory/ — data warehouse inventory stats."""

    @extend_schema(
        summary='Thống kê kho dữ liệu thị trường',
        description='Trả về inventory toàn bộ dữ liệu thị trường trong DB: tổng quan, phân bổ theo năm, và coverage theo nhóm.',
        responses={200: envelope_response(), 401: OpenApiTypes.OBJECT, 403: OpenApiTypes.OBJECT},
    )
    def get(self, request):
        from datetime import timedelta

        from django.db import connection
        from django.db.models import Count, Max, Min

        from market_data.models import DailyPrice, StockProfile
        from market_serving.models import SymbolSnapshot

        from ..matrix_coordinator import PREDEFINED_SYMBOL_GROUPS
        from ..models import CustomSymbolGroup

        try:
            cached = cache.get(_INVENTORY_CACHE_KEY)
        except Exception:
            cached = None
        if cached is not None:
            return envelope(cached)

        # ── MỘT query duy nhất quét 4.5M row DailyPrice ─────────────────────
        # Trước đây: 1 query tổng + 1 by_year + 7 query group (~25s cold).
        # GROUP BY (symbol, year) cho ra mọi số liệu cần cho summary/by_year/by_group.
        earliest = DailyPrice.objects.order_by('date').values_list('date', flat=True).first()
        latest = DailyPrice.objects.order_by('-date').values_list('date', flat=True).first()
        cutoff = latest - timedelta(days=30) if latest else None

        with connection.cursor() as cur:
            cur.execute(
                """
                SELECT symbol,
                       EXTRACT(YEAR FROM date)::int AS yr,
                       COUNT(*) AS n,
                       COUNT(*) FILTER (WHERE date >= %s) AS recent_n,
                       MIN(date) AS earliest,
                       MAX(date) AS latest
                FROM market_data_dailyprice
                GROUP BY symbol, EXTRACT(YEAR FROM date)::int
                """,
                [cutoff],
            )
            raw_rows = cur.fetchall()

        per_symbol = {}
        year_rows = {}
        for symbol, yr, n, recent_n, symbol_earliest, symbol_latest in raw_rows:
            yr = int(yr)
            year_rows[yr] = year_rows.get(yr, 0) + int(n)
            st = per_symbol.setdefault(
                symbol,
                {'rows': 0, 'recent': 0, 'earliest': None, 'latest': None},
            )
            st['rows'] += int(n)
            st['recent'] += int(recent_n or 0)
            if symbol_earliest is not None and (st['earliest'] is None or symbol_earliest < st['earliest']):
                st['earliest'] = symbol_earliest
            if symbol_latest is not None and (st['latest'] is None or symbol_latest > st['latest']):
                st['latest'] = symbol_latest

        dp_agg = {
            'earliest': earliest,
            'latest': latest,
            'total_rows': sum(s['rows'] for s in per_symbol.values()),
            'total_symbols': StockProfile.objects.count(),
        }
        cal_days = (latest - earliest).days + 1 if earliest and latest else 0

        # FE chỉ dùng `rows` cho biểu đồ theo năm; giữ key `symbols` để không đổi shape.
        by_year = [
            {'year': str(yr), 'rows': n, 'symbols': 0}
            for yr, n in sorted(year_rows.items())
        ]

        # ── Coverage theo nhóm (30-ngày gần nhất) ──────────────────────────
        groups_data = []
        all_groups = list(PREDEFINED_SYMBOL_GROUPS) + [
            {'id': cg.group_id, 'name': cg.name, 'type': 'custom'}
            for cg in CustomSymbolGroup.objects.filter(is_active=True).order_by('name')
        ]
        for g in all_groups:
            try:
                syms = _db_group_symbols(g['id'])
                selected = [per_symbol[s] for s in syms if s in per_symbol]
                group_earliest = min(
                    (s['earliest'] for s in selected if s['earliest'] is not None),
                    default=None,
                )
                group_latest = max(
                    (s['latest'] for s in selected if s['latest'] is not None),
                    default=None,
                )
                group_days = (
                    (group_latest - group_earliest).days + 1
                    if group_earliest and group_latest else 0
                )
                groups_data.append({
                    'id': g['id'], 'name': g['name'], 'type': g.get('type', 'index'),
                    'symbol_count': len(syms), 'covered_symbols': len(selected),
                    'recent_symbols': sum(1 for s in selected if s['recent'] > 0),
                    'total_rows': sum(s['rows'] for s in selected),
                    'earliest_date': group_earliest.isoformat() if group_earliest else None,
                    'latest_date': group_latest.isoformat() if group_latest else None,
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

        payload = {
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
        }
        try:
            cache.set(_INVENTORY_CACHE_KEY, payload, _INVENTORY_CACHE_TTL)
        except Exception:
            pass
        return envelope(payload)
