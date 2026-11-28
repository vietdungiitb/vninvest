# RE-AUDIT ĐỘC LẬP VÒNG 2 — S3 (2026-11-28)

- **Vai trò:** cùng auditor độc lập vòng 1 (B8 vòng 2 / final), **CHỈ ĐỌC**; không sửa code production, không chạy pytest/docker/build.
- **Phạm vi:** sửa theo `S3_REAUDIT.md` (O1..O5) · code thật `market_data/models.py`, `market_data/tick_dedup.py`, `market_data/migrations/0015_...py`, `market_data/tests/test_intraday_tick_dedup.py` · evidence `s3-gates.md` §4b · `git diff origin/dev...HEAD`.
- **Baseline đo được:** worktree `D:\Mujoco Projects\wt\m03-tick-dedup`, branch `feat/m03-tick-dedup`, HEAD **`658d36c0b`** (2 commit fix sau vòng 1: `bcd086d1e`, `658d36c0b`), base vẫn `4f9c99dd0`. `origin/dev` hiện **`4959c58a75`** — worktree đang **6 commit phía sau** (`git rev-list --count HEAD..origin/dev` = `6`; lúc vòng 1 là 3).
- **Phương pháp:** đọc code + đối chiếu từng dòng helper ↔ migration + kiểm Django 6 source (`constraints.py`) + chạy gate read-only. Mọi số kèm lệnh tái tạo; thứ không tự chạy ghi `CHƯA CHẠY`.

---

## Verdict

**AGREE (reservations)** — O1 (BLOCKER) và O2 (MAJOR) đã sửa thật, O3/O4 đã sửa; **không còn P0/P1**. Cổng ra B8 đạt (`0 blocker + 0 major`). **B9 có thể tiến hành**, nhưng phải đóng 5 reservation dưới đây trước khi merge; reservation **không** nằm ở logic dedup/key.

| ID | Reservation | Người đóng | Đóng ở bước |
|---|---|---|---|
| **R1** | Worktree lùi **6 commit** so với `origin/dev @ 4959c58a75`; mọi gate hiện tại chạy trên code cũ. Phải `agent-sync.ps1` (rebase → check migration → gate) rồi **chạy lại toàn bộ gate + re-verify `file:line`** (L-003). | Tác giả + coordinator | **B9, trước merge** |
| **R2** | Seq tie-order cross-boundary: migration sort tie theo `id` (`migration:49`), runtime sort tie theo thứ tự provider (`tick_dedup.py:69`, Python stable sort). Nếu provider đổi thứ tự các tick **cùng giây/trùng tuple**, key backfill ≠ key re-fetch. Đây là tàn dư cố hữu của Q3 (không có trade ID), chấp nhận được nhưng phải ghi rõ là giả định. | Tác giả (ghi evidence) | B9, cập nhật `s3-gates.md` §4b |
| **R3** | Evidence `s3-gates.md` **tự mâu thuẫn**: §2 `:30` vẫn ghi "backfill md5 theo row_number()", §3 `:39` "Ran 5 tests", §4 `:50` "min_len=32" — trong khi §4b `:57` ghi sha256/min_len=64 và test nay có **7** test. Phải làm sạch để auditor sau không đọc nhầm. | Tác giả | B9, sửa evidence (doc-only) |
| **R4** | `makemigrations --check --dry-run` tác giả báo exit 0 (`s3-gates.md:67`); auditor **KHÔNG tự chạy** (thiếu env Django/DB). Đã kiểm chứng cấu trúc tương đương qua Django 6 source (xem O2). Phải chạy lại sau R1. | Tác giả | B9, sau rebase |
| **R5** | Full regression `market_data` + `data_ingest` vẫn **CHƯA CHẠY ĐƯỢC** do image staging thiếu `vninvest_core.utils.encryption` (`s3-gates.md:73-77`). Ghi nhận trung thực, không đổ cho diff; nhưng **không được báo PASS full suite** khi chưa chạy được. | Coordinator (sửa image) → tác giả (chạy) | Sau B9 merge, trước cutover |

---

## Trả lời O1..O5 (bằng chứng `file:line`)

**O1 — BLOCKER: ĐÃ GIẢI QUYẾT.**
- Model `models.py:339-343`: `UniqueConstraint(fields=['dedup_key'], name='uniq_intraday_tick_dedup_key', condition=models.Q(dedup_key__gt=''))` → partial unique index. `models.Q` hợp lệ dù models.py chỉ `from django.db import models` (`:11`) — `models.Q` là re-export chuẩn của Django.
- Migration `:83-90`: cùng `condition=models.Q(dedup_key__gt='')`, cùng tên, cùng field. Django 6 `UniqueConstraint.__init__` chuẩn hoá `self.fields = tuple(fields)` (`django/db/models/constraints.py:318`) nên khác nhau list `[]` vs tuple `()` **không** tạo pending migration; `deconstruct` trả `self.fields` + `self.condition` (`:556-570`) ⇒ hai bên bằng nhau.
- Bằng chứng hành vi thật trên Postgres: `s3-gates.md:56` — 2 row `dedup_key=''` insert OK; 2 row cùng `real_key_123` → `ERROR: duplicate key value violates unique constraint`. ⇒ legacy fixture (đã trace vòng 1 tại 6 file) không còn vỡ; duplicate key thật vẫn bị chặn.

