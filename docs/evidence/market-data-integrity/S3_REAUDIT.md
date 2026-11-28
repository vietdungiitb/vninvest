# RE-AUDIT ĐỘC LẬP — S3 / REQ-BE-M03+G-2 (2026-11-28)

- **Vai trò:** auditor độc lập (B8), **CHỈ ĐỌC**; không phải tác giả slice. Không sửa code production.
- **Phạm vi:** `docs/PLAN_MARKET_DATA_INTEGRITY_1127.md` §3 S3 (`:110-114`) · `CONSENSUS_1127.md` G-2 (`:91`) + Q3 (`:81`) · evidence tác giả `s3-gates.md` · `git diff origin/dev...HEAD` · code thật (helper/model/migration/tasks/test).
- **Baseline đo được:** worktree `D:\Mujoco Projects\wt\m03-tick-dedup`, branch `feat/m03-tick-dedup`, base `4f9c99dd0`, HEAD slice `4281f3484`. `origin/dev` hiện `859b88232` — worktree đang **3 commit phía sau** (`git -C <wt> rev-list --count HEAD..origin/dev` = `3`).
- **Phương pháp:** mở code thật + trace fixture + chạy gate tĩnh read-only. **KHÔNG** chạy pytest / docker / build theo yêu cầu. Mọi con số kèm lệnh tái tạo; thứ không tự chạy được ghi `CHƯA CHẠY`.

---

## Verdict

**NEED_REVISION** — **1 BLOCKER + 1 MAJOR + 2 MED/Reservation**. Cổng ra B8 theo `workflow-dev-loop` (`0 blocker + 0 major`) **KHÔNG đạt**. Chưa sẵn sàng B9.

3 findings đáng chú ý nhất:

1. **BLOCKER (O1):** `UniqueConstraint` trên `dedup_key` với `default=''` (models.py:325,337) làm **vỡ hàng loạt fixture cũ** tạo ≥2 `IntradayTick` không truyền `dedup_key` → `IntegrityError` ngay lần insert thứ 2. Tác giả ghi regression `CHƯA CHẠY` là trung thực, nhưng lỗi này **nhìn được bằng static trace**, không cần pytest.
2. **MAJOR (O2):** backfill migration dùng **md5 + định dạng timestamp/price riêng** (migration `:13-38`) trong khi runtime dùng **sha256 + `isoformat()`** (`tick_dedup.py:26-49`). Hai hệ key **không tái tạo được lẫn nhau** ⇒ idempotency bị hỏng đúng tại ranh giới migration (dữ liệu cũ), mâu thuẫn với tuyên bố "backfill ×2 không tăng row".
3. **MED (O3/O4):** `seq_in_key` ổn định chỉ khi caller giữ thứ tự provider (helper không sort; `tasks.py:458-470,2563` không sort); fail-before mới dừng ở `ModuleNotFoundError`, bỏ lỡ tín hiệu đỏ mạnh hơn là `IntegrityError` trên code cũ.

---

## Kiểm chứng G-2 & migration

