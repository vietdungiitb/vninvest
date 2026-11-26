# AUDIT PLAN — `cvd-1d-history-be` (độc lập, chỉ đọc)

- **Ngày audit:** 2026-11-26
- **Base:** `origin/dev @ ce1e08138` (`git rev-parse HEAD` = `ce1e081384b23a6a85f5d34429b6dc4837ffbcc6`)
- **Worktree:** `D:/Mujoco Projects/wt/cvd-1d-history-be`, branch `feat/cvd-1d-history-be`
- **Đối tượng:** `docs/PLAN_CVD_1D_HISTORY_BE_20261126.md` (122 dòng, file untracked)
- **Phạm vi:** đối chiếu plan ↔ code thật; không sửa code, không sửa plan, không đụng `docs/CLAIMS.md`, không commit.

## VERDICT CUỐI

**`NEED_REVISION`** — 3 objection (2 major, 1 minor). Plan đúng về phần lớn bằng chứng và
đã trung thực ghi SHA không tồn tại, nhưng có 3 điểm sai/mơ hồ ở mức cần sửa **trước khi khai claim**:

- **O1 (major)** — Fixture parity `net=0` làm AC-3 mất khả năng phát hiện bug reset cumulative.
- **O2 (major)** — Nhận định "`1D bucket_ts = local midnight`" sai; representation bucket zero-fill
  chưa được quy định, dễ tạo bucket lệch 7 giờ so với bucket materialized.
- **O3 (minor)** — Empty payload "kèm 4 field history" mâu thuẫn với yêu cầu "legacy giữ nguyên 100%" /
  AC-1; thêm vào đó `delta` top-level history chưa được định nghĩa rõ.

Kết luận: **chưa đủ điều kiện chuyển sang khai claim + code**; sửa 3 objection dưới đây rồi mới mở claim.

---

## 1. Xác nhận các con số/citation mà plan nêu

| Plan nêu | Thực tế @ `ce1e08138` | Kết luận |
|---|---|---|
| `views.py:389` = `SessionFactsCvdView.get` | `get` định nghĩa tại `views.py:368`; class tại `:347`; `:389` là **câu gọi** `_get_materialized_session_facts` | **Sai nhẹ** (line trỏ vào call site, không phải def) |
| `_get_materialized_session_facts` `:53-65` | `views.py:53-65` đúng | Đúng |
| Lọc bucket 1 session `views.py:418` (hàm `:75-88`) | `views.py:418` = call site; helper `:75-88` | Đúng |
| Cache v2 `views.py:406-407,464` | `:406` revision, `:407` key `core:cvd_series:v2:...`, `:464` `cache.set(timeout=_CVD_SERIES_CACHE_TTL)` với TTL 30s (`:283`) | Đúng |
| Cumulative per-session reset `session_facts_engine.py:155-165` | `:155` `cumulative_cvd = 0.0`; `:156-159` cộng dồn; `:162` `round(cumulative_cvd, 2)` | Đúng |
| `1D bucket_ts = local midnight` `session_facts_engine.py:88-93` | `:88-98` `_floor_bucket`; nhánh 1D `:91-92` = `dt.replace(hour=0, minute=0)` trên **`executed_at` UTC** (`:132-133` gán UTC nếu naive; DB trả aware UTC vì `USE_TZ=True`, `settings.py:356`). Endpoint dùng `dj_timezone.localtime(...)` tại `views.py:449` ⇒ bucket_ts thực tế là **07:00+07:00**, không phải 00:00+07:00 | **Sai** — xem O2 |
| `_DARK_MONEY_PERIOD_DAYS` `:352-358` | `market_data/stock_mgmt_native_views.py:352-358` = `{1M:30, 3M:90, 6M:180, 1Y:365, 10Y:3650}`; dùng tại `:2115` | Đúng |
| `_normalize_dark_money_period:1235` | `:1235-1237`, default `3M`, fallback `3M` (không trả 400) | Đúng |
| A2 helper `:1070-1160` dùng `buy_value/sell_value`, UTC midnight | `:1156-1157` `buy_value`/`sell_value`; `:1148-1149` `datetime.combine(..., time.min).replace(tzinfo=dt_timezone.utc)` | Đúng |
| Hotfix import `DailyPrice` `:2105-2107` | `:2104-2107` import `UnifiedAlert` rồi `DailyPrice` tại method scope, comment nêu rõ UnboundLocalError | Đúng |
| Composite index `models.py:141-144` (`:143`) | `SessionFactsBucket.Meta.indexes` tại `:141-144`, phần tử `:143` = `models.Index(fields=['session_facts','window','bucket_ts'])`, có `:142` = `['symbol','session_date','window','bucket_ts']` | Đúng — **không cần migration** |
| SHA `32b2e98a` / `30f7ef4e` | `git cat-file -t 32b2e98a` → `fatal: Not a valid object name`; `git cat-file -t 30f7ef4e` → `fatal: Not a valid object name`; `git cat-file -t ce1e08138` → `commit` | Plan **đúng** khi ghi `KHÔNG XÁC MINH` (`:6-8`, `:68`) |
| `BE_REQUEST_CVD_1D_HISTORY_2026-11-26.md`, 183 dòng | `Get-ChildItem -Recurse -Filter 'BE_REQUEST_CVD_1D_HISTORY*'` → **không có file** trong worktree | **Không xác minh được** nguồn yêu cầu; plan đã nói dùng nội dung chat nhưng vẫn ghi số "183 dòng" |

