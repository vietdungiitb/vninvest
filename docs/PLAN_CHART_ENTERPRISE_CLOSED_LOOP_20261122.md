# Chart Enterprise Always-On Demo Implementation Plan (vninvest)

> **For agentic workers:** REQUIRED SUB-SKILL: `workflow-dev-loop` (vòng kín 9 bước). Mỗi task là
> `- [ ]` step; chạy từng step theo thứ tự, không gộp. Auditor độc lập ở B3/B8.
>
> **Goal:** Biến staging `docker.edusuccess.vn` thành chế độ **enterprise luôn bật**, demo được
> toàn bộ tính năng của widget lẫn vninvest, bằng cách **nhân nguyên cơ chế của
> `charts.edusuccess.vn`** (server-side entitlement + widget build cùng commit + enterprise dock).
>
> **Target triển khai (chốt để tránh nhầm O2):** app **vninvest** (`packages/web`) trên
> `docker.edusuccess.vn`. **KHÔNG deploy lại stack `charts-test`** (`charts.edusuccess.vn`).
> Blueprint demo chỉ dùng để **nhân cơ chế** (entitlement/build/preload/dock), không thay thế app.
>
> **Architecture:** (1) khóa widget cùng bản demo (`0.4.7` / commit `ddc947dd`); (2) nginx same-origin
> `/api/v1/entitlement` giữ PAT server-only, browser chỉ nhận `tier_code=enterprise`; (3) preload
> entitlement trước first render (fail-closed `free` sau 2500 ms) để không flash FREE; (4) mount
> `EnterpriseDockProvider` + `enterpriseBinding` nối 6 capability enterprise vào adapter vninvest;
> (5) production vẫn fail-closed — gate `21/21` chứng minh free-tier locking không bị phá.
>
> **Tech Stack:** React/Vite (`packages/web`), `@vninvestcharts/widget` + engine 0.5.x, nginx-proxy +
> acme-companion, vnsaas (`saas.edusuccess.vn`) billing/subscription, VPS `14.225.255.47`.
>
> **Spec:** `docs/PLAN_CHART_ENTERPRISE_DEMO_CONVERSION_20261122.md` (khảo sát + 7 quyết định D1–D7)
> và blueprint `W:deploy/CHARTS-TEST.md`, `W:deploy/nginx-app.conf:141-168`,
> `W:docs/evidence/DEMO-ENTERPRISE-ENTITLEMENT_2026-11-19.md:8-30`.

---

## Global Constraints (copy nguyên từ spec/blueprint)

- **Không secret trong repo/bundle/URL/log.** PAT server-only nằm file `0700 root`, mount read-only
  (`W:docs/evidence/DEMO-ENTERPRISE-ENTITLEMENT_2026-11-19.md:12-22`). Không dùng blob demo
  domain-bound `charts.edusuccess.vn` cho staging (`REPORT_WIDGET_PRO_ENTERPRISE_GAPS…:39-40`).
- **D4b (Owner 22/11, đảo D4): DEFER `@vninvestcharts/widget-pro`** — mọi bản công khố pin cứng
  `widget@0.4.3`, xung đột bản local 0.4.7 (D2b). Đợt này dùng widget public (đủ 13 capability +
  enterprise dock). Pine/Strategy/Replay từ widget-pro **ra ngoài scope**; không `registerProExtension`,
  không import tĩnh engine-pro (`W:AGENTS.md:99-101`). Mở lại khi có bản tương thích.
- **Không dùng `?enterprise=1`** để cấp tier — legacy alias chỉ set localStorage dock
  (`W:src/demo/enterpriseDemoBinding.ts:40-52`). **Không dùng `debugFeatures`** (từng lọt mock vào
  production, `SaaSFeatureContext.tsx:50`).
- **Rule 15 — không dữ liệu giả.** Thiếu depth → `bids:[]`/`note`; `adjusted:false`; `server_pine`
  defer. Demo được phép **empty state trung thực**, không được bịa số.
- **Build từ cây sạch**, `health.json` phải `dirty=false`; sai ⇒ dừng, không E2E
  (`W:deploy/CHARTS-TEST.md:89`). Tag image theo `<sha>`, giữ `:latest` để rollback.
