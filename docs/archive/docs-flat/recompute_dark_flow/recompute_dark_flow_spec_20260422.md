# Spec - `scratch/recompute_dark_flow.py`

Tai lieu nay dinh nghia spec chi tiet cho script backfill dark flow, phuc vu recompute `OrderFlowSignal` tu du lieu `IntradayTick` lich su theo `symbol + date range`.

## 1) Muc tieu

- Cung cap mot script van hanh thu cong de:
  - audit chat luong du lieu `IntradayTick` truoc khi backfill
  - recompute dark flow theo tung ngay giao dich
  - ghi lai `OrderFlowSignal` cho cac ngay dat guard rails
- Tach biet ro voi luong realtime hien tai (`detect_and_store_order_flow(...)`).

## 2) Non-goals

- Khong thay the Celery task realtime.
- Khong sua root cause duplicate tick o crawler/ingestion.
- Khong chay tu dong qua scheduler/beat trong phase dau.
- Khong backfill tat ca symbol neu chua co review output dry-run.

## 3) Vi tri va cach chay

- File script: `scratch/recompute_dark_flow.py`
- Chay tu workspace root hoac tu `backend/` sau khi da setup Django env.
- Script du kien duoc goi thu cong boi operator/developer.

## 4) CLI contract

### 4.1 Args bat buoc

- `--symbol DXG`
- `--start-date YYYY-MM-DD`
- `--end-date YYYY-MM-DD`

### 4.2 Args tuy chon

- `--dry-run`
  - chi audit/report, khong ghi DB
- `--force`
  - cho phep ghi cho ngay vuot duplicate threshold
- `--limit-days N`
  - gioi han so ngay dau tien trong khoang date range de test nhanh
- `--duplicate-threshold-pct 15`
  - nguong duplicate ratio, mac dinh `15`
- `--min-ticks 20`
  - bo qua ngay co qua it tick de phan tich co y nghia
- `--replace-existing`
  - neu co signal cu trong ngay do thi xoa/overwrite theo policy da chot
- `--verbose`
  - in them thong tin trung gian cho operator

### 4.3 Vi du lenh

```powershell
python scratch/recompute_dark_flow.py --symbol DXG --start-date 2026-04-01 --end-date 2026-04-15 --dry-run
```

```powershell
python scratch/recompute_dark_flow.py --symbol DXG --start-date 2026-04-01 --end-date 2026-04-15 --replace-existing
```

## 5) Dau vao va phu thuoc

### 5.1 Dau vao chinh

- `IntradayTick` theo `symbol` va `trade_date`
- neu can: du lieu price reference/phien truoc de enrich signal

### 5.2 Phu thuoc backend

- Django settings/env da duoc init
- model:
  - `IntradayTick`
  - `OrderFlowSignal`
- helper moi de xay dung:
  - `compute_dark_flow_for_trade_date(symbol, trade_date, *, dedupe=True, persist=False, ...)`

## 6) Workflow bat buoc

### Step 1 - Validate input

- Chuan hoa `symbol` ve uppercase.
- Parse `start-date`, `end-date`.
- Reject neu `start-date > end-date`.
- Apply `limit-days` neu co.

### Step 2 - Enumerate trading days

- Lay danh sach ngay co `IntradayTick` trong khoang yeu cau.
- Khong assume lich giao dich lien tuc.

### Step 3 - Audit du lieu tung ngay

Cho moi `trade_date`, tinh cac chi so:
- `raw_tick_count`
- `deduped_tick_count`
- `duplicate_count`
- `duplicate_ratio_pct`
- `qualified_whale_tick_count_before_dedupe`
- `qualified_whale_tick_count_after_dedupe`
- `qualified_whale_value_before_dedupe`
- `qualified_whale_value_after_dedupe`
- `suspicious_reason[]`

Khoa dedupe uu tien:
- Implement hien tai (v1): `symbol`, `trade_date`, `trade_time`, `price`, `volume`, `side`, `match_type`
- Mo rong de xuat (v2): bo sung `stream_id` khi crawler/feed da cap nhat day du truong nay

### Step 4 - Guard rail decision

Mac dinh bo qua ngay do neu mot trong cac dieu kien sau dung:
- `raw_tick_count < min_ticks`
- `duplicate_ratio_pct > duplicate_threshold_pct` va khong co `--force`
- sau dedupe khong con du tick de phan tich

Trang thai quyet dinh tung ngay:
- `skip_low_data`
- `skip_duplicate_risk`
- `dry_run_only`
- `ready_to_persist`
- `persisted`
- `failed`

### Step 5 - Recompute dark flow

- Goi helper history-specific tren tap tick cua ngay do.
- Helper phai tra ve ket qua theo contract thong nhat, toi thieu gom:
  - `signal_type`
  - `strength`
  - `confidence`
  - `tick_rate`
  - `small_order_ratio`
  - `cvd_at_signal`
  - `price_at_signal`
  - `components_json`
  - `event_count`
  - `triggered_at`

### Step 6 - Persist policy

Neu khong co `--dry-run` va ngay dat guard rails:
- Neu chua co signal cu cho ngay do:
  - insert signal moi
- Neu da co signal cu:
  - mac dinh: skip va ghi note `existing_signal_present`
  - neu co `--replace-existing`: xoa/overwrite theo policy da chot

