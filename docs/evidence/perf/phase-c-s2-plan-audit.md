# Audit độc lập — PLAN Phase C S2 (`docs/PLAN_PHASE_C_S2_20261121.md`)

- **Ngày**: 2026-11-21 · **Auditor**: subagent độc lập (chỉ đọc, không sửa code)
- **Verdict**: **Round 1 NEED_REVISION (O1–O4) → Round 2 AGREE (+reservation minor O7–O9, xem §Round 2 cuối file)**
- **Phạm vi đọc thật**: plan toàn bộ · `market_data/global_symbol_coverage.py:1-822` · `promotion_fast_path.py:40-80` · `data_ingest/tasks.py:260-302` (read-only) · `session_facts_engine.py:384-400` · `test_global_symbol_coverage.py` toàn bộ + grep mọi lời gọi · `vninvest_core/settings.py:746-756` + `:354-356` · `PLAN_FAST_DATA_SERVICE_20261121.md:1-51` (§Phase C/S2 dòng 25-31) · `global_symbol_registry.py:140-301` · `market_data/models.py:407-495` · grep `test_gap_inventory.py`
- **Cách tái hiện mọi con số**: mỗi objection kèm lệnh/grep + `file:line` cụ thể bên dưới. Không bịa line.

## Kết luận nhanh

Thiết kế throttle theo `last_verified_at` đúng hướng (cơ chế storm đã xác minh: `_upsert_coverage_row` luôn rewrite `last_verified_at` ⇒ UPDATE mỗi lần gọi dù data không đổi) và claim "không vỡ test cũ" là **ĐÚNG**. Nhưng plan **lệch REV.2 ở 2 điểm** (bỏ guard freshness, T mặc định 600 ≠ "chu kỳ ingest nhanh nhất"), **điều kiện skip thiếu khóa `reference_trade_date`** (O1), và **AC1 `assertNumQueries ≤ 2` không khả thi** khi đuôi `refresh_global_symbol_registry` vẫn chạy (O2). Sửa O1–O4 rồi mới implement (dự kiến ở B4/fail-before của agent `phase-c-s2`, re-audit độc lập trước merge; AC6 staging Owner-gated giữ nguyên).

## Đối chiếu REV.2 (§Phase C/S2, `PLAN_FAST_DATA_SERVICE_20261121.md:25-31`)

| Yêu cầu REV.2 | Plan S2 | Kết quả |
|---|---|---|
| Skip nếu `last_verified_at` mới hơn T | Có (§3.3) | ✓ khớp |
| **VÀ `freshness_state` không đổi hướng xấu** (`:28`) | **Bỏ显式** (§3 KHÔNG so sánh freshness) | ✗ lệch → **O3** |
| T mặc định = chu kỳ ingest nhanh nhất | T=600, lý luận "≥ nhịp nhanh nhất, ≈ rotation 9 phút" | ~ lệch giá trị mặc định → **O5** (reservation) |
| Không đổi signature, không caller flag | Giữ nguyên | ✓ khớp |
| Readers re-check + ngưỡng T ghi evidence (O5 REV.2) | Có promotion_fast_path, planner, SOC UI, gap inventory | ✓ khớp (paraphrase reader đúng — kiểm tra `promotion_fast_path.py:60-79`: None→`True` `:63-64`, FRESH→`False` `:66-67`, còn lại dedup `:70-77` rồi `True` `:79`) |
| AC phụ O6: COUNT(*) 2.5M từ `_build_daily_prices_payload:378` | Không nhắc O6 trong AC | ⚠ thiếu trace — nhưng không blocker (throttle diệt cả COUNT vì skip trước mọi `_build_*`) |

## O1 (blocker) — Điều kiện skip không khóa `reference_trade_date` ⇒ skip sai ngày tham chiếu

