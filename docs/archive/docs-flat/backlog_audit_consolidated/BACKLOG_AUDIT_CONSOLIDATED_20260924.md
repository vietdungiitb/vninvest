# BACKLOG — Phân rã từ Audit Hợp nhất 2026-09-24 (Bước B2)

> Nguồn: `docs/COMPREHENSIVE_AUDIT_CONSOLIDATED_20260924.md` (Phần II C1–C9, Phần III §10–§15).
> Quy ước mỗi item: **BL-ID · Nguồn · Yêu cầu cần đạt · DoD (nghiệm thu đo được) · Phản biện (reviewer hỏi gì) · Minh chứng (artifact bắt buộc) · Ước lượng · Vai trò · Phụ thuộc**.
> Đội code thực hiện đúng DoD + nộp đủ Minh chứng = pass, không cần hỏi lại.

---

## P0 — 30 ngày (an toàn + sống còn)

### BL-01 — SAML signature verification bắt buộc (SEC-A, High)
- **Yêu cầu**: cài `python3-saml` + `xmlsec1` vào image BE; `SAML_SIGNATURE_VERIFICATION_MODE=strict` là mặc định ở production; mode permissive chỉ cho phép khi `DEBUG=true` và log warning.
- **DoD**: (1) `SAMLResponse` giả mạo chữ ký bị từ chối 100% (test vector thật/giả); (2) toàn bộ `test_saml_sso.py` pass; (3) build image prod thành công có xmlsec1 native.
- **Phản biện**: test có dùng response ký thật không (không phải self-assert)? strict có bypass được qua env ở prod không? cert hết hạn thì hành vi gì?
- **Minh chứng**: `docs/evidence/audit-bl/BL-01/gates.md` (lệnh + output), diff `requirements.txt`/`Dockerfile`/`saml_service.py`, log từ chối chữ ký giả, BE test output.
- **Ước lượng**: 1–2 tuần · **Vai trò**: Senior Backend + DevOps · **Phụ thuộc**: không.

### BL-02 — Password strength + session/cookie flags fail-closed (SEC-B/C, Medium)
- **Yêu cầu**: thêm `AUTH_PASSWORD_VALIDATORS` (tối thiểu length 10 + common-password + numeric, theo chuẩn Django) vào `settings.py`; thêm `SESSION_COOKIE_AGE` (mặc định 8h), `SESSION_COOKIE_SECURE`, `CSRF_COOKIE_SECURE`, `SECURE_SSL_REDIRECT`, `SECURE_HSTS_SECONDS` — tất cả fail-closed ở prod theo mẫu `ALLOWED_HOSTS` (`settings.py:27-32`): thiếu env → `ImproperlyConfigured`, không fallback im lặng.
- **DoD**: (1) prod thiếu env → boot fail với message rõ; (2) password `12345678` bị từ chối qua API đổi mật khẩu; (3) Set-Cookie prod có `Secure; HttpOnly; SameSite`; (4) `manage.py check` 0.
- **Phản biện**: DEV có còn boot không-env được không? user cũ password yếu có bị lockout bất ngờ không (migration path)? HSTS có preload không, subdomain nào bị ảnh hưởng?
- **Minh chứng**: diff `settings.py`, output boot-fail prod-mode, test đổi mật khẩu yếu/thành công, header Set-Cookie thu được, `docs/evidence/audit-bl/BL-02/gates.md`.
- **Ước lượng**: 2–3 ngày · **Vai trò**: Senior Backend · **Phụ thuộc**: không (BL-11 consume biến mới từ item này — plan DAG `BL-02 → BL-11`).

