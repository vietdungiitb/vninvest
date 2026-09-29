# Kế hoạch: Chuẩn hóa nhóm thị trường — Single Source of Truth từ vnbroker

**Ngày:** 2026-07-15
**Cập nhật:** 2026-07-16
**Mục tiêu:** Loại bỏ hoàn toàn hardcode gây drift data giữa backend, frontend, và vnbroker providers
**Trạng thái:** Đã implement (Steps 1-13 phần backend + frontend cơ bản)

### Trạng thái thực tế (2026-07-16)
- ✅ Step 1: `CachedSymbolGroup` model có thêm `group_type`, `color`, `display_order` (migration `0009`)
- ✅ Step 2: `sync_cached_symbol_groups()` upsert cả sector groups (từ `_SECTOR_GROUPS` static) + provider groups, populate metadata từ `_GROUP_METADATA`
- ✅ Step 3: `SymbolGroupSyncView` đã tồn tại
- ✅ Step 4: `SymbolGroupListView.get()` trả `group_type`, `color`, `display_order` từ DB
- ✅ Step 5: Auto-sync khi DB trống
- ✅ Step 6: `seed_default_watchlist_groups()` dùng `CachedSymbolGroup` làm SSOT (KHÔNG còn đọc `default_groups.py`)
- ✅ Step 7-9: Frontend `useSymbolGroups` đã có, không còn `SYMBOL_GROUPS` hardcode
- ✅ Step 10: `StockManagementGroupsView` + `StockManagementSeedView` (legacy + native) dùng `CachedSymbolGroup`
- ✅ `default_groups.py` giờ chỉ làm fallback (first deploy trước sync) — không còn SSOT

### Lưu ý quan trọng
- **vnbroker KHÔNG có sector groups** → sector groups (Ngân hàng, BĐS, ...) được sync từ `_SECTOR_GROUPS` static map trong `vnbroker_adapter.py`, KHÔNG từ provider.
- **Display metadata** (`color`, `group_type`, `display_order`) lấy từ `_GROUP_METADATA` static map (vnbroker chỉ trả `group_name`/`category`).
- `default_groups.py` giữ lại làm fallback an toàn, nhưng KHÔNG còn là nguồn data chính.


---

## 1. Vấn đề hiện tại (Drift Analysis)

### 1.1 Kiến trúc hiện tại — 3 nguồn hardcode không đồng bộ

```
vnbroker.get_supported_groups()  ──x──>  KHÔNG AI GỌI
                                         (KBS: 16 nhóm, VCI: 19 nhóm, TCBS: 15 nhóm)

matrix_coordinator.py            ──x──>  PREDEFINED_SYMBOL_GROUPS hardcoded 6 nhóm
                                         (vn30, vn50, vn100, hose, hnx, upcom)

frontend (3+ files)              ──x──>  SYMBOL_GROUPS hardcoded, sai lệch giữa các file
```

### 1.2 Bảng drift chi tiết

| Vấn đề | File | Dòng | Mô tả |
|---------|------|------|-------|
| Backend hardcoded predefined | `matrix_coordinator.py` | 17-24 | 6 nhóm cố định, không gọi vnbroker |
| Frontend SYMBOL_GROUPS #1 | `SocDataOpsBackfillForm.tsx` | 15 | `["VN30","VN50","VN100","HOSE","HNX","UPCOM","ALL","CUSTOM"]` |
| Frontend SYMBOL_GROUPS #2 | `SocDataOpsOperationsSection.tsx` | 57 | `["VN30","VN50","VN100","HOSE","HNX","UPCOM","ALL"]` — thiếu CUSTOM |
| Frontend SYMBOL_GROUPS #3 | `SocBackfillCenter.tsx` | 14 | `["VN30","VN50","VN100","HOSE","HNX","UPCOM","ALL"]` — thiếu CUSTOM |
| Legacy SYMBOL_GROUPS #4 | `DataOpsPanel.jsx` | 26-35 | Object format `[{"key":"VN30","label":"VN30"}, ...]` |
| EXCLUDED_MARKET_GROUPS #1 | `WatchlistContext.tsx` | 58-61 | 12 nhóm, title case Vietnamese |
| EXCLUDED_MARKET_GROUPS #2 | `useCoreDashboardData.js` | 148-151 | 12 nhóm, UPPERCASE Vietnamese |
| EXCLUDED_MARKET_GROUPS #3 | `ModernDashboard.jsx` | 30-35 | 4 nhóm, English, `Set` |
| VN30 symbols khác nhau | `VNSymbolSearch.tsx` vs `default_groups.py` | — | Danh sách mã VN30 không khớp |
| i18n keys không dùng | `vi.js` / `en.js` | 629-636 | `group_vn30`..`group_custom` tồn tại nhưng không component nào dùng |

