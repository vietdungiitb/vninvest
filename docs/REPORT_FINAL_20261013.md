# MASTER REPORT — Project Director / Chief Architect / Tech Lead

**Dự án:** `vietdungiitb/vninvest` · **Ngày:** 2026-10-13
**Nhánh:** `fix/ledger-backfill-idempotency` → `dev`
**Phiên:** đóng P0 "test suite không chạy được" — 1 bug sản phẩm thật + 1 lệnh vận hành sai + hợp đồng test

---

## 1. TÓM TẮT ĐIỀU HÀNH

Repo bước vào phiên này **xanh trên bề mặt**: `pre-push-gate` 21/21, mọi PR đã merge,
`dev` sạch và ngang bằng `origin/dev`. Nhưng đó là bức tranh của **gate**, không phải của **sản phẩm**.

Ngay dưới bề mặt đó, **mọi báo cáo "full BE PASS" từ 2026-10-12 trở lại đều đo sai**. Số thật:

| | Số test | Kết quả |
|---|---|---|
| Báo cáo đang lưu hành | 724 | "OK" |
| **Thực tế trên `dev` sạch** | **2959** | **failures=9 · errors=14** |

Lý do: `768d0897f` (2026-10-12) sửa test discovery để `manage.py test` thấy `src/<app>/tests/`.
Con số 724 là của thời điểm **trước** khi 1 501 test kia lộ ra. Ngay khi lộ ra, chúng **đỏ** —
và không ai đo lại.

Phiên này đóng được toàn bộ: **2960 test · OK (skipped=6)**.

**Phát hiện quan trọng nhất không phải là số liệu, mà là nguyên nhân gốc:** một tín hiệu
`post_save` viết vào sổ cái mỗi lần giao dịch được lưu, trong khi migration backfill
ghi lần nữa mà không hỏi. Đây **không** chỉ là chuyện của test — bất kỳ lần rollback rồi
thiết lập lại nào trên DB thật cũng làm abort toàn bộ migration.

---

## 2. NGUYÊN NHÂN GỐC — bằng chứng, không phải giả định

Tín hiệu `post_save` trên `Transaction`
(`user_workspace/signals.py:113` → `ledger/transaction_sync.py:253`
`sync_transaction_to_ledger`) ghi `LedgerEntry` + `CashFlow` **mỗi lần giao dịch được lưu**.

Migration `0022_backfill_transaction_to_ledger.py` `forwards()` gọi `bulk_create`
mà không kiểm tra dòng đã tồn tại ⇒ ghi hai lần ⇒ đụng
`uniq_ledger_entry_tenant_external_id` ⇒ **cả migration abort**.

Probe trên test DB (`manage.py` thật, không phải lập luận):

```
LedgerEntry.objects.count() == 1          # TRƯỚC khi gọi forwards()
forwards() -> IntegrityError: duplicate key value violates unique constraint
              "uniq_ledger_entry_tenant_external_id"
              DETAIL: Key (tenant_id=1, external_id='B-1') already exists
```

**Mốc thời gian — đây là xung đột ngâm, không phải hồi quy:**

| Sự kiện | Ngày | Commit |
|---|---|---|
| 3 file test được viết (thiết kế fixture theo thế giới **trước** tín hiệu) | 2026-10-03 | `c804a9422` |
| Tín hiệu P0-2 thêm vào | 2026-10-06 | `d7226a591` |
| Test **chưa từng được** `manage.py test` chạy tới | 2026-10-12 | `768d0897f` |

Ba tài liệu test viết ngày 2026-10-03 mãi mãi là **hợp đồng với hành vi cũ**. Khi hành vi
đổi 3 ngày sau, không ai sửa chúng — vì chúng không chạy.

---

## 3. PHẦN SỬA

### 3.1 Bug sản phẩm thật — migration không idempotent

`_existing_refs()` nạp một lần `(tenant_id, ref)` đã có; ref có phiên bản `ref:v<n>`
được quy về `ref` (khớp `active_entry_for`). `forwards()` bỏ qua dòng đã có và đếm vào
`already_synced` để ghi log.

Bước verify **không đổi đối chiếu** — vẫn so với `len(entries)`, tức phần migration tự ghi.
Dòng `already_synced` không có marker nên nằm ngoài `entry_count`; nếu so với `total`
thì backfill đúng 100% cũng bị coi là FAIL. Có ghi chú nói rõ lý do.

