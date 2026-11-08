# GATES EVIDENCE — Remaining gates 2026-11-08 (sau PR#300)

> Branch: `feat/remaining-gates-20261108` · Base: `origin/dev @ 322fbc185` (PR#300 merged) · Nhật ký commit: `762008e7c` claim → `1c1cbd5ad` fix(i18n) + W0-2 test.
> Quy tắc trung thực (L-G02): mục nào chưa chạy ghi **CHƯA CHẠY** + lý do, không fake PASS.

## 1. FE gates (chạy thật trên worktree, 2026-11-08)

| Cổng | Lệnh (HEAD worktree) | Kết quả |
|---|---|---|
| `check-multi-agent` | `node packages/web/scripts/check-multi-agent.mjs` | **PASS exit 0** (0 lỗi; 157–158 cảnh báo không chặn) |
| `check-lessons` | `node scripts/check-lessons.mjs` | **PASS exit 0** (14 file \| 57/60) |
| `tsc --noEmit` | `npx tsc --noEmit` (packages/web) | **PASS exit 0** (chạy lại 15:39 + B8 re-measure PASS) |
| `normalize-eol` | `node scripts/normalize-eol.mjs docs` | **PASS exit 0 OK** (0 file đổi) |
| `i18n:scan:strict` | `npm run i18n:scan:strict` (packages/web) | **PASS exit 0** (5 dòng hint khôi phục default vi có sẵn, không tính fail) |
| FE vitest full | `npx vitest run` (packages/web) | **172 pass / 1 fail (173 files; 1185/1186 tests)** — fail duy nhất `ai-cc-i18n-clean.component.test.ts` AC5 (93 dòng comment tiếng Việt trong 9 file AI CC; **pre-existing R1.3 debt**, file ngoài diff `dev..HEAD`, không do branch này gây ra) |
| W0-2 focused test | `npx vitest run StockOrderBookWidget.estimated.component.test.tsx` | **PASS 2/2** (badge hiện khi `is_mock:true`, ẩn khi `false`) |
| `npm run build` | `npm run build` (packages/web) | **PASS `✓ built in 15.93s`** (vite 5.4.21, 3705 modules; cảnh báo chunk >1000 kB là pre-existing) |
| `npm run lint` | `npm run lint` (packages/web) | **PASS 0 errors, 4417 warnings** (jsx-no-literals pre-existing) |

## 2. VPS staging (14.225.255.47)

- `cd /opt/vninvest && git pull origin dev` → fast-forward `983b8c270..322fbc185` (PR#300) ✓
- `bash scripts/deploy-staging.sh --verify` → **PASS** (config hợp lệ, `GET /api/health/ = 2xx` qua nginx, 0 container chết, 5 worker không healthcheck vẫn chạy, crash-loop ổn định) ✓
- `docker exec ... python /app/scripts/dump-core-route-manifest.py` → `core=521 public=1`; `scp` về local → `local 521 vps 521, dup 0/0, local-only 0, vps-only 0` — **manifest khớp 100% sau khi gỡ mount trùng W0-1** ✓
- VPS container là image cũ (Up 9 ngày) — code của PR#300 đã có trong repo máy chủ (`/opt/vninvest`) nhưng chưa rebuild image; `--verify` chỉ kiểm tra stack đang chạy.

## 3. BE regression trên VPS (docker exec, `PYTHONPATH=/app/core/backend:/app/src`)

| Module | Kết quả |
|---|---|
| `vninvest_core.tests.test_env_validation` + `tests.test_ad_signing_secret` | **25 tests OK** (env_validation 21 + ad_signing_secret 4) |
| `identity_access.tests.test_saml_signature_mode` | **10 tests OK** (fail-closed `strict` khi thiếu python3-saml — đúng W0-4) |
| `tests.test_advisory_signal_norm` + `tests.test_advisory_orchestrator_contract` | **40 tests OK** (đã thêm token `BULLISH`/`BEARISH` ở W2-1) |
| `tests.test_signal_materializer_schedule` | **4 tests OK** (W0-8 NOOP removal) |
| `vninvest_core.tests.test_api_envelope_schema.HandlerResolvabilityTest` | **2 tests OK** (53s) |
| `vninvest_core.tests.test_no_timezone_utc` | **1 test OK** |
| `test_api_envelope_schema` toàn file | **CHƯA CHẠY trọn gói** (3 lần timeout 120s do tạo test DB/migrate nặng; thay bằng HandlerResolvabilityTest 2 tests OK + grep refute W0-7) |

## 4. Verify-only W0-7 / W1-1

- **W0-7 refute:** `test_api_envelope_schema.py:612-621` — `KNOWN_UNREADABLE` là đúng **5 entry** (`OperatorAdCampaignViewSet`, `OperatorAdDailySummaryViewSet`, `DataIngestAdminViewSet`, `IngestJobViewSet`, `IngestRunViewSet`), **0 entry `views_broker`** — khẳng định cũ "5 endpoint broker" bị bác bỏ, không cần code.
- **W1-1:** `routeCatalog.js:215-223` (`broker` `/broker`) + `:237-248` (`portfolios-manage-broker` deprecated → redirect `/broker`) tồn tại; wiring `usePortfolioManage.ts:105` + `PortfolioOverviewPage.tsx:59` + `WatchlistContext.tsx:87` đã green từ W1-1 gốc — verify-only PASS.

## 5. W2-1-i18n (phần nhãn)

- `en.js`: 16 chuỗi đổi (`AI Intelligence Recommendation`→`AI Technical Analysis`, `Recommendation history`→`Technical analysis history`, `detailed recommendation`→`detailed technical analysis`, `review/recommendations`→`technical analysis`, v.v.).
- `vi.js`: 21 chuỗi đổi (`Khuyến nghị …`→`Phân tích kỹ thuật …`, `Lịch sử khuyến nghị`→`Lịch sử phân tích kỹ thuật`, `khuyến nghị giao dịch`→`phân tích kỹ thuật`, v.v.).
- Grep sau sửa: `en Recommendation:` **0**, `vi Khuyến nhị:` **2** (toàn false-positive: `Khuyến mãi nội bộ` (promotion), `Không khuyến nghị về bảo mật` (security warning), disclaimer `không phải lời khuyên đầu tư` — giữ nguyên).
- Danh sách hit còn lại là **key `recommendation_*`** (identifiers telemetry event, không phải label giới thiệu khuyến nghị đầu tư) được giữ có chủ đích để không đổi contract event.
- Phần LLM contract (`orchestrator.py:722-726` `signal: BUY|SELL|HOLD` + `target_price`) **còn nợ ngoài scope plan này** (Non-goals ghi rõ) — nhưng thực tế commit PR#300 (W2-1 BE) đã đổi prompt sang `posture: BULLISH/BEARISH/NEUTRAL` + `levels`, nên nợ hiện chỉ còn là i18n labels đã được đóng ở đây.

## 6. CHƯA CHẠY / ngoài phạm vi

- `test_api_envelope_schema` toàn file (timeout 120s lặp lại) — có HandlerResolvabilityTest 2 tests thay thế.
- E2E Playwright, screenshot/visual QA 3 viewport — ngoài Vite vitest/build/lint.
- Deploy image mới lên VPS (VPS chỉ `--verify`) — image staging vẫn là bản build 9 ngày trước.
- Sửa `ai-cc-i18n-clean` AC5 (93 dòng comment tiếng Việt, pre-existing R1.3/R1.10 debt) — ngoài phạm vi W0-2/W2-1; cần ticket riêng.
- Secrets rotation OW-01 SEG + CI billing — [X] chờ Owner (Owner đã chốt trì hoãn tới production/public).

*B8 re-audit (độc lập, chỉ đọc) đã đối chiếu diff 5 file + 0 deny-list/0 migration + W0-2/W0-7/W1-1/W2-1 — xem `B8_VERDICT_20261108.md`.*
