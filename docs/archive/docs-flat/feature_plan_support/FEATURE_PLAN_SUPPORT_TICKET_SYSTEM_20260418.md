# Kế hoạch Triển khai Chi tiết: Support Ticket System (Ready for Dev)

Phiên bản: 2.0  
Ngày cập nhật: 2026-04-18  
Mục tiêu: Tài liệu này là blueprint triển khai hoàn chỉnh cho đội Backend, Frontend, QA, DevOps. Đội có thể bắt đầu code ngay mà không cần làm rõ thêm phạm vi nghiệp vụ.

---

## 0. Liên kết làm việc nhanh (1-click)

Mục này gom các file đang tồn tại để đội mở nhanh đúng điểm vào trước khi tạo module `support`.

### 0.1 Backend entry points
- URL root: [backend/config/urls.py](../backend/config/urls.py)
- Portfolio URL pattern tham chiếu: [backend/portfolio/urls.py](../backend/portfolio/urls.py)
- Portfolio models tham chiếu: [backend/portfolio/models.py](../backend/portfolio/models.py)
- Portfolio views tham chiếu: [backend/portfolio/views.py](../backend/portfolio/views.py)
- Test API route mẫu: [backend/portfolio/tests/test_api_routes.py](../backend/portfolio/tests/test_api_routes.py)

### 0.2 Frontend entry points
- API client hiện tại: [frontend/src/api/client.js](../frontend/src/api/client.js)
- Context danh mục: [frontend/src/context/PortfolioContext.jsx](../frontend/src/context/PortfolioContext.jsx)
- Context i18n: [frontend/src/context/LangContext.jsx](../frontend/src/context/LangContext.jsx)
- Sidebar để gắn menu Support: [frontend/src/components/Sidebar.jsx](../frontend/src/components/Sidebar.jsx)
- Màn hình pattern tham chiếu: [frontend/src/pages/Transactions.jsx](../frontend/src/pages/Transactions.jsx)
- Màn hình pattern tham chiếu: [frontend/src/pages/PortfolioManagement.jsx](../frontend/src/pages/PortfolioManagement.jsx)

### 0.3 Docs/Ops tham chiếu
- Runbook release tham chiếu: [docs/SPRINT33_RELEASE_RUNBOOK.md](../../../SPRINT33_RELEASE_RUNBOOK.md)
- Runbook rollback tham chiếu: [docs/SPRINT27_ROLLBACK_RUNBOOK.md](../../../SPRINT27_ROLLBACK_RUNBOOK.md)
- Audit ledger: [docs/CODE_CHANGE_AUDIT_LEDGER.md](../../../CODE_CHANGE_AUDIT_LEDGER.md)
- Progress dashboard: [PROGRESS_DASHBOARD.md](../../../../PROGRESS_DASHBOARD.md)

### 0.4 File sẽ được tạo trong feature này
- Backend: `backend/support/*`
- Frontend: `frontend/src/pages/Support.jsx`, `frontend/src/components/support/*`, `frontend/src/api/support.js`
- Tests: `backend/tests/test_support_api.py`, `frontend/src/pages/__tests__/Support.test.jsx`

## 1. Mục tiêu và phạm vi

### 1.1 Mục tiêu kinh doanh
- Tạo kênh hỗ trợ tập trung trong sản phẩm, thay cho việc nhận yêu cầu rời rạc qua email/chat.
- Rút ngắn thời gian phản hồi đầu tiên (first response time).
- Theo dõi được hiệu suất hỗ trợ theo SLA.

### 1.2 Phạm vi phiên bản V1
- Người dùng tạo ticket, xem danh sách ticket của chính mình, phản hồi vào thread.
- Staff xử lý ticket, đổi trạng thái, ưu tiên, gán người phụ trách.
- Gửi thông báo email bất đồng bộ.
- Hỗ trợ đính kèm file an toàn.
- Dashboard vận hành cơ bản cho team support.

### 1.3 Ngoài phạm vi V1
- Live chat realtime qua websocket.
- Tích hợp bên thứ ba (Zendesk/Freshdesk).
- Bot tự động phân loại ticket bằng AI.

---

## 2. Kiến trúc tổng thể

