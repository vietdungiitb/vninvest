# RE-AUDIT ĐỘC LẬP (chỉ đọc) — slice BE `cvd-1d-history-be`

- **Ngày:** 2026-11-26
- **Worktree / branch / HEAD:** `D:\Mujoco Projects\wt\cvd-1d-history-be` · `feat/cvd-1d-history-be` · `5bee4ea2fdead6a6950bb3cd6c637403d2ef0393`
- **Base:** `origin/dev @ ce1e08138`
- **Diff kiểm toán:** `git diff 47b3f23c6..5bee4ea2f` → `views.py` **+186/−0**, test file **+234/−0**. Đọc kèm `docs/PLAN_CVD_1D_HISTORY_BE_20261126.md`, `AUDIT_PLAN.md` (round1 + round2), `FAIL_BEFORE.md`, `PASS_AFTER.md` (untracked).
- **Phương pháp:** tự mở file/code, **không tin tóm tắt** của người giao việc; dùng `git show/log/diff/numstat/ls-files --eol/diff --check`, `grep`; chạy `python -c` tái tạo date anchor (không cần DB). Không sửa code/plan/CLAIMS/ledger; **không commit**.
- **Giới hạn trung thực:** phiên này **KHÔNG tự chạy lại VPS staging** (không có kết nối được xác minh) ⇒ số `11`/`44` test và log teardown là **trích evidence**, không phải kết quả tái tạo của tôi. Mọi nhận định về code đều kèm `file:line` đã tự đọc.

---

## VERDICT CUỐI

**`NEED_REVISION`** — **0 blocker**, **1 major (mới, O-1)**, **4 minor**.

Objection duy nhất cần sửa trước khi đóng claim: **O-1 — test mới flaky theo giờ trong ngày** do trộn hai mốc ngày (UTC `now().date()` ở legacy vs `localdate()` ở history). Code production đã đúng hợp đồng A1 và **legacy giữ nguyên 100%**; không có objection nào về logic history/cumulative/cache.

---

## 1. Findings

