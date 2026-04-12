# PREFETCH TIME-BASED QUERY POLICY PLAN (ADMIN) — 2026-04-12

## 1) Muc tieu

Xay dung chuc nang cau hinh theo khung gio tu trang quan tri de he thong tu dong giam tan suat truy van upstream (vnstock) ngoai gio giao dich, dac biet:
- Truoc gio giao dich 30 phut.
- Sau gio giao dich 30 phut.

Muc tieu ky thuat:
- Giam xac suat bi rate-limit/cooldown.
- Giu do tuoi du lieu hop ly theo ngu canh thi truong.
- Cau hinh runtime khong can restart service.
- Co kha nang rollout an toan va rollback nhanh.

Muc tieu san pham:
- Quan tri vien co the xem/chinh profile tan suat theo tung khung gio ngay tren Admin Ops.
- Hien thi ro profile dang active va ly do.

---

## 2) Pham vi va nguyen tac

### 2.1 Pham vi Backend
- Celery prefetch task: `prefetch_ticker_price_board` la diem uu tien so 1.
- Fallback luong realtime (neu co goi upstream truc tiep) can dung chung policy.
- Health payload can phan anh profile dang active + quyet dinh skip/query.

### 2.2 Pham vi Frontend Admin
- Them panel cau hinh Time-based Query Policy trong Admin Ops.
- Ho tro CRUD du lieu cau hinh runtime.
- Co "Preview profile hien tai" va "Rulebook/validation hint".

### 2.3 Nguyen tac van hanh
- Runtime-first: doc policy tu cache/admin settings truoc, fallback env defaults.
- Safe-by-default: neu policy loi, fallback profile an toan (khong crash).
- Idempotent: luong luu cau hinh va ap dung cau hinh phai idempotent.
- Observable: co metrics/log de biet profile nao dang tac dong.

---

## 3) Thiet ke du lieu cau hinh

## 3.1 Dinh nghia `prefetch_time_policy` (de xuat)

```json
{
  "timezone": "Asia/Ho_Chi_Minh",
  "market": {
    "open_time": "09:00",
    "close_time": "15:00",
    "pre_open_minutes": 30,
    "post_close_minutes": 30,
    "lunch_break": {
      "enabled": true,
      "start": "11:30",
      "end": "13:00"
    },
    "weekend_mode": "offhours"
  },
  "profiles": {
    "pre_open": {
      "query_enabled": true,
      "interval_seconds": 90,
      "batch_size": 10,
      "symbol_limit": 20,
      "max_retries": 2
    },
    "market_open": {
      "query_enabled": true,
      "interval_seconds": 35,
      "batch_size": 20,
      "symbol_limit": 40,
      "max_retries": 4
    },
    "lunch_break": {
      "query_enabled": true,
      "interval_seconds": 180,
      "batch_size": 8,
      "symbol_limit": 20,
      "max_retries": 1
    },
    "pre_close": {
      "query_enabled": true,
      "interval_seconds": 60,
      "batch_size": 12,
      "symbol_limit": 30,
      "max_retries": 2
    },
    "post_close": {
      "query_enabled": true,
      "interval_seconds": 180,
      "batch_size": 8,
      "symbol_limit": 20,
      "max_retries": 1
    },
    "offhours": {
      "query_enabled": false,
      "interval_seconds": 600,
      "batch_size": 5,
      "symbol_limit": 10,
      "max_retries": 0
    }
  },
  "rate_limit_guard": {
    "jitter_percent": 15,
    "cooldown_multiplier_on_429": 2.0,
    "max_interval_seconds": 1800
  }
}
```

## 3.2 Rulebook validation
- `timezone` hop le.
- `open_time < close_time`.
- `pre_open_minutes`, `post_close_minutes` >= 0.
- `interval_seconds` >= 5.
- `batch_size` >= 1.
- `symbol_limit` >= 0.
- `max_retries` >= 0.
- `jitter_percent` trong [0, 50].
- `cooldown_multiplier_on_429` >= 1.

---

## 4) Backend implementation plan

## 4.1 Service layer
- Tao helper:
  - `_default_prefetch_time_policy()`
  - `_coerce_prefetch_time_policy(payload)`
  - `_get_runtime_prefetch_time_policy()`
  - `_set_runtime_prefetch_time_policy(payload)`
- Cache key de xuat: `admin_ops:prefetch_time_policy`.

## 4.2 Profile resolver
- Tao resolver:
  - `_resolve_prefetch_time_profile(now, policy) -> profile_name`
  - `_resolve_effective_prefetch_settings(now, policy, base_runtime_settings)`
- Tra ve thong tin:
  - `profile_name`
  - `query_enabled`
  - effective `interval_seconds`, `batch_size`, `symbol_limit`, `max_retries`.

## 4.3 Tich hop vao prefetch task
- Trong `prefetch_ticker_price_board`:
  - Doc policy + resolve profile hien tai.
  - Neu `query_enabled=false`: skip upstream call, cap nhat metadata status `throttled_by_policy`.
  - Neu enabled: ap dung tham so effective profile.
  - Ap dung jitter theo `jitter_percent` cho scheduling/next run hint.

