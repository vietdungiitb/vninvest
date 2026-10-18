# AI R5.2 — Sửa path `ops_audit`: nhóm `ai_agents` chưa bao giờ được ghi

**Claim**: `ai-r52` · **Nhánh**: `fix/ai-r52-ops-audit-group` → `dev` · **Ngày**: 2026-10-18
**Plan**: `docs/IMPLEMENTATION_PLAN_AI_COMMAND_CENTER_COMMERCIAL_20260925.md:1274-1277`

## Lỗi thật — không chỉ sai chuỗi, mà **nhánh chết**

1. Route **thật** là `/core/v1/ai/agents/` (`ai_agents/urls.py:6`), còn bảng map khai
   `/core/v1/ai-agents/` — **không tồn tại** route nào như vậy.
2. Tệ hơn: prefix tổng quát `'/core/v1/ai/'` nằm ở dòng **135**, **trước** dòng 140.
   `dict` giữ thứ tự chèn và vòng lặp dùng `startswith` theo thứ tự đó ⇒ request thật
   khớp generic và bị ghi nhóm **`ai`**. Nhánh `ai_agents` **chưa bao giờ chạy**.
3. Nghĩa là audit trail **chưa bao giờ** ghi `ai_agents` — đúng thứ AC của R5.2 đòi.

Cách sửa: đặt prefix **cụ thể hơn lên trước** prefix tổng quát. Không phải đổi chuỗi
rồi hy vọng thứ tự dict.

## Bẫy trong test của chính tôi

Bản đầu `test_stale_prefix_is_gone` **assert ngược lại với docstring của nó**: docstring
viết *"đừng giữ để trông có map"* còn assert lại bảo `/core/v1/ai-agents/` → `ai_agents`.
Hậu quả nếu giữ: dòng chết được **test bảo vệ**, nên bug quay lại mà không ai thấy — tức là
test tạo ra chính cái rào cản nó nên chặn. Đã sửa thành `other` (đường dẫn không phải
route ⇒ rơi về `other` là đúng).

## Gates

| Gate | Kết quả |
|---|---|
| BE mới `tests.test_ops_audit_endpoint_group` | **4/4 OK** (fail-before: `'ai' != 'ai_agents'`) |
| BE hồi quy 48 module (AI + advisory + ops_audit usage) | **588 test — 587 OK** |

Lỗi còn lại: `test_dead_models_absent_from_frontend_catalogue` — cây test BE chỉ mount
`packages/core/backend`, không có `packages/web` để đọc `providerModels.ts`; đã tái hiện ở
R4.1 trên `/opt/vninvest` ⇒ môi trường, không phải hồi quy.

## Còn mở

- Chưa đo **trên dữ liệu thật**: AC nói "audit trail ghi `ai_agents` cho request thật".
  Test hiện gọi thẳng `_endpoint_group`; để chứng minh end-to-end cần một request HTTP
  thật tới `/core/v1/ai/agents/` rồi đọc rollup — staging không có dữ liệu audit nên
  **CHƯA CHẠY** phần đó.
- Nhóm `ai_agents` giờ trả về 0 dòng cho dữ liệu **lịch sử** đã ghi nhầm `ai`; cần quyết
  định riêng có backfill lịch sử hay không (không tự làm — sửa dữ liệu lịch sử là việc
  cần Owner duyệt).
- **R5.1** (quyết định số phận `AgentRegistry`) chưa làm — đo đạt cho thấy nghiêng về
  phương án **B (gỡ)**, nhưng đó là xoá tính năng người dùng nên **chờ Owner duyệt**.