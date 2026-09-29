# RUN SPEC AUDIT — Stock Detail SaaS Native VNStockChart Redesign

**Ngày**: 2026-05-22  
**Mục đích**: Cross-check implementation với `SDR-REQ-01` → `SDR-REQ-30`.

**Legend**: `⏳` chưa verify | `✅` PASS | `❌` FAIL | `🔒` blocking gate

---

## 1. Audit questions bắt buộc

1. Đây có còn là chart-first workstation hay đã trượt thành dashboard nhiều card?
2. Selected session có còn là một nguồn truth duy nhất không?
3. `OrderFlowRadarPanel` có đang nằm đúng ngay dưới chart không?
4. Có bất kỳ direct fetch hoặc legacy client dependency nào trong canonical path không?
5. Nếu backend changed, thay đổi đó có đúng `packages/core/backend/` + `/core/v1/*` + OpenAPI gates không?

---

## 2. Blocking requirements

### `SDR-REQ-01` — Canonical route via `ShellStockDetailPage` 🔒

**Verify**: shell check + code review  
**Status**: ⏳

### `SDR-REQ-02` — Hero chart workspace is primary surface 🔒

**Verify**: 1440px screenshot  
**Status**: ⏳

### `SDR-REQ-03` — Chart shell follows VNStockChart reference topology 🔒

**Verify**: screenshot + component audit  
**Status**: ⏳

### `SDR-REQ-09` — `OrderFlowRadarPanel` directly under chart 🔒

**Verify**: desktop/laptop screenshot  
**Status**: ⏳

### `SDR-REQ-11` — Web calls go through `coreApiAdapter` 🔒

**Verify**: adapter grep + code review  
**Status**: ⏳

### `SDR-REQ-12` — No direct fetch / no canonical fallback to legacy client 🔒

```powershell
Select-String -Path "packages/web/src/**/*.js" -Pattern "fetch\(|frontend/src/api/client.js"
```

**Status**: ⏳

### `SDR-REQ-16` — Backend changes only in `packages/core/backend/` 🔒

**Verify**: diff review  
**Status**: ⏳

### `SDR-REQ-17` — OpenAPI metadata/tests required for backend change 🔒

**Verify**: docs + tests review  
**Status**: ⏳

### `SDR-REQ-18` — No new compat `/api/*` route 🔒

**Verify**: diff review  
**Status**: ⏳

### `SDR-REQ-20` — `check:stock-detail-shell` PASS 🔒

```powershell
Push-Location ./packages/web
npm run check:stock-detail-shell
Pop-Location
```

**Status**: ⏳

### `SDR-REQ-21` — Package/root build-test gates PASS 🔒

**Verify**: build/test outputs  
**Status**: ⏳

### `SDR-REQ-22` — Focused backend suites PASS if touched 🔒

**Verify**: manage.py test output  
**Status**: ⏳

### `SDR-REQ-23` — Runtime refresh + browser smoke PASS 🔒

```powershell
.\start_dev.ps1
```

**Status**: ⏳

### `SDR-REQ-30` — Final sign-off blocked on any hierarchy or architecture drift 🔒

**Verify**: combined review + evidence review  
**Status**: ⏳

---

## 3. Non-blocking requirements status matrix

| Requirement | Expected | Verify | Status |
|---|---|---|---|
| `SDR-REQ-04` | `selectedSession` is page-root SSOT | state audit + smoke | ⏳ |
| `SDR-REQ-05` | `CVD` separate pane | chart screenshot | ⏳ |
| `SDR-REQ-06` | `Strength` separate pane | chart screenshot | ⏳ |
| `SDR-REQ-07` | shark markers viewport-top-10% only | zoom/pan smoke | ⏳ |
| `SDR-REQ-08` | heatmap uses time-bucket semantics only | code/payload review | ⏳ |
| `SDR-REQ-10` | context modules do not compete with chart | 1366px screenshot | ⏳ |
| `SDR-REQ-13` | no end-state logic in legacy root apps | diff review | ⏳ |
| `SDR-REQ-14` | news/financials degrade honestly | UI audit | ⏳ |
| `SDR-REQ-15` | adapter wrappers complete | adapter code review | ⏳ |
| `SDR-REQ-19` | UI text uses Vietnamese i18n | copy review | ⏳ |
| `SDR-REQ-24` | ledger/progress updated | file diff | ⏳ |
| `SDR-REQ-25` | module tree regenerated | file diff | ⏳ |
| `SDR-REQ-26` | shell/host architecture does not drift | architecture review | ⏳ |
| `SDR-REQ-27` | session sync reaches order flow/advisory/alerts | browser smoke | ⏳ |
| `SDR-REQ-28` | module state matrix complete | UI audit | ⏳ |
| `SDR-REQ-29` | no fake news/financials/business truth in client | UI + adapter audit | ⏳ |

---

## 4. Output format for auditor

Auditor phải trả kết quả theo format sau:

```text
Audit Result: PASS / FAIL

Blocking findings:
1. ...

Non-blocking findings:
1. ...

Evidence reviewed:
1. screenshots
2. validation command outputs
3. governance diffs

Residual risk:
1. ...
```

Nếu có bất kỳ `🔒` requirement nào FAIL, whole workstream FAIL.
