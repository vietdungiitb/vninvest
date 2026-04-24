# Implementation Plan: Whale Analytics Performance and Scale (2026-04-24)

## 1. Muc tieu

Tai lieu nay tong hop giai phap tang toc load cho Whale Bubble Chart + Dark Money/CVD chart, dong thoi de xuat kien truc scale khi co hang nghin nguoi dung cung truy cap tinh nang nay.

Muc tieu nghiep vu:
- Giam thoi gian mo chart lan dau de nguoi dung khong co cam giac "chart dang treo".
- Giam so lan fetch du lieu thua va giam payload truyen qua mang.
- Duy tri tooltip, hover, sync chart on dinh khi co nhieu diem du lieu.
- Chuyen tu mo hinh "moi user vao moi tu tinh lai" sang "precompute + cache + fan-out" de scale duoc.

Chi tieu de xuat:
- P50 first chart data ready < 1.2s tren mang binh thuong.
- P95 first chart data ready < 2.5s trong gio giao dich.
- P95 API response cho payload chart < 300ms khi da co cache nong.
- Giam it nhat 60-80% tong byte payload tren moi lan load chart so voi hien tai.

## 2. Nhan dinh tu codebase hien tai

### 2.1 Frontend dang lay du lieu rong hon nhu cau hien thi

Trong `frontend/src/hooks/useWhaleAnalyticsData.js` hien tai:
- Bubble API luon duoc goi voi `timeframe: 'session'`, sau do frontend moi loc lai theo `15m`, `30m`, `1h`, `morning`, `afternoon`.
- Dark money API luon goi voi `period: '1M'`, sau do frontend moi loc lai theo timeframe dang xem.

He qua:
- User xem `15m` nhung van tai payload ca phien bubble.
- User xem intraday nhung van tai dark flow cua ca 1 thang.
- CPU frontend mat them chi phi normalize, filter, map series, re-render.

### 2.2 Moi lan vao chart la 2 request song song, chua co cache hop nhat theo symbol/timeframe

Hien tai moi view Whale Analytics se goi it nhat:
- `getWhaleOrdersBySymbol(symbol, ...)`
- `getDarkMoneyHistory(symbol, ...)`

Neu 1,000 nguoi cung mo cung mot ma trong gio giao dich:
- 2,000 request gan nhu dong thoi cho cung mot tap du lieu logic.
- Backend va DB bi lap lai cong viec aggregate giong nhau.

### 2.3 Polling 30 giay theo tab co nguy co tao thundering herd

Trong `useWhaleAnalyticsData.js`, khi timeframe la live thi frontend polling 30 giay/luc.

Neu 1,000 user dang mo trang:
- Khoang 2,000 request / 30 giay.
- Tuong duong khoang 66.7 request/giay chi rieng cho 2 endpoint nay.
- Neu khong co request coalescing/cache theo key, backend se lap lai tinh toan cho tung user.

### 2.4 Chart layer dang mang qua nhieu viec vao client

`WhaleBubbleChart.jsx` hien tai:
- Tu map bubble series.
- Tu tach CVD duong/am.
- Tu dung MA xu huong.
- Tu sync hover point.
- Tu xu ly tooltip tong hop cho bubble + flow.

Phan lon viec nay khong sai, nhung neu payload lon thi browser phai xu ly nhieu object JavaScript trong luc paint chart.

### 2.5 Chua co mo hinh "snapshot cho nhieu nguoi xem cung luc"

Hien tai kien truc phu hop cho quy mo nho-trung binh. Khi scale lon, can chuyen sang:
- mot tien trinh precompute theo symbol,
- cache snapshot trong Redis,
- frontend doc snapshot thay vi bat backend tinh lai tu dau.

## 3. Root causes gay cham load

### 3.1 Over-fetching payload

Day la van de lon nhat va de sua nhat:
- Lay full session bubble cho moi timeframe.
- Lay 1M dark flow cho moi view intraday.

Tac dong:
- Tang thoi gian query.
- Tang JSON serialize/deserialize.
- Tang CPU o frontend.
- Tang RAM browser khi co nhieu chart/tab.

### 3.2 Chua co response cache theo key nghiep vu

Can cache theo key:
- `whale:chart:{symbol}:{trade_date}:{timeframe}`
- `whale:flow:{symbol}:{trade_date}:{interval}`
- hoac tot hon: `whale:analytics:snapshot:{symbol}:{session}:{profile}`