### BL-03 — Proxy hardening: TLS verify + scope headers (SEC-D, Medium)
- **Yêu cầu** trong `legacy_proxy.py`: (1) `verify=True` với CA nội bộ qua env `LEGACY_BACKEND_CA_BUNDLE` (fallback certifi); (2) chỉ forward whitelist headers (`authorization`, `content-type`, `accept`, `x-request-id`, … — liệt kê explicit, bỏ forward-all `HTTP_*`); (3) không reflect response headers trừ `content-type` + `x-request-id`; (4) giữ `follow_redirects=False`.
- **DoD**: (1) MITM với cert tự ký → proxy 502 + log, không forward; (2) header lạ (vd `X-Admin-Token`) không tới legacy (test capture ở legacy-stub); (3) không regression các route native (`/core/v1/*` untouched).
- **Phản biện**: whitelist có thiếu header nào client thật đang dùng không (đo traffic 7 ngày trước khi lock)? legacy-stub test có cover đủ method GET/POST/PUT/PATCH/DELETE?
- **Minh chứng**: diff `legacy_proxy.py`, test MITM + header-capture output, `docs/evidence/audit-bl/BL-03/gates.md`.
- **Ước lượng**: 2–3 ngày · **Vai trò**: Senior Backend · **Phụ thuộc**: không (traffic 7 ngày chạy song song; plan DAG `BL-03 → BL-14` chỉ chốt whitelist trước khi deprecate).

### BL-04 — Backup schedule + restore test + RTO/RPO (R-04/C7, High)
- **Yêu cầu**: cron/job backup PG tự động hàng ngày (`pg_dump` custom format + WAL nếu bật PITR), giữ 30 bản, checksum + alert khi fail; **restore test hàng tháng** lên DB trống; công bố RTO/RPO đo được (không phải mục tiêu suông).
- **DoD**: (1) 3 backup liên tiếp đúng lịch, checksum OK; (2) restore drill thành công, app boot + login + đọc portfolio trên DB restore; (3) RTO/RPO ghi nhận bằng số (phút); (4) alert giả lập backup-fail tới đúng kênh.
- **Phản biện**: backup có mã hóa at-rest không? secret backup lưu ở đâu? restore có overwrite nhầm prod không (guard)? RTO đo từ lúc nào tới lúc nào?
- **Minh chứng**: job spec + log 3 kỳ, checksum, biên bản restore drill (lệnh từng bước + output), RTO/RPO, `docs/evidence/audit-bl/BL-04/gates.md`.
- **Ước lượng**: 1–2 tuần · **Vai trò**: DevOps + Senior Backend · **Phụ thuộc**: không.

### BL-05 — Nối PgBouncer prod đang chết (C5/R-05, Medium)
- **Yêu cầu**: `CORE_DATABASE_URL` của `core-api`/`core-worker` trong `docker-compose.prod.yml` trỏ qua `pgbouncer:6432` (transaction mode giữ nguyên `:457`); `CONN_MAX_AGE=0` khi đi qua pooler (tránh double-pooling); healthcheck + runbook bypass (trỏ thẳng DB khi pooler sự cố).
- **DoD**: (1) API login + 1 backfill + 1 worker job chạy qua pooler (log `pgbouncer` show pools có client); (2) soak 24h không lỗi pool; (3) drill bypass < 10 phút.
- **Phản biện**: transaction mode có phá prepared-statement/Django feature nào không (test suite full pass qua pooler)? pool size 20 có đủ cho worker prefork không (đo `sv_active`)?
- **Minh chứng**: diff compose, `SHOW POOLS` output, soak log, biên bản drill bypass, `docs/evidence/audit-bl/BL-05/gates.md`.
- **Ước lượng**: 0.5–1 ngày + 24h soak · **Vai trò**: DevOps · **Phụ thuộc**: không (plan DAG `BL-05 → BL-13`; BL-13 mới phụ thuộc pooler).

