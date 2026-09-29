# BACKEND CODE AUDIT VNINVEST - V2 (Execution Ready)

Ngay audit: 2026-04-05
Pham vi: backend/ (trong tam: portfolio app)
Phuong phap: doc code + doi chieu route/service/test + tong hop rui ro van hanh

## 1) Executive Summary

Ket luan: Nen tang backend tot, nhieu thanh phan da co dinh huong kien truc dung (adapters, cache, mission-control, test regression). Tuy nhien, rui ro van hanh va maintainability van cao do mot so endpoint quan trong con dong trong views.py rat lon va phu thuoc nguon du lieu ben ngoai (vnbroker) ngay trong HTTP path.

Muc do san sang scale: 8.6/10

3 uu tien cao nhat 30 ngay toi:
1. Co lap external dependency (vnbroker) qua 1 duong vao duy nhat va chuan hoa fallback.
2. Giam do phuc tap HTTP layer (tach theo domain + service facade + feature flag rollout).
3. Bo sung observability/co che rollback dua tren metric thay vi rollout theo cam tinh.

## 2) Evidence Map (co the giao viec ngay)

### 2.1 FAT VIEW van la nut that

- `portfolio/views.py` hien tai 4024 LOC.
- Nhieu APIView va function-based endpoint nam chung 1 file:
	- Intraday/PriceBoard/Whale/RVOL/Depth/Financial/Portfolio/AI/Screener...
	- Vi du moc lon: class xuat hien den khu vuc dong 4493.

Tac dong:
- Kho review, kho regression-safe refactor.
- Tang nguy co side effects khi sua nhanh production issue.

### 2.2 Coupling voi vnbroker da giam mot phan, nhung chua dong bo

Diem tich cuc:
- Da co adapter layer: `portfolio/adapters/vnbroker_adapter.py`.
- Da co cache/backoff helper: `portfolio/adapters/cache_adapter.py`.
- Da co test adapter: `portfolio/tests/test_adapters.py`.

Van de ton tai:
- Nhieu call `from vnbroker import Vnbroker` van xuat hien truc tiep trong `portfolio/views.py` (nhieu diem: 694, 1081, 1179, 1319, 1460, 1605, 1957, 2054, 3095, 3164, 3235...).
- Nghia la duong di adapter chua la "single choke point" cho external IO.

Tac dong:
- Kho enforce retry/circuit breaker/chuan hoa loi mot cach nhat quan.
- Khi nha cung cap thay doi behavior, chi phi fix lan toa lon.

### 2.3 Input handling: co DRF validate o nhieu noi, nhung chua co contract dong nhat

Quan sat:
- Nhieu endpoint doc truc tiep `request.query_params.get(...)` trong `portfolio/views.py`.
- Co nhieu parse/int/float tu thu cong trong handler.
- Chua thay dau vet Pydantic/BaseModel trong backend code hien tai.

Danh gia rui ro:
- Rui ro chinh khong phai SQL injection (ORM Django giam rui ro nay), ma la:
	- validation khong dong bo,
	- boundary handling khong nhat quan,
	- de phat sinh bug 400/500 edge-case.

### 2.4 Magic thresholds va duplicated domain constants

Bằng chung:
- Hardcoded threshold 50M/1B xuat hien o nhieu noi:
	- `portfolio/order_flow.py`: SMALL_ORDER_THRESHOLD = 50_000_000, logic classifying.
	- `portfolio/views.py`: xu ly size class voi 1_000_000_000.
	- `portfolio/market_data_service.py`, `portfolio/realtime/compute.py` cung co nguong tuong tu.

Tac dong:
- Domain rule bi phan tan, kho calibration theo market regime.
- Nguy co "logic drift" giua API realtime va batch/task.

### 2.5 Refactor da bat dau, can day den dich

Bằng chung tich cuc:
- Da co `portfolio/market_views.py`.
- Da co test feature flag route chuyen qua refactored market view trong `portfolio/tests/test_api_routes.py`.

Y nghia:
- Day la de can quan trong de rollout an toan.
- Nen tiep tuc theo mo hinh strangler thay vi rewrite mot lan.

## 3) Risk Register (P0/P1)

