# RE-AUDIT ĐỘC LẬP VÒNG 2 — PLAN_MARKET_DATA_INTEGRITY_1127 REV.2

- **Scope:** `docs/PLAN_MARKET_DATA_INTEGRITY_1127.md` REV.2 (189 dòng, chưa track) + việc sửa 12 objection O1..O12 từ audit vòng 1 (`docs/evidence/market-data-integrity/AUDIT_PLAN_1127.md` — **giữ nguyên, không sửa**). RFC và audit phản biện tiếp tục chỉ đọc từ worktree widget.
- **Ngày:** 2026-11-27 · **Vai trò:** cùng auditor độc lập vòng 1 (Staff+), không phải tác giả plan; read-only. Không sửa plan, code, CLAIMS, ledger hay verdict vòng 1.
- **Baseline của worktree:** HEAD = `9507ca45e Merge pull request #584 ...` (đúng như plan). **Nhưng** `git rev-parse origin/dev` lúc re-audit = `d446515b22634aff0828240fb5cc947c183c10c2` — nhánh gốc đã tiến thêm so với lúc lập plan → xem R-O2.
- **Phương pháp:** mở lại trong worktree này: plan REV.2 toàn file; `market_serving/views.py:409-422,598-607`; `market_serving/session_facts_engine.py:127-224`; `signal_intelligence/models.py:76-105` + grep `source_ref`; `signal_intelligence/order_flow_engine.py:244-261`; `market_data/models.py:302-335`; `market_data/vnbroker_adapter.py:147-166`; `data_ingest/tasks.py:2550-2571,2614-2627`; danh sách `market_data/migrations/*.py`, `signal_intelligence/management/commands/*.py`, `market_serving/management/commands/*.py`. Chạy 3 gate read-only. Ngoài ra chạy 1 mô phỏng số học **thuần Python, không DB, không ghi file** để kiểm AC M04, có control biết đáp án (xem R-O1). Không chạy pytest/build, không đụng staging/Docker/DB.

---

## Verdict

**NEED_REVISION** — 11/12 objection đã sửa thật; **O4 chưa giải quyết trọn vẹn**. Hai objections mới:

- **R-O1 (P1, chặn B4) — AC M04 thay số liệu nhưng fixture không làm test đỏ được.** REV.2 đổi mục tiêu từ `delta_strength_pct` sang `buy_strength`/`institutional_strength` (plan `:101`, `:139`), nhưng fixture vẫn là **1 bucket duy nhất** "1B buy + 1B sell + 50B unknown" (RFC M04 có cùng fixture). Với 1 bucket, `baseline = max(total_v, 1.0)` tại `session_facts_engine.py:186` và `midpoint = median([raw])` tại `:191`/`:202` ⇒ `raw == midpoint` ⇒ sigmoid luôn trả `50.0` cho **mọi** `total_v`. Mô phỏng (có control) cho thấy old code, fix `:144`, fix `:144+:146` đều ra `(buy_strength, institutional_strength, delta_strength_pct) = (50, 50, 0)` — AC "strength đổi" **không bao giờ đạt**, kể cả sau khi sửa. Ngoài ra REV.2 chỉ fix `:144` (plan `:99c`) trong khi RFC M04 yêu cầu bỏ unknown khỏi cả `['whale']` (`:145-146`), và plan §1 F-06 `:37` lại khẳng định `institutional_strength` sai qua `whale_ratio` `:197-198` — tự mâu thuẫn với fix (c).
  - **Fix cụ thể:** (1) đổi fixture thành **≥2 bucket** (bucket 1 sạch 1B/1B làm baseline, bucket 2 có thêm 50B unknown) — mô phỏng với 2 bucket cho old `(62.727, 56.15)` → fix `:144` `(50.0, 99.628)` ⇒ test đỏ thật; (2) quyết định rõ có sửa `:146` (`whale`) không — nếu sửa theo RFC thì assert chỉ vào `buy_strength` (old `62.727` → fix `50.0`), không assert `institutional_strength`; (3) cập nhật lại câu `:37` cho khớp fix đã chọn.
