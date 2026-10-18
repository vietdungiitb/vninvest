# AI R5.1 — Phương án B: gỡ `AgentRegistry` + tab Agents

**Claim**: `ai-r51` · **Nhánh**: `feat/ai-r51-remove-agent-registry` → `dev` · **Ngày**: 2026-10-18
**Quyết định**: phương án **B** (gỡ) — Owner duyệt 2026-10-18 sau khi đo.
**Plan**: `docs/IMPLEMENTATION_PLAN_AI_COMMAND_CENTER_COMMERCIAL_20260925.md:1256-1272`

## Kết quả AC

| # | Điều kiện | Bằng chứng | AC |
|---|---|---|---|
| AC1 | grep `AgentRegistry` chỉ còn migration lịch sử | Chỉ còn `ai_agents/migrations/0001_initial.py` | ✅ |
| AC2 | Route `/settings/ai/agents` → 404 | Đã bỏ `include` ở `vninvest_core/urls.py:71` + bỏ route ở `main.tsx` — **đã đo HTTP thật trên staging**, xem §Staging | ✅ |
| AC3 | Menu bỏ tab | `AiHubNav.tsx` không còn entry Agents | ✅ |
| AC4 | Tab count 6 → 5 | `ai-audit-tab.component.test.tsx` cập nhật: staff **5** tab, member **4** tab (không có Audit) | ✅ |
| AC5 | `check-ai-cc` xanh | `check:ai-cc-dag` PASS (46 nodes/61 edges/0 cycle) | ✅ |
| AC6 | `AICommandCenterForm` giữ nguyên | Không nằm trong diff | ✅ |

## Bằng chứng quyết định (đo trước, không phải suy luận)

- `AgentRegistry` **chưa từng được đọc**: grep backend chỉ khớp trong chính app `ai_agents`
  + 2 file nhãn hiển thị Django admin. Không orchestrator / advisory / task nào đọc.
- `AGENT_TYPES` — thứ plan ghi *"liệt kê 6 loại"* — **không tồn tại** trong backend
  ⇒ claim của plan đã lỗi thời.
- **Không có wave R6**; R5.3–R5.5 không dùng `AgentRegistry` (R5.3 là sub-agent prompt
  trong `SystemAISettings.metadata`) ⇒ tiêu chí "2 wave tới không dùng agent" chọn **B**.

## Dữ liệu thật — đã **cứu trước khi drop**

Đo trên staging cho thấy bảng **không rỗng**: 1 dòng seed `Phân tích ngành`
(`agent_type=advisory`, `provider=gemini`, `model=gemini-3.8-flash`). Dòng này **không**
do migration sinh ⇒ đã ghi toàn bộ vào
**`docs/evidence/ai-cc/r51-agent-registry-rows.md`** trước khi drop. Nếu sau này chọn
phương án A, chỉ cần `INSERT` lại từ bảng đó.

## Cách gỡ mà không phá lịch sử

- Xoá **code** (`models/views/serializers/urls/admin/tests`) + bỏ `include` URL +
  2 dòng nhãn admin UI.
- **Giữ** `migrations/0001`, `0002` và app trong `INSTALLED_APPS`/`db_router` — cần để
  migration `0003_delete_agentregistry` (sinh bởi Django, **không** tự đặt số) chạy
  được và drop bảng. Xoá hẳn app thì bảng **mồ côi** vĩnh viễn.

## Gates

| Gate | Kết quả |
|---|---|
| FE hồi quy `pages/__tests__` + `components/__tests__` | 59 file · **379/379 OK** — ⚠ **KHÔNG phải 376**: 376 là con số của lần chạy *xanh giả* khi 3 test còn bị script nuốt; khôi phục xong mới đúng 379 |
| FE `ai-audit-tab` + `ai-hub-breadcrumb` | 17/17 OK (cập nhật theo 5 tab / 4 trang) |
| `tsc --noEmit` | exit 0 |
| `npm run build` | exit 0 (`built in 1m 13s`) |
| BE hồi quy 46 module AI + advisory | **584 test — 583 OK** |

Lỗi còn lại: `test_dead_models_absent_from_frontend_catalogue` — cây test BE chỉ mount
`packages/core/backend` ⇒ môi trường, đã tái hiện ở mọi wave trước.

## Năm lỗi tôi mắc khi sửa (đều đã sửa, đều ghi lại)