| ID | Mức | file:line | Thực tế | Tác động | Đề xuất fix |
|---|---|---|---|---|---|
| **O-1** | **MAJOR (mới)** | `tests/test_cvd_1d_history_api.py:67,83-91,122-126` ↔ `views.py:81` vs `views.py:403` | `setUp` dùng `self.today = timezone.localdate()` (ngày +07). Nhánh **legacy** (`views.py:81`) chọn session bằng `dj_timezone.now().date()` = **ngày UTC**; nhánh **history** (`views.py:403`) dùng `dj_timezone.localdate()` = ngày +07. Tái tạo bằng lệnh: `python -c "…settings.configure(USE_TZ=True, TIME_ZONE='Asia/Ho_Chi_Minh')… fixed=datetime(2026,11,26,20,0,tzinfo=utc); print(fixed.date(), localdate(fixed))"` → `2026-11-26` vs `2026-11-27` (**MISMATCH=True**). | Khung **00:00–06:59 giờ +07** (tức UTC 17:00–23:59 hôm trước, ~7h/24), `T-01` đọc session `d1` thay vì `d2` (`cumulative 100M` thay vì `800M`) và `T-04` so legacy `d1` với history `d2` ⇒ **2/11 test đỏ giả**. Bằng chứng pass-after hiện tại chạy lúc UTC ~01:56 (local 08:56) nên không lộ lỗi. | Freeze clock trong test (patch `dj_timezone.now` + `dj_timezone.localdate` về 1 instant cố định, hoặc dùng `freezegun`), **hoặc** pin `T-01`/`T-04` bằng `trade_date=` và tách riêng kỳ vọng legacy. Sau fix, chạy lại VPS ở **2 khung giờ** (vd 03:00 +07 và 09:00 +07). Không sửa `views.py:81` (legacy phải giữ nguyên). |
| **M-2** | MINOR | `docs/PLAN_CVD_1D_HISTORY_BE_20261126.md:63` **vs** `:64-65`; `views.py:533`; `tests/...:214-216` | Plan tự mâu thuẫn: `:63` (R2, "chốt lúc implement") ghi `date_from/date_to` là **khoảng truy vấn**; `:65` (D-2) ghi `date_from = ngày đầu còn lại` sau cap 2600. Code chọn `:63` (`start_date = localdate()-3650`); test T-10 assert `3650`, không phải `2599`. | Với `period=10Y`, widget nếu dùng `date_from` làm domain trục X sẽ có khoảng trống ~1051 ngày trước bucket đầu tiên. Là câu hỏi hợp đồng với widget team, **không phải lỗi code** (R2 là quyết định chốt và auditor round2 §2.3 cũng đề xuất công thức này). | Chốt lại với widget team 1 trong 2 ngữ nghĩa; ghi rõ vào handoff. Nếu giữ R2, xoá/sửa câu "date_from = ngày đầu còn lại" ở plan `:65` để khỏi mâu thuẫn. |
| **M-3** | MINOR | `git diff c166374d0..5bee4ea2f -- packages/core/backend/tests/test_cvd_1d_history_api.py` | File test **đổi 1 dòng sau khi đã đỏ**: T-10 `date_from` từ `today-2599` → `today-3650` (`:214-216`). `FAIL_BEFORE.md:3,30-49` dùng bản 233 dòng. | Bằng chứng fail-before không hoàn toàn cùng artifact với pass-after. Tuy T-10 đỏ ở `bucket_count` (`:212`) **trước khi** chạm dòng `date_from`, nên red evidence vẫn đúng. | Ghi chú sự khác biệt này vào `FAIL_BEFORE.md` (hoặc `PASS_AFTER.md`) để audit trail khớp artifact. |
| **M-4** | MINOR | `views.py:473-486` ↔ `views.py:113-134` | Nhánh history rỗng gọi helper dùng chung rồi `empty.update(...)` (`:479-485`); helper trả `revision: 0` cứng (`:130`). Trường hợp có `SessionFacts` trong khoảng nhưng **không có bucket 1D cũng không có DailyPrice** → `revision_dt` tính được (`:408-413`) nhưng payload trả `revision=0`. | Sai lệch nhỏ ở edge case; không ảnh hưởng AC-1..AC-11. | Nếu muốn nhất quán, set `empty['revision'] = revision` trong nhánh `:479-485`. Không được sửa helper chung (đang đúng O3). |
| **M-5** | MINOR | `docs/CLAIMS.md` append (claim `in-progress`); `git diff origin/dev..HEAD -- docs/CODE_CHANGE_AUDIT_LEDGER.md` → rỗng; `PASS_AFTER.md` untracked | Tại thời điểm audit: ledger **chưa có Entry 644**, handoff `docs/handoffs/HANDOFF_2026-11-26_CVD_1D_HISTORY_BE.md` **chưa có**, `PASS_AFTER.md` chưa được add. Plan §7 có liệt kê cả 3. | Chưa thể đóng claim đúng quy trình (`AGENTS.md` yêu cầu ledger sau mỗi thay đổi + handoff evidence rule). | Bổ sung ở bước closeout: add `PASS_AFTER.md`, append ledger Entry 644, viết handoff vào `docs/handoffs/`, rồi mới đổi claim `done`. Không phải lỗi code. |

---

## 2. Kiểm tra theo 6 mục yêu cầu

### 2.1 Path legacy có giữ nguyên response + cache v2 không? — **PASS**
- `git diff --numstat 47b3f23c6..5bee4ea2f` cho `views.py` = `186 0` ⇒ **chỉ thêm code, không xoá/sửa dòng cũ nào**. Nhánh legacy `views.py:575-654`, key v2 `views.py:592-593`, helper `_build_empty_cvd_payload` `views.py:113-134` đều **nguyên vẹn**.
- Nhánh history được chèn **trước** `_get_materialized_session_facts` (`views.py:563-573`). `requested_trade_date` được parse ở `:561` trước nhánh ⇒ `trade_date` thắng `period` kể cả `period` sai (T-06 `:135-140`).
- `window≠1D` hoặc thiếu `period` ⇒ điều kiện `:565` sai ⇒ đi legacy (T-01 `:83-91`, T-11 `:223-234`); regression `tests/test_session_facts_api.py:423-463` vẫn khớp contract cũ (unit/revision `int(computed_at.timestamp())`/`updated_at +07:00`/empty payload).
- ⚠ Caveat duy nhất: **O-1** làm `T-01`/`T-04` phụ thuộc giờ chạy (lỗi ở test, không phải legacy code).