### 3.3 Backend van co kha nang aggregate online tren request path

Neu request path con phai:
- doc tick,
- group bucket,
- tinh cvd,
- tinh strength,
- phan loai bubble,
- format payload,

thi kha nang scale se kem hon cach precompute snapshot 1 lan roi phuc vu nhieu lan.

### 3.4 Polling dong pha

Nhieu trinh duyet mo cung luc se polling cung nhip 30s, tao dot tai den backend.

## 4. Giai phap de xuat theo 4 lop

## 4.1 Lop 1 - Quick wins co the dua vao dot nang cap nay

### A. Stop over-fetching ngay tai API contract

De xuat thay doi contract:
- Bubble API tra dung timeframe dang can, khong bat frontend loc lai tu full session.
- Dark money API ho tro che do intraday gon: chi tra dung cua so `15m`, `30m`, `1h`, `morning`, `afternoon`, `session`.

Huong toi uu:
- `GET /api/whale/orders/{symbol}/?timeframe=15m&compact=1`
- `GET /api/dark-money/{symbol}/?window=15m&compact=1`

Neu van can full session cho mot so UX khac, tach ro:
- `mode=full_session`
- `mode=window_only`

Ky vong:
- Giam payload 50-90% tuy timeframe.

### B. Hop nhat 2 request thanh 1 snapshot endpoint cho chart

De xuat them endpoint tong hop:
- `GET /api/whale/analytics/{symbol}/?timeframe=15m`

Response gom:
- bubble orders da cat dung cua so,
- cvd series da cat dung cua so,
- strength series,
- price series trong phien,
- metadata (trade_date, session window, cache age, stale flag).

Loi ich:
- Giam 2 round-trip thanh 1.
- De cache theo key nghiep vu.
- Giam logic fan-out o frontend.

### C. Them compact payload mode

Chi giu truong can cho chart:
- bubble: `ts`, `price`, `volume`, `matched_value`, `side`, `is_extreme`
- flow: `ts`, `cvd`, `strength`
- price: `ts`, `price`

Khong gui cac field chi dung cho debug neu khong can.

### D. Giam khoi dong chart khi tab an / ngoai viewport

Frontend nen:
- chi fetch khi tab Whale thuc su duoc mo,
- tam dung polling khi tab browser background,
- resume khi user quay lai,
- them random jitter 0-5s cho polling de tranh dong pha.

### E. Skeleton + staged hydration

De cam nhan nhanh hon, UI nen:
- render khung chart + skeleton ngay lap tuc,
- do du lieu summary truoc,
- do chart sau,
- neu co cache cu thi hien snapshot cu ngay va silently refresh sau.

Nguoi dung thuong danh gia "cam nhan responsive" hon la thoi gian ky thuat thuan tuy.

## 4.2 Lop 2 - Cache va precompute o backend

### A. Redis snapshot cache theo symbol + session + timeframe

De xuat cache key:
- `whale:analytics:v2:{symbol}:{trade_date}:{timeframe}`

Noi dung cache:
- payload da serialize san hoac object Python da chuan hoa.

TTL de xuat:
- Trong gio giao dich: 5-15s
- Gio nghi trua: 60s
- Ngoai gio: 15-60 phut

Y nghia:
- 1 request dau tien tinh toan.
- 999 request sau doc lai cache.

### B. Request coalescing / single-flight

Khi cache miss va nhieu request cung den:
- chi 1 worker duoc phep tinh snapshot.
- cac request con lai cho ket qua tu key lock/single-flight.

Co the dung:
- Redis lock ngan han,
- hoac cache key dang-xu-ly.

Neu khong co coalescing, cache miss hang loat van la mot dot tai lon.

### C. Precompute theo symbol active thay vi tinh tren request

Nen co worker/Celery beat hoac realtime job:
- moi 5-15 giay tinh lai snapshot cho top symbol dang duoc xem nhieu,
- ghi vao Redis.

Nguon symbol de uu tien:
- tracked symbols cua user,
- symbol hot trong watchlist chung,
- symbol vua co whale signal moi.

Ket qua:
- request path chu yeu la `cache.get`.

### D. Tao bang/materialized store cho intraday minute snapshot

Thay vi moi request aggregate lai tu tick raw, can co bang minute-level:
- `symbol`
- `bucket_ts`
- `buy_value`
- `sell_value`
- `cvd`
- `strength`
- `last_price`
- `high`
- `low`
- `whale_buy_value`
- `whale_sell_value`

