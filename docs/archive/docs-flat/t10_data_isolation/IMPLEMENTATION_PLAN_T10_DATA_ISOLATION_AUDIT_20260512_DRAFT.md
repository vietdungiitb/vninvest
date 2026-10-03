# IMPLEMENTATION PLAN — T10 Data Isolation Audit + FK Migration

**Task ID**: TENANT-T10  
**Title**: Data isolation audit + FK migration top 3 tables  
**Priority**: 🟡 P2 (Medium)  
**Depends on**: T09 (TenantMember + TenantInvite) ✅ COMPLETE  
**Estimate**: 6-8 hours  
**Status**: DRAFT (awaiting user confirmation)

---

## Objective

Ensure top 3 portfolio data models (Portfolio, WatchlistGroup, PriceAlertRule) have explicit tenant FK for data isolation, compliance, and efficient SaaS scoping.

---

## Current State Analysis

### Models Identified (Top 3 by criticality)

| Model | Location | Current FK | Issue | Scope |
|---|---|---|---|---|
| **Portfolio** | `backend/portfolio/models.py:332` | user (no tenant) | User can access Portfolio without tenant scope check | HIGH |
| **WatchlistGroup** | `backend/portfolio/models.py:102` | user (no tenant) | Watchlist groups not scoped to tenant | HIGH |
| **PriceAlertRule** | `backend/portfolio/models.py:633` | user (no tenant) | Price alerts not scoped to tenant | HIGH |

### Implicit Tenant Relationship
- Each model has `user` FK to Django's User model
- User → CoreTenant relationship exists via:
  - **owner_user**: User owns ONE primary tenant (identity_access.CoreTenant)
  - **TenantMember**: User can be member of MULTIPLE tenants (T09)