### BL-06 — Sửa stale test import + grep-gate (C4/R-06, Medium)
- **Yêu cầu**: sửa `packages/core/backend/tests/test_workstation_endpoints.py:34` sang `from market_serving.native_views import RealtimeWhaleFeedAggregateView` (xác nhận class tồn tại ở native); thêm CI grep-gate: fail khi còn `from .*legacy_views import` trong `packages/core/backend/{src,tests}`.
- **DoD**: (1) file test collect được (không ImportError); (2) gate mới đỏ khi cố tình chèn lại import cũ (negative test); (3) `manage.py check` 0.
- **Phản biện**: class native có đúng contract cũ không (so signature test)? còn file nào khác import module đã xoá không (grep toàn repo incl `frontend/`)?
- **Minh chứng**: diff + output collect/test, log gate negative-test, `docs/evidence/audit-bl/BL-06/gates.md`.
- **Ước lượng**: 0.5 ngày · **Vai trò**: Senior Backend + QA · **Phụ thuộc**: không.

### BL-07 — Xóa `whale_engine.py` broken (C8, Low)
- **Yêu cầu**: xóa `packages/core/backend/src/signal_intelligence/services/whale_engine.py` (unimportable — dòng 1 text trần, `ast.parse` SyntaxError, 0 importer trong `src/`); grep xác nhận 0 import còn lại (chỉ docs nhắc lịch sử được phép).
- **DoD**: grep `whale_engine` trong `src/` = 0 hit; BE tests liên quan pass; `manage.py check` 0.
- **Phản biện**: có migration/task nào import động bằng string không (`importlib`, `settings.INSTALLED`)? docs nào cần cập nhật link?
- **Minh chứng**: output grep trước/sau, test output, `docs/evidence/audit-bl/BL-07/gates.md`.
- **Ước lượng**: 0.5 ngày · **Vai trò**: Backend · **Phụ thuộc**: không.

### BL-08 — Xóa gán trùng `LEGACY_BACKEND_URL` (Anti-pattern §4, Low)
- **Yêu cầu**: gộp 2 lần gán ở `settings.py:130` và `:143` thành 1 (giữ bản strip-slash), thêm comment nguồn env duy nhất.
- **DoD**: `manage.py check` 0 + grep `LEGACY_BACKEND_URL\s*=` trong `settings.py` = 1 hit + boot dev/prod ok.
- **Phản biện**: có code nào đọc giá trị trước dòng 143 và phụ thuộc bản chưa strip không?
- **Minh chứng**: diff + grep count + boot log, `docs/evidence/audit-bl/BL-08/gates.md`.
- **Ước lượng**: 0.5 ngày · **Vai trò**: Backend · **Phụ thuộc**: không.

### BL-09 — Dependency supply-chain scan + ghim digest (R-10/SEC-H, Medium)
- **Yêu cầu**: chạy `npm audit` (web, mobile) + `pip-audit`/`safety` (backend) lần đầu, fix hoặc ghi risk-accept cho Critical/High; ghim digest cho ảnh `prometheus`/`grafana` (`docker-compose.yml:191,211` đang `latest`); tài liệu hoá cadence scan hàng tháng.
- **DoD**: (1) report scan lần đầu lưu evidence, 0 Critical chưa disposition; (2) compose không còn tag `latest` cho service prod; (3) lịch scan + owner ghi trong doc vận hành.
- **Phản biện**: fix có break build không (tsc/build/BE tests lại)? digest ghim có script bump không (tránh kẹt bản cũ)?
- **Minh chứng**: report scan, diff compose, doc cadence, `docs/evidence/audit-bl/BL-09/gates.md`.
- **Ước lượng**: 2–3 ngày · **Vai trò**: DevOps + FE/BE · **Phụ thuộc**: không.

