# PREFETCH TIME POLICY - EXECUTION BOARD (2026-04-12)

## Muc tieu board

Bien ke hoach thanh cac cong viec co the giao ngay theo PR nho, co owner, output va tieu chi done ro rang.

---

## Sprint scope (de xuat 10 ngay)

- Sprint start: 2026-04-13
- Sprint end: 2026-04-22
- Scope: Backend + Admin Frontend cho time-based query throttling.
- Out of scope: auto-tune bang ML, dashboard phuc tap ngoai cac metric can ban.

---

## Workstream A - Backend Policy Core

### A1. Tao schema + validator cho prefetch_time_policy
- Muc tieu: co bo validate nhat quan cho profile theo khung gio.
- Files chinh:
  - backend/portfolio/views.py
  - backend/portfolio/tasks.py
- Cong viec:
  - Them default policy object.
  - Them ham coerce/validate policy payload.
  - Them rulebook tra ve cho frontend.
- Acceptance:
  - PUT payload sai tra 400 + field errors.
  - GET luon tra policy hop le va rulebook.
- Uoc luong: 1 ngay.
- Owner de xuat: BE-1.

### A2. Runtime store + fallback strategy
- Muc tieu: policy chay runtime, khong can restart.
- Cong viec:
  - Store policy trong cache key rieng.
  - Neu cache miss/corrupt thi fallback default env-safe.
- Acceptance:
  - He thong khong crash khi cache du lieu hong.
  - Co log canh bao khi fallback.
- Uoc luong: 0.5 ngay.
- Owner de xuat: BE-1.

### A3. Profile resolver theo thoi gian
- Muc tieu: xac dinh profile dang active (pre_open, market_open, lunch_break, pre_close, post_close, offhours).
- Cong viec:
  - Resolver theo timezone policy.
  - Ho tro pre_open 30p va post_close 30p.
  - Ho tro weekend -> offhours.
- Acceptance:
  - Test pass cho cac moc gio bien.
  - Ket qua resolver on dinh voi timezone Asia/Ho_Chi_Minh.
- Uoc luong: 1 ngay.
- Owner de xuat: BE-2.

### A4. Tich hop vao prefetch task
- Muc tieu: prefetch ap profile runtime truoc moi lan query.
- Cong viec:
  - Neu profile query_enabled = false thi skip goi upstream.
  - Neu enabled thi override interval, batch_size, symbol_limit, max_retries.
- Acceptance:
  - Metadata co profile active.
  - Luong skip co status throttled_by_policy.
- Uoc luong: 1 ngay.
- Owner de xuat: BE-2.

### A5. Guard 429 + interval multiplier
- Muc tieu: giam rung lac khi upstream tra 429.
- Cong viec:
  - Apply cooldown_multiplier_on_429.
  - Clamp boi max_interval_seconds.
- Acceptance:
  - Co metric dem so lan multiplier duoc ap dung.
  - Khong vuot max interval.
- Uoc luong: 0.5 ngay.
- Owner de xuat: BE-2.

---

## Workstream B - Admin Settings API

### B1. Mo rong admin settings endpoint
- Muc tieu: GET/PUT prefetch_time_policy thong qua endpoint settings hien co.
- Cong viec:
  - Bo sung truong prefetch_time_policy.
  - Bo sung prefetch_time_policy_rulebook.
- Acceptance:
  - Backward compatible voi schema cu.
  - FE co du data de render form.
- Uoc luong: 0.5 ngay.
- Owner de xuat: BE-1.

### B2. Audit log cho thay doi policy
- Muc tieu: truy vet ai doi policy va doi cai gi.
- Cong viec:
  - Log actor + timestamp + diff summary.
- Acceptance:
  - Moi lan update co 1 log entry day du.
- Uoc luong: 0.5 ngay.
- Owner de xuat: BE-1.

---

## Workstream C - Frontend AdminOps

### C1. UI form policy khung gio
- Muc tieu: cho admin cau hinh market window + profile params.
- Files chinh:
  - frontend/src/pages/AdminOps.jsx
  - frontend/src/api/client.js
  - frontend/src/i18n/vi.js
  - frontend/src/i18n/en.js
- Cong viec:
  - Render section Prefetch Time-based Query Policy.
  - Field group cho market/lunch/profiles/rate-limit guard.
- Acceptance:
  - Load data GET settings thanh cong.
  - UI hien thi ro profile data.
- Uoc luong: 1.5 ngay.
- Owner de xuat: FE-1.

### C2. Validation + save flow
- Muc tieu: ngan payload sai ngay tren FE, giam sai sot thao tac.
- Cong viec:
  - Client-side validation cho cac range.
  - Hien thong bao loi theo field.
  - Save success/failure toast.
