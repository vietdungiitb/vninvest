# Technical Diagrams Index

Tai lieu chi muc de tai su dung cac so do ky thuat.

## Danh sach so do

1. Backend Technical Diagram - Level 2
- File: docs/BACKEND_TECHNICAL_DIAGRAM_L2.md
- Muc dich: Tong quan container/service decomposition + realtime flow.

2. Backend Technical Diagram - Level 2.1
- File: docs/BACKEND_TECHNICAL_DIAGRAM_L2_1.md
- Muc dich: Bieu do chi tiet theo route/endpoint hien dang co trong codebase.

3. Backend Technical Diagram - Level 2.2 (Target State)
- File: docs/BACKEND_TECHNICAL_DIAGRAM_L2_2.md
- Muc dich: Bieu do to-be cho chuan hoa namespace va pipeline realtime.

4. Implementation Playbook (L2.1 -> L2.2)
- File: docs/IMPLEMENTATION_PLAYBOOK_L2_1_TO_L2_2.md
- Muc dich: Ke hoach thuc thi chi tiet theo phase, test, release, rollback.

5. Execution Plan - Next 4 Weeks
- File: docs/EXECUTION_PLAN_NEXT_4_WEEKS.md
- Muc dich: Ke hoach theo tuan/ngay co owner, deliverable, KPI de chay ngay.

6. Sprint 7 Taskboard (CSV)
- File: docs/TASKBOARD_SPRINT7.csv
- Muc dich: Import truc tiep vao Jira/Trello/Notion va theo doi status.

7. Sprint 10 Detailed Plan
- File: docs/SPRINT10_DETAILED_PLAN.md
- Muc dich: Ke hoach chi tiet theo ngay, DoD, KPI cho realtime WebSocket pipeline.

8. WebSocket Event Contract
- File: docs/WEBSOCKET_EVENT_CONTRACT.md
- Muc dich: Contract payload/channel/auth de BE-FE code dong bo.

9. Sprint 10 Taskboard (CSV)
- File: docs/TASKBOARD_SPRINT10.csv
- Muc dich: Import Jira/Trello/Notion va tracking task theo owner/dependency.

10. Sprint 10 Acceptance Checklist
- File: docs/SPRINT10_ACCEPTANCE_CHECKLIST.md
- Muc dich: Checklist nghiem thu va release sign-off cuoi sprint.

11. VNBroker Throughput Runtime Guide
- File: docs/VNBROKER_THROUGHPUT_RUNTIME_GUIDE.md
- Muc dich: Mo ta runtime throughput moi cua vnbroker, Celery prefetch, Redis cache, benchmark va checklist su co.

## Huong dan cap nhat

- Khi thay doi URL namespace, cap nhat Level 2.1 truoc.
- Khi thay doi kien truc (them worker, cache, service), cap nhat Level 2.
- Moi PR thay doi architecture phai kem ghi chu cap nhat 1 trong 2 so do.
- Khi thay doi quy uoc sync endpoint, cap nhat them docs/ADMIN_SYNC_MIGRATION_STEPS.md.
