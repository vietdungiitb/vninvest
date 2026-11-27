# AUDIT ĐỘC LẬP — PLAN_MARKET_DATA_INTEGRITY_1127 (ngày 2026-11-27)

- **Scope:** `docs/PLAN_MARKET_DATA_INTEGRITY_1127.md` (204 dòng, file chưa track) đối chiếu với RFC `BE_REQUEST_MARKET_DATA_INTEGRITY_CVD_WHALE_2026-11-27.md` (181 dòng) và audit phản biện `AUDIT_REBUTTAL_BUBBLE_AXIS_CVD_DATA_INTEGRITY_2026-11-27.md` (139 dòng), cả hai đọc từ worktree `D:\Mujoco Projects\wt\be-req-market-data-integrity-1127` (CHỈ ĐỌC).
- **Vai trò:** Auditor độc lập cấp Staff+ (subagent). **Không phải tác giả plan**; không sửa plan, RFC, code, CLAIMS hay ledger. Chỉ tạo đúng file verdict này.
- **Baseline commit:** `9507ca45ee7a82735a25bc7ed490a6491545ad7c` (`git rev-parse origin/dev` = cùng giá trị; `git log --oneline -1` = `9507ca45e Merge pull request #584 ...`; branch `docs/mdi-plan-1127`). RFC ghi baseline `35f4242de` — đã kiểm `git cat-file -t 35f4242de` → `commit` (tồn tại, nhưng cũ hơn).
- **Phương pháp (mọi dòng dưới đây đều tự mở đọc):** `read` trực tiếp các file BE runtime: `data_ingest/tasks.py` (320–409, 425–569, 2500–2639, 2695–2739, 3060–3104), `market_data/vnbroker_adapter.py` (140–194, 1035–1139), `market_data/models.py` (280–339, 455–524), `market_serving/session_facts_engine.py` (1–249, 314–373), `market_serving/models.py` (60–147), `market_serving/views.py` (381–665), `market_serving/native_views.py` (388–507, 590–689), `market_serving/urls.py` (toàn file), `market_serving/materializers.py` (177–220), `signal_intelligence/tasks.py` (255–314), `signal_intelligence/order_flow_engine.py` (1–264), `signal_intelligence/models.py` (76–110), `service_ops/domain_configs/signals.py` (28–87), `vninvest_core/settings.py` (660–677), danh sách migration head của `market_data`/`market_serving`, `docs/AGENT_PROTOCOL.md` §2/§3, `docs/LESSONS/{verification,backend,multi-agent}.md`. Chạy 3 lệnh read-only theo yêu cầu. **Không chạy** pytest/build/npm install, không đụng staging/Docker/DB.

---

## Verdict

**NEED_REVISION** — 12 objections (O1..O12), trong đó **2 P0 chặn implement**:

- **O1 (P0):** Số migration S3 sai — plan ghi `market_data/migrations/0013_*.py`, "head hiện `0012_dailyprice_price_source_adj_factor.py`". Thực tế đã có `0013_s2_vintage.py` **và** `0014_alter_pricerebaserun_status.py`. Đây đúng lỗi "trùng số migration" đã ghi ở `docs/AGENT_PROTOCOL.md:16`.
- **O2 (P0):** Fail-before test của S3/M03 là **false-green** — `backfill_intraday_tick_system` có presence check `already_exists` tại `data_ingest/tasks.py:2557-2568`, nên chạy 2 lần thì lần 2 `return {'status': 'skipped'}` **trước khi** tới `bulk_create(..., ignore_conflicts=True)` ở `:2604`. Test "chạy ×2 không tăng row" xanh ngay trên code cũ, chưa cần `dedup_key`.

Ai đóng, ở bước nào:
- O1 → **tác giả plan**, ngay B4 (đồng thuận), trước khi khai claim S3; re-verify head sau rebase (L-003).
- O2, O4, O5 → **tác giả plan + coordinator**, sửa AC/fail-before trong B4; không được coi S3/S5 "xong" nếu chưa có test đỏ thật.
- O3, O7, O8 → **tác giả plan**, bổ sung thiết kế trước khi mở S4/S2.
- O6 → **Owner** (Q1/Q8), chốt trước khi deploy S5.
- O9–O12 → **tác giả plan**, sửa citation/AC/điều phối trong B4.

---

## Bảng kiểm chứng citation

