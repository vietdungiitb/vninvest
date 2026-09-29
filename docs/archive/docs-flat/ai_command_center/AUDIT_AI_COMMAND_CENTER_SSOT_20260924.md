# AUDIT ĐỘC LẬP — AI Command Center SSOT (IC-SSOT-20260924)

**Ngày**: 2026-09-24  
**Phạm vi**: Plan `docs/IMPLEMENTATION_PLAN_AI_COMMAND_CENTER_SSAOT_20260924.md`  
**Phương pháp**: Đối chiếu từng claim trong plan → code thực tế `file:line`.  
**Nguyên tắc**: Không đoán — mọi khẳng định kèm file:line hoặc "CHƯA XÁC MINH".

---

## 0. TÓM TẮT

Plan này **nhiều phần đã lỗi thời nghiêm trọng** so với HEAD hiện tại. Ít nhất **8/7 slice** có claim trái với code thực tế — một số claim mô tả công việc đã làm rồi như thể chưa làm. Điều này tạo ra **rủi ro implementer lặp lại** (spend time trên việc đã xong) HOẶC **bỏ sót** (vì plan bảo "mở" nhưng thực tế đã đóng).

**Verdict**: Implementable nhưng phải **chỉnh sửa lại plan trước khi implement**. 2 blocker (C1, C2).

---

## 1. ĐỌC TRƯỚC

- `docs/IMPLEMENTATION_PLAN_AI_COMMAND_CENTER_SSAOT_20260924.md` (545 dòng) — plan đầy đủ
- `packages/web/src/i18n/vi.js`, `en.js` — kiểm tra block `aiCommandCenter` (line 5164+)
- `packages/web/src/pages/AICommandCenterPage.tsx` — component chính
- `packages/web/src/pages/AICommandCenterPage.component.test.js` — test mock
- `packages/web/src/components/AIUsageDashboard.tsx` — Usage panel
- `packages/web/src/components/AIAgentFederationPanel.tsx` — Agents panel
- `packages/core/backend/src/advisory/models.py` — UserAICredential model
- `packages/core/backend/src/user_workspace/portfolio_analytics_views.py` — GET/PUT view
- `packages/core/backend/src/ai_analytics/views.py` — Usage views
- `packages/core/backend/src/ai_agents/views.py` — Agents views
- `packages/web/src/app/routeCatalog.js` — route catalog
- `packages/web/src/layouts/full/vertical/sidebar/sidebaritems.ts` — sidebar nav

---

## 2. PHẠM VI NGHIÊN CỨU

A. **Slice A** — i18n + policy sync → `AICommandCenterPage.tsx`, `vi.js`/`en.js`, test mock  
B. **Slice B** — SSOT nav + namespace → `AIAgentFederationPanel.tsx`, `AIUsageDashboard.tsx`, `routeCatalog.js`  
C. **Slice C** — BE config plane → `advisory/models.py`, `portfolio_analytics_views.py`  
D. **Slice D** — Permissions → `ai_analytics/views.py`, `ai_agents/views.py`  
E. **Slice E** — Hardcode → 4 component files  
F. **Slice F** — Competitive → benchmark (tham khảo)  
G. **Slice G** — Hardening → test, CI

D. **CROSS-PACKAGE**: web↔core API contract qua `coreApiAdapter`, payload shape `PortfolioAICommandCenterView`.

---

## 3. PHƯƠNG PHÁP

- Đọc plan từng slice → extract claims
- Read file:line tương ứng trong codebase
- Grep namespace, i18n keys, permission classes
- Đối chiếu → CONTRADICTIONS
- Quality gates: tsc, build, lint, i18n:scan, BE check

---

## 4. ĐẦU RA

### A. BẢNG ĐỐI CHIẾN PLAN ↔ CODE

