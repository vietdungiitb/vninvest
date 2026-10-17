# Verify staging sau R3 — VPS `docker.edusuccess.vn` (2026-10-17)

Claim `ai-stg`. Nhánh `chore/ai-staging-verify` ← `dev`. Không sửa runtime.

## Vì sao phiên này tồn tại

R3.1 / R3.2 / R3.3 đều kết thúc bằng các dòng **"CHƯA CHẠY"** cùng một ý:
*"chưa biết migration `0020` có chạy được trên staging thật hay không"*, *"chưa mở
trang Traces/SLO trên staging"*. Mọi thứ mới chỉ được kiểm bằng test + build.
AGENTS.md chốt VPS là **môi trường thử nghiệm mặc định** ⇒ nợ này đã đủ căn cứ để đóng.

## Quy trình deploy

`bash scripts/deploy-staging.sh --verify` (trước) → `bash scripts/deploy-staging.sh` (thật).

Chạy bằng `nohup … > /tmp/deploy-staging.log &` rồi poll log, **không** pipe output vào
`Select-Object -First`.

### Trạng thái **trước** deploy (`--verify`, exit 0)

13 container, tất cả `running`; `core-api`/`core-db`/`core-redis`/`pgbouncer` healthy;
`GET /api/health/` 2xx qua nginx; không container chết; worker 0 restart.

### Kết quả deploy

| Bước | Kết quả |
|---|---|
| Pull `dev` | HEAD lên `dev`, có `advisory/migrations/0020_aitrace.py` trong diff pull |
| Build image | xong (log `API healthy`) |
| Migrate | xong — xem bên dưới |
| Restart | xong; `--verify` sau deploy: `config hợp lệ` · `API healthy` · `GET /api/health/ = 2xx` · không container chết · 4 worker **0 restart** |

## Đo thật trên DB staging (`vninvest_core`)

| Câu hỏi còn mở | Kết quả đo |
|---|---|
| Migration `0020_aitrace` có chạy được trên staging thật? | **CÓ** — `django_migrations` đứng đầu advisory: `0020_aitrace` (trên `0019_aideployment_auto_evicted`) |
| Bảng có đúng cấu trúc? | **18 cột** — khớp số field của model |
| AC5 (index) có thật trong DB? | **CÓ** — `advisory_ai_user_id_e7df41_idx … USING btree (user_id, session_date)` và `advisory_ai_trace_i_852d96_idx … USING btree (trace_id)`; thêm UNIQUE `uniq_aitrace_traceid_step (trace_id, step)` |
| Beat retention của R3.1 đã đăng ký? | **CÓ** — `purge-ai-traces` trong `settings.CELERY_BEAT_SCHEDULE`; `core-beat` trả lời `celery@…: OK` |

## Đo thật trên HTTP (qua nginx của staging)

| Endpoint | HTTP | Kết luận |
|---|---|---|
| `/api/core/v1/workspace/ai-command-center/traces/` | **401** | Route **đã sống**, chặn đúng — cần auth |
| `/api/core/v1/ai/usage/slo/` | **401** | Route **đã sống**, chặn đúng — cần auth |
| `/api/core/v1/ai/usage/aggregate/` (route cũ, đối chiếu) | 401 | Hành vi **giống hệt** route mới ⇒ 401 là do auth, không phải do route hỏng |

## Đo thật artifact FE trong container (không tin log build)

```
AICommandTracesPage-xMXWUjNt.js     ← chứa "aiCommandCenter.emptyTraces"
AISloDashboardPage-C_mYqUMC.js       ← chứa "aiCommandCenter.sloEmpty"
index-B102loMI.js, AiHubNav-CQzJByp2.js  ← chứa "settings/ai/traces" và "settings/ai/slo"
```

⇒ Cả 2 route và cả 2 tab đã **có thật** trong `dist` đang serve, không chỉ "build xanh".

## Đóng được / vẫn mở

**Đóng bằng lần này**
- Migration `0020_aitrace` trên staging — **có thật** (M3/R3.1 ghi "chưa biết").
- 2 endpoint R3.2 + R3.3 **sống** trên staging, chặn auth đúng.
- 2 trang FE **có mặt** trong `dist` đang serve.
- Beat retention `purge-ai-traces` đăng ký; `core-beat` khoẻ.
- Stack sau deploy: 0 container chết, worker 0 restart, health 2xx.

**Vẫn mở (không đóng được bằng phiên này)**
- **Probe provider thật**: staging **không có** key dùng được ⇒ `AIUsageRecord` rỗng,
  `advisory_aitrace` có **0 dòng** ⇒ hai trang mới sẽ hiện empty state. Đúng như đã ghi,
  nhưng **chưa ai nhìn thấy** nhánh "có dữ liệu". Nợ này phụ thuộc Owner (D-03c / key).
- **E2E Playwright** trên staging chưa chạy.
- **Hiệu năng percentile** trên tập dữ liệu thực (test dùng 1000 dòng); backlog R3.3b.
- Full BE ngoài advisory+AI · `ruff`.

## Bẫy gặp trong phiên này (đã gây sự cố thật)

1. **Không pipe output gate vào `Select-Object -First`.** Self-test
   `tools/opencode-global/verify-shim.mjs` **cố ý rename** file canonical
   (`agent-preflight.mjs` → `.agent-preflight.hidden.mjs`) rồi khôi phục trong `finally`.
   Bị kill giữa chừng ⇒ file nằm lại dạng ẩn ⇒ **6 gate FAIL cùng lúc**
   (`secret-scan` ENOENT, `preflight-selftest` 0/26, `hook-mode`, `shim-delegate`,
   `preflight-trailer`, `global-config-drift`). Đây là FAIL **không liên quan** tới code
   đang viết — dễ kết luận nhầm là lỗi mình.
2. Khôi phục file bằng PowerShell `Out-File -Encoding utf8` tạo **BOM** và làm lệch
   **426 dòng** dù nội dung giống hệt. Phải khôi phục byte-exact bằng
   `git show HEAD:<path>` + `writeFileSync` (`git checkout --` bị cấm — L-A01).
3. `global-config-drift` FAIL vì bản deployed `~/.opencode/scripts/agent-preflight.mjs`
   bị **CRLF** (426 byte = 426 CR, 427 dòng nội dung khớp). Sửa đúng file đó, không
   đụng config global khác.
4. Tên DB staging **không** phải `POSTGRES_DB` trong env — phải dò `psql -l` mới thấy
   `vninvest_core`.