1. **Nghiêm trọng nhất — xoá nhầm 3 test không liên quan.** Script "xoá khối test Agents" của tôi
   nuốt luôn `AIUsageAnalyticsPage`, `AdminUsersPage` và `AdminUsersPanel` (mất cả fix race
   W3-4 kèm comment dài 15 dòng). **Suite vẫn báo `376/376 OK`** — không phải vì code đúng mà
   vì test **không còn tồn tại**. Xanh giả. Đã `git checkout HEAD --` rồi xoá **đúng** import +
   test Agents (-8 dòng), xác nhận 3 test còn lại hiện diện và chạy pass.
   *Bài học: xoá bằng script phải đếm dòng trước/sau và liệt kê tên test bị xoá. Xanh khi
   số test **giảm** là tín hiệu đỏ, không phải tín hiệu tốt.*
2. Script xoá dòng của tôi **để lại `},` treo** trong `ai-hub-nav-r18.component.test.tsx`
   ⇒ `PARSE_ERROR`. Xoá dòng trong JS cần hiểu cấu trúc khối, không phải lọc chuỗi.
3. `pageRegistry.js` entry `ai-agent-federation` viết trên **2 dòng** — script chỉ xoá dòng
   mở đầu ⇒ còn sót dòng `import(...)` và `tsc` báo lỗi cú pháp.
4. `routeCatalog.js` khối route có **10 dòng** — xoá kiểu "xen giữa `id:` và `},`" mới đúng.
5. Hai test i18n/tokens **đọc file đã xoá** ⇒ `ENOENT`; phải cập nhật danh sách file chứ
   không xoá assertion. `ai-settings-tokens` từng trỏ `SUB_ROUTE_A` vào trang Agents ⇒ đổi
   sang route Traces (còn tồn tại) thay vì xoá hẳn.

## Thêm một lỗi công cụ (đã chặn trước khi commit)

`check-system-design` báo `CITATION ... file không tồn tại` cho `migrations/0001_initial.py`
và tên test đã xoá: checker quét **mọi token có dấu chấm phẩy trong doc** như citation và phân
giải theo gốc BE `packages/core/backend/src`. Phải viết đường dẫn **đầy đủ kèm app**
(`ai_agents/migrations/0003_...py`) và **không** nhắc tên file đã xoá trong doc.

## Staging — đo thật sau deploy (2026-10-18, `dev` @ `d56a95741`)

Deploy `scripts/deploy-staging.sh` → tất cả container `healthy`.

| Đo | Kết quả |
|---|---|
| `grep ai_agents` trong `vninvest_core/urls.py` | **không còn include** |
| `GET /api/core/v1/ai/agents/` | **404** |
| `GET /api/core/v1/ai/usage/summary/` | **401** (route còn sống) |
| `information_schema.tables` `ai_agents_agentregistry` | **0** — migration `0003_delete_agentregistry` đã **drop bảng thật** |
| FE bundle `dist/assets` | không còn chuỗi `settings/ai/agents` |

**Vì sao phải có dòng 401 đi kèm dòng 404:** 404 một mình không chứng minh gì — nếu cả
prefix `/api/core/v1/ai/` đã hỏng thì cũng ra 404. Có `401` ở `/ai/usage/summary/` mới chứng
minh 404 ở `/ai/agents/` là **do route bị gỡ**, không phải do deploy hỏng chung.

## ⚠ Bẫy đo: `resolve()` **không chứng minh route còn hay mất**

Lần đo đầu tôi chạy `django.urls.resolve()` trong container và nhận:

```
/api/core/v1/ai/agents/   -> RESOLVED <function legacy_proxy_view>
/api/core/v1/ai/audit/    -> RESOLVED <function legacy_proxy_view>
/api/core/v1/ai/usage/summary/ -> RESOLVED <function legacy_proxy_view>
```

**Cả 3 route đều "resolve được"**, kể cả route đã gỡ ⇒ `resolve()` bị một
`legacy_proxy_view` bắt-tất-cả che, trả về 200 cho mọi đường dẫn. Nếu tôi dừng ở đó và
ghi "AC2 đạt" thì đó là **bằng chứng giả**. Phải dùng **HTTP thật** (`curl`) mới đo được
404/401 — xem lesson L-V07.

## Còn mở

- Tab Agents **không còn trong FE bundle** trên staging, nhưng **chưa chụp màn hình** xác nhận
  nav hiện đủ 5 tab (Overview/Usage/Traces/SLO/Audit) với phiên đã đăng nhập — cần chạy
  Playwright có `storageState` như R4.4. **CHƯA CHẠY.**
- Khoá i18n `aiAgentFederation.*` còn trong `vi.js`/`en.js` nhưng **không còn nơi dùng**;
  chưa gỡ vì `i18n:scan` và test parity có thể khoá danh sách — để wave dọn nợ.
- `ai-cc-i18n-clean.component.test.ts` vẫn liệt kê một số khoá `aiAgentFederation.*` trong
  danh sách kiểm parity; cần rà lại ở wave dọn nợ tiếp.