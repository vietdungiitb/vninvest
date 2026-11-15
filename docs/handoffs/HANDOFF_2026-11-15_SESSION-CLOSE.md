# HANDOFF — Chot phien 2026-11-15 (C-01 + C-02 xong, repo ve dev sach)

> **Ngay:** 2026-11-15 · **Base:** `dev@479a38a4d` (= `origin/dev`, cay sach)
> **Phien nay lam:** C-01 (PR #424 merged) + C-02 (PR #426 merged) + handoff C-01 (PR #425 merged)
> **Doc truoc:** file nay (tong) → chi tiet tung slice trong Entry 523/525 → plan tiep tuc
> `docs/PLAN_CONTINUATION_20261115.md`

## 1. Trang thai slice (2/2 xong vong kin B1-B9)

| Slice | Noi dung | Gate chinh | Audit | Ledger | Claim |
|---|---|---|---|---|---|
| C-01 | Bo PAT khoi URL 4 SSE, ticket single-use human-only | BE VPS 51/51 · FE VPS 66/66 · tsc 0 | B3 AGREE (v2) · B8 AGREE | Entry 523 | `sse-ticket-c01` done |
| C-02 | Revoke 133 PAT het han lot log staging (Owner uy quyen) | 134 None/6 active · probe 401/200 | B3 AGREE (v2) · B8 AGREE | Entry 525 | `revoke-pat-c02` done |

- Group B (5 login con song) + C (1 machine E2E `widget-ws-e2e`) **GIU LAI theo Owner chot** — xu ly sau khi xac minh client.
- Raw secret KHONG co trong repo (B8 grep xac nhan); VPS da shred raw + xoa script tam.

## 2. Viec tiep theo (thu tu, chu + owner)

1. **C-03** (agent): soak 24h sau C-01 — dem lai `ws/realtime/?token=` (=0) + `?ticket=` (>0), append ledger.
2. **C-04 → C-05 → C-06** (agent, moi cai 1 slice loop rieng): gate tin cay — stub Python (3 FAIL), regex migration `^0` (doc 137/gate 138/that **139**), global-config-drift (4 file).
3. **C-07/C-08** (agent): full FE/BE suite tren VPS §12.3/§12.4 (don C-09 truoc, disk **79%**).
4. **C-09** (agent): rac VPS cua AGENT KHAC — `/tmp/wt-gatep0*`, 5 DB `ai_r4x/ai_r5x`, `compose.staging.env.bak-20261114`. Kiem `pg_stat_activity` + xac nhan truoc khi xoa. **Khong tu y dung.**
5. **C-10/C-14** (agent): claim stale + refresh `MASTER_TRACKING_2026Q4.md` (dang ghi sai "34 PASS / 0 FAIL").
6. **C-11/C-12/C-13** (agent): sau C-07 xanh.
7. **C-15 + nhom B/C cua C-02** (Owner): AI contract, broker 2-tier, free-trial, xac minh 5 login + 1 E2E con song.

## 3. Baseline gate (do that, khong tin van ban)

- Local/origin `dev` dong bo; `git status` sach; worktree chi con main tree.
- `pre-push-gate`: **5 FAIL / 31 PASS** (3 thieu Python that + `system-design` + `global-config-drift`) — day la baseline pre-existing, push can `--no-verify` + ly do trong commit body.
- `docs/LESSONS/`: **day C2 (60/60)** — de xuat L-T05 (SSH nested-quote nuot output; fix: bare-args/scp-script) DANG TREO, cho Owner nang C2 hoac tach file. Khong tu them.
- Branch con lai: `docs/audit-widget-pro-activation`, `feat/staging-pro-layout` (cua agent khac — KHONG dung). `main` khong dung.

## 4. Bay rut ra phien nay (chua vao so lessons vi C2 day)

1. **SSH quote:** lenh remote co `"` long nhau bi nuot output, exit van 0. Bare-args cho lenh don; `.sh` + `scp` + `ssh host bash /tmp/x.sh` cho lenh phuc tap.
2. **Vitest include** `src/**/*.component.test.*` — dat ten file sai bi loai silent.
3. **Docstring co the stale:** prefix `/operator/` da decommission → `/api/`; mo `vninvest_core/urls.py:77` thay vi tin docstring (L-T02).
4. **`record_usage()` chet** (`models.py:400`, 0 caller) → `last_used_at` NULL — dung `log_last_seen` thay the khi phan loai PAT.
5. **Pepper la silent-killer:** container thieu `CORE_PAT_PEPPER` → moi `resolve` tra None (tuong "da vo hieu"). Guard: 100% None ngay tu dau thi DUNG. Nho REDIS that `core-redis:6379/3` khi probe API ngoai test-runner.
