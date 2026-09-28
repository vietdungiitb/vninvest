# Lưu trữ — AGENTS.md phần `## Progress` (đã tách 2026-09-27)

> 54 mục `### Done` được chuyển từ `AGENTS.md` sang đây. Xem `AGENTS.md` cho quy trình
> và trạng thái còn sống; xem `docs/CLAIMS.md` + `git log` cho trạng thái thực tế.
### Done (2026-09-25) — AI Advisory Commercial Wave P0+P1 (Entry 215)
- **Wave P0 (BE)**: S01 user-scoping Latest/History, S02 strip API key snapshot, S03 per-user lock+cooldown, S04 throttle `advisory_refresh`, S05 wire user budget/temperature, S06 synthesis fail-loud + quota refund, S07 bundle (Sum/no-reset/PUT validate/settings). Gates: check 0, makemigrations clean, BE 8/8 PASS.
- **Wave P1 (FE)**: S08 xóa link chết `/ai-advisory/shell` (Option A) + test route 4/4; S09 port `.neon-glass-panel`/`.agentic-glow-cyan` + light-mode; S10 skeleton + `AIAdvisoryWarningBanner` + quota max động + test banner 3/3; S11 confidence 0-1→0-100 + `localeTag` + i18n namespace `aiAdvisory` 20 keys VI/EN + test 4/4.
- **Gates**: tsc 0, build PASS 41.07s, eslint 0 errors, vitest 13/13, `check:shell` exit 0, i18n diff sạch. Order tiếp: Wave P2 (S12–S15).
### Done (2026-09-25) — AI Advisory S12 backtest T+1/T+3/T+5 (Entry 215)
- **BE**: `AdvisoryBacktestView` `GET /core/v1/advisory/backtest/<symbol>/?window=30|90` (Option A) — user-scoped, side từ `structured_output`, forward-return từ `DailyPrice`, aggregates null khi N<5, không migration. Test BE 4/4 + regression 28/28 (fix 2 stale test mâu thuẫn S02/S07b Wave P0).
- **FE**: adapter `getAdvisoryBacktest` + `AdvisoryBacktestPanel` (window/hit-rate/avg/N/disclaimer) + tab backtest thứ 4 + i18n `aiAdvisory.backtest` 13 keys VI/EN + test 2/2.
- **Contradictions ghi nhận**: outcome_t1/t3/t5 không tồn tại ở BE; route per-symbol `portfolio/ai-advisory/*` unreachable (views chết, FE 404 silent) → backlog riêng. Container dev-api là image stale — gates BE chạy host `.venv`.
- **Gates**: check 0, makemigrations clean, tsc 0, eslint 0 errors, vitest 15/15, `check:shell` exit 0. Order tiếp: S13 export/share/compare.
### Done (2026-09-25) — AI Advisory S13 export/share/compare (Entry 215)
- **Export (G2)**: util `advisoryExport.js` (BOM + escape + cap 5000, reuse pattern SOC); nút `Xuất CSV` CommandPanel + `Xuất lịch sử CSV` HistoryMini; header gồm outcome_t1/t3/t5 (cells rỗng trung thực).
- **Share (G2)**: copy link `/ai-advisory?symbol=X` (clipboard + fallback); page đọc `?symbol=` lúc load.
- **Compare (G3)**: `AdvisoryCompareTable` 5 cột + cap 5 + toggle từng row sidebar + section compare.
- **Gates**: BE không đổi; tsc 0, eslint 0 errors, vitest 21/21, `check:shell` exit 0, i18n `aiAdvisory.export/share/compare` 22 keys VI/EN. Order tiếp: S14 alert + order ticket.
### Done (2026-09-25) — Audit giao diện `/ai-advisory` + phát hiện ROOT CAUSE data (Entry 215, doc-only)
- **Doc**: `docs/IMPLEMENTATION_PLAN_AI_ADVISORY_UI_COMMERCIAL_REFACTOR_20260925.md` — 7 wave, R0.1–R0.12 + R1.1–R6.7, DoD 12 lệnh + 12 kịch bản E2E, 7 phản biện, 4 điểm "có thể sai".
- **ROOT CAUSE P0 (runtime probe trên container, không phải suy đoán)**:
  1. `ai_provider=gemini` + `ai_model=gpt-4o-mini` → orchestrator `orchestrator.py:201-204` trỏ endpoint Google, gửi model OpenAI → **404**. DB chỉ có 1 record `failed`, `structured_output` rỗng.
  2. `orchestrator.py:302-311` không trả `signal`/`confidence_score`; `tasks.py:45-47` copy **nếu có** → `serializers.py:92-98` trả `None` vĩnh viễn ⇒ `side=UNKNOWN` 100% ⇒ order ticket chặn vĩnh viễn, backtest 0 mẫu, confidence luôn `—`.
  3. `views.py:696` `re.compile(r'[^A-Z ]')` xoá dấu Việt — chạy regex thật: **5/14 MISMATCH**; `BÁN`→`None`, và **`KHÔNG MUA` → `BUY`** (ngược chiều).
- **Giao diện**: bubble chart chỉ ở 2 nơi (advisory + dashboard), **không** có ở `/stocks` (bác bỏ giả định PO) → bỏ 1 chỗ an toàn. Sidebar 3 cột **luôn 0** vì `portfolio_analytics_views.py:1543-1549` là stub `{'stats': []}`. Telemetry chỉ đọc `localStorage`. 87 chuỗi VI hardcode, 0/17 file dùng token, 15/17 dùng `createElement`, 774 KB + 2 request/mã cho chart rỗng, `i18n:scan` exit 0 dù parse fail.
- **Gates audit**: tsc 0, lint 0 errors, `i18n:scan` 0 (parse fail), vitest 4 file/18 PASS. Doc-only, không sửa code.
- **Order tiếp**: W0 (contract BE) **tuần tự trước tuyệt đối**, rồi mới refactor UI.
### Done (2026-09-26) — AI Advisory: ĐÓNG ROOT CAUSE DATA + refactor UI toàn diện (W0–W6)
- **Doc/evidence**: `docs/IMPLEMENTATION_PLAN_AI_ADVISORY_UI_COMMERCIAL_REFACTOR_20260925.md` + `docs/evidence/ai-advisory-ui/{gates,e2e,bundle,i18n}.md`.
- **W0 contract BE — đây mới là thứ làm trang có dữ liệu**:
  - `advisory/signal_norm.py` (SSOT) + `advisory/model_choices.py` mới. Bỏ regex `views.py` `[^A-Z ]` từng làm `BÁN`→None và **`KHÔNG MUA`→BUY**.
  - `orchestrator` trả `signal`/`confidence_score`/`risk_level`/`target_price`/`rationale`; `tasks._build_structured_output` ghi đủ key + **fail-closed** (signal UNKNOWN → `status='failed'`, không ghi tín hiệu không chiều). `serializers` 17→29 field + wire `AdvisoryComponent`.
  - 2 endpoint stub → **thật**: `ai-advisory-symbol-stats` (bỏ 3 cột số 0 giả), `ai-advisory/` list.
  - `sanitize_sensitive_fields` đệ quy vào `list`; guard 409 trùng record; unique index `(user_id, symbol, session_date)` (migration `advisory/0010`, **đã verify trên Postgres**).
  - Đóng 2 security blocker Entry 215: audit log scope theo `actor`; `dnse_place_order_api` có validate server-side + throttle `broker_order` + audit + không lộ raw `str(exc)`.
  - **2 root cause phát hiện khi deploy thật**: (a) 3 sub-agent gọi song song → Google trả 503 (1 request tuần tự trả 200) → thêm retry backoff, chỉ retry lỗi tạm thời; (b) **`max_tokens` mặc định 1000 làm JSON bị cắt cụt** (`finish_reason=length`, 44–62 ký tự, JSON fail; 2000 mới OK) → `SYNTHESIS_MAX_TOKENS_FLOOR=2000` + tách mã lỗi truncated/invalid khỏi lỗi HTTP.