### 2.2 Hợp đồng history — **PASS**
| Yêu cầu | Bằng chứng code |
|---|---|
| period SSOT | `_parse_cvd_history_period` `views.py:55-62` import `_DARK_MONEY_PERIOD_DAYS` từ `stock_mgmt_native_views.py:352-358` (`1M:30,3M:90,6M:180,1Y:365,10Y:3650`) |
| 400 `UNSUPPORTED_PERIOD` | `views.py:567-572`; T-05 `:129-132` |
| trade_date precedence | `views.py:561,565`; T-06 `:135-140` |
| additive `period/history/date_from/date_to` | `views.py:531-534`; T-01 `:90-91` khẳng định legacy **không** có |
| `unit/bucket_count/cvd_series` giữ nguyên | `views.py:511,517-529,530`; cùng tên field với legacy `:627-646` |
| `buy_volume/sell_volume` (không `buy_value`) | `views.py:443-444,523-524`; T-02 `:107` |
| `bucket_ts` local +07:00 | `views.py:519` `dj_timezone.localtime(...)`; T-02 `:106`; settings `:354,356` |
| zero-fill delta=0 từ DailyPrice | `views.py:65-72,452-465`; import tại function scope; T-09 `:171-186` |
| cumulative = Σ delta, không reset | `views.py:488-494` (float, không làm tròn); **không** đọc `cumulative_cvd` materialized; T-03 `:110-119` với session trước net=−300M |
| top-level delta = Σ delta | `views.py:504` (cùng công thức legacy `:615-617`) |
| cap 2600 | `views.py:307,470-471` (giữ cuối, cum tính lại trên phần giữ lại); T-10 `:212-220` |
| cache v3 + revision int + start/end | `views.py:413-417` `core:cvd_series:v3:{symbol}:{window}:{period}:{start}:{end}:{revision}`, TTL `:537` = `_CVD_SERIES_CACHE_TTL=30` (`:305`); `revision = int(max(computed_at).timestamp())`; T-07 `:143-156` |

### 2.3 Bug tiềm ẩn — **PASS (trừ O-1)**
- **Import vòng:** `grep market_serving` trong `src/market_data/` → **0 match**; import `_DARK_MONEY_PERIOD_DAYS` (`views.py:57`) và `DailyPrice` (`views.py:67`) đều tại **function scope**; `market_serving.views` đã nạp xong trước khi `get()` chạy ⇒ không cycle.
- **UnboundLocalError DailyPrice:** `DailyPrice` chỉ import trong helper `_cvd_history_candle_dates` (`views.py:65-72`), **không** import trong `get()` ⇒ không lặp lại lỗi hotfix `stock_mgmt_native_views.py:2105-2107`.
- **revision vs auto_now:** `models.py:101` `auto_now=True`; T-07 dùng `.update(computed_at=new_at)` (`test:151`) ⇒ bypass auto_now, đúng AC-6. `revision` lấy `Max(computed_at)` `:408-412`, khớp R1.
- **sort bucket_ts:** `order_by('bucket_ts','pk')` `:435` + sort theo ngày rồi `(bucket_ts, pk)` `:467-469` ⇒ tăng dần; T-02 `:103-105`.
- **timezone:** floor 1D trên UTC midnight (`session_facts_engine.py:91-92`, `:132-134`) → `localtime` `:519` = **07:00+07:00**; zero-fill `datetime.combine(day, time.min, tzinfo=utc)` `:457-459` → cùng 07:00; T-09 `:180-183` assert đúng `07:00:00+07:00`. **Không** copy `market_serving/native_views.py:553-554` (00:00+07:00 subsystem khác) — đúng O2 round1.
- **helper chung:** `views.py:474` chỉ **gọi** `_build_empty_cvd_payload` rồi sửa bản copy (`:479-485`), **không sửa định nghĩa** `:113-134` ⇒ legacy empty (`:582-588,607-613`) giữ nguyên — đúng O3 round1.
- **lower-case period/window:** `:59` `.upper()`, `:554` canonical `{'1d':'1D'}`; window `1d` vẫn vào history, `bucket_minutes=1440` (`:560`).
- **period + trade_date:** `:565` chặn history ⇒ 200 legacy, không 400 (T-06).
- **current date anchor:** history dùng `localdate()` `:403` đúng R2; legacy dùng `now().date()` `:81` (pre-existing). **O-1** nằm ở test mixing hai mốc này.