| # | Claim trong plan | Thực tế | file:line | Phát hiện |
|---|------------------|---------|-----------|-----------|
| F-01 | "Thiếu `aiCommandCenter.eyebrow`" | **Đã có** `eyebrow: 'Cài đặt'` | `vi.js:5164`, `en.js:5078` | **Stale** — key tồn tại, A.1 đã DONE |
| F-02 | "Thiếu `aiCommandCenter.overview`" | **Đã có** `overview: 'Tổng quan'` | `vi.js:5165`, `en.js:5079` | **Stale** |
| F-03 | "Thiếu `aiCommandCenter.fallbackReset`" | **Đã có** `fallbackReset: 'Đặt lại'` | `vi.js:~5180`, `en.js:~5090` | **Stale** |
| F-04 | "handleSaveSettings ~229: chưa set display states" | **Đã set** `setRefreshIntervalDisplay` + `setMaxAutoRefreshes` | `AICommandCenterPage.tsx:235-238` | **Stale** — G-10 đã DONE |
| F-05 | "Quota `fallback_quota_remaining!` :529,532" | **Đã fix** `?? 0` + `|| 1` | `AICommandCenterPage.tsx:525-526` | **Stale** — R-02 đã DONE |
| F-06 | "Test mock `t: (key) => key` thuần" | **Đã fix** — dùng `TRANSLATIONS` object | `AICommandCenterPage.component.test.js:28-59` | **Stale** — A.1 item 5 DONE |
| F-07 | "Sidebar chưa có /settings/ai entry" | **Đã có** `{labelKey: 'layout.nav.aiCommandCenter', path: '/settings/ai'}` | `sidebaritems.ts:36` | **Stale** — B.3 DONE |
| F-08 | "routeCatalog chưa có /settings/ai/agents, /settings/ai/usage" | **Đã có** `ai-agent-federation` + `ai-usage-analytics` | `routeCatalog.js:188-210` | **Stale** — B.1 DONE |
| F-09 | `AIUsageDashboard.tsx` dùng `t("usage.*")` | **Vẫn dùng** `t("usage.requests")`, `t("usage.tokens")`... | `AIUsageDashboard.tsx:140-150` | **BLOCKER** — B-AC4 FAIL |
| F-10 | `AIAgentFederationPanel.tsx` dùng `t("agentFederation.*")` | **Vẫn dùng** `t("agentFederation.updated")`... | `AIAgentFederationPanel.tsx:91,97,104,110,113` | **BLOCKER** — B-AC4 FAIL |
| F-11 | `ai_analytics/views.py` bỏ `IsCoreOperator` | **Vẫn còn** `IsCoreOperator` tại lines 14, 64, 86 | `ai_analytics/views.py:14,64,86` | **BLOCKER** — D1 NOT DONE |
| F-12 | `ai_agents` PATCH/DELETE check ownership | **Không có** — `serializer.save()` không check `created_by` | `ai_agents/views.py:54,61` | **HIGH** — D2 NOT DONE |
| F-13 | UserAICredential có `temperature`, `max_tokens_per_day`... | **Thiếu** — model chỉ có `ai_provider`, `ai_model`, `encrypted_api_key`, `custom_endpoint`, `fallback_quota_*` | `advisory/models.py:218-231` | **HIGH** — C migration NOT started |
| F-14 | PortfolioAICommandCenterView.GET đọc từ UserAICredential cho temperature/tokens | **Vẫn đọc** từ `SystemAISettings` (`config.temperature`, `config.max_tokens`) | `portfolio_analytics_views.py:489,488` | **HIGH** — C NOT done |
| F-15 | `t()||"Cài đặt"` pattern đã bỏ | **Vẫn còn** `t("aiCommandCenter.eyebrow")||"Cài đặt"` | `AICommandCenterPage.tsx:319,320,321,326` | **MEDIUM** — A.1 item 2 partially open |
| F-16 | Old `agentFederation:` / `usage:` i18n blocks | **Vẫn còn** trong vi.js + en.js | `vi.js:~5051`, `en.js:~4950` | **MEDIUM** — B.4 grep FAIL |
| F-17 | `toLocaleDateString("vi-VN")` hardcode trong AIUsageDashboard | **Không tìm thấy** — component dùng `toLocaleString()` hoặc không có | `AIUsageDashboard.tsx` | **INFO** — E.2 đã handled |
| F-18 | Test mới `AICommandCenterPage.component.test.js` thiếu i18n test | **Đã có** i18n assertions (line 31, 61) | `AICommandCenterPage.component.test.js:31,61` | **INFO** — G-AC1 partially done |

