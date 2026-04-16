- Bổ sung helper lịch thị trường dùng chung cho prefetch/runtime fallback: hỗ trợ `holiday_dates` theo policy, phân giải `market-local date` nhất quán cho `session close retention`, `session close date` và `offpeak ingest`.
- Mở rộng `prefetch_time_policy` API/UI với `market.holiday_dates`, cho phép staff cấu hình ngày nghỉ thị trường ngay trên Admin Ops thay vì hardcode theo cuối tuần.
- Thêm regression tests cho holiday offhours và retention theo market timezone để khóa drift khi mở rộng đa thị trường/timezone.
- Seed mặc định `VN_STOCK` holiday dates từ calendar có sẵn trong `vnstock` cho năm hiện tại, giúp runtime mới có dữ liệu ngày nghỉ usable ngay sau deploy/dev reset.
- Warmup cache startup giờ bỏ qua êm khi DB/schema chưa sẵn sàng, tránh log stacktrace nhiễu trong test bootstrap và fresh dev startup.
## Ghi chú thay đổi ngày 12/04/2026

- Bổ sung bootstrap cấu hình mặc định an toàn qua script `scripts/dev-setup.ps1` để tự tạo `backend/.env`, `backend/.env.dev`, `frontend/.env` với `DJANGO_SECRET_KEY` sinh ngẫu nhiên bằng CSPRNG, giảm thao tác cấu hình thủ công sau khi clone repo.
- Cập nhật `start_dev.ps1` để tự kiểm tra và chạy bootstrap khi thiếu `backend/.env.dev`, giúp môi trường Docker dev chạy được ngay mà không cần copy `.env` bằng tay.
- Siết an toàn `SECRET_KEY` trong `backend/config/settings.py`: không còn fallback hardcoded insecure key; local dev dùng ephemeral key có cảnh báo, production bắt buộc phải set `DJANGO_SECRET_KEY` (fail-fast nếu thiếu).