### Data Leakage Risk
🔴 **Without explicit tenant FK**, a malicious user could:
1. Query `Portfolio.objects.filter(user__in=[other_user1, other_user2])` if they somehow know other user IDs
2. Bypass tenant scoping if frontend trust is compromised
3. Make efficient bulk operations impossible (can't filter `Portfolio.objects.filter(tenant=tenant)`)

---

## Implementation Scope

### Phase 1: Add tenant FK to models (3 models × 3 steps = 9 steps)

**Step 1: Portfolio Model**
- Add `tenant` FK to Portfolio:
  ```python
  tenant = models.ForeignKey(
      'identity_access.CoreTenant',
      on_delete=models.CASCADE,
      related_name='portfolios',
      null=True,  # Temporary for migration
      blank=True,
  )
  ```
- Create migration `0xxx_portfolio_add_tenant_fk`
- Create data migration `0xxx_portfolio_backfill_tenant_fk` to populate existing rows
- Update Portfolio.save() to auto-set tenant from user if not provided (optional helper)

**Step 2: WatchlistGroup Model**
- Add `tenant` FK to WatchlistGroup:
  ```python
  tenant = models.ForeignKey(
      'identity_access.CoreTenant',
      on_delete=models.CASCADE,
      related_name='watchlist_groups',
      null=True,
      blank=True,
  )
  ```
- Create migration `0xxx_watchlistgroup_add_tenant_fk`
- Create data migration `0xxx_watchlistgroup_backfill_tenant_fk`

**Step 3: PriceAlertRule Model**
- Add `tenant` FK to PriceAlertRule:
  ```python
  tenant = models.ForeignKey(
      'identity_access.CoreTenant',
      on_delete=models.CASCADE,
      related_name='price_alert_rules',
      null=True,
      blank=True,
  )
  ```
- Create migration `0xxx_pricealertrule_add_tenant_fk`
- Create data migration `0xxx_pricealertrule_backfill_tenant_fk`

### Phase 2: Data Backfill (Safe migration with 3-step process)

For each model, create a data migration that:

```python
# Pseudo-code for data migration
def forward(apps, schema_editor):
    Model = apps.get_model('portfolio', 'Portfolio')  # Or WatchlistGroup, PriceAlertRule
    CoreTenant = apps.get_model('identity_access', 'CoreTenant')
    TenantMember = apps.get_model('identity_access', 'TenantMember')
    
    rows_updated = 0
    rows_orphaned = 0
    
    for obj in Model.objects.filter(tenant__isnull=True):
        # Try to find tenant via user ownership
        user_owned_tenant = CoreTenant.objects.filter(owner_user=obj.user).first()
        if user_owned_tenant:
            obj.tenant = user_owned_tenant
            obj.save()
            rows_updated += 1
            continue
        
        # Try to find tenant via membership
        member = TenantMember.objects.filter(user=obj.user).first()
        if member:
            obj.tenant = member.tenant
            obj.save()
            rows_updated += 1
            continue
        
        # Orphaned row: user has no tenant affiliation
        # Option: Set to NULL and investigate, OR fail the migration
        rows_orphaned += 1
        print(f"WARNING: Orphaned {Model.__name__} id={obj.id}, user={obj.user.username} has no tenant")
    
    print(f"Backfilled {rows_updated} rows, {rows_orphaned} orphaned")
```

### Phase 3: Add Isolation Tests

Create `packages/core/backend/tests/test_data_isolation.py` with:

**Test Case 1: Cross-Tenant Portfolio Query**
```python
def test_portfolio_cross_tenant_isolation(self):
    """Verify user cannot query portfolios from other tenants."""
    tenant1_owner = User.objects.create_user(username='tenant1_owner', email='t1@example.com', password='pass')
    tenant1 = CoreTenant.objects.create(owner_user=tenant1_owner, display_name='Tenant 1', status='active', plan='free')
    portfolio1 = Portfolio.objects.create(user=tenant1_owner, name='Portfolio T1', tenant=tenant1)
    
    tenant2_owner = User.objects.create_user(username='tenant2_owner', email='t2@example.com', password='pass')
    tenant2 = CoreTenant.objects.create(owner_user=tenant2_owner, display_name='Tenant 2', status='active', plan='free')
    portfolio2 = Portfolio.objects.create(user=tenant2_owner, name='Portfolio T2', tenant=tenant2)
    
    # User from tenant2 should NOT see tenant1's portfolio
    portfolios_visible_to_t2 = Portfolio.objects.filter(tenant=tenant2)
    assert portfolio1 not in portfolios_visible_to_t2
    assert portfolio2 in portfolios_visible_to_t2
```

**Test Case 2: WatchlistGroup Isolation**
```python
def test_watchlist_group_cross_tenant_isolation(self):
    """Verify watchlist groups are scoped by tenant."""
    # Similar structure as portfolio test
```

**Test Case 3: PriceAlertRule Isolation**
```python
def test_price_alert_rule_cross_tenant_isolation(self):
    """Verify price alert rules are scoped by tenant."""
    # Similar structure as portfolio test
```

**Test Case 4: Bulk Query Efficiency**
```python
def test_portfolio_tenant_scope_query_plan(self):
    """Verify filtering by tenant is efficient."""
    # Create portfolio with tenant
    # Query: Portfolio.objects.filter(tenant=tenant)
    # Assert only returns that tenant's data
    # (Could add DB query count check if using django-extensions)
```

### Phase 4: Migration Checklist

| Step | File | Status | Notes |
|------|------|--------|-------|
| Add FK to Portfolio | `0xxx_portfolio_add_tenant_fk.py` | — | Auto-generated by makemigrations |
| Add FK to WatchlistGroup | `0xxx_watchlistgroup_add_tenant_fk.py` | — | Auto-generated |
| Add FK to PriceAlertRule | `0xxx_pricealertrule_add_tenant_fk.py` | — | Auto-generated |
| Backfill Portfolio | `0xxx_portfolio_backfill_tenant_fk.py` | — | Data migration (manual) |
| Backfill WatchlistGroup | `0xxx_watchlistgroup_backfill_tenant_fk.py` | — | Data migration (manual) |
| Backfill PriceAlertRule | `0xxx_pricealertrule_backfill_tenant_fk.py` | — | Data migration (manual) |
| Test data isolation | `tests/test_data_isolation.py` | — | 4-6 test cases |

---

## Backfill Strategy & Safety

### Option A: Safe Backfill (Recommended)
1. Add FK as `null=True`
2. Run schema migrations
3. Run data migration to populate
4. Run tests to verify correctness
5. If all green, then alter FK to `null=False` in next migration

### Option B: Strict (if no orphaned data expected)
1. Add FK as `null=False, default=<func>`  — But Django doesn't support callable defaults in migrations
2. Alternative: Add `null=True`, backfill, then alter to `null=False`

**Recommendation**: Use Option A (Safe) with explicit `null=True` → backfill → final migration to `null=False` if desired.

---

## Validation Commands

```bash
# 1. Generate FK migrations (auto)
cd packages/core/backend
python manage.py makemigrations portfolio

# 2. Check migration validity
python manage.py makemigrations --dry-run portfolio
python manage.py check

# 3. Apply schema migrations (adds FK columns)
python manage.py migrate portfolio --plan
python manage.py migrate portfolio

# 4. Run data migrations (backfill)
python manage.py migrate portfolio

# 5. Run isolation tests
python manage.py test tests.test_data_isolation --keepdb --verbosity 2

# 6. Verify no orphaned data
python manage.py shell <<EOF
from portfolio.models import Portfolio, WatchlistGroup, PriceAlertRule
from django.db.models import Q

orphaned_portfolios = Portfolio.objects.filter(tenant__isnull=True)
orphaned_watchlists = WatchlistGroup.objects.filter(tenant__isnull=True)
orphaned_alerts = PriceAlertRule.objects.filter(tenant__isnull=True)

print(f"Orphaned Portfolios: {orphaned_portfolios.count()}")
print(f"Orphaned WatchlistGroups: {orphaned_watchlists.count()}")
print(f"Orphaned PriceAlertRules: {orphaned_alerts.count()}")
EOF

# 7. Verify module tree
python scripts/ops/generate_module_tree.py

# 8. Final system check
python manage.py check
```

---

## Expected Outcomes

### Before T10
- 3 models with implicit tenant scoping via user
- No direct tenant FK for efficient queries
- Potential data leakage if user isolation fails

### After T10
✅ Explicit tenant FK on Portfolio, WatchlistGroup, PriceAlertRule  
✅ Data backfill migration with orphan detection  
✅ 4-6 isolation tests verifying cross-tenant boundaries  
✅ Efficient queries: `Portfolio.objects.filter(tenant=tenant)`  
✅ Compliance ready: Can delete all tenant data with 3 FK delete cascades  

---

## Residual Risk & Mitigation

| Risk | Severity | Mitigation |
|------|----------|-----------|
| Orphaned data (user with no tenant) | MEDIUM | Data migration reports count; manual review needed |
| Query performance (N+1 with tenant filtering) | LOW | Adding FK doesn't hurt; future optimization with select_related |
| API endpoints not scoped by tenant | HIGH | Requires T10.5 (separate task) — add tenant check to views |
| Existing code not using tenant scoping | MEDIUM | Update views/serializers in T10.5 to use `queryset.filter(tenant=request.user.tenant)` |

---

## Files to Modify

| File | Type | Changes |
|------|------|---------|
| `backend/portfolio/models.py` | CODE | +3 FK fields (Portfolio, WatchlistGroup, PriceAlertRule) |
| `backend/portfolio/migrations/00xx_portfolio_add_tenant_fk.py` | MIGRATION | Auto-generated |
| `backend/portfolio/migrations/00xx_portfolio_backfill_tenant_fk.py` | DATA MIGRATION | Manual |
| `backend/portfolio/migrations/00xx_watchlistgroup_add_tenant_fk.py` | MIGRATION | Auto-generated |
| `backend/portfolio/migrations/00xx_watchlistgroup_backfill_tenant_fk.py` | DATA MIGRATION | Manual |
| `backend/portfolio/migrations/00xx_pricealertrule_add_tenant_fk.py` | MIGRATION | Auto-generated |
| `backend/portfolio/migrations/00xx_pricealertrule_backfill_tenant_fk.py` | DATA MIGRATION | Manual |
| `backend/tests/test_data_isolation.py` | TEST | New file; 4-6 test cases |
| `module_tree_full.md` | GENERATED | Regenerate after changes |

---

## DoD (Definition of Done)

- [ ] Portfolio, WatchlistGroup, PriceAlertRule models updated with tenant FK
- [ ] Schema migrations applied successfully (`manage.py migrate portfolio`)
- [ ] Data migration backfills all non-NULL values
- [ ] `python manage.py check` PASS (0 issues)
- [ ] `python manage.py test tests.test_data_isolation --keepdb` PASS (4-6/6 tests)
- [ ] Orphan data report reviewed (if any, document findings)
- [ ] module_tree_full.md regenerated
- [ ] Commit message: "TENANT-T10: Data isolation audit + FK migration (Portfolio, WatchlistGroup, PriceAlertRule)"
- [ ] Push to origin/dev
- [ ] docs/AUDIT_T10_DATA_ISOLATION_20260512.md created
- [ ] PROGRESS_DASHBOARD.md updated

---

## Timeline

| Phase | Duration | Notes |
|---|---|---|
| Model FK addition | 1 hour | Update 3 models with FK fields |
| Migration generation | 30 min | Auto-generate + validate |
| Data migration writing | 2 hours | Backfill logic, orphan handling |
| Testing | 2 hours | Isolation tests, query verification |
| Validation | 1 hour | Manual testing, docs |
| **Total** | **6.5 hours** | Conservative estimate |

---

## Next Steps

1. **Review & Confirm**: User reviews this plan and confirms scope (or requests adjustments)
2. **Execute**: Once approved, begin coding T10
3. **Test**: Run full test suite after migrations
4. **Commit**: Push to dev branch with full audit trail
5. **Handoff to T11**: After T10 complete, move to T11 (Audit Trail Completion)

---

**Status**: ⏳ AWAITING USER CONFIRMATION  
**Prepared by**: AI Session (T08-T09 completion)  
**Date**: 2026-05-12