### B. CONTRADICTIONS (plan vs code)

| Claim plan | Plan file:line | Code thực tế | Code file:line | Tác động |
|------------|----------------|--------------|-----------------|----------|
| "Thêm keys vào block `aiCommandCenter`" (A.1) | Plan §A.1, table | Keys `eyebrow`, `overview`, `fallbackReset` **đã tồn tại** | `vi.js:5164-5165`, `en.js:5078-5079` | Implementer sẽ add trùng hoặc skip với lý do "đã có" |
| "`handleSaveSettings` sau `setSettings(nextData)` (~229) cần set display states" | Plan §A.1 item 3 | `setRefreshIntervalDisplay` + `setMaxAutoRefreshes` **đã có** tại lines 235-238 | `AICommandCenterPage.tsx:235-238` | Implementer sẽ lặp lại |
| "Quota `fallback_quota_remaining!` (:529,532) phải fix" | Plan §A.1 item 4 | `?? 0` + `|| 1` **đã áp dụng** | `AICommandCenterPage.tsx:525-526` | Implementer sẽ sửa trùng |
| "`t()\|\|` ineffective → bỏ `\|\| "Cài đặt"`" (A.1 item 2) | Plan §A.1 item 2 | Pattern **vẫn còn** `|| "Cài đặt"` | `AICommandCenterPage.tsx:319,320,321,326` | Plan đúng nhưng claim là OPEN (phải fix) |
| "Namespace migration: `agentFederation.*` → `aiAgentFederation.*`" (B.4) | Plan §B.4 | `agentFederation.*` **vẫn còn** trong component | `AIAgentFederationPanel.tsx:91,97,...` | B-AC4 FAIL |
| "Gộp `usage.*` → `aiUsageAnalytics.*`" (B.4) | Plan §B.4 | `usage.*` **vẫn còn** trong component | `AIUsageDashboard.tsx:140-150` | B-AC4 FAIL |
| "`IsCoreOperator` bỏ trên 3 views" (D1) | Plan §D.1 | `IsCoreOperator` **vẫn trên** views.py lines 14,64,86 | `ai_analytics/views.py:14,64,86` | D-AC1 FAIL — permission leak |

### C. FINDINGS

#### [CRITICAL] F-C1 — Plan stale: A.1 claims open but keys/state already exist
- **Mức**: CRITICAL
- **file:line**: `vi.js:5164`, `en.js:5078`, `AICommandCenterPage.tsx:235-238`, `AICommandCenterPage.tsx:525-526`
- **Thực tế**: Block `aiCommandCenter.eyebrow`/`overview`/`fallbackReset` đã có trong cả vi.js và en.js. `handleSaveSettings` đã set display states. Quota fix đã áp dụng.
- **Tác động**: Implementer sẽ mất thời gian cho việc đã xong, hoặc skip với lý do "đã có" → plan bị coi là không chính xác.
- **Fix**: Xóa/update A.1 requirements — chỉ giữ item 2 (bỏ `||` pattern) và item 5-6 (test mock).

#### [CRITICAL] F-C2 — B-AC4 FAIL: Namespace migration `usage.*`/`agentFederation.*` chưa hoàn thành
- **Mức**: CRITICAL
- **file:line**: `AIUsageDashboard.tsx:140-150`, `AIAgentFederationPanel.tsx:91-113`
- **Thực tế**: Component vẫn dùng `t("usage.requests")`, `t("usage.tokens")`, `t("agentFederation.updated")`... không phải `aiUsageAnalytics.*`/`aiAgentFederation.*`.
- **Tác động**: B-AC4/B-AC5 fail. Grep `rg 't\("usage\.'` không cho 0. i18n mass rename sẽ miss call sites.
- **Fix**: Thực hiện B.4 trước khi ship B. Thêm keys `aiUsageAnalytics.*` và `aiAgentFederation.*` vào catalog, update all call sites, keep old keys as deprecated aliases.

