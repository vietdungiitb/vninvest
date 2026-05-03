# SAAS-12 — Shared Contract Lock & Mobile API Migration

**Ngày:** 2026-05-03  
**Trạng thái:** Ready to execute — phụ thuộc SAAS-11 ✅  
**Mục tiêu:** Lock toàn bộ data-plane contracts vào `shared/api-contracts/`; migrate tất cả mobile services khỏi legacy paths; tạo contract validator.

---

## 1. Bối cảnh và lý do

Sau SAAS-11, packages/mobile có đủ screens nhưng các service file vẫn gọi legacy paths:
- `portfolioApi.ts` → `/portfolio/`
- `watchlistApi.ts` → `/stock-management/`, `/whale-analytics/`
- `authApi.ts` → `/api/auth/`

Không có contract JSON nào define shape của `symbol_snapshot`, `session_facts`, `unified_alert` trong `shared/api-contracts/`. Điều này có nghĩa là:
1. Mỗi client (web, mobile, vip-app) tự interpret API response theo cách riêng
2. Khi legacy backend đổi, không có contract test nào bắt được regression
3. Không có single source of truth cho data shapes

**SAAS-12 giải quyết vấn đề này** bằng cách lock contracts trước, sau đó migrate clients.

---

## 2. Scope

### 2.1 Contracts cần tạo trong `shared/api-contracts/`

| File | Mô tả | Ưu tiên |
|---|---|---|
| `symbol-snapshot.contract.json` | Shape của stock symbol snapshot (giá, volume, session metadata) | P0 |
| `session-facts.contract.json` | Shape của session-level aggregate facts (CVD, whale summary, flow direction) | P0 |
| `unified-alert.contract.json` | Shape của unified alert item (whale, dark flow, signal) | P0 |
| `whale-feed-aggregate.contract.json` | Shape của whale feed aggregate response cho một symbol | P0 |
| `tenant-lifecycle.contract.json` | Shape của tenant lifecycle projection (status, plan, quota, features) | P1 |
| `partner-pat.contract.json` | Shape của partner PAT credential (issue/rotate/revoke response) | P1 |

### 2.2 Mobile services cần migrate

| File | Legacy path | Core path mới |
|---|---|---|
| `packages/mobile/src/services/portfolioApi.ts` | `/portfolio/portfolio-summary/` | `/core/v1/portfolio/summary/` |
| `packages/mobile/src/services/portfolioApi.ts` | `/portfolio/positions/` | `/core/v1/portfolio/positions/` |
| `packages/mobile/src/services/watchlistApi.ts` | `/stock-management/tracking-groups/` | `/core/v1/watchlist/groups/` |
| `packages/mobile/src/services/watchlistApi.ts` | `/whale-analytics/whale-feed/` | `/core/v1/whale-feed/` |
| `packages/mobile/src/services/watchlistApi.ts` | `/whale-analytics/whale-feed-aggregate/` | `/core/v1/whale-feed-aggregate/` |
| `packages/mobile/src/services/transactionApi.ts` | `/portfolio/transactions/` | `/core/v1/transactions/` |
| `packages/mobile/src/services/authApi.ts` | `/api/auth/login/` | `/core/v1/auth/login/` |
| `packages/mobile/src/services/authApi.ts` | `/api/auth/logout/` | `/core/v1/auth/logout/` |
| `packages/mobile/src/services/authApi.ts` | `/api/auth/profile/` | `/core/v1/auth/profile/` |

### 2.3 Contract validator script

Tạo `shared/scripts/validate-contracts.mjs` — kiểm tra tất cả contract files:
- Valid JSON
- Có `version`, `contract_name`, `schema` fields bắt buộc
- Schema hợp lệ JSON Schema (draft-07)
- Không có `$ref` internal nào bị broken

---

## 3. Định nghĩa contract format

Tất cả contracts phải theo format chuẩn:

