# C-01 gates — SSE ticket (bo PAT khoi URL)

> **Slice:** C-01 · **Claim:** `sse-ticket-c01` · **Branch:** `feat/sse-ticket-c01`
> **Base:** `dev@ad857b6c3` · **Commit code:** `133baacbc`
> **Plan:** `docs/PLAN_SSE_TICKET_C01_20261115.md` · **Audit B3:** AGREE (vong 2) · **Re-audit B8:** xem §6

## 1. Fail-before (do, chay that tren code cu)

| Test | Code cu | Trang thai |
|---|---|---|
| `src/hooks/sseTicket.component.test.tsx` (moi, 6 test) | URL chua `token=pat-...`, khong goi `/auth/ws-ticket/` | **6/6 DO** (exit 1) |
| Ghi chu | File dat ten `.ticket.test.tsx` bi vitest include loai (`src/**/*.component.test.*`) → doi ten `sseTicket.component.test.tsx` | lesson nho: doc include truoc khi dat ten file |

## 2. Pass-after (local iteration — khong phai ket qua chinh thuc theo §12)

| Cong | Ket qua |
|---|---|
| vitest 3 file C-01 (`sseTicket` + `useSignalStream` + `useAlertCenterStream`) | **19/19 PASS** (4.69s) |
| vitest mo rong (them `fetch-ws-ticket` + `AlertCenterPage` + 3 soc panel) | **8 file / 66 test PASS** (12.48s) |
| `npx tsc --noEmit` (packages/web) | **exit 0** |
| `check-multi-agent` | **PASS** (0 loi, 0 trung migration) |
| `scan-secrets` | **OK** (4718 file, 0 secret) |
| `check-lessons` | **sach** (14 file, 60/60) |
| `pre-push-gate` | **5 FAIL / 31 PASS / 0 SKIP** — Y HET baseline `dev` sach (3 thieu Python that + `system-design` + `global-config-drift`); `ui-check-token-conflict` van xanh sau khi xoa token khoi URL |

## 3. VPS staging (ket qua chinh thuc theo §12)

### 3a. BE targeted (§12.3) — DB tam `sse_c01`, worktree `/tmp/wt-sse-c01`

Labels: `service_ops.tests.test_soc_sse_ticket_c01` (moi, 9 test) +
`tests.test_ws_ticket` + `signal_intelligence.tests.test_alert_center_stream` +
`service_ops.tests.test_soc_signals_stream` + `service_ops.tests.test_soc_overview_stream`

- **Vong 1** (`133baacbc`): **51 tests, 47 PASS / 4 FAIL** — ca 4 fail la test moi dung
  sai prefix `/operator/soc/*` (404). Route that la `/api/soc/*`
  (`vninvest_core/urls.py:77`; `/operator/` da decommission). Tinh co nay chung minh
  `?token=` tuong thich van chay (warning `sse_token_query_deprecated` da fire dung
  cho Signals/Overview). Tat ca test cu (ws-ticket, alert-center, signals, overview) PASS —
  khoa mint machine PAT khong vo regression.
- **Vong 2** (`6144667ca`, sua prefix + docstring): **51/51 OK** (`Ran 51 tests ... OK`,
  `TESTS_EXIT=0`, DB `sse_c01` da DROP). Log xac nhan: `403 /auth/ws-ticket/` cho machine PAT;
  `sse_token_query_deprecated` fire cho Signals + Overview; ticket sai/tai-dung/non-staff
  ve 401/403 dung. Worktree `/tmp/wt-sse-c01` giu lai cho FE step4.

### 3b. FE targeted (§12.4) — worktree `/tmp/wt-sse-c01`, node_modules Linux tai dung
(`LOCK_MATCH` voi `/tmp/wt-gatep0-fix`)

**8 file / 66 test PASS** (`FE_TESTS_EXIT=0`, 8.89s, Linux): sseTicket 6 + useSignalStream 9 +
useAlertCenterStream 4 + fetch-ws-ticket 3 + AlertCenterPage 18 + soc-queue-depth 2 +
soc-p2 8 + soc-overview-tab 16. Stderr chi co React Router Future Flag warning co san.

## 4. CHUA CHAY (ghi ro, khong PASS khong)

- Full FE suite (C-07) · Full BE suite (C-08) · `npm run build` tren VPS.
- BE tests khong chay local (may khong co Python that — L-B01/L-G02).

## 5. Doi chieu audit B3

- O1 (thieu 2 hook) → scope 14 item, AC1 bao 4 hooks. O2 (escalation) → khoa mint machine PAT + AC2b/AC5.
- O3 (helper chet) → 3 helper nhan `ticket?`, khong doc localStorage. O4 (async) → cancelled re-check + fresh ticket + fail-closed + test async.
- O5 (compat) → redeem fail set-nothing/raise-nothing + warning ASCII. Vong 2: **AGREE** + 2 nit khong chan (da sua).

## 6. Re-audit B8 (sau khi co ket qua VPS)

**Verdict: AGREE** (+1 reservation: auditor doc lap doc lai toan bo code/file:line,
khong chay lai test — so lieu run lay tu bao cao; arithmetic 6+9+4+3+18+2+8+16=66
va 9 BE methods da doi chieu khop). 0 blocker, 0 major. Ghi chu: WS helper van doc
`localStorage access_token` o 4 cho cho header/mint (khong phai URL) — ngoai scope SSE,
khong chan slice.
