# STAGING DEPLOY + CURL PROOF — PR #556 (CVD 1D history)

- **Ngày:** 2026-11-26 · **PR:** #556 `feat/cvd-1d-history-be` → `dev`, **MERGED** @ merge commit `309e466fd`
  (`gh pr view 556 --json state,mergeCommit` → `MERGED`).
- **Review:** GitHub chặn tự approve PR của chính tác giả ⇒ ghi `gh pr review 556 --comment` với nội dung
  staff review (diff scope, legacy +187/−0, contract, evidence) trước khi merge. Merge dùng `--merge`
  (không squash) theo `AGENTS.md` §10.5.

## 1. Deploy (`scripts/deploy-staging.sh` trên VPS `14.225.255.47`)

VPS `/opt/vninvest` đang ở commit local `8792430b0` bị **diverge** với `origin/dev` (1 vs 101 commit)
và có 4 file hotfix vá tay. Trước deploy đã kiểm tra an toàn:

- `git diff --ignore-cr-at-eol origin/dev -- <4 file>` → **chỉ thiếu đúng 187 dòng của PR #556**;
  hotfix whale-CVD 325 dòng **đã có trong `dev`**.
- `git cherry -v origin/dev dev` → `- 8792430b0 ops(price-mig): pass PRICE flags...` ⇒ patch local
  **đã được port** sang `origin/dev` (PR #553, ledger Entry 643).
- Untracked `market_data/pricing.py` trên VPS là bản cũ hơn `dev` ⇒ backup `/tmp/pricing_local_backup_20261126.py`
  rồi dời ra khỏi cây; 4 file tracked được `git stash push -m cvd1d-deploy-20261126`.
- `git reset --hard origin/dev` (an toàn vì mọi patch local đã có upstream) → `bash scripts/deploy-staging.sh`.

**Kết quả deploy:** `DEPLOY_EXIT=0`, build image `vninvest-core-api:cutover` + `vninvest-staging-frontend`
xong, `API healthy`, compose config hợp lệ, **0 container chết**, 4 worker/beat chạy ổn định (0 restart,
mem 1–5%). Stash `cvd1d-deploy-20261126` đã `drop` sau khi deploy xanh. Domain: `https://docker.edusuccess.vn/`.

## 2. Curl proof (HTTP thật qua nginx, không phải test client)

PAT tạm (`market:read`) được tạo bằng `CorePATCredential.issue_for_service_account` trong container
`vninvest-core-api` (`manage.py shell`), kèm header `X-Tenant-ID`, sau đó **đã xoá** — kiểm chứng
`SELECT COUNT(*) ... WHERE label LIKE 'cvd1d staging proof PR556%'` → **0**. Token không bao giờ được in.

| Request | Kết quả |
|---|---|
| `GET /core/v1/session-facts/CEO/cvd/?window=1D` | HTTP 200 · `bucket_count=1` · **không** có `period/history/date_from/date_to` · bucket cuối `delta=600590000`, `cumulative_cvd=600590000.0` (legacy per-session) |
| `GET /core/v1/session-facts/CEO/cvd/?window=1D&period=3M` | HTTP 200 · `bucket_count=61` · `period='3M'` · `history=true` · `date_from='2026-08-28'` · `date_to='2026-11-26'` · `unit='vnd'` |
| `GET …?window=1D&period=999M` | HTTP 400 · `code='UNSUPPORTED_PERIOD'` |

Trong 61 bucket history: 59 bucket zero-fill từ `DailyPrice` (`delta=0`, `07:00+07:00`) và 2 bucket whale:

| bucket_ts | delta | cumulative_cvd |
|---|---|---|
| `2026-11-25T07:00:00+07:00` | −816720000 | −816720000.0 |
| `2026-11-26T07:00:00+07:00` | +600590000 | **−216130000.0** |

⇒ Invariant `cumulative[i] = Σ delta[0..i]` đúng trên dữ liệu thật; `bucket_ts` tăng dần, local +07:00.
Legacy vẫn trả `bucket_count=1` (backward compatible AC-1). Đây là bằng chứng deploy chạy **code mới**,
không phải bản cũ (bản cũ không có `period`, không có zero-fill, không có `history`).

## 3. Lệnh tái tạo (không chứa secret)

```bash
# review + merge
gh pr review 556 --comment --body "..."
gh pr merge 556 --merge --delete-branch

# trên VPS
cd /opt/vninvest && git fetch origin dev && git cherry -v origin/dev dev   # '-' = patch đã port
git stash push -m cvd1d-deploy-20261126 -- <4 file hotfix>
git reset --hard origin/dev
bash scripts/deploy-staging.sh   # fetch/pull ff-only, build, up -d, verify

# proof: tạo PAT tạm qua manage.py shell, rồi
curl -sS -H "Authorization: Bearer $TOKEN" -H "X-Tenant-ID: $TENANT" \
  'http://127.0.0.1:8080/core/v1/session-facts/CEO/cvd/?window=1D&period=3M'
# xoá PAT/service account tạm sau khi curl
```
