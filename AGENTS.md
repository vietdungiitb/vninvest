
## Goal
Hoàn thiện SOC DataOps tab (Phase 1 parity với legacy) — Steps 1–3 đã xong. Maintenance và build verification cho codebase sau khi thay local vninvestcharts component bằng npm package `vninvestcharts-widget`.

## Constraints & Preferences
- SOC glassmorphism patterns, `soc.tokens.css` (biến) + `soc.components.css` (class), i18n qua `LangContext`.
  - ⚠ **KHÔNG dùng `soc.module.css`** — file đó chỉ là barrel 3 dòng re-export, **0 token, 0 class**
    (`packages/web/src/components/soc/soc.module.css:1-3`). Thêm token/class vào đó là chỉ dẫn không thi hành được.
- API calls dùng defaultCoreApiAdapter cast as unknown as { … }.
- Vietnamese labels full dấu, theo bảng thuật ngữ thống nhất.
- Build verification: npx tsc --noEmit sau mỗi sub-step, npm run build cuối mỗi step.

## Multi-agent (bắt buộc khi ≥ 2 agent cùng làm việc)

**Đọc `docs/AGENT_PROTOCOL.md` trước khi sửa gì.** Quy trình đầy đủ ở §10.
Registry claim: `docs/CLAIMS.md`. Gate: `node packages/web/scripts/check-multi-agent.mjs`.

### Không được
- **Không commit thẳng vào `dev`** — tạo `feat/<slice>-<agent>` rồi PR. Không có điểm merge thì không ai kịp đồng bộ, và đã sinh migration trùng số (2026-09-26).
- **Không commit 10 file shared** (§2 protocol): `AGENTS.md`, `packages/web/package.json`, `pyproject.toml`, `requirements.txt`, `package-lock.json`, `docker-compose*.yml`, `.env*`. Ghi vào claim + báo coordinator. **Hook sẽ chặn.** `docs/CODE_CHANGE_AUDIT_LEDGER.md` đã **KHÔNG** còn nằm trong danh sách này (Owner chốt 2026-10-03) — agent được append Entry của mình.
- **Không sửa file agent khác đang claim `in-progress`.**
- **Không tự đặt số migration** — đọc head thật hoặc để `makemigrations` sinh.
- **Không chạy `npm install`/`pip install` khi chưa hỏi** (junction `node_modules` dùng chung).
- **Không báo "PASS" cho thứ chưa chạy** — ghi `CHƯA CHẠY`.
- **Không `--no-verify` để lách hook** trừ khi ghi lý do vào commit body.

### Bắt buộc
1. **Mở phiên:** `sh scripts/agent-install-hooks.sh` → `pwsh -File scripts/agent-sync.ps1` → `git -C <main tree> status --short`
2. **Khai claim** vào cuối `docs/CLAIMS.md`, commit riêng, **trước khi sửa dòng đầu tiên**
3. **Đóng phiên:** `pwsh -File scripts/agent-sync.ps1` (rebase → check migration → gate) → claim `done` → push → `pwsh -File scripts/agent-pr.ps1`
4. **Sau khi PR merge:** `pwsh -File scripts/agent-cleanup.ps1 -Branch <b> -Execute`

### Cạm bẫy đã gặp thật 2026-09-26
| Sai lầm | Hậu quả |
|---|---|
| Commit file shared | 1 hunk gộp 2 agent, tách không được |
| Tự đặt số migration | `Conflicting migrations; multiple leaf nodes` — chặn deploy |
| Khai claim khi chưa `git status` | Che mất file đang bị giữ |
| Chạy gate **trước** khi rebase | Báo xanh nhưng code sau rebase khác |
| Tin số migration đọc trong worktree | Worktree không thấy việc chưa commit của agent khác (`aicc_r0` 145 vs `vninvest_core` 147) |
| Hook chưa commit khi tạo worktree mới | Hook im lặng, mọi thứ lọt |

### Không có môi trường ⇒ không có kết luận
BE test cần `CORE_DATABASE_URL` + `DJANGO_DEBUG=1` (settings.py:27-34 raise `ImproperlyConfigured` nếu thiếu). DB riêng mỗi agent: `aicc_r0`. Nếu chưa chạy được, **ghi "CHƯA CHẠY"** — đừng suy ra "chắc là được".