- **W1–W4 UI**: bỏ bubble chart (verify bằng BFS load graph: **không còn** trong chunk của `/ai-advisory`, mất 2 API call/mã) + xoá `ShellAiAdvisoryPage` 420 dòng chết · layout 3 tầng sidebar sticky · 4 tab→3 (telemetry xuống footer) · sidebar chỉ cột có dữ liệu thật + bỏ badge LIVE giả · 3 empty state riêng · metric null→`—` · error banner có mã lỗi · 3 file → JSX + `components/ui/*` · light mode override theo nhóm utility · 87→**0** chuỗi VI thật, parity 174/174.
- **W5 gate mới**: `scripts/check-i18n-hardcoded.mjs` exit 1 thật, gắn vào `check:shell` (gate `i18n:scan` cũ parse lỗi mà vẫn exit 0).
- **E2E thật**: `generate_advisory_task` → `status=generated`, `signal=HOLD`, `confidence_score=0.6`, `rationale` tiếng Việt, 5 components. **Trước đó** `signal=None`, `confidence=None`, `side=UNKNOWN` ⇒ order ticket chặn vĩnh viễn, backtest 0 mẫu.
- **Gates**: BE `check` 0 + `makemigrations` sạch + **130/130 OK**; FE `tsc` 0 + `lint` 0 + `check:shell` 0 + `build` PASS + **130/130 test PASS**.
- **Còn lại**: cập nhật `ModelChoices` (gemini-1.5-flash đã 404); 19 chuỗi VI trong `WhaleBubbleChart` (dashboard); tách `echarts`/`xlsx` khỏi chunk shared; **visual QA 6 ảnh chưa chụp**.
### Done (2026-09-25) — AI Advisory S15 poll-status + explainability + a11y/light + BLOCKER fixes (Entry 215)
- **BE**: `AdvisoryStatusView` (poll thay snapshot mù) + `AdvisoryRefreshInfoView` (đóng feature chết S10: route `auto-refresh-info` không tồn tại, budget banner không bao giờ hiện) + `AdvisoryLatestView.delete` (nút Xóa trước đây gọi path chết).
- **BLOCKER C1 đóng**: FE đọc field bịa `side/recommendation/confidence` trong khi serializer chỉ có `signal/confidence_score/summary` → order ticket biến **mọi** tín hiệu thành BUY. Nay `normalizeAdvisorySide` fail-closed (`UNKNOWN` chặn đặt lệnh), `matched_value` map đúng, quantity bắt buộc lô 100.
- **Backtest trung thực**: side parse fail-closed (chặn phủ định/đa chiều), dedupe theo session, cap 200 giữ mẫu mới, cờ `truncated`/`reliable` (≥30 mẫu) + cảnh báo mẫu nhỏ.
- **A11y/light/i18n**: tablist semantics, aria-live/current/label, confirm xóa destructive, `advisory-page` light CSS, i18n batch-2 VI/EN parity.
- **Gates**: `check` 0, `makemigrations` clean, BE 35/35, vitest 10 files/41, tsc 0, lint 0, `check:shell` 0, build PASS.
- **OPEN P0 (backlog, chưa ship)**: `dnse_place_order_api` thiếu idempotency/throttle/audit/validate + leak raw exception; `PortfolioAICommandCenterAuditLogView` lộ cross-tenant (`AIAuditLog.objects.all()`).
- **Wave P2 S12-S15 DONE**. Order tiếp: P0 order-endpoint + audit isolation, hoặc visual QA light-mode VI/EN.
### Done (2026-09-25) — AI Advisory S14 alert + order ticket (Entry 215)
- **Tạo cảnh báo (G4)**: `AdvisoryAlertDialog` (prefill symbol/target từ `matched_value`, condition gợi ý theo side, user bấm gửi tay → `createPriceAlert` sẵn có) + success link `Xem cảnh báo` → `/alert-center?symbol=X`.
- **Deep-link ngược**: `AlertCard` thêm `Xem tư vấn` → `/ai-advisory?symbol=X&from=alert`; advisory page hiện back-link khi `?from=alert`.
- **Order ticket (G5)**: `AdvisoryOrderTicket` prefill symbol/side/giá tham chiếu + qty + 2-bước xác nhận + token không lưu + disclaimer; submit duy nhất ở nút xác nhận → `placeDNSEOrder`. Checklist giữ nguyên vai trò log (AC-3).
- **Gates**: BE không đổi; tsc 0, eslint 0 errors, vitest 49/49 (9 files), `check:shell` exit 0, i18n `aiAdvisory.alert/order` + `alertCenter.viewAdvisory` VI/EN. Order tiếp: S15 (cuối Wave P2).
### Done (2026-09-24) — Enterprise UI Consistency Audit — 3-agent full scan (Entry 213)
- **Scope**: Full `packages/web/src` — pages + components + layouts + SOC + admin + tenant + auth + workspace + dashboard. **Doc-only**, no code changed.
- **Method**: 3 parallel subagent scans (shared/SOC/layout | workspace/dashboard | admin/tenant/auth) + theme SSOT review.
- **Report**: `docs/DESIGN_TOKEN_AUDIT_20260924.md` (new) — 5 anti-pattern groups × ~122 findings; Executive Matrix ERR-01..ERR-65; 8 sample tickets w/ Current→Target diff + AC-1..AC-4; 5-Wave Rollout Plan.
- **Top findings**: A Typography ~35 (34px/28px/21px/15px off scale, text-[10px] in admin); B Color ~40 (hardcoded hex in inline style); C Spacing ~20 (off 8pt-grid); D Components ~15 (12 raw `<button>`, 5 radii in ShellPageTemplate); E Dark mode ~12 (**`:root` dark palette breaks `data-theme="light"`**).
- **Wave 1 priority**: `:root` dual-theme fix in `aiSettings.module.css` + `ShellPageTemplate.module.css` + `soc/tokens.css` — systemic, affects all downstream components.
- **Supersedes**: `docs/UI_CONSISTENCY_AUDIT_20260924.md` (Entry 201, 86 files/20 ERR-IDs) — this scan is the comprehensive version.
- **Evidence**: `docs/DESIGN_TOKEN_AUDIT_20260924.md`.
- **Order tiếp**: F9 / F6b (blocked proxy) / manual E2E §3.3 / Wave 1 implementation. A–E+G+F(subset)+F3+F-C6+F7+F8+DONE (211); B2 backlog DONE (212).
### Done (2026-09-24) — Audit 4-bước B2 complete + B4 handover (Entry 212)
- **B2** `docs/BACKLOG_AUDIT_CONSOLIDATED_20260924.md`: finish cut BL-14 + **BL-15→BL-24 + BL-17b**
  (JSON log, coverage, MFA/rotation, DR drill, warnings, tracing, headers, P3 conditional, product);
  phân bố P0 11 / P1 6+1 / P2 3 / P3 4 = **24 ID**. Fix 3 phụ thuộc ngược vs DAG (BL-02/03/05).
- **B4**: `docs/evidence/audit-bl/README.md` + tick tổng §8 plan (standing procedure 6 ô implementer
  giữ unchecked); summary ledger row 198 + **Entry 212**. Phản biện: row198 "P1 7" ≠ 6+1 — đã ghi chú.
- **Files**: backlog (211 dòng), plan 79→tick, evidence dir. Doc-only. Order tiếp: W1 BL-06/07/08/09/10
  + khởi động BL-01/04 theo plan §2.
### Done (2026-09-24) — AI CC Slice F8 shell form extract (Entry 211)
- **Extract** `AICommandCenterForm.tsx` shared: 8-field checklist `AI_CC_FORM_FIELD_TESTIDS`
  (provider/model/custom-model/endpoint/api-key/max-tokens/refresh/temperature) +
  load/save/test/clear-key + prompt-config drawer. Props `t`/`localeTag` override,
  transport injection, `showRefreshButton`/`showPromptConfigButton`.
- **SaaS** `AICommandCenterPage` → form + `adapterTransport` (coreApiAdapter);
  overview/policy/quota/system-prompt/history/audit/event-gate stay page-level;
  page banners own display when `onError`/`onNotice` provided.
- **Shell** `ShellAiCommandCenterPage` → drops local form; imports form + `shellT`
  (`createTranslator("vi")`); `fetchImpl` transport `/core/v1/workspace/ai-command-center/`;
  `showRefreshButton=false`, `showPromptConfigButton=false`.
- **Test** `ai-cc-form-parity.component.test.ts` (F-AC8): checklist export + full render
  + source-contract (both pages import form; shell no `handleSaveSettings`).
  Red pre-fix: 3 fail (duplicate banner ×2 + wrong `__dirname`) → fixed
  (form local banner gated `!onNotice`/`!onError`; parity root `../..`).
- **Gates**: tsc 0, build PASS 32.88s, eslint 0 errors (19 shell `jsx-no-literals` warn),
  vitest **3 files/17 PASS**, i18n:scan 0 (pollution 0), hardcode 0, check:shell 0.
  Evidence `docs/evidence/ai-cc/F8/gates.md`.
- **Order tiếp**: F9 / F6b (blocked proxy) / manual E2E §3.3. A–E+G+F(subset)+F3+F-C6+F7+F8 DONE (211).
### Done (2026-09-24) — AI CC Slice F7 prompt config history + rollback (Entry 210)
- **BE**: `UserAICredential.prompt_config_history` JSONField (migration **0009**) +
  `_append_prompt_config_history` (cap **20**). PUT detects `ai_prompt_config` change →
  append `{version, config, saved_at, source:save}`; GET/PUT response += `ai_prompt_config_history`
  (full config = F-AC7 GET old). **POST** `…/prompt-config/rollback/` `{version}` → restore +
  `source=rollback` + `AIAuditLog`.
- **FE**: `rollbackAICommandCenterPromptConfig`; `AICommandCenterPage` ShellPanel history list
  + Restore (`prompt-history-list` / `prompt-history-restore-N`); i18n `promptHistory*` ×8 VI+EN;
  contract smoke += `ai_prompt_config_history`.
- **Tests**: new `test_ai_cc_prompt_history.py` 7 (append/no-dup/GET old/rollback/cap/400/isolation);
  regression isolation+mgmt → **45 OK**.
- **Gates**: check 0, makemigrations clean, tsc 0, build PASS 20.11s, eslint 0,
  vitest 2 files/14 PASS, i18n:scan 0, hardcode 0, check:shell 0.
  Evidence `docs/evidence/ai-cc/F7/gates.md`.
- **Order tiếp**: F8 / F9 / F6b (blocked proxy) / manual E2E §3.3. A–E+G+F(subset)+F3+F-C6+F7 DONE (210).
### Done (2026-09-24) — AI CC Slice F3 budget soft/hard (Entry 209)
- **BE**: `_resolve_advisory_token_budget` (user `max_tokens_per_day` → system `ADVISORY_TOKEN_BUDGET`) +
  `_advisory_budget_state` (soft 80% / hard 100% / source / remaining / pct). `AdvisoryRefreshView`
  hard → 429 `budget_hard_exceeded` + `budget_source`; soft → 201 `budget_soft_warning` + `budget{}`;
  audit metadata += budget fields.
- **FE**: refresh response `budget_soft_warning`+`budget` → `advisoryFallbackFlags` →
  `AIAdvisoryWarningBanner` soft warning (amber/red); banner `localeTag` date (bỏ `vi-VN` hardcode).
- **i18n**: `aiAdvisoryWarning.budgetSoftWarning` VI+EN (count=2).
- **Tests**: new `test_advisory_budget.py` 8; regression budget+routes+mgmt **46 OK**.
- **Gates**: check 0, makemigrations clean, tsc 0, build PASS 28.09s, eslint 0 err,
  vitest 3 files/16 PASS, i18n:scan 0, hardcode 0. Evidence `docs/evidence/ai-cc/F3/gates.md`.
- **Order tiếp**: F7 / F8 / F6b (blocked proxy) / manual E2E §3.3. A–E+G+F(subset)+F3+F-C6 DONE (209).
### Done (2026-09-24) — AI CC F-C6 polish (Entry 208)
- **F-C6 CLOSED**: bỏ 74× `t("aiCommandCenter.*") || "VI fallback"` (CC page 72 + Agents/Usage back-link 1+1).
  i18next `t()` trả key truthy khi miss → `||` dead code, không catch missing key.
- **Bonus**: `AICommandCenterPage` `toLocaleDateString("vi-VN")` → `localeTag` (E polish).
- **Grep**: 0 `t("aiCommandCenter.*")||` trong 3 files; 0 hardcode `vi-VN` date trong CC page.
- **Gates**: tsc 0, build PASS 49.73s, eslint 0, vitest **5 files/26 PASS**, i18n:scan 0, hardcode 0.
  Evidence `docs/evidence/ai-cc/F-C6/gates.md`.