### Bổ sung citation plan không nêu (có ảnh hưởng)

- `session_facts_engine.py:56-63,247-268,374-392`: `_SERIES_WINDOWS_BY_LABEL` **có '1D': 1440**;
  `_build_bucket_rows` sinh bucket cho cả 5m/15m/30m/1h/4h/1D và materializer ghi vào
  `SessionFactsBucket` ⇒ tiền đề "widget nhận 1 bucket cho window=1D" **có thật**, A1 khả thi.
- `market_serving/native_views.py:492-557`: `build_whale_buckets` là **third implementation** đã tự
  fill từ DailyPrice theo giờ local (`:525` `timezone.localtime`, `:553-554` `make_aware` local midnight).
  Plan chỉ xét A1 và A2 (`market_data`), **bỏ sót implementation này** — xem O2.
- `stock_mgmt_native_views.py` **không import** `market_serving.views` (chỉ `market_serving.models`
  tại `:573,:1176,:1630,:1940`); chiều ngược lại `market_serving.views` cũng không import module này
  ở module scope. `user_workspace/portfolio_analytics_views.py:2850` import `market_serving.views`
  tại method scope. ⇒ **không có vòng import** khi import `_DARK_MONEY_PERIOD_DAYS` tại method scope.
- `views.py:369-372` gọi `require_pat_scopes_or_human_session(request, 'market:read')` **trước** khi parse
  `window`/`trade_date` ⇒ AC-7 đúng; test tương đương tại `test_session_facts_api.py:455-462`.

---

## 2. Findings

### O1 — MAJOR — Fixture `net=0` triệt tiêu khả năng test AC-3

- **Vị trí plan:** `docs/PLAN_CVD_1D_HISTORY_BE_20261126.md:65` — *"Test parity dùng fixture có
  các session trước **net=0** để **cả hai** dạng đều đúng"*.
- **Code liên quan:** `session_facts_engine.py:155-158` (reset cumulative mỗi session), `views.py:450`
  (đọc `cumulative_cvd` materialized), plan `AC-3` tại `:76`, `AC-4` tại `:77`.