- **Code thật**: `refresh_global_symbol_coverage` tính `verified_at` (`global_symbol_coverage.py:474`) và `reference_trade_date` (`:475`) **độc lập**; mọi hàm freshness đều phụ thuộc `reference_trade_date` (`_resolve_daily_price_state:147-155`, `_resolve_intraday_state:158-172`, `_resolve_snapshot_state:175-190`, `_resolve_session_facts_state:193-208`). Điều kiện skip của plan (§3.3) chỉ so `last_verified_at` với `verified_at`, **không nhắc gì tới `reference_trade_date`**.
- **Lỗ hổng 1 — midnight rollover**: ingest loop (`data_ingest/tasks.py:288-289`) chốt `effective_trade_date = reference_trade_date or timezone.localdate()` mỗi batch. Rows verify 23:55 ngày D; batch 00:05 ngày D+1 có `reference_trade_date=D+1` nhưng `last_verified_at` mới 10 phút (< T=600s biên) ⇒ **skip, trả rows tính trên nền D+? thực chất là D** — freshness của D+1 không bao giờ được tính lại trong cửa sổ T.
- **Lỗ hổng 2 — caller trộn ngày**: `session_facts_engine.py:395` gọi `refresh_global_symbol_coverage(upserted_symbol, reference_trade_date=target_date)` với `as_of=None` (⇒ `now()`). Ngay sau ingest vừa verify `reference=today`, một materializer backfill với `target_date` quá khứ gọi refresh ⇒ `last_verified_at` mới ⇒ **skip, trả rows của `today` cho yêu cầu `target_date`** (detail JSON vẫn ghi `reference_trade_date` cũ — sai âm thầm).
- **Tái hiện**: `refresh('FPT', reference_trade_date=D, as_of=T0)` → `refresh('FPT', reference_trade_date=D+1, as_of=T0+60s)` ⇒ dưới thiết kế plan, lần 2 skip (tuổi 60s < 600s) và trả rows có `detail.reference_trade_date == D`.
- **Đề xuất fix (không migration)**: chỉ skip khi `reference_trade_date` yêu cầu trùng với `detail.reference_trade_date` của cả 5 rows cache (lookup 1 query đã fetch full rows thì đọc `detail` tốn 0 query thêm). Ghi rõ vào §3 và thêm AC mới (đổi ngày ⇒ recompute).

## O2 (blocker) — AC1 "assertNumQueries ≤ 2" không đếm đuôi `refresh_global_symbol_registry`

- **Code thật**: skip path theo plan vẫn phải đi qua (1) `_resolve_registry` — `GlobalSymbolRegistry.objects.get` = **1 SELECT** khi input là `str` (`global_symbol_coverage.py:110-113`); (2) coverage lookup = **1 SELECT**; (3) `refresh_global_symbol_registry(registry)` hiện **gọi vô điều kiện** ở `:488`, nội bộ tốn **+2 SELECT** (`demand_sources.filter` tại `global_symbol_registry.py:220-222` và `coverage_rows.values` tại `:153-161`, vì input đã là object nên không tốn `.get` ở `:284-287`) + có thể 1 UPDATE (`:297-300`, thường không đổi sau verify mới ⇒ 0).
- **Đếm**: skip với input `str` = **4 SELECT tối thiểu**, không phải 2. AC1 (`plan:32`: "registry resolve + coverage lookup") **không budget cho đuôi registry** và cũng không nói lookup phải fetch full objects (nếu dùng `.values()` thì "trả về đúng 5 rows" còn tốn thêm query nữa).
- **Tái hiện**: đếm query trong `assertNumQueries` trên skip path sau khi implement đúng §3 hiện tại (không đụng `:488`) ⇒ ≥ 4.
- **Đề xuất fix (chọn 1, ghi vào plan)**: (a) skip luôn cả `refresh_global_symbol_registry` trên skip path (registry summary stale ≤ T — chấp nhận được; test hiện tại assert summary ở `test_global_symbol_coverage.py:104-108` chỉ chạy full-compute nên không ảnh hưởng) ⇒ budget **≤ 2 với input str / ≤ 1 với input object**, và AC1 phải pin loại input; hoặc (b) giữ đuôi ⇒ sửa budget thành **≤ 4 (str) / ≤ 3 (object)**. Hiện tại plan không chọn ⇒ AC1 fail chắc chắn theo hướng (a-hoặc-b) còn lại.

## O3 (major) — Bỏ guard "freshness không xấu đi" của REV.2; lý do plan đưa ra là sai kỹ thuật

