# RUN CODE REVIEW — SOC Config UI Upgrade & Admin-Ops Decommission

**Ngày**: 2026-05-16  
**Scope**: Code review checklist per slice — chạy trước khi merge mỗi slice.

---

## Nguyên tắc review

1. Reviewer phải tự chạy từng check — không chỉ đọc diff.
2. Mỗi ✗ FAIL là **blocking** — không merge cho đến khi sửa.
3. Performance và security checks là blocking nếu pattern forbidden xuất hiện.

---

## S5-BE: Screener Rule Backend

```powershell
# Chạy unit tests
Push-Location ./backend
../.venv/Scripts/python.exe manage.py test service_ops.tests.test_screener_rule_crud --keepdb -v 2
Pop-Location
```

| Check | Expected | Verified |
|-------|----------|---------|
| `ScreenerRuleUpdateView` có `@extend_schema` | ✓ | |
| `ScreenerRuleDeleteView` có `@extend_schema` | ✓ | |
| PUT view trả 200 khi rule tồn tại | ✓ | |
| PUT view trả 404 khi rule không tồn tại | ✓ | |
| DELETE view trả 204 khi rule tồn tại | ✓ | |
| DELETE view trả 404 khi rule không tồn tại | ✓ | |
| Cả 2 views có `SOCDomainPermission` hoặc `SOCRulePermission` | ✓ | |
| Unit tests có: create, update, delete, 404 case | ✓ | |
| Không có `except: pass` | ✓ | |
| URL patterns không conflict với existing routes | ✓ | |

---

## S1: PrefetchPanel

```powershell
Push-Location ./frontend; npm run build; Pop-Location
```

| Check | Expected | Verified |
|-------|----------|---------|
| Không còn `JSON.stringify` render trong JSX | ✓ | |
| 11 number inputs hiển thị đúng field names | ✓ | |
| Save action mở `ConfigPreviewModal` trước | ✓ | |
| Warm Now gọi đúng endpoint (`/prefetch/warm-now/`) | ✓ | |
| Mọi text đều qua `t()` — không hardcode tiếng Việt | ✓ | |
| `can_apply` guard: khi false → `WriteGuardBanner` hiện | ✓ | |
| `vi.js` có đủ keys mới | ✓ | |
| Build exit 0 | ✓ | |

---

## S3: DataOps Backfill

```powershell
Push-Location ./frontend; npm run build; Pop-Location
```

| Check | Expected | Verified |
|-------|----------|---------|
| Dataset checkboxes render với labels tiếng Việt qua i18n | ✓ | |
| Dry-run payload: có `datasets`, `mode`, `symbols` | ✓ | |
| Intraday Tick gọi đúng backfill apply endpoint | ✓ | |
| Loading state hiển thị trong khi dispatch async | ✓ | |
| Error state hiển thị nếu dispatch fail | ✓ | |
| Không có direct fetch — qua `socApi` hoặc `client.js` adapter | ✓ | |
| Build exit 0 | ✓ | |

---

## S5-FE: ScreenerPanel CRUD

```powershell
Push-Location ./frontend; npm run build; Pop-Location

# Grep: không còn rule_ids trong manualScan
Select-String -Path "frontend/src/api/socApi.js" -Pattern "rule_ids"
# Expected: 0 results
```

| Check | Expected | Verified |
|-------|----------|---------|
| `manualScan()` gửi `{symbols: [...]}` KHÔNG phải `{rule_ids}` | ✓ | |
| `createScreenerRule`, `updateScreenerRule`, `deleteScreenerRule` tồn tại | ✓ | |
| Rule create form có: name, type select (9 types), conditions JSON, enabled toggle | ✓ | |
| Conditions JSON: có client-side parse validation trước submit | ✓ | |
| Rule edit: PUT `/api/soc/screener/rules/<id>/` | ✓ | |
| Rule delete: DELETE `.../delete/` + confirm dialog | ✓ | |
| Pagination hoạt động — không fetch all + slice client-side | ✓ | |
| Config save: qua `ConfigPreviewModal` | ✓ | |
| Alert history: read-only, không có write buttons | ✓ | |
| `WriteGuardBanner` khi `can_apply === false` | ✓ | |
| Không có `JSON.stringify` raw render | ✓ | |
| Mọi text qua `t()` | ✓ | |
| Build exit 0 | ✓ | |

---

## S2: VnbrokerPanel

```powershell
Push-Location ./frontend; npm run build; Pop-Location
```

| Check | Expected | Verified |
|-------|----------|---------|
| Structured form thay vì raw JSON textarea | ✓ | |
| DNSE credential: chỉ hiển thị boolean status, không có input | ✓ | |
| Benchmark button hiển thị loading state | ✓ | |
| Reset về mặc định: confirm dialog bắt buộc | ✓ | |
| Save qua `ConfigPreviewModal` | ✓ | |
| Mọi text qua `t()` | ✓ | |
| Build exit 0 | ✓ | |

---

## S4: SOCPage Tabs

```powershell
Push-Location ./frontend; npm run build; Pop-Location
```

| Check | Expected | Verified |
|-------|----------|---------|
| `VALID_DOMAINS` hoặc tab config có `vnbroker` | ✓ | |
| `VALID_DOMAINS` hoặc tab config có `runtime-kpi` | ✓ | |
| `?tab=vnbroker` render VnbrokerPanel | ✓ | |
| `?tab=runtime-kpi` render RuntimeKPIPanel | ✓ | |
| 6 tabs cũ không bị regression | ✓ | |
| Tab labels tiếng Việt qua i18n | ✓ | |
| Build exit 0 | ✓ | |

---

## D2: Backend Decommission

```powershell
# Kiểm tra không còn business logic trong admin-ops routes
Select-String -Path "backend/config/urls.py" -Pattern "admin.ops" | Measure-Object
# Expected: chỉ còn admin_ops_gone handler, không có import views khác
```

| Check | Expected | Verified |
|-------|----------|---------|
| 410 handler trả `{"error": "gone", "migrate_to": "..."}` | ✓ | |
| HTTP status là 410 (không phải 404 hay 301) | ✓ | |
| `migrate_to` field có path SOC hợp lệ | ✓ | |
| Không còn import legacy admin-ops views | ✓ | |
| SOC endpoints `/api/soc/*` vẫn return 200 | ✓ | |
| Stack healthy sau deploy | ✓ | |

---

## D3: Frontend Cleanup

```powershell
# Grep check
Select-String -Path "frontend/src/api/client.js" -Pattern "admin-ops" | Measure-Object
# Expected: 0 results

Select-String -Path "frontend/src/App.jsx" -Pattern "admin-ops|AdminOps" | Measure-Object
# Expected: 0 results

# Build
Push-Location ./frontend; npm run build; Pop-Location
```

| Check | Expected | Verified |
|-------|----------|---------|
| 0 references `admin-ops` trong `client.js` | ✓ | |
| 0 references `admin-ops` hoặc `AdminOps` trong `App.jsx` | ✓ | |
| Không còn import `AdminOpsPage` | ✓ | |
| `./start_dev.ps1` stack healthy | ✓ | |
| Build exit 0 | ✓ | |
| UI navigation không còn admin-ops link | ✓ | |