Tu do chart endpoint chu yeu la doc tu minute snapshot, khong can quet lai nhieu tick raw.

Day la giai phap can thiet neu muon scale tot khi nguoi dung tang nhanh.

## 4.3 Lop 3 - Scale cho hang nghin nguoi cung xem

### A. Fan-out mot lan, nhieu client cung dung

Mo hinh khuyen nghi:
- Pipeline realtime tinh snapshot 1 lan / symbol / bucket.
- Redis giu snapshot nong.
- API layer tra snapshot cho nhieu user.
- Co the nang cap len WebSocket/SSE de push delta thay vi client polling dong loat.

### B. Tiered service levels

Khong phai user nao cung can cung muc cap nhat:
- User dang hover/phan tich: 5-10s.
- User chi mo tab nhung khong active: 20-60s.
- User ngoai gio giao dich: gan nhu static snapshot.

Nen co chinh sach service theo tinh trang:
- in-focus,
- background tab,
- off-hours,
- inactive user.

### C. CDN/edge cache cho off-hours

Ngoai gio giao dich, du lieu whale chart gan nhu snapshot doc-nhieu.

Co the:
- cache response tai reverse proxy,
- cache theo symbol/timeframe trong 5-30 phut,
- phuc vu tu edge/proxy thay vi cham vao app + DB.

### D. Admission control va degraded mode

Khi tai he thong cao:
- uu tien tra compact payload,
- tam tat bieu do phu khong critical,
- giam tan suat refresh,
- fallback sang snapshot cu co `stale_age` ro rang.

Dieu nay tot hon viec de request timeout va user thay chart trong.

## 4.4 Lop 4 - Toi uu frontend rendering

### A. Tach preprocessing sang backend khi hop ly

Nhung viec co the lam san o backend:
- cat window timeframe,
- tinh MA trend line,
- tach CVD positive/negative neu can,
- tao legend metadata va summary.

Frontend chi nen:
- bind series vao chart,
- xu ly tooltip/interaction.

### B. On-demand tooltip richness

Tooltip dang tong hop kha nhieu thong tin HTML. Co the toi uu bang cach:
- dung string formatter gon hon,
- khong chen cac block debug khong can,
- chi hien top 1-2 bubble gan nhat thay vi nhieu bubble cung luc.

### C. Virtual chart state va memo boundaries

Nen dam bao:
- khong tao lai option object qua thuong xuyen neu data khong doi,
- polling silent chi update khi payload thuc su thay doi,
- so sanh checksum/version truoc khi set state moi.

### D. Lazy mount chart phu

Neu sau nay Whale Analytics co them card/mini chart phu:
- chart chinh mount truoc,
- chart phu mount sau khi idle,
- dung `requestIdleCallback` hoac deferred rendering.

## 5. Kien truc de xuat cho dot nang cap nay

## Phase A - Nen lam ngay trong dot nang cap hien tai

1. Them tai lieu va metric muc tieu.
2. Doi `useWhaleAnalyticsData` sang fetch dung timeframe, khong fetch full session/1M mac dinh.
3. Them `compact` payload mode.
4. Them polling jitter + pause khi tab an.
5. Them Redis cache cho response chart.
6. Them `cache_age_ms`, `generated_at`, `is_stale` vao payload.

Tac dong ky vong:
- Giam duoc phan lon do tre cam nhan ma chua can thay doi qua nhieu ha tang.

## Phase B - Nen lam sat ngay sau do neu quyet tam scale that

1. Tao endpoint hop nhat `whale analytics snapshot`.
2. Them worker precompute snapshot moi 5-15 giay cho symbol hot.
3. Them request coalescing.
4. Chuyen dần logic aggregate tick -> minute snapshot store.

Tac dong ky vong:
- Chiu tai tot hon khi nhieu nguoi xem cung ma.

## Phase C - Khi huong toi quy mo lon hon

1. SSE/WebSocket fan-out cho chart delta.
2. Reverse-proxy cache cho off-hours.
3. Adaptive quality/degraded mode theo load he thong.

## 6. Uoc tinh tai khi co 1,000 nguoi cung load

Neu giu mo hinh hien tai:
- 1 user mo chart => 2 request.
- 1,000 user => 2,000 request burst.
- Moi 30s lai co dot polling moi.

Neu payload trung binh 150-300KB/lan load:
- 1,000 user co the tao 300MB-600MB traffic cho mot dot mo chart/polling dau tien.