### §1 — Bằng chứng hiện trạng (plan dòng 31–43)

| plan claim | plan file:line | thực tế file:line | khớp? | ghi chú |
|---|---|---|---|---|
| F-01 `_hydrate_intraday_symbols` | `data_ingest/tasks.py:425-564` | `tasks.py:425` def, `:564` end của `return {...}` | ✅ | — |
| F-01 `:458` chỉ lấy 1 trang tape | `tasks.py:458` | `raw_trades = list(tape_result.get('trades') or [])` | ✅ | — |
| F-01 `:513` gọi `_build_intraday_bar_payloads` | `tasks.py:513` | đúng | ✅ | — |
| F-01 định nghĩa helper `:376-404` | `tasks.py:376-404` | `:376` def, `:404` return | ✅ | — |
| F-01 `:537-543` ghi đè OHLCV | `tasks.py:537-543` | `bulk_create(update_conflicts=True, update_fields=['open','high','low','close','volume','source'])`, `:542` unique_fields | ✅ | — |
| F-01 `synthesize...:3076+` tổng hợp từ toàn bộ tick DB | `tasks.py:3076+` | `:3076` name registration, `:3081` def, docstring `:3083-3089` xác nhận đọc DB ticks | ✅ (citation hơi lỏng) | nên trỏ `:3081-3089` |
| F-02 guard `side_raw not in ('BUY','SELL')` | `signal_intelligence/tasks.py:280-283` | `:281` if, `:282` continue, `:283` gán side | ✅ | trong `_bulk_write_whale_canonical` (`:250`) |
| F-02 `_load_session_rows` lọc `whale_tick:` | `session_facts_engine.py:101-116` | `:112` `alert__source_ref__startswith='whale_tick:'` | ✅ | — |
| F-03 hardcode `match_type` tại `:1116` | `vnbroker_adapter.py:1111-1118` | `:1116` `'match_type': 'NormalMatch'` | ✅ | docstring `:1045` khai trả match_type ✅ |
| F-03 `_normalize_intraday_trade_row` default `:356` | `tasks.py:338-358` | `:356` `str(trade.get('match_type') or 'NormalMatch')[:50]` | ✅ | `:329-335` `_normalize_intraday_side` map lạ → UNKNOWN ✅ |
| F-03 "không có chuẩn hóa session_phase ở cả 2 nơi" | (hai file trên) | grep `session_phase` trong 2 range → không có | ✅ | — |
| F-04 `IntradayTick` có các field, không unique | `market_data/models.py:299-334` | class thật `:302-334`; fields `:313-324`; Meta `:326-334` **không** có unique | ⚠️ lệch 3 dòng | `:299` là `__str__` của `IntradayBar` |
| F-04 `IntradayBar` có unique tại `:292` | `models.py:292` | `:292` là `models.Index(...)`; `unique_together` thật `:295` | ❌ | sai dòng |
| F-04 `ignore_conflicts=True` `:2604`, `:2717` | `tasks.py:2604`, `:2717` | đúng cả 2 | ✅ | `:2605/:2718` `created += len(batch)` đếm cả bản bị ignore (log sai số) |
| F-04 dedup trong bộ nhớ `:479-505` | `tasks.py:479-505` | `:479-491` existing keys, `:493-505` dedup theo `(timestamp,price,volume,side,match_type)` | ✅ | — |
| F-05 docstring nguồn Whale `:40-42` | `session_facts_engine.py:40-42` | đúng | ✅ | — |
| F-05 query thẳng WhaleAlertCanonical `:101-116` | `session_facts_engine.py:101-116` | đúng (`:108-114`) | ✅ | — |
| F-05 `_WHALE_THRESHOLD_VND = 200M` `:54` | `session_facts_engine.py:54` | đúng | ✅ | — |
| F-05 `WHALE_VALUE_MIN_VND = 500M` `:31` | `order_flow_engine.py:31` | đúng | ✅ | — |
| F-05 engine CVD trên 100% tick `:69-112`, `:119-181` | `order_flow_engine.py:69-112`, `:119-181` | đúng (`load_session_ticks_df`, `compute_cvd_buckets_df`) | ✅ | "chỉ ghi scalar" kiểm thêm qua grep: `signal_intelligence/tasks.py:131-156`, `:438-467` (plan không trích dòng này) |
| F-06 `:139-142` buy/sell, `:144` total += mọi side | `session_facts_engine.py:127-146` | đúng | ✅ | — |
| F-06 `:220-221` `delta_strength_pct`/`dark_flow_score` lấy mẫu số từ `total_value` bị pha loãng | `session_facts_engine.py:220-221` | dòng đúng, **nhưng** `:216` `total_value = total_buy + total_sell` (`:214-215` chỉ cộng `bucket['buy']`/`['sell']`) ⇒ mẫu số **đã loại** UNKNOWN | ❌ | xem O4; `bucket['total']`ô nhiễm chỉ đi vào `:186`, `:189`, `:197-198`, `:212` |
| F-06 `views.py:518-519,638-639` trả `whale_aggregate` | `market_serving/views.py:518-519`, `:638-639` | đúng (2 path: history + single-day) | ✅ | — |
| F-06 `urls.py:24` route cvd | `market_serving/urls.py:24` | đúng | ✅ | — |
| Cấu hình retention `:34-36`, validate `:56-59` | `service_ops/domain_configs/signals.py` | `:34`=7, `:35`=365, `:36`=90; `:56-59` chỉ check tick≥7 & canonical≥180 | ✅ | — |
| Schema đích `SessionFactsBucket:115-147`, fields `:130-134` | `market_serving/models.py` | đúng, chưa có 8 field mới | ✅ | — |
| `GlobalSymbolCoverage:455-521`, `detail:495`, freshness `:485-491` | `market_data/models.py` | đúng | ✅ | — |
| whale-feed `data_quality` `:479,:607,:677-678` | `native_views.py` | đúng | ✅ | — |
| `urls.py:35-37` 2 route whale-feed | `market_serving/urls.py:35`, `:37` | đúng | ✅ | — |
| Gates: `check-multi-agent` exit 0, hooks `.githooks` | plan `:43` | tự chạy: exit `0`, "0 lỗi, 0 trùng số migration — PASS"; `git config core.hooksPath` = `.githooks` | ✅ | plan ghi "~30 dòng warning"; output thực **~130 dòng warning** (305 dòng tổng) — undercount |