## Progress
> Chỉ mục **còn sống** nằm ở đây. 54 mục `### Done` đã tách sang `docs/ARCHIVE_AGENTS_PROGRESS.md` ngày 2026-09-27 để file nạy mỗi session không bị loãng (579 → 517 dòng lịch sử). Nguồn sự thật về trạng thái: `docs/CLAIMS.md` + `git log`.
### XONG 2026-10-03 — Q-01: ledger **ĐÃ gỡ khỏi deny-list** (7 nguồn), Owner chốt phương án (a)
`verified: 2026-10-03 @ d47574133` · Bộ tài liệu AS-IS 3/3 cũng đã merge (`8e3dce914`, `60be173a7`, `895b4ebfe`, `1fc17b784`).
`AGENTS.md` yêu cầu cập nhật ledger sau **mọi** thay đổi, nhưng §2 lại **cấm commit** chính file đó ⇒ yêu cầu không thi hành được, ledger lệch dần (237 Entry ghi tay trong 6 tuần). Gỡ được vì khác biệt **cấu trúc**, không phải nới quy tắc: `AGENTS.md` là 1 mục `Progress` chung nên hunk gộp không tách được, còn ledger là 1 `## Entry N` riêng nên tách được.
- **⚠ Bài học chính: deny-list NHÂN BẢN ở 7 nơi, không có nguồn duy nhất.** Sửa `AGENTS.md` là fix **vô hiệu**. Đủ 7: `docs/AGENT_PROTOCOL.md:25` (§2, **nguồn sự thật**) · `AGENTS.md` · `.githooks/pre-commit:21` (`DENY`) · `scripts/agent-pr.ps1:44` (`$deny`) · `packages/web/scripts/check-multi-agent.mjs:27` (`DENY_LIST`, chặn **claim**) · `tools/opencode-global/verify-deny-extract.mjs` (`KNOWN` 9→8) · `tools/opencode-global/agent-preflight.mjs:54` (`DEFAULT_DENY_LIST`).
- **Chỗ dễ bỏ sót nhất:** `loadDenyListWithReport()` (`tools/opencode-global/deny-extract.mjs`) **union `DEFAULT_DENY_LIST` làm sàn rồi mới cộng path từ doc** ⇒ xoá ledger khỏi doc **không đủ**, nó vẫn còn trong preflight. Phải sửa **cả** doc lẫn `DEFAULT_DENY_LIST`.
- **Bẫy phải tránh:** `scripts/quality/check_opencore_doc_sync.ps1:66` grep thấy ledger nhưng **KHÔNG phải deny-list** — nó nằm trong `$mustAlways`, là gate **bắt buộc** ledger phải có trong `changedFiles` (ép cập nhật ledger, ngược hẳn deny-list). Xoá nó là **mở lại đúng bug Q-01**.
- Gate chạy thật (CI billing không dùng được): `check-multi-agent` exit 0 · `verify-deny-extract` **8/8** + 9/9 negative · `scan-secrets` 3591 file · `verify-trailer-bypass` 3/3 · `verify-hook-mode` 4/4. Mô phỏng vòng lặp `DENY` của hook: ledger `ALLOWED`, `AGENTS.md` vẫn `BLOCKED`.
- Tác dụng phụ có lợi: **claim ledger trong `docs/CLAIMS.md` giờ được phép** — vòng khai-báo-claim của ledger không còn bị chặn vô lý.
### DOC MỐC 2026-09-27 — đọc `docs/OPEN_WORK_20260927.md` ĐẦU TIÊN khi nhận session mới
`verified: 2026-09-27 @ 0605189`
Chứa: 6 việc còn tồn đọng (OW-01..OW-06, đủ `file:line` + nguyên nhân) · việc owner phải làm trước deploy · **baseline test đã biết** (BE `602 test — failures=10, errors=3`; 1 flake FE) để khỏi điều tra lại · bẫy quy trình đã gặp · quy tắc chạy test BE. 150+ `docs/*_HANDOFF_*.md` khác là **archive lịch sử**, không phải trạng thái hiện tại.
### VERIFY 6 slice `tenantreg-*` (2026-09-27) — code **ĐÃ CÓ ĐỦ**, 13/13 P0 đã sửa, test chạy thật
`verified: 2026-09-27 @ 0605189` · Nguồn sự thật cho trạng thái claim: `docs/CLAIMS.md`, KHÔNG phải file này.
Sửa 1 hiểu nhầm đã làm 1 phiên báo sai: câu "6 agent `tenantreg-*` còn bị giữ file" ở mục Portfolio Commercial là **stale**. `CLAIMS.md:57-62` cả 6 dòng `released`, `OPEN_WORK_20260927.md:8` ghi "đã merge". Đừng suy ra thiếu code từ AGENTS.md — hãy đọc CLAIMS.md.
- **5 file mới claim khai đều tồn tại**: `identity_access/utils/resolve_tenant.py` (16.6 KB) · `vninvest_core/client_ip.py` (10.3 KB) · `vninvest_core/env_validation.py` (5.5 KB) · `pages/auth/authErrors.js` (11.3 KB) · `pages/auth/authPolicy.js` (3.3 KB).
- **13/13 P0 đã sửa, đã đọc code thật**: `s` `STRICT_TURNSTILE_ENFORCEMENT` gán 1 lần (`settings.py:246`, bản cũ `:239-240` đã comment) + `RESEND_*_THRESHOLD` (`:888-889`) · `a` reset/change revoke PAT (`password_reset.py:229`, `password_change.py:99-105`) + onboarding route (`urls.py:26-28`) · `b` `resolve_tenant` owner-or-member SSOT + fail-closed (`resolve_tenant.py:123-161, 275-287`) + `logger` fix (`middleware.py:23`) + `AuditLogListView` `qs.none()` (`ops_audit/views.py:39-47`) + PAT CIDR qua `get_client_ip()` (`authentication.py:45-55`) · `c` `api_calls_limit` default 10000 + writer plan-derived (`models.py:107, 1526-1545`) + migration `0028_coreserviceaccount_uniq_...` · `d` Turnstile `viteEnv.VITE_TURNSTILE_SITE_KEY` (`TurnstileWidget.js:26`) + 1 top-level `auth:`/locale + `PASSWORD_MIN_LENGTH = 10` (`authPolicy.js:36`) · `e` `switchTenant` ghi qua `tenantIdStorage` SSOT (`PortfolioContext.js:663`) + logout clear-trước-rồi-revoke (`:159, 180-196`).
- **Gate chạy thật** (Postgres `127.0.0.1:5433`, DB riêng `tenantreg_verify`, đã `DROP` sau khi chạy; `git status` sạch): **BE 198/198 OK** (`b` 64 · `a`+`c1`+`c5` 66 · `c2/c3c4/c6/c7/c8` 68) + **FE 84/84 OK** (5 files `src/pages/auth`, `src/components/auth`, `src/adapters/core`).
- **Bẫy môi trường mới — cần nhớ:** BE test **không chạy được trên SQLite**. Migration `identity_access/9000_auth_user_email_ci_unique.py:60` dùng `array_agg` của Postgres ⇒ `OperationalError: no such function: array_agg` ngay lúc migrate. Phải dựng DB Postgres riêng. Test của `tenantreg-c` nằm ở **2 thư mục khác nhau**: `a`/`b`/`c1`/`c5` ở `backend/src/identity_access/tests/`, còn `c2`/`c3c4`/`c6`/`c7`/`c8` ở `backend/tests/` — gọi sai đường dẫn cho 5 `ModuleNotFoundError` (không phải lỗi code).
- **Chưa verify riêng** (mới chỉ đọc code + chạy test, chưa trace end-to-end): `validate_password` bypass, enumeration register, 500-after-commit, non-atomic rate limit, 429/field-error handling FE, a11y labels. `docs/evidence/tenant-self-service-20260923/gates.md` mới chỉ ghi B+A (2026-09-23), **không** phải 6 slice ngày 26.
### OPEN P0 (2026-09-26) — Portfolio Commercial: **P0-SEC-01 CHỜ OWNER**, còn lại đã có code (Entry 232, 7 PR)
`verified: 2026-09-27 @ ae030b91` · **Không mở rộng UI cho tới khi P0-SEC-01 (secret trong git) xong — việc đó là của owner.**
- **7 PR đã merge vào `dev`**: #12 broker egress · #13 analytics tenant scope + ledger · #14 order fail-closed + **2 P0 mới** · #15 repair migration `0008` + tenant FK · #16 FE `mode` + `Idempotency-Key` · #17 addendum verify + báo cáo SEC-01.
- **Audit 7/7 P0 vẫn đúng** ở HEAD — nhưng tài liệu sai 20 `file:line`, 3 sub-claim bị refute, 4 finding bị đánh giá THẤP, 2 bị đánh giá CAO. Chi tiết: `docs/evidence/portfolio-commercial/AUDIT_VERIFICATION_20260926.md`.
- **2 P0 MỚI không có trong audit, đã đóng:** (1) mọi lệnh DNSE từ UI trả 400 vì BE đọc `payload['volume']` còn FE gửi `'quantity'` — regression do `275fcd78`, lọt vì **0 test BE nào chạm order path**; (2) audit order không bao giờ ghi được vì `'broker.place_order'` 18 ký tự > `AuditEvent.action` `max_length=16` ⇒ `DataError` bị nuốt.
- **Còn lại, KHÔNG phải việc code:** **P0-SEC-01 chờ owner** — `compose.dev.env` **tracked** + **không ignored**, chứa `DNSE_CREDENTIAL_FERNET_KEY` 44 ký tự (đúng dạng Fernet) ⇒ **mọi `UserDNSECredential` trong DB giải mã được**; 4 token GitHub thật / 20 file, 11 file `scratch/*.py` là **code chạy được**. Thứ tự **không đảo**: revoke → rotate → gỡ khỏi HEAD → purge history → chặn tái diễn. **Không purge history khi còn agent chạy.** Xem `SEC-01-REPORT.md` (chỉ tên file + số dòng, **không** giá trị secret).
- **P0-LEGAL-01:** license `vnbroker` chưa ký ⇒ **R3 live trading không tồn tại**.
- **Bài học coordinator đã trả giá:** cả 4 agent báo gate PASS; merge lại chạy thì **198 test `errors=1`** — `0019:264-272` `print()` tiếng Việt có dấu ⇒ `UnicodeEncodeError` trên cp1252 ⇒ **làm `migrate` thất bại giữa chừng**. Gate trên máy agent **không** đại diện cho máy khác.
- **Còn nợ (ticket riêng):** ~6 chỗ fail-open `if tenant: … else:` trong `views.py` · `ops_audit.action` `max_length=16` · `UserBrokerConfig.tenant` contract phase (đang `null=True`) · `Idempotency-Key` trên cache nên thành `OrderJob` · `order_type` chưa validate · **D-19 chưa đạt** vì 1 test flaky pre-existing.
- **Order tiếp:** owner revoke/rotate P0-SEC-01 + ký license. ~~Wave 2 chỉ mở sau khi 6 agent `tenantreg-*` xong~~ — **ĐÃ SAI, đã sửa 2026-09-27, xem mục "VERIFY 6 slice tenantreg" **ngay phía trên**.** 6 agent đã `released` + merge; `permissions.py`/`middleware.py`/`transport.js`/`i18n` **không còn bị giữ**. Wave 2 (read-only portfolio foundation) **mở được ngay**.