- **Plan viết** (§3: "KHÔNG so sánh freshness (tránh recompute để biết 'có xấu đi không' — mâu thuẫn mục tiêu)"). **Sai**: REV.2 (`:28`) yêu cầu so **cached** `freshness_state` (đã nằm trong cùng 1 lookup query — thêm cột tốn **0 query**), không phải recompute. Không có mâu thuẫn mục tiêu nào ở đây.
- **Hậu quả A — MISSING-pinning sinh việc mới**: mã mới bootstrap 5 rows MISSING (AC2 đúng là không skip khi 0 rows, nhưng ngay sau bootstrap đã có 5 rows MISSING + `last_verified_at` mới). Data ingest vào trong cửa sổ T ⇒ skip giữ MISSING ⇒ planner `missing_only` + `promotion_fast_path.py:60-79` (non-FRESH ⇒ repair-True) **tiếp tục dispatch backfill cho dữ liệu đã có** — throttle tiết kiệm recompute nhưng đẻ repair thừa, bounded bởi T (~10 phút/repair cycle).
- **Hậu quả B — FRESH-pinning trễ repair thật**: cache FRESH nhưng dữ liệu vừa hỏng ⇒ reader FRESH (`:66-67` ⇒ `False`) bỏ repair ≤ T. Bounded, chấp nhận được nhưng plan chưa nêu bound này (plan chỉ nói "cùng lắm thêm việc" — thiếu chiều "trễ việc").
- **Tái hiện**: `refresh` mã trống → 5 rows MISSING → `DailyPrice.objects.create(...)` → `refresh` lại trong T ⇒ vẫn MISSING dưới thiết kế plan.
- **Đề xuất fix**: chỉ skip khi cả 5 cached `freshness_state ∈ {fresh, warm}` (tối thiểu: không chứa `missing`/`error`; `stale`/`unknown` do plan quyết — khuyến nghị loại luôn `stale` vì stale-pinning cũng trễ repair như B). Khôi phục tuân thủ REV.2, 0 query thêm. Thêm AC: "Given rows MISSING mới verify, When ingest thêm data + refresh lại, Then recompute (không skip)".

## O4 (minor nhưng phá AC4) — Toán tử biên T=0 chưa pin; công thức `>=` skip ngay cả khi T=0

- **Plan viết** (§3.3): skip **khi và chỉ khi** `mọi last_verified_at >= verified_at - T`. Với T=0 và 2 lần gọi cùng `as_of` (mọi test hiện tại dùng `as_of` cố định, VD `test_global_symbol_coverage.py:36,87-91`), lần 2 có `last_verified_at == verified_at` ⇒ `>=` đúng ⇒ **SKIP** — trái AC4 (`plan:34`: "T=0 … lần 2 vẫn recompute").
- **Tái hiện**: `override_settings(GLOBAL_..._THROTTLE_SECONDS=0)`, `refresh(reg, as_of=X)` × 2 cùng X ⇒ công thức plan skip lần 2.
- **Đề xuất fix**: pin công thức dạng tuổi `age < T` (`age = (verified_at - last_verified_at).total_seconds()`; `0 < 0` là False ⇒ T=0 **không bao giờ** skip, đúng AC4 với mọi cách viết test) và ghi显式 vào AC4 là 2 lần gọi dùng cùng hay khác `as_of` (với `age < T` thì cả hai đều recompute — robust).

## O5 (reservation — chủ sở hữu/implementer đóng khi viết evidence) — T=600 lệch chữ REV.2 nhưng có lý; cần ghi amendment

- REV.2 (`:28`) nói "T (mặc định = chu kỳ ingest nhanh nhất, ghi rõ)"; plan đặt 600s trong khi nhịp nhanh nhất là 60s (floor) / env default 180s (`settings.py:746-756`, job `:751-756`, comment rotation `:749` "full refresh ~9 phút").
- Kiểm tra tính hợp lý: staleness bound 600s nằm trong mọi fresh-window (`_SNAPSHOT_FRESH_WINDOW=15m` tại `global_symbol_coverage.py:52`, `_INTRADAY_FRESH_WINDOW=1h` tại `:54`, `_SESSION_FACTS_FRESH_WINDOW=30m` tại `:56`; daily FRESH dung sai 1 ngày tại `:58`). Kể cả operator hạ `PRICE_BOARD_INTERVAL_SECONDS=60`, bound 600s vẫn FRESH đối với snapshot. **Chấp nhận được về kỹ thuật.**
- Yêu cầu: evidence `phase-c-s2-gates.md` ghi 1 dòng amendment REV.2 ("T=600 ≈ rotation 9 phút thay vì = nhịp nhanh nhất, lý do …") để không đứt traceability; người đóng: agent implement ở B7.

