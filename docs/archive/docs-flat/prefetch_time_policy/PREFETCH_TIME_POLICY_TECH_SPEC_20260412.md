# PREFETCH TIME POLICY - TECH SPEC (2026-04-12)

## 1) Problem statement

He thong prefetch hien tai chua toi uu tan suat theo khung gio thi truong, dan den:
- Tang rui ro 429/cooldown khi truy van upstream.
- Tan suat khong can thiet ngoai gio giao dich.

Can co policy runtime theo khung gio de dieu chinh query frequency va query enable/disable.

---

## 2) Goals

- Ho tro policy theo khung gio (pre_open, market_open, lunch_break, pre_close, post_close, offhours).
- Ho tro pre_open 30p va post_close 30p.
- Runtime configurable qua admin settings, khong can restart.
- Co fallback safe default neu payload loi.
- Co observability day du cho rollout.

Non-goals:
- Auto tuning policy dua tren ML.
- Thay doi logic nghiep vu khac ngoai prefetch runtime.

---

## 3) Architecture overview

Data flow:
1. AdminOps PUT `prefetch_time_policy`.
2. Backend validate + coerce + save vao runtime store (cache).
3. Prefetch task doc policy truoc moi cycle.
4. Resolver xac dinh profile active theo time window.
5. Task ap effective settings hoac skip query.
6. Health + metrics phan anh hanh vi runtime.

Core components:
- Settings API layer.
- Policy validator/coercer.
- Time profile resolver.
- Prefetch executor integration.
- Metrics + health metadata.

---

## 4) Canonical policy model

Top-level keys:
- timezone
- market (open/close/pre_open_minutes/post_close_minutes/lunch_break/weekend_mode)
- profiles (pre_open/market_open/lunch_break/pre_close/post_close/offhours)
- rate_limit_guard (jitter_percent/cooldown_multiplier_on_429/max_interval_seconds)

Profile fields:
- query_enabled: bool
- interval_seconds: int
- batch_size: int
- symbol_limit: int
- max_retries: int

---

## 5) Runtime resolution rules

Priority:
1. Explicit policy from runtime store.
2. Default policy in backend.
3. Last-resort hardcoded safe profile (never crash).

Window mapping:
- pre_open: [open - pre_open_minutes, open)
- market_open: [open, close)
- lunch_break: if enabled and now in lunch range
- pre_close: optional sub-window gan close (neu co)
- post_close: [close, close + post_close_minutes)
- offhours: con lai + weekend theo weekend_mode

Conflict rule:
- lunch_break co priority cao hon market_open neu khung gio overlap.

---

## 6) Integration points

Backend:
- Settings API (GET/PUT)
- Prefetch task loop
- Health payload serializer
- Metrics exporter

Frontend:
- AdminOps policy form
- Validation + save flow
- Active profile preview

---

## 7) Error handling

Validation errors:
- Return 400 field-level messages.

Runtime policy read errors:
- Log warning + fallback default.
- Never crash task worker.

Unexpected resolver errors:
- Emit error metric + fallback offhours safe profile.

---

## 8) Security and permissions

- Chi admin/staff duoc cap nhat policy.
- Read policy trong admin settings cung theo quyen admin.
- Audit log bat buoc cho moi update policy.

---

## 9) Performance expectations

- Resolver O(1) theo moi cycle.
- Khong query DB cho moi cycle (uu tien cache + in-memory fallback).
- Overhead policy resolve < 5ms/cycle trong dieu kien binh thuong.

---

## 10) Acceptance criteria

- Runtime profile chuyen dung theo moc gio.
- 429 rate va cooldown events giam so voi baseline.
- Freshness trong market_open khong roi duoi nguong chap nhan.
- Co day du docs, tests, release gates va rollback runbook.
