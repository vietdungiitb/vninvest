# Kế hoạch Phase 2 (`retire-close-consumers`): Ngừng consumer đọc `DailyPrice.close` trước khi backfill & DROP (2026-11-28)

- **Branch / Agent**: `feat/retire-close-consumers` / `retire-close-consumers` (tuân thủ L-M02, tách từ `origin/dev @ 51cea8fc9`).
- **Chỉ đạo Owner (2026-11-28)**: *"vẫn hủy close làm 2 rồi 3"* — giữ mục tiêu cuối cùng là xoá cột `DailyPrice.close` (Entry 688 bác rename thành `raw_close` vì `close` chứa dữ liệu ô nhiễm legacy), nhưng tách thành lộ trình 3 bước an toàn sau blocker Entry 690 (`BLOCKER_DROP_CLOSE_20261128.md`):
  1. **Slice này (Phase 2 — `retire-close-consumers`)**: Giữ nguyên cột `DailyPrice.close` trong DB (**0 migration, 0 DROP**). Chuyển toàn bộ runtime consumer hiển thị / tham chiếu / analytics / screener / advisory sang `effective_close` / `effective_ohlc` (SSOT), vá policy NULL (bỏ `raise ValueError`, cấm ép `None -> 0`), thêm bộ đếm quan sát `adj_close_null` (non-blocking) trong `integrity.py`, và gắn gate cơ học `scripts/check-dailyprice-close-usage.mjs` vào `scripts/pre-push-gate.mjs`.
  2. **Phase 3 (slice sau)**: Backfill `adj_close` cho ~930k dòng còn thiếu trên VPS staging (đo tiến độ bằng `adj_close_null`).
  3. **Phase 4 (slice cuối)**: Thêm `raw_close` (CafeF) + DROP `DailyPrice.close` có backup/checksum/lock window.
- **Lessons áp dụng**: `[L-001, L-002, L-003, L-005, L-007, L-008, L-M02, L-B01, L-B02, L-B03, L-V01, L-V02, L-V03, L-V04]`

---

## 1. Baseline & Inventory tái hiện được (trên `origin/dev @ 51cea8fc9`)

### 1.1 Lệnh tái hiện inventory toàn backend (không viết tay)
```powershell
git grep -n -E '\bclose\b' origin/dev -- packages/core/backend/src ':(exclude)*tests*' ':(exclude)*migrations*'
```
Lọc các token không phải đọc cột `close` (`.close(`, `def close`, `closed`, `adj_close`, `raw_close`, `prev_close`, `base_close`, `close_*`, comment) chỉ giữ `.close` attribute hoặc `'close'`/`"close"` literal:
- **Kết quả đo thật**: **175 hits trên 39 file** (`origin/dev @ 51cea8fc9`).

### 1.2 Phân loại toàn bộ 39 file (đóng Objection 1 của Rev.3)

