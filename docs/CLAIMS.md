# CLAIMS — Registry công việc đang giữ (multi-agent)

> **Cơ chế chống xung đột số 1: hai agent không được sửa cùng một file mà không khai báo.**
>
> File này **append-only ở CUỐI file**. Không sửa, không xoá, không sắp xếp lại dòng cũ.
> `.gitattributes` đã đặt `merge=union` cho file này ⇒ hai agent cùng append sẽ **tự merge, không conflict**.
>
> **Cách dùng:** trước khi sửa file, kiểm tra cột `files`. Nếu file đã bị agent khác giữ mà agent đó còn `in-progress` ⇒ **dừng, không sửa**. Nếu `done` hoặc `released` thì được sửa (nhưng phải đổi claim sang mình).
> Xác nhận tự động: `node packages/web/scripts/check-multi-agent.mjs`

## Quy tắc đặt claim

| Trạng thái | Ý nghĩa | Agent khác được làm gì |
|---|---|---|
| `proposed` | Đã khai, chưa bắt đầu | được sửa nếu cần, nhưng phải báo lại trong claim của mình |
| `in-progress` | Đang sửa | **KHÔNG** được sửa file đó. Phải chờ hoặc phối hợp |
| `blocked` | Bị chặn bởi yêu cầu ngoài | được sửa, nhưng ghi chú vào claim của mình |
| `done` | Xong, chưa merge | được sửa nếu cần thiết, ưu tiên mở PR hợp nhất |
| `released` | Đã merge, claim mở lại cho ai cũng được | tự do |

**Cột `files` là danh sách glob.** Ví dụ `packages/core/backend/src/advisory/views.py` hoặc `packages/core/backend/src/advisory/*`.

**File bị khóa tập trung (shared file)** — xem `docs/AGENT_PROTOCOL.md` §2. Agent **không bao giờ** claim các file này.

---

## Claims đang hoạt động

<!-- APPEND BELOW THIS LINE. Keep newest at the BOTTOM. One row per claim. -->

| agent | branch | scope | files | status | since | note |
|---|---|---|---|---|---|---|
| `core-team` | `dev` | AI CC Slice C — multi-tenant config plane | `packages/core/backend/tests/test_ai_cc_config_isolation.py`, `packages/web/src/shared/providerModels.ts` | in-progress | 2026-09-26 | Theo Entry 202 (C.1 +5 field). **Chồng với claim `ai-cc-agent` — đã thu hẹp claim đó, xem hàng `superseded`.** |
| `core-team` | `dev` | AI Advisory (Entry 215) | `packages/core/backend/src/advisory/{orchestrator,serializers,tasks,urls,views,models}.py` | in-progress | 2026-09-26 | Migration `advisory/0011_align_model_choices_with_live_providers.py`. Đã probe thật endpoint Google: `gemini-3.8-flash` 200, loại 4 model 404. |
| `core-team` | `dev` | i18n hardcode gate | `packages/web/src/components/{advisory/*,WhaleBubbleChart.jsx,dashboard/WhaleAnalyticsTab.jsx}`, `packages/web/src/pages/signals/WhaleAdvisoryPage.tsx` | in-progress | 2026-09-26 | Thêm `check:i18n-hardcoded` vào `check:shell`. **Còn sửa `packages/web/i18n/{vi,en}.js` — agent khác tránh 2 file này.** |
| `ai-cc-agent` | `feat/ai-cc-r0` | AI Advisory W0 — contract BE (`signal`/`confidence_score` + fail-closed + 2 endpoint stub thật) | `packages/core/backend/src/advisory/signal_norm.py`, `packages/core/backend/src/advisory/model_choices.py`, `packages/core/backend/src/advisory/orchestrator.py`, `packages/core/backend/src/advisory/tasks.py`, `packages/core/backend/src/advisory/serializers.py`, `packages/core/backend/tests/test_advisory_contract.py` | blocked | 2026-09-26 | **Bị chặn: 4/6 file trong claim gốc đã bị `core-team` giữ trước** (xem hàng `ai-cc-agent (superseded)`). Worktree `C:\Mujoco Projects\agent-ai-cc`. DB `aicc_r0` đã migrate xong. Env: `CORE_DATABASE_URL=postgresql://vninvest:devpassword@127.0.0.1:5433/aicc_r0` + `DJANGO_DEBUG=1`. Chờ coordinator phân định phạm vi trước khi sửa. |

## Claims đã đóng

<!-- APPEND BELOW THIS LINE. -->

| agent | branch | scope | status | closed | note |
|---|---|---|---|---|---|
| `audit-agent` | `dev` (954c0ef2, c21711d4) | Audit + plan AI Command Center | released | 2026-09-26 | Doc-only, 0 dòng runtime. Plan `docs/IMPLEMENTATION_PLAN_AI_COMMAND_CENTER_COMMERCIAL_20260925.md` (46 slice). |
| `ai-cc-agent` | `feat/ai-cc-r0` | ~~AI Command Center R0 wave~~ | superseded | 2026-09-26 | **Claim gốc vi phạm chính protocol:** khai 5 file mà chưa kiểm tra `core-team` đã giữ 2 trong số đó (`portfolio_analytics_views.py`, `providerModels.ts`). Đã thu hẹp lại 6 file advisory-only. Không sửa file nào. Bài học: **kiểm tra CLAIMS.md + `git status` TRƯỚC khi khai claim, không phải sau.** |
| `ai-cc-ssrf` | `feat/ai-cc-ssrf` | P0-3 SSRF — chặn `custom_endpoint` tới host nội bộ + throttle riêng cho probe | `packages/core/backend/src/user_workspace/endpoint_safety.py`, `packages/core/backend/src/user_workspace/portfolio_analytics_views.py`, `packages/core/backend/tests/test_ai_endpoint_safety.py`, `packages/core/backend/tests/test_ai_endpoint_probe_view.py` | done | 2026-09-26 | Xong, 55 test OK (21 mới). Đóng luôn dòng stub `proposed` do `new-agent.ps1` sinh ở main tree — tránh 2 dòng cho cùng 1 agent (`CLAIMS.md` có `merge=union` nên 2 dòng đều sống sót). Chưa merge. |
