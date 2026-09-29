# Implementation Plan - Whale Flow Analytics Audit & Fix

Tai lieu nay thay the plan Whale Bubble Chart cu va duoc chot theo huong coding-ready cho bai toan audit/fix Whale Flow Analytics tren Dark Money chart.

## 1) Muc tieu va pham vi

- Muc tieu chinh:
    - Sua sai lech Whale Buy/Sell tooltip tren Dark Money chart.
    - Lam cho Dark Flow Strength fallback khong con hien thi cac cot gan nhu dong deu.
    - Minh bach hoa che do fallback khi `OrderFlowSignal` rong.
    - Mo duong khoi phuc pipeline dark flow tu du lieu `IntradayTick` da co san.
- Ngoai pham vi cua slice nay:
    - Khong redesign lai toan bo Whale Bubble Chart.
    - Khong sua crawler ingestion toan dien trong cung PR neu chua xac dinh duoc root cause duplicate.

## 2) Hien trang da xac nhan trong codebase

### Backend

- Endpoint hien tai: `backend/portfolio/views_dark_money_history.py`
- `dark_flow_series` hien lay tu `OrderFlowSignal`; neu bang rong thi frontend tu tuong fallback.
- `_build_reference_price_by_trade_date(...)` dang phu thuoc batch OHLC service, chua tan dung candles vua fetch trong request.
- Whale aggregation dang group tu `IntradayTick` sau khi loc `matched_value >= whale_threshold_vnd`.
- Chua co `degraded_mode`, `degraded_reason`, `fallback_source` trong response contract.

### Frontend

- Component hien tai: `frontend/src/components/DarkMoneyMasterChart.jsx`
- `buildFallbackDarkFlowSeries(...)` dang sinh strength gan nhu hang so quanh moc `50 +/- 8`, gay cam giac cot dong deu.
- `OhlcTooltip` dang mac dinh whale info ve `0`, de gay hieu nham thanh co du lieu nhung gia tri bang 0.
- Chua co badge/hint thong bao chart dang dung du lieu synthetic/historical estimation.

### Du lieu va rui ro

- `OrderFlowSignal` rong voi DXG nen chart dang o fallback mode.
- Duplicate `IntradayTick` da duoc ghi nhan o DXG; neu khoi phuc pipeline ma khong co lop dedupe thi nguy co phong dai whale values va dark flow strength.
- `detect_and_store_order_flow(...)` hien la task realtime theo symbol; neu dung nguyen trang se khong backfill lich su theo ngay/khung thoi gian.

## 3) Nguyen tac implement

1. Fix o root cause quan sat duoc truoc: minh bach fallback + chan du lieu phinh to trong lop aggregate.
2. Tach thanh 3 slice doc lap de validate nhanh:
     - Slice A: backend resilience + contract.
     - Slice B: frontend transparency + tooltip correctness.
     - Slice C: pipeline recovery tooling.
3. Khong coi fallback synthetic la du lieu that.
4. Moi output fallback phai duoc danh dau ro trong payload va UI.
5. Khong backfill hang loat truoc khi co bao cao duplicate tick theo symbol/ngay.

## 4) Proposed Changes - Backend

### 4.1 `views_dark_money_history.py`

Muc tieu:
- Tang kha nang infer side dung ngay ca khi local price table thieu/stale.
- Minh bach fallback mode.
- Giam rui ro so lieu whale bi phong dai do duplicate tick.

Thay doi bat buoc:

1. Reference price fallback
- Refactor `_build_reference_price_by_trade_date(symbol, trade_dates, candles=None)`.
- Thu tu uu tien de map `trade_date -> prev_close`:
    1. Previous close tu `candles` da fetch trong cung request, theo quy tac as-of `trade_date`.
    2. Batch OHLC tu `MarketDataService` nhu hien tai.
    3. `DailyPrice` local neu hai nguon tren khong tra ve du.
- Log so `trade_date` khong map duoc reference price.