**O2 — MAJOR: ĐÃ GIẢI QUYẾT (đối chiếu từng dòng).**

| Thành phần | Runtime `tick_dedup.py` | Migration `0015` | Khớp? |
|---|---|---|---|
| `_norm_datetime` | `:19-26` (str→giữ nguyên; naive→UTC; `astimezone(utc).isoformat()`; fallback `str`) | `:14-19` (str→giữ nguyên; naive→UTC; `astimezone(utc).isoformat()`) | ✅ với mọi giá trị DB thực tế (`datetime`); migration không có fallback `str()` nhưng `timestamp` NOT NULL nên không bao giờ chạm |
| `_norm_price` | `:29-31` `format(Decimal(str(v or 0)).normalize(), 'f')` | `:22-23` **y hệt** | ✅ |
| 8 phần hash | `:46-55`: symbol.upper · norm_dt · norm_price · int(volume) · side.upper · match_type · source · seq | `:27-36`: **y hệt thứ tự + hàm** | ✅ |
| Hash | `:56` `sha256('\|'.join(parts))` | `:37` `sha256('\|'.join(parts))` | ✅ |
| Backfill | `assign_dedup_keys` `:59-93` | `_backfill_dedup_key` `:40-67` (Python, `bulk_update` 2000/chunk, **không import app code**) | ✅ |

- Partition-group price: runtime dùng `str(Decimal(...))` (`:75`) rồi `_norm_price` lại ở `:49`; migration dùng `_norm_price` ngay (`:53`) rồi `_norm_price` lại ở `:30` ⇒ **hai lần chuẩn hoá hội tụ về cùng chuỗi** (`'100000.00'` và `100000.0` đều → `'100000'`). Không làm sai key.
- Tác giả báo verify VPS: 3 row trùng → 3 key, `min_len=64` (không còn md5 32) (`s3-gates.md:57`). ✅ O2 đóng.

**O3 — MED: ĐÃ GIẢI QUYẾT (kèm R2).**
- `tick_dedup.py:66-69`: `materialized.sort(key=lambda row: _norm_datetime(row.get('timestamp')))` — sort ổn định theo timestamp; tie giữ thứ tự provider. Comment `:66-68` nêu rõ lý do retry.
- Không đổi semantics bar: `_hydrate_intraday_symbols` vẫn dùng `normalized_trades` gốc cho `_build_intraday_bar_payloads` (`tasks.py:505`); chỉ `keyed_trades` (bản đã sort) dùng cho tick (`:480,485,489`). ✅
- R2: tie-order giữa migration (`id`) và runtime (provider) vẫn là giả định — xem reservation.

**O4 — MED: ĐÃ GIẢI QUYẾT.**
- Module-level import helper đã bỏ: test file `:16` chỉ `from market_data.models import IntradayTick`; helper import chuyển vào `IntradayTickDedupTests.setUp` (`:61-67`). ⇒ 2 test của `IntradayTickDedupConstraintTests` (`:31-57`) **chạy được trên code cũ**.
- `test_unique_constraint_exists_on_dedup_key` (`:41-51`) gọi `connection.introspection.get_constraints` + `assertIn('uniq_intraday_tick_dedup_key')` → trên code cũ (không có constraint) là **đỏ hành vi thật**, đúng yêu cầu.
- `test_legacy_empty_key_rows_are_allowed` (`:53-57`) tạo 2 row `dedup_key=''` và assert count 2 → trên bản constraint full (trước fix O1) là đỏ; trên code cũ không có constraint thì xanh (đây là test bảo vệ O1, không phải tín hiệu đỏ chính).
- 5 test helper cũ (`:72-108`) vẫn giữ assert thật: key khác nhau, `after==before`, `IntegrityError`, positive control. Không có assertion nào bị suy yếu.

**O5 — Reservation: GIỮ NGUYÊN → R1.** Rebase chưa xảy ra; `origin/dev` trôi thêm 3 commit kể từ vòng 1 (3→6). Entry xác nhận ở phần Kết luận.

---

## Findings mới (nếu có)

