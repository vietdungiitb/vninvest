# PLAN Wave 4 MBW4 — SOC Broker Ops (1 chu trinh khep kin, 1 PR)

- **Ngay:** 2026-10-15 · **Nhanh wave:** `feat/mbw4-soc-ops` (tu `dev` @ `7395ff6ee`) · **Che do:** Mode B — MOT nhanh wave, commit theo slice, MOT PR cuoi wave
- **Claim:** `mbw4-plan` (`docs/CLAIMS.md` cuoi file, commit `1a49f92b7`) · **Trang thai:** Stage 1 (cho audit doc lap Stage 2)
- **Lessons ap dung: [L-001, L-002, L-003, L-004, L-006, L-007, L-008, L-A01, L-G01, L-G02, L-G08, L-M01, L-M02, L-V01, L-V02, L-V03, L-T01, L-T02, L-F01]**
- **Nguon su that:** `docs/PLAN_MULTI_BROKER_SYNC_20261014.md:128-129` (Wave 4) · `docs/IMPLEMENTATION_PLAN_PORTFOLIO_COMMERCIAL_HARDENING_20260925.md:865-866` (AC BRK-06) · `docs/IMPLEMENTATION_PLAN_BROKER_MANAGEMENT_20260923.md:96,148` · `docs/adr/ADR-005-danh-muc-tuong-minh-theo-nguon.md` · `docs/adr/ADR-006-broker-ssot-qua-vnbroker.md` · `docs/adr/ADR-007-holdings-tach-bach-watchlist-thu-cong.md` · `docs/HANDOFF_MBW3_20261015.md` · code `packages/core/backend/src/service_ops/views/broker.py:1-14`
- **Ten `mbw4`** (khong dung `wave4` — ten do la cua `uiux-wave4`, `docs/CLAIMS.md:1081`).

## 1. Pham vi B4.0–B4.4 (khoa, khong mo rong)

| Slice | Noi dung + AC (do duoc) | File ownership (disjoint tuyet doi) |
|---|---|---|
| B4.0 pre (BE, ~0.5d) | Sua runbook §12.3 `POSTGRES_PASSWORD` → `CORE_DB_PASSWORD` (1 dong) + staging-read dem leftovers B3.4 (chua du dieu kien `AlterField` thi giu `CHUA CHAY`) + xac nhan DB `mbw1_wave` con sot (chi don o Stage 8 neu orphan) | `docs/STAGING_VPS_RUNBOOK.md` (§12.3, 1 dong) |
| B4.1 BE-ops-health (~1.5d) | Mo rong `GET /api/soc/broker/health/` → lane metrics (latency, error-rate, retry, circuit) tu `BrokerSyncRun/Issue` read-only; queue depth reuse `_get_redis_queue_depth` (timeout 2s, fail-open); top loi aggregate; envelope ADR-003; staff-only 403. **Chung owner voi B4.2 (1 agent BE tuan tu, tien le Wave 0) — khong tach 2 claim BE de tranh leaf song song (L-M03).** | `packages/core/backend/src/service_ops/views/broker.py` + `packages/core/backend/src/service_ops/tests/test_soc_broker_ops*.py`; DOC `user_workspace/broker/*`; `identity_access/models.py` CHI DOC (khong them field — expiry la derived, xem O-3) |
| B4.2 BE-ops-safety (~1d) | Credential expiry **derived** (O-3) + kill-switch write **qua `POST /api/soc/broker/config/apply/` hien co** (`views/broker.py:139-165`, da validate + audit — O-4, khong route moi) + audit viewer + CSV `GET /api/soc/broker/audit/?download=csv` theo pattern `views/audit.py:105-128`, **scope service** (`ConfigChangeAudit`, khong tenant FK — O-5, khong hua tenant-scope), gioi han 5000 dong | `packages/core/backend/src/service_ops/**` (cung agent BE voi B4.1, tuan tu) |
| B4.3 FE-soc-ui (~2d) | Tab SOC Broker Ops: glassmorphism, `soc.tokens.css` + `soc.components.css` (CAM `soc.module.css` — chi la barrel 3 dong; `SocBrokerPanel.tsx:7` hien dang import barrel, B4.3 phai migrate). Client qua **`adapters/core/soc.js`** (SOC ops, chu) — `adapters/core/broker.js` la hub user, chi DOC. `LangContext`, VI/EN full dau, key moi **`brokerWave4.*`** (noi tiep `brokerWave3.*` da co o `vi.js:2362`/`en.js:2365`), lazy chunk, health cards + queue + top loi + expiry badges + kill-switch confirm modal + audit table + nut CSV; `i18n:scan` 0 thieu | `packages/web/src/components/soc/*`, `packages/web/src/pages/soc/*`, `packages/web/src/adapters/core/soc.js` (chu), `packages/web/src/i18n/vi.js` + `en.js` (FE la chu duy nhat cua key i18n), test `*.component.test.*` kem theo. Cam cham `service_ops/**` (BE giu). |
| B4.4 Drill + gates (~0.5d, PM/sup) | Kill-switch drill staging: bat → order/sync-write 503, tat → phuc hoi; health card khop so queue that; evidence `docs/evidence/mbw4/` (hien CHUA TON TAI — tao o Stage 6) | `docs/evidence/mbw4/*` (sup so huu) |