- **Thực tế:** AC-4 **như viết tại `:77` chỉ liệt kê `delta`, `buy_volume`, `sell_volume`, `bucket_ts`**
  — **không** liệt kê `cumulative_cvd`. Vậy AC-3 và AC-4 **không mâu thuẫn nội tại**; plan dựng một
  "mâu thuẫn" rồi tự giải bằng fixture net=0. Hệ quả: nếu mọi session trước `net=0`, cumulative
  liên tục (`Σ delta[0..i]`) **bằng đúng** cumulative reset-per-session ⇒ implementation bug reset
  vẫn **đỏ xanh AC-3**. Đây là điểm có giá trị nhất của slice mà test lại không đo được.
- **Tác động:** AC-3 (invariant cốt lõi của widget) có thể PASS giả.
- **Đề xuất sửa plan:** bỏ điều kiện "session trước net=0"; thay bằng: (a) AC-3 dùng ít nhất **1 session
  trước có net ≠ 0** (vd `-300M`) và assert công thức `Σ delta[0..i]`; (b) AC-4 so sánh riêng
  `delta/buy_volume/sell_volume/bucket_ts`, **không** so cumulative; (c) giữ ghi chú giới hạn về
  cumulative đã reset nhưng không dùng net=0 làm công cụ hợp nhất.

### O2 — MAJOR — "`1D bucket_ts = local midnight`" sai; zero-fill chưa có representation thống nhất

- **Vị trí plan:** `:23` (bảng bằng chứng) và `:46` (bucket "local ISO +07:00"), `:49`/`AC-9` (zero-fill).
- **Code thật:** `session_facts_engine.py:91-92` floor **trên datetime UTC** (`:132-133` naive→UTC;
  `settings.py:354` `Asia/Ho_Chi_Minh`, `:356` `USE_TZ=True`); `views.py:449` `localtime(...)` ⇒
  bucket 1D materialized trả về `T07:00:00+07:00`. Trong khi `market_serving/native_views.py:553-554`
  fill DailyPrice tại **00:00+07:00**. Hai subsystem lệch 7 giờ.
- **Tác động:** nếu implementer đọc `:23` rồi tạo bucket zero-fill ở `00:00+07:00`, chuỗi history sẽ trộn
  `07:00+07:00` (bucket thật) và `00:00+07:00` (bucket giả) cho các ngày khác nhau — vẫn "tăng dần"
  nhưng x-position không đều, và AC-4 parity so `bucket_ts` với legacy dễ lệch nếu ngày đó là ngày fill.
- **Đề xuất sửa plan:** sửa `:23` thành *"1D bucket_ts = UTC midnight, endpoint chiếu sang `07:00+07:00`"*;
  quy định rõ zero-fill bucket_ts phải là `dj_timezone.localtime(datetime.combine(date, time.min, UTC))`
  (= `07:00+07:00`) để **khớp bucket materialized**, kèm 1 test assert cùng định dạng cho bucket thật và bucket fill.

### O3 — MINOR — Empty payload / `delta` top-level chưa rõ, va với AC-1

- **Vị trí plan:** `:38` ("legacy giữ nguyên 100%"), `:42` (thêm `period/history/date_from/date_to`),
  `:48` ("Scalar top-level lấy từ SessionFacts mới nhất"), `:50` ("Rỗng: ... kèm 4 field history"),
  `AC-1` tại `:74`.
- **Code thật:** `_build_empty_cvd_payload` (`views.py:91-112`) là helper **dùng chung** cho cả 2 nhánh
  empty tại `:396-402` (thiếu SessionFacts) và `:421-427` (thiếu bucket). Sửa helper để luôn thêm 4 field
  ⇒ **legacy empty response cũng đổi**, vi phạm "legacy giữ nguyên 100%". Ngoài ra `SessionFacts`
  (`models.py:80-101`) **không có field `delta`**; legacy `delta` được tính từ bucket tại `views.py:429-431`.
- **Tác động:** AC-1 có thể fail trên nhánh empty; implementer không biết `delta` history lấy từ đâu.
- **Đề xuất sửa plan:** tách rõ — (a) 4 field history **chỉ** thêm ở history path (truyền cờ vào helper
  hoặc build payload riêng), legacy empty giữ nguyên 101 field cũ; (b) `delta` history = `Σ delta` của
  các bucket giữ lại (cùng công thức `views.py:429-431`), các scalar khác lấy từ SessionFacts mới nhất
  theo `session_date`; (c) định nghĩa "mới nhất" = `max(session_date)` và `revision = max(computed_at)`.