### 2.1 Backend
- Tạo Django app mới: `support`.
- DRF cung cấp API cho user và staff.
- Sử dụng Celery để gửi email và tác vụ nền.
- Lưu file đính kèm vào storage private.

### 2.2 Frontend
- Trang mới: `/support`.
- Mô hình 2 cột: trái danh sách ticket, phải chi tiết thread/tạo mới.
- Dùng API polling nhẹ theo action người dùng, không cần realtime socket cho V1.

### 2.3 Quan sát vận hành
- Ghi metric: open count, first response, resolution time, SLA breach.
- Ghi audit log mọi thay đổi trạng thái/priorities/assignee.

---

## 3. Thiết kế dữ liệu (DB Schema)

### 3.1 Model `SupportTicket`

| Trường | Kiểu | Bắt buộc | Mô tả |
| :--- | :--- | :---: | :--- |
| `id` | UUIDField | Yes | PK nội bộ |
| `ticket_code` | CharField(24), unique, indexed | Yes | Mã hiển thị dạng `VNST-20260418-000123` |
| `requester` | FK -> User, indexed | Yes | Người tạo ticket |
| `subject` | CharField(255) | Yes | Tiêu đề |
| `category` | CharField(choice), indexed | Yes | `TECHNICAL`, `ACCOUNT`, `BILLING`, `FEATURE_REQUEST`, `OTHER` |
| `priority` | CharField(choice), indexed | Yes | `LOW`, `MEDIUM`, `HIGH`, `URGENT` |
| `status` | CharField(choice), indexed | Yes | `OPEN`, `IN_PROGRESS`, `RESOLVED`, `CLOSED`, `REOPENED` |
| `assignee` | FK -> User, null=True, indexed | No | Staff đang xử lý |
| `first_response_at` | DateTimeField, null=True | No | Mốc phản hồi đầu tiên từ staff |
| `resolved_at` | DateTimeField, null=True | No | Mốc resolve |
| `closed_at` | DateTimeField, null=True | No | Mốc đóng ticket |
| `last_message_at` | DateTimeField, indexed | Yes | Mốc tin nhắn cuối |
| `last_message_by_staff` | BooleanField | Yes | Tin nhắn cuối từ staff hay user |
| `created_at` | DateTimeField, indexed | Yes | Auto now add |
| `updated_at` | DateTimeField | Yes | Auto now |

Ràng buộc:
- Index tổng hợp: `(requester_id, status, updated_at desc)`.
- Index tổng hợp staff queue: `(status, priority, updated_at desc)`.

### 3.2 Model `TicketMessage`

| Trường | Kiểu | Bắt buộc | Mô tả |
| :--- | :--- | :---: | :--- |
| `id` | UUIDField | Yes | PK |
| `ticket` | FK -> SupportTicket, indexed | Yes | Ticket cha |
| `sender` | FK -> User, indexed | Yes | Người gửi |
| `sender_role` | CharField(choice) | Yes | `USER`, `STAFF`, `SYSTEM` |
| `body` | TextField | Yes | Nội dung tin nhắn |
| `created_at` | DateTimeField, indexed | Yes | Auto now add |

### 3.3 Model `TicketAttachment`

| Trường | Kiểu | Bắt buộc | Mô tả |
| :--- | :--- | :---: | :--- |
| `id` | UUIDField | Yes | PK |
| `message` | FK -> TicketMessage, indexed | Yes | Liên kết message |
| `file` | FileField(private path) | Yes | File đính kèm |
| `original_name` | CharField(255) | Yes | Tên file gốc |
| `mime_type` | CharField(128) | Yes | MIME thực tế |
| `size_bytes` | BigIntegerField | Yes | Kích thước |
| `sha256` | CharField(64), indexed | Yes | Hash nội dung |
| `is_safe` | BooleanField | Yes | Kết quả scan bảo mật |
| `created_at` | DateTimeField | Yes | Auto now add |

### 3.4 Model `TicketAuditLog`

| Trường | Kiểu | Mô tả |
| :--- | :--- | :--- |
| `ticket` | FK -> SupportTicket | Ticket liên quan |
| `actor` | FK -> User, null=True | Ai thao tác |
| `action` | CharField | `STATUS_CHANGED`, `ASSIGNEE_CHANGED`, `PRIORITY_CHANGED`, `CREATED`, `REOPENED` |
| `old_value` | JSONField | Giá trị cũ |
| `new_value` | JSONField | Giá trị mới |
| `created_at` | DateTimeField | Mốc ghi nhận |