## 4.4 Tich hop guard 429
- Khi bi 429:
  - Tang tam thoi `effective interval` theo `cooldown_multiplier_on_429`.
  - Gioi han boi `max_interval_seconds`.
- Metadata can ghi:
  - `policy_profile`
  - `policy_query_enabled`
  - `policy_effective_interval_seconds`
  - `policy_cooldown_multiplier_applied`

## 4.5 API admin settings
- Mo rong endpoint admin settings hien co:
  - GET: tra `prefetch_time_policy` + `prefetch_time_policy_rulebook`.
  - PUT: nhan `prefetch_time_policy`, validate va save runtime.
- Backward compatibility:
  - Khong pha vo schema cu.

## 4.6 Health/observability payload
- Mo rong payload `ticker_prefetch` / health:
  - `policy.profile`
  - `policy.query_enabled`
  - `policy.window`
  - `policy.next_allowed_query_at`
  - `policy.reason`

---

## 5) Frontend Admin implementation plan

## 5.1 UI section moi trong Admin Ops
- Tieu de: "Prefetch Time-based Query Policy".
- Nhom truong:
  - Market window (open/close/pre/post/lunch).
  - Profile cards (pre_open, market_open, lunch_break, pre_close, post_close, offhours).
  - Rate-limit guard (jitter, multiplier, max interval).

## 5.2 UX yeu cau
- Form validation truoc khi submit.
- Hien rulebook hint ngay duoi form.
- Nhan ket qua save thanh cong/that bai.
- Preview profile dang active theo thoi gian hien tai.

## 5.3 UI state
- `policyForm`
- `policyState` (idle/saving/success/error)
- `policyMessage`
- `activePolicyPreview`

## 5.4 API client
- Mo rong wrapper cho `get/update` thong qua admin settings endpoint hien co.

---

## 6) Ke hoach rollout

## 6.1 Phase 1 (MVP)
- Ho tro policy cho prefetch task.
- Admin co the cau hinh profile theo khung gio.
- Health payload co profile dang active.

## 6.2 Phase 2
- Ap policy vao cac luong fallback goi upstream trong request path.
- Bo sung policy preview chi tiet tren Admin Ops.

## 6.3 Phase 3
- Telemetry nang cao + dashboard (429 rate, skip ratio, freshness by profile).
- Khuyen nghi auto-tune profile dua tren lich su 429.

---

## 7) Test plan

## 7.1 Backend unit tests
- Validate coerce policy (du lieu hop le/khong hop le).
- Resolve profile dung theo cac moc gio.
- Query skip dung khi offhours.
- 429 multiplier ap dung dung va khong vuot max.

## 7.2 Backend integration tests
- PUT/GET admin settings cho `prefetch_time_policy`.
- Prefetch metadata co `policy_profile`.
- Khong crash neu policy cache bi corrupt.

## 7.3 Frontend tests
- Render form policy.
- Validation message.
- Save success/failure.
- Preview profile theo mock data.

## 7.4 Manual QA
- Dat policy aggressive/soft va xac nhan thay doi metadata.
- Kiem tra truoc mo cua 30p va sau dong cua 30p.
- Kiem tra cuoi tuan.

---

## 8) KPI theo doi sau trien khai

- Ty le 429 tu upstream (muc tieu giam manh).
- So lan vao cooldown.
- Freshness trung binh trong gio giao dich.
- Ty le `throttled_by_policy` ngoai gio.
- Latency p95 cua endpoint lien quan realtime.

---

## 9) Rui ro va giam thieu

- Rui ro: policy cau hinh sai gay stale qua muc.
  - Giam thieu: rulebook + min/max guard + fallback default.
- Rui ro: profile resolver sai timezone.
  - Giam thieu: test timezone + explicit timezone policy.
- Rui ro: thay doi lon lam kho debug.
  - Giam thieu: metadata quan sat day du + flag rollout.

---

## 10) Work breakdown de xuat (7-10 ngay)

1. Ngay 1-2: Backend schema + validator + settings API.
2. Ngay 3-4: Task integration + metadata + test unit.
3. Ngay 5-6: Frontend Admin form + save flow + i18n.
4. Ngay 7: Integration tests + manual QA.
5. Ngay 8-10: Hardening, dashboard metrics, rollout.

---

## 11) Tieu chi hoan thanh (Definition of Done)

- Admin co the cau hinh khung gio + profile runtime tren UI.
- He thong tu dong giam tan suat truy van dung theo khung gio.
- Ngoai gio (bao gom 30p truoc/sau) co tac dong giam tai ro ret.
- Ty le 429/cooldown giam so voi baseline.
- Co tai lieu van hanh + rollback steps ro rang.

---

## 12) Execution board lien quan

- Theo doi chi tiet task/PR/owner tai:
  - docs/PREFETCH_TIME_POLICY_EXECUTION_BOARD_20260412.md
- Trang dieu huong trung tam:
  - docs/PREFETCH_TIME_POLICY_MASTER_INDEX_20260412.md