### 2.4 Test có xanh giả không (L-V04)? — **CÓ DISCRIMINATOR THẬT, trừ O-1**
- T-03 `tests/...:73-77,110-119`: fixture có session đầu net **−300M** (không phải net=0), assert đúng `deltas=[-300M,+100M,+800M]` và `cumulative=[-300M,-200M,+600M]` + công thức `Σ delta` ⇒ **bug reset per-session bị phát hiện**. Đây chính là 요구 O1 round1 đã được sửa.
- Mọi assert đều là assert **giá trị thật** (status/code/số/isoformat/timestamp), **không có** assert rỗng hay `assertIsNotNone` vô nghĩa; có test dương tính (`T-02`) lẫn âm tính (`T-05`).
- Fail-before chứng minh test có khả năng đỏ: 5/11 red đúng các case history/contract (xem mục 3).
- ⚠ Trừu O-1: ở 7h/ngày test đỏ **giả**, nên "xanh" hiện tại không phải lúc nào cũng tái tạo được.

### 2.5 Gate/evidence trung thực — **PASS (có M-3, M-5)**
- `FAIL_BEFORE.md:30-49`: `Ran 11 tests … FAILED (failures=4, errors=1)`, liệt kê đúng 5 test đỏ + lý do; `:51-57` ghi rõ sự cố teardown `ObjectInUse` là môi trường, không phải lỗi code.
- `PASS_AFTER.md:11-24`: `Ran 44 tests in 2.031s / OK`; **`:27-35` ghi thẳng** `TEST_EXIT=1` do teardown `ObjectInUse` dù test OK, kèm 2 lệnh kiểm chứng cleanup (`SELECT datname …` = 0 DB `cvd1d*`; `worktree list | grep -i cvd1d` = NONE); `:21-22` **từ chối bịa số từng suite**; `:45` ghi `npx tsc --noEmit` = "không chạy riêng" thay vì báo PASS.
- Không migration: `git show --stat` cả 3 commit chỉ có `docs/CLAIMS.md`, test, views.py, docs — **0 file migration**, **0 file deny-list**, không npm/pip install, không local Docker (dùng VPS `14.225.255.47` theo runbook).
- Chưa có ledger Entry 644 / handoff / PASS_AFTER chưa add → **M-5** (closeout).

### 2.6 Scope diff / EOL / encoding — **PASS**
- `git show --stat 47b3f23c6` = `docs/CLAIMS.md` +2 (claim riêng, trước dòng code đầu tiên) · `c166374d0` = test +233 (fail-before) · `5bee4ea2f` = plan/evidence/views/test (+571/−1). **Không dính file agent khác**, không file shared deny-list.
- `git ls-files --eol` → `i/lf w/lf` cho cả 3 file văn bản/code; `git diff --check 47b3f23c6..5bee4ea2f` → sạch. `git status --short` chỉ có `?? PASS_AFTER.md` (dự kiến add lúc closeout).

---

## 3. Xác nhận fail-before / pass-after có thật