- **Order tiếp**: manual E2E §3.3 / F6b (blocked `GEMINI_API_KEY`) / F3–F9 backlog. A–E+G+F+F-C6 DONE (208).
### Done (2026-09-24) — AI CC Slice F competitive upgrade F1/F2/F4/F5/F6 subset (Entry 207)
- **F1**: `AIUsageDashboard` recharts BarChart từ `getAIUsageSummary` (real API, `buildChartData` aggregate `total_tokens_in` theo date); empty state `chartEmpty`; `.chartWrap` CSS.
- **F2**: filter model/status FE (`usage-filters`/`filter-model`/`filter-status`) + BE `ai_analytics/views.py` `?model=&status=`; export CSV truyền filter; tests BE 3 + FE filter-params.
- **F4**: BE `ai_api_key_masked` (`••••••••last4`, decrypt fallback) GET/PUT; `ai_api_key` vẫn `''`; FE mask row + `clear-api-key` (guard local/openclaw giữ pre-existing test); F-AC4 no full key in DOM.
- **F5**: BE `system_prompt_template` GET/PUT; FE read-only panel `system-prompt-template` / empty.
- **F6**: `providerModels.ts` += gpt-4.1/4.1-mini/o3/o3-mini, gemini-2.5-pro/flash, claude-opus-4/sonnet-4 (F6a gemini-3.8-flash đã ship 204). Accent-color E-defer verified present `aiSettings.module.css:467,474,891`.
- **i18n**: +7 `aiCommandCenter.*` + +6 `aiUsageAnalytics.*` vi/en; parity + contract smoke (`ai_api_key_masked`, `system_prompt_template`) re-run PASS.
- **Defer/block**: F3/F7/F8/F9 backlog; **F6b blocked** proxy C2; F-C6 polish open; manual §3.3 screenshots PENDING.
- **Gates**: tsc 0, build PASS 18.80s, eslint 0, vitest **5 files/26 PASS**, i18n:scan 0, hardcode 0, placeholder 0, BE check 0, makemigrations clean, BE **42 tests OK**.
  Evidence `docs/evidence/ai-cc/F/gates.md`.
- **Order tiếp**: F6b (nếu có proxy) / manual E2E §3.3. A–E+G+F(subset) DONE (207).
### Done (2026-09-24) — AI CC Slice G hardening/CI (Entry 206)
- **G.1** `ai-cc-i18n-parity.component.test.ts` — vi/en key-set equal cho 3 ns
  `aiCommandCenter|aiAgentFederation|aiUsageAnalytics` (G-AC1).
- **G.2** `ai-cc-contract-smoke.component.test.ts` — fixture FE↔BE (CC GET/PUT/test,
  usage record/aggregate, agent fields) 6 assertions (G-AC2).
- **G.3** `check:shell` += `i18n:scan` (`package.json:12`).
- **Gates**: tsc 0, build PASS 30.34s, eslint 0, vitest **5 files/19 PASS** (G 2/10),
  i18n:scan 0, `check:shell` exit 0, hardcode 0, placeholder 0.
  Evidence `docs/evidence/ai-cc/G/gates.md`.
- **Order tiếp**: **F** (F6b blocked proxy C2) / manual E2E §3.3. E DONE (205), G DONE (206).
### Done (2026-09-24) — AI CC Slice E i18n hardcode (Entry 205)
- **E**: i18n 4 component AI CC (`AIUsageDashboard`/`AIAgentFederationPanel`/`AIAuditLogsPanel`/
  `AIAdvisoryPromptConfigDrawer`) → `t()` + `localeTag`; **bugfix** `thead` missing `null` props
  (headers never rendered children); test `AISliceE.i18n.component.test.js` EN locale 3/3
  (mock `ConfirmModal.js`); hardcode scan `TOTAL_HITS=0` via `scripts/slice-e-hardcode-scan.mjs`.
- **i18n**: +9 `aiCommandCenter.*` + `aiAgentFederation.yes|no` + `aiUsageAnalytics.prev|next|pageOf|perPage`
  (vi+en +32/file intentional). Defer accent-color/API-key mask → F; `ShellAiCommandCenterPage` out of scope.
- **Gates**: tsc 0, build PASS 19.30s, eslint 0 (touched+scan), vitest **3 files/9 PASS**, i18n:scan 0,
  hardcode 0, placeholder 0. Evidence `docs/evidence/ai-cc/E/gates.md`.
- **Order tiếp**: **G** → F. F6b blocked proxy C2. Manual VI/EN screenshots PENDING (user).
### Done (2026-09-24) — AI CC Slice B rest + F6a (Entry 204)
- **B rest**: hub nav 5 tabs (`#overview/#runtime/#audit` + route agents/usage), section anchors,
  back-link từ Agents/Usage → `/settings/ai`; +6 i18n keys `tab*`/`backToHub`; CSS `hubNav*`.
  Test wrap `MemoryRouter` (page dùng `useLocation`).
- **F6a**: FE `providerModels.ts` + `gemini-3.8-flash`; BE `ModelChoices.GEMINI_38_FLASH` +
  migration `0008` SystemAISettings only (C1); `requirements.txt` comment marker, **chưa** add
  `google-genai` (C5). **F6b** vẫn blocked proxy test C2.
- **Gates**: tsc 0, build PASS 52s, eslint 0, vitest 2 files/9 PASS, i18n:scan exit 0
  (0 placeholder `.js`; scanner ghi `.json` gitignored), BE check 0, makemigrations clean.
  Evidence `docs/evidence/ai-cc/B/gates.md`.
- **Order tiếp**: **E** (i18n hardcode + polish U-01…U-08) → G → F.
### Done (2026-09-24) — AI CC Plan Rev.3 F6a/F6b split (Entry 203)
- **F6 audit** `docs/AUDIT_F6_GEMINI_38_FLASH_20260924.md`: 5/5 conclusions CORRECT;
  **F6a APPROVED** (~0.5d, LOW risk); **F6b CONDITIONAL** trên proxy test C2
  (`v1beta/openai/chat/completions` model `gemini-3.8-flash` → 200 = F6b deferred).
- **C1**: `UserAICredential.ai_model` no choices → migration **chỉ** `SystemAISettings`
  AlterField (0008 dự kiến). **C5**: `google-genai` KHÔNG thêm ở F6a (comment marker OK).
  **C4**: param mapping explicit nếu F6b. **C3**: centralized `get_ai_client(provider)` factory.
- **Plan Rev.3**: `docs/IMPLEMENTATION_PLAN_AI_COMMAND_CENTER_SSAOT_20260924.md` §F6a/F6b
  + risk/milestone/file-inventory updates. Chưa implement code (doc-only).
- **Order tiếp**: B rest (nav hub/link) → E → G → F (F6a ship sớm OK song song; F6b blocked proxy).
- **G澄清 F-01**: isolation test path = `packages/core/backend/tests/test_ai_cc_config_isolation.py`
  (KHÔNG phải `advisory/tests/`). F-03: 69 BE tests Entry 202, chưa re-run đợt F6.
### Done (2026-09-24) — AI CC Slice C multi-tenant config plane (Entry 202)
- **C.1** `UserAICredential` +5 field (migration `0007`): `temperature`/
  `max_tokens_per_day`/`refresh_interval_hours`/`max_auto_refreshes_per_day`
  (nullable=system default, lazy no-backfill) + `prompt_config` JSON.
- **GET** prefer user field → fallback system metadata/config.
- **PUT chỉ** ghi `UserAICredential`; **bỏ** write `SystemAISettings.temperature`/
  `max_tokens`/`metadata`/`ai_model` từ payload (multi-tenant leak đã đóng).
- **Sanitize fix**: `'token' in key` mask nhầm `advisory_max_tokens_per_day` →
  precise pattern + exclude `max_token*`/`tokens_per*`.
- **Gates**: check 0, makemigrations clean, isolation **8/8**, regression
  management+audit **53/53**, advisory **8/8** = 69 OK. C-AC1…7 PASS.
  Evidence `docs/evidence/ai-cc/C/gates.md`.
- **Order tiếp**: B rest (nav hub/link) → E → G → F.
### Done (2026-09-24) — AI CC Slice B.4 i18n namespace (Entry 201)
- **B.4**: migrate call sites `usage.*`→`aiUsageAnalytics.*` (Dashboard+test) +
  `agentFederation.*`→`aiAgentFederation.*` (Panel; mapping loadError/confirmDelete/
  type/active/empty/edit/delete→errorLoad/deleteConfirm/agentType/isActive/noAgents/
  editAgent/deleteAgent); +6 keys target ns (vi+en); old blocks giữ + DEPRECATED
  comment (F-C7 defer 1 sprint). Grep `t("usage.`/`t("agentFederation.`/`agentFederation.`
  in `packages/web/src` = **0**.
- **Gates**: tsc 0, vitest AIUsageDashboard **3/3**, i18n:scan exit 0.
  Evidence `docs/evidence/ai-cc/B4/gates.md` (B-AC4/B-AC5 PASS).
- **Order tiếp**: ~~B.4~~ DONE (201) → ~~C~~ DONE (202) → **B rest** (nav hub/link) → E → G → F.
### Done (2026-09-24) — AI CC Slice D security (Entry 200)
- **D1** `ai_analytics` bỏ `IsCoreOperator` → self-scope `filter(user=request.user)`
  (staff all + `user_id`); Summary/Aggregate cũng scoped (cả 2 model có `user` FK).
- **D2** `ai_agents` list scoped `created_by`; detail other→404; PATCH/DELETE other→403;
  model `UniqueConstraint(name, created_by)` + migration `0002_agent_name_per_creator`.
- **Latent bug**: `db_router._CORE_APPS` thiếu `ai_agents`/`ai_analytics` → mọi write
  RuntimeError (POST agent 500 prod). Đã thêm 2 app labels.
- **Gates**: `manage.py check` 0; `makemigrations --check` clean; BE tests
  **22/22 OK** (`ai_analytics.tests` 10 + `ai_agents.tests` 12); D-AC1…8 PASS.
  Evidence `docs/evidence/ai-cc/D/gates.md`.
- **Order tiếp**: ~~B.4 namespace~~ DONE (Entry 201) → **C** → B rest → E → G → F.
### Done (2026-09-24) — AI CC SSOT plan Rev.2 + Slice A (Entries 197–199)
- **Plan** `docs/IMPLEMENTATION_PLAN_AI_COMMAND_CENTER_SSAOT_20260924.md` Rev.2
  (approve; audit F-C1–F-C5 map). Slice A DONE (Entry 198): i18n 3 keys
  `aiCommandCenter.eyebrow|overview|fallbackReset`, policy sync sau save, quota `?? 0`,
  test TRANSLATIONS 6/6. Evidence `docs/evidence/ai-cc/A/gates.md`.
- **OPEN security (không ship)**: F-C2 namespace `usage.*`/`agentFederation.*` còn call sites;
  F-C3 `IsCoreOperator` `ai_analytics:14,64,86`; F-C4 agent ownership PATCH/DELETE;
  F-C5 `UserAICredential` thiếu 5 field (Slice C). **Order: D → B.4 → C → …**