**Ngoai pham vi (ghi `CHUA CHAY`, cam bao PASS):** E2E 2 SubAccount · full BE suite · ruff · B3.4 `AlterField` · HYGIENE (watchlist 400/404 tran, pre-existing). DB `mbw1_wave` con sot giu **`CHUA XAC MINH`** — Stage 8 chi don sau khi xac minh orphan, khong xoa mu. Nen BE da co: config/apply/preview/audit/health/credentials/test-connection (`views/broker.py:1-14`), kill-switch fail-closed runtime (`broker_runtime.py:75-108`), queue-depth pattern.

## 1.1 Quyet dinh dong tu audit vong 1 (NEED_REVISION O-1..O-6 → sua het, rev 2)

- **O-1 (adapter):** SOC ops di qua `adapters/core/soc.js`, khong phai `broker.js` (hub user) — sua ownership B4.3.
- **O-2 (disjoint):** B4.1 ⊂ B4.2 (cung `service_ops/**`) nen "disjoint tuyet doi" la tu mau thuan — chot **1 agent BE tuan tu** cho ca B4.1+B4.2 (tien le Wave 0 "1 agent duy nhat"); disjoint chi con BE↔FE.
- **O-3 (expiry source):** `SystemBrokerCredential` (`identity_access/models.py:961-988`) KHONG co `expires_at` — chot **derived, khong migration**: badge `stale = now - last_verified_at > 30d` hoac `is_verified=False` → "can xac minh", doc tu field co san (`last_verified_at:982`, `last_check:983-985`, masked preview `masked_preview:1009`).
- **O-4 (kill-switch write):** dung lai `POST /api/soc/broker/config/apply/` hien co (`views/broker.py:139-165`, da validate + audit) — khong route moi; confirm 2 buoc o FE modal.
- **O-5 (CSV scope):** `GET /api/soc/broker/audit/?download=csv` theo pattern `views/audit.py:105-128`, **scope service** (`ConfigChangeAudit` `views/broker.py:219-226`, khong tenant FK), gioi han 5000 dong.
- **O-6 (i18n + mbw1_wave):** key moi `brokerWave4.*`; `mbw1_wave` giu `CHUA XAC MINH`.
- **Ghi nhan L-T02:** audit ghi `models.py:961-988` thieu path — dung la `identity_access/models.py:961-988`. Finding giu nguyen (ban chat dung), citation da sua.

## 2. Chu trinh Stage 0–8 (mot mach)

