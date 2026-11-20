# Full BE gate sau bump vnbroker 3.8.2 (2026-11-20)

- **Scope**: chạy `python manage.py test -v 1` toàn bộ backend sau khi bump pin `vnbroker==3.8.2` (Entry 576).
- **Môi trường**: VPS staging `14.225.255.47`, container `vninvest-core-api` (Django 5.2.19), cây backend đầy đủ (`packages/core/backend` gồm `src/`, `scripts/`, `tests/`, `manage.py`) copy sang `/tmp/corp_fullbe2`, DB tạm `corp_fullbe_verify` (đã drop sau chạy). Không đụng `/app`, không Docker local, không DB `vninvest_core`.

## KẾT QUẢ THẬT

```
Ran 3574 tests in 284.397s
FAILED (failures=36, errors=221, skipped=7)
```

| Nhóm | Số liệu | Đánh giá |
|---|---|---|
| Pipeline corporate actions (6 module) | **66/66 OK** (Entry 574, chạy riêng trước bump; Entry 576 giữ baseline) | ✅ |
| Full BE suite | 3574 tests, 36 fail / 221 error | 🔴 **KHÔNG PASS** |
| Hit `corporate`/`adj_close`/`ohlcv` trong danh sách fail/error | **0** | ✅ Không có dấu hiệu lỗi do pipeline |

## NGUYÊN NHÂN ĐÃ THẤY (không quy kết cho pipeline)

- Lần chạy đầu (chép chỉ `src/`): thiếu `scripts/check-envelope-contract.py` ⇒ 2 ImportError; đây là lỗi **harness copy**, đã sửa bằng cách chép cả cây backend.
- Nhiều error từ `user_workspace.tests.test_ledger_migration_backfill` / `test_schema_not_polluted_by_migration_tests`: chính thông báo lỗi ghi rõ *"module test_ledger_migration_backfill để lại schema ở trạng thái nửa vời, mọi test chạy sau đều chạy trên schema khác"* ⇒ ô nhiễm thứ tự test, pre-existing.
- Các fail/errors khác nằm ở `user_workspace`, `vninvest_core`, `service_ops`, `tests` (tenant isolation, openapi envelope, advisory status…), **không chạm** `market_data/corporate_actions`.

## ĐIỀU CHƯA LÀM ĐƯỢC / CẦN BASELINE

- **CHƯA CHẠY**: cùng lệnh full suite trên checkout sạch **trước** pipeline (base `504c8…` trước PR #458) để so sánh failures/errors. Không có baseline đó ⇒ **không khẳng định** 36/221 là pre-existing 100%; chỉ khẳng định không có hit corporate actions và 66 test pipeline xanh riêng lẻ.
- Theo `AGENTS.md` baseline cũ ghi `602 test — failures=10, errors=3` ở một mốc cũ (khác số test hiện tại 3574) — **không so sánh trực tiếp** (L-E07: khác lần chạy/khác cây).

## GATES KHÁC

| Gate | Kết quả |
|---|---|
| `node packages/web/scripts/check-multi-agent.mjs` | exit 0 |
| `node docs/system-design/_meta/tools/check-system-design.mjs --check` | SẠCH (Entry 574) |
| `tsc --noEmit` (pre-push gate) | PASS |
| FE `npm run build`, deploy staging, E2E | **CHƯA CHẠY** |

## KẾT LUẬN / NEXT

- Bump 3.8.2 + re-probe (Entry 576) **đạt**; pipeline riêng xanh.
- Full BE suite **chưa đạt ngưỡng phát hành** theo nghĩa "xanh tuyệt đối" — cần baseline sạch để phân loại 36/221. Owner nên chạy baseline parallel hoặc waiver có lý do trước khi deploy.
- **Không bật** `CORPORATE_ACTIONS_ENABLED`; **không deploy** staging khi full gate chưa xanh/waiver chưa có.
- Chuyển ingest sang `VCI.corporate_actions()` (field số) vẫn là slice riêng, chỉ sau khi full gate + Q1/Q2 xong.

**Lessons**: `[L-V01, L-V04, L-E04, L-E07]` — một lần gate đỏ không đủ kết luận; đọc output thật; không so số giữa 2 lần chạy khác cây; không báo PASS cho thứ chưa chạy.
