# Gates P0 — tắt ghi adj_close nhân đôi (2026-11-24)

Branch `feat/price-adjustment-p0` · Plan `docs/PLAN_PRICE_ADJUSTMENT_P0_20261124.md` (audit 3 vòng PASS).

## RED → GREEN
- RED: test mới `test_writes_disabled_by_default` → `AssertionError: 1 != 0`; `test_unparsed_is_per_date` expectation mới fail ⇒ 2 failures. F1 test (flag ON) đã xanh ngay cả trước khi implement — đúng AC-2.
- GREEN: **9/9 OK** trên VPS `14.225.255.47`, DB riêng `vnsaas_core` (kết nối tạm vào `vnsaas-staging_data`, đã ngắt). Test thứ 9 (`test_writes_disabled_preserves_stale_adj_close`) đóng reservation R1 của audit: seed stale `adj_close=999` + factor partial, flag OFF ⇒ vẫn 999 (nếu guard dời xuống dưới vòng reset thì test này đỏ).

## Thay đổi
- `market_data/corporate_actions/adjustment.py`: `import os`; guard `os.getenv('PRICE_ADJUSTMENT_WRITES_ENABLED','0') != '1' → return 0` **ở đầu hàm `apply_adjustments`** (dòng 83 sau docstring) — freeze cả reset lẫn ghi. Docstring ghi rõ nguồn VCI/KBS đã trả giá điều chỉnh ở `close`.
- Test: expectation `:70,71` đổi thành "không ghi"; thêm AC-1; F1 `:100-113` chạy với `@patch.dict(os.environ, {'PRICE_ADJUSTMENT_WRITES_ENABLED':'1'})` — giữ nguyên 4 assertion.
- `packages/core/backend/requirements.txt`: pin `vnbroker==3.9.0` (release PyPI đã verify ở repo vnbroker, tag v3.9.0 / main 8fa97b6).

## Gate khác
- `node scripts/check-multi-agent.mjs` — đã chạy ở bước sync, 0 lỗi.
- `node scripts/pre-push-gate.mjs` — 36 PASS / 0 FAIL (trước khi sửa P0; sẽ chạy lại trước push).
- FE test/build: không đụng FE trong slice này.

## Phạm vi / reservation
Không ghi đè `DailyPrice`; không bulk CafeF (ToS chờ owner trước P2); UI default giữ provider-adjusted tới P3. `CafefDailyPrice` giữ làm staging/đối chiếu.