---

## 3. Kiểm tra các case plan bị hỏi

| Case | Plan có không? | Đánh giá |
|---|---|---|
| `period` với window ≠ 1D | `:37-38` — bỏ qua, backward compatible | Có, nhưng **không có AC/test** cho `window=15m&period=999M`. Nên thêm AC-11 để khoá "không 400". |
| `trade_date` precedence | `:39`, `AC-8:81`; code `views.py:387-389` parse rồi truyền vào helper | Có. Chưa có case `trade_date + period=999M` → đề xuất gộp vào AC-8. |
| Cache v3 revision | `:54`, `AC-6:79` | Có, nhưng `revision=max(computed_at)` (`:48`) ⇒ đổi `computed_at` của session **không phải max** thì max không đổi, AC-6 sai. Test phải dùng `computed_at > max cũ` (lưu ý `models.py:101` `auto_now=True`: phải `.update()` hoặc patch). Xem O3(c). |
| Zero-fill DailyPrice | `:49`, `AC-9:82`; kế thừa A2 `stock_mgmt_native_views.py:1118-1136` | Có ý tưởng, **sai representation** — O2. Nên tham chiếu `market_serving/native_views.py:541-557` thay vì A2. |
| 10Y cap 2600 | D-2 `:55-57`, `AC-10:83` | Có; so sánh `_DARK_MONEY_PERIOD_DAYS['10Y']=3650` ngày lịch (`:357`) vs 2600 phiên — hợp lý, có ghi "cần Owner confirm". Test cần tạo >2600 bucket (nặng) — chấp nhận. |
| Empty payload | `:50` | Có nhưng mơ hồ — O3. |
| Auth | `AC-7:80`; code `views.py:369-372` trước mọi parse | Có. |
| `__str__` line | plan `:26` ghi `models.py:141-144` | Đúng (`:141-144`), không phải lỗi. |
| Circular import / UnboundLocalError | plan `:25` chỉ trích hotfix, chưa thành constraint code | **Rủi ro thấp**: không có import ngược `market_serving.views` từ `market_data` (chỉ `.models` tại `:573,:1176,:1630,:1940`). Tuy nhiên import `_DARK_MONEY_PERIOD_DAYS` kéo cả module 4579 dòng với import nặng `:32-36` ⇒ đề xuất tách constant sang module dùng chung hoặc copy cục bộ + contract test. UnboundLocalError chỉ xảy ra nếu `DailyPrice` được dùng trước câu `import` trong cùng `get()` — plan nên ghi ràng buộc "import 1 lần, dùng sau import". |

---

## 4. Kết luận

Plan **không bị REJECT**: kiến trúc A1 đúng, bằng chứng phần lớn khớp code thật, index đã có
(`models.py:143`), SHA được ghi trung thực là không tồn tại. Nhưng **chưa sẵn sàng khai claim** vì
O1 làm invariant chính mất khả năng test, O2 sai kiến thức timezone có thể phát sinh bucket lệch 7h,
O3 để legacy empty response đổi shape.

**Hành động bắt buộc trước khi claim:** sửa 3 objection trong plan (cập nhật bảng bằng chứng `:23`,
định nghĩa lại fixture AC-3 tại `:65` và AC-4 tại `:77`, làm rõ `:38/:48/:50`), sau đó auditor re-check
1 lần. Không đụng `docs/CLAIMS.md`, không sửa `views.py`, không commit trong phiên audit này.

---

## ROUND 2 (re-check)