- **`expose`, không `ports`**; dùng network `nginx-proxy_default`; KHÔNG sửa nginx-proxy, KHÔNG
  đụng `/opt/vninvest` stack khác (`W:deploy/docker-compose.charts-test.yml:4-6`).
- **Deny-list**: `packages/web/package.json`, `package-lock.json`, `AGENTS.md`, `.env*`,
  docker-compose*.yml. Sửa phải có coordinator + trailer `Claim-Deny-List: <lý do>`.
- **Không đọc nội dung tiếng Việt qua console shell Windows** (mojibake); đọc bằng tool đọc file;
  không `print()` tiếng Việt trong mã chạy thật (luật cứng #4 của `workflow-dev-loop`).
- **Gate B4→B5** chưa qua ⇒ KHÔNG viết dòng code. **LIMIT 3 vòng sửa/bước**, quá ⇒ `blocker`.
- **Mọi verdict audit/đồng thuận/re-audit PHẢI là file văn bản** trong `docs/evidence/<slice>/`.
- Mọi con số kèm lệnh tái hiện; không chạy được ⇒ `CHƯA CHẠY`. Không audit chính việc mình làm.

---

## Review Focus (5 input dễ gây hại nhất, mỗi cái có test ở task tương ứng)

1. **Free flash lúc đầu trang** — nếu entitlement resolve sau first render, user thấy FREE dù server
   trả enterprise → Task 4 test preload + `data-tier` ở render đầu (`serverEntitlement.ts:28-32`).
2. **Origin/SNI sai khi proxy SaaS** — Docker DNS trả IP ⇒ nginx-proxy chứng chỉ sai ⇒ 502 sau
   recreate → Task 5 assert `proxy_ssl_name saas.edusuccess.vn` (`W:deploy/nginx-app.conf:160-163`,
   `DEMO-ENTERPRISE-ENTITLEMENT:18-19`) **và** probe Origin: blueprint dùng
   `https://charts.edusuccess.vn` (`nginx-app.conf:166`), ta dùng
   `https://docker.edusuccess.vn` — **khác biệt có chủ đích**, phải curl thật xác nhận 200/401
   (CORS SaaS đọc env `vnsaas/…/vnsaas_core/settings.py:664-668`, chưa probe).
3. **Stale bundle được phục vụ** — `scp -r` đè không ghi đè, `health.json` cũ vẫn trả 200 ⇒
   tưởng deploy xong → Task 6 `check-staging.mjs` hỏi từ NGOÀI + so commit + `dirty=false`
   (`CHARTS-TEST.md:47-53,77-89`).
4. **Demo enterprise làm hỏng free-tier locking** — nếu tier bị ép cứng ở client, user thường cũng
   thành enterprise → Task 7 chạy `verify-capability-gate.cjs` **21/21 PASS** như demo
   (`DEMO-ENTERPRISE-ENTITLEMENT:30`).
5. **Widget 0.4.4 không có enterprise leg** — chỉ đổi credential thì vẫn FREE → Task 3 source-scan
   test assert dist có `/api/v1/entitlement` + `enterpriseBinding` (đã đo 0 hit / 721 file).

---

## Bản đồ vòng kín 9 bước (B1–B9 → task/evidence)

| Bước | Hành động | Evidence file bắt buộc |
|---|---|---|
| **B1 Đo** | `agent-sync.ps1` → `git status` → đọc `CLAIMS.md` → nạp `project-lessons` → `check-multi-agent` | `docs/evidence/chart-enterprise/BASELINE_20261122.md` |
| **B2 Kế hoạch** | plan này + AC `Given/When/Then` + baseline exit-code | file này |
| **B3 Audit độc lập** | subagent khác, chỉ đọc, verdict có số objection | `docs/evidence/chart-enterprise/PLAN_AUDIT_20261122.md` |
| **B4 Đồng thuận** | Owner chốt D1–D7 + verdict `PASS`/`AGREE` | `docs/evidence/chart-enterprise/CONSENSUS_20261122.md` |
| **B5 Claim+cách ly** | append claim, commit riêng, branch `feat/chart-enterprise-demo` | `docs/CLAIMS.md` |
| **B6 Code TDD** | fail-before → pass-after từng task | log trong từng task + `JOURNAL_*.md` |
| **B7 Gates** | rebase rồi chạy lại mọi gate; VPS staging, cấm local Docker | `docs/evidence/chart-enterprise/GATES_*.md` |
| **B8 Re-audit** | auditor khác trên revision mới, 0 blocker/0 major | `docs/evidence/chart-enterprise/REAUDIT_*.md` |
| **B9 Bàn giao** | claim `done` + Entry ledger + PR merge-commit + handoff | `docs/handoffs/HANDOFF_YYYY-MM-DD_chart-enterprise.md` |

**Baseline exit-code đã đo 22/11/2026** (lệnh ở `PLAN…CONVERSION…md` §9):

| Gate | Kết quả |
|---|---|
| `node packages/web/scripts/check-multi-agent.mjs` | **0 lỗi PASS** — đã chạy **sau** khi append claim `chart-enterprise-plan` (xem output phiên 22/11) |
| `git diff --numstat` sau sửa docs | `+1` CLAIMS / `+10` ledger — đúng dự kiến |
| `npm view @vninvestcharts/widget versions` | **E401** (thiếu `GITHUB_TOKEN`) |
| dist scan 721 file | 0 hit entitlement/enterprise/dock |
| `/health.json` demo | `0.4.7`, `ddc947dd`, `dirty=false` |
| `npx tsc --noEmit` / `npm run build` / vitest / E2E | **CHƯA CHẠY** (chưa đổi code) |

---

## File map (chốt trước khi code)

| File | Trách nhiệm | Thao tác |
|---|---|---|
| `packages/web/package.json` + lock | pin widget build parity | **coordinator** (deny-list) |
| `packages/web/src/components/VNStockChartPanel.js` | truyền entitlement/tier + dock props | modify |
| `packages/web/src/components/VNStockChartPanel.css` | dọn hack `!important` | modify |
| `packages/web/src/lib/chartDemoEntitlement.js` **(new)** | preload `/api/v1/entitlement`, 2500 ms fail-closed | create |
| `packages/web/src/main.tsx` | gọi `preloadChartEntitlement()` **trước** `createRoot().render()` | modify (entry — O4) |
| `packages/web/scripts/write-build-health.mjs` **(new)** | ghi `dist/health.json` `{ok,commit,dirty}` từ git | create (O3) |
| `packages/web/scripts/check-staging.mjs` **(new)** | verifier từ NGOÀI so commit/dirty | create (O3) |
| `packages/web/src/lib/chartEnterpriseBinding.js` **(new)** | map 6 dock tabs → adapter vninvest | create |
| `packages/web/src/adapters/chartAdapter.js` | bổ sung method dock thiếu | modify |
| `packages/web/src/components/__tests__/chart-enterprise-parity.component.test.ts` **(new)** | source-scan + render tests | create |
| `packages/web/docker/nginx.conf` | `/api/v1/entitlement` (**dùng `location =` exact-match** để thắng `location ^~ /api/v1/` tại `:254-265`) + `/demo-token.json` | modify (coordinator nếu shared) |
| VPS `/opt/vninvest/...` env + root-only PAT | credential, không track | ops |
| `docs/evidence/chart-enterprise/*` | baseline/audit/gates/journal | create |

---

## Task 1 — B1/B2/B3/B4: baseline + audit plan + đồng thuận (doc-only, KHÔNG code)

**Files:** `docs/evidence/chart-enterprise/BASELINE_20261122.md`, `PLAN_AUDIT_20261122.md`, `CONSENSUS_20261122.md`.

- [ ] **Step 1:** Chạy `pwsh -File scripts/agent-sync.ps1` (rebase → migration → gate) rồi
  `git status --short`; nếu có file lạ của agent khác → DỪNG.
- [ ] **Step 2:** Ghi baseline các lệnh §Baseline vào `BASELINE_20261122.md` kèm output thật.
- [ ] **Step 3:** Dispatch auditor **khác session**, chỉ đọc, review plan này theo 5 Review Focus +
  7 quyết định D1–D7. Verdict ghi `PLAN_AUDIT_20261122.md`. `NEED_REVISION` → sửa plan → audit lại
  (tối đa 3 vòng).
- [ ] **Step 4:** Owner chốt D1–D7 (đặc biệt D2 nguồn build, D3 PAT, D6 mở lại Wave 1/2). Ghi
  `CONSENSUS_20261122.md`. **Gate B4→B5**: thiếu chữ ký Owner ⇒ KHÔNG sang Task 2.

---

## Task 2 — B5: claim + cách ly

**Files:** `docs/CLAIMS.md`.

- [ ] **Step 1:** Append 1 dòng cuối bảng (file phải kết thúc LF):
  `| chart-enterprise-demo | feat/chart-enterprise-demo | … | … | in-progress | 2026-11-22 | … |`
  Tên agent **phải bằng** tên branch bỏ tiền tố.
- [ ] **Step 2:** `git add docs/CLAIMS.md && git commit -m "docs(claim): chart-enterprise-demo in-progress"` —
  commit riêng, không lẫn code.
- [ ] **Step 3:** `pwsh -File scripts/agent-install-hooks.sh` → `sh scripts/new-agent.ps1` (worktree)
  → `node packages/web/scripts/check-multi-agent.mjs` PASS. Không commit thẳng `dev`.

---

## Task 3 — B6-E1: widget build parity (chốt đúng commit của demo)

**Files:** `packages/web/package.json`+lock (coordinator), test new.

**Interfaces:** Consumes: `/health.json` demo `0.4.7`/`ddc947dd`. Produces: dependency pin
`>=0.4.6` hoặc `file:`/tarball từ commit `ddc947dd`; dist có `/api/v1/entitlement`.

- [ ] **Step 1 (failing test):** Viết `chart-enterprise-parity.component.test.ts`:
  `expect(pkg.dependencies['@vninvestcharts/widget']).not.toBe('0.4.4')` **và**
  đọc `dist/**/*.js`, assert `src.includes('/api/v1/entitlement') === true`.
- [ ] **Step 2:** Chạy `npx vitest run src/components/__tests__/chart-enterprise-parity.component.test.ts`
  → **FAIL** (version 0.4.4, 0 hit). Ghi log.
- [ ] **Step 3:** Coordinator pin dependency theo **D2b = build local @ `ddc947dd`** (Owner đảo D2
  sau khi registry probe chỉ có 0.4.6 thiếu enterprise dock — `REGISTRY_PROBE_20261122.md`):
  `git -C <widget-repo> checkout ddc947dd` trên cây sạch → `npm pack` thành tarball → pin bằng
  `file:`/tarball trong `packages/web/package.json` + lock (deny-list, coordinator). Bump engine
  theo `W:package.json:3` @ ddc947dd: `engine-core ^0.5.8` · `engine-drawing ^0.5.7` ·
  `engine-react ^0.5.8` (registry có các bản này). KHÔNG tự `npm install` khi chưa có phép Owner.
- [ ] **Step 4:** Chạy lại lệnh Step 2 → **PASS**. `node -e` in version ≥0.4.6 + hit count ≥1.
- [ ] **Step 5:** `npx tsc --noEmit` exit 0 → commit `feat(chart): pin widget enterprise build parity`.

---

## Task 4 — B6-E2: preload entitlement, không flash FREE

**Files:** new `src/lib/chartDemoEntitlement.js`; modify `VNStockChartPanel.js`, test.

**Interfaces:**
- Consumes: `GET /api/v1/entitlement` → `{tier_code, status}` (demo trả `enterprise`/`active`).
- Produces: `preloadChartEntitlement(): Promise<{tier:'enterprise'|'free', active:boolean}>`,
  `readPreloadedChartTier(): 'enterprise'|'free'|null` — **mirror blueprint**:
  `free` phải trả **`null`** (`W:src/demo/serverEntitlement.ts:61-65`), timeout `2500ms` fail-closed.

- [ ] **Step 1 (failing test):** (a) source-scan `src/main.tsx` assert
  `preloadChartEntitlement()` đứng **trước** `createRoot(...).render(...)`; (b) test render
  `VNStockChartPanel` khi server trả enterprise, assert `[data-tier="enterprise"]` **ở render đầu**
  (không chờ effect). Trên code cũ → FAIL (thiếu preload / `free`). Không dùng assert phủ định
  rỗng (L-V04) — phải assert chuỗi `enterprise` thật + test dương tính.
- [ ] **Step 2:** Chạy test → FAIL. Ghi log.
- [ ] **Step 3:** Implement mirror `W:src/demo/serverEntitlement.ts:13-66`: fetch same-origin,
  `cache:'no-store'`, map `tier_code`/`plan`, `Promise.race` với timeout 2500 ms, module-level
  stash (`free → null`), chỉ đọc sync trong `useState` initializer. **Gọi
  `preloadChartEntitlement()` trong `packages/web/src/main.tsx` trước `createRoot().render()`**
  và await/đợi stash sẵn trước mount. Không PAT trong browser.
- [ ] **Step 4:** Chạy test → PASS; thêm test âm tính (fetch 404/timeout → `free`).
- [ ] **Step 5:** `npx tsc --noEmit` 0 · vitest panel 15/15 → commit.

---

## Task 5 — B6-E3: nginx `/api/v1/entitlement` + PAT server-only (theo blueprint)

**Files:** VPS config + `packages/web/docker/nginx.conf` (shared — coordinator), evidence env.

**Interfaces:** upstream `https://saas.edusuccess.vn/api/v1/billing/subscription/vninvestcharts_widget`;
header `Authorization` từ `/etc/nginx/entitlement-auth.conf` (root-only mount).

- [ ] **Step 1 (fail-before):** `curl -s https://docker.edusuccess.vn/api/v1/entitlement` ⇒ ghi
  status hiện tại (dự kiến 404). Đây là baseline đỏ.
- [ ] **Step 2:** Tạo tenant subscription `enterprise` trên vnsaas staging (D3), PAT machine của
  service user, lưu `/opt/vninvest/secrets/entitlement-auth.conf` `0700 root` / file `0644`.
  **Không in token**, chỉ serial/tenant id vào evidence.
- [ ] **Step 3:** Thêm location mirror `W:deploy/nginx-app.conf:155-168` — **phải khai
  `location = /api/v1/entitlement` (exact-match), KHÔNG phải prefix**, nếu không `location ^~
  /api/v1/` tại `packages/web/docker/nginx.conf:254-265` sẽ nuốt request. Bắt buộc có
  `proxy_ssl_name saas.edusuccess.vn`, `proxy_ssl_server_name on`,
  `proxy_set_header Origin https://docker.edusuccess.vn`, `Cache-Control no-store`,
  `access_log off`, `include /etc/nginx/entitlement-auth.conf`.
- [ ] **Step 4:** Từ VPS `curl` với `Origin: https://docker.edusuccess.vn` ⇒ **200
  `{"tier_code":"enterprise","status":"active"}`**; negative: bỏ Authorization ⇒ 401/403;
  negative 2: `Origin` sai ⇒ xác nhận có bị chặn không (chưa probe — ghi kết quả thật).
  Ghi output vào `GATES_E3.md` kèm lệnh tái hiện.
- [ ] **Step 5:** Commit file conf (không secret) → `coordinator` apply trên VPS.

---

## Task 6 — B6-E4/E5: deploy parity + enterprise dock binding

**Files:** `src/lib/chartEnterpriseBinding.js` (new), `VNStockChartPanel.js`, `chartAdapter.js`.

**Interfaces:** Consumes: `EnterpriseDockProvider({binding,children})`
(`dist/dts/widget/components/dock/EnterpriseDockProvider.d.ts:3-7`), prop `enterpriseBinding`
(`VNInvestChartsProps.d.ts:324`). Produces: binding 6 tab
`fundamentals_full | portfolio_analytics | orderbook_dom | cloud_alert | server_workspace | index_constituents`.

- [ ] **Step 1 (failing test):** Test assert `chartEnterpriseBinding()` trả đủ 6 key và mỗi key
  có adapter method tương ứng (`W:CapabilityResolver.ts:184-198`). Trên code cũ → FAIL.
- [ ] **Step 2:** Chạy test → FAIL. Ghi log.
- [ ] **Step 3:** Implement binding map → endpoint vninvest đã có (`…SPEC:145-156`), thiếu method
  thì để `degraded` (không fake). Mount `EnterpriseDockProvider` quanh chart + truyền
  `enterpriseBinding`. Với `orderbook_dom` giữ empty state trung thực (Q-B1).
- [ ] **Step 4:** Test → PASS. **Build app vninvest** (KHÔNG `npm run build:docs` — đó là stack
  demo, O2): `npm run build` từ cây sạch; chạy `packages/web/scripts/write-build-health.mjs` sinh
  `dist/health.json` `{ok:true, commit:<git rev-parse --short HEAD>, dirty:<boolean>}` với
  **`dirty = (git status --porcelain).trim() ? true : false`** — `git status --porcelain` trên cây
  sạch trả chuỗi rỗng `""`, không phải `false`; map sai thì verifier so sánh hỏng (mirror
  `CHARTS-TEST.md:86-89`; `dirty` phải `false`). Deploy bằng
  `bash scripts/deploy-staging.sh --verify` trên VPS (Rule 17), **không** `charts-test:<sha>`.
- [ ] **Step 5:** `node packages/web/scripts/check-staging.mjs --url https://docker.edusuccess.vn`
  hỏi từ NGOÀI: so `commit` trả về với sha vừa build, `dirty=false`, index 200. Nếu lệch ⇒ dừng,
  không E2E (O3). Commit.
- [ ] **Step 6 (D4b — DEFER widget-pro):** Ghi rõ vào evidence rằng không cài
  `@vninvestcharts/widget-pro` đợt này (pin `widget@0.4.3` xung đột bản local 0.4.7), không gọi
  `registerProExtension`, không import `engine-pro`. Test source-scan âm tính: assert
  `package.json` **không** có `widget-pro` dependency mới và source không có `registerProExtension`.
  Commit riêng. Mở lại khi widget team phát hành bản tương thích.

---

## Task 7 — B6-E6: demo TOÀN BỘ tính năng + giữ free-tier locking

**Files:** `chart-enterprise-parity.component.test.ts`, evidence feature matrix.

- [ ] **Step 1 (failing test):** Viết test source-scan assert các prop/tính năng sau đều hiện trong
  panel: `showDock`, `showDrawingDock`, `showTapePanel`, `showAdvisoryPanel`,
  `measurementEnabled`, `showPaperTrade`, `enableWhale`, `enableCVD`, `cvdMode`,
  `onComparisonChange`, `enterpriseBinding`, `onTelemetry`, `upgradeUrl` (Pine/Strategy/Replay
  **đã defer** theo D4b — không assert trong đợt này). Trên code hiện tại
  một số đã có → test phải chọn các case còn thiếu (xác định lúc chạy, ghi rõ).
- [ ] **Step 2:** Chạy → FAIL trên ít nhất 1 mục; ghi log.
- [ ] **Step 3:** Bật các prop còn thiếu theo tier `enterprise` (không bật 67 indicator cùng lúc —
  catalog để user tự chọn). Giữ tape/advisory bridge vì widget chưa forward payload V2.
- [ ] **Step 4:** Chạy test → PASS. Chạy `verify-capability-gate.cjs` trên staging ⇒ **21/21 PASS**
  (free-tier vẫn khoá đúng). Chụp ảnh demo: badge `ENTERPRISE`, `lockedText=0`, `upgradeNudge=0`,
  Pine button present, `pageErrors=0`, `vni_pat` rỗng, `hasFetchError=false`, `dashCount=0`.
  **Mở ảnh ra xem** (L-V05).
- [ ] **Step 5:** Ghi feature matrix (widget + vninvest) vào `docs/evidence/chart-enterprise/FEATURE_MATRIX.md`.
- [ ] **Step 6:** Commit riêng `feat(chart): demo all enterprise features, keep free-tier gate 21/21`.

---

## Task 8 — B7: gates sau rebase (KHÔNG tin gate trước rebase)

- [ ] **Step 1:** `pwsh -File scripts/agent-sync.ps1` (rebase → check migration → gate). Chạy lại
  **mọi** gate dưới đây sau rebase:
- [ ] **Step 2:** `node packages/web/scripts/check-multi-agent.mjs` ·
  `node scripts/check-experiment-env.mjs` · `node scripts/normalize-eol.mjs` ·
  `node scripts/pre-push-gate.mjs` · `npx tsc --noEmit` · `npm run build` ·
  `npm run lint` · `npm run test:components`.
- [ ] **Step 3:** VPS staging (Rule 17) — **cấm local Docker kể cả `docker ps`**:
  `bash scripts/deploy-staging.sh --verify`; E2E Playwright theo feature matrix; `curl health.json`.
- [ ] **Step 4:** Ghi `GATES_FINAL.md` với exit code thật + mục `CHƯA CHẠY` nếu có.
  `git diff --numstat` phải khớp số dòng dự kiến sau mỗi lần sửa (L-T01).

---

## Task 9 — B8: re-audit độc lập

- [ ] **Step 1:** Dispatch auditor **khác** người audit B3, chỉ đọc revision mới nhất.
- [ ] **Step 2:** Auditor tự suy ra lại số liệu, kiểm 5 Review Focus + AC từng task + feature matrix
  + 21/21 gate + screenshot đã mở. Verdict `PASS`/`AGREE` (`NEED_REVISION` → về Task 6/7, tối đa 3 vòng).
- [ ] **Step 3:** Ghi `docs/evidence/chart-enterprise/REAUDIT_FINAL.md`. Không có file ⇒ B8 chưa xong.

---

## Task 10 — B9: bàn giao

- [ ] **Step 1:** Claim `chart-enterprise-demo` → `done` trong `docs/CLAIMS.md` (1 dòng, append/sửa status).
- [ ] **Step 2:** Prepend 1 `## Entry N` riêng vào `docs/CODE_CHANGE_AUDIT_LEDGER.md` (Entry tiếp theo
  sau 608). Commit riêng, message nêu rõ đã chạy gì + `CHƯA CHẠY` gì.
- [ ] **Step 3:** Push → `pwsh -File scripts/agent-pr.ps1` → PR merge-commit (không squash).
- [ ] **Step 4:** Sau merge: `pwsh -File scripts/agent-cleanup.ps1 -Branch feat/chart-enterprise-demo -Execute`
  (xoá junction trước khi xoá cây).
- [ ] **Step 5:** Handoff `docs/handoffs/HANDOFF_2026-11-22_chart-enterprise.md` + verify
  `git log --oneline -3 -- docs/handoffs` trên nhánh chính.

---

## Demo parity checklist (copy từ blueprint — khớp từng dòng)

| # | Demo `charts.edusuccess.vn` | vninvest staging phải có | Nguồn |
|---|---|---|---|
| 1 | `/api/v1/entitlement` → `tier_code=enterprise`, `status=active` | y hệt (host đổi) | `DEMO-ENT…:27` |
| 2 | PAT server-only, browser `vni_pat` rỗng | y hệt | `:14,29` |
| 3 | Preload trước mount, timeout 2500 ms fail-closed | Task 4 | `serverEntitlement.ts:28-46` |
| 4 | Badge `ENTERPRISE`, `lockedText=0`, `upgradeNudge=0` | Task 7 | `:29` |
| 5 | `verify-capability-gate` 21/21 PASS | Task 7 | `:30` |
| 6 | `health.json` commit khớp + `dirty=false` | Task 6: `dist/health.json` + `check-staging.mjs` (vninvest không có sẵn — O3) | `CHARTS-TEST.md:86-89` |
| 7 | Build `VNI_API_BASE` + `VNI_ALLOW_STAGING_ANCHOR=1` | **Nhân cơ chế**: FE build có build-time API base + trust anchor staging; KHÔNG dùng `build:docs` | `:37-40` |
| 8 | Tarball, xoá build đích trước, tag sha | **Nhân cơ chế**: build từ cây sạch + deploy `scripts/deploy-staging.sh --verify`; KHÔNG đóng gói charts-test | `:47-65` |
| 9 | `expose` 8080, network `nginx-proxy_default`, không đụng stack khác | Đã có hạ tầng vninvest; chỉ thêm location entitlement, không tạo stack mới | compose `:4-6,30-52` |
| 10 | Rollback = giữ image tag sha + `compose down` riêng stack | Revert PR / redeploy sha trước theo runbook staging của vninvest | `CHARTS-TEST.md:185-190` |
| 11 | Data PAT `/demo-token.json` tách riêng tier | đã có SA `charts-demo` id 1067 | `EVIDENCE_20261120.md:26-29` |
| 12 | `?enterprise=1` KHÔNG dùng làm tier | Task 7 | `enterpriseDemoBinding.ts:40-52` |

## Phạm vi demo "toàn bộ tính năng" (canonical list)

- **Widget enterprise track:** 13 capability `E:capabilities.ts:219-230` · 67 indicator + 76 drawing
  tool · paper trade nâng cao · export PNG/CSV · multi-chart · compare · layout preset/share local ·
  alert local/drawing · market profile · 6 dock tabs (`enterpriseDockTypes.ts:4-11`).
  **Deferred theo D4b:** Pine Editor · Strategy Tester · Bar Replay (nằm ở widget-pro).
- **vninvest trong chart:** whale bubble/overlay · tape Bán/Mua · advisory · CVD/whale threshold ·
  order book + execution log · corporate events (khi có data) · portfolio analytics · watchlist ·
  cloud alert · workspace · index constituents.
- **Trung thực:** `orderbook_dom` empty-state (Q-B1), `adjusted:false` (D1), `server_pine` defer (D4),
  `cash_flow:null` — **không** bịa để "đẹp demo".

---

## Non-goals / Rollback / LIMIT

- Không sửa widget repo, không sửa vnsaas code (chỉ provision tenant/PAT qua ORM theo D3).
- Không đưa PAT/key thật vào repo, chat, URL, bundle, log; chỉ serial/hash.
- Không dùng blob demo domain-bound, không dùng `?pat=` cho staging.
- Không bật 67 indicator cùng lúc; không fake dữ liệu; không sửa test cũ để xanh.
- Rollback: giữ image tag theo sha + `:latest`; `docker compose down` riêng stack; revert từng PR.
- LIMIT: mỗi bước tối đa 3 vòng sửa; quá ⇒ ghi `blocker`, trả partial state, dừng.

---

## Lessons áp dụng

[L-V01, L-V02, L-V05, L-F01, L-F02, L-F12, L-T01, L-T02] + 6 luật cứng của `workflow-dev-loop`.
Checklist đã tick ở plan khảo sát §11; phần còn lại (mở ảnh, đo bundle, verify CSS/props/heightRatio,
numstat sau mỗi sửa) là nghĩa vụ của B6–B8.

---

## Trạng thái

**B1–B4 XONG.** B3 `AGREE` (`docs/evidence/chart-enterprise/PLAN_AUDIT_20261122.md`),
B4 `AGREE` + Owner chốt D1–D7, sau đó chốt thêm **D2b** (build local @ `ddc947dd`) và **D4b**
(defer widget-pro) tại `docs/evidence/chart-enterprise/CONSENSUS_20261122.md` +
`REGISTRY_PROBE_20261122.md`. Cổng B4→B5 **mở lại**.
**B5 chưa bắt đầu** — chờ lệnh triển khai. Prerequisite: cây widget repo sạch @ `ddc947dd`,
quyền `npm pack`/sửa `package.json` (deny-list — coordinator), engine 0.5.8/0.5.7/0.5.8.
Reservation R-B4-1: đọc lại các đoạn cập nhật D2b/D4b ở B6 lần đầu.