| # | Yêu cầu | Kết quả auditor | Bằng chứng |
|---|---|---|---|
| G-2a | 2 tick cùng `(symbol,timestamp,price,volume,side,match_type,source)` phải có **2 key khác nhau** | **ĐÚNG** | `tick_dedup.py:60-83`: `seen[base]` tăng dần → `seq_in_key` 0,1 → `build_dedup_key` khác nhau. Test `test_intraday_tick_dedup.py:37-40` assert trực tiếp. |
| G-2b | `seq_in_key` ổn định khi retry | **CHƯA ĐƯỢC BẢO ĐẢM bởi code** (xem O3) | Helper chỉ ghi chú "rows phải được sắp xếp ổn định" (`tick_dedup.py:56-58`), **không tự sort**; `tasks.py:458` (`raw_trades = list(...)`) và `:2563` truyền thẳng thứ tự provider. |
| G-2c | Warm in-memory dedup dùng `dedup_key`, không dùng tuple thô | **ĐÚNG** | `tasks.py:479-498`: `existing_tick_keys = {...values('dedup_key')}`, `tick_key = trade['dedup_key']`; tuple thô đã bị xoá. **Nhưng** so sánh này vô hiệu với row đã backfill md5 (xem O2). |
| G-2d | Cả 2 đường backfill truyền `dedup_key` | **ĐÚNG** | `tasks.py:2580-2593` (`backfill_intraday_tick_system`) và `:2692-2705` (`..._user`) đều `dedup_key=t['dedup_key']` từ `assign_dedup_keys(ticks)`. |
| M-a | Backfill **trước** `AddConstraint` | **ĐÚNG** | migration `:50-58`: `AddField(default='')` → `RunPython(_backfill_dedup_key)` → `AddConstraint`. |
| M-b | SQL `row_number() OVER (PARTITION BY … ORDER BY id)` | **ĐÚNG** | migration `:26-36`; partition đúng 7 field Q3 + seq, `ORDER BY id` cho ổn định. |
| M-c | 3 row trùng → 3 key, constraint tồn tại | **ĐÚNG theo evidence tác giả, auditor KHÔNG tự replay** | `s3-gates.md:45-50` (`total=3, distinct_keys=3, min_len=32`, `pg_constraint` có `uniq_intraday_tick_dedup_key`). |
| M-d | Row nào còn `dedup_key=''` sau migrate? | Trên Postgres: **không** (backfill quét toàn bảng). Trên SQLite: helper `return` sớm (migration `:41-43`) ⇒ mọi row giữ `''` ⇒ `AddConstraint` **sẽ fail nếu >1 row**. BE bắt buộc Postgres nên chấp nhận, nhưng cần ghi rõ. |
| M-e | `makemigrations --check` | Tác giả báo `No changes detected`, exit 0 (`s3-gates.md:57`). Auditor **KHÔNG tự chạy** (cần env Django/DB) → ghi **CHƯA CHẠY (bởi auditor)**. Cấu trúc diff nhất quán: model field + constraint ↔ migration `:47-58`. |
| M-f | md5 32 ký tự trong field 64 vs sha256 runtime | **CÓ VẤN ĐỀ** — xem O2. Không phải lỗi độ dài (32 ≤ 64), mà là **thuật toán + format input khác nhau**. |

---

## Chống xanh giả (L-V04)

| Kiểm tra | Kết quả |
|---|---|
| Assert **giá trị thật** | **ĐÚNG** — `test_...:39-40` so sánh 2 key khác nhau; `:55` assert `after == before` (đếm row DB thật); `:63-65` assert `IntegrityError`; `:73` positive control count `== 2`. |
| Không suy yếu assert | **ĐÚNG** — đổi `assertEqual(len(created), 0)` → `1` là **đúng API Django 6**: source `django/db/models/query.py:749-853` (stable/6.0.x) luôn `return objs`, kể cả `ignore_conflicts=True`. Tác giả vẫn giữ assert đếm row `:55` ⇒ **tín hiệu đỏ không mất**. Ghi chú tại `:56-57` trung thực. |
| Positive control | **CÓ** — `test_positive_control_distinct_tick_inserted` (`:67-73`). |
| Fail-before | **ĐỎ NHƯNG YẾU** — evidence `s3-gates.md:38` ghi `ModuleNotFoundError`, `FAILED (errors=1)`, `TEST_EXIT=1`. File test tại commit `cd5a84b3b` đã import `market_data.tick_dedup` ở module level (`:17`) ⇒ trên code cũ **cả 5 test error**, chứng minh được module chưa tồn tại nhưng **không chứng minh được hành vi trùng lệnh bị nuốt**. Xem O4. |
| Regression honesty | **ĐÚNG** — `s3-gates.md:63-67` ghi rõ full regression `CHƯA CHẠY ĐƯỢC` do image staging thiếu `vninvest_core.utils.encryption` (lỗi môi trường, không đổ cho diff). Tuy nhiên auditor vẫn tìm thấy lỗi bằng static trace (O1) — `CHƯA CHẠY` không có nghĩa là `KHÔNG CÓ LỖI`. |

---

## Findings (ID | mức | file:line | thực tế | tác động | đề xuất)