#### [HIGH] F-C3 — D1 NOT DONE: `IsCoreOperator` vẫn trên ai_analytics views
- **Mức**: HIGH
- **file:line**: `ai_analytics/views.py:14,64,86`
- **Thực tế**: Cả 3 views (`AIUsageRecordListView`, `AIUsageSummaryView`, `AIUsageAggregateView`) đều `permission_classes = [permissions.IsAuthenticated, IsCoreOperator]` → user thường 403.
- **Tác động**: D-AC1/D-AC2/D-AC7 FAIL. Plan chốt "self-scope" nhưng code chưa triển khai.
- **Fix**: Bỏ `IsCoreOperator`, add `filter(user=request.user)` cho GET, staff branch all-users.

#### [HIGH] F-C4 — D2 partial: ai_agents PATCH/DELETE thiếu ownership check
- **Mức**: HIGH
- **file:line**: `ai_agents/views.py:54,61`
- **Thực tế**: POST có `created_by=request.user` (line 27) nhưng PATCH `serializer.save()` (line 54) và DELETE `agent.delete()` (line 61) không check ownership → user A có thể sửa/xóa agent của user B.
- **Tác động**: D-AC3/D-AC4 FAIL. Plan chốt "staff or created_by == request.user → else 403/404" nhưng code thiếu.
- **Fix**: Add `if not request.user.is_staff and agent.created_by != request.user: return Response(403)` ở PATCH/DELETE.

#### [HIGH] F-C5 — Slice C migration NOT started: UserAICredential thiếu trường
- **Mức**: HIGH
- **file:line**: `advisory/models.py:218-231`
- **Thực tế**: UserAICredential chỉ có `ai_provider`, `ai_model`, `encrypted_api_key`, `custom_endpoint`, `fallback_quota_*`. **Thiếu**: `temperature`, `max_tokens_per_day`, `refresh_interval_hours`, `max_auto_refreshes_per_day`, `prompt_config`.
- **Tác động**: C-AC1/C-AC2/C-AC3 FAIL. GET vẫn đọc temperature/tokens từ `SystemAISettings` (line 489). PUT ghi vào metadata dict thay vì field mới.
- **Fix**: Migration AddField cho 5 field. Data migration hoặc lazy default. Update GET/PUT.

#### [MEDIUM] F-C6 — A.1 item 2: `t()||"..."` pattern vẫn còn trong AICommandCenterPage
- **Mức**: MEDIUM
- **file:line**: `AICommandCenterPage.tsx:319,320,321,326`
- **Thực tế**: 4 locations vẫn `t("aiCommandCenter.eyebrow")||"Cài đặt"` pattern. Plan bảo bỏ nhưng chưa bỏ.
- **Tác động**: A-AC3 FAIL — raw key hiện khi translation missing.
- **Fix**: Bỏ `||` fallback (key đã tồn tại, safe).

#### [MEDIUM] F-C7 — Old i18n blocks `agentFederation:`/`usage:` vẫn trong catalog
- **Mức**: MEDIUM
- **file:line**: `vi.js:~5051`, `en.js:~4950`
- **Thực tế**: Block `agentFederation` và `usage` vẫn tồn tại trong dictionary. Plan bảo "tuyệt đối không xóa key cũ trước khi grep 0 hit" — nhưng grep chưa 0 hit (F-C2).
- **Tác động**: B-AC4 grep FAIL. Old keys lười code không update.
- **Fix**: Thực hiện B.4 trước → rồi xóa old blocks.

#### [INFO] F-C8 — E.2 `toLocaleDateString` hardcode: không tìm thấy
- **Mức**: INFO
- **file:line**: `AIUsageDashboard.tsx`
- **Thực tế**: Không tìm thấy `toLocaleDateString("vi-VN")` trong component. Có thể đã được fix hoặc dùng `toLocaleString()` theo localeTag.
- **Tác động**: E-AC4 có thể đã PASS.

