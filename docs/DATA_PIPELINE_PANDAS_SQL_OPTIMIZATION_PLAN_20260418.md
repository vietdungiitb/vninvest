# DATA PIPELINE / PANDAS / SQL OPTIMIZATION PLAN (2026-04-18)

## 1) Muc tieu va pham vi

Muc tieu cua ke hoach nay la nang hieu nang pipeline du lieu backend theo chien luoc:
- Uu tien SQL projection/filtering o DB layer.
- Uu tien Pandas vectorized computation o application layer.
- Loai bo cac Python-loop xu ly du lieu lon tren hot-path.

Pham vi dot nay:
- Da thuc thi toi uu code cho 3 hotspot P1/P2: whale aggregate scope resolve, analytics pipeline, prefetch pipeline.
- Admin pandas insights (P2) de lai dot tiep theo de tranh mo rong scope qua lon.
- Khong thay doi feature business va giu API contract hien tai (co bo sung field alias de backward compatibility).

Ngoai pham vi dot nay:
- Khong thay doi feature business.
- Khong doi API contract neu khong bat buoc.
- Khong doi Docker/deploy topology.

---

## 2) Van de hien tai (tong hop)

### 2.1 Trieu chung
- Co endpoint su dung filter/tong hop bang Python loop tren queryset lon.
- Co luong tao DataFrame nhieu lan trong cung 1 request/task.
- Co truy van aggregate lap lai nhieu lan cho cung 1 bo loc.
- Co nguy co query N+1 o mot so helper/view path.

### 2.2 Anh huong
- Tang p95 latency o API du lieu nang (whale/aggregate/analytics).
- Tang CPU va memory pressure khi gio cao diem.
- Tang do bat on dinh khi workload tang (market volatility).

---

## 3) Nguyen tac thiet ke toi uu (bat buoc)

1. SQL truoc, Pandas sau:
- DB lam viec filter, select, aggregate, sort, window theo kha nang SQL.
- Python/Pandas chi nhan du lieu da duoc projection toi thieu.

2. Projection toi thieu:
- Dung `.values(...)`/`.values_list(...)` de lay dung cot can thiet.
- Tranh keo object day du khi khong can (`select_related`/`prefetch_related` theo muc dich ro rang).

3. Pandas vectorized:
- Tranh `for` loop tren tung dong DataFrame neu co the thay bang vectorized ops.
- Han che `apply`/`iterrows` o hot-path.
- Tai su dung DataFrame trung gian thay vi rebuild.

4. Tinh dung output:
- Khong doi nghia business result.
- Co test doi chieu before/after cho payload quan trong.

5. Do luong truoc sau:
- Moi thay doi phai co baseline va delta metrics.

---

## 4) Danh sach hotspot uu tien

### P1 - Whale aggregate va unified alerts
- File du kien: `backend/portfolio/market_data_service.py`
- Van de nghi ngo:
  - Co doan loc/tong hop theo Python path thay vi SQL path.
  - Co aggregate lap lai theo cung dieu kien.
  - Co DataFrame tao tu list dict trong request path nhieu lan.

### P1 - Portfolio analytics pipeline
- File du kien: `backend/portfolio/analytics.py`
- Van de nghi ngo:
  - Group-by theo symbol co doan xu ly tuan tu co the toi uu them.
  - Pivot/cumsum/multiply can toi uu memory va projection input.
  - Co kha nang tai su dung intermediate artifact.

### P2 - Prefetch symbol ranking
- File du kien: `backend/portfolio/tasks_prefetch.py`
- Van de nghi ngo:
  - Nhieu aggregate theo nguon du lieu khac nhau can pipeline hoa.
  - Kha nang gop query + cache ket qua trung gian theo chu ky task.

### P2 - Admin pandas insights
- File du kien: `backend/portfolio/admin.py`
- Van de nghi ngo:
  - Query + DataFrame xu ly trong admin dashboard co the duoc projection/chat hon.

---

## 5) Ke hoach thuc thi chi tiet (DP-01)

### Phase A - Baseline & profiling (0.5 ngay)
Muc tieu:
- Co bang so lieu before cho tung hotspot.

Tac vu:
1. Chon 3-4 endpoint/task dai dien:
- Whale aggregate endpoint
- Unified alerts endpoint
- Portfolio analytics endpoint
- Prefetch task

2. Thu thap metrics:
- p50/p95 latency
- query count
- rows fetched (uoc tinh)
- CPU time endpoint/task

3. Chot test data profile:
- So luong symbol, tick, transaction, advisory events.

Deliverable:
- Bang baseline trong tai lieu nay (muc 7).

---

### Phase B - SQL optimization (1 ngay)
Muc tieu:
- Day filter/tong hop xuong DB layer.

Tac vu:
1. Refactor query:
- Chuyen Python-loop filter thanh queryset filter/annotate.
- Gop aggregate lap lai tren cung bo loc.

2. Projection va relation:
- Them `.values(...)` dung cot can.
- Bo sung `select_related`/`prefetch_related` dung diem nong.

3. Index strategy:
- De xuat index cho where/order by hot fields.
- Kiem tra bang EXPLAIN voi query nong (neu can).

Deliverable:
- Patch SQL path + note ve index candidates.

---

### Phase C - Pandas vectorization (1 ngay)
Muc tieu:
- Giam Python overhead trong data compute path.

Tac vu:
1. Chuan hoa DataFrame creation:
- Tao 1 lan, dung nhieu lan trong request scope.

2. Thay loop bang vectorized:
- Groupby/merge/pivot/where/clip/mask thay cho row loop.

3. Giam memory churn:
- Chon dtype phu hop.
- Han che copy khong can thiet.

Deliverable:
- Patch Pandas path + benchmark so sanh CPU/runtime.