### 1.3 Hậu quả

1. **VN30 symbol list drift** — `VNSymbolSearch.tsx` hardcode 30 mã khác với `default_groups.py`
2. **EXCLUDED_MARKET_GROUPS sai casing** — WatchlistContext dùng "Ngân hàng", Dashboard dùng "NGÂN HÀNG" → filter không match
3. **Frontend không biết nhóm mới** — vnbroker thêm group mới → frontend không hiển thị
4. **Backend predefined group list cũ** — `PREDEFINED_SYMBOL_GROUPS` không cập nhật khi thị trường thay đổi

---

## 2. Kiến trúc mục tiêu

```
vnbroker Listing.get_supported_groups()
        │
        ▼  (sync on demand qua API)
  CachedSymbolGroup (DB — single source of truth)
        │
        ├──> GET /api/soc/symbol-groups/     → SOC frontend (Operations, Backfill, Matrix)
        ├──> GET /stock-management/groups/    → Watchlist page, Dashboard
        └──> fetch_symbol_group_members()     → Backend group member resolution
```

### 2.1 Nguyên tắc

1. **Không hardcode group nào** — tất cả lấy từ DB
2. **DB cache từ vnbroker** — sync khi cần, không gọi provider mỗi request
3. **Frontend fetch từ API** — không const `SYMBOL_GROUPS`
4. **Backward compatible** — response shape giữ nguyên, thêm field mới

---

## 3. Danh sách nhóm từ vnbroker providers

### 3.1 So sánh cross-provider

| Provider | Số nhóm | Cột DataFrame | Ghi chú |
|----------|---------|---------------|---------|
| KBS | 16 | `group_name, group_code, category, description` | group_code ≠ group_name (VN30→"30") |
| VCI | 19 | `group_name, group_code, category, description` | group_code = group_name; thêm HNXCon, HNXFin, HNXLCap, HNXMSCap, HNXMan |
| TCBS | 15 | `group_name, category, description` | **Thiếu cột `group_code`**; casing khác (VNMIDCAP) |
| DNSE | 0 | — | **Không có `get_supported_groups()`** |

### 3.2 Danh mục nhóm KBS (source chính)

| Category | Groups |
|----------|--------|
| Chỉ số VN | VN30, VN100, VNMidCap, VNSmallCap, VNSI, VNX50, VNXALL, VNALL, HNX30 |
| Sàn giao dịch | HOSE, HNX, UPCOM |
| ETF/Quỹ | ETF |
| Chứng quyền | CW |
| Trái phiếu | BOND |
| Phái sinh | FU_INDEX |

---

## 4. Chi tiết thực hiện

### Step 1: Backend — Model `CachedSymbolGroup`

**File tạo mới:** `packages/core/backend/src/service_ops/models.py` (sau `CustomSymbolGroup`, line 446)

```python
class CachedSymbolGroup(models.Model):
    """Nhóm thị trường cache từ vnbroker provider — single source of truth cho group list."""

    group_name = models.CharField(
        max_length=50,
        unique=True,
        verbose_name='Tên nhóm',
        help_text='VD: VN30, HOSE, VNMidCap',
    )
    group_code = models.CharField(
        max_length=20,
        blank=True,
        default='',
        verbose_name='Mã nhóm (provider code)',
        help_text='Mã nội bộ provider. VD: KBS dùng "30" cho VN30',
    )
    category = models.CharField(
        max_length=50,
        blank=True,
        default='',
        verbose_name='Phân loại',
        help_text='VD: Chỉ số VN, Sàn giao dịch, ETF/Quỹ',
    )
    description = models.TextField(blank=True, default='', verbose_name='Mô tả')
    source_provider = models.CharField(
        max_length=20,
        verbose_name='Provider nguồn',
        help_text='Provider lấy dữ liệu: KBS, VCI, TCBS',
    )
    symbol_count = models.PositiveIntegerField(
        null=True,
        blank=True,
        verbose_name='Số lượng mã',
        help_text='Số mã trong nhóm (null nếu chưa resolve)',
    )
    is_active = models.BooleanField(default=True, verbose_name='Đang hoạt động')
    synced_at = models.DateTimeField(auto_now=True, verbose_name='Lần sync gần nhất')

    class Meta:
        ordering = ['category', 'group_name']
        verbose_name = 'Nhóm thị trường (cached)'
        verbose_name_plural = 'Nhóm thị trường (cached)'

    def __str__(self):
        return f'{self.group_name} ({self.symbol_count or "?"} mã, {self.source_provider})'
```