---

## 4. State machine và quy tắc nghiệp vụ

### 4.1 Trạng thái
- `OPEN`: Ticket mới tạo, chưa staff nhận xử lý.
- `IN_PROGRESS`: Staff đã nhận và đang xử lý.
- `RESOLVED`: Staff xác nhận đã xử lý xong.
- `CLOSED`: Ticket kết thúc chính thức.
- `REOPENED`: User mở lại sau khi `RESOLVED` hoặc `CLOSED`.

### 4.2 Chuyển trạng thái hợp lệ

| From | To | Ai được phép |
| :--- | :--- | :--- |
| OPEN | IN_PROGRESS | STAFF |
| OPEN | CLOSED | STAFF (trường hợp spam/invalid) |
| IN_PROGRESS | RESOLVED | STAFF |
| IN_PROGRESS | CLOSED | STAFF |
| RESOLVED | CLOSED | STAFF hoặc USER |
| RESOLVED | REOPENED | USER hoặc STAFF |
| CLOSED | REOPENED | STAFF |
| REOPENED | IN_PROGRESS | STAFF |
| REOPENED | CLOSED | STAFF |

Quy tắc bổ sung:
- Khi ticket có message từ user và status đang `RESOLVED` thì tự chuyển `REOPENED`.
- Khi staff gửi phản hồi đầu tiên thì set `first_response_at` nếu chưa có.

---

## 5. Permission matrix

| Action | User thường | Staff | Admin |
| :--- | :---: | :---: | :---: |
| Tạo ticket | Yes | Yes | Yes |
| Xem ticket của mình | Yes | Yes | Yes |
| Xem ticket người khác | No | Yes | Yes |
| Reply ticket của mình | Yes (trừ CLOSED) | Yes | Yes |
| Đổi status | No | Yes | Yes |
| Đổi priority | No | Yes | Yes |
| Gán assignee | No | Yes | Yes |
| Đóng ticket cưỡng bức | No | Yes | Yes |

---

## 6. API contract (DRF)

Tiền tố API: `/api/support`

### 6.1 User endpoints

1) `GET /api/support/tickets/`
- Query params: `page`, `page_size`, `status`, `category`, `q`, `ordering`.
- Ordering mặc định: `-updated_at`.

2) `POST /api/support/tickets/`
- Payload:
```json
{
  "subject": "Không tải được dữ liệu danh mục",
  "category": "TECHNICAL",
  "priority": "MEDIUM",
  "body": "Chi tiết lỗi...",
  "attachments": []
}
```

3) `GET /api/support/tickets/{ticket_id}/`
- Trả metadata ticket + thread phân trang.

4) `POST /api/support/tickets/{ticket_id}/reply/`
- Payload: `body`, `attachments`.
- Reject nếu status `CLOSED` và requester không có quyền reopen.

5) `POST /api/support/tickets/{ticket_id}/reopen/`
- Chỉ owner ticket và staff.

### 6.2 Staff endpoints

1) `GET /api/support/staff/tickets/`
- Queue toàn hệ thống cho staff.

2) `PATCH /api/support/staff/tickets/{ticket_id}/`
- Payload hỗ trợ: `status`, `priority`, `assignee_id`.

3) `POST /api/support/staff/tickets/{ticket_id}/reply/`
- Reply với vai trò staff.

### 6.3 Quy ước response lỗi
- `400`: Payload/transition invalid.
- `403`: Không đủ quyền.
- `404`: Ticket không tồn tại hoặc không thuộc phạm vi truy cập.
- `409`: Conflict transition (ví dụ trạng thái thay đổi đồng thời).
- `429`: Vượt rate limit.

---

## 7. Validation và chống lạm dụng

### 7.1 Rate limit
- Tạo ticket: 5 request/giờ/user.
- Reply ticket: 30 request/giờ/user.

### 7.2 Field validation
- `subject`: 10-255 ký tự.
- `body`: tối thiểu 20 ký tự cho create, tối thiểu 2 ký tự cho reply.