Neu chuyen sang snapshot endpoint + compact payload + Redis cache:
- moi user van co 1 request, nhung server khong tinh lai 1,000 lan,
- payload co the giam xuong con 30-80KB tuy timeframe,
- phan lon request chi la doc cache.

Do la khac biet giua:
- scale theo so user, va
- scale theo so symbol dang nong.

He thong nen toi uu theo so symbol nong, khong toi uu theo so user.

## 7. Observability can bo sung

Can do duoc thi moi biet toi uu co dung huong hay khong.

Metric de xuat:
- `whale_chart_api_latency_ms{endpoint,timeframe}`
- `whale_chart_cache_hit_ratio{endpoint,timeframe}`
- `whale_chart_payload_bytes{endpoint,timeframe}`
- `whale_chart_snapshot_build_ms{symbol}`
- `whale_chart_snapshot_lock_wait_ms`
- `whale_chart_frontend_time_to_first_paint_ms`
- `whale_chart_frontend_time_to_data_ready_ms`
- `whale_chart_poll_skipped_background_tab_count`

Canh bao:
- cache hit < 80% trong gio giao dich,
- P95 API > 500ms khi da bat cache,
- snapshot build > 1s cho symbol active,
- payload > nguong cho `15m`/`30m` view.

## 8. Ranh gioi thiet ke can luu y

### 8.1 Khong danh doi tooltip/hover de lay rendering speed mot cach mu quang

Truoc day chart da gap van de khi bat mot so config progressive qua manh thi tooltip diem bi anh huong. Vi vay:
- uu tien giam payload va giam preprocessing truoc,
- chi toi uu rendering sau khi da do benchmark.

### 8.2 Khong de frontend tro thanh noi hop nhat logic kinh doanh

Frontend nen dung snapshot da chuan hoa. Neu frontend tiep tuc tu loc, tu tach, tu quy doi qua nhieu, moi cap nhat chart se tiep tuc cham va kho audit.

### 8.3 Off-hours phai phuc vu tu snapshot phien gan nhat

Day vua la cai tien UX vua la cai tien hieu nang:
- ngoai gio khong can goi pipeline nang nhu trong gio,
- co the cache lau hon va phuc vu du lieu phien truoc.

## 9. Khuyen nghi tich hop vao dot nang cap Whale chart hien tai

De khong lam dot nang cap qua to, khuyen nghi nhap scope hieu nang nhu sau:

### Nhom bat buoc trong dot nay
- Cat dung payload theo timeframe thay vi fetch full session/1M.
- Them response cache Redis cho chart payload.
- Them polling jitter + pause khi tab background.
- Them metadata `generated_at`, `cache_age_ms`, `is_stale`.
- Dung snapshot phien truoc cho off-hours.

### Nhom rat nen lam neu con suc
- Tao endpoint hop nhat cho Whale Analytics chart.
- Them compact mode va minute price series cho bubble pane.

### Nhom de phase tiep theo
- Precompute symbol hot.
- Materialized minute snapshot store.
- SSE/WebSocket delta fan-out.

## 10. Definition of Done

- [ ] Chart `15m`, `30m`, `1h` khong con fetch full-session payload neu khong can.
- [ ] P95 response chart co cache < 300ms tren moi truong staging.
- [ ] Cache hit ratio chart trong gio giao dich >= 80% voi symbol hot.
- [ ] Polling khong chay khi tab background.
- [ ] Off-hours hien snapshot phien gan nhat, khong load vo ich nhu live session.
- [ ] Co audit trail trong `docs/CODE_CHANGE_AUDIT_LEDGER.md`.
- [ ] Co baseline/after metrics de doi chieu truoc rollout.

## 11. Ket luan

Neu chi sua rendering chart, toc do se cai thien mot phan nhung khong giai quyet goc re. Goc re nam o viec hien tai he thong dang:
- fetch du lieu rong hon nhu cau,
- aggregate qua nhieu tren request path,
- chua cache snapshot theo nghiep vu,
- chua co co che fan-out cho nhieu nguoi xem cung luc.

Huong dung nhat cho dot nang cap nay la:
- toi uu payload,
- them snapshot cache,
- phuc vu off-hours bang snapshot phien truoc,
- va buoc dau hop nhat thanh mot endpoint phuc vu chart.

Do la tap thay doi co ty le loi ich/chi phi tot nhat, dong thoi mo duong cho quy mo hang nghin nguoi dung ma khong de backend bi nghen theo so user.