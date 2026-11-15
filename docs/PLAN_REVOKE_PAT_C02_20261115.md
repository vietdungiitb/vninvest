# PLAN — C-02: Revoke PAT tung lot log staging (2026-11-15)

> **Slice:** C-02 (P0 bao mat, ops-only: 0 dong code) · **Claim:** `revoke-pat-c02`
> **Branch:** `feat/revoke-pat-c02` · **Base:** `dev@92a294d11`
> **Uy quyen:** Owner xac nhan "23 PAT khong con ai dung, xoa di duoc" (2026-11-15)
> **Ket qua that:** cua so 7d thay **140 raw** (23 la cua so 24h) → revoke **133** (nhom A EXPIRED), giu 6 ACTIVE (5 human login + 1 machine E2E) + 1 da vo hieu — Owner chot chi nhom A.
> **Pham vi DB:** STAGING (`vninvest-core-db` / `vninvest_core`) — KHONG cham production
> **Lessons ap dung:** [L-S01 L-S02 L-002 L-M02 L-V01 L-V02 L-G02 L-B01 L-T01 L-T02] + quy tac SSH (bare-args/scp-script, de xuat L-T05 treo vi C2 day)

## 1. Bang chung B1 (da tu mo doc)

| File | Dong | Thuc te |
|---|---|---|
| `identity_access/models.py` | 28-41 | PAT shape `vni_<plan>_tokenurlsafe(48)` (grep duoc); prefix = 12 ky tu dau (index, khong phai secret); hash = HMAC-SHA256 voi `CORE_PAT_PEPPER` |
| `identity_access/models.py` | 334-346 | `resolve_from_raw_secret` tra credential neu chua REVOKED, nguoc lai `None` |
| `identity_access/models.py` | 392-398 | `revoke_pat(reason)` → status REVOKED + `revoked_at`/`revoked_reason` (giu audit trail — KHONG DELETE row) |
| `identity_access/models.py` | 294, 400-403 | `last_used_at` de kiem chung "khong ai dung" |
| VPS staging env | (ten bien) | Co `CORE_PAT_PEPPER` → container revoke PHAI nap `--env-file compose.staging.env` (thieu pepper = hash lech = am tinh "da vo hieu hoa") |
| `MEASUREMENTS_20261115.md` | §log | 23 PAT khac nhau trong 24h (WS 277 hit + SSE 7 hit) |

## 2. Thiet ke (3 pass + cong Owner, fail-closed)

> Sua theo audit B3 vong 1 (O1-O3): `record_usage()` co 0 caller trong `src/`
> (nhung `middleware.py:384-392` co the ghi `last_used_at` truc tiep — pass 2 se doc DB
> that thay vi doan NULL). Mobile van dung `?token=`
> (`packages/mobile/src/services/realtime.ts:19`); cac duong `?token=` tuong thich con lai:
> WS consumers (`signal_intelligence/consumers.py:38-52`), `resolve_user_from_ws_query`
> (`identity_access/ws_ticket.py:49`), 4 SSE `initial()` (giua C-01), va mint-gate
> (`views_ws_ticket.py:35`, machine PAT giu `?token=`). Vi vay pass 2 phan loai bang tin hieu
> thay the, va pass 3 chi chay tren danh sach Owner chot theo prefix.

- **Pass 1 — trich:** nhu cu (7d, sort -u, 0600, chi in so luong; lech 23 thi giai thich bang cua so).
- **Pass 2 — phan loai (chi doc):** Django script `resolve_from_raw_secret` tung raw; in
  `prefix|label|sa|tenant|human|status|effective|created_at|log_last_seen` (KHONG in raw/hash).
  Tin hieu thay the cho `last_used_at` chet: (a) `log_last_seen` — raw xuat hien trong log
  = secret da di chuyen gan day; (b) `created_at` + `label`/`sa` (vd `e2e:*`, `test`, `ci`
  = automation dung 1 lan). Hoa giai "khong ai dung" vs "23 PAT trong log 24h": log chi
  chung minh secret BI RO RI (bundle cu pre-C-01 gan moi `access_token` vao URL), khong chung
  minh client hop le CAN no — tinh hop le do Owner quyet theo label/SA.
- **Cong Owner (bat buoc truoc pass 3):** dua bang phan loai (prefix + label) cho Owner;
  Owner chot danh sach prefix duoc revoke (du kien toan bo 23 theo uy quyen da cho;
  ngoai le: PAT nao label/SA goi y mobile/broker/prod-client that).
- **Pass 3 — revoke + verify:** chi revoke prefix trong danh sach chot.
  `revoke_pat('C-02 owner-approved 2026-11-15: leaked in access log')`; sau do re-`resolve`
  tat ca raw → bat buoc **100% None**; 1 mau POST `/auth/ws-ticket/` bang 1 raw vua revoke
  → bat buoc 401/403.
  cho tung ACTIVE; sau do re-`resolve` tat ca raw → bat buoc **100% None**; 1 mau POST
  `/auth/ws-ticket/` bang 1 raw vua revoke → bat buoc 401/403 (chung minh duong xac thuc chet that).
- **Kiem cheo:** container dung image `vninvest-core-api:staging` + `--env-file` staging
  (pepper that) + mount code worktree hien tai; DB that staging (KHONG DB tam — muc tieu
  chinh la vo hieu hoa credential that).

## 3. AC (Given/When/Then)

- **AC1:** Given raw trich tu log, when pass 2 chay, then moi raw duoc phan loai voi prefix + label/SA/human/created/log_last_seen — khong raw nao lot; mau thuan "unused vs in-log" duoc ghi ro cach hoa giai.
- **AC2:** Given bang phan loai, when Owner chot danh sach prefix, when pass 3 chay, then so credential chuyen REVOKED = so prefix duoc chot, `revoked_reason` ghi dung; PAT ngoai danh sach khong bi cham.
- **AC3:** Given revoke xong, when `resolve_from_raw_secret` lai + POST ws-ticket bang raw cu, then 100% None + 401/403.
- **AC4:** Khong gia tri secret nao xuat hien trong log tool, evidence, ledger, chat (chi prefix/label).

## 4. SCOPE + LIMIT + non-goals

- **SCOPE:** 0 file code; docs: plan + evidence + claim + ledger. Thay doi runtime: status 23 credential tren STAGING.
- **LIMIT:** 3 vong; PAT la (mobile/broker/prod-client) hoac Owner khong chot → `blocker`, DUNG (khong tu y mo rong).
- **Non-goals:** khong rotate (khong ai dung → khong can thay the); khong purge lich su/log (log nginx se cuon tu nhien); khong cham production; khong DELETE row (giu audit).

## 5. Rollback

Revoke la 1 chieu ve mat bao mat (khong "un-revoke" de dung lai — dung PAT moi thay vi mo lai).
Neu revoke nham (client that bi 401): cap PAT moi cho client do theo quy trinh hien co.

## 6. MANDATORY CHECKLIST

- [ ] Claim commit rieng truoc lenh VPS dau tien; branch `feat/revoke-pat-c02`
- [ ] Pass 1+2 chay truoc; cong Owner chot danh sach prefix truoc pass 3
- [ ] PAT ngoai danh sach chot khong bi cham (kiem bang re-resolve + dem REVOKED)
- [ ] Container nap dung pepper staging (verify bang cach: resolve duoc >=1 ACTIVE truoc khi revoke — neu 100% None ngay tu dau thi nghi pepper sai, DUNG)
- [ ] Moi output chi co prefix/label, khong raw/hash
- [ ] B3 + B8 audit co verdict van ban; claim done + Entry ledger + PR merge
