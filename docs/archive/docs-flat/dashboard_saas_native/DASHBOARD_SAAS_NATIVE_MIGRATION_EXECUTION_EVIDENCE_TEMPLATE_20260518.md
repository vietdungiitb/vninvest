# EXECUTION EVIDENCE TEMPLATE — Dashboard SaaS Native Migration

**Ngày**: 2026-05-18  
**Hướng dẫn**: Copy template này cho mỗi slice và điền đầy đủ trước khi đánh dấu DONE.

---

## Template — [SLICE-ID] [Slice Name]

**Ngày thực hiện**: YYYY-MM-DD  
**Developer**: [Tên]  
**Reviewer**: [Tên]

---

### A. Danh sách files thay đổi

| File | Action (Modified/Created/Deleted) | Dòng thay đổi |
|------|-----------------------------------|---------------|
| `path/to/file.js` | Modified | +15 / -3 |

---

### B. Commands validation

```powershell
# [Command đã chạy]
[Output thực tế]
```

**Kết quả**: ✅ PASS / ❌ FAIL  
*(Nếu FAIL: ghi lý do và remediation)*

---

### C. Screenshots / UI verification

*(Chèn screenshot hoặc ghi "N/A — không có UI change")*

---

### D. API payload snapshots

*(Chèn curl output hoặc network tab snapshot nếu có contract change)*

---

### E. Residual risks

*(Liệt kê bất kỳ rủi ro còn lại sau slice — "none" nếu không có)*

---

---

## DM-00 Evidence

**Ngày thực hiện**: ___________  
**Developer**: ___________  
**Reviewer**: ___________

### A. Files thay đổi

| File | Action | Dòng |
|------|--------|------|
| `frontend/src/hooks/useAlertCenterFeed.js` | Modified | |
| `frontend/src/components/UnifiedAlertCenter.jsx` | Modified | |
| `frontend/src/api/client.js` | Modified | |
| `frontend/src/components/modern/SmartStatsHeader.jsx` | Modified | |
| `frontend/src/i18n/vi.js` | Modified | |

### B. Validation output

```powershell
# Return keys check
Select-String "useAlertCenterFeed.js" -Pattern "currentUnifiedPage|hasPreviousUnifiedPage|hasLastUnifiedPage"
# [PASTE OUTPUT]

# Audience filter check
Select-String "UnifiedAlertCenter.jsx" -Pattern "holdings_only|watchlist_only"
# [PASTE OUTPUT]

# Build
npm run build
# [PASTE LAST 5 LINES]
```

### C. Screenshots
_N/A — backend-only / logic fix_

### D. API payload
_N/A_

### E. Residual risks
_

---

## DM-01 Evidence

**Ngày thực hiện**: ___________  
**Developer**: ___________  
**Reviewer**: ___________

### A. Files thay đổi

| File | Action | Dòng |
|------|--------|------|
| `packages/web/src/adapters/coreApiAdapter.js` | Modified | |
| `packages/web/src/adapters/coreApiAdapter.test.js` | Modified/Created | |

### B. Validation output

```powershell
# 7 methods check
foreach ($m in @("getPortfolioHoldings","getPortfolioSummary","getPortfolioAnalytics","getPortfolioTechnicals","getBulkTechnicalsBySymbols","getTrackedSymbols","getLegacyWatchlistGroups")) {
  $hit = Select-String "packages/web/src/adapters/coreApiAdapter.js" -Pattern $m
  Write-Host "$(if ($hit) { '[PASS]' } else { '[FAIL]' }) $m"
}
# [PASTE OUTPUT]

# Test results
npx jest coreApiAdapter.test.js
# [PASTE OUTPUT]
```

### C. Screenshots
_N/A_

### D. API payload — Live API test

```bash
# Holdings endpoint verification
curl -H "Authorization: Bearer $TOKEN" http://localhost/core/v1/portfolio/portfolios/1/holdings/
# [PASTE RESPONSE]

# Bulk technicals endpoint verification
curl "http://localhost/api/stock-management/technicals/bulk/?symbols=VCB,HPG" -H "Authorization: Bearer $TOKEN"
# [PASTE RESPONSE]
```

### E. Residual risks
_

---

## DM-02 Evidence

**Ngày thực hiện**: ___________  
**Developer**: ___________  
**Reviewer**: ___________

### A. Files thay đổi

| File | Action | Dòng |
|------|--------|------|
| `packages/web/src/features/dashboard/useCoreDashboardData.js` | Created | |

### B. Validation output

```powershell
# File exists
Test-Path "packages/web/src/features/dashboard/useCoreDashboardData.js"
# [PASTE OUTPUT]

# AbortController check
Select-String "useCoreDashboardData.js" -Pattern "AbortController"
# [PASTE OUTPUT]

# No apiClient
Select-String "useCoreDashboardData.js" -Pattern "apiClient"
# [PASTE OUTPUT — Should be empty]
```

