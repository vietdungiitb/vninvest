# Audit Kế hoạch Phase 2 (`retire-close-consumers`) — B3 (2026-11-28)

- **Kế hoạch được audit**: `docs/evidence/ssot-implementation/PLAN_RETIRE_CLOSE_CONSUMERS_20261128.md`
- **Branch / Base**: `feat/retire-close-consumers` @ `51cea8fc9`
- **Auditor độc lập**: Subagent `Code Reviewer` (chỉ đọc, không sửa file)

---

## Vòng 1 — Verdict: `NEED_REVISION` (4 objection)

1. **`stock_mgmt_native_views.py:4284-4301` (`_aggregate_daily_to_ohlcv_bars`)**:
   - `test_price_basis_s6.py:47-57` gọi `adjusted=True` không bật env `PRICE_ADJUSTED_DISPLAY`; `test_m5_chart_points.py:68` gọi `adjusted=False` phải giữ raw. Cần truyền `enabled` rõ ràng theo `adjusted`, đồng thời giữ guard `_has_adjustment(row)` chặn `vnbroker_legacy` thiếu `adj_basis` để không rò `adj_close` cũ.
2. **`market_data/cafef/integrity.py`**:
   - Đặt ở Nhóm A nhưng vẫn giữ đọc `close` ở `audit_rows` (`:82, 111-113`) và `collect_rows` (`:162`) đến Phase 4 ⇒ mâu thuẫn với AC6 gate. Phải chuyển sang Nhóm B allowlist tạm thời (giữ SCOPE sửa thêm `INFO_CODES` `adj_close_null`).
3. **`screener_helpers.py:391-395,404`**:
   - Lọc riêng `highs`/`lows` sẽ lệch độ dài với `closes`/`volumes`; cần fallback H/L thiếu về `e[3]` (`close`), không về `0.0`. Ngoài ra `:404` còn so literal `price_source == 'cafef'`.
4. **`market_serving/native_views.py:594-596` (`build_whale_buckets`)**:
   - Đã đổi `:583` nhưng `:595-596` vẫn ép `if price is None: price = 0.0`. Cần quy định rõ: bỏ bucket rỗng thiếu giá (`count == 0`), bucket có tick nhưng thiếu giá trả `price = None` thay vì `0.0` giả.
- **Inventory verification**: Subagent không có shell tool nên ghi `CHƯA CHẠY` cho `git grep` toàn repo; parent agent đã chạy trực tiếp lệnh `git grep` + Python filter trên `HEAD` (`51cea8fc9`) xác nhận đúng **39 file / 175 hits**, 0 file bị sót.

---

## Vòng 2 — Verdict: `PASS` (0 blocker, 0 major, 2 non-blocking nits)

Tất cả 4 objection của Vòng 1 đã được đóng đầy đủ và xác minh lại trực tiếp trên code & 10 file test liên quan:
1. `_aggregate_daily_to_ohlcv_bars`: truyền `enabled=(adjusted and _has_adjustment(row))` vào `effective_ohlc`, giữ guard `vnbroker_legacy` thiếu `adj_basis` và giữ nguyên contract `test_price_basis_s6.py` + `test_m5_chart_points.py`.
2. `integrity.py`: chuyển sang Nhóm B allowlist tạm thời, SCOPE giữ phần thêm `INFO_CODES = ('adj_close_null',)`, nhất quán AC3 & AC6.
3. `screener_helpers.py`: giữ đồng bộ độ dài vector (`highs`/`lows` fallback `e[3]`, không `0.0`), đổi `:404` sang F1.
4. `build_whale_buckets`: rõ hành vi `count == 0` (bỏ) vs `count > 0` (`price = None`).
5. **Tuân thủ deny-list §2**: **PASS** (không chạm file deny-list).

### 2 Nits không chặn (lưu ý khi code B6)
- Trong `screener_helpers.py:394-395`, fallback về `e[3]` áp dụng cho `highs` (`item[1]`) và `lows` (`item[2]`).
- Trong `stock_mgmt_native_views.py:4294-4302`, đặt `if adjusted and getattr(row, 'price_source', None) == 'unmapped_cafef': continue` **trước** `effective_ohlc(...)`, và fallback `o`/`h`/`l` thiếu sang `c` (không `0`) trước `max()`/`min()`.

**Kết luận B4 (Đồng thuận)**: Đạt `PASS`. Đủ điều kiện chuyển sang **B5 (Claim + cách ly)** và **B6 (Code TDD fail-before)**.