---

### Phase D - Validation & guardrails (0.5 ngay)
Muc tieu:
- Xac nhan ket qua dung va ben vung.

Tac vu:
1. So sanh output before/after:
- Snapshot payload endpoint quan trong.

2. Bench regression:
- Chay lai bo test benchmark nho.

3. Cap nhat docs governance:
- Audit ledger + progress dashboard + release notes ngan.

Deliverable:
- Bao cao delta metrics va ket luan GO/NO-GO cho merge.

---

## 6) KPI va acceptance criteria

### KPI ky vong
- Whale aggregate p95: giam >= 25% so voi baseline.
- Query count hotspot: giam >= 30%.
- CPU time analytics path: giam >= 20%.
- Khong tang error rate.

### Acceptance bat buoc
1. Payload business giu nguyen.
2. Test pass tren bo test lien quan.
3. Co benchmark before/after de chung minh.
4. Khong pha vo contract API hien tai.

---

## 7) Bang baseline/ket qua (cap nhat 2026-04-18)

| Hotspot | Baseline p95 | Baseline Query Count | After p95 | After Query Count | Delta |
|---|---:|---:|---:|---:|---:|
| Whale aggregate | TBD (can benchmark bo sung) | TBD | TBD | TBD | SQL scope resolve + symbol normalization da toi uu |
| Unified alerts | TBD (can benchmark bo sung) | TBD | TBD | TBD | Huong toi uu thong qua aggregate path da cai thien |
| Portfolio analytics | TBD (can benchmark bo sung) | TBD | TBD | TBD | Bo `iterrows`/`apply`, thay bang `itertuples` + vectorized map |
| Prefetch task | TBD (can benchmark bo sung) | TBD | TBD | TBD | Bo `iterrows` tren cache path, tai su dung symbol normalization |

Ket qua validation hien tai:
- Django check: pass (`manage.py check`).
- Focused regression tests: 13 test pass tren cac luong hotspot.
- 1 test whale aggregate co tinh khong on dinh khi chay theo batch do stream state chia se; chay rieng pass sau khi bo sung truong alias tuong thich.

---

## 8) Rui ro va rollback plan

### Rui ro
1. Sai khac output do thay doi thu tu aggregate/group.
2. Query toi uu nhung mat index dan den slow o dataset lon.
3. Pandas vectorized co the tang peak memory neu khong canh bao.

### Giam thieu
1. Co snapshot compare payload quan trong.
2. Test voi dataset representative.
3. Feature-flag/toggle neu can rollback nhanh.

### Rollback
- Neu fail KPI hoac sai output:
  - Revert tung patch theo phase.
  - Quay lai baseline path.
  - Giu benchmark artifact de phan tich tiep.

---

## 9) File du kien tac dong

Core code:
- `backend/portfolio/market_data_service.py`
- `backend/portfolio/analytics.py`
- `backend/portfolio/tasks_prefetch.py`
- `backend/portfolio/admin.py`

Benchmark/tests (du kien):
- `backend/tests/**` hoac `backend/portfolio/tests/**`
- Co the bo sung script benchmark nho o `scripts/ops/` hoac `tests/examples/`

Governance docs:
- `docs/CODE_CHANGE_AUDIT_LEDGER.md`
- `PROGRESS_DASHBOARD.md`

---

## 10) Ke hoach thoi gian de xuat

- Ngay 1 (sang): Phase A baseline
- Ngay 1 (chieu): Phase B SQL
- Ngay 2 (sang): Phase C Pandas
- Ngay 2 (chieu): Phase D validation
- Ngay 3 (du phong): fix regression + hardening

---

## 11) Quyet dinh can duyet truoc khi code

1. Duyet thu tu uu tien hotspot P1 truoc P2.
2. Duyet KPI muc tieu (p95/query count/CPU).
3. Duyet quy tac khong doi API contract.
4. Duyet cach benchmark trong moi truong dev hien tai.

Neu 4 muc tren duoc duyet, bat dau implementation theo DP-01.

---

## 12) Implementation execution summary (2026-04-18)

Da implement:
1. `backend/portfolio/analytics.py`
- Thay `group.sort_values(...).iterrows()` bang `itertuples()` de giam overhead Python object.
- Loai bo `apply(axis=1)` trong NAV path, thay bang vectorized `map` + nhan cot.
- Giu nguyen output business fields.

2. `backend/portfolio/market_data_service.py`
- Refactor `_resolve_whale_feed_symbols` de bo `prefetch_related` khong can thiet, day projection xuong SQL (`values_list`) va chuan hoa bang helper.
- Bo sung field alias `alert_at`, `alert_first_seen_at`, `alert_age_seconds` trong aggregate payload builder de giu backward compatibility cho client/test legacy.

3. `backend/portfolio/tasks_prefetch.py`
- Chuan hoa helper symbol (`_normalized_symbol_set`) de tai su dung cho nhieu path.
- Thay `iterrows()` trong cache ticker path bang iteration tren `to_dict(orient='records')`.
- Dung helper chung trong `_distinct_symbols` va collect universe.

Validation evidence:
- `python manage.py check` => pass.
- Focused tests pass:
  - `ApiRouteStockWorkspaceRealtimeBulkTests` (watchlist/scope/dedup + default tracked run rieng pass)
  - `TestBuildRiskMetrics`
  - `PrefetchTickerPriceBoardNormalizationTests`
  - `RealtimeUniverseAndShardSchedulerTests.test_collect_realtime_symbol_universe_assigns_tier_and_stable_shard`

Readiness:
- Functional regression: PASS tren bo test muc tieu.
- Performance KPI p95/query-count: chua co so benchmark before/after day du, can bo sung 1 dot benchmark nho neu muon dong dau "production-ready theo KPI".