| | Fail-before | Pass-after |
|---|---|---|
| Artifact | commit `c166374d0` (`git show --stat`: **chỉ** file test, 233 dòng) — chạy trên `views.py` chưa sửa | commit `5bee4ea2f` (implement A1) |
| Lệnh | `docker run … vninvest-core-api:staging manage.py test tests.test_cvd_1d_history_api --noinput` trên VPS, DB `cvd1d_verify` (FAIL_BEFORE.md:14-25). Lần đầu teardown lỗi `ObjectInUse` do `CORE_DB_CONN_MAX_AGE=60` (`settings.py:236`) → thêm `-e CORE_DB_CONN_MAX_AGE=0` + `DROP … WITH (FORCE)` | cùng lệnh + 2 regression label (PASS_AFTER.md:6) |
| Log | `Ran 11 tests … FAILED (failures=4, errors=1)` (`:30-32`) | `Ran 44 tests … OK` (`:11-13`) |
| Đỏ đúng chỗ | T-02 ERROR, T-03/T-05/T-09/T-10 FAIL (`:37-45`); T-01/T-04/T-06/T-08/T-11 PASS = baseline legacy | 11/11 + 33 regression (PASS_AFTER.md:17-24) |
| Kết luận | **Có thật** — 5 test contract mới đỏ trên code cũ, chứng minh không phải test xanh giả | **Có thật theo evidence** (tôi không tự re-run VPS); exit 1 do teardown đã được ghi rõ, cleanup đã được kiểm chứng |

Caveat: bản test lúc fail-before khác bản cuối 1 dòng (M-3); T-10 đỏ ở `bucket_count` trước dòng đó ⇒ không làm sai kết luận red.

---

## 4. Kết luận — đủ điều kiện đóng claim + bàn giao widget team?

**CHƯA.** 0 blocker nhưng **1 major mới (O-1)** ⇒ chưa đạt ngưỡng "0 blocker + 0 major mới".

Việc phải làm, theo thứ tự:
1. Sửa O-1 trong `tests/test_cvd_1d_history_api.py` (freeze clock hoặc pin `trade_date` cho `T-01`/`T-04`); **không** đụng `views.py:81`.
2. Chạy lại VPS ở 2 khung giờ (03:00 +07 / 09:00 +07), cập nhật `PASS_AFTER.md` với log mới; ghi rõ vẫn là 44 test + teardown exit 1 nếu tái diễn.
3. Chốt M-2 với widget team (`date_from` sau cap là query range hay ngày đầu bucket còn giữ) và ghi vào handoff.
4. Closeout M-3/M-5: add `PASS_AFTER.md`, append ledger Entry 644, viết `docs/handoffs/HANDOFF_2026-11-26_CVD_1D_HISTORY_BE.md`, rồi đổi claim `done` → PR.

Code history (A1) đã sẵn sàng về mặt chức năng; khi O-1 được fix và xanh ở cả 2 khung giờ, auditor có thể chuyển verdict sang **PASS/AGREE mà không cần vòng audit thứ 3** (các reservation R1/R2 đã được implement đúng tại `views.py:403-417`).

---

## ROUND 2 (sau fix `665767ce0`)

- **Ngày:** 2026-11-26 · **HEAD:** `665767ce0be6dce2f95d7dd147dd563768e4e6ab` · branch `feat/cvd-1d-history-be`.
- **Diff kiểm toán:** `git diff 5bee4ea2f..665767ce0` (6 file, +198/−7) + đọc trực tiếp file working-tree. Lưu ý: `PASS_AFTER.md` tại commit `665767ce0` **vẫn là bản 44 tests**; bản **working tree đang modified** (` M`) mới là bản `45 tests` — tôi đọc bản working tree theo yêu cầu.
- **Phương pháp:** tự mở diff/file, không tin tóm tắt; `python -c` tái tạo hành vi patch clock; `git diff --numstat`, `git diff --check`, `git ls-files --eol`, `git show --stat`. Không sửa code/plan/CLAIMS/ledger; **không commit**. Round 1 ở trên được **giữ nguyên** làm lịch sử.