- Acceptance:
  - Payload sai khong gui len server.
  - Loi server map dung vao message.
- Uoc luong: 1 ngay.
- Owner de xuat: FE-1.

### C3. Active profile preview
- Muc tieu: admin nhin thay profile dang active ngay tai thoi diem hien tai.
- Cong viec:
  - Hien profile name + query_enabled + effective interval.
  - Hien ly do (window match).
- Acceptance:
  - Preview cap nhat dung theo data health/settings response.
- Uoc luong: 0.5 ngay.
- Owner de xuat: FE-2.

---

## Workstream D - Observability va QA

### D1. Metrics
- Muc tieu: theo doi tac dong sau rollout.
- Cong viec:
  - Bo sung counters:
    - prefetch_policy_profile_hits_total{profile}
    - prefetch_policy_skip_total
    - prefetch_policy_429_multiplier_total
  - Bo sung gauge:
    - prefetch_policy_effective_interval_seconds
- Acceptance:
  - Metric xuat hien trong stack monitor.
- Uoc luong: 0.5 ngay.
- Owner de xuat: BE-OBS.

### D2. Test matrix
- Muc tieu: bao phu edge case quan trong.
- Cong viec:
  - Unit test resolver theo moc gio bien.
  - Integration test PUT/GET settings.
  - FE test validation va save flow.
  - Manual test truoc mo cua 30p, sau dong cua 30p, weekend.
- Acceptance:
  - Test checklist dat >= 95% case critical.
- Uoc luong: 1 ngay.
- Owner de xuat: QA-1 + FE-1 + BE-2.

---

## PR slicing de xuat

1. PR-1: Backend schema + validator + settings API extension.
2. PR-2: Resolver + task integration + metadata policy.
3. PR-3: Guard 429 multiplier + observability metrics.
4. PR-4: AdminOps UI form + i18n.
5. PR-5: FE validation + save flow + preview.
6. PR-6: Test suite + docs update + rollout guide.

Moi PR gioi han trong 300-500 dong thay doi thuan logic de de review.

---

## Dependency map

- PR-2 phu thuoc PR-1.
- PR-3 phu thuoc PR-2.
- PR-4 co the bat dau song song sau PR-1.
- PR-5 phu thuoc PR-4 va 1 phan PR-2 (preview payload).
- PR-6 chot sau khi PR-1..PR-5 merge.

---

## Risk gate truoc production

- Gate 1: Smoke test tren dev stack pass.
- Gate 2: So sanh rate 429 truoc/sau tren canary.
- Gate 3: Xac nhan khong giam freshness qua nguong trong market_open.
- Gate 4: Rollback script/policy default san sang.

---

## Rollout checklist

1. Merge PR-1..PR-3, deploy canary backend.
2. Bat metrics dashboard co ban.
3. Merge PR-4..PR-5, deploy admin frontend.
4. Cau hinh policy ban dau theo profile safe.
5. Theo doi 24-48h, neu on dinh thi rollout full.
6. Cap nhat changelog va tai lieu van hanh.

---

## Definition of Done cho board

- [x] Day du logic PR-1..PR-5 da implement va cap nhat changelog.
- [x] Admin co the cau hinh va preview policy tren AdminOps.
- [x] Prefetch ap profile theo khung gio, gom pre_open/post_close.
- [-] Metric baseline truoc/sau canary: cho thu thap trong rollout gate.
- [ ] Rollback drill tren canary: chua thuc hien.

Trang thai thuc te 2026-04-12:
- PR-1: done (API + validator + rulebook + tests).
- PR-2: done (resolver + task integration + policy metadata + tests).
- PR-3: done (provider fallback + 429 multiplier + policy counters + tests).
- PR-4: done (AdminOps form + API client + i18n).
- PR-5: done (advanced FE validation + field error mapping + reset UX).
- PR-6: done (evidence/docs closure + test runs). Chi tiet: docs/PREFETCH_TIME_POLICY_PR6_EVIDENCE_20260412.md

---

## Live tracker lien quan

- Master index:
  - docs/PREFETCH_TIME_POLICY_MASTER_INDEX_20260412.md
- Kickoff playbook:
  - docs/PREFETCH_TIME_POLICY_KICKOFF_PLAYBOOK_20260412.md
- Task tracker cap nhat hang ngay:
  - docs/PREFETCH_TIME_POLICY_TASK_TRACKER_20260412.md
- PR checklist templates:
  - docs/PREFETCH_TIME_POLICY_PR_CHECKLISTS_20260412.md
- Release gates checklist:
  - docs/PREFETCH_TIME_POLICY_RELEASE_GATES_20260412.md