| ID | Mức | file:line | Thực tế | Tác động | Đề xuất |
|---|---|---|---|---|---|
| **F-N1** | LOW | `s3-gates.md:30,38-39,45-50` vs `:52-60` | §2/§3/§4 còn mô tả md5, `row_number()`, `Ran 5 tests`, `min_len=32` — đã bị §4b thay thế | Không ảnh hưởng code, nhưng evidence tự mâu thuẫn → auditor sau có thể kết luận sai (đúng nhóm L-V02: gốc rễ kế thừa sai) | Sửa §2/§3/§4 theo kết quả cuối (sha256, 7 test, min_len=64) trước B9 — R3 |
| **F-N2** | LOW | `tick_dedup.py:69` vs `migration:49`; `test_...:41-51` | Test introspection chỉ assert **tên + cột**, không assert predicate `WHERE dedup_key > ''` | Một constraint full (không partial) vẫn qua test này; hành vi riêng đã được Postgres probe ở §4b nên rủi ro thấp | Thêm assert điều kiện partial trong test introspection (optional, không chặn B9) |
| **F-N3** | INFO | `migration:14-19` | `_norm_datetime` thiếu fallback `str(value)` như runtime `:26` | Vô hại với DB timestamp NOT NULL; lệch chỉ khi migration tự gọi `_build_key` với object lạ | Giữ nguyên, ghi chú trong comment migration nếu muốn |

**Không có P0/P1 mới.** Không đụng file deny-list; `docs/CLAIMS.md` vẫn chỉ append (`git diff --stat origin/dev...HEAD` không có `package.json`, `docker-compose*`, `.env*`, `pyproject.toml`, `requirements.txt`, `AGENTS.md`).

---

## Cổng đã chạy / CHƯA CHẠY

| Cổng | Auditor tự chạy? | Kết quả |
|---|---|---|
| `node packages/web/scripts/check-multi-agent.mjs` | CÓ | `0 lỗi, 0 trùng số migration — PASS` (kèm warning claim stale, không chặn) |
| `node docs/system-design/_meta/tools/check-system-design.mjs --check` | CÓ | `SACH — exit 0`; `gen-model-catalog --check: 122 model — khớp` |
| `git status --short` | CÓ | `?? docs/evidence/market-data-integrity/` — chỉ evidence chưa track; không file lạ |
| `git log --oneline -3` | CÓ | `658d36c0b` (str timestamp) · `bcd086d1e` (O1–O4) · `4281f3484` (assert Django 6) |
| `git rev-parse origin/dev` + `rev-list --count HEAD..origin/dev` | CÓ | `4959c58a75`, backlog **6** commit → R1 |
| Django 6 `UniqueConstraint` source | CÓ (fetch `stable/6.0.x`, `constraints.py:263-332,556-570`) | fields→tuple; condition deconstruct khớp → model/migration nhất quán |
| `py_compile`, `pytest`, `makemigrations --check`, `pre-push-gate`, EOL | **KHÔNG** | Chỉ trích evidence tác giả `s3-gates.md:62-71`; auditor **CHƯA CHẠY** → R4 |
| Docker / build / FE tsc | **KHÔNG** | Theo yêu cầu read-only |
| Full regression BE | **KHÔNG** | `CHƯA CHẠY ĐƯỢC` do image staging (R5) — không báo PASS |

---

## Kết luận (B9 readiness + Entry number to use at merge)

- **B9 readiness: CÓ THỂ TIẾN HÀNH** với verdict **AGREE (reservations)**. O1/O2 — hai lý do từng chặn vòng 1 — đã đóng bằng code + bằng chứng Postgres thật; O3/O4 đóng; không còn P0/P1. Cổng ra B8 đạt.
- B9 bắt buộc: (1) rebase + chạy lại gate (R1), (2) chạy lại `makemigrations --check` sau rebase (R4), (3) dọn evidence §2/§3/§4 + ghi rõ giả định tie-order (R2/R3), (4) ghi `CHƯA CHẠY` cho full regression, không báo xanh (R5). Reservation do **tác giả** đóng ở B9 trước merge; R1 phối hợp **coordinator**; R5 do **coordinator** sửa image, tác giả chạy lại sau merge.
- **Entry number:** tại thời điểm đo, `origin/dev @ 4959c58a75` head ledger vẫn là **Entry 680** (`git show origin/dev:docs/CODE_CHANGE_AUDIT_LEDGER.md | Select-String '^## Entry' | Select -First 1`). Entry **681 (S1)** và **682 (S2)** nằm trên branch chưa merge (`git log --all --oneline -- docs/CODE_CHANGE_AUDIT_LEDGER.md` → `aced103d3`, `451bfa6cc`). ⇒ Dùng **Entry 683 nếu S1→S2.merge vào `dev` trước S3** (khớp `s3-gates.md:60`); **phải re-check head ledger ngay lúc merge**, không chốt số trên worktree đang lùi 6 commit.