- Audit: `docs/AUDIT_AI_COMMAND_CENTER_SSOT_20260924.md`.
### Done (2026-09-24) — Darkflow value fix 840x Option A (Entry 194)
- **Root cause**: `tasks.py` dark branch `volume = sum(buy_count)` (số đếm tick) vào
  `volume_at_signal` (ngữ nghĩa cổ phiếu) → materializer `price × volume` = 2.1M
  thay vì `buy_value` 1.767B (DGW: 45700×46, chứng minh số học).
- **Fix**: engine thêm `buy_volume`/window; tasks dùng buy VWAP + tổng shares
  (đồng nhất 2 nhánh whale); test mới T-F1/T-F2 (pre-fix FAIL `10 != 10000` đã verify).
- **Recompute 1 lần (Entry 195)**: `recompute_dark_flow_values` (windows/ticks/estimate,
  idempotent, dry-run) + materialize sync; test T-F3a/T-F3b. Gates 22 OK.
  Chạy live: `docker exec core-api python src/manage.py recompute_dark_flow_values --dry-run` trước.
- **Còn lại (không làm)**: `whale_engine.py` chết (0 caller, sai contract).
- **Gates**: BE 22 tests OK, `manage.py check` 0 (trong test run).
### Done (2026-09-24) — Phản biện độc lập session 24/09 (Entry 193)
- Audit 9 commits Entries 182–192: claims đúng substance; 12 contradictions wording
  (script path `packages/web/`, số đếm động, EN options hardcode PATs/SA,
  `localeTag` thiếu 3 trang, ledger header-vs-row, trùng số 186, 9 commits,
  7+1 toneClasses, prefix Admin, 32 keys, contrast chưa đo, gates nặng chưa re-run).
- Gates re-run: tsc 0, check-admin-spa-routes PASS 14/11. Fix đề xuất F-A..F-F.
  Evidence `docs/PHAN_BIEN_SESSION_20260924.md`.
### Done (2026-09-24) — Admin UI Slice 5 F5-full core i18n (Entry 192)
- **F5-full**: i18n toàn bộ 8 trang AdminCore* (~290 keys vi/en: 5 namespaces mới
  `adminCore{Billing,Usage,Overview,Jobs,AuditTrace}` + mở rộng `adminCoreTenants`);
  parity script 0 lệch (phát hiện + bù 4 keys VI thiếu pre-existing);
  `heroEyebrow`/`snapshotAt`/`common.noPermission` dùng chung;
  `kindLabel`/`toLocaleString` theo locale; poll Overview guard `document.hidden`.
- **Fix kèm**: 7 lỗi `exhaustive-deps` (`t` vào dep arrays — đổi ngôn ngữ refetch đúng).
- **Gates**: tsc 0, build 34s PASS, check:shell PASS, eslint 0 err, vitest 9 files/26 tests.
### Done (2026-09-24) — Admin UI Slice 4 F7 cleanup (Entry 191)
- Xoá `.Mui*` chết trong `TenantAdminLayout` (0 JSX usage, 0 dep); crawl cards responsive
  (`h-auto min-h-[380px] lg:h-[500px]`); xoá dead key `advertising.tabs.reports` vi/en.
- **Còn lại**: F5-full — ~120 chuỗi VI hardcode trong 8 trang AdminCore* (chỉ 1 namespace
  `adminCoreTenants` tồn tại) → slice riêng.
- **Gates**: tsc 0, build 42s PASS, check:shell PASS, vitest tenant+staff 4/22.
### Done (2026-09-24) — Admin UI Slice 3 F4+F6 shared kit (Entry 190)
- **F4**: `pages/admin/adminUi.tsx` mới (Header/Panel/MetricCard/ValueRow/EmptyState);
  migrate 12 trang fleet+core, xoá locals trùng (`Panel`/`MetricCard`/`ValueRow`/`KeyValue`);
  MetricCard dual-props (`card` object + flat) nên call sites giữ nguyên.
  Ngoại lệ có chủ ý: SOC glass, crawl gray, advertising violet, tenant shell.
- **F6**: xoá dup keys `vi.js`/`en.js` (`adminAudit×2`, `adminAnalytics×2`, `adminUsage×2`).
- **Gates**: tsc 0, build 24s PASS, check:shell PASS, eslint 0 err, vitest admin 6/15.
### Done (2026-09-24) — Admin UI Slice 2 F3+F5 i18n + honest states (Entry 189)
- **F3**: xoá mock jobs/runs bịa sẵn ở crawl (API rỗng/lỗi → empty/error state trung thực + nút
  Thử lại); poll 5s guard `document.hidden`; bỏ `console.error` + emoji empty-state.
- **F5**: `adminCrawl` 30 keys vi/en (title khớp menu `Kiểm soát cào dữ liệu`, time theo `localeTag`);
  eyebrows 4 trang fleet chuyển EN hardcode → `t()` VI.
- **Còn lại (chưa làm)**: F4 bộ Admin UI chung, F6/F7 dọn (dup keys, Mui chết, v.v.).
- **Gates**: tsc 0, build 33s PASS, check:shell PASS, eslint 0 err, vitest 5 files/20 tests,
  i18n:scan sạch (không chêm key lạ).
### Done (2026-09-24) — Admin UI Slice 1 F1+F2 readability (Entry 188)
- **F1**: `pages/admin/adminTone.ts` shared (union keywords cả 8 files incl. `pending_approval`,
  light+`dark:` pairs, contrast pills 1.3→4.5+); xoá 8 `toneClasses` local + `kindTone` Jobs;
  crawl H1 `text-slate-100`→`slate-950/dark:white`. Vitest admin 6 files/15 tests PASS.
- **F2**: `@custom-variant dark` trong `index.css` bind theo `data-theme` (bỏ OS
  prefers-color-scheme) — verify trong dist CSS (`:root:not([data-theme=light])`).
  Behavior change: OS-sáng mặc định thấy dark (đồng nhất shell) trừ khi user đã chọn light.
- **Còn lại (chưa làm)**: F3 mock data crawl, F4 bộ Admin UI chung, F5 i18n pass, F6/F7 dọn.
- **Gates**: tsc 0, build 56s PASS, check:shell PASS, eslint 0 err.
### Done (2026-09-24) — Admin fleet 404 fix nginx (Entry 187, Option B)
- **Root cause**: `packages/web/docker/nginx.conf` `location ^~ /admin/` proxy toàn bộ `/admin/*`
  (trừ `/admin/core/`) sang Django → 14 SPA routes R0–R8 404 `catch_all_view` (staff) / 302 login
  (anonymous). Reproduce: curl `/admin/users` → 302 `Log in | VNInvest Admin`.
- **Fix**: whitelist 10 prefix `^~` (users/tenants/billing/usage/audit/audit-trace/analytics/overview/
  jobs/advertising) trước block generic, pattern `try_files /index.html` như `/admin/core/`.
  Không đụng BE; Django admin (`/admin/login/`…) giữ nguyên.
- **Regression gate**: `scripts/check-admin-spa-routes.mjs` (14 catalog paths ↔ 11 SPA locations,
  nối vào `check:shell`) — đóng GAP test tầng routing triển khai.
- **Gates**: tsc 0, `check:shell` PASS, rebuild frontend image + `up -d`, curl live 14/14 SPA 200,
  `/admin/login/` vẫn Django 200. Visual QA staff login PENDING (user).
### Done (2026-09-24) — Tenant Admin R0–R8 + H0 hotfix + audit fixes (Entry 182/184/186)
- **R0–R7**: StaffRoute/TenantRoute, 9 routes + 8 catalog + menu Tenant/Billing/Usage/Audit,
  3 fleet pages, banner xem hộ, tenants paginate, billing/usage/audit endpoints,
  staff-switch, hardening. Gates: tsc 0, build PASS, lint 0 err, vitest R 26/26,
  BE 22/22, check 0. Evidence `docs/evidence/tenant-admin-refactor/gates.md`.
- **H0**: switch strip-staff (SOC 403), crawl StaffRoute, invite blacklist owner, dead links 0.
- **R8**: analytics growth/cohorts/alerts + export CSV 3 endpoints + `/admin/analytics`.
- **Audit fixes (Conditional Approve)**: superuser switch strip + test 403;
  conversion Invoice-paid distinct + overlap test; billing CSV [:5000];
  export filters đủ (billing +plan, audit +from/to); accept chặn invite owner cũ;
  C5 REJECTED (frontend/ legacy không ship).
- **Gates cuối**: tsc 0, build PASS, lint 0 err, vitest 36/36 R-slices,
  BE switch 9 + invite 3 + analytics 7 + billing/audit/usage, check 0, i18n:scan 0.
  Evidence `docs/evidence/tenant-admin-refactor/h0-r8.md`.
### Done (2026-09-24) — Dashboard Audit Fix S0–S6 (Entry 152 + S6 refinement 185)
- **Slices**: S0 route+STALE + S1 formatMarket/symbol/title/sign/date + S2 filter `.seg`/card `p-3` + S3 heatmap ±7%/gating/legend + S4 grid/clamp/scroll + S5 breadth/AI-empty/header OUT-OF-SCOPE.
- **Tests S6**: `formatMarket` 17 + `alert-card-compact` 10 (flex:none/height/filter) + `heatmap-scale` 14 (clamp/textOn/gating 44×28/56×40) + `AIAdvisor i18n` title `Tín hiệu AI`/`AI signals` (3/3) + `breadth-dedup` 5/5.
- **Gates**: tsc 0, build 28.90s PASS, lint 0 err (3853 warn), i18n:scan 0 + rg 0, vitest dashboard 25/25 (S6 46/46), jest 17/17 239/239, check:shell PASS (allowlist +4). Evidence `docs/evidence/dashboard-fix/s6-gates.md`.
### Done (2026-09-23) — Main menu thu gọn sát code (Entry 166)
- **Menu đích**: 5 nhóm / 13 mục + 1 flag — Thị trường (Tổng quan/Radar/Screener), Tài sản (Sổ giao dịch/Danh mục),
  Tín hiệu & AI (Trung tâm cảnh báo/AI Advisory/Trung tâm AI), Tài khoản (Nâng cấp/Hỗ trợ/Cài đặt),
  Quản trị staff-only (SOC/Kiểm soát cào/Thành viên/Quảng cáo).
- **Hết trùng**: group≠item (Thị trường/Tài sản/Sổ giao dịch), xóa mục Whale Alerts (`/whale-alerts`→`/alert-center`
  redirect giữ query/hash; `/ai-command-center`→`/settings/ai`), `UserConfig`→`Cài đặt/Settings`, BE nav + routeCatalog
  đồng bộ (whale deprecated, +16 entries tenant-admin external), xóa 3 file `(1).tsx` stale.
