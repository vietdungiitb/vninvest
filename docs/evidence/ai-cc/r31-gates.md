# R3.1 — `AITrace`: 4 bước mỗi advisory (2026-10-17)

Nhánh `feat/ai-r31-aitrace` ← `dev`. Claim `ai-r31`.
Plan: `IMPLEMENTATION_PLAN_AI_COMMAND_CENTER_COMMERCIAL_20260925.md:1043-1063`.
Mở R3. Đồng thời **đóng nợ R2.6** (`routing_decision` chưa được ghi) và ghi được
**2 P0 tiền có** mà 340 test của M2 đã bỏ sót.

## Fail-before (chạy thật trên VPS, Postgres)

Commit `520023be0` (chỉ có test, chưa có model):

```
Ran 18 tests — FAILED (failures=2, errors=16)      # ImportError advisory.models.AITrace
```

Lưu ý: 5 `errors` đầu tiên trong lần chạy đầu **không phải bug** — tôi liệt kê tên
test theo *plan* thay vì tên file thật. Bài học này đã lặp lại lần thứ hai trong cùng
ngày (M2 cũng dính).

## AC

| AC | Điều kiện | Trạng thái | Bằng chứng |
|---|---|---|---|
| AC1 | 1 refresh ⇒ **đúng 4** trace | ✅ | `test_exactly_four_traces_per_refresh` (đếm trong DB, không assert giá trị trả về) |
| AC2 | SHA-256, **không** plaintext | ✅ | `test_no_plaintext_prompt_or_response_anywhere` + `test_response_hash_matches_actual_response` (hash lại `SYNTH_OK` thật) |
| AC3 | 4 bước chung `trace_id` | ✅ | `test_all_four_steps_share_one_trace_id`, `test_trace_id_is_the_one_passed_in_context` |
| AC4 | Lỗi provider vẫn ghi `status='error'` | ✅ | sub-agent lỗi HTTP 500 → 3 trace `error`; synthesis trả JSON hỏng → 1 trace `error` + 3 trace `ok` |
| AC5 | Index `(user, session_date)` + `(trace_id)` | ✅ | introspection model **và** đọc `pg_indexes.indexdef` (xem bẫy tên index bị cắt) |
| AC6 | Retention > 90 ngày | ✅ | `purge_traces_older_than` + task `advisory.purge_ai_traces` + beat `purge-ai-traces` |

## 2 P0 tiền có — sửa ở slice này, không phải do R3.1 gây ra

Đây là phần quan trọng nhất của slice: **test đầu tiên chạy `run_async` thật với DB
thật** lộ ra 2 lỗi làm advisory **hỏng hoàn toàn** từ R2, mà 340 test của M2 không
bắt được vì mọi test đều patch `run_async`.

| # | Lỗi | Nơi | Hậu quả | Bằng chứng tiền có |
|---|---|---|---|---|
| P0-1 | `_resolve_routing()` gọi `AIDeployment.objects.all()` (ORM **sync**) từ trong event loop | `orchestrator.py` (`run_async`) | Django ném `SynchronousOnlyOperation` ⇒ **mọi** lần sinh advisory sập | Tái hiện trên `dev` đã merge `209e4c46d` bằng probe độc lập: `asyncio.run(coro_gọi__resolve_routing())` ⇒ `SynchronousOnlyOperation` |
| P0-2 | Định nghĩa `sentiment_user_prompt` nhưng **dùng** `sent_user_prompt` | `run_async` | `NameError` khi tạo task sentiment ⇒ `asyncio.gather` nổ ⇒ advisory hỏng | `dev` dòng 560 định nghĩa, dòng 579 dùng sai; commit `7caf14059` (R2.2) |

Cách sửa: routing giải ở **vùng sync** (`run()`) rồi truyền xuống `run_async`
(`sync_to_async` làm fallback nếu ai gọi thẳng `run_async`); sửa đúng tên biến.
Hai test chặn regression: `SyncOnlyOperationRegressionTest` + `NameErrorRegressionTest`.

> **Bài học lớn nhất của R2**: 340 test xanh ≠ chạy được. R2.2 và R2.6 mỗi cái mang
> vào 1 lỗi chặn toàn bộ tính năng, cả hai đều **fail âm thầm** vì không test nào
> chạy đường thật. Test AC1 của R3.1 là bài học đó thành code.

## Quyết định thiết kế (có đánh đổi, ghi rõ)

1. **1 trace = 1 bước, không phải 1 lần retry.** AC1 đòi đúng 4. Vòng retry của
   synthesis (R2.9) chỉ để lại trace cuối ⇒ **giới hạn**: muốn thấy "retry lần 2
   dính 429" thì phải đọc log, không đọc được từ trace.
2. **Gom trace trong event loop, ghi DB sau `asyncio.run`.** ORM trong async context là
   `SynchronousOnlyOperation`. Ghi sau còn giữ trace **cùng transaction** với advisory;
   `sync_to_async` sẽ rơi sang connection/thread khác và trace có thể commit dù
   advisory rollback.