### 7.3 Attachment policy
- Định dạng cho phép: `jpg`, `jpeg`, `png`, `pdf`, `txt`, `csv`.
- Kích thước tối đa: 5MB/file, 3 file/message, 15MB/message.
- Kiểm MIME thật, không tin extension.
- Tên file lưu random UUID, tránh path traversal.
- Quét an toàn trước khi đánh dấu `is_safe=true`.

---

## 8. Notifications

### 8.1 Nguyên tắc
- Gửi email qua Celery task, không gửi đồng bộ trong request.
- Có retry và idempotency key để tránh gửi trùng.

### 8.2 Trigger email
- New ticket: gửi cho nhóm support.
- Staff reply: gửi cho requester.
- Ticket resolved/closed: gửi cho requester.
- Ticket reopened: gửi cho assignee/team support.

### 8.3 Deep link
- Dùng URL: `/support?ticket=<ticket_code>`.

---

## 9. Frontend implementation detail

### 9.1 Route và trang
- Route: `/support`.
- Page chính: `frontend/src/pages/Support.jsx`.

### 9.2 Cấu trúc component
- `SupportTicketList`
- `SupportTicketFilters`
- `TicketThread`
- `TicketComposer`
- `TicketCreationForm`
- `TicketMetaPanel`

### 9.3 Luồng UX
- Nếu user chưa có ticket: hiển thị empty state + CTA tạo ticket.
- Khi chọn ticket: load thread, auto-scroll xuống message mới nhất.
- Reply thành công: append optimistic message, sau đó sync lại từ server.

### 9.4 i18n
- Tất cả text mới bắt buộc có key tiếng Việt đầy đủ dấu.
- Ưu tiên key namespace: `support.*`.

---

## 10. Observability và SLA

### 10.1 Metrics bắt buộc
- `support_ticket_created_total`
- `support_ticket_replied_total`
- `support_ticket_open_total`
- `support_ticket_first_response_seconds`
- `support_ticket_resolution_seconds`
- `support_ticket_sla_breach_total`

### 10.2 SLA V1
- First response p95 <= 8 giờ làm việc.
- Resolution p95 <= 72 giờ với priority `MEDIUM`.
- Ticket `URGENT` phải có first response <= 2 giờ.

### 10.3 Alerting
- Cảnh báo khi `sla_breach_total` tăng liên tục 15 phút.
- Cảnh báo khi queue `OPEN + REOPENED` vượt ngưỡng 200 ticket.

---

## 11. Kế hoạch triển khai theo sprint

### Sprint 1: Backend foundation (3-4 ngày)
- Tạo app `support`, models, migrations.
- CRUD API user + staff cơ bản.
- Permission + state transition validator.

### Sprint 2: Frontend + integration (3-4 ngày)
- Trang `/support`, list/detail/reply/create.
- Hook API client + loading/error/empty states.

### Sprint 3: Hardening (2-3 ngày)
- Email async, attachment security, audit logs.
- Metrics + dashboard + alert rule.
- E2E + regression + performance smoke.

---

## 12. Test plan và Definition of Done

### 12.1 Backend tests
- Model constraints + state transition tests.
- Permission tests theo matrix.
- API tests: list/create/detail/reply/patch/reopen.
- Rate limit tests.

### 12.2 Frontend tests
- Render list và thread đúng dữ liệu.
- Form validation hiển thị lỗi rõ ràng.
- Flow create ticket và reply thành công.

### 12.3 E2E tests
- User tạo ticket -> staff nhận -> staff resolve -> user reopen -> staff close.
- Có attachment hợp lệ và attachment bị chặn.

### 12.4 DoD
- Toàn bộ API contract hoạt động đúng.
- UI hoàn chỉnh luồng user và staff.
- Không có bug blocker mức P0/P1.
- Có tài liệu vận hành và runbook xử lý sự cố.

---

## 13. Rollout và rollback

### 13.1 Rollout
- Bật feature flag `support_ticket_v1` cho nội bộ staff trước.
- Canary 10% user trong 24 giờ.
- Mở 100% nếu không có regression.

### 13.2 Rollback
- Tắt feature flag để ẩn UI ngay.
- API giữ read-only nếu cần bảo toàn dữ liệu.
- Queue email có thể drain hoặc drop theo policy.

---

## 14. Checklist bàn giao cho đội lập trình