## O6 (đã xác minh — không cần sửa) — các claim đứng vững + không có fail-open khác

1. **"Mọi test hiện tại gọi 1 lần/registry" — ĐÚNG.** Tái hiện: `grep refresh_global_symbol_coverage test_global_symbol_coverage.py` ⇒ các lời gọi ở dòng 87 (FPT), 144 (HPG), 224-225 (fpt + hpg, khác registry), 269-270 (fpt + hpg), 319, 354, 452, 521 — mỗi registry đúng 1 lần/test; lần đầu chưa có rows ⇒ không thể skip. Test dùng `as_of` cố định (`:36,116,171,...`) nhưng gọi 1 lần nên time-freeze không gây skip oan.
2. **AC5 scope an toàn**: `test_gap_inventory.py` **không gọi** `refresh_global_symbol_coverage` (grep chỉ thấy `refresh_gap_scores` ở `:184,188,200` — hàm khác, plan không chạm). `refresh_gap_scores` (`global_symbol_coverage.py:755-822`) đọc coverage qua `.iterator()` — throttle làm rows stale ≤ T nhưng test tạo rows trực tiếp bằng ORM nên không ảnh hưởng.
3. **Timezone an toàn**: `USE_TZ=True` (`settings.py:356`), `TIME_ZONE='Asia/Ho_Chi_Minh'` (`:354`); `_normalize_dt` (`:123-129`) ép naive→aware; `verified_at` luôn aware (`:474`). `as_of` tương lai (clock skew) nâng ngưỡng ⇒ ép recompute (fail-safe đúng chiều); `as_of` quá khứ + O1 là vấn đề ngày-tham-chiếu, đã tách sang O1.
4. **`transaction.atomic` (`:466`) + skip**: skip chỉ SELECT ⇒ giữ transaction mở thêm ~ms, không deadlock/khóa ghi mới; không vấn đề.
5. **Cơ chế storm khớp mục tiêu**: `_upsert_coverage_row` (`:321-357`) so từng field (`:349-352`) nhưng `last_verified_at=verified_at` (`:330,375,405,...`) đổi mỗi lần gọi ⇒ `update_fields` không bao giờ rỗng ⇒ `save` (`:353-356`) ⇒ UPDATE mỗi refresh/mã — đúng 12.4M UPDATE của baseline REV.2 (`PLAN_FAST_DATA_SERVICE:5`). Throttle diệt đúng chỗ này. (Index phục vụ lookup đã có: `mktdata_gsc_reg_dataset_idx` tại `models.py:492`.)
6. **Line-refs trong plan §2 đã đối chiếu từng cái**: coverage `:466-489` ✓ · `_upsert` `:321-357` ✓ · daily payload stats `:361` + count `:378` ✓ · intraday `:387-389,408` ✓ · snapshot `:415-416,433` ✓ · session_facts `:441-442,459` ✓ · `tasks.py:270-302` (hàm `:264-302`, loop gọi `:294-298` với `effective_as_of = as_of or now()` tại `:289`) ✓ · `session_facts_engine:393-396` (gọi tại `:395`, `as_of=None`) ✓ · settings nhịp `:746-756` ✓ · test lines `87,144,224-225,269-270,319,354,452,521` ✓ · REV.2 S2 dòng 25-31 ✓. Sai số duy nhất: plan §2 viết promotion reader "`:60-79`" trong khi hàm bắt đầu `:45` — vô hại (vùng quyết định đúng là `:60-79`).

## Yêu cầu sửa plan (tối thiểu để chuyển AGREE)

1. §3 thêm khóa `reference_trade_date` vào điều kiện skip (so với `detail.reference_trade_date` cache) + AC mới đổi-ngày. (O1 — ai đóng: agent implement, bước B4.)
2. §3 pin có/không gọi `refresh_global_symbol_registry` trên skip path; AC1 sửa budget theo lựa chọn + pin input `str`/`object`. (O2 — B4.)
3. Khôi phục guard cached-freshness (`{fresh,warm}` mới skip) + AC MISSING-mới-verify-vẫn-recompute. (O3 — B4.)
4. Pin công thức `age < T` thay cho `>=`; AC4 ghi rõ cùng/khác `as_of`. (O4 — B4.)
5. Evidence gates ghi amendment T=600 vs REV.2 + bound trễ-repair ≤ T. (O5 — B7.)