```json
{
  "contract_name": "symbol-snapshot",
  "version": "1.0.0",
  "description": "Mô tả ngắn gọn",
  "last_updated": "2026-05-03",
  "schema": {
    "$schema": "http://json-schema.org/draft-07/schema#",
    "type": "object",
    "required": ["symbol", "price", "session_date", "fetched_at"],
    "properties": {
      ...
    }
  },
  "example": {
    ...
  },
  "changelog": [
    { "version": "1.0.0", "date": "2026-05-03", "changes": "Initial contract" }
  ]
}
```

---

## 4. Chi tiết từng contract

### 4.1 `symbol-snapshot.contract.json`

Schema tối thiểu:
```json
{
  "symbol": "string — mã cổ phiếu (VD: FPT)",
  "price": "number — giá hiện tại (VND)",
  "price_change": "number — thay đổi giá so với phiên trước",
  "price_change_pct": "number — % thay đổi",
  "volume": "integer — khối lượng giao dịch",
  "session_date": "string — ISO date của phiên (YYYY-MM-DD)",
  "market_status": "enum: open | closed | pre-open | halted",
  "fetched_at": "string — ISO 8601 timestamp",
  "stale": "boolean — true nếu data cũ hơn freshness threshold",
  "source": "string — nguồn data (core | cache | degraded)"
}
```

### 4.2 `session-facts.contract.json`

Schema tối thiểu:
```json
{
  "symbol": "string",
  "session_date": "string — ISO date",
  "cvd_normalized": "number — Cumulative Volume Delta đã normalize",
  "buy_strength": "number — 0.0 đến 1.0",
  "institutional_strength": "number — 0.0 đến 1.0",
  "whale_net_flow": "number — VND — dương là mua ròng",
  "dark_flow_score": "number — 0.0 đến 1.0",
  "total_buy_volume": "integer",
  "total_sell_volume": "integer",
  "computed_at": "string — ISO 8601",
  "stale": "boolean",
  "source": "string"
}
```

### 4.3 `unified-alert.contract.json`

Schema tối thiểu:
```json
{
  "alert_id": "string — UUID",
  "alert_type": "enum: whale | dark_flow | signal | system",
  "symbol": "string",
  "severity": "enum: critical | high | medium | low",
  "title": "string — tiêu đề alert",
  "body": "string — mô tả chi tiết",
  "value": "number | null — giá trị liên quan (VD: khối lượng VND)",
  "direction": "enum: buy | sell | neutral | null",
  "session_date": "string — ISO date",
  "triggered_at": "string — ISO 8601",
  "source_ref": "string | null — ID record nguồn"
}
```

### 4.4 `whale-feed-aggregate.contract.json`

Schema tối thiểu:
```json
{
  "symbol": "string",
  "session_date": "string",
  "total_whale_buy_vnd": "number",
  "total_whale_sell_vnd": "number",
  "net_whale_flow_vnd": "number",
  "whale_order_count": "integer",
  "top_orders": "array of whale order objects",
  "aggregated_at": "string — ISO 8601",
  "stale": "boolean"
}
```

### 4.5 `tenant-lifecycle.contract.json`

Schema tối thiểu:
```json
{
  "tenant_id": "string — UUID",
  "status": "enum: active | trial | suspended | deprovisioned",
  "plan": "string — VD: free | starter | pro | enterprise",
  "quota_used": "object — { api_calls: integer, symbols: integer, users: integer }",
  "quota_limit": "object — cùng shape với quota_used",
  "features": "array of string — feature flags",
  "trial_ends_at": "string | null — ISO 8601",
  "activated_at": "string | null",
  "last_updated": "string — ISO 8601"
}
```

### 4.6 `partner-pat.contract.json`