### BL-10 — Verify CDN headers + topology prod (SEC-F/R-08, Unknown→Fact)
- **Yêu cầu**: xác minh bằng lệnh thật (không đọc code): CSP/HSTS/X-Frame tại edge công cộng; xác nhận prod chạy managed DB/Redis hay chính compose (quyết định SPOF Unknown→có/không); ghi kết quả thành quyết định (nếu CDN đã có → đóng SEC-F; nếu chưa → tạo BL-10b thêm headers ở nginx).
- **DoD**: output `curl -sI` các header từng domain prod + biên bản topology (tên dịch vụ managed hoặc xác nhận self-hosted) + quyết định đóng/mở follow-up.
- **Phản biện**: curl từ ngoài mạng nào (có đi qua đúng edge prod không)? có mấy ingress (beta/prod/api)?
- **Minh chứng**: log curl + biên bản, `docs/evidence/audit-bl/BL-10/gates.md`.
- **Ước lượng**: 1–2 ngày · **Vai trò**: DevOps + Security · **Phụ thuộc**: không (blocker cho BL-20 nếu headers thiếu).

### BL-11 — Env preflight check trong CI (fail-closed mở rộng, Low)
- **Yêu cầu**: script CI boot settings ở prod-mode với env thiếu từng biến bắt buộc (ALLOWED_HOSTS, SECRET_KEY, PAT_PEPPER, CORS, CSRF + biến mới từ BL-02) và assert fail với message rõ; pass khi đủ env mẫu.
- **DoD**: matrix 6+ case thiếu-biến đều đỏ đúng message; đủ env xanh; chạy trong `core-api.yml`.
- **Phản biện**: preflight có leak giá trị secret vào log không (mask)? có phân biệt DEBUG=true/false không?
- **Minh chứng**: workflow diff + log matrix, `docs/evidence/audit-bl/BL-11/gates.md`.
- **Ước lượng**: 1 ngày · **Vai trò**: DevOps · **Phụ thuộc**: BL-02 (biến mới).

---

## P1 — 90 ngày (reliability)

### BL-12 — Playwright E2E vào CI (Testing, Medium)
- **Yêu cầu**: job mới trong `web-ci.yml`: chạy tối thiểu 5 critical flows (login → dashboard → watchlist CRUD → screener run → alert ack) trên Chromium, dùng `playwright.config.ts` sẵn có; artifact trace/video khi fail.
- **DoD**: xanh 3 lần liên tiếp; fail cố ý (break 1 selector) → đỏ đúng test; thời gian job < 15 phút.
- **Phản biện**: data seed có ổn định không (flaky)? có chống xung đột với dev DB không (DB/ephemeral riêng)? visual baseline ai duyệt?
- **Minh chứng**: workflow diff + 3 log xanh + 1 log đỏ cố ý, `docs/evidence/audit-bl/BL-12/gates.md`.
- **Ước lượng**: 1 tuần · **Vai trò**: QA + Frontend · **Phụ thuộc**: không.

### BL-13 — k6 smoke + DB saturation test (Performance, Medium)
- **Yêu cầu**: kịch bản k6 cho 3 endpoint nóng (health, portfolio, whale-feed) với VU/target đo p95/p99; saturation test pool (qua PgBouncer sau BL-05) ghi `sv_active`/wait; ngưỡng pass/fail ghi trước khi chạy.
- **DoD**: report p95/p99 + ngưỡng verdict; bottleneck (nếu có) có ticket follow-up với số liệu; không regression sau fix.
- **Phản biện**: target VU từ đâu ra (đo prod hiện tại hay đoán)? môi trường test có tương đương prod không (CPU/mem)? có ảnh hưởng dữ liệu thật không?
- **Minh chứng**: script k6 + report + verdict, `docs/evidence/audit-bl/BL-13/gates.md`.
- **Ước lượng**: 1 tuần · **Vai trò**: Performance + DevOps · **Phụ thuộc**: BL-05 (pooler).