- **Ngày:** 2026-11-26 · **Base:** `origin/dev @ ce1e08138` (không đổi) · **Auditor:** độc lập, chỉ đọc.
- **Đối tượng:** `docs/PLAN_CVD_1D_HISTORY_BE_20261126.md` **đã sửa**, 132 dòng (round 1: 122 dòng).
- **Phương pháp:** đọc trực tiếp plan mới, đối chiếu từng objection với nội dung thật + code @ `ce1e08138`;
  **không tin** tóm tắt của người giao việc. Round 1 ở trên được **giữ nguyên làm lịch sử**; phần này là verdict hiện hành.

### 2.1 Trạng thái O1/O2/O3

| Objection round 1 | Yêu cầu sửa | Nội dung plan mới (citation) | Kết luận |
|---|---|---|---|
| **O1 (major)** fixture `net=0` triệt tiêu AC-3 | (a) AC-3 fixture có ≥1 session net≠0; (b) AC-4 không so cumulative; (c) bỏ câu "ép cumulative bằng nhau" | `:85` — *"**Fixture bắt buộc có ≥1 session trước net ≠ 0** (vd `-300M`) để bug reset bị phát hiện; KHÔNG dùng fixture net=0"* · `:86` — *"**Không so `cumulative_cvd`** (đã reset per-session ở nguồn)"* · `:73` — *"**Không** dùng fixture net=0 để 'ép' cumulative bằng nhau — điều đó làm AC-3 mất khả năng phát hiện bug reset… mặc định chọn AC-3 là invariant cốt lõi"* | **RESOLVED** |
| **O2 (major)** "`local midnight`" sai, zero-fill lệch 7h | (a) sửa `:23` thành UTC midnight → 07:00+07:00; (b) zero-fill = `localtime(combine(date, min, UTC))`; (c) test assert cùng format | `:23` — *"1D bucket_ts = **UTC midnight**, endpoint chiếu sang **07:00+07:00**… Zero-fill phải tạo `datetime.combine(date, time.min, UTC)` rồi `localtime()` ⇒ **07:00+07:00**, khớp bucket thật. KHÔNG copy `native_views.py:553-554`"* · `:54` — công thức zero-fill lặp lại trong contract · `:91` (AC-9) — *"bucket_ts **07:00+07:00** như bucket thật"* · `:74` — *"Có test assert cùng định dạng cho bucket thật và bucket fill"* | **RESOLVED** |
| **O3 (minor)** empty payload + `delta` top-level mơ hồ | (a) 4 field chỉ history path, không sửa helper chung; (b) `delta` = Σ delta bucket; (c) "mới nhất" = `max(session_date)`, `revision = max(computed_at)` | `:56-58` — *"payload rỗng **do history path tự build**… **KHÔNG sửa** `_build_empty_cvd_payload` (`views.py:91-112`) vì helper dùng chung cho legacy empty (`views.py:396-402,421-427`) — legacy empty giữ nguyên 100%"* · `:48-49` — *"`delta` top-level = `Σ delta` các bucket giữ lại (cùng công thức `views.py:429-431`, **không** đọc field `delta`… `models.py:80-101`)"* · `:50-52` — *"`session_date = max(session_date)`… `revision = max(computed_at)`"* | **RESOLVED** |

Không còn objection nào từ round 1.

### 2.2 Kiểm tra các bổ sung mới (đối chiếu trực tiếp)