| ID | Mức | file:line | Thực tế | Tác động | Đề xuất |
|---|---|---|---|---|---|
| **O1** | **BLOCKER** | `models.py:325,336-338`; fixture `market_data/tests/test_intraday_tape_api.py:32,40` · `market_serving/tests/test_native_views.py:33,41,49` · `data_ingest/tests/test_backfill_tasks.py:212-225` · `market_data/tests/test_intraday_tick_presence.py:31,43,52,53` · `market_data/tests/test_stock_management_native_api.py:691,699,707` · `signal_intelligence/tests/test_order_flow_dark_value.py:20-34` | `dedup_key = CharField(default='')` + `UniqueConstraint(fields=('dedup_key',))`. Mọi fixture tạo ≥2 tick không truyền key đều có `dedup_key=''` → insert thứ 2 vi phạm unique. Ví dụ `test_order_flow_dark_value.py:32` tạo `count=10` row. | **Vỡ full regression suite** (≥6 file test) ngay khi migrate test DB. Tác giả không chạy được regression nên chưa phát hiện. Prod an toàn hơn (3 write-path production đã truyền key – `tasks.py:479,2580,2692`), nhưng fixture/test/migration seed là đường hỏng. | Chọn 1: (a) đổi constraint thành **partial** `condition=Q(dedup_key__gt='')` (và sửa migration tương ứng), hoặc (b) bắt buộc mọi fixture/seed gọi `assign_dedup_keys`. Ưu tiên (a): vừa giữ unique thật, vừa không phá caller cũ. Sau đó **chạy lại full regression trên VPS** (khi image được sửa). |
| **O2** | **MAJOR** | `migrations/0015_intradaytick_dedup_key_and_more.py:13-38` vs `tick_dedup.py:26-49` | Backfill: `md5(concat_ws('|', … to_char(ts AT TIME ZONE 'UTC','…MS"Z"'), price::text …))`. Runtime: `sha256('|'.join([... _norm_datetime() → `isoformat()` …]))`. Hash **và** format input đều khác ⇒ key backfill ≠ key runtime cho cùng 1 tick. | Warm path `tasks.py:481-487` đọc key md5 từ DB, so với key sha256 vừa tính ⇒ **không khớp** → `bulk_create` tại `:501` (không có `ignore_conflicts=True`) chèn **tick trùng** cho dữ liệu đã migrate. Phản hẳn tuyên bố "backfill ×2 không tăng row" với dữ liệu cũ. | Backfill phải **tái tạo đúng key runtime**: dùng cùng sha256 + cùng chuỗi input, hoặc inline logic `build_dedup_key` trong migration (kèm test so sánh key backfill vs key helper trên cùng 1 row). Nếu cố tình giữ md5, phải thêm test chứng minh legacy key được nhận diện — hiện **không có**. |
| **O3** | MED / Reservation | `tick_dedup.py:56-58`; `tasks.py:458,470,2563` | `assign_dedup_keys` **không sort**, chỉ ghi chú caller phải giữ thứ tự ổn định. `normalized_trades` lấy `list(raw_trades)` theo thứ tự provider; `ticks` từ `fetch_intraday_tape_history` truyền thẳng. | Nếu retry trả thứ tự khác (page boundary/list reorder), `seq_in_key` đổi ⇒ key đổi ⇒ trùng. G-2 "stable across retries" **chưa được code bảo đảm**, mới là giả định provider ổn định. | Ghi rõ giả định trong evidence + thêm test 2 lần `assign_dedup_keys` với thứ tự đảo để đoát (hiện tại sẽ đỏ). Hoặc chuẩn hoá: sort theo `timestamp` rồi giữ provider index làm tie-break ổn định. |
| **O4** | MED | `test_intraday_tick_dedup.py:17`; `s3-gates.md:38` | Fail-before chỉ là `ModuleNotFoundError` do import module-level. Tín hiệu đỏ mạnh hơn (`test_duplicate_insert_without_ignore_conflicts_raises` trên code cũ phải **DID NOT RAISE IntegrityError**) bị chặn bởi import. | Bằng chứng đỏ chưa chứng minh bug hành vi (nuốt lệnh / không có unique) sẽ bị bắt nếu module tồn tại. | Tách import helper vào test riêng (guard `ImportError`) để chạy riêng test constraint trên code cũ; ghi output `DID NOT RAISE` làm fail-before behavior-level. |
| **O5** | Reservation (B9) | worktree HEAD `4281f3484`; `origin/dev 859b88232`; `git rev-list --count HEAD..origin/dev = 3` | Slice được xây trên `4f9c99dd0`, `origin/dev` đã trôi 3 commit. Mọi gate của tác giả chạy **trước rebase**. | Theo L-003, gate sau rebase mới đại diện code cuối. | B9: `agent-sync.ps1` (rebase → check migration → gate) rồi **chạy lại mọi gate**, re-verify `file:line`. |

### Protocol — đã kiểm chứng đúng