---

*Tài liệu tham chiếu lệnh tái hiện nhanh (chạy trong `D:\wt-phase-c`):*
- `grep -n "refresh_global_symbol_coverage" packages/core/backend/src/market_data/tests/test_global_symbol_coverage.py`
- `grep -n "refresh_global_symbol_coverage\|refresh_gap_scores" packages/core/backend/src/market_data/tests/test_gap_inventory.py`
- `sed -n '466,489p' packages/core/backend/src/market_data/global_symbol_coverage.py`
- `sed -n '284,301p' packages/core/backend/src/market_data/global_symbol_registry.py`

---

# §Round 2 (2026-11-21) — re-audit plan REV.1 sau sửa O1–O4

- **Auditor**: subagent độc lập (chỉ đọc, không sửa code)
- **Verdict mới**: **AGREE (+reservation O7–O9, toàn minor — implement được ngay, không cần vòng plan nữa)**
- **Phạm vi đọc thật vòng 2**: `docs/PLAN_PHASE_C_S2_20261121.md` toàn bộ (§3–§4 REV.1) · `market_data/global_symbol_coverage.py:1-822` (trọng tâm `_build_*_payload:360-463`, `_should_plan_dataset:263-284`, `refresh_global_symbol_coverage:466-489`) · `promotion_fast_path.py:40-80` · `global_symbol_registry.py:153-301` (`_summarize_coverage`, `_build_registry_projection`, `refresh_global_symbol_registry`) · `market_data/models.py:407-498` · `tests/test_global_symbol_coverage.py:1-160` + grep toàn file
- **Kết luận 1 dòng**: O1–O4 **đóng đúng cả 4** (mỗi objection có dòng code xác nhận bên dưới); O5 vẫn mở theo kế hoạch (ghi amendment ở B7); phát hiện thêm **3 minor mới (O7–O9)**, không blocker.

## Đối chiếu O1–O4 (REV.1 §3–§4 vs code thật)

| O round 1 | REV.1 sửa gì | Code xác nhận | Kết quả |
|---|---|---|---|
| O1 guard `reference_trade_date` | §3.3a: đủ 5 rows **và** mọi `detail.reference_trade_date == reference_trade_date.isoformat()`; legacy thiếu key ⇒ recompute | Cả 4 builder đều ghi key: daily `global_symbol_coverage.py:377-380`, intraday `:407-410`, snapshot `:432-435`, session_facts `:458-461`; `detail = JSONField(default=dict)` (`models.py:447`) ⇒ row thiếu key → `(detail or {}).get(...)` là `None != iso` ⇒ recompute đúng chiều fail-safe | **ĐÓNG** (+note O8) |
| O2 skip registry tail + budget | §3: "**không gọi** `refresh_global_symbol_registry`" + AC1 "≤ 2 (resolve + lookup; tail cũng skip)" | Tail hiện tốn +2 SELECT (`demand_sources.filter` tại `global_symbol_registry.py:220-222` và `coverage_rows.values` tại `:153-161`) + có thể 1 UPDATE (`:297-300`); skip tail ⇒ skip path còn đúng 2 query với input `str` (`_resolve_registry` `.get` tại `global_symbol_coverage.py:110-113` + 1 coverage lookup) | **ĐÓNG** (+reservation O7: thiếu case input-instance) |
| O3 guard `{FRESH,WARM}` | §3.3b: mọi cached `freshness_state ∈ {FRESH,WARM}`, MISSING/ERROR/STALE/UNKNOWN ⇒ recompute | Khớp REV.2 "không đổi hướng xấu"; `FreshnessChoices` giá trị thường (`models.py:419-425`: `'fresh','warm',...`) ⇒ implementer phải dùng hằng số, không hardcode hoa; `_should_plan_dataset:263-284` xác nhận giữ WARM ⇒ planner hành xử như cũ (strict_fresh+daily WARM vẫn plan `warm_refresh` `:273-278`) | **ĐÓNG** (+reservation O9 về prose §2) |
| O4 strict `age < T`, T=0 | §3.3c + AC4: `age < T`, T=0 ⇒ `0 < 0 = False` ⇒ luôn recompute; `last_verified_at None` ⇒ recompute | Công thức đúng cho case AC4 (2 lần cùng `as_of`); timezone an toàn (round 1 O6.3 giữ nguyên: `_normalize_dt :123-129`, `verified_at` aware `:474`) | **ĐÓNG** (+reservation O8: age âm khi T=0) |
| O5 amendment T=600 | §3.2 + §6/B7: "ghi amendment ở evidence B7" | Chưa tới B7 ⇒ **vẫn mở theo kế hoạch**, không trừ điểm; đề nghị gộp bound O9 vào cùng amendment | **MỞ (đúng hẹn)** |