**Migration:** `0008_add_cached_symbol_group.py`

```python
from django.db import migrations, models

class Migration(migrations.Migration):
    dependencies = [
        ('service_ops', '0007_rename_svc_beb_run_state_idx_service_ops_run_id_0c8c61_idx_and_more'),
    ]

    operations = [
        migrations.CreateModel(
            name='CachedSymbolGroup',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False)),
                ('group_name', models.CharField(help_text='VD: VN30, HOSE, VNMidCap', max_length=50, unique=True)),
                ('group_code', models.CharField(blank=True, default='', help_text='Mã nội bộ provider', max_length=20)),
                ('category', models.CharField(blank=True, default='', help_text='VD: Chỉ số VN, Sàn giao dịch', max_length=50)),
                ('description', models.TextField(blank=True, default='')),
                ('source_provider', models.CharField(help_text='KBS, VCI, TCBS', max_length=20)),
                ('symbol_count', models.PositiveIntegerField(blank=True, help_text='Số mã trong nhóm', null=True)),
                ('is_active', models.BooleanField(default=True)),
                ('synced_at', models.DateTimeField(auto_now=True)),
            ],
            options={
                'verbose_name': 'Nhóm thị trường (cached)',
                'verbose_name_plural': 'Nhóm thị trường (cached)',
                'ordering': ['category', 'group_name'],
            },
        ),
    ]
```

---

### Step 2: Backend — Sync service

**File tạo mới:** `packages/core/backend/src/service_ops/symbol_group_sync.py`

```python
"""Sync nhóm thị trường từ vnbroker provider vào CachedSymbolGroup."""

from __future__ import annotations

import logging
from dataclasses import dataclass

logger = logging.getLogger(__name__)

# Thứ tự ưu tiên provider
_PROVIDER_ORDER = ('KBS', 'VCI', 'TCBS')


@dataclass
class SyncResult:
    synced: int
    deactivated: int
    source: str
    error: str | None = None


def sync_groups(source: str | None = None) -> SyncResult:
    """
    1. Tạo Listing(source=...)
    2. Gọi listing.get_supported_groups() → DataFrame
    3. Với mỗi group_name, gọi listing.symbols_by_group() → đếm symbols
    4. Upsert vào CachedSymbolGroup
    5. Soft-delete groups không còn ở provider (is_active=False)
    """
    from ..market_data.vnbroker_adapter import (
        _load_listing_adapter_class,
        _resolve_realtime_source,
    )

    providers_to_try = [source] if source else list(_PROVIDER_ORDER)

    for prov in providers_to_try:
        try:
            normalized = _resolve_realtime_source(prov)
            listing_class = _load_listing_adapter_class()
            client = listing_class(source=normalized)

            # Lấy danh sách nhóm
            groups_df = client.get_supported_groups()

            if groups_df is None or groups_df.empty:
                logger.warning("Provider %s trả về empty groups", normalized)
                continue

            return _upsert_groups(groups_df, normalized, client)

        except Exception as exc:
            logger.warning("Provider %s fail: %s", prov, exc)
            continue

    return SyncResult(
        synced=0, deactivated=0, source='none',
        error='Tất cả providers đều fail',
    )


def _upsert_groups(groups_df, source: str, client) -> SyncResult:
    """Upsert groups từ DataFrame vào CachedSymbolGroup."""
    from ..models import CachedSymbolGroup

    imported_group_names = set()
    synced = 0

    for _, row in groups_df.iterrows():
        group_name = str(row.get('group_name', '')).strip()
        if not group_name:
            continue

        group_code = str(row.get('group_code', '')).strip()
        category = str(row.get('category', '')).strip()
        description = str(row.get('description', '')).strip()

        # Đếm symbols (lazy — có thể fail)
        symbol_count = None
        try:
            symbols = client.symbols_by_group(group=group_name)
            if symbols is not None and hasattr(symbols, '__len__'):
                symbol_count = len(symbols)
        except Exception:
            pass

        obj, created = CachedSymbolGroup.objects.update_or_create(
            group_name=group_name,
            defaults={
                'group_code': group_code,
                'category': category,
                'description': description,
                'source_provider': source,
                'symbol_count': symbol_count,
                'is_active': True,
            },
        )
        imported_group_names.add(group_name)
        synced += 1

    # Soft-deactivate groups không còn ở provider
    deactivated = CachedSymbolGroup.objects.filter(
        is_active=True,
        source_provider=source,
    ).exclude(
        group_name__in=imported_group_names,
    ).update(is_active=False)

    return SyncResult(
        synced=synced,
        deactivated=deactivated,
        source=source,
    )
```