| Nhóm | File (`packages/core/backend/src/...`) | Vai trò / Cách xử lý trong Phase 2 |
|---|---|---|
| **A. Runtime consumers chuyển sang SSOT trong Phase 2** | `market_data/pricing.py:41,49,64` | Hỗ trợ `dict` lẫn ORM qua `_field()`; bỏ `raise ValueError` ở `effective_close`; `effective_ohlc` ưu tiên `adj_close` khi bật flag và trả `None` nếu fallback `close` là `None`. |
| | `advisory/advisory_helpers.py:239-242` | Bỏ dòng nếu `p_close is None` (`continue`); O/H/L thiếu dùng `p_close` thay `Decimal('0')`. |
| | `user_workspace/screener_helpers.py:385-396,404` | Bỏ dòng có `e is None or e[3] is None`; H/L thiếu dùng `e[3]` (`close`) để giữ đồng bộ độ dài `closes`/`highs`/`lows`/`volumes` và không tạo `0.0` giả; bỏ so literal `price_source == 'cafef'` ở `:404` (thay bằng điều kiện F1 mọi nguồn có `adj_factor`+`adj_close` hợp lệ, trừ `vnbroker_legacy` không `adj_basis`). |
| | `market_serving/native_views.py:583,594-596` | `price_map[dp.date] = float(eff)` dùng `effective_close(dp)`, bỏ nếu `None`; ở `:594-596`: nếu `price is None` và `bucket['count'] == 0` (bucket rỗng sinh từ `DailyPrice`) thì bỏ bucket (`continue`), còn nếu có tick thì trả `price = None` thay vì `0.0` giả. |
| | `market_serving/vnbroker_materializer.py:107,195,201,235-251` | `.values()` lấy thêm `adj_close, adj_factor, price_source`; dùng `effective_close` / `effective_ohlc` (check `is not None`, không truthiness). |
| | `market_serving/materializers.py:83,106,113-114` | `.values()` lấy thêm `adj_close, adj_factor, price_source`; dùng `effective_close`; skip nếu `latest_close is None` thay vì `or 0`. |
| | `market_data/stock_mgmt_native_views.py:597,613,622,1641,1666-1688,1908-1909,2241,4294-4302` | Đọc qua `effective_close`/`effective_ohlc` (và `.values()` bổ sung `adj_close, adj_factor, price_source`). Ở `_aggregate_daily_to_ohlcv_bars` (`:4294-4302`): khi `adjusted=True` bỏ `unmapped_cafef`, truyền `enabled=(adjusted and _has_adjustment(row))` vào `effective_ohlc` (giữ nguyên guard chặn `vnbroker_legacy` stale không `adj_basis` và giữ contract `test_price_basis_s6.py` lẫn `test_m5_chart_points.py`), bỏ dòng nếu `effective_ohlc` trả `None` (không `or 0`). |
| | `advisory/views.py:969` | `.values('date', 'close', 'adj_close', 'adj_factor', 'price_source')` → `effective_close(r)` (bỏ qua khi `eff is None` trước `float(eff)`). |
| | `user_workspace/portfolio_analytics_views.py:632,2938-2947,3592,4594` | `_benchmark_returns`, whale snapshot fallback, screener `.only(...)` (thêm `open, adj_close, adj_factor, price_source`), backtest exit price → dùng `effective_close`. |
| | `user_workspace/management/commands/seed_qa_user_dataset.py:161,168` | `.values('symbol', 'close', 'adj_close', 'adj_factor', 'price_source')` → `effective_close(r)`. |
| **B. Allowlist tạm thời có gate cơ học (giữ đến Phase 3/4)** | `market_data/models.py:115,312` | Định nghĩa field DB `DailyPrice.close` & `IntradayBar.close` + `__str__`. |
| | `market_data/admin.py:53,128` | Django admin `list_display`. |
| | `market_data/serializers.py:23` | DRF serializer output key `close` (Phase 4). |
| | `market_data/cafef/integrity.py:28-36,65,82,111-113,162` | **Bổ sung ngay trong Phase 2**: thêm `INFO_CODES = ('adj_close_null',)` (KHÔNG thuộc `VIOLATION_CODES` để `ok=true` chờ Phase 3) và đếm `adj_close_null` trong `audit_rows`. Giữ `close` trong `collect_rows` (`:162`) và `factor_close_mismatch` (`:82,111-113`) trong allowlist Phase 2–3 đến Phase 4 `raw_close`. |
| | `market_data/cafef/{diff,fallback,persist,rebase}.py` | Pipeline CafeF & đối chiếu `adj_close / close`. |
| | `market_data/corporate_actions/adjustment.py:27,172,176,233` | Tính hệ số từ giá gốc (cấm dùng `adj_close` kẻo double-adjust; giữ đến Phase 4). |
| | `market_data/management/commands/{anchor_a_relabel,price_migration_diff,price_migration_persist}.py` | Lệnh migration/relabel ops. |
| | `data_ingest/tasks.py` | Ingest ghi `DailyPrice` / `IntradayBar`, `assert_integrity`, drift check (`reconcile_prices`). |
| | `market_data/stock_mgmt_native_views.py:994,1009,1034,1047,1060,4204,4274` | Payload JSON `close` + `IntradayBar.close` — bị khoá bởi `test_m5_chart_points.py` và `chartAdapter.js` (Phase 4). |
| | `user_workspace/portfolio_analytics_views.py:598` | Nhánh NAV `deltas is not None` (`test_m6b_r3_quantity.py`, chờ verify hợp đồng NAV ở Phase 4). |
| **C. Không phải `DailyPrice.close`** | `market_data/views.py:405`, `vnbroker_adapter.py`, `realtime_prefetch.py`, `service_ops/*`, `signal_intelligence/sse.py`, `user_workspace/broker/adapters.py`, `user_workspace/screener_tasks.py`, `portfolio_analytics_views.py:3370,3920,3962,4577,4587`, `screener_helpers.py:21,70,468,524`, `stock_mgmt_native_views.py:849,1271,2049,2148,2166,2288`, `user_workspace/test_screener_*.py` | `IntradayBar.close`, `live['close']`, `client.close`, `it.close`, hoặc dict payload `'close'` (JSON response key). |

### 1.3 Baseline cổng kiểm tra tại thời điểm lập kế hoạch (`51cea8fc9`)
- `node packages/web/scripts/check-multi-agent.mjs`: **PASS** (exit 0; 15 app, 0 trùng migration).
- `node scripts/pre-push-gate.mjs` (sau khi nối junction `node_modules` vào worktree): **PASS** (`36 PASS / 0 SKIP / 0 FAIL`, exit 0; trong đó `tsc --noEmit`: 0 lỗi, `check-multi-agent`: PASS, `check-lessons`: PASS).

---

## 2. Tiêu chí nghiệm thu (`Given / When / Then`)

- **AC1 (`pricing.py` & NULL policy)**:
  - *Given* một `DailyPrice` (ORM object hoặc `dict`) có `adj_factor` và `adj_close` khi `PRICE_ADJUSTED_DISPLAY=1` → *When* gọi `effective_close(row)` hoặc `effective_ohlc(row)` → *Then* trả `adj_close` (và O/H/L đã scale) mà không đọc `close`.
  - *Given* một dòng có `close=None, adj_close=None` → *When* gọi `effective_close(row)` / `effective_ohlc(row)` → *Then* `effective_close` trả `None` (không `raise ValueError`), `effective_ohlc` trả `None`.