- [ ] Chốt schema models + migration review.
- [ ] Chốt permission matrix với Product + Ops.
- [ ] Chốt API contract (OpenAPI/Swagger).
- [ ] Hoàn tất backend unit tests.
- [ ] Hoàn tất frontend integration tests.
- [ ] Hoàn tất e2e test flow chính.
- [ ] Hoàn tất dashboard metrics + alert.
- [ ] Hoàn tất runbook vận hành.

---

## 15. Danh sách file dự kiến tạo/sửa

Backend:
- `backend/support/models.py`
- `backend/support/serializers.py`
- `backend/support/views.py`
- `backend/support/permissions.py`
- `backend/support/services.py`
- `backend/support/tasks.py`
- `backend/support/urls.py`
- `backend/config/urls.py`

Frontend:
- `frontend/src/pages/Support.jsx`
- `frontend/src/components/support/SupportTicketList.jsx`
- `frontend/src/components/support/TicketThread.jsx`
- `frontend/src/components/support/TicketCreationForm.jsx`
- `frontend/src/components/support/TicketComposer.jsx`
- `frontend/src/api/support.js`
- `frontend/src/i18n/*` (thêm key `support.*`)

QA/Docs:
- `backend/tests/test_support_api.py`
- `frontend/src/pages/__tests__/Support.test.jsx`
- `docs/SUPPORT_TICKET_RUNBOOK.md`

---

## 16. Ticket-ready Execution Board theo vai trò

### 16.1 Backend Engineer A (Data + API core)
- [ ] Tạo app và models `SupportTicket`, `TicketMessage`, `TicketAttachment`, `TicketAuditLog`.
- [ ] Viết migrations và index theo Section 3.
- [ ] Tạo serializer/viewset cho user endpoints (Section 6.1).
- [ ] Cập nhật router tại [backend/config/urls.py](../backend/config/urls.py).

Deliverable:
- PR-1: Schema + user API + tests model/API cơ bản.

### 16.2 Backend Engineer B (Workflow + staff + hardening)
- [ ] Implement validator state transition (Section 4).
- [ ] Implement staff endpoints (Section 6.2) + permission matrix (Section 5).
- [ ] Implement rate limit + attachment policy + audit log.
- [ ] Tích hợp Celery notifications.

Deliverable:
- PR-2: Staff workflow + security + async notification.

### 16.3 Frontend Engineer
- [ ] Tạo [frontend/src/pages/Support.jsx](../frontend/src/pages/Support.jsx) theo layout 2 cột.
- [ ] Tạo `api/support.js` dựa trên style của [frontend/src/api/client.js](../frontend/src/api/client.js).
- [ ] Tạo components `SupportTicketList`, `TicketThread`, `TicketComposer`, `TicketCreationForm`.
- [ ] Gắn menu Support vào [frontend/src/components/Sidebar.jsx](../frontend/src/components/Sidebar.jsx).
- [ ] Bổ sung i18n key `support.*` và đảm bảo tiếng Việt đầy đủ dấu.

Deliverable:
- PR-3: UI hoàn chỉnh create/list/detail/reply + empty/loading/error states.

### 16.4 QA Engineer
- [ ] Viết test API flow end-to-end theo Section 12.3.
- [ ] Viết test UI flow create/reply/reopen.
- [ ] Verify permission negative cases (403/404/409/429).
- [ ] Verify attachment constraints và security edge cases.

Deliverable:
- PR-4: Test report + regression checklist + evidence.

### 16.5 DevOps/Ops
- [ ] Bổ sung metrics + alert rules theo Section 10.
- [ ] Chuẩn hóa dashboard hỗ trợ SLA.
- [ ] Soạn runbook vận hành + rollback cho ticket service.

Deliverable:
- PR-5: Monitoring + runbook + release checklist.

### 16.6 Cột mốc tích hợp
- M1: Backend core merge (PR-1) -> Frontend mock integration bắt đầu.
- M2: Workflow + security merge (PR-2) -> QA bắt đầu test chính thức.
- M3: Frontend merge (PR-3) -> E2E full flow.
- M4: QA + Ops merge (PR-4, PR-5) -> Go/No-Go.

---

Tài liệu này là nguồn chuẩn để đội bắt đầu triển khai ngay. Mọi thay đổi phạm vi sau tài liệu này phải được cập nhật lại tại chính file này trước khi code.
