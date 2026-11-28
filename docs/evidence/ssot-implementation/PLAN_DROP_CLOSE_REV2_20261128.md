# Kế hoạch xoá `DailyPrice.close` — Rev.3 (2026-11-28)

**Lessons:** [L-V01, L-V02, L-V04] · Audit v2: `AUDIT_PLAN_DROP_CLOSE_REV2_20261128.md` (4 objection).

## 1. Nguyên tắc (Owner)
- `adj_close` = SSOT cho **mọi** hiển thị, trần/sàn, hệ số, NAV, technical.
- `raw_close` = tham chiếu từ CafeF, nullable, **không dùng hiển thị/tính toán**.
- `close` = xoá (không rename). Payload API giữ key `close` nhưng lấy từ `adj_close`.

## 2. Đóng 4 objection

**O1 — Inventory đầy đủ**: bổ sung vào SCOPE:
`stock_mgmt_native_views.py:597,1009,1641,2049,4204,4300-4310`;
`vnbroker_materializer.py:107,195,201,247,249`;
`market_serving/materializers.py:83,113-117`;
`advisory/views.py:969`; `portfolio_analytics_views.py:598,632,2938-2947,4594`;
`tasks.py:817-823,3752-3758`; `price_migration_persist.py:184`; `models.py:115`; `admin.py:53`; `serializers.py:23`; `pricing.py:41-50`; `backfill_ceiling_floor.py`.
AC3 tái tạo bằng lệnh grep: còn lại chỉ được phép là **alias payload/key test**, không phải query DB cột close.

**O2 — FE**: với flag `PRICE_ADJUSTED_DISPLAY=1` (đang bật), bỏ nhánh raw trong `chartAdapter.js`: `mapToBar` luôn lấy `close = Number(p.adj_close)` và scale O/H/L theo `adj_factor` khi có; nếu thiếu `adj_close` ⇒ **bỏ nến** (không fallback raw). Cập nhật component test tương ứng. Rationale: payload `close` giờ là adjusted, không được trộn O/H/L raw.

**O3 — NAV**: comment `portfolio_analytics_views.py:596-597` nói `adj_close` chia thêm factor — **đã stale sau Anchor A**: `anchor_a_relabel.py:51` ghi `adj_close = close`, `adj_factor = 1` cho toàn chuỗi. Vì vậy đổi `:598` sang `adj_close` là **value-preserving**; phải có test NAV so sánh trước/sau (chênh ≤0,5%) trong AC. Nếu test phản đối ⇒ giữ semantics cũ qua field riêng `nav_price`, không tự bỏ qua.

**O4 — 930k dòng NULL adj_close**: policy fail-closed — `pricing.effective_close` trả `None` (không raise), consumer bỏ dòng; FE bỏ nến; `check_price_integrity` đếm `adj_close_null` nhưng **không coi là violation** (được phép chờ backfill); số liệu hiển thị có thể thiếu ở mã chưa anchor — ghi rõ trong evidence. Quyết định fetch bổ sung là slice riêng.

## 3. AC
- AC1: model có `raw_close` nullable, **không có field `close`**; `makemigrations --check` sạch.
- AC2: payload `/chart/`, `/ohlcv/`, serializer giữ key `close` = `adj_close`; test contract cập nhật theo adjusted.
- AC3: mọi truy vấn DB dùng `adj_close`/`raw_close`; grep verify.
- AC4: trần/sàn + hệ số + NAV + technical dùng `adj_close`; NAV test value-preserving.
- AC5: FE bỏ nhánh raw; nến thiếu adj bị bỏ.
- AC6: TDD fail-before; gate; B8 audit; staging DROP riêng có backup row-count/checksum/lock window.

## 4. SCOPE / LIMIT
~25 file backend + FE + migration + test. Rollback: backup ops trước DROP; sau DROP dùng DB snapshot. LIMIT 3 vòng; STOP nếu test NAV phản đối hoặc gate contract đỏ không có rationale.