- **AC2 (`advisory_helpers.py` & `screener_helpers.py` không tạo giá 0 giả)**:
  - *Given* chuỗi lịch sử có dòng `effective_ohlc` trả `None` hoặc `close=None` → *When* chạy `build_ohlcv_lookback_context` hoặc `_screener_build_technical` → *Then* dòng đó bị bỏ qua (`continue`/filtered), `sma20`/`lo52` không bị kéo về `0.0`, bảng markdown không in dòng `0`.
- **AC3 (`integrity.py` theo dõi `adj_close_null`)**:
  - *Given* tập dòng có các dòng `adj_close=None, adj_factor=None` (chưa backfill) → *When* gọi `audit_rows(rows)` → *Then* `report['ok']` là `True`, `'adj_close_null'` KHÔNG nằm trong `report['violations']`, và `report['counts']['adj_close_null']` bằng đúng số dòng thiếu `adj_close`.
- **AC4 (Runtime consumers dùng SSOT)**:
  - *Given* `PRICE_ADJUSTED_DISPLAY=1` và bản ghi `DailyPrice` có `close=42750, adj_close=17940, adj_factor=0.4196` → *When* chạy `market_serving/native_views.py` (`build_whale_buckets`), `vnbroker_materializer.py`, `market_serving/materializers.py`, `stock_mgmt_native_views.py` (batch quotes, watchlist technicals, stock detail, whale marker, `_aggregate_daily_to_ohlcv_bars`), `advisory/views.py`, `portfolio_analytics_views.py` (`_benchmark_returns`, whale snapshot, screener backtest), `seed_qa_user_dataset.py` → *Then* tất cả trả giá điều chỉnh `17940` (bỏ qua nếu `None`; riêng `build_whale_buckets` bỏ bucket rỗng thiếu giá và trả `price=None` cho bucket có tick nhưng thiếu giá thay vì `0.0`), không trả giá thô `42750` và không biến `None` thành `0`.
- **AC5 (Không vỡ contract hiện tại)**:
  - Các test hiện hữu (`test_m5_chart_points.py`, `test_m5b_consumers.py`, `test_m5b_nav_adjusted.py`, `test_m6b_r3_quantity.py`, `test_m6b_pricing_skip.py`, `test_price_integrity.py`, `test_integrity_collect_rows.py`, `test_price_basis_s6.py`, `test_vnbroker_materializer_reference.py`, `test_native_views.py`, `test_whale_cvd_full_tf.py`) đều PASS trên VPS staging.
- **AC6 (Gate cơ học chống hồi quy)**:
  - *Given* script `scripts/check-dailyprice-close-usage.mjs` được nối vào `scripts/pre-push-gate.mjs` → *When* chạy `node scripts/check-dailyprice-close-usage.mjs` và `--self-test` → *Then* exit 0 trên code đã dọn (mọi đọc `DailyPrice.close` ngoài Nhóm B allowlist đều bị chặn, trong đó `integrity.py` thuộc Nhóm B allowlist tạm thời đến Phase 4), và `--self-test` chứng minh gate FAIL (exit != 0) nếu có consumer mới ngoài allowlist đọc `dp.close` hoặc `.values(..., 'close')`.

---

## 3. SCOPE, LIMIT, Non-goals & Rollback

- **SCOPE**: Các file backend liệt kê ở Nhóm A bảng §1.2 + `market_data/cafef/integrity.py` (chỉ thêm `INFO_CODES` `adj_close_null`), test mới/cập nhật trong `market_data/tests/`, `market_serving/tests/`, `advisory/tests/`, `user_workspace/tests/`, `scripts/check-dailyprice-close-usage.mjs` (new), `scripts/pre-push-gate.mjs`, `docs/evidence/ssot-implementation/BLOCKER_DROP_CLOSE_20261128.md`, `docs/CLAIMS.md`, `docs/CODE_CHANGE_AUDIT_LEDGER.md`.
- **LIMIT**: Tối đa 3 vòng cho audit plan (B3) và 3 vòng cho fix/re-audit (B6–B8). Quá 3 vòng → dừng + báo blocker.
- **Non-goals**:
  - KHÔNG tạo DB migration, KHÔNG đổi schema `DailyPrice.close` hay thêm `raw_close`.
  - KHÔNG chạy lệnh backfill hay sửa dữ liệu trên DB staging.
  - KHÔNG đổi contract JSON `close` của `/chart/` / `/ohlcv/` hay `chartAdapter.js` (thuộc Phase 4).
  - KHÔNG đụng `portfolio_analytics_views.py:598` (`deltas is not None` NAV branch).
- **Rollback**: `git revert` PR merge commit (0 thay đổi schema/DB nên rollback tức thì, an toàn).