### C. Screenshots
_N/A_

### D. API payload
_N/A_

### E. Residual risks
_

---

## DM-03 Evidence

**Ngày thực hiện**: ___________  
**Developer**: ___________  
**Reviewer**: ___________

### A. Files thay đổi

| File | Action | Dòng |
|------|--------|------|
| `packages/web/src/pages/DashboardPage.js` | Modified | |

### B. Validation output

```powershell
# No JSX check
Select-String "DashboardPage.js" -Pattern "<[A-Z][a-zA-Z]|<div |<span "
# [PASTE OUTPUT — Should be empty]

# Slot props check
Select-String "DashboardPage.js" -Pattern "renderStatsHeader|renderPositionDeck|renderAlertCenter|renderHeatmap|renderBubble"
# [PASTE OUTPUT]

# Build
Push-Location ./frontend; npm run build; Pop-Location
# [PASTE LAST 5 LINES]
```

### C. Screenshots
_[Screenshot sau khi smoke test với fallback UI]_

### D. API payload
_N/A_

### E. Residual risks
_

---

## DM-04 Evidence

**Ngày thực hiện**: ___________  
**Developer**: ___________  
**Reviewer**: ___________

### A. Files thay đổi

| File | Action | Dòng |
|------|--------|------|
| `frontend/src/pages/PackageDashboardHost.jsx` | Created | |

### B. Validation output

```powershell
# Import check
Select-String "PackageDashboardHost.jsx" -Pattern "@vninvest/web"
# [PASTE OUTPUT]

# Slots check
Select-String "PackageDashboardHost.jsx" -Pattern "renderStatsHeader|renderPositionDeck|renderAlertCenter|renderHeatmap"
# [PASTE OUTPUT]

# Build
Push-Location ./frontend; npm run build; Pop-Location
# [PASTE LAST 5 LINES]
```

### C. Screenshots
_N/A (test UI trong DM-05 smoke)_

### D. API payload
_N/A_

### E. Residual risks
_

---

## DM-05 Evidence

**Ngày thực hiện**: ___________  
**Developer**: ___________  
**Reviewer**: ___________

### A. Files thay đổi

| File | Action | Dòng |
|------|--------|------|
| `frontend/src/App.jsx` | Modified | |

### B. Validation output

```powershell
# Route check
Select-String "frontend/src/App.jsx" -Pattern "PackageDashboardHost|dashboard/legacy"
# [PASTE OUTPUT]

# Stack restart
.\start_dev.ps1
# [PASTE LAST 10 LINES]
```

### C. Screenshots

**Screenshot 1**: `/dashboard` route loading PackageDashboardHost  
_[Chèn screenshot]_

**Screenshot 2**: `/dashboard/legacy` route loading ModernDashboard  
_[Chèn screenshot]_

**Screenshot 3**: Browser console — 0 errors  
_[Chèn screenshot]_

### D. API payload

Network tab: Các `/core/v1/portfolio/...` calls thành công (200 status)  
_[Chèn screenshot]_

### E. Residual risks
_

---

## DM-06 Evidence (3-Day Parity Report)

> Lưu ý: File này chỉ là template. Actual parity data phải nằm trong `docs/DASHBOARD_MIGRATION_PARITY_REPORT.md`.

| Day | Date | Market Value Match | Holdings Count Match | Status |
|-----|------|--------------------|---------------------|--------|
| 1 | | | | |
| 2 | | | | |
| 3 | | | | |

**Tech Lead Sign-off**: _____________ Date: _____________

---

## DM-07 Evidence

**Ngày thực hiện**: ___________  
**Developer**: ___________  
**Reviewer (Tech Lead required)**: ___________

### A. Pre-condition gates

| Gate | Check | Status |
|------|-------|--------|
| A | DM-06 parity report tồn tại | |
| B | 6 metrics PASS 3 ngày liên tiếp | |
| C | Tech Lead sign-off | |
| D | 1-day advance notice đã được gửi | |
| E | Clean build trước khi xóa | |
| F | Không có P0/P1 bugs open | |
| G | module_tree_full.md sẽ regenerate | |

### B. Deletion evidence

```powershell
# File delete
Remove-Item "frontend/src/pages/modern/ModernDashboard.jsx"
Write-Host "Deleted."

# No remaining references
Select-String -Path "frontend/src" -Pattern "ModernDashboard" -Recurse
# [PASTE OUTPUT — Should be empty]

# Final build
Push-Location ./frontend; npm run build; Pop-Location
# [PASTE LAST 5 LINES]
```

### C. Governance updates
- [ ] `docs/CODE_CHANGE_AUDIT_LEDGER.md` updated
- [ ] `PROGRESS_DASHBOARD.md` updated
- [ ] `module_tree_full.md` regenerated

### D. Screenshots
_[Screenshot của final /dashboard route sau decommission]_

### E. Residual risks
_None expected_