### VERDICT ROUND 2

**`AGREE`** (+ 2 reservation) — **0 blocker**, **0 major**, **2 reservation minor** (M-2 ngữ nghĩa hợp đồng với widget team; M-5 artifacts closeout — theo yêu cầu **không đòi** trong vòng này).

**Trả lời câu hỏi đóng claim/bàn giao:** **CÓ** — 0 blocker + 0 major mới ⇒ đủ điều kiện đóng claim + bàn giao widget team. Hai reservation dưới đây là việc closeout/hợp đồng, **không chặn**.

### 1. Trạng thái O-1 / M-2 / M-3 / M-4

| ID | Mức round 1 | Trạng thái round 2 | Bằng chứng tự đọc |
|---|---|---|---|
| **O-1** | MAJOR | **RESOLVED** | Fixture anchor đổi tại `tests/...:67-68` (`self.today = timezone.now().date()` UTC, `self.local_today = timezone.localdate()`); kỳ vọng history dùng `local_today` tại `:100-101` (T-02) và `:215-216` (T-10); T-12 tại `:239-258` khoá biên. `views.py:81` **không đổi**. |
| **M-2** | MINOR | **RESOLVED** (tài liệu) + reservation hợp đồng | Plan `:64-65` sửa thành *"`date_from`/`date_to` **vẫn là khoảng truy vấn** theo R2… không đổi thành ngày đầu bucket còn giữ"* ⇒ hết tự mâu thuẫn với `:63`. Code `views.py:533` + test `:215` nhất quán. Reservation: vẫn cần widget team xác nhận ngữ nghĩa `date_from` sau cap (plan `:66` đã ghi "cần Owner confirm, ghi trong handoff"). |
| **M-3** | MINOR | **RESOLVED** | `FAIL_BEFORE.md:59-68` append mục "Cập nhật artifact (audit trail)", liệt kê đúng 3 dòng đổi (T-10 `2599→3650`, anchor `localdate→now().date()`, thêm T-12) + giải thích T-10 đỏ ở `bucket_count` trước dòng `date_from` ⇒ red evidence không bị sai. |
| **M-4** | MINOR | **RESOLVED** | `views.py:485` thêm `'revision': revision` **trong nhánh history empty** (ngay sau `empty.update({…})` `:479-484`); helper chung `_build_empty_cvd_payload` `:113-134` vẫn nguyên vẹn ⇒ legacy empty không đổi. |
| **M-5** | MINOR | **KHÔNG ĐÒI (closeout)** | `PASS_AFTER.md` đã được commit tại `665767ce0` (working tree cập nhật tiếp bản 45 tests). Ledger Entry 644 + `docs/handoffs/HANDOFF_2026-11-26_CVD_1D_HISTORY_BE.md` vẫn là việc closeout — theo yêu cầu không đòi trong vòng này, không tính vào blocker/major. |

### 2. O-1 có thật sự hết không — kiểm chứng chi tiết