### §2 — CONTRADICTIONS (plan dòng 49–57)

| plan claim | plan file:line | thực tế file:line | khớp? | ghi chú |
|---|---|---|---|---|
| C-1 guard đã có từ `6e50418a9`, không sửa `tasks.py:280-283` | plan `:51` | `signal_intelligence/tasks.py:281-282` | ✅ | re-scope đúng |
| C-2 200M vs 500M | plan `:52` | `session_facts_engine.py:54` vs `order_flow_engine.py:31` | ✅ | — |
| C-3 `:145-155` chia UNKNOWN 50/50 | plan `:53` | `order_flow_engine.py:145-155` (comment `:145`, gán `:154-155`) | ✅ | giữ hàm cũ là đúng |
| C-4 không có `trade_seq` | plan `:54` | `market_data/models.py:310-321` (field thật `:313-324`) | ✅ | — |
| C-5 dùng `detail` JSONField `:495` | plan `:55` | `market_data/models.py:495` | ✅ | — |
| C-6 RFC baseline `35f4242de` cũ | plan `:56` | `git cat-file -t 35f4242de` = `commit`; `origin/dev` = `9507ca45e` | ✅ | — |
| C-6 "`_hydrate...` ở `:425`, RFC `:511` là thân hàm" | plan `:56` | `tasks.py:425` ✅; `:511-543` đúng là thân bar-builder | ✅ | — |
| C-6 "`IntradayTick` ở `:299` (RFC `:302-337`)" | plan `:56` | class thật `models.py:302-334`; RFC `:302-337` **gần đúng hơn plan** | ❌ | plan tự gán sai rồi chê RFC — xem O9 |
| C-7 F-02 hết lỗi code, 5 cái còn | plan `:57` | đối chiếu từng dòng ở bảng §1 ở trên | ⚠️ | đúng except F-06 bị hiểu sai mẫu số (O4) |

---

## Findings