- **Stage 0 — Mo phien:** hook (`Git/bin/sh.exe scripts/agent-install-hooks.sh`) → `git status --short` main tree → nap skill `project-lessons` → doc `docs/CLAIMS.md` (khong con `in-progress` giu file B4).
- **Stage 1 — PLAN (doc nay).** Xong khi co `file:line` moi khang dinh.
- **Stage 2 — Audit doc lap 2–3 vong:** auditor khong viet code, output `NEED_REVISION (O-x/F-x)` → sua → `AGREE`. Bat buoc muc CONTRADICTIONS (`plan:file:line | code:file:line | impact`). Root cause ke thua phai fail-before + source (L-V02).
- **Stage 3 — Claims + worktrees:** 2 claims (`mbw4-be` gop B4.0+B4.1+B4.2 tuan tu, `mbw4-fe` B4.3) append cuoi CLAIMS.md, commit rieng, TRUOC dong code dau tien. 2 worktree (`agent-mbw4-be`, `agent-mbw4-fe`) cung checkout `feat/mbw4-soc-ops`, cai hook moi wt. Disjoint BE↔FE tuyet doi; trong BE tuan tu (O-2). Cam `npm install` khi chua hoi (junction `node_modules` dung chung).
- **Stage 4 — Code:** BE truoc (API), FE theo contract. `npx tsc --noEmit` sau moi sub-step (FE). Cam `Get-Content|Set-Content` (L-F04), cam `git checkout --` (L-A01 — dung `git show HEAD:<f> > <f>`), cam shell string-op tren file repo. Sau moi lenh test/screenshot: `git status --short`, revert san pham phu (L-V03).
- **Stage 5 — Audit code + loop:** 0 blocker moi merge; major → loop sua + re-audit toi `Gate 4→5 DONG`.
- **Stage 6 — Gates VPS (nguyen van handoff §6, nho `CORE_DB_PASSWORD`):** worktree `/tmp/wt-mbw4-*`, DB rieng `mbw4_be`/`mbw4_reg`, docker run `--network vninvest-staging_vninvest_network`, `-m django` chu thuong, PW server-side khong quote long; FE bang `/usr/bin/corepack npm`, tai dung `node_modules` Linux bang symlink khi lock trung. Tranh `|` trong remote quotes.
- **Stage 7 — Merge + trail:** rebase → check migration → gate (dung thu tu, L-G01) → 1 PR (`--merge`, giu trail) → claims `released` → ledger Entry N+1 → handoff wave tiep theo.
- **Stage 8 — Cleanup:** xoa nhanh local/remote + worktree local/VPS + DROP DB `mbw4_*` (+ `mbw1_wave` neu xac nhan orphan). `prune` worktree.

## 3. Nguong DONG wave (ke thua Wave 3, khong ha)

BE labels scope + guard · FE suite · `i18n:scan` **0 thieu** · `npm run build` + bundle **≤1450 KB** (Wave 3: 1361.0/1363.3) · `tsc` **0** · `makemigrations --check` 0 + **1 leaf** · `check-multi-agent` 0 loi · pre-push 22/22. Moi so kem command + exit code; thieu moi truong → `CHUA CHAY` (L-G02).

## 4. Bay da biet (dung lap)

`global-config-drift` FAIL moi checkout → `node tools/opencode-global/deploy.mjs`, khong `--no-verify` (tru ly do trong body); cot `files` cua claim path thuan, khong ngoac; mount ngoai scope → guard optional-read + rerun; worktree remove con `node_modules` 733MB → symlink/dòi truoc; `numstat` deletions bat thuong → dung kiem tra line-ending (L-T01); citation dung so nhung sai file → mo dung file doc nguyen van (L-T02); script do phai co control biet dap an (L-V01); gate worktree do nhung main xanh → thi nghiem doi chung, khong doan (L-G08); do bundle bang canh import TINH, `import()` dong la lazy chunk (L-F01).