---

### Step 3: Backend — Sync API endpoint

**File sửa:** `packages/core/backend/src/service_ops/views/symbol_groups.py`

Thêm view class mới:

```python
class SymbolGroupSyncView(SOCBaseView):
    """
    POST /api/soc/symbol-groups/sync/  → Trigger sync từ vnbroker provider.
    """

    @extend_schema(
        summary='Đồng bộ nhóm thị trường từ provider',
        description='Gọi vnbroker get_supported_groups() và lưu vào CachedSymbolGroup.',
        tags=['SOC Symbol Groups'],
    )
    def post(self, request):
        from ..symbol_group_sync import sync_groups

        source = str(request.data.get('source') or '').strip() or None
        result = sync_groups(source=source)

        if result.error:
            return Response(
                {
                    'detail': result.error,
                    'synced': result.synced,
                    'deactivated': result.deactivated,
                    'source': result.source,
                },
                status=status.HTTP_502_BAD_GATEWAY,
            )

        return Response({
            'synced': result.synced,
            'deactivated': result.deactivated,
            'source': result.source,
        })
```

**File sửa:** `packages/core/backend/src/service_ops/urls.py`

Thêm route (trước `symbol-groups/<slug>/`):

```python
path('symbol-groups/sync/', symbol_groups.SymbolGroupSyncView.as_view(), name='soc_symbol_groups_sync'),
```

---

### Step 4: Backend — Update `SymbolGroupListView.get()`

**File sửa:** `packages/core/backend/src/service_ops/views/symbol_groups.py`

Thay thế phần predefined (dòng 54-65):

```python
def get(self, request):
    # Lấy predefined groups từ CachedSymbolGroup (DB) thay vì hardcoded
    cached = CachedSymbolGroup.objects.filter(is_active=True)
    predefined = [
        {
            'slug': g.group_name.lower().replace(' ', '-'),
            'group_id': g.group_name.lower().replace(' ', '-'),
            'name': g.group_name,
            'symbol_count': g.symbol_count,
            'category': g.category,
            'group_code': g.group_code,
            'source_provider': g.source_provider,
            'synced_at': g.synced_at.isoformat() if g.synced_at else None,
            'type': _category_to_type(g.category),
            'is_active': True,
            'is_predefined': True,
        }
        for g in cached
    ]

    # Fallback: nếu DB trống → auto-sync
    if not predefined:
        from ..symbol_group_sync import sync_groups
        sync_groups()
        # Retry
        cached = CachedSymbolGroup.objects.filter(is_active=True)
        predefined = [...]  # same mapping

    custom_qs = CustomSymbolGroup.objects.all().order_by('name')
    custom = [_serialize_custom_group(g) for g in custom_qs]
    return Response({'predefined': predefined, 'custom': custom})
```

Helper function:

```python
def _category_to_type(category: str) -> str:
    """Map category từ vnbroker sang type string cho frontend."""
    cat_lower = (category or '').lower()
    if 'chỉ số' in cat_lower or 'index' in cat_lower:
        return 'index'
    if 'sàn' in cat_lower or 'exchange' in cat_lower:
        return 'exchange'
    if 'etf' in cat_lower or 'quỹ' in cat_lower or 'fund' in cat_lower:
        return 'etf'
    return 'other'
```

---

### Step 5: Backend — Auto-sync on first load

**File sửa:** `packages/core/backend/src/service_ops/views/symbol_groups.py`

Trong `SymbolGroupListView.get()`, sau khi query `cached`:

```python
# Auto-sync nếu DB trống (first deploy hoặc sau migrate)
if not cached.exists():
    from ..symbol_group_sync import sync_groups
    sync_groups()
    cached = CachedSymbolGroup.objects.filter(is_active=True)
```

**Alternative:** Dùng Django signal trong `apps.py`:

```python
def ready(self):
    try:
        from .models import CachedSymbolGroup
        if CachedSymbolGroup.objects.count() == 0:
            from .symbol_group_sync import sync_groups
            sync_groups()
    except Exception:
        pass  # Skip trên test/first migrate
```

---

### Step 6: Backend — Update `/stock-management/groups/` endpoint

**File tìm:** `packages/core/backend/src/market_data/` — view cho `GET /core/v1/stock-management/groups/`

Thay data source từ `STOCK_MANAGEMENT_DEFAULT_GROUPS` (`default_groups.py`) sang `CachedSymbolGroup`:

```python
# TRƯỚC (hardcoded từ default_groups.py):
# groups = STOCK_MANAGEMENT_DEFAULT_GROUPS

# SAU (từ DB):
from service_ops.models import CachedSymbolGroup, CustomSymbolGroup

cached_groups = CachedSymbolGroup.objects.filter(is_active=True)
custom_groups = CustomSymbolGroup.objects.filter(is_active=True)

# Merge + resolve members cho mỗi group
```

Giữ nguyên response shape `{ id, name, items: [{symbol, ...}] }`.

---

### Step 7: Frontend — Shared constants

**File tạo mới:** `packages/web/src/constants/marketGroups.ts`

```typescript
/**
 * Giá trị cố định KHÔNG PHẢI group data.
 * Group data lấy từ API, không hardcode.
 */

/** Group mặc định khi chưa select */
export const DEFAULT_SYMBOL_GROUP = "VN30";

/** Key sentinel cho custom group trong UI */
export const CUSTOM_GROUP_KEY = "__custom__";

/** ID gửi lên backend khi chọn custom */
export const CUSTOM_GROUP_ID = "custom";
```

---

### Step 8: Frontend — Hook `useSymbolGroups`

**File tạo mới:** `packages/web/src/hooks/useSymbolGroups.ts`

```typescript
import { useCallback, useEffect, useState } from "react";
import { defaultCoreApiAdapter } from "../adapters/coreApiAdapter.js";

export interface SymbolGroup {
  slug: string;
  group_id: string;
  name: string;
  symbol_count: number | null;
  category?: string;
  group_code?: string;
  source_provider?: string;
  synced_at?: string;
  type: "index" | "exchange" | "etf" | "other" | "custom";
  is_active: boolean;
  is_predefined: boolean;
}

interface SymbolGroupsResponse {
  predefined: SymbolGroup[];
  custom: SymbolGroup[];
}

const adapter = defaultCoreApiAdapter as unknown as {
  getSocSymbolGroups: () => Promise<SymbolGroupsResponse>;
  syncSocSymbolGroups?: (payload?: { source?: string }) => Promise<{
    synced: number;
    deactivated: number;
    source: string;
  }>;
};

export function useSymbolGroups() {
  const [predefined, setPredefined] = useState<SymbolGroup[]>([]);
  const [custom, setCustom] = useState<SymbolGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await adapter.getSocSymbolGroups();
      setPredefined(data.predefined || []);
      setCustom(data.custom || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load groups");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const sync = useCallback(async (source?: string) => {
    if (!adapter.syncSocSymbolGroups) return;
    await adapter.syncSocSymbolGroups(source ? { source } : undefined);
    await load();
  }, [load]);

  return {
    predefined,
    custom,
    allGroups: [...predefined, ...custom],
    loading,
    error,
    sync,
    reload: load,
  };
}
```

