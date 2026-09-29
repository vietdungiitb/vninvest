# Run Code Review — Project Hardening Backend
**Ngày**: 2026-05-28

---

## 1. Read-first docs

1. `quality/QUALITY.md`
2. `docs/detailed_designs/PROJECT_HARDENING_ACTION_PLAN_20260528.md`
3. `docs/detailed_designs/PROJECT_HARDENING_BACKEND_HANDOFF_MASTER_20260528.md`
4. `docs/detailed_designs/TECH_SPEC_PROJECT_HARDENING_BACKEND_20260528.md`
5. `docs/detailed_designs/PROJECT_HARDENING_BACKEND_TRACEABILITY_MATRIX_20260528.md`

---

## 2. Review focus

1. Scope có còn bám roadmap SSOT không.
2. Có bất kỳ dấu hiệu `system_tenant` fallback hoặc default tenant assignment không.
3. Migration plan có đủ quarantine safety không.
4. App throttling có bị regress không.
5. Gateway throttling có được thêm thật không.
6. Web packaging lane có đúng `build-community` không.
7. Phase 2 có mô tả sai foundation hiện có không.

---

## 3. Suggested review commands

```powershell
rg -n "system_tenant|default_tenant|tenant_id.*=.*None" packages/core/backend/src
rg -n "limit_req|limit_req_zone" frontend/docker/nginx.conf packages/opencore/distribution/nginx-opencore.conf
rg -n "build-community" packages/web/package.json packages/web/scripts/build-community.mjs
rg -n "Subscription|QuotaRecord|Invoice" packages/core/backend/src/commercial
rg -n "except: pass|except Exception: pass" packages/core/backend/src packages/web/src
git diff --check
```

---

## 4. Reject conditions

Block merge nếu gặp một trong các lỗi sau:

1. Có bất kỳ logic auto-assign tenant mặc định cho orphan data.
2. QG-1 vẫn ghi command backend mà không có bootstrap prerequisites đi kèm.
3. Web gate bị đổi thành `npm run build` hoặc tương đương.
4. Nginx throttle config mới không có evidence review.
5. Phase 2 docs/code rewrite sai domain `commercial` foundation.