2. Whale aggregation hardening
- Bo sung buoc dedupe frame truoc khi infer side va group aggregate.
- Khoa dedupe uu tien:
    - `symbol`, `trade_date`, `trade_time`, `price`, `volume`, `side`, `match_type`, `stream_id` neu co.
    - Neu `stream_id` rong, fallback khoa tu nhien khong gom `stream_id`.
- Ghi diagnostic log:
    - `raw_tick_count`
    - `deduped_tick_count`
    - `qualified_tick_count`
    - `aggregated_signal_count`

3. Fallback/degraded response contract
- Them trong payload:
    - `degraded_mode: bool`
    - `degraded_reason: str`
    - `fallback_source: 'order_flow_signal' | 'synthetic_from_candles' | 'none'`
    - `diagnostics.whale_ticks_raw`
    - `diagnostics.whale_ticks_after_dedupe`
    - `diagnostics.whale_ticks_after_side_filter`
    - `diagnostics.order_flow_signal_count_raw`
    - `diagnostics.order_flow_signal_count_windowed`
- Quy tac bat `degraded_mode=true`:
    - `dark_flow_series` rong trong khi `candles` co du lieu.

4. Logging
- Khi vao fallback mode, log warning co cau truc:
    - `symbol`, `period`, `interval`
    - `candle_count`
    - `order_flow_signal_count_raw`
    - `order_flow_signal_count_windowed`
    - `whale_ticks_raw`
    - `whale_ticks_after_dedupe`
- Khong log qua chi tiet tung tick de tranh noisy logs.

Khong lam trong slice nay:
- Chua them DB `UniqueConstraint` cho `IntradayTick` neu chua co migration/cleanup strategy ro rang.
- Chua sua crawler writer trong cung PR nay.

### 4.2 Test backend bat buoc

File test du kien:
- `backend/portfolio/tests/test_dark_money_history.py` hoac file test gan nhat dang ton tai cho endpoint nay.

Case can co:
1. Fallback reference price uu tien candles khi `DailyPrice` thieu.
2. `inferred_side` van dung khi ref_price chi co tu previous-close cua candles.
3. Duplicate ticks bi dedupe truoc aggregate.
4. Payload bat `degraded_mode=true` khi `OrderFlowSignal` rong va candles ton tai.
5. Payload tat `degraded_mode` khi co `dark_flow_series` that.

## 5) Proposed Changes - Frontend

### 5.1 `DarkMoneyMasterChart.jsx`

Muc tieu:
- Biet ro chart dang o fallback mode.
- Fallback synthetic co hinh dang hop ly hon.
- Tooltip khong danh lua nguoi dung bang so 0.

Thay doi bat buoc:

1. Synthetic dark flow generation
- Refactor `buildFallbackDarkFlowSeries(candles)` thanh cong thuc phan biet muc do manh/yeu theo du lieu nen that.
- Cong thuc de xuat:
    - `body_pct = (close - open) / max(open, epsilon)`
    - `range_pct = (high - low) / max(low, epsilon)`
    - `volume_zscore` hoac volume ratio so voi rolling mean 5-10 bars
    - `raw_score = body_pct * w1 + range_pct * w2 + volume_ratio * w3`
    - normalize ve thang `0-100`, moc trung tinh `50`
    - smooth bang rolling average ngan 3 bars
- Muc tieu UX:
    - cot fallback khong phang deu
    - van giu duoc trung tinh quanh 50 khi khong co dong luc ro

2. Fallback badge
- Neu `data.degraded_mode === true`, hien badge o pane header:
    - VI: `Du lieu uoc tinh`
    - EN: `Synthetic data`
- Tooltip/help text kem theo:
    - VI: `Dark Flow Strength dang duoc uoc tinh tu bien dong gia va thanh khoan lich su do chua co OrderFlowSignal trong khung du lieu nay.`
    - EN: tuong duong.

3. Tooltip refinement
- `OhlcTooltip` phai phan biet 2 trang thai:
    - Co `whaleInfo`: hien value va count nhu hien tai.
    - Khong co `whaleInfo`: hien thong diep ro rang, khong render `0 (0)`.