---

### Step 9: Frontend — Adapter method

**File sửa:** `packages/web/src/adapters/core/soc.js`

Thêm method (sau `getSocSymbolGroups`):

```javascript
syncSocSymbolGroups(payload) {
  return corePost("/operator/soc/symbol-groups/sync/", payload || {});
},
```

---

### Step 10: Frontend — Xóa hardcoded `SYMBOL_GROUPS`

#### 10a. `SocDataOpsOperationsSection.tsx`

```diff
- const SYMBOL_GROUPS = ["VN30", "VN50", "VN100", "HOSE", "HNX", "UPCOM", "ALL"];
+ import { useSymbolGroups } from "../../hooks/useSymbolGroups.js";
+ import { CUSTOM_GROUP_KEY } from "../../constants/marketGroups.js";
```

Trong component:

```diff
+ const { predefined, custom: apiCustomGroups, loading: groupsLoading } = useSymbolGroups();

  const allGroups = [
-   ...SYMBOL_GROUPS.map((g) => ({ key: g, label: g, type: "builtin" })),
-   ...customGroups.map((g) => ({ key: g.slug, label: g.name, type: "custom" })),
-   { key: CUSTOM_GROUP_KEY, label: t("soc.dataops.backfill_custom_group_label"), type: "custom" },
+   ...predefined.map((g) => ({ key: g.group_id, label: g.name, type: "builtin" })),
+   ...apiCustomGroups.map((g) => ({ key: g.slug, label: g.name, type: "custom" })),
+   { key: CUSTOM_GROUP_KEY, label: t("soc.dataops.backfill_custom_group_label"), type: "custom" },
  ];
```

#### 10b. `SocBackfillCenter.tsx`

```diff
- const SYMBOL_GROUPS = ["VN30", "VN50", "VN100", "HOSE", "HNX", "UPCOM", "ALL"];
+ import { useSymbolGroups } from "../../hooks/useSymbolGroups.js";
+ import { CUSTOM_GROUP_KEY } from "../../constants/marketGroups.js";
```

Tương tự OperationsSection — dùng `predefined` từ hook thay vì constant.

#### 10c. `SocDataOpsBackfillForm.tsx`

Component này **orphaned** (không mount ở bất kỳ đâu trong `SocDataOpsPanel.tsx`).

Lựa chọn:
- **Option A:** Xóa file entirely (nếu đã confirm không dùng)
- **Option B:** Refactor dùng hook nếu cần giữ lại

---

### Step 11: Frontend — Fix `EXCLUDED_MARKET_GROUPS`

#### 11a. Constants mới

**File sửa:** `packages/web/src/constants/marketGroups.ts` (thêm vào)

```typescript
/**
 * IDs của system groups cần loại khỏi danh sách watchlist user.
 * Dùng group_id (lowercase) để so sánh — KHÔNG dùng name (có thể i18n/drift).
 */
export const SYSTEM_GROUP_IDS = [
  // Index groups
  "vn30", "vn50", "vn100", "hnx30",
  // Exchange groups
  "hose", "hnx", "upcom",
  // Sector groups (từ default_groups.py — dùng slug form)
  "ngan-hang", "bat-dong-san", "thep-vat-lieu",
  "dau-khi", "cong-nghe", "ban-le-tieu-dung",
];
```

#### 11b. `WatchlistContext.tsx`

```diff
- const EXCLUDED_MARKET_GROUPS = [
-   "Ngân hàng", "Bất động sản", "Thép & Vật liệu", "Dầu khí", "Công nghệ",
-   "Bán lẻ & Tiêu dùng", "VN30", "VN100", "HNX30", "HOSE", "HNX", "UPCOM"
- ];
+ import { SYSTEM_GROUP_IDS } from "../../../constants/marketGroups.js";
```

```diff
  // Filter watchlists
- wlList = wlList.filter((wl: Watchlist) => !EXCLUDED_MARKET_GROUPS.includes(wl.name));
+ wlList = wlList.filter((wl: Watchlist) => {
+   const slug = String(wl.id || '').toLowerCase();
+   return !SYSTEM_GROUP_IDS.includes(slug);
+ });
```

#### 11c. `useCoreDashboardData.js`