- **Gates**: tsc 0, lint 0 errors, build 27.39s PASS, vitest 63/382, jest 17/239, BE capabilities 5/5, i18n:scan 0,
  test menu mới 6/6. `check:shell` FAIL pre-existing (tokens `UserSettingsPage.css`, file ngoài change).
  Visual QA TC-01..07 PENDING. Plan + evidence: `docs/IMPLEMENTATION_PLAN_MAIN_MENU_20260922.md`,
  `docs/evidence/main-menu-20260922/`.
- **HOTFIX Entry 167**: admin mất menu Quản trị — `UserProfileView` thiếu `is_staff/is_superuser` nên
  `syncAuthState` luôn map `isStaff=false`, filter staffOnly ẩn nhóm với cả staff thật (lỗi contract latent
  từ trước, S2 làm lộ ra; `SupportPage` staff actions cũng dính). Fix BE GET+PATCH, FE giữ nguyên.
  BE 7/7 OK, commit `a0283215` pushed, dev rebuild healthy. User chỉ cần reload trang.
### Done (2026-09-21) — QueueRecovery A–H + corrective v1–v4 (Entry 138-145)
- **Root cause chốt**: queue `realtime_prefetch` ngập 77k (heartbeat 3s + shard fan-out + giant warm 1900 symbols
  trên worker solo) + worker enrichment OOM cuối tuần → session_facts chết từ 09/09, snapshot dừng 17/09,
  backfill EOD fail 3 ngày PENDING. Plan: `docs/IMPLEMENTATION_PLAN_REALTIME_QUEUE_RECOVERY_20260921.md` (Rev.2
  sau audit/phản biện — 10/10 claim verify đúng).
- **A (OPS)**: purge 77k (có backup), re-enable snapshot, bù session-facts 17/18/21 → 20→515 rows.
- **B**: `expire_seconds` 3 beat entries + reconcile sync (DB column sẵn có) + dedup-guard cache + time-limit 45/60s.
- **C**: warm chunk-30 + self-continuation (countdown 30s) + timeout 8s + circuit breaker skip-24h + coverage
  rotation + beat path hot-only + session-facts refresh coverage.
- **D**: queue `realtime_scheduler` + worker mới; price-board/snapshot batch chậm → `manual_on_demand` (manual ×2).
- **E (PA1)**: queue `enrichment_eod` + worker riêng cho daily-backfill; enrichment mem 1g + max-tasks-per-child.
- **F**: snapshot vào CRITICAL_JOBS (2 file sync) + bỏ mass-stale 2 chỗ + bulk rewrite (7 phút → ~1 phút).
- **G**: `queue_depths` vào observability + SSE signature + SOC Monitor card + i18n + monitor 7 queue.
- **Corrective live-measured** (load test giả lập phiên, drain 1.1/phút vs arrival 100/phút lúc đầu):
  session-gate ngoài phiên, shard timeout 5s, prefetch prefork ×5, pacing hot 20s + tắt warm/cold prefetch,
  hydrate tách flag + cap, price-board 180s + snapshot 300s + warm-beat 600s (reconcile sync interval số).
- **DoD live**: LLEN prefetch 0/0/0/0 (15 phút, 201 completions), scheduler 0; SessionFacts 568 rows;
  snapshot 21/09 = 781 rows; coverage price_board 0→114 fresh+343 warm; observability API đủ 9 queue;
  FE bundle deployed có UI mới. Gates: BE sweep 112 OK, `test_soc_tasks` 38/38 local, tsc 0, build 40s PASS,
  lint 0, jest 94/94, vitest 2/2, i18n:scan 0.
- **Còn follow-up (ngoài phiên, trung thực)**: EOD 5 phiên success, snapshot 3 phiên, OOM 14 ngày,
  celery queue commercial (đang tự drain), Decimal skip quirk, planner-task 400s thỉnh thoảng.
- **Key Decisions & Metrics (bổ sung)**: queues mới `realtime_scheduler`/`enrichment_eod` (9 queues);
  worker mới `realtime-scheduler` (256m) + `enrichment-eod` (1g); prefetch prefork ×5; manual ×2;
  dev pacing: hot shard 20s, warm/cold prefetch OFF, hydrate hot 10m/warm hourly top-90.

### Done
- Gap analysis hoàn chỉnh: Legacy DataOpsPanel.jsx vs packages/web SOC components. ~45-50% parity overall, ~20 feature gaps. Lưu tại docs/GAP_ANALYSIS_DATAOPS_LEGACY_VS_SAAS_NATIVE.md.
- Consolidated implementation plan: docs/IMPLEMENTATION_PLAN_SOC_DATAOPS_FINAL_20260625.md.
- Step 0: Backend contract verification — dataset map confirmed (5 keys), inventory response shape fixed.
- Step 1: i18n keys audit + create — 34 keys + 5 subtab nested keys trong vi.js + en.js. Verified resolve.
- Step 2a–2d: Inventory section rewrite — SocDataInventorySection.tsx — dynamic data types grid, coverage by group table (6 columns, color-coded ratio), queue tiers accordion, year distribution bar chart.
- Step 3a–3c: Operations section rewrite — SocDataOpsBackfillForm.tsx — dataset checkboxes, VN100+CUSTOM groups, Preview+Run flow với Planner Console, Run Logs, inline error/success. tsc + build pass.
- Documented full chart refactor analysis: docs/CHART_REFACTOR_ANALYSIS_20260625.md.
- **Migration to vninvestcharts-widget (npm)**: Xoá local component tree `packages/web/src/components/vninvestcharts/` (+ `packages/vn-kline-engine-core/`, `packages/vn-kline-engine-react/`) — 745 files, -102k lines. Import chuyển sang `vninvestcharts-widget` ^1.2.5. Path aliases trong tsconfig + vite.config dọn dẹp. WatchlistDetailPanel sửa props `hideX` → `showX`.
- **Priority 2 (renderSeries registry)**: Hoàn thành trong commit `3df5ff6c`. DynamicChart renderSeries() chuyển 40 case switch → SeriesRendererRegistry dispatcher, tách ~200 dòng.
- **Priority 1 & 3**: Obsolete — local VNInvestCharts.js và contract tests đã bị xoá cùng component tree.

### Done (2026-07-17)
- **React 19 peer-dep TDZ fix**: `vninvestcharts-widget` ^1.2.5 declares `peerDependencies: react ^19.0.0` nhưng app là React 18.3.1. Static import trong `VNStockChartPanel.js` gây TDZ `Cannot access 'N' before initialization` lúc load `StockDetailPage`. Quyết định ban đầu: lazy-load widget qua dynamic `import()` trong `useEffect` (Option B) để giữ React 18 — vì sợ recharts v2 peer-dep không hỗ trợ React 19. Tuy nhiên, `recharts@2.15.4` đã chính thức hỗ trợ `^19.0.0`. **Đã upgrade lên React 19**: `react@19.2.7`, `react-dom@19.2.7`, `@types/react@19.2.17`, `@types/react-dom@19.2.3`. `react-test-renderer` removed, `AuthPages.test.js` rewritten to RTL. Widget vẫn lazy-load as async chunk. tsc + build pass.
- **SOC DataOps gap analysis — ALL 20 gaps CLOSED**: P0 #1–5, P1 #6–11, P2 #12–16, P3 #17–20 đều đã implement (Inventory/Operations/Monitor/Config sections). `docs/GAP_ANALYSIS_DATAOPS_LEGACY_VS_SAAS_NATIVE.md` đã stale → đánh dấu hoàn thành.

### Done (2026-09-15) — XÓA NỢ BE 19 TEST PRE-EXISTING (Entry 91) — service_ops 17 + market_serving 2
- **Toàn bộ backlog BE đỏ đã XÓA**: `service_ops` 290 tests + `market_serving` 11 tests → `Ran 301 OK (skipped=1)` (trước 17F+2E service_ops + 2F market_serving). 8 nhóm fix:
  1. OpenAPI `security` SessionAuth → `[CorePATBearer, cookieAuth]` (7 tests), 2. BackfillRunNow patch `BackfillService` + symbols upper, 3. Abort `SIGKILL`, 4. Cache bleed `scheduler:inflight` delete, 5. DataOps `service_key` matrix→dataops + revoke patch `dataops_planner`, 6. vnbroker batch `fetch_price_board_snapshots_batch` + `symbols_by_exchange` fallback, 7. Scheduler recovery `post_recovery_cooldown` (400s/1200s, dispatched 0), 8. CVD `SessionFactsCvdView` 404→200 empty (`_build_empty_cvd_payload` + `_source no-data`) + URL slash fix.
- **Verified**: `manage.py check` 0, `npx tsc --noEmit` 0, gộp 301 tests PASS. Ledger Entry 91.
- **Còn COMPAT-002**: đã ĐÓNG trước hạn (2026-11-30) — `legacy_views.py` đã xoá, relocate vào `native_views`. Toàn bộ COMPAT (001+002) đã đóng.

### Done (2026-09-15) — COMPAT-002 DONE (Entry 90) — xoá legacy_views.py
- **Relocate toàn bộ**: 3 class `RealtimeUnifiedAlertsView` / `RealtimeWhaleFeedAggregateView` / `RealtimeWhaleCampaignsView` (1317 dòng) từ `legacy_views.py` → `market_serving/native_views.py` (1531 dòng, 13 class). Xoá `legacy_views.py`. Import gộp + bỏ `User`/`default_groups` dead.
- **Verified**: ast.parse OK, `manage.py check` 0 issues, grep sạch (không còn import legacy), market_serving `Ran 11 tests OK` (đã fix 2 SessionFacts CVD 404→200 ở Entry 91).
- **Cả 2 ticket COMPAT đã ĐÓNG trước hạn**: COMPAT-001 (2026-10-15) + COMPAT-002 (2026-11-30). Ledger Entry 89 + 90.

### Done (2026-09-15) — COMPAT-001 DONE (Entry 89)
- **Cutover route**: `market_serving/urls.py` bỏ import `legacy_views`; `realtime/whale-feed-aggregate/<symbol>/` → `native_views.RealtimeWhaleFeedAggregateView` (re-export, name mới `realtime-whale-feed-aggregate`, namespace `market_serving`). Contract giữ nguyên — view vốn đọc core signal tables (`WhaleAlertCanonical`).
- **FE adapter switch**: `coreAdapter.js getWhaleAnalyticsSnapshotEndpoint` → native `/workspace/whale-analytics/{symbol}/` (path cũ `/whale-feed-aggregate/` 404 không tồn tại).
- **Tests**: BE `RealtimeWhaleFeedAggregateCompatTest` 3 tests PASS (reverse namespaced + contract + empty); FE +1 jest test; gates xanh (tsc 0, build 1m4s PASS, lint 0 errors, jest adapter 52/52, vitest 30/130). 2 lỗi market_serving SessionFacts + 17 lỗi service_ops pre-existing (reproduce HEAD sạch).
- **Còn lại**: COMPAT-002 (sunset 2026-11-30) — relocate body class vào native_views.py + xoá legacy_views.py. Ledger Entry 89.