- **R-O2 (P2, đóng ở B5) — baseline `origin/dev` đã đổi nhưng plan vẫn ghi `9507ca45e`.** Plan `:6` và `:153` khẳng định `origin/dev @ 9507ca45e`; thực tế lúc re-audit `origin/dev = d446515b`. Code/citation trong worktree vẫn đúng ở HEAD `9507ca45e`, nhưng khi vào B5 phải rebase và **chạy lại mọi gate/citation** (L-003, `AGENT_PROTOCOL.md:17`). Cập nhật §5 cho trung thực ("HEAD worktree `9507ca45e`; `origin/dev` cần re-verify trước B5").

---

## Bảng trả lời O1..O12

| objection | resolved? | bằng chứng file:line trong REV.2 + code thật | ghi chú |
|---|---|---|---|
| **O1/P0** migration head | ✅ **CÓ** | plan `:44`, `:107`, `:138`: "head hiện `0014_alter_pricerebaserun_status.py`, để `makemigrations` sinh, **KHÔNG** tự đặt `0013`", re-verify sau rebase `:109`. Thực tế `Get-ChildItem market_data/migrations` → `0012...`, `0013_s2_vintage.py`, `0014_alter_pricerebaserun_status.py`. | Đã bỏ số cứng hoàn toàn. |
| **O2/P0** fail-before M03 xanh giả | ✅ **CÓ** | plan `:70`, `:108`, `:138` có đủ 4 thành phần: `bulk_create` trùng + `ignore_conflicts` + assert conflict ≥1; `IntegrityError` với `ignore_conflicts=False`; **monkeypatch presence-check** để force tới `tasks.py:2604`; test dương tính tick mới tăng đúng 1. Code thật: presence-check `tasks.py:2557-2568` (đã đọc lại). | "assert conflict ≥1" chưa nói rõ quan sát bằng gì (Django/Postgres trả ít object hơn với `ignore_conflicts`); tuy test `IntegrityError` đã là bằng chứng conflict, nên gợi ý ghi rõ `len(created)==0` trong AC — không chặn. |
| **O3/P1** S4 skip canary | ✅ **CÓ** | plan `:71`, `:116`, `:140`: xoá/UPDATE `IntradayTick` theo `(symbol,date)` **trước** re-backfill, nằm trong snapshot + Q2; nêu rõ `ignore_conflicts` ở `:2604` không update. | Đã nhúng đúng nguyên nhân presence-check `:2566-2568`. |
| **O4/P1** mẫu số M04 | ❌ **CHƯA** | plan `:37` đã đính chính đúng `delta_strength_pct` không bị pha (`:216` = buy+sell ✅), nhưng AC `:101`/`:139` dùng 1 bucket nên strength không đổi — xem **R-O1**. Code: `:186`, `:191`, `:197-198`, `:201-202`, `:216`. | Chuyển sang NEED_REVISION. |
| **O5/P1** cache key `metric` | ✅ **CÓ** | plan `:42`, `:63`, `:73`, `:121`, `:143`: bump `v5` tại `views.py:415-418`, `v3` tại `:603`, invalidate lúc deploy, test 2 metric liên tiếp phải khác payload. Code thật đọc lại: `:415-418` `core:cvd_series:v4:...`, `:603` `...v2:...` — đúng vị trí cần sửa. | — |
| **O6/P1** default metric | ✅ **CÓ** | plan `:24` (Q9 mới, mặc định giữ `whale`), `:122` (caller cũ giữ ngữ nghĩa `whale`, `market` opt-in), `:172` (fallback `whale`). | Cần Owner chốt Q9 vì khác RFC §4.1 (RFC ghi default `market`) — reservation cho B4. |
| **O7/P1** field không tồn tại | ✅ **CÓ** | plan `:62` (C-8), `:114`: predicate `executed_at` khung ICT + `session_date < 2026-11-24` + `alert__source_ref__startswith='whale_tick:'`. Code: `signal_intelligence/models.py:76-105` chỉ có `side`, `executed_at`, `session_date`, `alert`; `UnifiedAlert.source_ref` tồn tại tại `:52`. | Đã bỏ `session_phase`/`match_type`. |
| **O8/P1** detect bỏ `match_type` | ✅ **CÓ** | plan `:76`, `:98-99`, `:100`, `:137`: normalization ở **mọi** write-path — live `vnbroker_adapter.py:149-186` (đọc lại `:149-155` map non-buy/sell → `unknown`), backfill `:1111-1118`, hydrate `tasks.py:338-358` — trước `detect_whale_ticks` (`order_flow_engine.py:258-259` lọc `BUY`/`SELL`). `order_flow_engine.py` được đánh dấu CHỈ ĐỌC để không vỡ `OrderFlowEvent` (C-3). | — |
| **O9/P2** citation/stale count | ✅ **CÓ** | plan `:6` (worktree vs checkout chính), `:35` (`IntradayTick :302`, unique `:295`), `:47` lệnh tái tạo `(Get-Content ...).Count` = **3846** (tự chạy lại: 3846 ✅), `:45` warning ~130 (gate thực ~130 ✅). Code: `models.py:302`, `:313-324`, `:295`. | Migration-head command chưa nêu trong `:47` nhưng head đã đúng ở `:44`. |
| **O10/P2** chain sai | ✅ **CÓ** | plan `:78`, `:115`: chain `tasks.py:2619-2623` = detect → `materialize_session_facts` → `synthesize_intraday_bars_from_ticks`; `backfill_session_facts_buckets` là command riêng. Code: `tasks.py:2619-2623` ✅; `market_serving/management/commands/backfill_session_facts_buckets.py` tồn tại ✅; `signal_intelligence/management/commands/` chỉ có `recompute_dark_flow_values.py` + `seed_alertcenter_demo.py` đúng như `:113` ✅. | — |
| **O11/P2** thiếu GWT | ✅ **CÓ** | plan `:89` (S0), `:93` (S1), `:100-102` (S2), `:108` (S3), `:117` (S4), `:122` (S5), `:127` (S6) đều có Given/When/Then; test dương tính có ở S1/S2/S3/S4/S6, S5 có legacy-200 làm positive control. | — |
| **O12/P2** Q6 treo | ✅ **CÓ** | plan `:21` (Q6), `:56` (C-2), `:80` (đối chiếu), `:97`, `:99d`, `:102` (S2 đổi `200M→500M` + AC/test ghim), `:139`. Code: `session_facts_engine.py:54` = 200M, `order_flow_engine.py:31` = 500M. | — |