## Đánh giá 5 trọng tâm vòng 2 (kèm file:line)

1. **Guard O1 vs `_build_*_payload` + row legacy** — ĐÚNG. Cả 4 payload đều ghi `'reference_trade_date': reference_trade_date.isoformat()` (daily `:377-380`; intraday `:407-410`; snapshot `:432-435`; session `:458-461`), nên mọi row do code hiện tại tạo luôn có key để so sánh 0 query thêm. Row legacy/thủ công thiếu key (`detail` mặc định `{}` — `models.py:447`) cho `None != requested.isoformat()` ⇒ recompute đúng chiều fail-safe. Midnight-rollover và caller trộn `target_date` (round 1 O1) đều bị chặn vì so từng row.
2. **Skip tail `refresh_global_symbol_registry`** — ĐÚNG hướng, bound chấp nhận được. Hàm tail làm 3 việc (`global_symbol_registry.py:284-301`): dựng projection (`:214-245`, gồm 1 SELECT demand `:220-222` + 1 SELECT coverage `:153-161` qua `_summarize_coverage`) rồi `save` nếu drift (`:297-300`). Skip ⇒ `freshness_state_summary/coverage_state_summary/latest_trade_date/last_hydrated_at` **và** projection tier/demand stale tối đa **≤ T**. Test `test_global_symbol_coverage.py:104-108` gọi refresh lần đầu (chưa rows ⇒ không skip) nên vẫn xanh — nhận định này của plan đúng. Production: summary là dữ liệu hiển thị/SOC, **không** phải trigger repair (planner đọc coverage trực tiếp tại `global_symbol_coverage.py:572-577`; promotion đọc coverage trực tiếp tại `promotion_fast_path.py:60-64`), còn tier/demand luôn được sync ở thời điểm ghi demand (`upsert_global_symbol_demand:514`, `sync_global_source_symbol_set:702-705`) nên tail của coverage chỉ là re-derivation — stale ≤ T chấp nhận được.
3. **Guard O3 vs planner/promotion** — ĐÚNG, nhưng prose §2 thiếu 1 chiều (→ O9). Giữ WARM ⇒ planner y như cũ (`_should_plan_dataset:273-284`: WARM chỉ plan khi strict_fresh+daily). Worst-case duy nhất: ground truth vừa tụt FRESH→STALE/MISSING (raw bị xóa / snapshot bị đánh `stale`) trong cửa sổ T ⇒ skip giữ FRESH ⇒ planner `False` + `should_enqueue_promotion_repair` `False` (`promotion_fast_path.py:66-67`) ⇒ **trễ repair ≤ T (600 s), không mất hẳn** (lần refresh sau recompute). Chiều ngược (giữ WARM trong khi truth đã FRESH) chỉ đẻ thêm 1 repair thừa ≤ T — đúng như plan viết.
4. **AC1 budget ≤ 2** — ĐÚNG cho input `str`, THIẾU case instance (→ O7). Đếm lại skip path: input `str` = `.get` (`global_symbol_coverage.py:113`) + 1 coverage lookup = 2 ✓; input instance = chỉ 1 lookup (resolve 0 query, `:110-112`). AC1 hiện viết "≤ 2" pass cả hai nhưng lỏng với instance — nên pin `str ≤ 2 / instance ≤ 1`.
5. **AC1b/AC1c/AC4** — CÓ NGHĨA và KHẢ THI cả 3. AC1b (đổi ngày ⇒ recompute): assert `detail.reference_trade_date == today` sau lần 2 + query nặng xuất hiện. AC1c (1 MISSING + 4 FRESH vừa verify ⇒ recompute): dựng được bằng cách để trống 1 raw table (VD không tạo `IntradayTick`); lưu ý implementer phải giữ `last_verified_at` fresh ở lần 1 để test không pass vì lý do sai (age > T). AC4 (T=0 ⇒ luôn recompute): đúng với cùng `as_of` nhờ `0 < 0 == False`; robust cả khi khác `as_of` — trừ edge age âm (→ O8).