### BL-14 — Sunset compat + legacy_views sót + deprecate proxy (C3, Medium)
- **Yêu cầu**: (1) đo traffic proxy 7 ngày (log count theo path prefix); (2) xóa `market_data/legacy_views.py` + `user_workspace/legacy_views.py` nếu 0 importer + 0 hit traffic; (3) gắn deprecation notice cho proxy + deadline gỡ (1 sprint sau); (4) không gỡ proxy trong item này nếu còn traffic thật.
- **DoD**: số liệu traffic 7 ngày; 0 importer sau xóa; BE tests + `manage.py check` xanh; notice deprecation có ngày gỡ cụ thể.
- **Phản biện**: 0 hit = không có ai gọi thật hay log chưa đủ 7 ngày? sau khi xóa, có test nào đỏ không? proxy còn traffic thì bước (3) đã làm chưa?
- **Minh chứng**: báo cáo traffic 7 ngày, output grep importer trước/sau, BE test output, `docs/evidence/audit-bl/BL-14/gates.md`.
- **Ước lượng**: 1–2 tuần (đo trước) + 0.5 ngày xóa · **Vai trò**: Senior Backend · **Phụ thuộc**: BL-03 (traffic/whitelist dùng chung).

### BL-15 — JSON logging cho backend (P1, Medium)
- **Yêu cầu**: cấu hình log JSON (structlog hoặc stdlib JSON formatter) cho `core-api`/`core-worker` ở prod; field tối thiểu `ts`, `level`, `logger`, `msg`, `request_id`/`task_id`; DEV giữ format human-readable.
- **DoD**: (1) 1 request + 1 Celery task sinh log JSON parse được (jq/`python -m json.tool`); (2) có `request_id` tương thích middleware hiện có; (3) không leak secret vào log (grep `PASSWORD|SECRET|TOKEN|KEY` trên sample).
- **Phản biện**: format có break log pipeline/ALM đang dùng không? performance khi log high-volume (tick/queue)? mask PII đủ không?
- **Minh chứng**: diff settings/logging, sample log 2 luồng (HTTP + task), `docs/evidence/audit-bl/BL-15/gates.md`.
- **Ước lượng**: 2–3 ngày · **Vai trò**: Senior Backend · **Phụ thuộc**: không (song song BL-12).

### BL-16 — Coverage gate dần (P1, Medium)
- **Yêu cầu**: bật `coverage`/`pytest-cov` (hoặc Jest/vitest coverage đã có) với baseline = mức hiện tại đo được; CI fail khi tụt >1% so với baseline; tăng baseline mỗi quý khi E2E (BL-12) ổn định. Cấm mass `--cov-fail-under=0` giả.
- **DoD**: (1) baseline % ghi trong file (không hardcode miệng); (2) fail cố ý (xóa 1 test → CI đỏ coverage); (3) 3 lần xanh liên tiếp.
- **Phản biện**: baseline lấy từ run nào (env nào, seed nào)? test flaky có làm gate red herring không? component vs unit tách report không?
- **Minh chứng**: file baseline + workflow diff + log pass/fail cố ý, `docs/evidence/audit-bl/BL-16/gates.md`.
- **Ước lượng**: 2–3 ngày · **Vai trò**: QA Lead + Frontend · **Phụ thuộc**: BL-12 (E2E xanh trước).

### BL-17 — MFA/secret rotation verify + runbook (SEC-H, P1)
- **Yêu cầu**: (1) verify MFA/TOTP hoặc document quyết định "không bật MFA" + lý do + owner; (2) rotation cadence cho `SECRET_KEY`/PAT pepper/Stripe secrets ghi thành runbook (env nào, downtime không, test smoke sau rotate); (3) audit 1 lần các secret đang hardcode/env hiện tại.
- **DoD**: (1) runbook 1 trang có checklist rotate + smoke test; (2) dry-run rotate secret non-prob (dev) thành công; (3) 0 secret trong git history mới (scan).
- **Phản biện**: rotate `SECRET_KEY` có invalidate session hàng loạt không (giải pháp)? ai là on-call khi rotate fail? MFA off có compensating control gì?
- **Minh chứng**: runbook, log dry-run rotate, output secret-scan, `docs/evidence/audit-bl/BL-17/gates.md`.
- **Ước lượng**: 2–4 ngày · **Vai trò**: Security + DevOps · **Phụ thuộc**: BL-04 (backup trước khi rotate prod).

