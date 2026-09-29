# TASKBOARD — Scraping System SaaS-Native

**Ngày**: 2026-05-14  
**Legend**: `[ ]` = Not started | `[~]` = In progress | `[x]` = Done | `[!]` = Blocked

---

## Phase A — Freeze contract và route map

- [x] `SSN-T01` Tạo canonical matrix routes dưới `/core/v1/operator/scraping/*`
- [x] `SSN-T02` Ghi execution bundle docs và ownership decisions
- [ ] `SSN-T03` Chốt alias/deprecation map cho `/api/soc/*` và `/api/admin-ops/*`

**Gate A**

- Canonical matrix routes resolve
- Focused matrix tests pass
- Docs bundle tồn tại

---

## Phase B — Broker SSOT cleanup

- [x] `SSN-T04` Loại direct provider imports khỏi `data_ingest/tasks.py`
- [x] `SSN-T05` Sync provider roster trong `market_data/vnbroker_adapter.py` với `provider_catalog`
- [ ] `SSN-T06` Audit và cô lập mọi compat/provider import còn sót trên active runtime path

**Gate B**

- Grep clean cho direct provider imports ngoài adapter
- Focused adapter/task tests pass

---

## Phase C — Execution semantics unification

- [~] `SSN-T07` Reuse Matrix execution primitives cho scheduled/manual scraping
- [~] `SSN-T08` Chuẩn hóa run-log/progress semantics
- [ ] `SSN-T09` Loại nhu cầu dựng coordinator Celery song song

**Gate C**

- Không còn execution control plane thứ hai
- Price/history/intraday wrappers dùng semantics thống nhất

---

## Phase D — Native ingest cutover

- [ ] `SSN-T10` Native hóa `fetch_and_upsert_price_board`
- [ ] `SSN-T11` Native hóa `ingest_daily_prices`
- [ ] `SSN-T12` Native hóa `backfill_daily_prices`
- [ ] `SSN-T13` Native hóa `warm_intraday_universe`

**Gate D**

- Primary price/history/intraday path không còn legacy bypass
- Runtime rebuild xong và smoke pass

---

## Phase E — Native signal materialization

- [x] `SSN-T14` Bỏ legacy-first whale aggregate path
- [x] `SSN-T15` Bỏ synthetic/random whale fallback
- [~] `SSN-T16` Chốt facts-first pipeline cho whale/dark-flow/CVD/strength

**Gate E**

- Materialization path chỉ dùng native facts hoặc degraded empty-state có chủ đích
- Focused signal tests pass

---

## Phase F — Bridge removal và OpenAPI completion

- [~] `SSN-T17` Gỡ scraping dependency vào `LEGACY_BACKEND_URL`
- [ ] `SSN-T18` Gỡ scraping dependency vào `legacy_readonly`
- [ ] `SSN-T19` Hoàn tất request/response schema và examples cho canonical scraping routes
- [ ] `SSN-T20` Chuẩn hóa pagination, 409, 429, field_errors cho scraping/operator APIs

**Gate F**

- OpenAPI schema reflect canonical routes
- Không còn bridge trên steady-state scraping path

---

## Phase G — Consumer cutover và decommission prep

- [ ] `SSN-T21` Chuyển consumer chính sang canonical routes
- [ ] `SSN-T22` Gắn deprecation notes cho alias cũ
- [ ] `SSN-T23` Chạy shadow run/parity evidence
- [ ] `SSN-T24` Chuẩn bị legacy decommission checklist cho scraping domain

**Gate G**

- Consumer không tạo dependency mới vào alias cũ
- Parity/shadow evidence complete
- Ledger, progress, module tree sync xong