### Done (2026-09-15) — Phase 3 SOC Commercial HOÀN TẤT (Entry 88)
- **Step 1 CSS split**: `soc.module.css` 2405 dòng → `soc.tokens.css` (43) + `soc.components.css` (2715) + module re-export 3 dòng `@import`. Build verified (class băm + token resolve).
- **Step 2 SLO Model**: `ServiceHealth` +`slo_target/uptime_30d/burn_rate_1h/error_budget_remaining` + `ServiceHealthCheckLog` model + migration `0012`.
- **Step 3 SLO Computation**: `_compute_service_slo()` (tasks.py:362) hook vào `health_check_all_services` ×2 nhánh + `SloOverviewView` + URL `overview/slo-overview/`. Deviation C1/C2: compute tại probe, view đọc cache.
- **Step 4 SLO Frontend**: `getSocSloOverview()` adapter + SLO badges trong `SocOverviewPanel` (uptime/burn-rate/budget, màu theo burn) + **Step 4c burn-rate sparkline 24h** trong `SocRuntimeKpiPanel` (bỏ stub "coming soon"): aggregation `recent_checks_24h` (TruncHour+Count, exclude maintenance/unknown, failed=unhealthy|degraded) tận dụng cùng endpoint; bar ratio theo giờ, màu green/yellow/red, loading/error+Retry/empty cold-start; CSS `.spark*`; i18n `soc.slo.spark_*`.
- **Step 5 Alerting**: `_upsert_service_health_alert()` generic SYSTEM alert (transition healthy→degraded/unhealthy, dedup `source_ref` + `SOC_ALERT_COOLDOWN_HOURS` 4h, recovery xoá alert) + `detail['last_alert']` + settings `SOC_ALERT_COOLDOWN_HOURS`/`SOC_SLO_TARGET`.
- **Step 6 Export CSV**: `SocExportConfigAuditsView`/`SocExportRunLogsView` (limit ≤5000, filter service_key) + adapter `exportSocConfigAudits/exportSocRunLogs` + FE buttons trong `SocDataOpsMonitorSection` (CSV blob client-side) + i18n `soc.export.*`.
- Quality gates: tsc 0, build 28.21s PASS, lint 0 errors (3547 warn pre-existing), jest 222 pass (1 suite FAIL pre-existing AIAdvisorAlertPanel), vitest 30 files/130 pass, BE service_ops 290 tests — 17 lỗi pre-existing giống hệt HEAD sạch (reproduce worktree, bằng chứng `docs/AUDIT_DANG_DO_VA_PHASE3_CONTINUATION_20260915.md`); test mới Phase 3 14 BE + 5 FE đều pass; migration `0012` check sạch.
- Ledger Entry 88. **Next**: COMPAT-001 (hạn 2026-10-15) → COMPAT-002.

### Done (2026-07-18)
- **Sprint 5 Steps 5.1–5.5 (Real SAML SSO backend)**: `SAMLService` class (AuthnRequest, Response parsing, metadata, connection test), `SSOLoginInitiateView`, `SSOCallbackView`, `SSOMetadataView`, `PartnerSSOTestConnectionView`, `PartnerSSOTestLoginView`. 41 tests pass. `lxml` added to requirements (not `python3-saml` — intentional trade-off, see plan deviation note).
- **Independent audit** (docs/AUDIT_SPRINT5_SAML_SSO_INDEPENDENT_REVIEW_20260718.md): 6 findings (F1–F6). F1 (P0→P1): signature verification stub → added `SAML_SIGNATURE_VERIFICATION_MODE` env var; F2 (P1): python3-saml deviation → plan updated; F6 (P3): AGENTS.md/ledger updated.
- **Step 5.6 (Frontend SSO test button)**: Added connection test button + test login flow button to `TenantAdminSSOPage.tsx`. Calls `POST /partner/sso/test/` and displays checks/errors inline.

### Done (2026-07-18) — Sprint 6: UX Improvements (partial)
- **Step 6.1**: `PortfolioContext.switchTenant` dispatches `tenant-changed` CustomEvent (no reload). Sidebar uses it without page reload.
- **Step 6.2**: Added `QueryProvider` (`providers/QueryProvider.tsx`) wrapping app in `main.tsx`. Created `useTenantAdminQuery`/`useTenantAdminMutation` hooks. Migrated 10/13 TenantAdmin pages to React Query: Security, SSO, Roles, Settings, Webhooks (full), plus Members/PATs/ServiceAccounts/Reports/UsageHistory (migrated Sprint 4/5). AuditLogs/Billing/Usage left with `coreGet` due to cursor-pagination / multi-endpoint complexity.
- **Step 6.3**: Loading skeletons present in migrated pages (ShellSkeleton).
- **Step 6.4**: `TenantAdminLayout.tsx` + `TenantAdminSidebar.tsx` converted from `createElement` to JSX.
- **Step 6.5**: Toast notifications on mutations in all migrated pages.
- Quality gate: `npx tsc --noEmit` PASS.
- **Sprint 6 follow-up (F1–F5 from AUDIT_SPRINT6)**: 
  - F1+F2 (P0 cross-tenant stale): `useTenantAdminQuery` scope mọi queryKey bằng `tenant_id` (localStorage) + `QueryProvider` listener `tenant-changed` → `invalidateTenantAdminQueries`. Đóng.
  - F3 (3 page chưa migrate): AuditLogsPage (cursor pagination + filters), BillingPage (Promise.all 3 endpoint), UsagePage (5 tab query) — đều migrate sang React Query. Tất cả 13/13 TenantAdmin page giờ dùng React Query cho GET data.
  - F4/F5 (skeleton + toast): Skeleton có trong mọi loading state; toast đồng nhất (success/error) trong mutation handlers.
  - `useTenantAdminQuery` mở rộng hỗ trợ `queryFn` custom (cho multi-endpoint). tsc PASS.

### Done (2026-09-14) — Đóng toàn bộ tồn đọng (audit W1–W10)
- **W4**: Merge `main`→`dev` (CORS dynamic + prod env example + test), push `origin/dev`. Hết diverge.
- **W1**: Fix treo bootstrap E2E — `PortfolioContext` bootstrap timeout 15s fail-open (fail-safe `authStateReady`), `auth.setup.ts` guard spinner, toàn bộ visual spec `networkidle`→`domcontentloaded`, fix `__dirname` ESM trong `screener-p0.spec.ts`. E2E chromium: **5 pass + 1 skip hợp lệ** (trước 1/4 pass).
- **W3**: Verify live email schedule — worker đã có code+ENV (không cần rebuild). Task thật matched 20/20 → mailpit nhận đúng subject/recipient (**PASS**, evidence `docs/evidence/screener-p2/w3-mailpit-live-verify.md`, đã dọn DB + mailpit).
- **W5**: Stash `temp-stash-before-merge-to-enterprise` (2026-07-10, 14 files) — cherry-pick 1 hunk còn giá trị (VnbrokerPanel option dark style), còn lại đã superseded (trademark→DB model, App routes→cleanup, AGENTS cũ). Đã drop.
- **W2**: Queue `screener` riêng + worker `core-worker-screener` (queue_policy domain mới, beat auto-route qua SCHEDULER_QUEUE_MAP). **Phát hiện + fix bug pre-existing**: `screener_tasks` chưa từng được autodiscover (beat gửi 5m/lần nhưng worker báo unregistered) — re-export trong `user_workspace/tasks.py`. Live proof: worker consume + `succeeded {schedules_due: 0}`. BE 17 tests OK.
- **W6**: Compat tickets — `COMPAT-001` (whale legacy→native, target 2026-10-15) + `COMPAT-002` (sunset, 2026-11-30) trong `compat/__init__.py` + `urls.py`.
- **W7**: Watchlist multi-portfolio — gộp holdings mọi portfolio (merge theo symbol, avg_cost bình quân gia quyền, recompute pnl%) + cộng dồn NAV. 5 tests mới pass, tsc xanh.
- **W8**: P3 — fix bug MFI (cộng dồn toàn history → đúng window-14) + 9 pins công thức; preset cộng đồng (`is_public` + migration 0016, catalog public tenant-scope, fork, share toggle, i18n VI/EN): BE 5 + FE 4 tests pass; `docs/SCREENER_METHODOLOGY_20260914.md` + disclaimer UI. Còn backlog có lý do: realtime intraday, đa khung, preset khối ngoại (xem methodology §5).
- **W9**: `npm run check:shell` trỏ lại gate thay thế (dom-landmarks + tokens + stock-detail-shell, PASS, exit 0); script cũ gắn DEPRECATED (`check:shell:legacy`). F-BE-06 cache guard (truncate top-500 + flags, 2 unit tests). E2E evidence mới trong `docs/evidence/screener-p{0,1}/`. Lighthouse chưa cài — để manual. F-BE-05 progress per-200 hoãn (cần hook trong compute loop, lợi ích thấp so với poll hiện tại).
- **W10 (entry này)**: AGENTS.md + README + ledger đồng bộ; fix C2 (ledger path `docs/`).
- Quality gates: FE `tsc` 0, `build` 52s PASS, eslint 0 errors, vitest screener+watchlist 12 files/56 pass; BE `user_workspace` 68 tests (67 pass + 1 pre-existing holdings `httpx.UnsupportedProtocol` đã ghi từ Entry 80).

### Done (2026-07-18) — Sprint 7: Quality Gates & Tests
- **7.1 Lint**: `npm run lint` (sửa script `--ext` → flat config). Exit 0. Sửa 1 error `react-hooks/exhaustive-deps` trong AuditLogsPage (wrap `logs` trong useMemo). Chỉ còn warnings (pre-existing).
- **7.2 Build**: `npm run build` (tsc + vite) exit 0. Chỉ chunk-size warning (pre-existing).
- **7.3 Test isolate cross-tenant**: `useTenantAdminQuery.component.test.ts` (3 tests) — verify queryKey scope theo `tenant_id`, không share cache giữa 2 tenant (no stale data), `invalidateTenantAdminQueries` chỉ invalidate scope đúng. PASS.
- **7.4 Component test**: `TenantAdminRolesPage.component.test.tsx` (2 tests) — skeleton khi loading, error state khi fetch fail. PASS.
- **7.5 Hook test**: coverage hook qua 7.3. 
- **Kết quả**: `vitest run` 6 files / 16 tests PASS (5 mới). Lint + build + tsc đều xanh. Sprint 6 DoD giờ đạt đầy đủ (A2/A3/A4 từ audit Sprint6 đã đóng).