```diff
- const EXCLUDED_MARKET_GROUPS = [
-   "NGÂN HÀNG", "BẤT ĐỘNG SẢN", "THÉP & VẬT LIỆU", "DẦU KHÍ", "CÔNG NGHỆ",
-   "BÁN LẺ & TIÊU DÙNG", "VN30", "VN100", "HNX30", "HOSE", "HNX", "UPCOM"
- ];
+ import { SYSTEM_GROUP_IDS } from "../../constants/marketGroups.js";
```

```diff
- return !EXCLUDED_MARKET_GROUPS.includes(name);
+ const slug = String(id || '').toLowerCase();
+ return !SYSTEM_GROUP_IDS.includes(slug);
```

#### 11d. `ModernDashboard.jsx` (legacy frontend)

```diff
- const EXCLUDED_MARKET_GROUPS = new Set(['VN100', 'HOSE', 'HNX', 'UPCOM']);
+ // Import từ shared constants nếu legacy frontend có thể import
+ // Hoặc giữ inline nhưng dùng đúng danh sách
+ const EXCLUDED_MARKET_GROUPS = new Set([
+   'VN30', 'VN50', 'VN100', 'HNX30', 'HOSE', 'HNX', 'UPCOM',
+ ]);
```

---

### Step 12: Frontend — Watchlist dùng dynamic groups

**File sửa:** `packages/web/src/pages/watchlist/components/WatchlistContext.tsx`

Thay vì gọi `getLegacyWatchlistGroups()` (endpoint cũ trả về `default_groups.py` data):

```diff
- const res = await api.getLegacyWatchlistGroups();
+ const res = await api.getSocSymbolGroups();
+ // Map predefined groups thành LegacyGroup shape
+ const groupsList = (res.predefined || []).map(g => ({
+   id: g.group_id,
+   name: g.name,
+   symbol_count: g.symbol_count,
+   type: g.type,
+ }));
```

Hoặc giữ endpoint cũ nhưng backend serve từ `CachedSymbolGroup` (ít thay đổi frontend hơn).

---

### Step 13: i18n — Cleanup

**Files:** `packages/web/src/i18n/vi.js`, `en.js`

Các key `group_vn30`..`group_custom` (lines 629-636) đã tồn tại. Sau khi frontend fetch groups từ API:

- Dùng `group_name` từ API làm label chính
- i18n keys làm fallback khi `group_name` null
- Thêm key mới cho các nhóm mới từ vnbroker:

```javascript
// vi.js — thêm:
"soc.dataops.group_vnmidcap": "VN Mid-Cap",
"soc.dataops.group_vnsmallcap": "VN Small-Cap",
"soc.dataops.group_vnx50": "VN X50",
"soc.dataops.group_vnxall": "VN All-Share",
"soc.dataops.group_vnall": "VN All",
"soc.dataops.group_etf": "ETF",
"soc.dataops.group_cw": "Chứng quyền",
"soc.dataops.group_bond": "Trái phiếu",
"soc.dataops.group_fu_index": "Phái sinh",
```

---

## 5. Bảng file thay đổi

| File | Hành động | Mô tả |
|------|-----------|-------|
| `service_ops/models.py` | **Sửa** | Thêm `CachedSymbolGroup` model |
| `service_ops/migrations/0008_*.py` | **Tạo mới** | Migration cho model mới |
| `service_ops/symbol_group_sync.py` | **Tạo mới** | Sync service logic |
| `service_ops/views/symbol_groups.py` | **Sửa** | Thêm `SymbolGroupSyncView`, sửa `get()` dùng DB |
| `service_ops/urls.py` | **Sửa** | Thêm route `symbol-groups/sync/` |
| `market_data/vnbroker_adapter.py` | **Xem lại** | `fetch_symbol_group_members()` dùng `CachedSymbolGroup` thay `_LISTING_GROUP_ALIASES` |
| `web/src/constants/marketGroups.ts` | **Tạo mới** | Shared constants |
| `web/src/hooks/useSymbolGroups.ts` | **Tạo mới** | Hook fetch groups từ API |
| `web/src/adapters/core/soc.js` | **Sửa** | Thêm `syncSocSymbolGroups()` |
| `web/src/components/soc/SocDataOpsOperationsSection.tsx` | **Sửa** | Dùng hook, xóa hardcoded |
| `web/src/components/soc/SocBackfillCenter.tsx` | **Sửa** | Dùng hook, xóa hardcoded |
| `web/src/components/soc/SocDataOpsBackfillForm.tsx` | **Xóa/Sửa** | Orphaned — xóa hoặc refactor |
| `web/src/pages/watchlist/components/WatchlistContext.tsx` | **Sửa** | Dùng `SYSTEM_GROUP_IDS`, có thể dùng dynamic groups |
| `web/src/features/dashboard/useCoreDashboardData.js` | **Sửa** | Dùng `SYSTEM_GROUP_IDS` |
| `frontend/src/pages/modern/ModernDashboard.jsx` | **Sửa** | Fix EXCLUDED_MARKET_GROUPS |
| `web/src/i18n/vi.js` | **Sửa** | Thêm keys cho nhóm mới từ vnbroker |
| `web/src/i18n/en.js` | **Sửa** | Tương tự vi.js |