3. **`finally` ⇒ synthesis nổ vẫn còn trace** (AC4), và trace lỗi **không** làm hỏng
   advisory: mỗi insert bọc `transaction.atomic()` (**savepoint**). Không có savepoint
   thì 1 insert hỏng **abort cả transaction** ngoài trên Postgres — "nuốt lỗi" không
   đủ, phần việc sau đó vẫn chết.
4. **FK trỏ `to_field='advisory_id'`** (UUID) chứ không phải pk `id` (bigint) — khớp
   cách mọi call site gọi advisory. Hệ quả đã đo: `advisory_id` sai **không** bị bắt
   lúc insert (FK của Django **deferred**), chỉ lộ lúc `commit`. Vì vậy hợp đồng đã
   chọn và có test: thiếu định danh ⇒ **bỏ qua**, còn `advisory_id` sai là vi phạm của
   người gọi.
5. **Chỉ hash, không lưu plaintext** (PIPL 13/2023) — đánh đổi có chủ đích như plan
   đã phản biện: không debug được nội dung prompt. Ghi rõ ở docstring model.

## Bẫy gặp trong slice này

| Bẫy | Hậu quả | Cách tránh |
|---|---|---|
| `def` cấp module chen **giữa thân class** | Kết thúc class ⇒ `run_async` mất thuộc tính ⇒ `AttributeError` | Hàm phụ đặt **trước** hoặc **sau** class, không chen giữa |
| `normalize-eol.mjs` đọc file đã `git rm` | Hook `pre-commit` chết ENOENT + báo L-T01 **sai** | Đã sửa tool: bỏ qua file không tồn tại (`scripts/normalize-eol.mjs`) |
| Tên index Postgres bị **cắt 63 ký tự** | `advisory_aitrace_user_id_session_date_…` → `advisory_ai_user_id_e7df41_idx` ⇒ assert theo tên là fail giả | Assert theo **cột** trong `pg_indexes.indexdef` |
| Postgres **không có cast** `bigint → uuid` | Migration 2 bước (0020 bigint → 0021 uuid) không chạy được | Migration chưa phát hành thì **gộp** 1 file, đừng sửa 2 bước |
| FK Django **deferred** | Vi phạm FK lộ lúc `commit`, không lúc `insert` | Dùng lỗi **immediate** (UNIQUE/NOT NULL) khi muốn chứng minh cơ chế transaction |
| Assertion của chính tôi: `sha256_hex(hash)` | Không bao giờ đúng — test fail vô lý | Hash lại chuỗi **đã biết** rồi so |

## Gate đã chạy (không suy diễn)

| Gate | Lệnh | Kết quả |
|---|---|---|
| Fail-before | `tests.test_ai_trace` trên commit RED | `18 test · failures=2 · errors=16` |
| GREEN | `tests.test_ai_trace` | **23/23 OK** |
| Hồi quy | 31 module (340 của M2 + 23 R3.1 + 30 advisory khác) | **393/393 OK** |
| Migration | `migrate` full trên DB sạch + `showmigrations advisory` | OK, advisory kết thúc `[X] 0020_aitrace` |
| Migration đủ | `makemigrations --check --dry-run` | `No changes detected` |
| Django check | `manage.py check` | 0 issue |
| pre-push | `git push` | **23 PASS / 0 FAIL** |
| Type-check | `npx tsc --noEmit` | exit 0 |
| DAG | `npm run check:ai-cc-dag` | PASS 46 nút / 61 cạnh / 0 vòng |
| system-design | `check-system-design --check` | SACH (116 model · 132 migration · **45** beat) |

### Hệ quả phụ ngoài phạm vi (đã xử lý vì chặn gate)

- `docs/system-design/01.01` + `claims.json` **C-005**: 44 → **45** lịch Celery beat
  (thêm `purge-ai-traces`). Cập nhật **cả** doc lẫn claim — gate kiểm doc khớp code,
  sửa `claims.json` một mình sẽ làm hỏng ý nghĩa của gate.
- `scripts/normalize-eol.mjs`: bỏ qua file đã xoá (bug thật, chặn mọi lần `git rm`).

## CHƯA CHẠY (không được báo là PASS)

- **Nội dung trace thật chưa từng được kiểm với provider thật**: mọi test dùng client
  giả. Staging không có key dùng được (xem R2.10 AC8 trong `R2-M2-CLOSEOUT.md`).
- **UI**: R3.2 mới là trang "Traces" — R3.1 chỉ có model + ghi. Không có API đọc
  trace cho FE ở slice này.
- Full BE ngoài advisory · `ruff` · E2E Playwright · staging deploy.
- Không có `sync_to_async` cho bước **ghi** (cố ý — xem quyết định 2).

## Tiếp

**R3.2** (trang Traces cạnh Usage) cần endpoint đọc `AITrace` — chưa có trong slice này.
Trước R3.2 nên chạy M3 (đo lại sau merge) vì R3.1 vừa sửa 2 P0 ở đường thật.