| Priority | Issue | Xac suat | Tac dong | Ket luan |
|---|---|---:|---:|---|
| P0 | views.py qua lon + mixed concerns | High | High | Can tach theo domain co feature flag |
| P0 | vnbroker call truc tiep trong handler | High | High | Can chot 1 adapter/facade duy nhat |
| P1 | Validation contract khong dong nhat | Medium | High | Chuan hoa request schema theo endpoint |
| P1 | Domain threshold hardcoded phan tan | Medium | Medium | Central config + runtime tuning |
| P1 | Quan sat he thong con thieu (trace/metric) | Medium | Medium | Them telemetry cho external calls |

## 4) Ke hoach 30 ngay (co DoD)

### Week 1 - Stabilize External IO (P0)

Muc tieu:
- 100% call vnbroker trong HTTP path di qua adapter/facade.

Viec can lam:
1. Tao facade duy nhat cho market data external (co timeout/retry/backoff/error mapping).
2. Refactor cac endpoint market hot-path de dung facade thay vi import vnbroker truc tiep.
3. Chuan hoa ma loi external (`vnbroker_timeout`, `vnbroker_rate_limited`, `vnbroker_unavailable`).

Definition of Done:
1. Khong con `from vnbroker import Vnbroker` trong `portfolio/views.py`.
2. Test adapter/fallback pass tren CI.
3. 5xx do external provider giam ro rang tren moi truong staging.

### Week 2 - HTTP Layer Decomposition (P0/P1)

Muc tieu:
- Giam complexity cua monolith views, khong doi API contract.

Viec can lam:
1. Tach group endpoint theo domain: market, whale, portfolio, ai/screener.
2. Dung feature flag route de bat/tat branch moi.
3. Bo sung contract tests old/new response parity.

Definition of Done:
1. LOC `portfolio/views.py` giam >= 30%.
2. Cac endpoint da tach co test parity pass.
3. Co rollback switch nhanh bang feature flag.

### Week 3 - Validation + Domain Config

Muc tieu:
- Validation dong bo va giam hardcode.

Viec can lam:
1. Chuan hoa parse request bang serializer/schema cho top endpoint co traffic cao.
2. Gom threshold/domain constants ve mot config module.
3. Tach rule "size class" va "threshold policy" khoi view/service flow.

Definition of Done:
1. Top 10 endpoint khong con parse tham so thu cong trong handler.
2. Constants khong con duplicate o views/order_flow/realtime.
3. Regression tests cho threshold mapping pass.

### Week 4 - Observability + Production Rollout

Muc tieu:
- Rollout theo metric, khong rollout cam tinh.

Viec can lam:
1. Them telemetry external call (latency, timeout, error code, fallback hit rate).
2. Dashboard cho p50/p95 latency + error ratio + fallback ratio.
3. Canary 10% -> 50% -> 100% voi rollback criteria ro rang.

Definition of Done:
1. Co baseline va post-rollout metric de so sanh.
2. Canh bao duoc trigger tu metric threshold.
3. Runbook rollback duoc test tren staging.

## 5) KPI Baseline Can Chot Them (hien chua du du lieu)

Can bo sung truoc khi chot target cuoi:
1. API latency: p50/p95/p99 cho 6 endpoint market hot-path.
2. Ty le loi 4xx/5xx theo endpoint.
3. Ty le fallback (stream -> db -> vnbroker).
4. Celery queue depth + lead time theo task group.
5. Redis memory trend + eviction count.

Luu y: Chua thay evidence OpenTelemetry trong code hien tai; neu chon stack khac (Prometheus/StatsD) can ghi ro vao tai lieu de tranh "tool mismatch".

## 6) Rollback Plan (toi thieu)

Dieu kien rollback ngay:
1. p95 tang > 30% trong 15 phut.
2. Ty le 5xx > 2x baseline trong 10 phut.
3. Fallback ratio vuot nguong an toan da dinh nghia.

Co che rollback:
1. Tat feature flag branch moi -> quay ve branch cu.
2. Giu adapter cache/backoff dang hoat dong de giam tai external.
3. Freeze deploy cho den khi co RCA ngan (<= 1 ngay lam viec).

## 7) Danh gia tong the

Tong diem de xuat: 8.6/10

Nhan dinh:
- Nen tang co nhieu thanh phan manh va da co dau hieu refactor dung huong.
- Rui ro lon nhat khong nam o thieu tinh nang, ma nam o do co ket va kha nang van hanh an toan khi tai cao/phu thuoc external.
- Neu thuc thi dung 30-day plan o tren, backend co the dat muc "de scale + de van hanh" ro rang hon trong 1 chu ky sprint.
