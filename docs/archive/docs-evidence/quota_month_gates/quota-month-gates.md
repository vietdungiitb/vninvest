# quota-month — quota tích luỹ theo THÁNG (2026-09-26)

Agent: `quota-month` · worktree `C:\Mujoco Projects\quota-month` · branch `feat/quota-month` · DB `ag_quota_month`

Owner chốt: **tích luỹ theo tháng** + **để nguyên dữ liệu, tích luỹ từ thời điểm sửa** (không migration).

## Đơn vị: THÁNG, không phải tuần

Câu hỏi ban đầu là "nên theo tuần?". Đọc code cho thấy **tháng là đơn vị đã được thiết kế sẵn**, đổi sang tuần sẽ lệch billing:

| bằng chứng | nơi |
|---|---|
| `verbose_name='API calls monthly limit'` | `identity_access/models.py:107` |
| `QuotaRecord.period_start/period_end` + `unique_together(tenant, period_start, period_end)` | `commercial/models.py:41,55` |
| `_current_billing_period()` trả mốc tháng | `commercial/tasks.py:87-91` |
| hoá đơn sinh theo tháng | `commercial/tasks.py:177` |
| plan: free 1.000 · starter 10.000 · pro 50.000 | `commercial/plan_catalog.py:64,74,84` |
| `flush_quota_counters` seed limit từ plan | `commercial/tasks.py:157` |

⇒ Lỗi **không phải ở đơn vị** mà ở **bộ đếm**.

## 4 chỗ lệch (tất cả là bug, không phải quyết định sản phẩm)

1. `middleware.py:378,391` — so bộ đếm **ngày** với hạn mức **tháng** ⇒ ~30x
2. `tasks.py` `flush_quota_counters` — đọc khoá **ngày**, ghi `=` (ghi đè, không cộng) vào bản ghi **tháng** ⇒ `api_calls_used` không bao giờ tích luỹ
3. `views_dashboard.py:82` — `quota_headroom_pct` = hôm nay / hạn mức tháng ⇒ luôn ~100%
4. `middleware.py:414` — chuỗi 429 nói **"trong ngày"** trong khi field là monthly

## Ràng buộc quyết định cách sửa

`REDIS_KEY_TTL_SECONDS = 86400 * 2` (`middleware.py:337`) = **48h**. Không thể
cộng dồn 30 ngày từ Redis — dữ liệu biến mất sau 2 ngày. Bắt buộc thêm bộ đếm
**tháng** chạy song song.

## Thay đổi

- **`commercial/quota_period.py` (new)** — SSOT: `current_billing_period()`,
  `period_slug()`, `month_counter_key()`, `month_counter_ttl()`,
  `month_counter_scan_pattern()`. Trước đó chỉ `tasks.py` định nghĩa mốc kỳ,
  middleware phải tự tính lại ⇒ 2 nơi định nghĩa.
- **`middleware.py`** — `_increment_monthly_counter()`; `used_calls` lấy từ bộ
  đếm tháng; bộ đếm ngày **giữ nguyên** cho analytics; 429 đổi "trong ngày" →
  "trong tháng" + thêm `"period": "monthly"`.
- **`tasks.py`** — `flush_quota_counters` quét khoá tháng; `_current_billing_period`
  uỷ quyền cho SSOT; trả `period` + `unit` trong kết quả.
- **`views_dashboard.py`** — biến `api_calls_today` → `api_calls_used_period`
  (giá trị đúng là tích luỹ tháng). **Khoá JSON `api_calls_today` giữ nguyên** vì
  FE đọc ở `TenantAdminHomePage.tsx:399` — đổi khoá sẽ phá contract.
- **i18n** — `apiCallsLabel` VI/EN thêm `/ tháng` / `/ month` để số tháng không
  bị hiểu là số ngày.
- **không tạo migration** (theo lựa chọn của owner).

Enterprise vẫn soft-limit (chỉ warning) — giữ nguyên.

## Bằng chứng 30x — đo được, không phải suy luận

Gọi thật `_increment_daily_counter` + `_increment_monthly_counter`, giả lập 2 ngày
bằng cách patch `timezone.now()` trong middleware, hạn mức 1.000:

```
Ngày 1 (2026-09-01): dùng hết 1000 gọi
  bộ đếm NGÀY  =  1000  -> logic CŨ vs hạn mức tháng 1000: CHO QUA
  bộ đếm THÁNG =  1000  -> logic MỚI vs hạn mức tháng 1000: CHO QUA
Ngày 2 (2026-09-02): +1 gọi
  bộ đếm NGÀY  =     1  -> logic CŨ: CHO QUA          <-- vẫn CHO QUA
  bộ đếm THÁNG =  1001  -> logic MỚI: CHẶN              <-- chặn đúng

Logic CŨ: mỗi ngày lại đếm từ 1 => cả tháng cho phép 30000 gọi (30x).
Logic MỚI: chặn tại gọi thứ 1001 của tháng, bất kể đã sang ngày mới.
```

Lần demo đầu **không** chứng minh được gì (cả hai bộ đếm đều 1001 trong cùng
ngày) — phải mô phỏng sang ngày 2 mới thấy chênh lệch.

## Test

**Mới** — `packages/core/backend/tests/test_quota_period_accumulation.py` (19):
mốc kỳ (tháng 31 ngày, 2/28, năm nhuận, 12/31) · slug/khoá · TTL tháng > TTL ngay
và = phần còn lại + buffer · tích luỹ `[1,2,3,4,5]` · tenant tách biệt · tháng
mới = khoá mới · khoá ngay và khoá tháng độc lập · khoá biến mất giữa chừng ·
glob quét chỉ khớp khoá tháng · trích tenant id · 429 nói "tháng" không nói
"ngày" · `verbose_name` chứa "monthly".

**Cập nhật** (đổi đơn vị nên contract cũ không còn đúng):
- `test_commercial_tasks.py` — seed khoá tháng + assert `unit == 'monthly'`; thêm
  test chứng minh glob quét **không** khớp khoá ngay
- `test_tenantreg_c2_quota_entitlement.py` — seed khoá tháng
- `test_tenantreg_b.py` — 3 test kích hoạt chặn thêm patch
  `_increment_monthly_counter`; thêm assert `period == 'monthly'`. Test chỉ assert
  bộ đếm ngày được gọi thì **giữ nguyên** (bộ đếm tháng chạy thật với LocMem, dưới hạn)

### Sai lầm của tôi trong lúc làm

- Tôi lập luận `_extract_tenant_id_from_key` (lấy `parts[-2]`) sẽ trả **slug
  tháng** thay vì tenant id vì khoá tháng có 5 phần. **Sai** — `parts[-2]` của
  khoá 5 phần rơi đúng vào index 3 = tenant. Tôi đã **xoá** helper thừa
  `_extract_month_tenant_id` và viết test ghi lại sự thật đã verify.
- `git mv` fail với file untracked rồi `Remove-Item -Recurse` **xoá mất** file
  test — phải viết lại.
- Test dùng `date(2026, 9, 31)` — tháng 9 chỉ 30 ngày.
- TTL tôi kỳ vọng 39, thực tế `(30-1) + 5 = 34`.
- Test dựa vào `_QuotaCacheStub` để kiểm tra việc lọc glob — vô dụng vì stub
  `scan_iter` bỏ qua `match`. Đã tách `month_counter_scan_pattern()` thành hàm
  thuần và test bằng `fnmatch`.

## Gates

| gate | kết quả |
|---|---|
| `manage.py check` | 0 issue |
| `makemigrations --check --dry-run` | `No changes detected` |
| 3 file quota liên quan | **107 test OK** |
| **full BE suite** | `621 test — FAILED (failures=10, errors=3)` |
| **full BE baseline (`dev` sạch)** | `602 test — FAILED (failures=10, errors=3)` |
| so sánh tập lỗi | **giống hệt, 0 lỗi mới, 0 lỗi bị giấu** |
| `tsc --noEmit` | exit 0 |
| `eslint` (2 file i18n) | exit 0 |
| `npm run i18n:scan` | exit 0 |
| parity `apiCallsLabel` VI/EN | cả 2 đã đổi |

13 lỗi tồn tại ở cả hai bên: `test_admin_route` · `test_scheduler_management_commands`
(6) · `test_audit_logs_api` · `test_session_facts_api` (4) ·
`test_stock_management_api_routes`. **Không cái nào liên quan quota/middleware/dashboard.**

## Rủi ro cần owner biết

Sau khi deploy, tenant vượt hạn tháng sẽ **bị chặn thật** (trước đây ~30x lỏng).
`api_calls_used` hiện tại ghi đè nên không đáng tin — coi như 0 (theo lựa chọn của
owner). Nên theo dõi 429 sau khi deploy.

Còn nợ: giá trị `STRICT_TURNSTILE_ENFORCEMENT` không hợp lệ vẫn tắt strict
(từ PR #22) — tách ticket, cần chốt policy.