- Copy de xuat:
    - VI: `Khong ghi nhan hoat dong to chuc lon o nen nay.`
    - EN: `No institutional activity detected on this bar.`

4. Contract consumption
- Frontend khong tu suy luan fallback chi bang `dark_flow_series.length === 0` nua.
- Uu tien doc `degraded_mode`, `degraded_reason`, `fallback_source` tu API.

### 5.2 i18n

Cap nhat:
- `frontend/src/i18n/vi.js`
- `frontend/src/i18n/en.js`

Them key toi thieu:
- `darkMoneyChart.syntheticBadge`
- `darkMoneyChart.syntheticHint`
- `darkMoneyChart.noInstitutionalActivity`
- `darkMoneyChart.fallbackReasonNoSignals`

## 6) Proposed Changes - Data Pipeline Recovery

### 6.1 Script backfill

File de xuat:
- `scratch/recompute_dark_flow.py`
- Spec chi tiet: `docs/recompute_dark_flow_spec_20260422.md`

Ly do dat o `scratch/`:
- Day la operational script phuc vu audit/backfill co kiem soat, chua phai command san xuat lau dai.

Yeu cau bat buoc:
- Input arguments:
    - `--symbol DXG`
    - `--start-date YYYY-MM-DD`
    - `--end-date YYYY-MM-DD`
    - `--dry-run`
    - `--limit-days N` (optional)
- Script KHONG chi goi truc tiep `detect_and_store_order_flow(symbol=...)` theo cach hien tai, vi task do dang realtime-oriented.
- Script can lap theo tung ngay va goi detector/history helper moi neu can.

Neu chua co helper lich su:
- Tao helper backend thuan Python cho phep tinh order flow tren tap `IntradayTick` theo `symbol + trade_date`.
- Task Celery realtime tiep tuc dung cho luong online; script backfill dung helper chung, khong tiep tuc duplicate logic.

### 6.2 Guard rails truoc khi backfill

Bat buoc co report truoc khi ghi `OrderFlowSignal`:
- so tick raw theo ngay
- so tick sau dedupe theo ngay
- tong whale value truoc/sau dedupe
- ngay nao vuot nguong bat thuong

Rule an toan:
- Neu ty le duplicate > nguong da chot (vi du 10-15%), script chi log canh bao va bo qua ngay do, tru khi co `--force`.

## 7) Verification plan

### 7.1 Automated

Backend:
- Chay test slice cua endpoint dark money history.
- Chay `backend/audit_whale_logic.py` sau khi backend xong de doi chieu aggregate whale values.

Frontend:
- Kiem tra component/file errors tren `DarkMoneyMasterChart.jsx` va i18n files.
- Browser verification can xac nhan:
    - badge `Du lieu uoc tinh` xuat hien khi khong co `OrderFlowSignal`
    - tooltip khong con hien `0 (0)` trong case khong co whale info
    - dark flow fallback bars co bien thien, khong dong deu bat thuong

### 7.2 Manual UAT

Ma uu tien:
- DXG
- 2 ma co `OrderFlowSignal` that de so sanh real vs fallback

Checklist:
1. Case `OrderFlowSignal` rong:
- Chart hien badge fallback.
- Bar synthetic co dao dong hop ly, khong flat deu.
- Tooltip whale khong gay hieu nham.

2. Case co `OrderFlowSignal` that:
- Khong hien badge fallback.
- Tooltip whale van hien gia tri khop voi aggregate.

3. Case duplicate tick:
- So whale value sau dedupe giam xuong muc hop ly.
- Khong con ngay bat thuong bi phong dai vo ly.

## 8) Risk register

1. Duplicate tick root cause chua duoc sua o crawler
- Tac dong: backfill va dashboard van co the bi tai nhiem so lieu sai.
- Giam thieu: dedupe trong aggregate + report duplicate ratio + tach ticket crawler.

2. Synthetic formula qua nhay hoac qua phang
- Tac dong: chart fallback van kem tin cay.
- Giam thieu: clamp 0-100, smooth 3 bars, UAT tren ma co volatility khac nhau.

