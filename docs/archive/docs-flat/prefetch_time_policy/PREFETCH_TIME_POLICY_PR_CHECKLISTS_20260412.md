# PREFETCH TIME POLICY - PR CHECKLISTS (2026-04-12)

## Huong dan su dung

- Moi PR chon dung template ben duoi, copy vao mo ta PR.
- Reviewer chi merge khi tat ca muc critical da `[x]`.
- Neu co scope phat sinh, bat buoc them muc "Scope change" trong PR.

---

## Template cho PR-1 (Backend schema + validator + settings API)

### 1) Scope
- [ ] Chi thay doi phan schema/validator/settings API.
- [ ] Khong chen logic scheduling/task vao PR nay.

### 2) Functional checklist
- [ ] Co default `prefetch_time_policy` an toan.
- [ ] Co validation day du cho timezone/time window/range.
- [ ] GET admin settings tra `prefetch_time_policy`.
- [ ] PUT admin settings cap nhat `prefetch_time_policy`.
- [ ] Co `prefetch_time_policy_rulebook` cho frontend.

### 3) Backward compatibility
- [ ] Khong pha schema settings hien tai.
- [ ] Client cu van doc duoc response.

### 4) Tests
- [ ] Unit test validate payload hop le.
- [ ] Unit test payload khong hop le tra 400.
- [ ] Integration test GET/PUT settings pass.

### 5) Observability & logs
- [ ] Co warning log khi fallback default do payload/cache loi.

### 6) Review gates
- [ ] Da cap nhat docs lien quan.
- [ ] Da cap nhat changelog neu can.

---

## Template cho PR-2 (Resolver + task integration + metadata)

### 1) Scope
- [ ] Chi thay doi resolver profile + integration vao prefetch task.
- [ ] Khong thay doi API contract khac scope.

### 2) Functional checklist
- [ ] Resolve dung profile: pre_open / market_open / lunch_break / pre_close / post_close / offhours.
- [ ] Ho tro pre_open 30p va post_close 30p.
- [ ] Neu `query_enabled=false` thi skip query upstream.
- [ ] Neu enabled thi ap dung effective interval/batch/symbol/retries.
- [ ] Health metadata co profile + reason.

### 3) Safety
- [ ] Loi resolver khong lam crash task (co fallback).
- [ ] Timezone duoc xu ly explicit.

### 4) Tests
- [ ] Unit test cac moc gio bien.
- [ ] Integration test metadata xuat hien trong health payload.

### 5) Review gates
- [ ] Kiem tra khong tang query dot bien trong market_open.

---

## Template cho PR-3 (Guard 429 + metrics)

### 1) Scope
- [ ] Chi thay doi 429 guard va metrics.

### 2) Functional checklist
- [ ] Apply `cooldown_multiplier_on_429`.
- [ ] Clamp boi `max_interval_seconds`.
- [ ] Khong lam thay doi hanh vi khi khong gap 429.

### 3) Metrics checklist
- [ ] `prefetch_policy_profile_hits_total{profile}`
- [ ] `prefetch_policy_skip_total`
- [ ] `prefetch_policy_429_multiplier_total`
- [ ] `prefetch_policy_effective_interval_seconds`

### 4) Tests
- [ ] Co test khi gap 429 -> interval tang dung.
- [ ] Co test clamp max interval.

### 5) Review gates
- [ ] Metric names/labels thong nhat convention hien co.

---

## Template cho PR-4 (AdminOps UI form + i18n)

### 1) Scope
- [ ] Chi thay doi UI form va i18n.

### 2) Functional checklist
- [ ] Co section "Prefetch Time-based Query Policy" tren AdminOps.
- [ ] Co field market window + profile cards + guard fields.
- [ ] Load du lieu tu settings API dung mapping.
- [ ] i18n vi/en day du, khong hard-code text.

### 3) UX checklist
- [ ] Layout khong vo tren desktop va mobile.
- [ ] Form state ro rang (loading/saving/error).

### 4) Tests
- [ ] Co FE tests render + data binding co ban.

### 5) Review gates
- [ ] Khong pha cac section AdminOps dang co.

---

## Template cho PR-5 (FE validation + save flow + preview)

### 1) Scope
- [ ] Chi thay doi validation, save flow, active preview.

### 2) Functional checklist
- [ ] Validation client-side day du cho cac field range/time.
- [ ] Khong submit payload invalid.
- [ ] Save success/error feedback ro rang.
- [ ] Co active profile preview (profile + query_enabled + effective interval).

### 3) Error handling
- [ ] Map loi backend thanh message de hieu.
- [ ] Khong mat state form khi save that bai.

### 4) Tests
- [ ] FE test validation fail/pass.
- [ ] FE test save success/failure.

### 5) Review gates
- [ ] Preview khop response backend.

---

## Template cho PR-6 (Test suite + docs + rollout)

### 1) Scope
- [ ] Tap trung test, docs, rollout/rollback runbook.

### 2) Test checklist
- [ ] Backend unit tests cho validator/resolver/guard pass.
- [ ] Backend integration tests settings + metadata pass.
- [ ] Frontend tests validation/save/preview pass.
- [ ] Manual QA checklist pre_open/post_close/weekend pass.

### 3) Rollout checklist
- [ ] Co canary plan 24-48h.
- [ ] Co KPI theo doi 429/cooldown/freshness.
- [ ] Co rollback trigger criteria ro rang.

### 4) Docs checklist
- [ ] Cap nhat plan tong.
- [ ] Cap nhat execution board.
- [ ] Cap nhat task tracker.
- [ ] Cap nhat changelog.

### 5) Review gates
- [ ] Da tong hop ket qua test va evidences.

---

## Muc bat buoc trong tat ca PR

- [ ] Co link den issue/task tuong ung.
- [ ] Co mo ta scope in/out ro rang.
- [ ] Co danh sach risk va cach rollback.
- [ ] Co xac nhan khong thay doi ngoai scope.