## Objection mới (toàn minor — sửa ở B4/B7, không chặn implement)

- **O7 (minor) — AC1 thiếu case input-instance + chưa pin kiểu trả về.** Skip path với input instance chỉ tốn **1** query (`_resolve_registry` return ngay tại `global_symbol_coverage.py:110-112`), nên budget "≤ 2" lỏng 1 query cho case này — đề nghị AC1 pin `str ≤ 2 / instance ≤ 1`. Thêm nữa, §3 viết lookup "lấy `(dataset, last_verified_at, freshness_state, detail)`" dễ bị đọc thành `.values()` — mà hàm hiện tại trả `list[GlobalSymbolCoverage]` (`:484-489`) và test dùng attribute access — nên implementer phải fetch **full objects** (vẫn 1 query, `.only(...)` nếu muốn) để giữ kiểu trả về + thứ tự `DATASET_ORDER` (full path hiện đã đúng thứ tự `:477-483` khớp `DATASET_ORDER :22-28`).
- **O8 (minor) — T=0 + `as_of` sớm hơn vẫn skip (age âm).** Công thức §3.3c `age < T` với `age = (verified_at - last_verified_at).total_seconds()`: khi T=0 và lần 2 dùng `as_of` **sớm hơn** lần 1, `age = -60 < 0` ⇒ **skip**, phá cam kết "T=0 tắt throttle" của AC4. Production (`as_of=None ⇒ now()`) hầu như không gặp, AC4 (cùng `as_of` ⇒ age=0) vẫn pass — nhưng fix rẻ: short-circuit `T <= 0 ⇒ không bao giờ skip` (hoặc thêm điều kiện `age >= 0`). Nhân tiện: guard `detail` nên viết defensive `(row.detail if isinstance(row.detail, dict) else {})` thay vì `(row.detail or {})` để row corrupt (detail là list/str) không `AttributeError` 500 trong refresh.
- **O9 (minor/prose) — §2 dòng 15 "cùng lắm thêm việc, không mất repair" sai 1 chiều.** Chiều đúng: giữ WARM ⇒ thêm việc (đúng); nhưng giữ FRESH trong khi truth đã tụt ⇒ **trễ repair ≤ T** (phân tích ở mục 3: planner `False` + promotion `False`). Đề nghị sửa prose thành "lệch theo cả 2 chiều nhưng bounded ≤ T: thừa repair (WARM) hoặc trễ repair (FRESH)" và gộp 2 bound (trễ-repair ≤ T; registry-summary stale ≤ T — mục 2) vào amendment O5 ở evidence B7.

## Yêu cầu sửa (tối thiểu, ở B4/B7 — không cần vòng plan mới)

1. AC1 pin `str ≤ 2 / instance ≤ 1` + ghi rõ skip path trả full model instances theo `DATASET_ORDER`. (O7 — B4.)
2. Thêm short-circuit `T <= 0 ⇒ never skip` (hoặc `age >= 0`) + `isinstance(detail, dict)` defensive. (O8 — B4.)
3. Sửa prose §2 dòng 15 theo 2 chiều bounded ≤ T. (O9 — B4, 1 dòng.)
4. Evidence B7 gộp amendment: T=600 vs REV.2 + bound trễ-repair ≤ T + bound registry-summary stale ≤ T. (O5+O9 — B7.)
5. AC1c ghi chú giữ `last_verified_at` fresh ở lần setup để không pass vì lý do sai. (B4.)

*Verdict history: Round 1 (trên cùng) NEED_REVISION (O1–O4 blocker/major) · Round 2 (mục này) **AGREE + reservation O7–O9 (minor)** — plan REV.1 implement được ngay.*