| Bổ sung | Plan mới | Đối chiếu code / mâu thuẫn nội tại |
|---|---|---|
| Zero-fill `07:00+07:00` | `:23`, `:54`, `:74`, `:91` | Khớp `views.py:449` (`localtime`) + `session_facts_engine.py:91-92,132-134`; khớp `settings.py:354,356`. Không trộn với 00:00+07:00 của `market_serving/native_views.py:553-554`. **Không có mâu thuẫn mới.** |
| `delta` top-level = Σ delta | `:48-49` | Khớp công thức legacy `views.py:429-431`; đúng khi `SessionFacts` không có field `delta` (`models.py:80-101`). Tương thích D-2 cắt 2600 bucket (`:63-64`): sum trên phần giữ lại. **Không có mâu thuẫn mới.** |
| Empty payload tách riêng | `:56-58` | Đúng hướng: helper chung `views.py:91-112` được dùng ở cả `:396-402` và `:421-427`; không sửa ⇒ AC-1 (`:83`) giữ nguyên. **Không có mâu thuẫn mới.** |
| Fixture AC-3 net≠0 | `:85`, `:73` | Kết hợp `:86` (AC-4 bỏ cumulative) ⇒ AC-3 giờ là discriminator thật; không còn "cả hai dạng đều đúng". **Không có mâu thuẫn mới.** |
| AC-11 | `:93` — `window=15m&period=999M` → bỏ qua, 200, legacy, không có `history` | Nhất quán `:37-38`. **Không có mâu thuẫn mới.** |
| AC-8 mở rộng | `:90` — `trade_date + period=999M` → thắng, không 400 | Nhất quán `:39` (*bỏ qua period hoàn toàn*). Precedence phải là check `trade_date` trước validate `period` — plan đã ghi rõ. **Không có mâu thuẫn mới.** |
| AC-6 làm rõ | `:88` — dùng `computed_at > max cũ` + `.update()` do `models.py:101` `auto_now=True` | Nhất quán `:51` (`revision = max(computed_at)`); sửa đúng điểm round 1 §3 nêu. **Không có mâu thuẫn mới.** |

### 2.3 Reservation (minor — không chặn claim)

- **R1 — kiểu của `revision` / `updated_at`:** plan `:51` viết `revision = max(computed_at)` (datetime)
  nhưng `:52` viết `updated_at = localtime(revision)`; trong khi legacy `views.py:406` dùng
  `revision = int(facts.computed_at.timestamp())` (int) và `views.py:445` dùng
  `localtime(facts.computed_at)`. `localtime()` cần datetime ⇒ hai dòng `:51-52` chỉ nhất quán nếu
  `revision` là datetime, nhưng khi đó `revision` history khác kiểu legacy (`views.py:444`) và cache
  key v3 (`:62`) chứa chuỗi datetime có dấu cách. Cần chốt khi code: giữ `revision` = **int Unix**
  (`int(max(computed_at).timestamp())`) và `updated_at = localtime(max(computed_at))`, hoặc tách 2 biến.
  Đây là làm rõ lúc implement, **không phải mâu thuẫn plan ở mức blocker**.
- **R2 — anchor của `start`/`end`:** cache key v3 (`:62`) và `date_from`/`date_to` (`:42`) dùng
  `{start}:{end}` nhưng plan chưa định nghĩa mốc (hôm nay `timezone.localdate()` hay session mới nhất)
  và tính inclusive/exclusive; đối chiếu `stock_mgmt_native_views.py:2119-2120` dùng
  `end_date = timezone.localdate(); start_date = end_date - timedelta(days=period_days)`. Nên chốt
  cùng công thức này để parity dark-money. **Không phải mâu thuẫn mới do round 2 tạo ra** (đã là khoảng
  trống từ round 1), chỉ là reservation khi implement.

### 2.4 VERDICT ROUND 2

**`AGREE`** — kèm 2 reservation nhỏ (R1, R2 ở §2.3). **0 objection còn lại** (O1/O2/O3 đều `RESOLVED`).

**Kết luận:** plan **đã đủ điều kiện chuyển sang khai claim + code**. Có thể mở claim
`cvd-1d-history-be` và bắt đầu TDD theo §8; R1/R2 phải được chốt trong lúc implement (không cần sửa plan
thêm, không cần vòng audit thứ 3). Giữ nguyên các limits: BE test chỉ trên VPS staging, DB tạm
`cvd1d_verify`, ghi `CHƯA CHẠY` nếu thiếu env; SHA `32b2e98a`/`30f7ef4e` vẫn ghi `KHÔNG XÁC MINH`.

Phiên round 2 này **không** sửa code, **không** sửa plan, **không** đụng `docs/CLAIMS.md`, **không** commit.