- Claim **trước** code: `fa8141cf0` (claim) → `cd5a84b3b` (test) → `8a851dd17` (fix) → `4281f3484` (fix assert). Tên claim `m03-tick-dedup` **khớp** branch `feat/m03-tick-dedup` (L-M02). Dòng claim cuối `docs/CLAIMS.md:2105` có nội dung G-2 + "không tự đặt số migration" + "không ghi staging".
- Migration **0015** sau head **0014** (`git ls-tree origin/dev -- .../migrations/` → `0014_alter_pricerebaserun_status.py` là head); **không** tự đặt `0013`.
- **Không có file deny-list** trong diff (`git diff --stat origin/dev...HEAD`): chỉ `docs/CLAIMS.md` (append được phép), model/migration/tasks/test, docs/system-design, evidence.
- `docs/system-design` sync **trung thực**: C-003 `151→152` ở cả doc `01.01-tom-tat-dieu-hanh.md:17` lẫn `_meta/claims.json:24-26`. Auditor tự chạy `node .../check-system-design.mjs --check` → `SACH — exit 0`; `git ls-tree -r HEAD` đếm migration theo regex của tool = 152 ⇒ **không phải hạ gate để xanh**.
- Staging probe **chỉ đọc**: `s3-gates.md:8-15` là `SELECT ... count(...)`, không có `UPDATE/DELETE/INSERT`. Phù hợp Q2=KHÔNG.

---

## Cổng đã chạy / CHƯA CHẠY

| Cổng | Auditor tự chạy? | Kết quả |
|---|---|---|
| `git status --short` (worktree) | CÓ | `?? docs/evidence/market-data-integrity/` (thư mục evidence chưa track) — không có file lạ. |
| `git log --oneline -5` | CÓ | 4 commit slice + `4f9c99dd0` base; thứ tự claim→test→fix đúng. |
| `node packages/web/scripts/check-multi-agent.mjs` | CÓ | `0 lỗi, 0 trùng số migration — PASS` (kèm nhiều warning claim stale, không chặn) — output tail đã đọc. |
| `node docs/system-design/_meta/tools/check-system-design.mjs --check` | CÓ | `SACH — exit 0`; `check-claims: 6 tuyên bố — khớp code`. |
| `git diff origin/dev...HEAD` / `git show origin/dev:ledger` | CÓ | 11 file, +251/-31; ledger head `origin/dev` = **Entry 680**. |
| Django 6 `bulk_create` API | CÓ (đọc source `stable/6.0.x`, `query.py:749-853`) | `return objs` → assert `len(created)==1` đúng. |
| `py_compile`, `pytest`, `makemigrations --check`, `pre-push-gate`, EOL | **KHÔNG** (theo yêu cầu read-only, và cần env staging) | Chỉ trích evidence tác giả `s3-gates.md:52-61`; **auditor KHÔNG xác nhận lại** → ghi **CHƯA CHẠY (bởi auditor)**. |
| Docker / build / FE tsc | **KHÔNG** | Đúng yêu cầu; không chạy. |

---

## Kết luận (B9 readiness + Entry number)

- **B9 readiness: CHƯA SẴN SÀNG.** Cổng B8 yêu cầu `0 blocker + 0 major`; hiện có O1 (blocker) + O2 (major). Phải sửa O1/O2, chạy lại regression thật trên VPS staging (khi image `vninvest-core-api:staging` có lại `vninvest_core.utils.encryption`), rebase `origin/dev`, chạy lại toàn bộ gate, rồi **re-audit vòng tiếp theo** (tối đa 3 vòng sửa theo quy định).
- **Entry number:** hiện `origin/dev @ 859b88232` head ledger = **Entry 680** (`git show origin/dev:docs/CODE_CHANGE_AUDIT_LEDGER.md | Select-String '^## Entry' | Select -First 1`). Entry **681/682 tồn tại trên branch chưa merge** (`git log --all --oneline -- docs/CODE_CHANGE_AUDIT_LEDGER.md` → `aced103d3` S1/681, `451bfa6cc` S2/682). Vì vậy **683 đúng nếu S1→S2 merge vào dev trước S3** — khớp ghi chú của tác giả `s3-gates.md:71`. **Phải re-check lại ngay tại B9 sau rebase**; không chốt số trên worktree đang lùi 3 commit.
- **Khuyến nghị chuyển B4→B5 tiếp theo:** sau khi O1/O2 sửa, ưu tiên reproduce O1 bằng 1 lệnh pytest duy nhất trên file fixture bất kỳ (vd `test_intraday_tape_api.py`) để biến blocker thành bằng chứng đỏ/đã sửa, thay vì để nó nằm trong phần `CHƯA CHẠY`.
