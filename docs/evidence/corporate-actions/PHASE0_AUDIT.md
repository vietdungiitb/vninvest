# PHASE 0 AUDIT — Corporate Actions Pipeline (vòng 1 + resolution)

- **Ngày**: 2026-11-20
- **Auditor**: subagent độc lập, read-only (không sửa file, không commit). Kiểm trên HEAD `5e27811e2` của branch `docs/corp-action-phase0-evidence`.
- **Scope**: `docs/PLAN_CORPORATE_ACTIONS_PIPELINE_20261120.md`, `docs/AUDIT_CORPORATE_ACTION_PHASE0_EVIDENCE_20261120.md`, `docs/AUDIT_CRITIQUE_VNBROKER_CORPORATE_ACTION_20261120.md`, `docs/handoffs/HANDOFF_2026-11-20_VNBROKER_CORPORATE_ACTION.md`, quy trình claim/gate.
- **Mục đích**: gate B3→B4 trước khi mở `feat/corporate-actions`.

## VERDICT VÒNG 1: NEED_REVISION

Auditor chấp nhận các quyết định kỹ thuật D1–D7 (D1 có reservation, D4 có reservation) nhưng yêu cầu sửa 8 objection. Không có vi phạm claim/shared-file/gate/lesson trong slice docs.

### Objections và cách đóng

| # | Objection (auditor) | Đóng bởi coordinator | Trạng thái |
|---|---|---|---|
| O1 | Ma trận REQ→task lệch: R7 ghi `6` (thực tế Task 5), R8 ghi `4,7` (thực tế `4,6`), C4 `Phase 0+7` nhưng test ghi Task 8, C9 thiếu `5` | Sửa plan ma trận: R7→`5`, R8→`4,6`, C4→`Phase 0 + 7, 8`, C9→`4,5` | ✅ |
| O2 | Handoff ghi `Σ cash đã xác minh` dù chưa đối chiếu độc lập (C1 dưới dạng khác); danh sách "còn chờ" bỏ sót Q3–Q6 | Đổi thành `số tiền chưa đối chiếu độc lập`; ghi rõ **Q1–Q9 đều mở**, chưa câu nào đóng bằng phản hồi chính thức | ✅ |
| O3 | Fallback `source_event_id = hash(symbol\|ex_date\|action_type)` va chạm cho 2 DIV cùng ex_date nếu thiếu `id` ⇒ gộp 1 row, factor sai ~950 VND; chưa có test | Đưa `cash_normalized`/`ratio_normalized` vào hash (vẫn **không** cho `raw_title` để AC7 đạt); thêm suffix + log `FALLBACK_ID_COLLISION`; thêm test `test_fallback_id_collision_two_div_same_ex_date`. VCI `id` vẫn là khóa chính | ✅ |
| O4 | Đường dẫn verdict `docs/evidence/corporate-actions/PHASE0_AUDIT.md` chưa tồn tại ⇒ gate B3 chưa đóng bằng file | File này chính là bằng chứng; phải đóng claim docs slice sau khi commit | ✅ (file này) |
| O5 | Task 7 Step 4 commit message ghi `ledger entry 569` (phải 570) | Sửa thành `entry 570` | ✅ |
| O6 | Nhãn "VNSAAS profile" không có trong skill repo (`workflow-dev-loop/SKILL.md` ghi "profile vninvest") | Thay 7 hit bằng "profile vninvest (9 bước, tooling repo)" trên plan/evidence/critique/handoff | ✅ |
| O7 | Citation trần: plan `settings.py:776-783`, `vci/company.py:104-116`; handoff §3.2 package path không prefix | Gắn `dev@3845063a5:...settings.py:776-783`, `vnbroker-3.7.2@container:explorer/vci/company.py:...` và prefix từng dòng bảng §3.2 | ✅ |
| O8 | AC5 (`PROVIDER_AUTH`) và AC6 (`source` fallback) chưa có test ghim | Thêm `test_tcbs_provider_auth_error_mapped`; bổ sung assert giữ `source` trong `test_all_providers_empty_keeps_existing` | ✅ |

### Reservation còn lại (không chặn code, nhưng phải giữ mở)