---

## Findings mới

| ID | Mức | plan file:line | Thực tế | Tác động | Đề xuất fix |
|---|---|---|---|---|---|
| **R-O1** | **P1** | `:37`, `:99c`, `:101`, `:139` | 1 bucket ⇒ `baseline=total_v` (`:186`), `midpoint=raw` (`:191`/`:202`) ⇒ strengths luôn `50` bất kể 50B unknown. Mô phỏng có control: control không-unknown old/fixed đều `(50,50,0)`; fixture 1 bucket old/fix`:144`/fix`:144+146` đều `(50,50,0)`; fixture 2 bucket old `(62.727,56.15)` → fix`:144` `(50.0,99.628)` → fix`:144+146` `(50.0,50.0)`. Plan chỉ fix `:144`, không nhắc `:146` dù RFC M04 yêu cầu cả `['whale']`. | AC M04 không thể đạt dù code đã đúng; trong lúc implement dễ bị "sửa test cho xanh" (đổi assert/sửa fixture sai) — đúng bẫy L-V04. | Đổi fixture sang ≥2 bucket; chọn rõ fix `:144` hay `:144+:146`; nếu fix cả hai thì assert `buy_strength` (62.727→50) và bỏ assert `institutional_strength`; sửa lại câu `:37`. |
| **R-O2** | P2 | `:6`, `:153` | `git rev-parse origin/dev` = `d446515b...`, không còn `9507ca45e` (HEAD worktree vẫn `9507ca45e`). | Số liệu/citation trong plan đúng với HEAD nhưng sẽ thối sau khi B5 rebase; báo `PASS` trên code cũ là vô nghĩa (L-003). | Cập nhật §5: phân biệt HEAD worktree và `origin/dev`; trước B5 `agent-sync.ps1` (rebase → check migration → gate) rồi re-verify mọi `file:line`. |