3. Backfill ghi tin hieu sai do dung detector realtime cho du lieu lich su
- Tac dong: `OrderFlowSignal` duoc tao khong dung y nghia.
- Giam thieu: dung helper history-specific, khong tai su dung mu quang task realtime.

## 9) Danh sach dich vu nen

### 9.1 Luong realtime dang ton tai

1. Celery worker
- Nhiem vu:
    - chay `detect_and_store_order_flow(...)` cho luong online/realtime
    - ghi `OrderFlowSignal` moi khi detector phat hien strength/signal du nguong
- Gioi han:
    - khong phu hop de backfill lich su theo ngay, vi detector hien tai duoc thiet ke theo cua so thoi gian gan hien tai

2. Celery beat
- Nhiem vu:
    - len lich trigger detector realtime
    - duy tri tan suat quet cho cac ma theo doi/watchlist
- Gioi han:
    - khong nen dung de chay replay hang loat lich su

3. API dark money history
- Tep: `backend/portfolio/views_dark_money_history.py`
- Nhiem vu:
    - doc `OrderFlowSignal` da ton tai
    - aggregate `IntradayTick` cho whale tooltip
    - tra ve degraded/fallback metadata cho frontend
- Vai tro:
    - day la read path, khong phai background writer

### 9.2 Luong backfill de xuat

1. Script van hanh thu cong
- Tep de xuat: `scratch/recompute_dark_flow.py`
- Nhiem vu:
    - chay theo `symbol + date range`
    - lap report duplicate ratio
    - recompute va ghi lai `OrderFlowSignal` cho cac ngay hop le
- Cach dung:
    - chi chay khi co phe duyet va sau khi da review output dry-run

2. History helper dung chung
- Nhiem vu:
    - tinh dark flow tren tap `IntradayTick` lich su cua tung `trade_date`
    - duoc script backfill goi lai de tranh duplicate logic
- Nguyen tac:
    - tach rieng voi task realtime
    - khong buoc script backfill phai tai su dung detector online nguyen xi

### 9.3 Ket luan kien truc

- Co backfill trong plan, nhung no khong nam trong danh sach dich vu nen realtime hien huu.
- Realtime services gom `celery_worker`, `celery_beat`, va API read path.
- Backfill la mot luong operational rieng, duoc chay co kiem soat qua script + history helper, khong dua vao scheduler realtime.

## 10) Rollout strategy

### Phase A - Safe visibility
- Ship backend contract + frontend badge/tooltip + fallback synthetic.
- Chua backfill ngay.

### Phase B - Controlled recovery
- Chay script report duplicate/dedupe cho DXG.
- Review output.
- Chi backfill ngay nao da qua guard rails.

### Phase C - Hardening follow-up
- Mo ticket rieng cho crawler/db ingestion:
    - root cause duplicate
    - can nhac constraint/idempotency key cho `IntradayTick`

## 11) Definition of done

- API tra `degraded_mode`, `degraded_reason`, `fallback_source` dung theo state that.
- Whale aggregate co lop dedupe truoc khi tinh toan.
- Fallback dark flow chart khong con hien cac cot gan nhu bang nhau trong case DXG.
- Tooltip khong render `Whale Buy 0 (0)` / `Whale Sell 0 (0)` khi khong co whale data tren nen dang hover.
- Script backfill/report co the chay theo `symbol + date range` va xuat thong tin duplicate ratio.
- Co test/verification toi thieu cho backend va frontend slice vua sua.

## 12) File impact checklist

- `backend/portfolio/views_dark_money_history.py`
- `backend/portfolio/tests/test_dark_money_history.py` hoac file test tuong ung hien huu
- `frontend/src/components/DarkMoneyMasterChart.jsx`
- `frontend/src/i18n/vi.js`
- `frontend/src/i18n/en.js`
- `scratch/recompute_dark_flow.py`
- `docs/CODE_CHANGE_AUDIT_LEDGER.md`
- `PROGRESS_DASHBOARD.md`

