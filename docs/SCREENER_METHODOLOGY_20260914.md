# Screener — Công bố phương pháp tính (methodology)

> Ngày: 2026-09-14 · Đóng P3 "kiểm định công thức với vendor + công bố methodology"
> (audit `docs/AUDIT_SCREENER_COMMERCIAL_GRADE_20260913.md` F12/Q3).
> Code: `packages/core/backend/src/user_workspace/screener_helpers.py`.
> Pins hồi quy: `user_workspace/test_screener_indicators.py` (W8) — mọi lần
> calibrate vendor sau này PHẢI cập nhật pins + tài liệu này cùng lúc.

## 0. Quyết định (Q3, đã chốt 2026-09-13)

**Nội bộ là chuẩn dùng.** Công thức nội bộ dưới đây là chuẩn duy nhất cho kết
quả quét; cột này công bố để đối soát với vendor (FireAnt/TradingView), không
phải để khẳng định khớp vendor.

## 1. Chỉ báo kỹ thuật (bản nội bộ)

| Field | Công thức nội bộ | Lệch chuẩn vendor | Ghi chú |
|---|---|---|---|
| `rsi_14` | Cutler's RSI: trung bình SMA của gains/losses 14 kỳ gần nhất. `loss=0 → 100`, `gain=0 → 0` | Wilder dùng trung bình lũy thừa (smoothing). Hai bản chênh vài điểm khi biến động mạnh | `_compute_rsi` |
| `adx_14` | **DX 1 kỳ** (không mượt): `100·\|+DI−DI\|/(+DI+−DI)` trên cửa sổ 14 kỳ | ADX chuẩn = Wilder-smoothing của DX qua nhiều kỳ | Tên field giữ `adx_14` vì contract P1; bản chất là DX |
| `stoch_k/d` | %K min-max 14 kỳ, %D = SMA-3 của %K | Khớp chuẩn | `_compute_stochastic` |
| `atr_14` | SMA-20..? SMA-14 của True Range | Wilder dùng smoothing; chênh nhỏ | `_compute_atr` |
| `bb_width_20` | `(upper−lower)/SMA20·100`, SMA ± 2σ, σ mẫu population | Khớp chuẩn | `_compute_bollinger_width` |
| `vwap` | **VWAP lăn 20 phiên** `Σ(close·vol)/Σvol` | Session-VWAP chuẩn reset mỗi phiên | Phù hợp quét liên phiên, không phải intraday |
| `mfi_14` | MFI chuẩn trên **14 kỳ gần nhất** (typical price · volume) | Khớp chuẩn kể từ fix W8 (trước đó cộng dồn toàn bộ lịch sử — bug) | `_compute_mfi` |
| `macd_hist` | EMA-12 − EMA-26, signal EMA-9, hist = diff − signal; cần ≥ 35 điểm | Khớp chuẩn | `_compute_macd_hist` |

Dữ liệu đầu vào: `DailyPrice` toàn universe 1 query + `SymbolSnapshot` phiên +
`SessionFacts` (whale/dark). Thiếu facts → field `None` → điều kiện trả False
+ badge "thiếu dữ liệu" (P0.1), không âm thầm khớp.

## 2. Điểm AI & backtest (caveat)

- `ai_score_0_100` là heuristic tổng hợp nội bộ, **không phải khuyến nghị đầu tư**.
- Backtest v2 (`GET /screener/history/<id>/backtest/`): win-rate trên giá đóng
  cửa sau `run_at` (5/20 ngày, DB `DailyPrice`), chưa trừ phí/thuế/trượt giá.
  Win-rate ngây thơ trên UI cũ đã thay bằng endpoint server từ P2.3.

## 3. Vận hành quét (P1/P2/W2)

- Sync (rule nhẹ) hoặc async 202 + polling (rule nặng, P1.4).
- Cache scan-key Option B theo `(user, rule, updated_ts, session, include_ai)`.
- Từ W2: task chạy trên queue **`screener`** riêng (worker
  `core-worker-screener`), không còn chung `manual_on_demand` với backfill.
- Lịch quét user (P2.4/Q6): beat 5m, kênh `in_app` + `email` (mailpit ở dev).

## 4. Preset cộng đồng (W8)

- Rule có `is_public=True` hiện trong catalog `/screener/rules/public/`
  **phạm vi tenant** (không lọt cross-tenant).
- Fork tạo bản sao riêng (`is_public=False`, tên + " (bản sao)"), chạy và tùy
  biến độc lập — rule gốc không bao giờ bị sửa bởi người fork.
- Bật/tắt chia sẻ: `PUT /screener/rules/<id>/ {is_public}` (chỉ chủ rule).

## 5. Còn lại của P3 (backlog có lý do)

- Realtime intraday screening (poll `SymbolSnapshot` mỗi 5s): cần quyết định
  product về chi phí poll + giới hạn universe trong phiên — chưa làm.
- Screener đa khung thời gian (weekly/monthly): cần aggregation layer mới —
  chưa làm.
- So sánh chéo preset / preset dòng tiền khối ngoại-tự doanh: chờ dữ liệu
  vendor ổn định — chưa làm.