| ID | ERROR/GAP/RISK | Mức | file:line | Thực tế | Tác động | Đề xuất fix |
|---|---|---|---|---|---|---|
| F1 | ERROR | **P0** | plan `docs/PLAN_MARKET_DATA_INTEGRITY_1127.md:97`; `market_data/migrations/` | Head thật `0014_alter_pricerebaserun_status.py`; đã tồn tại `0013_s2_vintage.py`. Plan ghi head `0012` và đặt tên `0013_*`. | Trùng số migration ⇒ `Conflicting migrations; multiple leaf nodes`, chặn deploy (`AGENT_PROTOCOL.md:16`). | Xoá số cứng; ghi "để `makemigrations` sinh, head phải re-verify sau rebase"; cập nhật §3 S3 + §4 M03. |
| F2 | ERROR | **P0** | `data_ingest/tasks.py:2557-2568`, `:2604`; plan `:99` | Presence check trả `skipped` ở lần 2 trước khi tới `bulk_create`. | Fail-before test xanh trên code cũ → vi phạm L-V04 (`docs/LESSONS/verification.md:73-86`); tưởng I-6 đạt trong khi chưa có dedup. | Test phải tạo điều kiện có conflict thật (xoá row presence-check fixture hoặc gọi trực tiếp đường ghi có overlap), assert số conflict ≥1, assert `dedup_key` unique, kèm test dương tính. |
| F3 | GAP | P1 | `data_ingest/tasks.py:2557-2568`, `:2604`, `:2595`; plan `:108-111` | S4 chain backfill sẽ **skip** toàn bộ canary đã có tick; nếu không skip thì `ignore_conflicts=True` cũng không update `match_type`. | Dữ liệu ATC cũ vẫn `NormalMatch`/side cũ ⇒ I-3 không đạt, probe 0% khó đạt dù plan cam kết. | S4 phải có bước xoá/UPDATE `IntradayTick` theo `(symbol, date)` cho canary **trước** re-backfill, nằm trong snapshot + Owner gate Q2. |
| F4 | ERROR | P1 | `session_facts_engine.py:214-221` vs plan `:38`, `:89`, `:142` | `total_value` tại `:216` = `total_buy + total_sell`, đã loại UNKNOWN. `delta_strength_pct`/`dark_flow_score` **không** bị 50B pha loãng. `bucket['total']` ô nhiễm chỉ vào `:186/:189/:197-198/:212`. | AC M04 và fail-before test plan hướng sai đối tượng → có thể xanh giả trên code cũ (giống F2). | Đổi AC thành assert `buy_strength`/`institutional_strength` đổi khi thêm 50B unknown; hoặc expose rõ `total` bucket trong payload để test assert trực tiếp. |
| F5 | RISK | P1 | `market_serving/views.py:415-418` (cache v4), `:603` (cache v2); plan `:117-120` | Cache key không chứa `metric`. | `?metric=market` và `?metric=whale` trả cùng 1 payload cache ⇒ test "market_total>=whale_total" vô nghĩa, dữ liệu sai cho widget. | Đưa `metric` vào cache key + bump version (`v3`/`v5`), invalidate khi deploy; thêm test gọi 2 metric liên tiếp khác nhau. |
| F6 | RISK | P1 | plan `:118`, `:175`; `market_serving/views.py:638-639`; RFC `:84`, `:95`, `:179-180` | Plan vừa hứa "caller cũ không truyền `metric` không vỡ", vừa đổi default sang `market` khi `full_tick`. Shape 200 vẫn giữ nhưng **ngữ nghĩa số liệu đổi** cho mọi caller hiện hữu (widget đang đọc `buy_volume` là Whale CVD). | Phá vỡ "tương thích ngược 100%" của RFC §4; widget hiển thị nhãn sai nếu cutover không đồng bộ. | Giữ default `whale` cho đến khi widget bật `metric=market` (opt-in), hoặc Owner chốt breaking change + Q8 cutover đồng bộ; ghi rõ trong contract. |
| F7 | GAP | P1 | `signal_intelligence/models.py:76-95`; plan `:108`; RFC `:77` | `WhaleAlertCanonical` **không có** field `session_phase` hay `match_type`; chỉ có `side`, `executed_at`, `matched_value`, `source_ref` qua `alert` (`:81-86`). | Predicate cleanup "hoặc `session_phase` đấu giá" không implement được; I-3 cũng trỏ field không tồn tại. | Viết lại predicate dùng `executed_at` (kèm timezone ICT) + `alert__source_ref__startswith='whale_tick:'`; ghi chú RFC/I-3 cần hiệu chỉnh field. |
| F8 | GAP | P1 | `order_flow_engine.py:88-93` (`.values(... 'side')`), `:244-259` (`detect_whale_ticks` lọc side); plan `:87-89` | Plan chỉ target adapter backfill + `_normalize_intraday_trade_row`, không nêu đường detect. Match_type bị bỏ ở `load_session_ticks_df`; nếu test seed `IntradayTick(side='BUY', match_type='ATC')` thì whale row vẫn tạo. | I-3 có thể không đạt dù test ingest xanh; CHƯA XÁC MINH thiết kế fixture của `test_auction_isolation.py`. | Nêu rõ normalization đặt ở write-path (mọi ingest path: live `:149-164`, backfill `:1103-1118`, hydrate `:338-358`) để side='UNKNOWN' trước detect; thêm test ở cả 2 tầng + assert `detect_whale_ticks` loại tick đó. |
| F9 | GAP | P2 | plan `:36`, `:40`, `:56`, `:77`; `market_data/models.py:302`, `:295`; `data_ingest/tasks.py` 3398 dòng | Nhiều citation/stale count: `IntradayTick :299` (thật `:302`), `IntradayBar unique :292` (thật `:295`), "~3100 dòng" (thật 3398), "~30 dòng warning" (thật ~130). | Lặp lại lỗi `AGENT_PROTOCOL.md:17` (citation thối) ngay trong slice lập kế hoạch. | Re-verify toàn bộ `file:line` trước B4; ghi rõ lệnh tái tạo cho mỗi con số. |
| F10 | GAP | P2 | `data_ingest/tasks.py:2619-2623`; `market_serving/materializers.py:177-208`; plan `:108` | Chain có sẵn là `detect → materialize_session_facts → synthesize_intraday_bars_from_ticks`; `backfill_session_facts_buckets` là management command riêng, **không** nằm trong chain. | S4 mô tả sai thứ tự và sai task; thực thi theo plan có thể bỏ sót rebuild session facts. | Sửa mô tả chain theo `:2619-2623`; quyết định rõ gọi command `backfill_session_facts_buckets` riêng hay dùng `materialize_session_facts` (hiện vẫn đọc WhaleAlertCanonical tại `session_facts_engine.py:328-335`). |
| F11 | GAP | P2 | plan `:79`, `:89`, `:99`, `:109`, `:119`, `:129` | Chỉ S1 có dạng Given/When/Then đúng; S2–S6 viết dạng "tick...→assert", thiếu Given/When/Then và test dương tính tường minh. RFC `:86-97` có đủ 10 AC GWT. | Khó nghiệm thu fail-before đúng chuẩn; dễ rơi vào bẫy L-V04. | Bổ sung GWT + assert dương tính cho từng slice, map ngược REQ→AC ID. |
| F12 | GAP | P2 | plan `:93` (S3 gắn Q6), `:186`; `session_facts_engine.py:54` | Q6 (đổi 200M→500M) được gắn vào tiêu đề S3 nhưng file đích S3 không có `session_facts_engine.py`; cũng không có AC/test ghim thay đổi ngưỡng. | Quyết định Owner bị "treo" không có chỗ thực thi; lịch sử `whale` field đổi nghĩa không được đo. | Chuyển Q6 vào S2 (đã target `session_facts_engine.py`) hoặc S5; thêm AC + test ghim threshold 500M trước/sau. |