### Done (2026-09-16) — Phase 1 P0 Fixes (COC audit)
- **Entry 84**: 4 P0 blocker COC — `SocScreenerPanel handleApplyConfig` (directConfig merge), `SocPrefetchPanel selectedGroups persist` (merge `universe_group_ids`), `ShellOperationsCenterPage+SocTabNavigation` tab router race + hyphen i18n, BE `SOC_HEALTH_ENDPOINTS`/`SOC_HEALTH_PROBE_TIMEOUT_SECONDS` env. tsc 0 + build 39.98s PASS.

### Done (2026-09-14) — Phase 2 P2 (P2-A1/A2/A3 + P2-B UX + R-NEW-3) — Entry 87
- **P2-A1 Overview** (`SocOverviewPanel`): COC-05 Retry button, COC-06 single reduce, COC-07 err.message, COC-08 maintenance filter+button, COC-09 domain search, COC-10 15s poll + backoff.
- **P2-A2 DataOps**: COC-18 `DataOpsContext.refreshRuns` → `getSocDataOpsRunLogs(1,20)`; COC-19 `SocDataOpsPanel` loading tổng; COC-20 scheduler health strip luôn hiển thị; COC-29 merge 2 useEffects.
- **P2-A3 Prefetch**: COC-37 preview gọi API thật (`previewSocPrefetchConfig`), COC-38 `warmSocPrefetchNow` gửi `{universe_group_ids}`, COC-39 bỏ 4 `alert()` → inline error/success. i18n `preview_failed`/`apply_success`.
- **R-NEW-3**: `socValidation.ts validateDateRange()` — dùng tại OperationsSection ×2 + DnseBackfillPanel ×1.
- **P2-B**: COC-21/22/23/24 skeleton+token+ratio+accordion a11y (Inventory), COC-32/33/34/35 skeleton+fail-rate dash+String()+empty state (Monitor), COC-31 dryRun hint, COC-44 scan_interval min 30→10, COC-45/61 drawer overlay, COC-04 tab bar flex, COC-03 tab description map, COC-16 sentiment bar `toFixed(1)%`, COC-17 `socStatusColor` shared, COC-46 throughput qua `getSocVnbrokerMetrics` + Error Rate card, COC-47 provider `is_active = enabled && runtime_ready` map đúng field backend.
- **Tests**: soc.test.js updated cho COC-38 body — 80/80 pass. tsc 0 + build 31.21s PASS. **Day-5**: lint 0 errors (2 exhaustive-deps section đã thêm eslint-disable theo convention), vitest 127 tests (mới `soc-p2.component.test.tsx`: Overview retry, Prefetch warm groups, validateDateRange), build 38.49s PASS. Ledger Entry 87. **Phase 2 P2 HOÀN TOÀN DONE** — còn Phase 3 commercial backlog riêng.

### Done (2026-09-16) — Signals P0 → P2c (P0/P1/P2a/P2b/P2c + audit fix F1) — Entry 99-110
- **P0 (W0.1-W0.4) Entry 100**: feed sống lại đúng số — envelope `recent` + `mapRecentItem`, stats từ `summary/`, error tách section, job poll theo `run_log_id`, `formatLastCheck`. Tests BE 4 + FE 10, tsc 0, vitest 32/152, build 32s.
- **P1 (W1.1-W1.5) Entry 102**: paging+filter (page/page_size 20/100, `total_filtered`), materialization progress, time/a11y, API chết 3 subtabs lazy, poll 15s + jitter + visibility. Tests BE 9 + FE 10, vitest 32/163, build 52s.
- **P2a (W2.4+W2.1+W2.5) Entry 104-106**: honest metrics (accuracy/FPR null, last_scan từ run log, whale-test smoke), poll-diff highlight cộng dồn + badge/title-blink, export CSV 5000 rows. Tests BE 3 + FE 4, vitest 32/166, build 26s. Audit độc lập Entry 105 PASS, fix F-P2A-A highlight cộng dồn Entry 106.
- **P2b (W2.2+W2.3) Entry 107-108**: triage deliveries ack/mute/seen (BE `signals_triage.py` + FE badge/checkbox/modal) + rule management bridge-write request + precision proxy (BE `signals_rules.py` 8 keys, FE Rules tab + feedback thumbs). Tests BE 12 + FE 9, vitest 32/175→33/33, jest 230, build 53s. Plan P2b DONE.
- **P2c (W2.1-long) Entry 109**: SSE realtime `GET /operator/soc/signals/stream/` (`retry:3000`, `:ping` 15s, `event:signal`, `Last-Event-ID`/`since`, token fallback, poll DB 3s, throttle `soc_stream` 60/min, idle 1h) + hook `useSignalStream` (EventSource + heartbeat 35s + backoff 1s→30s + `since` persist) + panel dot indicator + pause poll khi `open`. Tests BE 12→13 + hook 8 + panel stream 3, vitest 34/186, build 43s.
- **Audit fix P2c Entry 110**: F1 watchdog treo (HIGH) → `scheduleReconnect` trực tiếp, F3 `since` param, F4 throttle riêng, F5 idle, F2 token comment. BE 13 OK, hook 8/8, vitest 34/186, build 43s, tsc 0.
- **Validation tổng**: `manage.py check` 0, BE `service_ops` 56 OK (api 31 + stream 13 + triage 4 + rules 8), FE `vitest 34/186`, `jest 230`, `tsc 0`, `build PASS`. **Toàn bộ Signals P0/P1/P2a/P2b/P2c HOÀN TẤT** — đạt chuẩn thương mại Bloomberg/Datadog/Grafana (realtime, triage, rule, precision, feedback, SSE).