> **Rủi ro thật nếu không sửa:** bất kỳ lần rollback rồi `migrate` lại trên DB thật nào
> cũng đi vào đúng ngõ cụt này.

### 3.2 Lệnh vận hành sai — `seed_ledger_verification.py`

Đây **không phải lỗi test**, đây là công cụ dùng để chứng minh backfill chạy đúng.
Dùng `create()` thì tín hiệu đã đầy sổ cái trước khi backfill kịp chạy, `0022` bỏ qua
(đúng — không ghi trùng), rồi lệnh kết luận:

```
CommandError: Dem khong khop: LedgerEntry=5, CashFlow=5, Transaction=6
```

Tức **báo đỏ trên chính dữ liệu sạch do nó tự tạo**.

- Sinh dữ liệu sạch: `create()` → `bulk_create`.
- `expected` trừ số giao dịch **đã có sổ cái sẵn**, đo bằng **chính** `_existing_refs`
  của migration + `source_ref_for` của runtime ⇒ hai bên không thể trôi lệch nhau.

### 3.3 Hợp đồng test — sửa fixture, **không** nới lỏng assertion

Thêm `_tx_raw()` (= `bulk_create`, không bắn `post_save`) và chỉ áp dụng **đúng cho các
test đang đỏ**. Test đang xanh giữ nguyên nguyên bản. **Không** xoá assertion nào,
**không** dùng `git checkout --` để hoàn tác (L-A01).

Lý do phải dùng `bulk_create`: các test này dựng `LedgerEntry` + `CashFlow` thủ công để
kiểm soát chính xác trạng thái sổ cái. Nếu `Transaction` tự sinh thêm một bộ nữa thì
tiền mặt bị **nhân đôi** ⇒ `cash_cross_check` bật giả, hoặc NAV ra số thay vì bị chặn.
Test sẽ đo sai thứ nó định đo.

---

## 4. KẾT QUẢ ĐO ĐƯỢC

| | Trước | Sau |
|---|---|---|
| **full BE** `manage.py test` | 2959 · **failures=9, errors=14** | 2960 · **OK (skipped=6)** |
| `test_review_findings_wave2` | 8 FAIL | **40 OK** |
| `test_seed_verification` | 1 FAIL + 4 error | **8 OK** |
| `test_ledger_migration_backfill` | 10 error | **14 OK** (+1 test mới) |

**Fail-before được chứng minh bằng vòng thật**, không phải lời hứa:
gỡ guard trong migration → test mới **ERROR** với `IntegrityError duplicate key ... Key
(tenant_id=1, external_id='B-1') already exists`; dựng lại guard → **OK**.

`data_ingest...test_warm_intraday_universe...` chạy riê **1/1 OK** và tự xanh trong full
suite ⇒ cùng là nạn nhân của thứ tự test, **khác** nguyên nhân P0-2. Không gán công
cho fix này.

---

## 5. GATE — chạy thật, sau rebase

Thứ tự đúng: **rebase → check migration → gate** (L-G01). `dev` không nhúc nhích nên
rebase sạch.

| Gate | Kết quả |
|---|---|
| `manage.py check` | 0 issues |
| `makemigrations --check --dry-run` | **No changes detected** |
| `ruff --select F821` | **All checks passed** |
| `check_admin_ux.py` | **0 lỗi, 0 cảnh báo** · self-test **25/25** |
| `tests.test_admin_ui` | **45/45** |
| `npx tsc --noEmit` | 0 lỗi |
| `npm run lint` | **0 error** (3786 warning có sẵn) |
| `npm run build` | 0 |
| full FE `test:components` | **918/918** |
| **`pre-push-gate`** | **21 PASS / 0 SKIP / 0 FAIL** |

### 5.1 Ghi trung thực về FE flake

Full FE **run 1** = `2 failed | 916 passed`; **run 2** và **run 3** = **918/918**.
`tenantreg-auth-pages.component.test.tsx` chạy riêng **29/29**.

Thay đổi của phiên này **chỉ là Python** nên FE không thể bị ảnh hưởng — nhưng **tên
file fail ở run 1 tôi không ghi lại được** (lọc output của run đó không khớp), nên tôi
**không** khẳng định "chính là file đó". Ghi nguyên trạng: **3 run, 1 đỏ, 2 xanh**.

---

## 6. BÀI HỌC