**Đánh giá tích cực (có bằng chứng):** C-1 (plan `:51`) là phản biện đúng và quan trọng — sửa `signal_intelligence/tasks.py:280-283` thật sự là sửa cái đã đúng (`tasks.py:281-282`). Plan cũng có owner gate rõ cho thao tác phá dữ liệu (`:17`, `:111`, `:182`: Q2 mặc định KHÔNG, S4 khóa), ghi `CHƯA CHẠY` trung thực cho pytest/build/probe (`:161-165`), và tách claim/branch/PR theo slice (`:63`) đúng `AGENT_PROTOCOL.md:45-53`.

---

## Cổng đã chạy / CHƯA CHẠY

| Lệnh | Exit code | Output ngắn (nguyên văn) |
|---|---|---|
| `cd "D:\Mujoco Projects\wt\mdi-plan-1127"; node packages/web/scripts/check-multi-agent.mjs` | **0** | `0 lỗi, 0 trùng số migration — PASS`; kèm nhiều dòng `! CLAIMS.md dòng N: file "..." không tồn tại trong worktree này` (khoảng 130 dòng, từ dòng 258 đến 2092). **Không chặn.** |
| `git status --short` | — | `?? docs/PLAN_MARKET_DATA_INTEGRITY_1127.md` (trước khi audit tạo file này). Không có thay đổi code/migration. |
| `git log --oneline -1` | — | `9507ca45e Merge pull request #584 from vietdungiitb/docs/ssot-adjustment-rev2` |
| `git rev-parse origin/dev` (bổ sung) | — | `9507ca45ee7a82735a25bc7ed490a6491545ad7c` |
| `git config core.hooksPath` (bổ sung) | — | `.githooks` |
| `git cat-file -t 35f4242de` (bổ sung) | — | `commit` |
| `pytest` / BE test trên Postgres | **CHƯA CHẠY** | Theo yêu cầu subagent audit (read-only); plan §5 `:162` cũng ghi CHƯA CHẠY. |
| `npm run build` / `npx tsc --noEmit` | **CHƯA CHẠY** | Không sửa FE; plan §5 `:163` ghi CHƯA CHẠY. |
| `makemigrations --check --dry-run` | **CHƯA CHẠY** | Chưa có thay đổi model; plan §5 `:161` ghi CHƯA CHẠY. |
| Probe staging đọc/ghi | **CHƯA CHẠY** | Không đụng staging; plan `:164-165` ghi CHƯA CHẠY/bị khóa Q2. |

