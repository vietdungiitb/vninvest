# C-02 evidence — revoke PAT lot log staging

> **Slice:** C-02 · **Claim:** `revoke-pat-c02` · **Branch:** `feat/revoke-pat-c02`
> **Plan:** `docs/PLAN_REVOKE_PAT_C02_20261115.md` · **Uy quyen:** Owner (chat 2026-11-15)
> **Pham vi DB:** STAGING (`vninvent-core-db` / `vninvest_core`) — khong cham production.

## 1. Pass 1 — trich log (VPS, chi in so lieu)

- Cua so 7d (`docker logs nginx-proxy --since 168h`): **140 raw distinct** (khac 23 cua
  cua so 24h ngay 15/11 — lech do cua so, da giai thich).
- Hits/ngay: 8k–35k/ngay, con hit trong ngay 15/11 (06:45Z).
- Tat ca prefix `vni_internal` (plan `internal`) + 1 `vni_starter_`.
- File raw nam tren VPS (`/tmp/c02_pat_raws.txt`, 0600), KHONG dua ve local.

## 2. Pass 2 — phan loai (chi doc, Django tren staging)

| Nhom | So luong | Dac diem | Quyet dinh Owner |
|---|---|---|---|
| A — effective EXPIRED | 133 | human `login:admin`/`login:testuser`, co `expires_at` ngan → auth da tu choi | **REVOKE** (da chon) |
| B — effective ACTIVE | 5 | human `login:*`, tao trong 24h (idx 14/20/67/108/118) — session ai do dang dung hom nay | GIU |
| C — machine E2E | 1 | `widget-ws-e2e-2026-11-14`, SA default, tenant qa-qa_bank, hit 14/11 13:26Z | GIU |
| Da vo hieu san | 1 | `resolve` → None | Khong lam gi |

- Hoa giai mau thuan: log = BI RO RI (bundle pre-C-01), khong phai bang chung client can PAT.
- `last_used_at` = `never` toan bo (xac nhan `record_usage()` chet) → dung `log_last_seen` + `created_at`/label thay the.

## 3. Pass 3 — revoke nhom A + verify

- `REVOKED_COUNT=133`, `SKIPPED_ACTIVE=[14,20,67,108,118,139]` (5 human + 1 machine E2E),
  `ALREADY_NONE=1` (tong 140: 133 + 6 + 1, khop pass 2).
- `VERIFY_NONE=134` (133 moi + 1 cu), `VERIFY_STILL_ACTIVE=6` — khong PAT ngoai danh sach bi cham.
- Probe API (voi Redis staging that `core-redis:6379/3`): revoked → **401**, active → **200 + ticket**
  (`C02_PROBE_OK`). (Probe dau 500 do container thieu `REDIS_URL` — loi harness, da sua.)
- VPS da don: `/tmp/c02_pat_raws.txt` shredded, script tam da xoa (verify `ls /tmp` khong con).

## 4. Audit

- B3 vong 1: NEED_REVISION (O1 guard chet, O2 mau thuan, O3 mobile/machine) → sua plan.
- B3 vong 2: **AGREE** (+2 nit doc, da sua).
- B8: (chay sau pass 3).

## 5. CHUA CHAY / non-goals

- Khong rotate (khong ai can thay the), khong purge log, khong DELETE row, khong cham production.
- Nhom B/C xu ly sau khi xac minh client (ngoai slice nay).