- Bổ sung cấu hình runtime cho ticker prefetch trên trang Admin Ops, cho phép staff chỉnh trực tiếp mà không cần sửa `.env` hoặc restart service.
- Mở rộng backend admin settings API để trả về và cập nhật `prefetch_runtime_settings` (cache-backed, fallback về env defaults).
- Refactor task prefetch để đọc các tham số runtime (batch size, symbol limit, retry/backoff, circuit-breaker, include group symbols) từ cấu hình admin mới.
- Mở rộng UI `AdminOps` với form cấu hình prefetch runtime + rulebook hint + trạng thái lưu thành công/thất bại.
- Bổ sung i18n key đầy đủ cho EN/VI cho cụm prefetch runtime settings.
- Bổ sung test backend cho luồng cập nhật hợp lệ và validate dữ liệu không hợp lệ của `prefetch_runtime_settings`.
- Siết phạm vi sync giá Watchlist: user thường chỉ sync mã cá nhân (`tracked + watchlist`), chỉ `is_staff` mới được quét thêm nhóm thị trường toàn cục.
- Cập nhật response API sync để trả thêm `scope` (`user-only` hoặc `global+user`) nhằm quan sát rõ phạm vi tác động.
- Bổ sung regression test cho 2 chế độ sync: mặc định user-only và admin global scope.
- Bổ sung anti-spam cooldown theo user cho endpoint sync giá (`watchlist/sync`, `stock-management/sync`), trả `429` kèm `retry_after_seconds` khi bấm quá nhanh.
- Đồng bộ frontend Watchlist với cooldown backend: khi gặp `429`, nút Đồng bộ giá hiển thị countdown và tự disable theo `retry_after_seconds`.
- Đồng bộ frontend Admin Ops cho các nút quick sync: khi gặp `429`, nút hiển thị `retry in Ns` và khóa thao tác đến khi hết cooldown.
- Bổ sung `prefetch_time_policy` vào `admin system ai settings` API (cache-backed), gồm default policy, rulebook và validate payload theo market window/profile/rate-limit guard.
- Mở rộng payload GET/PUT để admin có thể đọc/cập nhật chính sách theo khung giờ (bao gồm pre-open/post-close 30 phút) với fallback an toàn khi dữ liệu cache không hợp lệ.
- Bổ sung test backend cho luồng cập nhật hợp lệ và reject cấu hình không hợp lệ của `prefetch_time_policy`.
- Tích hợp resolver `prefetch_time_policy` vào `prefetch_ticker_price_board`: tự xác định profile theo khung giờ (`pre_open`, `market_open`, `lunch_break`, `pre_close`, `post_close`, `offhours`).
- Bổ sung `effective settings` theo profile thời gian cho prefetch runtime (`batch_size`, `symbol_limit`, `max_retries`) và trạng thái `throttled_by_policy` khi policy tắt query.
- Mở rộng metadata prefetch trả về trường `policy` (profile/reason/query_enabled/effective_interval_seconds) để phục vụ observability và debug vận hành.
- Bổ sung unit tests cho resolver profile thời gian và hiệu lực cấu hình theo profile trong `test_ticker_prefetch_task`.
- Cập nhật adapter `fetch_price_board_dataframe` hỗ trợ chọn provider theo thứ tự ưu tiên và tự động fallback sang provider tiếp theo khi gặp `429/rate-limited` (benchmark tham chiếu: KBS ổn định cao hơn VCI ở cùng tải).
- Bổ sung `429 cooldown multiplier` theo `prefetch_time_policy.rate_limit_guard` vào retry countdown của prefetch task, có clamp theo `max_interval_seconds`.
- Bổ sung lightweight counters (cache-backed) cho prefetch: `profile_hits_total`, `skip_total`, `429_multiplier_total`, đồng thời đính kèm vào payload meta để theo dõi nhanh.
- Bổ sung test adapter cho luồng fallback provider khi source đầu tiên bị rate-limit và test helper cho multiplier/metric counter.
- Mở rộng frontend `AdminOps` thêm section `Prefetch Time-based Query Policy`: load/save `prefetch_time_policy`, chia nhóm market window, profile theo khung giờ và rate-limit guard.
- Bổ sung API client helper cho `prefetch_time_policy` (`getAdminPrefetchTimePolicy`, `updateAdminPrefetchTimePolicy`).
- Bổ sung i18n EN/VI cho toàn bộ nhãn/validation/message của time-policy form và active policy preview.
- Nâng cấp UX `prefetch_time_policy` form trên AdminOps: validate chi tiết theo rulebook (time format, open<close, lunch window, jitter/multiplier/max interval, interval bounds theo profile).
- Bổ sung tổng hợp lỗi theo trường và cơ chế map `field_errors` từ backend về UI để debug cấu hình nhanh hơn.
- Thêm nút reset form về giá trị đã tải gần nhất để thao tác cấu hình runtime an toàn hơn.
- Chốt PR-6 docs/evidence: cập nhật execution board, task tracker, release gates và thêm báo cáo bằng chứng `docs/PREFETCH_TIME_POLICY_PR6_EVIDENCE_20260412.md` (ghi nhận pass test focused + blocker cục bộ với DB-dependent admin API tests).
- Gỡ blocker test DB local cho nhóm admin API bằng cách chuẩn hóa lệnh evidence test với `DB_ENGINE=sqlite` và Redis timeout ngắn (không phụ thuộc Postgres provisioning tại local).
- Bổ sung script `backend/run_prefetch_policy_pr6_tests.ps1` để chạy deterministic backend evidence suite cho prefetch time policy.
- Bổ sung script vận hành `scripts/ops/prefetch_policy_capture_baseline.ps1` và playbook `docs/PREFETCH_TIME_POLICY_BASELINE_CAPTURE_PLAYBOOK_20260412.md` để chụp baseline Gate B2 (429/cooldown/freshness/p95 latency) trước canary.
- Đã smoke-run script baseline capture thành công (public health mode, không auth) và lưu artifact mẫu tại `docs/ops-evidence/prefetch-policy-baseline/20260412-074032/`; cần chạy lại có auth để hoàn tất đủ KPI Gate B2.
- Bổ sung script `scripts/ops/prefetch_policy_gate_b2_check.ps1` để tự động validate checklist Gate B2 từ `baseline-summary.json` và sinh report `gate-b2-check.md`.
- Cập nhật `scripts/ops/prefetch_policy_capture_baseline.ps1` theo hướng non-interactive (`-UseBasicParsing`) và thêm tham số `RequestTimeoutSec` để tránh treo khi endpoint chậm.
- Đã chạy baseline có auth thành công trên runtime `127.0.0.1:8010` và checker Gate B2 PASS với artifact `docs/ops-evidence/prefetch-policy-baseline/20260412-080254/gate-b2-check.md`.
- Bổ sung tài liệu guardrail `docs/PREFETCH_TIME_POLICY_GUARDRAIL_THRESHOLDS_20260412.md` và tick B3.1 trong release gates (B3.2 alert routing còn pending).

