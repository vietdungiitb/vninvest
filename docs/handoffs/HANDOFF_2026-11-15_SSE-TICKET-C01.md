# HANDOFF — C-01 SSE ticket xong (2026-11-15), san sang giao phien

> **Ngay:** 2026-11-15 · **Nguoi ban giao:** agent (session continuation, vong kin 9 buoc)
> **Base:** `dev@1725e526d` (= `origin/dev`, working tree sach)
> **Slice vua xong:** C-01 — PR #424 **MERGED** · claim `sse-ticket-c01` done · ledger Entry 523

## 1. Da xong trong phien nay

- **P0 moi tu plan tiep tuc (Entry 522):** 4 hook SSE gan PAT vao URL → da bo.
  FE fetch ticket single-use truoc khi mo EventSource, fail-closed; BE 4 `initial()`
  uu tien `?ticket=`, giu `?token=` tuong thich co warning; `WsTicketView` tu choi
  machine PAT (khoa escalation — audit B3-O2).
- **Gate that:** BE VPS **51/51 OK** (DB tam da DROP) · FE VPS **66/66 PASS** (Linux) ·
  fail-before 6/6 DO · tsc 0 · check-multi-agent PASS · scan-secrets OK ·
  pre-push-gate 5 FAIL/31 PASS y baseline · B3 AGREE (vong 2) · B8 AGREE.
- **VPS sach:** worktree `/tmp/wt-sse-c01` da xoa, DB `sse_c01` da DROP, script tam da xoa.
  Chi tiet: `docs/evidence/sse-ticket-c01/gates.md` + `docs/PLAN_SSE_TICKET_C01_20261115.md`.

## 2. Viec tiep theo (thu tu de nghi)

| # | Viec | Owner | Ghi chu |
|---|---|---|---|
| C-02 | Revoke **23 PAT** tung lot log + xac nhan `GITHUB_TOKEN` | **Owner** | Agent khong co quyen; chi ghi ten file+dong, khong ghi gia tri |
| C-03 | Soak 24h: dem lai `ws/realtime/?token=` (=0) + `?ticket=` (>0) | Agent bat ky | Tu dong theo thoi gian, dem bang lenh §10 cua `MEASUREMENTS_20261115.md` |
| C-04 | Gate khong FAIL khi thieu interpreter (stub → SKIP) | Agent | Cham `scripts/pre-push-gate.mjs:359-455`, can self-test am tinh — 1 slice loop rieng |
| C-05 | Regex dem migration `^0` → `\d+_` + doc = **139** (+ `--write` freshness) | Agent | Nho, nhung cham gate script — 1 slice loop rieng |
| C-06 | `node tools/opencode-global/deploy.mjs` + verify 0 DRIFT | Agent | May-global, khong commit; ghi evidence |
| C-07/C-08 | Full FE/BE suite tren VPS (§12.3/§12.4) | Agent | Don C-09 truoc (disk 79%) |
| C-09 | Don rac VPS: `/tmp/wt-gatep0*`, 5 DB `ai_r4x/ai_r5x`, `compose.staging.env.bak-20261114` | Agent | **Cua agent khac** — kiem `pg_stat_activity` + xac nhan truoc khi xoa |
| C-10 | Append `released` cho claim stale + policy dem "trang thai moi nhat" | Agent | Append-only, khong sua dong cu |
| C-11/C-12/C-13 | echarts/i18n defer + E2E sidebar | Agent | Sau C-07 xanh |
| C-14 | Refresh `MASTER_TRACKING_2026Q4.md` (dang ghi sai "34 PASS / 0 FAIL") | Agent | Hoac thay bang con tro toi plan tiep tuc |
| C-15 | AI contract + broker 2-tier + free-trial | **Owner** | Chan moi slice UI/UX lien quan |

## 3. Trang thai ha tang (do that trong phien)

- Local `dev` = `origin/dev` = `1725e526d`, sach. VPS `/opt/vninvest` = `dev` (can pull sau merge nay).
- `pre-push-gate` baseline: **5 FAIL / 31 PASS** (3 thieu Python that + system-design 137/138/139 + global-config-drift 4 file). Push can `--no-verify` + ly do trong commit body (tien le Entry 522/523).
- `docs/LESSONS/`: **day C2 (60/60)** — de xuat L-T05 (SSH nested-quote nuot output; fix: bare-args/scp-script; ton ~15 phut) DANG TREO, cho Owner nang C2 hoac tach file. Khong tu them (se vo gate).
- Moi truong: khong `npm/pip install` khi chua hoi; test/build tren VPS staging; cam local Docker; deny-list §2 AGENT_PROTOCOL.

## 4. Bay moi rut ra (chua vao so lessons vi C2 day)

1. **SSH qua shell tool:** khong dung `"` long nhau (`bash -c 'ssh ... "..."'` mat output, exit van 0). Bare-args cho lenh don; `.sh` + `scp` + `ssh host bash /tmp/x.sh` cho lenh phuc tap.
2. **Vitest include** `src/**/*.component.test.*` — file `.ticket.test.tsx` bi loai silent; doc include truoc khi dat ten.
3. **Docstring co the sai prefix** (`/operator/` da decommission → `/api/`): citation phai mo urlconf (`vninvest_core/urls.py:77`), dung tin docstring.
