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
| `core-team` | `feat/advisory-runtime-integrity` | AI CC Slice C — multi-tenant config plane | `packages/core/backend/tests/test_ai_cc_config_isolation.py`, `packages/web/src/shared/providerModels.ts` | done | 2026-09-26 | Đã lên branch. Xác minh: test file + `providerModels.ts` có trong `dev..HEAD`. PR #9. |
| `core-team` | `feat/advisory-runtime-integrity` | AI Advisory (Entry 215) | `packages/core/backend/src/advisory/{orchestrator,serializers,tasks,urls,views,models}.py` | done | 2026-09-26 | Đã lên branch. Xác minh: 10 file advisory thay đổi, gồm module mới `signal_norm.py` (SSOT signal) — **trùng mục R0.1 của plan AI CC**. PR #9. |
| `core-team` | `feat/advisory-runtime-integrity` | i18n hardcode gate | `packages/web/src/components/{advisory/*,WhaleBubbleChart.jsx,dashboard/WhaleAnalyticsTab.jsx}`, `packages/web/src/pages/signals/WhaleAdvisoryPage.tsx` | done | 2026-09-26 | Đóng sau commit coordinator `b32ac3f1`: `check:i18n-hardcoded` đã đăng ký trong `package.json` + nối vào `check:shell`. Trước đó script có trong tree nhưng **chưa được gọi từ đâu**. PR #9. |
| `ai-cc-agent` | `feat/ai-cc-r0` | ~~AI Advisory W0 — contract BE~~ | `packages/core/backend/src/advisory/signal_norm.py`, `model_choices.py`, `orchestrator.py`, `tasks.py`, `serializers.py` | superseded | 2026-09-26 | **Đã bị `core-team` làm trước trong PR #9.** `signal_norm.py` + `model_choices.py` + 4 file kia đều đã có trong branch. Claim này thành vô nghĩa — không tạo lại thứ đã tồn tại. Worktree `C:\Mujoco Projects\agent-ai-cc` + DB `aicc_r0` vẫn giữ để dùng lại. |

## Claims đã đóng

<!-- APPEND BELOW THIS LINE. -->

| agent | branch | scope | status | closed | note |
|---|---|---|---|---|---|
| `audit-agent` | `dev` (954c0ef2, c21711d4) | Audit + plan AI Command Center | released | 2026-09-26 | Doc-only, 0 dòng runtime. Plan `docs/IMPLEMENTATION_PLAN_AI_COMMAND_CENTER_COMMERCIAL_20260925.md` (46 slice). |
| `ai-cc-agent` | `feat/ai-cc-r0` | ~~AI Command Center R0 wave~~ | superseded | 2026-09-26 | **Claim gốc vi phạm chính protocol:** khai 5 file mà chưa kiểm tra `core-team` đã giữ 2 trong số đó (`portfolio_analytics_views.py`, `providerModels.ts`). Đã thu hẹp lại 6 file advisory-only. Không sửa file nào. Bài học: **kiểm tra CLAIMS.md + `git status` TRƯỚC khi khai claim, không phải sau.** |

| `advisory-audit` | `feat/advisory-audit` | ~~Audit AI Advisory W0 contract BE~~ | — | released | 2026-09-26 | Được cấp phát nhưng **chưa tạo file nào, 0 commit** — audit bị `core-team` làm trong PR #9 (ledger Entry 231). Worktree `C:\Mujoco Projects\advisory-audit` + DB `ag_advisory_audit` giữ nguyên để tái dùng. Không có citation nào cần rebase vì không có việc. |