---

## Ghi chú thay đổi ngày 11/04/2026

- Cập nhật logic window cho whale aggregate để `session` bắt đầu từ giờ mở cửa thị trường đến thời điểm hiện tại, còn `5d` neo từ market-open của 4 ngày trước.
- Chuẩn hóa bộ lọc thời gian cho cả stream event và intraday tick theo điều kiện `start <= ts <= now`, tránh việc các window ngắn trả kết quả gần như giống nhau.
- Bổ sung graceful fallback cho aggregate endpoint: nếu DB page rỗng và provider vnstock lỗi, endpoint không còn trả `502` ngoài ý muốn mà degrade về aggregate response an toàn.
- Đồng bộ logic trên cả refactored service path và helper/view path cũ để tránh lệch hành vi giữa hai luồng.
- Ổn định regression test `test_refactored_whale_feed_aggregate_applies_window_filter` bằng local date/time thay cho mốc `10:15:00` hardcode, đồng thời pin env market-open trong test.

---

## Ghi chú thay đổi ngày 04/04/2026

- Thay thư viện `vnstock3>=0.3.0.9` bằng fork tùy chỉnh `vnstock @ git+https://github.com/vietdung-edusuccess/vnstock.git@main` trong `backend/requirements.txt`.
- Phiên bản runtime hiện tại được cài từ branch `main` của fork `vietdung-edusuccess/vnstock`.
- Lý do: sử dụng bản fork riêng có các thay đổi chưa merge vào upstream.
- Cập nhật theo hướng thư viện nâng cấp throughput: bỏ monkey-patch bypass rate-limit trong `config/settings.py` và dùng đúng runtime từ thư viện.
- Bổ sung dependency `asyncio-throttle>=1.0.2` trong `backend/requirements.txt` (yêu cầu mới từ bản vnstock nâng cấp).
- Bổ sung endpoint `GET /api/health/prefetch/` để theo dõi trạng thái ticker prefetch, metadata lần chạy gần nhất và sample cache hits.
- Mở rộng phạm vi symbol cho task `prefetch_ticker_price_board`: gom từ `TrackedSymbol`, `WatchlistItem`, `PriceAlertRule`, `Transaction`; hỗ trợ batch size và symbol limit qua biến môi trường.
- Bổ sung script `backend/start_stack.ps1` để khởi động nhanh backend + Celery worker + Celery beat trên Windows.
- Mở rộng `GET /api/admin-ops/stats/` với payload `ticker_prefetch` để admin theo dõi fast path cache-first ngay trong dashboard thống kê.
- Bổ sung endpoint `POST /api/admin-ops/prefetch/warm/` để staff trigger warm cache thủ công từ giao diện Admin Ops.
- Bổ sung retry/backoff riêng cho `prefetch_ticker_price_board` khi upstream trả `429 Too Many Requests`, đồng thời phản ánh trạng thái `retrying` trong metadata health.

---

## Ghi chú thay đổi ngày 03/04/2026

- Bổ sung model `Tài khoản gửi mail` trong Django admin để quản trị viên cấu hình SMTP trực tiếp trên hệ thống.
- Hỗ trợ chọn một cấu hình mail mặc định, lưu mật khẩu SMTP ở dạng ký/mã hóa theo `SECRET_KEY`, và gửi mail kiểm tra ngay từ trang quản trị.
- Thêm helper backend để các luồng gửi email sau này có thể dùng cấu hình mail đang active trong database thay vì phụ thuộc cứng vào `settings.EMAIL_*`.
- Đã chuyển auth flow từ `auto-login sau đăng ký` sang `verify email trước khi đăng nhập`, bao gồm endpoint `verify-email`, `resend-verification` và chặn JWT login cho tài khoản chưa xác thực.

---

## Ghi chú thay đổi ngày 31/03/2026

- Đã thực hiện các thao tác kiểm tra, migrate lại database để tạo bảng SubAccount.
- File db.sqlite3 không tồn tại hoặc đã bị xóa trước đó.
- Đã chạy migrate, hệ thống báo không có migration nào cần áp dụng.
- Nếu vẫn không thấy bảng SubAccount, cần kiểm tra lại migration hoặc tạo migration mới.

---
Nếu cần tạo migration mới:

```powershell
cd backend
.venv\Scripts\python.exe manage.py makemigrations
.venv\Scripts\python.exe manage.py migrate
```
