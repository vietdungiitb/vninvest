# BE gates — mbw3 (supervisor chạy lại, F4)

Ngày: 2026-10-15 · Người chạy: supervisor/PM · Nhánh: `feat/mbw3-isolation`
VPS: `14.225.255.47` · Worktree: `/tmp/wt-mbw3` · DB tạm: `mbw3_reg` (đã dọn sau chạy)

## 1. Regression suite broker (runbook §12.3)

Lệnh (PW server-side, không quote lồng):

```bash
docker run --rm --network vninvest-staging_vninvest_network \
  -v /tmp/wt-mbw3/packages/core/backend:/app \
  -e CORE_DATABASE_URL=postgresql://vninvest:${PW}@vninvest-core-db:5432/mbw3_reg \
  -e DJANGO_DEBUG=1 -e DJANGO_SETTINGS_MODULE=vninvest_core.settings \
  --entrypoint python vninvest-core-api:staging \
  -m django test <12 labels> --noinput
```

Labels: `test_broker_account_guard`, `test_broker_bindings_read`,
`test_broker_capabilities`, `test_broker_drift`, `test_broker_lane_wiring`,
`test_broker_sync_beat`, `test_broker_sync_service`, `test_broker_sync_views`,
`test_position_sync`, `test_portfolio_kind_guard`, `test_portfolio_kind_binding`,
`test_subaccount_backfill_contract` (tiền tố `user_workspace.tests.`).

| Lần | Code | Kết quả |
|---|---|---|
| 1 (sau gộp 2 slice + mount, trước loop) | `1e875e6db` | **101 tests OK** |
| 2 (sau loop F1 4 test mới — cùng code BE) | `1e875e6db` | **101 tests OK** |
| 3 (riêng guard module, `-v 2`) | `1e875e6db` | **22 tests OK**, gồm 4/4 `AggregateGuardLoopTests` (403 `aggregate_read_only` đúng thiết kế) |

## 2. Migration

- `makemigrations --check --dry-run` (VPS, cùng container): **No changes detected**.
- Leaf: `0030_backfill_dnse_broker_backed` → depends `0029` (1 leaf, không tự đặt số).

## 3. Ghi chú lệch runbook

- Runbook §12.3 bước 2 ghi `POSTGRES_PASSWORD` — **stale**. Biến thật là
  `CORE_DB_PASSWORD` (xác minh: `grep -E "^[A-Z_]+PASSWORD=" compose.staging.env`
  chỉ ra `CORE_DB_PASSWORD`, `GRAFANA_ADMIN_PASSWORD`). Lần chạy đầu auth fail
  vì thế (phát hiện của agent BE). Đề nghị sửa runbook ở PR sau.

## 4. CHƯA CHẠY (trung thực)

- Full BE suite · ruff (nợ từ Wave 2, giữ nguyên).
- Đếm B3.4 leftovers trên staging-read: schema staging chưa có cột mới
  (chưa deploy) — dời sau deploy, B3.4 giữ partial đúng contract.
- E2E 2 SubAccount thật (ticket TEST-E2E riêng).