### BL-17b — DR restore drill định kỳ (sau BL-04, P1)
- **Yêu cầu**: auto-schedule restore drill hàng tháng (hoặc quarterly nếu cost cao) dựa trên backup từ BL-04; ghi RTO/RPO mỗi kỳ vào evidence; alert khi drill fail.
- **DoD**: 1 drill tự động/ bán tự động chạy được; RTO/RPO cập nhật; link từ BL-04 gates.
- **Phản biện**: drill có ảnh hưởng data thật không (isolation)? frequency đủ so với RPO đã công bố?
- **Minh chứng**: job/cron + log drill, `docs/evidence/audit-bl/BL-17b/gates.md`.
- **Ước lượng**: 1 ngày setup + recurring · **Vai trò**: DevOps · **Phụ thuộc**: BL-04.

---

## P2 — 6 tháng (maintainability)

### BL-18 — ESLint/TS warnings −15%/sprint (P2)
- **Yêu cầu**: đo baseline `npm run lint -- --max-warnings=0` (hoặc count warnings hiện tại); mỗi sprint giảm ≥15% warnings tuyệt đối (không mass `eslint-disable`); báo cáo count vào PR/CI artifact.
- **DoD**: baseline + 2 sprint count giảm ≥15%; grep `eslint-disable` không tăng; 0 error (vẫn giữ `max-warnings` policy hiện repo).
- **Phản biện**: warning count có giảm bằng cách disable tinh vi không (review diff)? file nào too-big cần split riêng (không nhét chung)?
- **Minh chứng**: script count + 2 báo cáo sprint, `docs/evidence/audit-bl/BL-18/gates.md`.
- **Ước lượng**: 0.5d/sprint · **Vai trò**: Frontend · **Phụ thuộc**: không.

### BL-19 — Distributed tracing nếu JSON log chưa đủ (P2, conditional)
- **Yêu cầu**: chỉ làm khi BL-15 +现有 metrics không tìm được bottleneck qua 2 incident thật; chọn OpenTelemetry hoặc vendor hiện có; instrument 3 path nóng (API request, Celery task, WS).
- **DoD**: 1 trace end-to-end thấy được span API→DB/queue; overhead <5% p95 đo trước/sau; quyết định keep/kill ghi trong gates.
- **Phản biện**: có cheaper alternative (log correlation ID) chưa thử? agent/collector ops cost? cardinality explosion?
- **Minh chứng**: sample trace + benchmark overhead, `docs/evidence/audit-bl/BL-19/gates.md`.
- **Ước lượng**: 1–2 tuần (conditional) · **Vai trò**: Performance + Backend · **Phụ thuộc**: BL-15.

### BL-20 — Editorial audit + CDN/nginx headers follow-up (P2)
- **Yêu cầu**: nếu BL-10 xác nhận CDN thiếu headers → thêm CSP/HSTS/X-Frame tại nginx/edge theo inventory SEC-F; dọn editorial leftovers (scorecard duplicate, stale docs links) thành 1 pass.
- **DoD**: `curl -sI` thấy HSTS/CSP/X-Frame-Options đúng policy; 0 broken link internal trong docs chính; scorecard 1 nguồn.
- **Phản biện**: CSP có break inline script/widget (`vninvestcharts-widget`, analytics) không (report-only trước)? HSTS preload có lockout HTTP admin không?
- **Minh chứng**: curl before/after + linkcheck, `docs/evidence/audit-bl/BL-20/gates.md`.
- **Ước lượng**: 2–3 ngày · **Vai trò**: DevOps + Security · **Phụ thuộc**: BL-10.

---

## P3 — Có điều kiện (chỉ khi BL-13 có số)