### Done (2026-09-16) — Overview P3 SSE health stream + Đóng Signals tag (Entry 111-112)
- **Signals đóng** (Entry 110 fix + tag): D1 doc fix `55→56` (AGENTS+ledger, commit `5d5fbbce`), D2 force-move tag **`soc-signals-v1.0` → `5d5fbbce`** (trước `ff44e840`), D3 leftover tests → backlog test-tech.
- **DataOps B (Entry 111, commit `d672dc41`)**: maintenance + build verification sau migration widget. Verified thật: grep `vninvestcharts` trong `src/components/soc/*DataOps*` **0 hit**, eslint 7 file DataOps **0 errors**, tsc 0, build PASS 46.79s, vitest soc-p2+overview 20/20, `jest soc.test.js` **90/90** (bao phủ DataOps adapter endpoints), `manage.py check` 0. Đính chính claim sai "vitest 34/186 bao phủ DataOps" trong Entry 111.
- **Overview P3 (Entry 112, commit `954a696e`) — SSE health stream (F-OV-14/15)**:
  - BE `overview_stream.py`: `OverviewStreamView` — snapshot diff status (signature không gồm `generated_at` → chỉ emit khi health đổi), `event: overview`, `:ping` 15s, idle 1h, `max_loops` test, `?token=` fallback, throttle `soc_stream` 60/min, poll DB 3s. Import `_sse_format`+`SOCStreamThrottle` từ `signals_stream.py` (no duplicate). Route `overview/stream/` + tests **9/9**.
  - FE `useOverviewStream.ts`: EventSource `event: overview` + onmessage fallback + backoff 1s→30s + watchdog 35s. `SocOverviewPanel.tsx`: `streamOpenRef` → interval chỉ fetchSlo khi open (không duplicate overview GET), `isDocVisible` → stream enabled, `onSnapshot` setData+clear error; status dot header (Live/Connecting/Reconnecting/Polling, reuse `soc.signals_overview.stream_*` keys). `soc.js` + `getSocOverviewStreamUrl()`.
  - Tests: vitest `soc-overview-stream.component.test.tsx` **2/2** (Live indicator + fallback Polling), `soc.test.js` **91/91** (+1), vitest soc **5 files/58/58**, BE** service_ops` 348 OK (skipped=1).
  - Gates: tsc 0, build PASS 33.32s, lint 0 errors (3549 warn pre-existing), `manage.py check` 0.
- **PR-1 + PR-2 Overview đã DONE từ trước** (docs `AUDIT_SOC_OVERVIEW_UI_UX_20260916.md`: PR-1 `d39f9fed` + PR-2 `25c26c96` merged) — không làm lại W1-W14. P3 backlog §8 còn: ETag/304, donut global HealthStatusView, export history CSV, dependency graph, maintenance scheduler; JSX migration hoãn (Đ3 audit).

### Done (2026-09-18) — DataOps Realtime Sync Fix — Slices A–F (Entry 115-118)
- **Thực thi** `docs/IMPLEMENTATION_PLAN_DATAOPS_REALTIME_SYNC_FIX_20260918.md` (Entry 117) từ audit Entry 115 + phản biện Entry 116. Sửa root cause **beat crash-loop = OOM** (`docker events` oom→die 137; `docker stats` 127.6/128MiB) trước triệu chứng.
- **A Beat**: `docker-compose.dev.yml` healthcheck `timeout 30→60s` + `start_period 60s`, `mem_limit 128m→${CORE_BEAT_MEM_LIMIT:-256m}` → `RestartCount=0` stable.
- **B Queue**: consumer `enrichment_offhours` còn **1** (bỏ khỏi `core-worker`, line 119); dedup `cache.add('scheduler:inflight:{job_key}',task_id,7200)` chỉ cho beat path (`tasks.py:1444-1455`) → operator `run_now` không bị chặn.
- **C Coverage F-COVER-01**: hook `_refresh_coverage_for_symbols(affected_symbols)` sau finalize `BackfillExecutionRun` (`tasks.py:1775`).
- **D Heartbeat**: `progress_callback` mỗi 50 symbols (`tasks.py:689`) → `F()` heartbeat (`tasks.py:1617-1640`); `core-worker-enrichment` `solo→prefork`; `except: pass`→`logger.exception`.
- **E Tz+bars C2/F-BAR-01**: `scheduler_catalog.py` `remaining_estimate(_now_local ICT)` → `next_run=2026-09-18T17:04:59+07:00`; coverage refresh cuối `synthesize_intraday_bars_from_ticks`.
- **F UI**: caption `latest_complete`/`awaiting_session_close` (17:05 ICT) + banner coverage <80% (`SocDataInventorySection.tsx`); DEGRADED chỉ >24h + toggle filter + SLA price-board (`SocSchedulerBoard.tsx`); i18n `soc.dataops.*`/`soc.scheduler.*`; CSS `.inventoryCaption/.coverageWarningBanner`.
- **Gates**: BE `manage.py check` 0; `test_scheduler_catalog` **35 OK** + `test_repair_beat_schedule` 6 + `test_drift_enabled_missing` 3 + `test_dataops_backfill_fixes` 6 OK; `test_soc_tasks` 6 FAIL **pre-existing**. FE `tsc 0` + `build PASS 53.00s` + vitest soc **8 files/67** (+4 mới). `docker compose config` OK.
- **E2E live**: EOD không 3 run/5'; coverage `2026-09-17`; bar MAX `2026-09-18 02:19 UTC`, Jun–Aug=0; heartbeat 60 symbols `0→60`; reconcile 1071 symbols ok=1071. **Còn**: rebuild image để persist (đang dùng `docker cp`) + UI manual.

### Done (2026-09-18) — Audit + PHẢN BIỆN DataOps Config (Entry 119-120)
- **Entry 119**: Audit `docs/AUDIT_DATAOPS_CONFIG_20260918.md` (điểm 3.5/10) + kế hoạch `docs/IMPLEMENTATION_PLAN_DATAOPS_CONFIG_COMMERCIAL_20260918.md` (8 slices C1→C8).
- **Entry 120 phản biện độc lập** `docs/PHAN_BIEN_AUDIT_DATAOPS_CONFIG_20260918.md`: audit chỉ ~55-65% chính xác — phần FE/UX đúng nhưng phần BE + benchmark sai.
- **R1**: Audit CFG-04 sai — BE **đã có** `change_summary` (`dataops_config.py:161`), `count` (`:164`), `service_key` (`:158`), `action`/`before_snapshot`/`after_snapshot` (`models.py:340,344,345` + `mixins.py:83,86,87`); chỉ FE không render.
- **R2**: Benchmark CFG-01 sai — `SocVnbrokerPanel.tsx:223` cũng là raw `textarea`; chỉ `SocScreenerConfigForm.tsx:99` có form per-field.
- **R3**: Plan C5.5 nhồi before/after vào `change_summary` là thừa/sai (2 field đã tồn tại).
- **R4**: Plan C5.1/C5.4 đặt `expected_updated_at`/`change_reason` trong wrapper, BE đọc top-level (`mixins.py:77`) → silent fail.
- **R5**: Audit có 2 bảng số hiệu CFG xung đột + CFG-02 cite `alert` sai (`135,167`).
- **Contradictions**: C1/C2/C3/C6 CONFIRMED; C4 PARTIAL; **C5 REFUTED** (apply/audit cùng key `dataops_config.py:83,185`).
- **Gates**: `npx tsc --noEmit` = 0, `manage.py check` = 0. Verdict: plan implementable, không blocker, phải sửa R1-R5 trước khi code.

### Done (2026-09-18) — DataOps Config UI Tái bố trí U1–U4 rev2 (Entry 127)

- **U1** `configPageStack` flex gap 1.25rem (`soc.components.css`) — tách 1 `sectionCard` wall thành Header `glassPanel configHeaderMeta` (SOC/DataOps eyebrow + `SocOwnershipBadge` + `lockedFieldList` chips) + 3 cards: Globals + Tiers + Reason/Action — fix `SH.1` wrapper missing.
- **U2** `SocQueueTierFieldSet.tsx` `tierCard` `081734/0.2` + `tierCardHeader` `LucideIcon Zap/Waves/Snowflake/RefreshCw` (`ui/lucide-icon.tsx` whitelist) + `tierSubtitle poll·batch` + label thuần `t(f.labelKey)` (bỏ `— ${label}` 36 từ) — fix `UI-02`.
- **U3** `SocDataOpsConfigSection.tsx` `stickyActionBar {sticky bottom 0 blur}` + `stickyActionButtons` flex-end + primary `Xem trước` `10b981`, ghost `Đặt lại`, danger `Đặt lại mặc định` `actionBtnDanger` (`soc.components.css`); `change_reason` `*` + `maxLength 200` + `chars_remaining` i18n + `t("soc.dataops.change_reason_required")` guard `handleApply 422` + focus — fix `F3`/`UI-04/06`.
- **U4** `auditToolbarGrid 160/160/1fr` (`soc.components.css`) với `filterRowLabel` + `configTierGrid 2×2 @900 1fr` scoped (không động `sectionGrid` shared `SH.3`) + `diffTableWrap max-height 320 overflow:auto` + `diffTableHeader sticky` — fix `G1`/`UI-07/09`.
- **Gates**: `tsc 0`, `build PASS 30.64s` (rev2 31.50/36.01), `vitest 40/40 213 PASS` (config 16/16), `jest 92/92`. Ledger Entry 127.

### Done (2026-09-18) — Signals UI Tái cấu trúc S1–S5 (Entry 129)

- **S1** `SocSignalsPanel.tsx:1146` `severityDot` `socStatusColor` + `signalPrice` — row giàu `APF SELL ●high 616.2M` (giữ `Waves` icon, `volume`, `time`).
- **S2** `SocSignalsPanel.tsx:2112` 7 tabs giữ `overview/job-console/materialization/config/detection/retention/rules` + `LucideIcon BarChart3/ServerCog/...` + `tabCountBadge` (`filteredSignals`, `materialization.services`, `rules`) — không gộp để giữ 33 tests.
- **S3** `SocSignalsPanel.tsx:1332` `renderKVCard` → `kvTableWrap`/`kvTable` `kvKey/kvVal` — `Cấu hình`/`Phát hiện`/`Lưu trữ` không raw `JSON.stringify`.
- **S4** `SocSignalsPanel.tsx:1111` `statCard` icon `Waves/EyeOff/Search/Percent/Clock` + `signalFeedFilterBar` 2 hàng `grid 140px 140px 1fr auto` — metric + filter không cramped.
- **S5** `SocSignalsPanel.tsx:1280` `Top 5` + `signalsTwoCol minmax(380 1.6fr) sticky top12` — overview giàu, right sticky.
- **Gates**: `tsc 0`, `build PASS 43.17s`, `vitest 40/40 213 PASS` (signals 33, overview-stream 2). Ledger Entry 129.

### Done (2026-09-18) — IMPLEMENT DataOps Config Commercial C1→C7 (Entry 121)
- **Thực thi** `docs/IMPLEMENTATION_PLAN_DATAOPS_CONFIG_COMMERCIAL_20260918.md` (vá R1-R5). Config SOC đạt chuẩn thương mại. Commits:
  - **C1** `ecbf6995` form per-field thay textarea (CFG-01/11), `SocQueueTierFieldSet.tsx` 4 fieldset.
  - **C2** `b24d3886` 0 `alert()`, `SocConfigPreviewModal` diff 3-col, inline error.
  - **C3** `a25aab29` audit `action|before|after|request_id` + filter + CSV export + revert.
  - **C4** `96c9d5b5` validate max-bound + cross-field (BE 4 tests).
  - **C5** `ce968ce8` optimistic lock 409 `CONFIG_CONFLICT` + `expected_updated_at` + audit `rollback` (BE `test_dataops_config_conflict` 3 tests).
  - **C6** `a4f70798` `GET /dataops/runtime-config/schema/` cả 2 namespace + `NumberInput.locked` 🔒 per-field (CFG-08/09).
  - **C7** `8c37c598` `DataOpsContext` config + SWR 30s + 3 presets (Tiết kiệm/Cân bằng/Hiệu năng) + freshness banner `new_update_note`.
- **Gates**: BE 12 tests config OK (`check` 0); FE `tsc` 0, `build PASS 46.47s`, vitest `12 files / 90 PASS` (+4 C7), jest `soc.test 92/92`, `i18n:scan` exit 0. Toàn bộ CFG-01→11 + contradictions C1-C6 ĐÓNG.
- **Còn lại**: C8 ledger + AGENTS (entry này). Ledger Entry 121.

### Done (2026-09-17) — Scheduler Self-Heal + Realtime Sync P1 (Entry 113-114) — 6 slices
- **Root cause chốt:** 5 jobs `enabled=False` trong `django_celery_beat_periodictask` (4 realtime + 1 by design `ingest-daily-prices-1705`) vs `CELERY_BEAT_SCHEDULE` `enabled=True` → `DatabaseScheduler` `entrypoint.sh:43` đọc DB không sync → `QUÁ HẠN 3h26m` `lag` `Thiếu dữ liệu` `MISSING 1.533` (bằng chứng `ROOT_CAUSE_SCHEDULER_DATAOPS_20260917.md` Entry 108).
- **Slice 1 `repair_beat_schedule` v2:** `beat_reconcile.py:1` shared `reconcile_beat_schedule(dry_run)` + `management/commands/repair_beat_schedule.py:17` `--dry-run` + `IntervalSchedule/CrontabSchedule` `get_or_create` `queue = options['queue']` (F-A1) + `CrontabSchedule` `timezone Asia/Ho_Chi_Minh` (F-A4) + `ingest-daily-prices-1705` giữ `False`.
- **Slice 2 Beat task 5m:** `service_ops/tasks.py:reconcile_beat_schedule_ssot` `queue manual_on_demand` `acks_late` + `settings.py:523` `reconcile-beat-schedule-5m` `300.0` `logger.warning` khi có fix.
- **Slice 3 Drift-check:** `vninvest_core/management/commands/check_scheduler_queue_drift.py` `ENABLED_DRIFT`/`MISSING_ROW` + `docker-compose.dev.yml:396` giữ `5m` (không 30s) — `service_ops/tests/test_drift_enabled_missing.py:1` 3 tests.
- **Slice 4 `next_run_at` cron:** `scheduler_catalog.py:498` `CrontabSchedule.schedule.remaining_estimate(timezone.now())` `timezone Asia/Ho_Chi_Minh` `now+remaining` (F-A4/F-CRIT-1) — `daily-backfill 17:05` hiện `2026-09-20 03:00 ICT` thay `—`/`2026-09-16` quá khứ.
- **Slice 5 FE:** `SocSchedulerBoard.tsx:14` `trigger_type?: string` + `formatNextRun(dateStr, triggerType):90` `t("soc.scheduler.not_scheduled")` `cron_tooltip` `vi.js/en.js:1139` `not_scheduled/cron_tooltip`.
- **Gates:** `manage.py check` 0, `repair --dry-run` 0, `celery inspect registered` có `reconcile` (qua `core-worker`), `test_scheduler_catalog` 34 OK + `test_repair_beat_schedule` 6 OK + `test_drift_enabled_missing` 3 OK = **43 OK**, `tsc 0` `build PASS 42.72s` `grep not_scheduled vi/en` 1, `docker compose config` `5m`.
- **E2E:** `repair --dry-run` 0, disable 1 critical → `reconcile` 5m bật lại, UI `Lịch chạy` cron hiện ngày giờ, `Quá hạn` hết đỏ, `beat` `queue-tier 30s` `ingest 60s` đều đặn `30s/60s`.

