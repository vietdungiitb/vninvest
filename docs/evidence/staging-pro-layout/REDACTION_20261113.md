# Redaction note — staging-pro-layout/facts20.json (2026-11-13)

> **Slice:** `gate-p0-20261113` (D0, gate xanh). **Ledger:** Entry 476 (sau khi merge). **Claim:** `gate-p0-20261113` = in-progress.

## 1. Cai gi da lam

`docs/evidence/staging-pro-layout/facts20.json` (commit tracking, evidence cua `staging-pro-layout` slice) chua 4 dong trong mảng `errors` chua token WebSocket that:

- `token=vni_internal_<77 ky tu>` (lặp 4 lần, `sha256=ec8f9b90`).
- Scanner `packages/web/scripts/scan-secrets.mjs` phat hien o dong 7-10 va chan moi push (`secret-scan` CI do 5/5 run gan nhat).

Da thay ca 4 gia tri bang `vni_internal_REDACTED` (scanner bo qua marker `REDACTED` — `scan-secrets.mjs:211,232`). Phan text loi (`WebSocket connection to 'wss://.../ws/realtime/?token=...' failed: ...`) giu nguyen de evidence van co gia tri.

## 2. Rui ro con lai (Owner)

- Token that `vni_internal_rTrN...11y6_` (77 ky tu, sha256 `ec8f9b90...`) da **LO TRONG GIT HISTORY** (repo private `vietdungiitb/vninvest`). Redact chi che mat nguoi doc, KHONG giam rui ro neu token con song. **Gia tri day du KHONG duoc ghi lai trong repo** (xem §3b) — Owner can lay token canh bang tien to + hau to + sha256, hoac tim trong git history cua repo private.
- **Owner phai revoke/rotate token** tren he thong cap PAT (`vni_internal_*`). Sau khi revoke, token cu tra 401 (kiem bang 1 request — CHUA CHAY neu khong co token).
- Purge history (git filter-repo) **khong lam** trong slice nay: repo private, Owner quyet dinh rieng (Non-goal PLAN_REMAINING_WORK A§8).

## 3. Gate ket qua (chay that, sau redact)

- `node packages/web/scripts/scan-secrets.mjs` ⇒ exit 0, 0 hit `facts20.json`.
- `git grep -l "vni_internal_"` co the tra ≥1 file (chinh plan/evidence prose) — KHONG dung lam AC; AC la `scan-secrets` exit 0 + 0 file runtime/evidence chua token that.

### 3b. BAI HOC: `scan-secrets` exit 0 **KHONG** chung minh repo sach secret

Ban redact dau tien chi sua `facts20.json`, nhung **chinh file note nay** lai ghi nguyen **gia tri token that**
(dong 16 cua ban goc) ⇒ secret van nam trong repo **va** se bi day len GitHub khi push.

**Vi sao scanner khong bat?** `scan-secrets.mjs` dung **rule contextual**: gia tri phai dung **ngay sau mot key name**
(`token=...`, `api_key=...`). Token nam trong backtick `` `vni_internal_...` `` trong prose `.md` ⇒ **khong co key name
lien ke** ⇒ rule khong kich hoat ⇒ **PASS gia** (false negative). File `.md` tracked **co** duoc quet
(`scan-secrets.mjs` self-test: *"tracked .md IS scanned"*) — van sai vi rule, khong phai vi skip file.

**Da sua (2026-11-13, vong 2):** dong nay chi con **tien to + hau to + sha256** ⇒ Owner van dinh danh duoc token can revoke,
ma secret khong con nam trong file tracked nao. Gate chong le: `git grep -c "<token-that>"` (dien **chuoi token that**,
KHONG ghi token that vao file nay) ⇒ **0 hit** tren toan repo (lenh nay moi la AC that, khong phai `scan-secrets`).

> **Bai hoc chung:** `scan-secrets` exit 0 ⇒ *"khong co mau hinh secret bi quet"*, **KHONG** phai *"repo khong con secret"*.
> Muon chung minh token da sach: `git grep` **chinh xac chuoi token**, khong dua vao exit code cua scanner.


## 4. Thay doi

- 1 file sua: `docs/evidence/staging-pro-layout/facts20.json` (4 replacement, +0/-0 dong, chi doi gia tri).
- 1 file moi: `docs/evidence/staging-pro-layout/REDACTION_20261113.md` (file nay).

## 5. Khong lam

- Khong purge git history (Non-goal).
- Khong sua token trong cac file khac (da do: chi 1 file chua token).
- Khong sua runtime/BE/FE.