---

## Câu hỏi cần làm rõ

1. **Owner:** Q2/Q8 — ai bấm nút snapshot/cleanup/backfill trên VPS `14.225.255.47`, khung giờ nào? Plan đã mặc định KHÔNG nếu im lặng (`:17`, `:182`) — giữ nguyên hay cho phép canary?
2. **Tác giả plan:** sau khi xác nhận head `0014`, S3/S5 sẽ để `makemigrations` sinh số mấy và re-verify ở bước nào (L-003)?
3. **Tác giả plan:** fail-before M03/M04 được sửa thế nào để **đỏ thật trên code cũ**? Có chạy thử với fixture đã có trùng/unknown trước khi cam kết không (L-V02, L-V04)?
4. **Coordinator:** S5 đổi default `metric` sang `market` có cần widget cutover đồng bộ không, hay giữ opt-in `?metric=market`? (`AGENT_PROTOCOL.md:35` — ghi vào claim nếu đụng shared file.)
5. **Tác giả plan:** S4 có xoá/sửa `IntradayTick` cũ cho canary không, hay chỉ cleanup `WhaleAlertCanonical`? Nếu không, I-3/I-1 lấy gì đảm bảo?
6. **Tác giả plan:** Q6 đặt ở S2 hay S5? AC/test ghim threshold 500M ở đâu?
7. **Coordinator:** S6 sửa `vninvest_core/settings.py` (beat `15:15`) có cần xin ý kiến như ghi chú tại `data_ingest/tasks.py:3310` không? (File không nằm trong deny list `AGENT_PROTOCOL.md:27-33`, nhưng là file cấu hình dùng chung.)

---

## Kết luận

**Implementable có điều kiện — chưa sẵn sàng cho B5.** Plan có nền evidence tốt (hầu hết §1 khớp code thật, phản biện C-1 chính xác, có owner gate cho dữ liệu phá huỷ và ghi `CHƯA CHẠY` trung thực), nên **không REJECT**. Nhưng **2 blocker P0** phải sửa trước khi khai claim/code:

1. Số migration `0013` đã bị chiếm (F1) — lặp lại đúng sự cố `AGENT_PROTOCOL.md:16`.
2. Fail-before M03 xanh giả do presence-check (F2) — vi phạm trực tiếp L-V04 mà plan có nhắc ở `:8`, `:199`.

Sau đó sửa 6 finding P1 (F3–F8), đặc biệt là mẫu số M04 bị hiểu sai (F4), cache key `metric` (F5), và field `session_phase` không tồn tại (F7). Ưu tiên sửa theo thứ tự **O1 → O2 → O4 → O5 → O3/F7/F8 → O6 → O9–O12**, tất cả trong vòng B4 tối đa 3 lần sửa (plan `:173`).

Khi đã sửa, yêu cầu re-audit độc lập (B3 vòng 2) chạy lại đúng 3 lệnh ở bảng "Cổng đã chạy" + xác nhận migration head bằng `Get-ChildItem .../migrations/*.py` trước khi Owner phê duyệt Q1.