### OPEN P0 (2026-09-25) — PLAN AI Command Center **Rev.2**: 46 slice, 6/6 provider có client, `copilot`+`openclaw` là provider thật (Entry 230, doc-only)
`verified: 2026-09-27 @ ae030b91` · **BE test CHƯA XÁC MINH** (không connect DB) — xem Entry 230 §Gates.
- **Bản nâng cấp của** `docs/IMPLEMENTATION_PLAN_AI_COMMAND_CENTER_COMMERCIAL_20260925.md` (Entry 229). **3 điều chỉnh do phản biện**, không phải tự nhận ra.
- **① Đã gỡ đề xuất sai "gỡ `openclaw` + `copilot`".** Tôi bỏ sót 2 bằng chứng: `advisory/model_choices.py:15-16` cố ý đặt chúng vào `FREEFORM_PROVIDERS` (*"model do hạ tầng quyết định"*) + `ADVISORY_OBSERVABILITY_ARCHITECTURE.md:154-155` đã có bảng alias `'copilot': 'openai/gpt-4.1-mini'`, `'openclaw': 'default'`. **Chưa có transport ≠ không nên có trong danh sách.** Owner xác nhận: `openclaw` = dịch vụ nội bộ thật; `copilot` dùng GitHub token và **đang chạy thật**.
- **② `gemini-3.8-flash`: kết luận đúng là "CHƯA AI PROBE"** — không phải sai cũng không phải đúng. Là model **của Google** (GA); có trong catalog Copilot vì Copilot là **gateway đa nhà cung cấp** (cũng phục vụ model OpenAI/Anthropic/xAI/Moonshot), không phải Copilot sở hữu. Chưa xác minh endpoint Google **trực tiếp** có nhận đúng ID (Entry 204 F6b "blocked proxy test"). Mỗi gateway có bộ ID riêng — `api.githubcopilot.com` từng **không** phục vụ `claude-sonnet-4.5`/`gpt-5`/`o3-mini`. Nếu Google trực tiếp không có mà Copilot có → **giữ model** + nhãn "chỉ dùng qua provider Copilot".
- **③ R2: 7 → 10 slice** (thêm adapter `anthropic` / `copilot` / `openclaw`). `copilot` 14 AC: token exchange 2 bước, cache + refresh sớm 60 s + `threading.Lock`, header `Copilot-Integration-Id` **bắt buộc**, `endpoints.api` cho Enterprise, **4 bẫy 4 `error_code` riêng** (PAT ⇒ 404, cần OAuth `ghu_`; sai client_id; token hết hạn 25 phút; enterprise URL). Nhánh dự phòng `AI_COPILOT_TRANSPORT=github_models`. R2.5 `openclaw` **BLOCKED** chờ 5 thông tin từ owner (D-03c) — **không đoán endpoint**.
- **P0 chặn ngay, không chờ spec**: `openclaw` là **default provider ở 6 nơi** (`portfolio_analytics_views.py:469,472` · `AICommandCenterForm.tsx:129,171,174` · `AICommandCenterPage.tsx:66` · i18n `defaultAiProvider` · migration `0004:63`) → user mới rơi vào `is_mock` → `raise ValueError` khi `DEBUG=False`. Và `test_ai_management_center.py:283-286` + `test_ai_audit_logs.py:242-245` **đang khoá hành vi giả "luôn 200"**. R0.5 sửa cả hai.
- **Model Copilot** (tra cứu 2026-09-25, `docs.github.com/copilot/reference/ai-models/supported-models`): OpenAI — **GPT-5.5, GPT-5.6 Luna/Sol/Terra**, GPT-5.4/mini/nano, GPT-5.3-Codex · Anthropic — **Claude Opus 5**, Sonnet 5, Opus 4.5-4.8, Haiku 4.5, Fable 5/5.1 · Google — **Gemini 3.8/3.7/3.6/3.5 Flash**, 3.1 Pro · Microsoft — MAI-Code-1.1-Flash · xAI — Grok 4.5/4.6 · Moonshot — Kimi K3. **Danh mục gating theo gói + tài khoản ⇒ hardcode SAI TUYỆT ĐỐI**, bắt buộc `GET {endpoints.api}/models` theo user.
- **Số liệu + gate**: 46 slice · 61 cạnh · **0 cycle** · 0 dangling · 5 nút gốc — `npm run check:ai-cc-dag`. **Gate bắt lỗi thật**: tôi khai 58 cạnh ⇒ fail `edge count 61 != declared 58`. Ước lượng 89-108 ed (~130-165 có buffer). **BE test vẫn NOT VERIFIED** (không connect DB).
- **Order tiếp**: owner cung cấp 5 mục D-03c + chốt nhánh Copilot + query `SELECT count(*) FROM advisory_useraicredential WHERE ai_provider='openclaw'` (bắt buộc) + bảo đảm Postgres ⇒ R0.1-R0.3 (1 PR). **R0 không phụ thuộc bất kỳ thứ gì ở trên.**
### OPEN P0 (2026-09-25) — PLAN AI Command Center Rev.1: 43 slice / 6 wave, 7 quyết định đã khoá (Entry 229, doc-only, **superseded bởi Entry 230**)
`verified: 2026-09-27 @ ae030b91` · Giữ để tham chiếu lịch sử quyết định; làm việc theo Rev.2.
- **Kế hoạch**: `docs/IMPLEMENTATION_PLAN_AI_COMMAND_CENTER_COMMERCIAL_20260925.md` (1694 dòng) — 43 slice / 6 wave / **80-97 ed kỹ thuật thuần (~118-152 ed có buffer)**. Mỗi slice có AC có mã số + **phản biện** + minh chứng. Sửa đủ **38 finding** của audit Entry 228.
- **7 quyết định ĐÃ KHOÁ (đội code không hỏi lại)**: D-01 phân quyền 2 lớp (BYOK self-service + system/policy staff-only) · D-02 shape `ai_prompt_config` = `{version:2, sources}` · D-03 openai/gemini/local bật, claude disabled, copilot+openclaw gỡ · D-04 `ai_readiness` struct có `reason_code`+TTL · D-05 budget cost-USD chính · D-06 quy ước lệnh test BE · D-07 gate `check:ai-cc`.
- **Thứ tự**: R0 (9 slice) → R1 (11) → R2 (7) → R3 (6) → R4 (5) → R5 (5). **M0 = R0 xanh là điều kiện bắt buộc trước mọi thứ khác** — chưa đạt thì KHÔNG bán tính năng.
- **R0.1–R0.3 = cùng 1 PR** (cùng chạm `effective_context` + prompt contract). R0.2 sẽ **phá 18 assertion** đang bảo vệ shape phẳng — đã tính sẵn vào budget, không phải sự cố.
- **5 STOP condition** (§3.4): test BE không chạy được vì thiếu DB = blocker hạ tầng, dừng; AC R0 không đạt sau 2 lần sửa = có thể finding gốc sai; cần sửa migration đã chạy = dừng; thấy rò rỉ ngoài phạm vi = báo **không** tự mở rộng.
- **Đính chính minh bạch**: plan soạn đầu khai DAG "0 cycle" **chưa kiểm chứng**; script DFS tìm ra 2 cặp vòng `R0.4↔R0.5` + `R0.7↔R0.9` → đã sửa. Kết quả sau sửa (chạy script thật): **43 nút / 53 cạnh / 0 cycle / 0 dangling / 5 nút gốc**.
- **Blocker hạ tầng #1**: BE test **không connect được Postgres** (Entry 228, 71 errors). Phải có DB trước khi bắt đầu R0.
- **Trước khi code** (§10.1): CTO/PO xác nhận D-01 + D-03; query `SELECT count(*) FROM advisory_useraicredential WHERE ai_provider='openclaw'` — nếu > 0 thì chuyển sang `local` thay vì xoá (RSK-04).
- **Order tiếp**: xác nhận D-01/D-03 + bảo đảm DB → R0.1-R0.3 (1 PR) → R0.4-R0.9 → R1.
### OPEN P0 (2026-09-26) — AI Advisory: **HẾT HẠN MỨC GEMINI**, chặn tính năng, KHÔNG phải lỗi code (Entry 231)
`verified: 2026-09-27 @ ae030b91` · **Việc cần làm: nạp tiền / đổi gói.** Không sửa code.
- **Bằng chứng quyết định** (probe trực tiếp endpoint Google, 2026-09-26): prompt **1 từ**, `max_tokens=64`, 3 request **giống hệt** trên `gemini-3.8-flash` → **429 cả 3**, không header `Retry-After`, message `"You exceeded your current quota, please check your plan and billing details"`.
- **`gemini-3.8-flash` KHÔNG hỏng.** 3 sub-agent gọi song song trả 200; chỉ synthesis 429. Tách biến: cả 3 model (3.8 / 2.5 / 2.5-lite) đều 429 ở request nhỏ nhưng 200 ở request lớn — dấu hiệu hạn mức theo token đã cạn, không phải lỗi model. Kịch bản 4 request/advisory (3 sub-agent + 1 synthesis) đẩy vượt hạn mức.
- **Việc cần làm: nạp tiền / đổi gói.** Không sửa code. Sau đó chạy lại E2E full pipeline `gemini-3.8-flash` + chụp ảnh `*-data.png` thật.
- **3 lỗi code thật tìm được trong lúc điều tra — đã sửa** (đừng tưởng hết hạn mức là do lỗi này): (a) `matched_value` + `whale_intensity` **chỉ có chỗ đọc, không có chỗ ghi** trong app `advisory` ⇒ 2/4 metric luôn `—` không lỗi để debug → nay tính deterministic từ `SymbolSnapshot`+`SessionFacts`; (b) `AdvisorySession` **không có FK** tới `AdvisoryRecord` ⇒ record fail vẫn trả component của phiên cũ (rủi ro hiển thị khuyến nghị mua/bán cũ) → nay chỉ đọc khi record thật sự có kết quả; (c) 429 gộp chung quota + rate-limit → nay tách `provider_quota_exceeded` (không retry).
- **B3**: `echarts` 623 KB **đã ra khỏi** tải đầu `/ai-advisory` (1.998,6 → 1.339,8 KB, **−33%**). Nguyên nhân gốc: `__vitePreload` của Vite bị Rollup đặt nhầm vào chunk `dashboard`, mà app shell lại dùng nó ⇒ **mọi route** đều tải chunk dashboard. Đo bằng `packages/web/scripts/measure-route-graph.mjs` (BFS cạnh import **tĩnh**).
- **Cạm bẫy đo bundle**: script đo đầu tiên của tôi cảm nhận `import()` động ⇒ báo 94 chunk/6.157 KB và kéo theo route **chưa mở**. Đo sai kiểu đó ra kết luận sai. Và con số "xlsx 419 KB trong advisory" ở backlog cũ là **sai** — xlsx không bao giờ nằm trong tải đầu.
- **Pre-existing, đã chứng minh bằng worktree HEAD sạch**: test `useAlertCenterSnapshot.pagination.component.test.ts` fail **không ổn định** trong full suite (riêng file luôn 3/3). Tái lập ở HEAD: `1 failed | 79 passed`, cùng test này. Đừng quy cho code mới.
- **Order tiếp**: nạp tiền Gemini → E2E 3.8-flash + ảnh data thật. Tách ticket riêng cho test pagination flaky.
### OPEN P0 (2026-09-25) — AUDIT `/settings/ai` Trung tâm điều hành AI: 5 blocker chặn production (Entry 228, doc-only)
`verified: 2026-09-27 @ ae030b91`
- **Tài liệu**: `docs/AUDIT_AI_COMMAND_CENTER_20260925.md` — 11 CONTRADICTIONS + 38 findings (P0×7 / P1×14 / P2×8 / P3×6) + benchmark 25 năng lực vs LiteLLM/Portkey/OpenRouter + đề xuất R0→R5 (44 ticket có AC). Chấm **3.1/10**.
- **5 P0 đã verify file:line** (chưa fix, đề xuất R0 tuần tự):
  1. `ai_model` user chọn **không dùng** — `advisory/views.py:431` lấy từ `SystemAISettings`, không phải `UserAICredential.ai_model` (`advisory/models.py:225`). Dropdown "Mô hình AI" write-only = nguyên nhân gốc 404 (Entry 215 RC#1).
  2. `ai_prompt_config` **ghi sai shape ⇒ mất cấu hình âm thầm** — BE CC GET dựng default phẳng `portfolio_analytics_views.py:425-439` nhưng `_parse_prompt_config` (`advisory_helpers.py:99-101`) cần `{version, sources}` và `return defaults` khi thiếu. Bấm "Lưu cấu hình" không mở drawer là mất sạch.
  3. **4 nguồn default prompt config** mỗi nơi một giá trị (BE canonical / BE CC GET / FE drawer / FE `useAIAdvisor`) + key chết `lookback_unit` → vi phạm SSOT.
  4. **Audit log lộ cross-tenant** — `portfolio_analytics_views.py:1007` `AIAuditLog.objects.all()`; bảng không user FK (`advisory/models.py:303`); `/settings/ai` không staff-gated (`sidebaritems.ts:36`) trong khi BE nav chỉ staff (`identity_access/views/helpers.py:188`). **Đóng được OPEN P0 của Entry 215.**
  5. **SSRF** — `test-connection` gọi thẳng `custom_endpoint` (`portfolio_analytics_views.py:876-908`, `orchestrator.py:196-200`), không validate host/IP, không throttle. **Đóng được OPEN P0 #1 của Entry 215.**
- **Trung thực trạng thái**: `ai_ready` (`:490,725`) không probe, không check cặp provider/model → "Sẵn sàng" là giả. `claude`/`copilot` rơi vào `api.openai.com` (401 chắc chắn). `openclaw` → `orchestrator.py:154` `is_mock` → `raise` khi `DEBUG=False` = **hỏng advisory production** trong khi UI báo xanh.
- **Feature chết**: tab Usage vĩnh viễn rỗng (không code nào ghi `AIUsageRecord`; `POST /ai/usage/` còn cho user bịa số liệu); tab Agents là CRUD chết (`AgentRegistry` không ai đọc); `ShellAiCommandCenterPage` không route.
- **Gate**: `check:shell` thật **0 coverage AI CC**; `check-shell.mjs` (1341 dòng, chứa assert AI CC) **crash** `ERR_UNKNOWN_FILE_EXTENSION ".css"`; `ai-cc-contract-smoke` là tautology. i18n: `aiCommandCenter.loadError` thiếu cả 2 locale + 18 key chết.
- **Gates chạy**: tsc 0, eslint 0 err/20 warn, vitest 4 files/21 PASS, check:shell 0, check:tokens PASS, check:contrast PASS, i18n:scan 0 idempotent, **BE test CHƯA XÁC MINH** (không connect DB, 71 errors).
- **Cần user quyết định trước khi code**: AI CC là **user self-service** hay **staff-only**? Menu nói user, BE nav nói staff, API nói user — 3 chiều lệch nhau.
- **Order tiếp**: quyết định trên → R0 (9 ticket) → R1 → R2 → R3 → R4 → R5. **Không làm UI/UX trước R0.**
## Key Decisions & Metrics
- Local `vninvestcharts/` component tree (~745 files, -102k lines) replaced by npm package `vninvestcharts-widget` ^1.2.5
- New adapter file: `packages/web/src/adapters/chartAdapter.js` — bridges core API → chart bar format
- New type declarations: `packages/web/src/types/vninvestcharts-widget.d.ts` — 44 lines
- renderSeries() registry refactor (Priority 2) completed in commit `3df5ff6c`
- **Widget lazy-load** (Option B): Widget code-split thành async chunk. App đã upgrade lên React 19 — recharts@2.15.4 hỗ trợ ^19.0.0.
- **SOC DataOps parity: ~95%+** (tất cả 20 feature gaps đóng).
- Priority 1 (VNInvestCharts.js split) và Priority 3 (contract test split) obsolete — component đã xoá

---

## AI Audit/Research Framework (Quy định cứng bắt buộc)

Mọi prompt audit, nghiên cứu, phân tích chi tiết dự án (bao gồm nhưng không giới hạn: audit code, research architecture, phân tích subsystem, review plan-vs-code, impact analysis, debugging investigation, spec verification, code-review, integration-test review) PHẢI tuân theo khung dưới đây. Quy định này áp dụng bắt buộc cho toàn bộ repo `vninvest`, không phụ thuộc vào repo `vninvestcharts-widget`.

### Nguyên tắc chống lỗi audit (kế thừa bài học DRAWING_DOCK + sai sót navigation/TDZ 2026-07-17)

| Bài học | Nguyên tắc chống tái diễn |
|---------|--------------------------|
| Plan bảo CSS "chết" nhưng code vẫn dùng | **Nguyên tắc 1**: grep/scrape PHẢI quét TOÀN repo bao gồm `.css`, `.module.css`, `soc.tokens.css`, `soc.components.css`, config (`vite.config.ts`, `tsconfig*.json`), demo, i18n (`src/i18n/vi.js`, `en.js`). Không dừng ở file `.ts`/`.tsx`. |
| Plan bảo field X có trong state nhưng code không có | **Nguyên tắc 2**: Đối chiếu plan→code phải có mục CONTRADICTIONS riêng, mỗi dòng kèm `plan:file:line \| code:file:line \| impact`. |
| Plan trỏ file không tồn tại | **Nguyên tắc 3**: MỌI reference file phải được `read` hoặc `grep` xác nhận tồn tại. File KHÔNG TỒN TẠI → báo `KHÔNG TỒN TẠI`, không suy diễn "có thể ở đâu đó". |
| Quên external package coupling | **Nguyên tắc 4**: Web app tiêu thụ `vninvestcharts-widget` (npm `^1.2.5`) và `defaultCoreApiAdapter`. Mọi tracing qua ranh giới widget/adapter PHẢI kiểm tra (a) type declarations `src/types/vninvestcharts-widget.d.ts`, (b) adapter `src/adapters/core/market.js` + `transport.js`, (c) version thực tế trong `packages/web/package.json`. Không đoán shape của package ngoài. |
| Quên i18n / fat-file / quality gates | **Nguyên tắc 5**: Phần "Quality Gates" audit PHẢI gồm: (a) eslint status (`npm run lint`), (b) type-check status (`npm run build` = `tsc && vite build`), (c) i18n hardcoded string scan (`src/i18n/vi.js`, `en.js`, `npm run i18n:scan`), (d) test coverage gap (`npm run test`, `npm run test:components`). |
| Debug navigation/TDZ do thiếu trace thực tế | **Nguyên tắc 6**: Mọi điều tra bug runtime/UI PHẢI reproduce-first và trace từng bước qua file:line. Không chốt root cause bằng suy luận; phải có bằng chứng (console error, repro script, hoặc trace log) trước khi đề xuất fix. |

### Cấu trúc khung prompt chuẩn (điền scope cụ thể vào `[...]`)

```markdown
Bạn là kiểm toán viên mã nguồn cấp cao. Nhiệm vụ: NGHIÊN CỨU và PHÂN TÍCH CHI TIẾT
[phạm vi: subsystem / feature / module / package] tại:

  C:\Mujoco Projects\vninvest

(liên quan: packages/web = React/Vite app, packages/core = Django backend,
packages/vip-app, packages/opencore, packages/mobile — mọi phân tích qua
ranh giới web↔core hoặc web↔widget PHẢI tham chiếu CẢ HAI bên).

=== 0. NGUY TẮC BẮT BUỘC ===
1. MỌI khẳng định kèm `file_path:line_number`. Không có line = không hợp lệ.
2. KHÔNG đoán. Chưa đọc file thật → ghi "CHƯA XÁC MINH".
3. Bắt buộc dùng grep/glob/read, không dùng kinh nghiệm chung.
4. Plan/doc MÂU THUẪN với code → finding quan trọng nhất, báo mục CONTRADICTIONS.
5. grep/scrape TOÀN repo bao gồm .css, .module.css, config, i18n, adapters.
6. KHÔNG viết code. Chỉ nghiên cứu + phân tích + đề xuất (trừ khi được yêu cầu rõ).
7. KHÔNG bịa file. File không tồn tại → báo "KHÔNG TỒN TẠI".
8. Ngôn ngữ báo cáo: Tiếng Việt.

=== 1. ĐỌC TRƯỚC (bắt buộc) ===
- AGENTS.md, docs/CODE_CHANGE_AUDIT_LEDGER.md
- docs/ [các file context cần đọc]
- [tên plan / spec / review cần đối chiếu, ví dụ RUN_SPEC_AUDIT_*, RUN_CODE_REVIEW_*]

=== 2. PHẠM VI NGHIÊN CỨU ===
A. [SUB] — [mô tả subsystem A]
   - [file patterns / dirs cần glob, ví dụ packages/web/src/features/...]
   - [symbols cần grep]
   - [plan cần đối chiếu]

B. [SUB] — [mô tả subsystem B]
   - ...

C. CROSS-PACKAGE / EXTERNAL COUPLING (nếu có)
   - web↔core API contract (defaultCoreApiAdapter, src/adapters/core/*)
   - web↔vninvestcharts-widget (src/types/vninvestcharts-widget.d.ts, package.json version)
   - dist vs src staleness nếu liên quan engine

D. QUALITY GATES
   - Lint: npm run lint (packages/web)
   - Type-check: npm run build (= tsc && vite build)
   - i18n: src/i18n/vi.js, en.js + npm run i18n:scan
   - Test: npm run test, npm run test:components

=== 3. PHƯƠNG PHÁP ===
B1: Đọc context docs + plans (mục 1)
B2: glob [dir patterns]
B3: grep [key symbols]
B4: read từng file cốt lõi, trace 1 use-case cụ thể
B5: Đối chiếu plan ↔ code, gạch chỗ lệch
B6: Check ranh giới: lint, type-check, i18n, test, external coupling

=== 4. ĐẦU RA ===
A. Bản đồ kiến trúc (bảng: file | line_count | trách nhiệm | note)
B. Luồng dữ liệu đã trace (use-case cụ thể, kèm file:line từng bước)
C. CONTRADICTIONS (plan/doc vs code): [mỗi dòng] Plan X (file:line) | Thực tế Y (file:line) | Tác động
D. Findings: [ID] <ERROR|GAP|RISK> | Mức | file:line | Thực tế | Tác động | Đề xuất fix
E. Quality gates audit (lint / type-check / i18n / test)
F. Câu hỏi cần làm rõ
G. Đánh giá tổng thể: implementable? blocker? ưu tiên sửa?

=== 5. ĐẦU RA NGẮN ===
Tóm tắt 5 findings nghiêm trọng nhất vào 1 đoạn đầu file.
```

### Cách dùng

Khi cần AI phân tích/research/audit bất kỳ phần nào của dự án:
1. Copy template từ mục "Cấu trúc khung prompt chuẩn"
2. Điền `[phạm vi]`, file paths, symbols cần tra
3. Paste vào session AI mới
4. AI sẽ tự chạy grep/glob/read theo đúng quy trình

Không deviation khỏi cấu trúc đầu ra (mục 4). Thiếu section = kết quả không hợp lệ.

### Ghi chú ledger

Sau mọi thay đổi mã nguồn hoặc kết luận audit quan trọng, PHẢI cập nhật `docs/CODE_CHANGE_AUDIT_LEDGER.md` (root) theo quy ước hiện hành của dự án: append **1 `## Entry N` riêng** ở đầu file + 1 dòng index ở bảng cuối file, đánh số kế tiếp (không sửa/xoá Entry cũ).

**Từ 2026-10-03 yêu cầu này đã thi hành được** — ledger gỡ khỏi deny-list ở cả 7 nguồn (xem mục Progress Q-01). Agent append Entry của mình rồi commit bình thường, **không cần** `--no-verify` và không cần claim trước. Còn `AGENTS.md` thì vẫn nằm trong deny-list.