Schema tối thiểu:
```json
{
  "pat_id": "string — UUID",
  "service_account_id": "string — UUID",
  "tenant_id": "string — UUID",
  "token_prefix": "string — 8 chars hiển thị cho audit (không có full token)",
  "scopes": "array of string",
  "expires_at": "string — ISO 8601",
  "created_at": "string — ISO 8601",
  "last_used_at": "string | null",
  "revoked": "boolean",
  "audit_reason": "string | null"
}
```

---

## 5. File anchors

### Contracts (tạo mới)
- `shared/api-contracts/symbol-snapshot.contract.json`
- `shared/api-contracts/session-facts.contract.json`
- `shared/api-contracts/unified-alert.contract.json`
- `shared/api-contracts/whale-feed-aggregate.contract.json`
- `shared/api-contracts/tenant-lifecycle.contract.json`
- `shared/api-contracts/partner-pat.contract.json`

### Scripts (tạo mới)
- `shared/scripts/validate-contracts.mjs`

### Mobile services (sửa)
- `packages/mobile/src/services/portfolioApi.ts`
- `packages/mobile/src/services/watchlistApi.ts`
- `packages/mobile/src/services/transactionApi.ts`
- `packages/mobile/src/services/authApi.ts`

### Config (sửa)
- `packages/mobile/src/runtimeConfig.js` — thêm `CORE_API_BASE_URL` mapping

---

## 6. Migration strategy cho mobile services

### 6.1 Thêm `CORE_API_BASE_URL` vào runtimeConfig

```javascript
// packages/mobile/src/runtimeConfig.js — thêm field:
coreApiBaseUrl: process.env.CORE_API_BASE_URL || process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8100',
```

### 6.2 Tạo core API client helper

Tạo `packages/mobile/src/services/coreHttp.ts`:
- Dùng `coreApiBaseUrl` từ runtimeConfig
- Inject `Authorization: Bearer {token}` header
- Inject `X-Request-ID` header tự sinh UUID v4
- Handle 401 → trigger logout

### 6.3 Từng service file migrate từng endpoint

Mỗi service file migrate từng function một:
- Không xóa legacy fallback ngay — comment out và giữ trong 1 slice
- Tạo type alias từ contract JSON schema
- Test với `typecheck` sau mỗi file

---

## 7. Exit criteria

| # | Tiêu chí | Kiểm tra bằng |
|---|---|---|
| 1 | 6 contract files tồn tại trong `shared/api-contracts/` | `ls shared/api-contracts/` |
| 2 | Tất cả contracts valid JSON | `validate-contracts.mjs` |
| 3 | Tất cả contracts có version field | `validate-contracts.mjs` |
| 4 | Mobile services không còn hardcode legacy paths | `grep -r "/portfolio/" packages/mobile/src/services/` → no match |
| 5 | Mobile TypeScript typecheck green | `tsc --noEmit` trong packages/mobile |
| 6 | `coreHttp.ts` inject X-Request-ID | code review |
| 7 | README trong `shared/api-contracts/` cập nhật | file check |

---

## 8. Validation commands

```powershell
# Validate tất cả contracts
node shared/scripts/validate-contracts.mjs

# Kiểm tra không còn legacy paths trong mobile services
Select-String -Path "packages/mobile/src/services/*.ts" -Pattern "/portfolio/|/stock-management/|/whale-analytics/|/api/auth/"

# Typecheck mobile package
Push-Location packages/mobile
npx tsc --noEmit
Pop-Location
```

---

## 9. Evidence template

Sau khi SAAS-12 hoàn thành, tạo file:
`docs/ENTERPRISE_B2B_MCP_TRANSFORMATION_SAAS_CUTOVER_EXECUTION_EVIDENCE_20260503_SAAS12.md`

Với nội dung:
1. Danh sách contract files đã tạo (có checksum hoặc line count)
2. Output của `validate-contracts.mjs`
3. Output của `Select-String` grep không tìm thấy legacy paths
4. TypeScript typecheck output
5. Residual risk: packages/web chưa migrate (sẽ làm ở SAAS-14)