**Không có finding mới nào khác:** các thay đổi còn lại (Q9, C-8, C-9, S4 delete-tick trước backfill, tách command) đều đối chiếu được với code và không tạo mâu thuẫn nội bộ mới — trừ chỗ Q9 (xem reservation dưới đây).

---

## Cổng đã chạy / CHƯA CHẠY

| Lệnh | Exit/output thực tế |
|---|---|
| `node packages/web/scripts/check-multi-agent.mjs` | **exit 0** — `0 lỗi, 0 trùng số migration — PASS`; vẫn kèm warning claim stale (dòng 2070, 2092, v.v.). Khớp plan `:156`. |
| `git status --short` | `?? docs/PLAN_MARKET_DATA_INTEGRITY_1127.md`, `?? docs/evidence/market-data-integrity/` (plan + verdict vòng 1 + verdict R2 này). Không có code/migration bị sửa. |
| `git log --oneline -1` | `9507ca45e Merge pull request #584 from vietdungiitb/docs/ssot-adjustment-rev2` |
| `git rev-parse origin/dev` (bổ sung) | `d446515b22634aff0828240fb5cc947c183c10c2` — **khác** với HEAD (R-O2) |
| `(Get-Content packages/core/backend/src/data_ingest/tasks.py).Count` | `3846` — khớp plan `:47` |
| Mô phỏng số học AC M04 (Python thuần, có control) | control `(50,50,0)`; 1 bucket mọi biến thể `(50,50,0)`; 2 bucket old `(62.727,56.15)` / fix`:144` `(50.0,99.628)` / fix`:144+146` `(50.0,50.0)` |
| pytest / BE test Postgres, `makemigrations --check`, build/tsc, probe staging | **CHƯA CHẠY** — đúng yêu cầu read-only; plan `:158-161` cũng ghi CHƯA CHẠY. |

---

## Kết luận

**Chưa sẵn sàng B4.** 11/12 objection vòng 1 đã được sửa có bằng chứng code thật — đặc biệt O1, O2, O5, O7, O8, O10, O11, O12 sửa sạch và có thể chấp nhận ngay. Riêng **O4 chỉ sửa một nửa**: plan đã định danh đúng mẫu số (`delta_strength_pct` không bị pha), nhưng AC thay thế lại dùng fixture 1 bucket khiến `buy_strength`/`institutional_strength` **không đổi** trong mọi trường hợp — nên fail-before vẫn không đỏ thật được.

**Blocker còn lại:** R-O1 (P1) — sửa trong vòng REV.3 tối đa 3 lần (plan `:170`), bằng fixture ≥2 bucket + quyết định `:146` + chỉnh câu `:37`. Sau đó re-audit vòng 3 (hoặc auditor xác nhận bằng diff có đính kèm output mô phỏng mới). R-O2 đóng ở B5 bằng rebase + chạy lại gate, nhưng nên sửa câu chữ ở §5 ngay trong REV.3 để không lưu Baseline sai vào consensus.

**Reservations cho Owner trước B4:** Q9 (default `whale` khác RFC §4.1) và Q2 (dữ liệu phá huỷ) phải được chốt rõ bằng văn bản; nếu Owner im lặng thì giữ mặc định plan là KHÔNG code/KHÔNG xoá.