- **D1**: bỏ hardcode 2450 triệt tiêu được sự tự mâu thuẫn của C1, nhưng **không** triệt tiêu rủi ro gốc — chưa có đối chiếu disclosure/TCBS. Giữ Q2 mở; golden test là test cơ học (dedup + công thức), không phải oracle số tiền thật.
- **D3**: auditor **không tự re-probe container** (không có source vnbroker vendored trong repo) — kết luận account-scoped dựa trên lệnh probe có trong evidence §2. Đây là bằng chứng gián tiếp ở mức repo, đầy đủ để quyết định không dùng DNSE.
- **D4**: đường có `id` đúng (title đổi vẫn 1 row); rủi ro nằm ở đường fallback đã sửa ở O3.

### Checks auditor đã chạy (read-only)

- `git rev-parse HEAD` → `5e27811e2`; `git log -2` → claim `dccfe1ba6` **trước** docs commit: đúng L-002.
- `git show dccfe1ba6 -- docs/CLAIMS.md` → đúng 1 dòng append, byte cuối LF.
- `git ls-tree origin/dev | Select-String 'CLAIMS|check-multi-agent|AGENT_PROTOCOL'` → đủ 3; `node packages/web/scripts/check-multi-agent.mjs` → **exit 0** (0 lỗi, 0 trùng migration; 214 cảnh báo CLAIMS stale).
- `git grep "2.450" -- handoff` → **exit 1** (0 hit).
- `git grep "stock_mgmt_native_views.py:"` → 3 hit, đều có `@sha`.
- Glob `docs/evidence/corporate-actions/**` trước vòng 1 → KHÔNG TỒN TẠI (nay đã tạo).

## VÒNG 2 (re-audit)

**VERDICT VÒNG 2: AGREE** — auditor xác nhận O2–O8 đóng hoàn toàn; O1 chỉ còn 1 dòng self-review sai số task (đã sửa `C4→T7/T8`). Đủ điều kiện mở `feat/corporate-actions`. Không cần vòng 3.

### Reservation và cách đóng

| ID | Reservation | Đóng ở đâu |
|---|---|---|
| R1 | Ghi verdict vòng 2 vào file này | **Đóng bằng chính mục này** — coordinator ghi sau khi nhận AGREE, trước dòng code đầu tiên ✅ |
| R2 | Self-review `C4→T6+T7` lệch ma trận | Sửa thành `C4→T7/T8` trong plan ✅ |
| R3 | Chuẩn hoá `cash_normalized`/`ratio_normalized` chưa định nghĩa | Plan Task 3 thêm contract `Decimal.quantize('0.01'/'0.0001')`, null ⇒ `''` + test `test_fallback_normalize_stable` ✅ |
| R4 | Amount đổi cùng title trên đường fallback ⇒ ID mới, cộng đôi | Plan Task 3 thêm rule supersede theo business key + test `test_fallback_amount_change_supersedes_old` ✅ |
| R5 | Suffix "thứ tự xuất hiện" không deterministic | Plan Task 3 đổi sang suffix `sha256` tuple sắp xếp ✅ |
| R6 | Entry 569 còn chữ "VNSAAS profile" | Plan Task 7 Step 2 thêm dòng đính chính trong Entry 570 (append-only, không sửa Entry cũ) ✅ |
| R7 | Claim docs slice còn `in-progress`; branch chưa push | Coordinator push + PR + merge, sau đó đổi claim → `done` ✅ (thực hiện ở bàn giao slice docs) |

### Reservation kỹ thuật giữ nguyên khi implement

- **D1**: golden là test cơ học (dedup + công thức + số event), **không phải oracle số tiền thật**; Q2 vẫn mở, không assert 2.450.
- **D3**: auditor không tự re-probe container; kết luận DNSE account-scoped dựa trên lệnh probe có trong evidence §2.
- **D4**: đường có `id` đúng (probe 9/9 dòng); mọi rủi ro nằm ở đường fallback đã được siết ở R3–R5. VCI `id` là khóa chính.

**Gate B3→B4: ĐÓNG (AGREE).** Có thể khai claim + branch `feat/corporate-actions` theo 9 bước workflow-dev-loop, subagent-driven.