### BL-21 — Read-replica / PG separation (P3, conditional)
- **Yêu cầu**: chỉ mở khi BL-13 (hoặc production metrics) chứng minh primary bị đọc ghi tranh chấp vượt ngưỡng (ghi ngưỡng trước trong gates BL-13).
- **DoD**: ngưỡng + số liệu vượt kèm ticket; design RTO replication lag; risk đọc-late được accept bởi product.
- **Phản biện**: read-your-writes có ảnh hưởng portfolio/orders không? failover ai test?
- **Minh chứng**: `docs/evidence/audit-bl/BL-21/gates.md`.
- **Ước lượng**: 1–2 tuần (conditional) · **Vai trò**: Backend + DevOps · **Phụ thuộc**: BL-13 + BL-04 (backup đã ổn).

### BL-22 — Tách 1 service ở bottleneck đo được (P3, conditional)
- **Yêu cầu**: chỉ tách service khi profiling/BL-13 chỉ đúng 1 module chiếm >X% resources (ghi X trước); chọn module có ranh giới API sạch nhất (ví dụ ingestion vs API).
- **DoD**: ADR + metric trước/sau; latency/CPU cải thiện đo được; không tăng operational surface vô lý.
- **Phản biện**: monolith modular có fix được không (đo trước khi tách)? distributed transaction risk?
- **Minh chứng**: ADR + benchmark, `docs/evidence/audit-bl/BL-22/gates.md`.
- **Ước lượng**: 2–4 tuần (conditional) · **Vai trò**: Architect + Backend · **Phụ thuộc**: BL-13, deny-list §7.

### BL-23 — K8s/HPA chỉ khi multi-node thật (P3, conditional)
- **Yêu cầu**: chỉ khi business cần multi-node/autoscale đã chứng minh (traffic, SLO, cost model); nếu chưa → giữ compose/swarm hiện tại.
- **DoD**: quyết định go/no-go có số; nếu go → migration plan + rollback; nếu no-go → ghi deny-list justification.
- **Phản biện**: compose scale có đủ không? team có K8s on-call skill? cost/complexity so với benefit?
- **Minh chứng**: decision memo, `docs/evidence/audit-bl/BL-23/gates.md`.
- **Ước lượng**: 0.5 ngày decision · **Vai trò**: CTO + DevOps · **Phụ thuộc**: BL-13 số liệu.

### BL-24 — Product/Business scoring unlock (P3, product)
- **Yêu cầu**: mở lại dimension Product/Business trong scorecard khi có đủ telemetry (activation, retention, conversion) — không chấm điểm khi chưa có data.
- **DoD**: event taxonomy + dashboard 3 metric; scorecard cập nhật N/A→điểm có nguồn.
- **Phản biện**: có privacy/GDPR issue với event mới không? metric gaming?
- **Minh chứng**: `docs/evidence/audit-bl/BL-24/gates.md`.
- **Ước lượng**: 1–2 tuần · **Vai trò**: Product + FE · **Phụ thuộc**: roadmap feature (ngoài DAG kỹ thuật).

---

## Tổng kết phân bố

| Ưu tiên | Items | Đếm |
|---|---|---|
| P0 | BL-01…BL-11 | 11 |
| P1 | BL-12…BL-17 (+BL-17b) | 6+1 |
| P2 | BL-18…BL-20 | 3 |
| P3 | BL-21…BL-24 | 4 |
| **Tổng ID** | BL-01…BL-24 | **24** |

> Ghi chú: ledger row 198 ghi "P1 7" — thực tế P1 schedule §3 plan = 6 primary (12–17) + BL-17b drill; P3 = 4 (21–24). Consolidation: 11+6+3+4=24. Nếu audit cần đúng "7 P1", gộp BL-17b vào BL-17 và tách 1 mục P1 khác — không làm phẳng số để khớp marketing.
...[truncated 6154 chars]