**6.1 — "Test xanh" không phải giấy phép bỏ qua soi file.**
Giữa lúc sửa, `Edit` tool khớp `oldString` chỉ với **tiền tố** của một method và nuốt mất
assertion `CashFlow.objects.count() == 0` của test kế bên. Test kia FAIL, nhưng ở **file
khác**, vào một lúc tôi đang chỉ nhìn một file khác. Nếu không đọc `git diff` cuối cùng
thì assertion đó lặng lẽ biến mất. → **Luôn đọc `git diff` trước khi commit.**

**6.2 — L-T01 lần thứ 10 và 11 trong một phiên.**
`Edit` trên Windows đổi LF→CRLF hai lần: `numstat` ra `307/252` cho file sửa ~56 dòng,
và `867/868` cho file sửa ~40 dòng. Chuẩn hoá byte-level (latin1 round-trip) → `56/1`
và `39/40`, khớp đúng `--ignore-cr-at-eol`. Bắt được vì `git diff --numstat` được chạy
**trước khi stage** — hai lần.

**6.3 — Một registry ghi "PASS" không thay thế một lần đo.**
`CLAIMS.md`, `REPORT_FINAL_20261012.md` và nhiều handoff đều ghi "full BE 724 OK".
Con số ấy đúng **cho thời điểm đó** và sai **cho code ngày hôm nay**. Nguyên nhân không
phải ai nói dối — mà là con số được ghi lại rồi tái sử dụng mà không ai đo lại sau khi
test discovery đổi.

**6.4 — Khi một tín hiệu mới làm thay đổi hợp đồng dữ liệu, các test cũ trở thành mô tả
của quá khứ.** Việc sửa chúng **không phải** nới lỏng kiểm thử, miễn là giữ nguyên ý nghĩa
AC. Fixture phải mô tả đúng trạng thái lịch sử mà AC nói tới.

---

## 7. CÒN DỞ — không tự ý làm

| # | Việc | Vì sao dừng |
|---|---|---|
| 1 | **P0-SEC-01 — repo đã PUBLIC, secret còn trong history** | Owner phải chọn: purge history (force-push, không hoàn tác được) hay chỉ rotate. Tôi không tự purge. |
| 2 | **`vite.config.ts` khai `proxy` chỉ trong `server`, không có trong `preview`** | Đã xác nhận (`vite.config.ts:27`, thiếu khối `preview`; `playwright.config.ts:71` chạy `npm run preview`) ⇒ E2E không bao giờ proxy `/api`. Nhưng sửa nó là **ticket riêng**: đụng cấu hình build, cần chạy Playwright thật mới chứng minh được, mà Playwright chưa chạy ở phiên này. |
| 3 | **5 claim `in-progress` trong `CLAIMS.md` không còn branch** (`sec03-secret-scan`, `sec02c-reencrypt-command`, `cleanup-decisions`, `cleanup-audit`, `disc-measure`) — không tồn tại local lẫn remote | Chặn preflight trên các file đã giữ. Cần chủ sở hữu từng claim xác nhận đóng hay giữ. |
| 4 | **8 branch local chưa merge** | Đã kiểm: nội dung đã vào `dev` qua squash-merge (PR #102–#107 đã MERGED). Xoá cần Owner xác nhận — không tự xoá. |
| 5 | **`ruff` ở mức cấu hình đầy đủ** | 3 140 lỗi style/preference; Owner phải chọn mức nghiêm khác nhau. Phiên này chỉ chạy `--select F821` (lỗi runtime). |
| 6 | **CI billing** | "The job was not started because recent account payments have failed" — không riêng repo này. `scan` vẫn chạy. |

---

## 8. VERDICT

Repo **đã có nền tảng đúng**: migration đánh số đúng, hook chạy thật, 21 gate cơ máy
thật sự chặn được lỗi, và 6 PR đã merge trong tuần qua. Điểm yếu không nằm ở công cụ.

Điểm yếu nằm ở chỗ **gate đo sai thứ**. "Full BE PASS" đã được ghi lại và tái sử dụng khi
nó chỉ còn bao phủ 25% test. Phiên này chỉ cần sửa **một** nguyên nhân gốc là 23 lỗi
biến mất — nhưng phải mất công đo lại từ đầu mới thấy được.

**Khuyến nghị P1 — bắt buộc trước khi tính là "xanh":** đưa `manage.py test` (full, 2960
test) vào một gate có máy chạy được. Hiện `pre-push-gate` **không** chạy full BE suite —
đó chính là lý do 23 lỗi này sống sót qua 3 PR liên tiếp mà không ai thấy.