Khuyen nghi persist policy phase dau:
- Chi replace cac signal do chinh script nay tao hoac signal nam trong khoang ngay dang backfill.
- Luon log ro `created / updated / skipped`.

## 7) Output contract

### 7.1 Console summary

Script phai in tong ket cuoi:
- `symbol`
- `date_range`
- `days_scanned`
- `days_ready`
- `days_persisted`
- `days_skipped_low_data`
- `days_skipped_duplicate_risk`
- `days_failed`
- `signals_created`
- `signals_updated`
- `signals_skipped_existing`

### 7.2 JSON-like per-day record

Moi ngay tra ve record co dang:

```json
{
  "trade_date": "2026-04-15",
  "raw_tick_count": 582,
  "deduped_tick_count": 214,
  "duplicate_ratio_pct": 63.23,
  "qualified_whale_value_before_dedupe": 2015000000000,
  "qualified_whale_value_after_dedupe": 742000000000,
  "decision": "skip_duplicate_risk",
  "reason": ["duplicate_ratio_above_threshold"],
  "signal_preview": {
    "signal_type": "mixed",
    "strength": 67.2,
    "confidence": "medium"
  }
}
```

### 7.3 Exit code

- `0`: script chay xong, khong co failure blocking
- `1`: input invalid hoac environment invalid
- `2`: co ngay fail compute/persist, can operator review

## 8) Helper API de xuat

### 8.1 Vi tri helper

De xuat tao helper trong backend, vi du:
- `backend/portfolio/order_flow_backfill.py`
hoac
- `backend/portfolio/order_flow_history.py`

### 8.2 Interface de xuat

```python
def compute_dark_flow_for_trade_date(
    symbol: str,
    trade_date: date,
    *,
    duplicate_threshold_pct: float = 15.0,
    min_ticks: int = 20,
    dedupe: bool = True,
) -> dict:
    ...
```

Tra ve:
- `audit`
- `signal_preview`
- `eligible_for_persist`
- `skip_reason[]`

## 9) Idempotency va an toan du lieu

### 9.1 Idempotency

- Chay lai script voi cung input khong duoc tao ban ghi nhan doi ngoai y muon.
- Su dung event key on dinh theo `symbol + trade_date + signal_type + source=backfill` neu can.

### 9.2 Transaction policy

- Persist tung ngay trong transaction rieng.
- Loi o ngay nao khong duoc lam hong ca batch.

### 9.3 Auditability

- Moi signal tao boi script nen co dau vet nguon `backfill` trong `components_json` hoac `event_id`.
- Log phai cho phep doi chieu tu ngay -> ket qua audit -> hanh dong persist.

## 10) Quy tac xu ly duplicate

### 10.1 Duplicate ratio

Cong thuc:

$$
duplicate\_ratio\_pct = \frac{raw\_tick\_count - deduped\_tick\_count}{max(raw\_tick\_count, 1)} \times 100
$$

### 10.2 Nguong de xuat

- `< 5%`: binh thuong
- `5% - 15%`: canh bao, van co the persist
- `> 15%`: skip mac dinh
- `> 40%`: danh dau `severe_duplicate_risk`

### 10.3 Whale inflation ratio

Them metric tham khao:

$$
whale\_inflation\_ratio = \frac{qualified\_whale\_value\_before\_dedupe}{max(qualified\_whale\_value\_after\_dedupe, 1)}
$$

Neu ratio qua cao thi phai canh bao trong report.

## 11) Logging spec

### 11.1 Log dau batch

- `symbol`
- `start_date`
- `end_date`
- `dry_run`
- `replace_existing`
- `duplicate_threshold_pct`

### 11.2 Log moi ngay

- `trade_date`
- `raw_tick_count`
- `deduped_tick_count`
- `duplicate_ratio_pct`
- `decision`
- `signal_type_preview`
- `strength_preview`

### 11.3 Log cuoi batch

- tong hop cac counter nhu muc 7.1

## 12) Test plan cho script/helper

### 12.1 Unit/integration test helper

1. Day co duplicate tick -> dedupe dung, ratio dung.
2. Day duplicate ratio vuot threshold -> `eligible_for_persist = False`.
3. Day du dieu kien -> co `signal_preview` hop le.
4. `--replace-existing` false -> signal cu khong bi ghi de.
5. `--replace-existing` true -> signal cu duoc overwrite co kiem soat.

### 12.2 Manual operator verification

1. Chay `--dry-run` cho DXG 5-10 ngay.
2. Xac nhan ngay nao co duplicate ratio cao bi skip.
3. So sanh whale value truoc/sau dedupe.
4. Sau do moi chay khong `--dry-run` cho subset nho.

## 13) Definition of done

- Co spec ro de implement script `scratch/recompute_dark_flow.py`.
- Co helper history-specific, khong reuse mu quang detector realtime.
- Script co `dry-run`, `force`, `replace-existing`, `duplicate-threshold-pct`.
- Co per-day audit output va batch summary.
- Co guard rails duplicate risk truoc khi ghi `OrderFlowSignal`.

## 14) File impact du kien

- `scratch/recompute_dark_flow.py`
- `backend/portfolio/order_flow_history.py` hoac file helper tuong ung
- `backend/portfolio/tests/test_order_flow_history.py` hoac file test tuong ung
- `docs/recompute_dark_flow_spec_20260422.md`