- **Anchor fixture:** `tests/...:67` `self.today = timezone.now().date()` → khớp đúng mốc legacy `views.py:81`. `d0/d1/d2` (`:68-70`) suy từ UTC date, nên `T-01` (`:83-91`) và `T-04` (`:122-126`) luôn so legacy với đúng session dù chạy lúc 03:00 +07.
- **Kỳ vọng history tách riêng:** T-02 `:100-101` và T-10 `:215-216` dùng `self.local_today` → khớp `views.py:403` (`end_date = dj_timezone.localdate()`). Các test còn lại (T-03/T-07/T-09) dùng fixture UTC date nhưng nằm trong khoảng 90/3650 ngày của history ⇒ không lệch.
- **T-12 đúng khung biên:** `tests/...:242-243` `fixed_utc = 2026-11-26 20:00Z`, `fixed_local_date = 2026-11-27`. Tái tạo: `python -c "…localtime(datetime(2026,11,26,20,0,tzinfo=utc))…"` → **`2026-11-27T03:00:00+07:00`**, tức UTC date `26` ≠ local date `27` — đúng khung 00:00–06:59 +07 (7h/24) đã nêu ở round 1. `:248-249` patch cả `timezone.now` lẫn `timezone.localdate`; vì `views.py` import `dj_timezone` **là chính module `django.utils.timezone`**, patch object làm cả hai alias đổi theo. Tái tạo: `patch.object(tz,'now',…)` → `dj_timezone.now().date()=2026-11-26`, `dj_timezone.localdate()=2026-11-27`, `boundary=True`, và `patch` restore sạch.
- **Assertion là giá trị thật, không rỗng/None vô nghĩa:** `:253` `legacy.session_date == '2026-11-26'` (UTC), `:254` legacy **không** có `history`, `:255-256` `history.date_to == '2026-11-27'`, `date_from == '2026-08-29'`, `:257` parity `delta` (800M) giữa bucket cuối history và bucket legacy, `:258` parity `bucket_ts` (`07:00+07:00`). Nếu ai đổi history sang `now().date()` hoặc fixture anchor về `localdate()`, T-12 đỏ. **O-1 RESOLVED.**
- **Trung thực evidence:** `PASS_AFTER.md:31-40` ghi rõ khung biên được **mô phỏng bằng patch clock trong T-12**, **không** đổi đồng hồ VPS rồi chạy 2 lần; chỉ khung thường (08:xx +07) chạy thật. `:12-17` log `Ran 45 tests in 1.878s / OK` + `TEST_EXIT=1` (teardown) + `CLEANUP_DONE`; `:25-26` suy 33 regression từ `45−12` nhưng **ghi rõ là suy**, không bịa đo riêng. `:42-49` vẫn ghi thẳng `ObjectInUse` và 2 lệnh kiểm chứng cleanup.

### 3. Legacy vẫn +0/−0, không đụng `views.py:81`

- `git diff --numstat 47b3f23c6..665767ce0 -- packages/core/backend/src/market_serving/views.py` → **`187 0`** (round 1: `186 0`; +1 chính là dòng `revision` ở `:485`). **Không có dòng nào bị xoá/sửa.**
- Đọc trực tiếp `views.py:81`: vẫn là `today = dj_timezone.now().date()` — đúng nguyên vẹn. Nhánh legacy `:575-654`, cache key v2 `:592-593`, helper `:113-134` đều không đổi.
- `git diff --check 47b3f23c6..665767ce0` sạch; `git ls-files --eol` → `i/lf w/lf` cho test/evidence; `git show --stat 665767ce0` → chỉ 6 file đã khai (plan, 4 evidence, views.py, test), **0 migration, 0 file deny-list**.

### 4. Reservation (không chặn)

- **R1 (M-2):** chốt với widget team `date_from` sau cap 2600 là *khoảng truy vấn* (R2, hiện tại) hay *ngày đầu bucket còn giữ*; ghi kết quả vào handoff `docs/handoffs/HANDOFF_2026-11-26_CVD_1D_HISTORY_BE.md`. Plan đã nhất quán theo R2 nên không sửa thêm.
- **R2 (M-5):** lúc closeout add bản working-tree của `PASS_AFTER.md`, append ledger Entry 644, viết handoff, rồi đổi claim `done` → PR. (Theo yêu cầu round 2, KHÔNG đòi và KHÔNG đụng CLAIMS/ledger trong phiên audit này.)

### 5. Kết luận round 2

**`AGREE` (+reservation)** — O-1 đã được sửa đúng instant/khung biên và bằng assertion giá trị thật; M-2/M-3/M-4 RESOLVED; legacy giữ nguyên `+187/−0` (so với base, chỉ additions) và `views.py:81` nguyên vẹn. **0 blocker + 0 major ⇒ đủ điều kiện đóng claim + bàn giao widget team**, với 2 reservation closeout nêu trên. Không cần vòng audit thứ 3.
