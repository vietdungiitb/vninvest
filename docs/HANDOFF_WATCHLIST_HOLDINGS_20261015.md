# HANDOFF — Triệt để watchlist/holdings/broker trên staging (DONE)

Ngày: 2026-10-15 · Owner chốt: deploy `docker.edusuccess.vn` + mount tùy ý + migrate/FERNET triệt để.
Claims: `ops-staging-redeploy` + `fe-watchlist-mount` + `be-holdings-source` = done · PR #154 (BE) + #153 (FE) merged · Ledger Entry 323.

## 1. Vì sao ảnh chụp là chức năng cũ (đã chứng minh, không đoán)

- Staging deploy cuối 2026-10-13 (rev `fd8b3f64d`, PR #121); Wave 1–4 merge 2026-10-15.
  Ảnh 2 khớp từng chữ với `PortfoliosBrokerPage` bản `33fd9a346` (title
  `portfoliosManage.broker.title` + link về quản lý + `DNSEConnectionPanel`) —
  bản này đã thành redirect về `/broker` từ B2.6 (`3c13583ae`).
- Kể cả sau deploy vẫn thiếu 2 thứ thật: `ScopedWatchlist` 0 nơi mount (grep 13
  match toàn file của nó) + holdings không per-row `source` (badge fail-closed null).

## 2. Đã làm (dev 47ad6f630, staging đã deploy lại 2 lần)

- OPS: backup DB 318MB → `DNSE_CREDENTIAL_FERNET_KEY` append server-side (thiếu
  thật) → migrate 0023→0030 theo entrypoint, `makemigrations --check` sạch.
- BE (PR #154): per-row `source` từ `portfolio.kind` + `meta.kind`, không
  migration, không đổi shape `data`. Test VPS 40 OK (fail-before RED 3).
- FE (PR #153): mount `ScopedWatchlist` vào `BrokerAccountPage` (theo
  accountId: manual + derived) + `WatchlistPage` (manual). Test 18/18 + tsc 0 +
  i18n:strict 0 + build 38s.
- Verify staging: bundle có `BrokerHubPage-*` + `ScopedWatchlist-*`, public
  `/broker` 200, BE deploy có `'source': source`, leaf 0030.

## 3. User kiểm tra thế nào

1. Mở `https://docker.edusuccess.vn/broker` → phải thấy **"Broker Hub"** + 3 tile
   DNSE/SSI/TCBS (không còn trang "Kết nối broker & đặt lệnh" cũ).
2. `/broker/accounts/:id` → có SyncCenter + "Gộp danh mục" + "Danh mục theo dõi
   theo phạm vi" (manual + "Đang nắm giữ @ ...").
3. `/watchlist` → thêm khu vực manual theo scope. Holdings có badge nguồn
   (Thủ công/Liên kết broker/Tổng hợp) sau khi BE trả `source`.

## 4. Còn lại / CHƯA CHẠY

- E2E đăng nhập thật, kết nối broker thật, tạo watchlist thật (không staff creds).
- Full BE suite, ruff, đối chiếu UI bằng mắt.
- Dọn: worktree `/tmp/wt-be`, DB tạm `hs_red/hs_green/hs_green2`, script
  `/tmp/*.sh` trên VPS; branch `feat/holdings-source`, `feat/watchlist-mount`
  (local + remote) sau khi xác nhận ổn định.
