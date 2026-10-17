# R3 + M3 — đo lại sau khi merge (2026-10-17)

Đo trên `dev` **đã merge** (`5306a2070`) bằng worktree tách biệt `/tmp/ai-m3`, **không**
phải nhánh của slice. Claim `ai-m3`.

M3 tồn tại vì M2 đã chứng minh điều đó: 340 test GREEN trên từng slice ≠ chạy được
sau merge (3 lỗi chỉ lộ khi đo lại), và R3.1 vừa sửa **2 P0 ở đường thật**.

## 1. Test thật trên `dev` đã merge — **501/501 OK**

```
SO MODULE=41
bash /tmp/vps-m3-test.sh <41 module>   # DB ai_m3, container vninvest-core-api:staging
Ran 501 tests — OK
```

Danh sách module **tự sinh từ file thật** (`ls tests/test_ai*.py tests/test_advisory*.py`),
không gõ tay — vì M2 và R3.1 đều từng vấp: M2 gõ theo *plan* ⇒ 5 `ModuleNotFoundError`
giả; R3.1 gõ tay và **bỏ sót 10 module**.

| Lần đo | Module | Test | Ghi chú |
|---|---|---|---|
| M2 (27 module, gõ tay) | 27 | 340 | thiếu 10 module advisory |
| R3.1 (31 module, gõ tay) | 31 | 393 | +4 module advisory, +1 module R3.1 |
| **M3 (41 module, sinh tự động)** | **41** | **501** | +108 test từ 10 module bị bỏ sót |

⇒ **Số liệu cũ của M2 (340) đã đánh giá thấp độ phủ.** "340/340 OK" đúng, nhưng nó
không phải con số đầy đủ. Đây là bài học thứ hai của M3: **danh sách test gõ tay âm
thầm báo cáo phủ kém** mà vẫn xanh.

### Sửa lỗi harness của chính tôi (không phải lỗi sản phẩm)

Lần chạy đầu của M3: `501 test · failures=1` —
`test_advisory_model_validation.test_dead_models_absent_from_frontend_catalogue`
báo *"không tìm thấy /web/src/shared/providerModels.ts"*.

Đã kiểm chứng **không phải** lỗi repo: `packages/web/src/shared/providerModels.ts`
**có thật** (`Test-Path` = True). Test resolve `Path(__file__).parents[3] / 'web' / …`
⇒ cần mount `packages/web` vào `/web`. Harness của tôi chỉ mount
`packages/core/backend` ⇒ mọi test đọc file FE đều hỏng. Đã sửa harness
(`-v packages/web:/web:ro`) ⇒ **501/501**.

> Sửa harness chứ **không** xoá assertion. Đây đúng kiểu "gate báo đỏ vì môi trường
> đo sai" — nguyên tắc L-007 nói rõ: không có môi trường ⇒ không có kết luận.

## 2. Migration trên DB sạch

| Kiểm tra | Kết quả |
|---|---|
| `migrate` (DB tạm mới, không dữ liệu) | `advisory.0020_aitrace... OK` |
| Chuỗi `advisory` | kết thúc `[X] 0020_aitrace` — **một** leaf, không xung đột |
| `makemigrations --check --dry-run` | `No changes detected` |
| Số cột bảng `advisory_aitrace` | **18** (khớp số field của model) |

## 3. Hai P0 của R2 — đã thật sự hết trên `dev`

Không chỉ "test xanh": hai lớp chặn regression (`SyncOnlyOperationRegressionTest`,
`NameErrorRegressionTest`) nằm trong 501 test kể trên, và chúng **chạy đường thật**
(`run()` → `asyncio.run(run_async)` với DB thật).

## 4. Khoảng trống đã đo bằng grep (không phải trí nhớ)

`git grep "AITrace"` cho 7 file, **không có** file nào ở `views` / `urls` /
`serializers`:

| Nơi dùng | Vai trò |
|---|---|
| `advisory/models.py` | model |
| `advisory/trace.py` | hash + ghi + retention |
| `advisory/orchestrator.py` | gom trace rồi ghi sau `asyncio.run` |
| `advisory/tasks.py` | dựng `trace_ctx` + task `purge_ai_traces` |
| `vninvest_core/settings.py`, `queue_policy.py` | beat `purge-ai-traces` |
| `advisory/migrations/0020_aitrace.py` | schema |

⇒ **Đã xác nhận bằng đo**: chưa có API đọc trace. `AITrace` hiện là dữ liệu **ghi một
chiều**. R3.2 (trang "Traces") phải tự viết endpoint; không có sẵn gì để tái dùng.

## 5. Gate

| Gate | Kết quả |
|---|---|
| BE test AI+advisory trên `dev` merge | **501/501 OK** (41 module) |
| `migrate` DB sạch + `showmigrations` + `makemigrations --check` | OK · `[X] 0020_aitrace` · No changes |
| `tsc --noEmit` | exit 0 |
| `npm run build` | exit 0 (`✓ built in 57.42s`) |
| `check:ai-cc` | SACH |
| `check:ai-cc-dag` | PASS 46 nút / 61 cạnh / 0 vòng / 0 dangling / 5 nút gốc |
| `lint` | **0 error** / 4067 warning — **y hệt M2** ⇒ R3.1 không đụng FE (khớp kỳ vọng) |
| `check-system-design --check` | SACH (116 model · 132 migration · 45 beat) |

## CHƯA CHẠY (không báo PASS)

- **Chưa có bằng chứng chạy thật với provider**: mọi test dùng client giả. Staging vẫn
  không có key dùng được (R2.10 AC8 mở từ M2 — `gemini-3.8-flash` còn sống hay không
  **vẫn chưa biết**).
- Full BE **ngoài** advisory+AI (các app khác) · `ruff` · E2E Playwright · staging deploy.
- Trace **chưa** được đọc bởi bất kỳ đường nào (xác nhận ở §4) ⇒ chưa có bằng chứng
  end-to-end "ghi được rồi đọc lại được".
- Chưa chạy `deploy-staging.sh` ⇒ **chưa biết** migration `0020` chạy được trên
  staging thật (chỉ chạy trên DB tạm).

## Bài học của M3

1. **Danh sách test gõ tay báo cáo phủ kém mà vẫn xanh.** 27 → 41 module lộ ra 108 test
   chưa từng chạy cùng nhau. Sinh danh sách từ `ls`.
2. **Harness đo sai tạo ra "lỗi sản phẩm" giả.** Test đọc file FE cần mount `packages/web`;
   thiếu mount thì fail với thông báo trông rất giống bug thật.
3. **Đo lại sau merge là bắt buộc khi sửa đường thật** — 2 P0 của R2 đã sống suốt từ
   R2.2/R2.6 tới giờ chỉ vì không ai chạy `run_async` thật.

## Tiếp

**R3.2** — trang "Traces" cạnh Usage. Cần tự viết endpoint đọc `AITrace` (đã xác nhận
không có sẵn), phân quyền theo user, và cân nhắc AC13 (link `ghu_`) của R2 vẫn chưa làm.