---

## 6. Thứ tự thực hiện

| Step | Mô tả | Dependency | Verify |
|------|-------|-----------|--------|
| 1 | Model `CachedSymbolGroup` + migration | — | `python manage.py migrate` |
| 2 | Sync service | Step 1 | Unit test sync logic |
| 3 | Sync API endpoint | Step 2 | `curl POST /symbol-groups/sync/` |
| 4 | Update `SymbolGroupListView.get()` | Step 1 | `curl GET /symbol-groups/` trả về data từ DB |
| 5 | Auto-sync on first load | Step 2, 4 | Xóa DB, reload, verify auto-sync |
| 6 | Frontend shared constants | — | — |
| 7 | Hook `useSymbolGroups` | Step 4, 8 | — |
| 8 | Adapter `syncSocSymbolGroups` | Step 3 | — |
| 9 | Remove hardcoded `SYMBOL_GROUPS` | Step 7 | `npx tsc --noEmit`, `npm run build` |
| 10 | Fix `EXCLUDED_MARKET_GROUPS` | Step 6 | Verify watchlist filter đúng |
| 11 | Watchlist dùng dynamic groups | Step 4 | Verify sidebar render đúng |
| 12 | Update `/stock-management/groups/` | Step 1, 4 | Verify legacy frontend vẫn hoạt động |
| 13 | i18n cleanup | Step 9 | — |

---

## 7. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| vnbroker provider down khi sync | Không có groups mới | Giữ data cũ trong DB, sync retry |
| TCBS trả 3 columns (thiếu `group_code`) | KeyError trong sync | Handle missing column: `row.get('group_code', '')` |
| DNSE thiếu `get_supported_groups()` | Không sync từ DNSE | Skip DNSE, chỉ dùng KBS/VCI |
| Frontend cache stale groups | Nhóm mới không hiện | Thêm `synced_at` timestamp, UI hiển thị "Last synced: ..." |
| Legacy endpoint `/stock-management/groups/` có consumer khác | Break API | Giữ nguyên response shape, chỉ thay data source |
| First deploy chưa có data trong DB | Frontend render empty | Auto-sync trong `SymbolGroupListView.get()` khi DB trống |
| `fetch_symbol_group_members()` dùng `_LISTING_GROUP_ALIASES` hardcoded | Groups mới không resolve được | Cập nhật adapter dùng `CachedSymbolGroup` thay alias dict |

---

## 8. Kiểm tra hoàn thành

- [ ] `npx tsc --noEmit` — không type errors
- [ ] `npm run build` — build pass
- [ ] `python manage.py migrate` — migration apply thành công
- [ ] `GET /api/soc/symbol-groups/` trả về groups từ DB (không hardcoded)
- [ ] `POST /api/soc/symbol-groups/sync/` sync thành công từ KBS
- [ ] Frontend SOC Operations tab render groups từ API
- [ ] Watchlist sidebar render "Thị trường & Chỉ số" từ dynamic data
- [ ] `EXCLUDED_MARKET_GROUPS` chỉ còn 1 definition trong `constants/marketGroups.ts`
- [ ] Không còn `const SYMBOL_GROUPS = [...]` trong bất kỳ component nào
- [ ] VN30 symbol list khớp giữa backend và frontend