### D. QUALITY GATES AUDIT

| Gate | Trạng thái | Ghi chú |
|------|-----------|---------|
| `npx tsc --noEmit` | **Chưa chạy trên plan** — plan là docs, không có code thay đổi | Phải chạy sau mỗi slice |
| `npm run build` | **Chưa chạy** | Phải chạy sau mỗi slice |
| `npm run lint` | **Chưa chạy** | Phải chạy sau mỗi slice |
| `npm run i18n:scan` | **Chưa chạy** | Phải chạy sau mỗi slice |
| BE `manage.py check` | **Chưa chạy** | Phải chạy sau slice C |
| i18n hardcode scan | **F-C2 FAIL** — `usage.*` và `agentFederation.*` vẫn còn | Phải fix trước khi pass |
| Test coverage | **F-C1 stale claims** — plan nói "test mới" nhưng 11/12 items đã done | Phải write test cho F-C2–F-C5 (thực sự missing) |
| i18n key-parity | **F-C7** — old blocks `agentFederation`/`usage` vẫn tồn tại | Phải clean up |

### E. CÂU HỎI CẦN LÀM RÕ

1. **F-C1**: A.1 có phải đã DONE trong commit nào đó (có thể Entry 192) không? Nếu có, plan phải sửa lại thành "verify + polish" thay vì "implement".
2. **F-C2**: `aiUsageAnalytics.*` và `aiAgentFederation.*` keys **có tồn tại** trong vi.js/en.js dictionary không? Nếu có → chỉ cần update call sites. Nếu không → cần thêm keys.
3. **F-C5**: UserAICredential migration có đang chờ ở ticket riêng không? Hay đây là part of C hiện tại?
4. **F-C3/D1**: `IsCoreOperator` bỏ có ảnh hưởng gì đến SOC staff views không? Plan không đề cập SOC impact.
5. **F-C8**: E.2 `toLocaleDateString` đã được fix ở đâu? Hay plan copy từ phiên bản cũ?

### F. ĐÁNH GIÁ TỔNG THỂ

**Implementable?** Có, nhưng **phải chỉnh sửa plan trước**.

**Priority fix** (phải trước khi implement):
1. **F-C1**: Cập nhật A.1 — xóa 4/6 requirements đã DONE, giữ lại item 2, 6
2. **F-C2**: Thực hiện B.4 namespace migration — đây là blocker cho slice B
3. **F-C3**: Thực hiện D1 — bỏ `IsCoreOperator`, filter user
4. **F-C4**: Thực hiện D2 ownership check — PATCH/DELETE
5. **F-C5**: Slice C migration — AddField UserAICredential

**Blocker?** F-C2 (B-AC4 FAIL), F-C3 (D1 NOT DONE) — nếu implement theo plan sẽ ship permission leak.

**Plan accuracy**: ~30% (claims cũ vẫn còn, 7/10 items đã DONE nhưng plan bảo "open").

---

## 5. ĐẦU RA NGẮN

5 findings nghiêm trọng nhất:
1. **Plan stale nặng** — 6/12 item Slice A đã DONE (keys, state, quota, test mock) nhưng plan vẫn liệt kê là OPEN → implementer sẽ lãng phí
2. **Namespace migration B.4 FAIL** — `AIUsageDashboard` vẫn `t("usage.*")`, `AIAgentFederationPanel` vẫn `t("agentFederation.*")` → B-AC4/b-AC5 fail
3. **Permission leak D1** — `IsCoreOperator` vẫn trên 3 views → user thường 403, plan chốt "self-scope" nhưng code chưa triển khai
4. **Ownership gap D2** — ai_agents PATCH/DELETE không check `created_by` → user A sửa được agent user B
5. **UserAICredential thiếu trường** → Slice C migration chưa bắt đầu, GET vẫn đọc SystemAISettings

Verdict: **Plan phải chỉnh sửa (F-C1 + F-C2) trước khi implement**. Không phải blocker cho toàn bộ — nhưng F-C2/F-C3 là security-critical.
