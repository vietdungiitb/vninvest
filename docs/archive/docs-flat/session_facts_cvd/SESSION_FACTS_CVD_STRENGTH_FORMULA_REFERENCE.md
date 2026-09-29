# SessionFacts — Tài liệu tham khảo công thức CVD & Strength

> **Phiên bản:** 1.0 — 2026-05-13  
> **Triển khai tại:** `packages/core/backend/src/market_serving/session_facts_engine.py`  
> **API SSOT:** `GET /api/market/session-facts/<symbol>/`

---

## 1. CVD — Cumulative Volume Delta

CVD là tổng tích lũy của chênh lệch giữa khối lượng **mua chủ động** và **bán chủ động**. Đây là chỉ số nền tảng để theo dấu dòng tiền Market Orders (Smart Money).

### Công thức cơ bản

$$\Delta_i = V^{ask}_i - V^{bid}_i$$

Trong đó:
- $V^{ask}_i$ : Giá trị khớp tại giá Ask (lệnh Market Buy — Mua chủ động)
- $V^{bid}_i$ : Giá trị khớp tại giá Bid (lệnh Market Sell — Bán chủ động)

### Tích lũy theo bucket

$$CVD_n = CVD_{n-1} + \Delta_n = \sum_{i=1}^{n} \Delta_i$$

### Chuẩn hóa về thang 0–100

$$CVD_{normalized} = \text{clamp}\!\left(50 + 50 \times \frac{CVD_{final}}{P_{95}(|CVD_{series}|)},\ 0,\ 100\right)$$

| Giá trị | Ý nghĩa |
|---|---|
| 50 | Trung tính — cân bằng mua/bán |
| > 50 | Áp lực mua đang chiếm ưu thế |
| < 50 | Áp lực bán đang chiếm ưu thế |

### Tín hiệu phân kỳ (Divergence)

> Giá tạo đỉnh mới **nhưng** CVD tạo đỉnh thấp hơn → phe mua đang kiệt sức, đảo chiều có thể xảy ra.

---

## 2. Delta Strength %

Đo cường độ của nỗ lực mua/bán so với tổng khối lượng.

$$\text{Delta Strength} = \frac{net\_CVD}{total\_value} \times 100\%$$

**Ngưỡng thực chiến:**

| Mức | Ý nghĩa |
|---|---|
| < ±10% | Cân bằng — hai bên giằng co |
| ±10–15% | Bắt đầu nghiêng về một phía |
| > ±15% | **Aggressive** — một bên đang áp đảo hoàn toàn |
| ±100% | Toàn bộ là một chiều (buy hoặc sell) |

---

## 3. Buy Strength (Sức mạnh mua)

Thang đo 0–99.5, sigmoid-chuẩn hóa, phản ánh cả **mức độ mất cân bằng** lẫn **quy mô dòng tiền** so với baseline.

### Công thức

$$imbalance = \frac{|buy - sell|}{buy + sell + \varepsilon}$$

$$baseline = \text{median}(\text{bucket\_totals}_{[n-W, n]})$$

$$raw = 0.6 \times imbalance + 0.4 \times \ln\!\left(1 + \frac{total}{baseline + \varepsilon}\right)$$

$$midpoint = \text{median}(raw\_history)$$

$$\text{buy\_strength} = \text{sigmoid}(raw,\ midpoint,\ slope=1.0)$$

$$\text{sigmoid}(x, m, s) = \frac{100}{1 + e^{-s(x-m)}}$$

### Penalty

$$\text{buy\_strength} \mathrel{\times}= 0.55 \quad \text{nếu } total < 0.25 \times baseline$$

> Điều kiện này loại bỏ bucket thanh khoản thấp — không phản ánh áp lực thật sự.

---

## 4. Institutional Strength (Sức mạnh tổ chức)

Thang 0–99.5, kết hợp 3 yếu tố: **tỷ lệ whale**, **dark flow ratio**, và **quy mô whale tương đối**.

### Công thức

$$whale\_ratio = \frac{whale\_value}{total + \varepsilon}$$

$$dark\_ratio = \frac{|\Delta|}{total + \varepsilon}$$

$$whale\_mult = \frac{whale\_value}{baseline + \varepsilon}$$

$$raw_{inst} = 0.45 \times whale\_ratio + 0.35 \times dark\_ratio + 0.20 \times \ln(1 + whale\_mult)$$

$$\text{inst\_strength} = \text{sigmoid}(raw_{inst},\ midpoint,\ slope=0.95)$$

### Penalty

$$\text{inst\_strength} \mathrel{\times}= 0.6 \quad \text{nếu } whale\_value < 0.15 \times baseline$$

> Ngưỡng whale mặc định: ≥ 200 triệu VNĐ / bucket.

---

## 5. Dark Flow Score

Proxy cho **price absorption**: giá đứng yên nhưng CVD dịch chuyển mạnh — dấu hiệu tổ chức đang tích lũy/phân phối bí mật.

$$dark\_flow\_score = \text{clamp}\!\left(\frac{|net\_CVD|}{total\_value + \varepsilon} \times 100,\ 0,\ 100\right)$$

> Dark flow score cao + giá đi ngang = hấp thụ tổ chức (absorption signal).

---

## 6. Các hằng số mặc định

| Tham số | Giá trị | Ghi chú |
|---|---|---|
| `BUCKET_MINUTES` | 15 phút | Độ rộng bucket thời gian |
| `BASELINE_WINDOW` | 20 bucket | Cửa sổ tính median baseline |
| `WHALE_THRESHOLD_VND` | 200,000,000 VNĐ | Ngưỡng nhận diện lệnh whale |
| `EPS` | 1e-9 | Tránh chia cho 0 |
| `low_volume_penalty` | ×0.55 | Khi total < 0.25 × baseline |
| `low_whale_penalty` | ×0.60 | Khi whale < 0.15 × baseline |

---

## 7. API Response Schema

**Endpoint:** `GET /api/market/session-facts/<symbol>/`  
**Auth:** Bearer token (IsAuthenticated)  
**Cache:** Redis 30 giây

```json
{
  "symbol": "VPB",
  "session_date": "2026-05-13",
  "cvd_normalized": 45.2,
  "delta_strength_pct": -12.5,
  "buy_strength": 38.7,
  "institutional_strength": 62.1,
  "whale_net_flow": -500000000,
  "dark_flow_score": 78.3,
  "total_buy_volume": 1500000000,
  "total_sell_volume": 2000000000,
  "source": "computed",
  "stale": false,
  "computed_at": "2026-05-13T21:15:26.700541+07:00",
  "_source": "db-read"
}
```

### Giải nghĩa từng trường

| Trường | Thang | Ý nghĩa |
|---|---|---|
| `cvd_normalized` | 0–100 | 50 = trung tính. >50 = mua chiếm ưu |
| `delta_strength_pct` | -100…+100% | >+15% = aggressive buy; <-15% = aggressive sell |
| `buy_strength` | 0–99.5 | Sức mạnh mua có trọng số baseline |
| `institutional_strength` | 0–99.5 | Cường độ tổ chức/whale |
| `whale_net_flow` | VNĐ | Dương = mua ròng, âm = bán ròng |
| `dark_flow_score` | 0–100 | Mức độ absorption / dark pool activity |
| `total_buy_volume` | VNĐ | Tổng giá trị khớp phía mua |
| `total_sell_volume` | VNĐ | Tổng giá trị khớp phía bán |

---

## 8. Cơ chế cập nhật dữ liệu

```
WhaleAlertCanonical (signal_intelligence)
        │  matched_value, side, executed_at
        ▼
session_facts_engine.compute_session_facts()
        │  Tính CVD, Strength, Dark Flow theo bucket 15 phút
        ▼
SessionFacts (market_serving)
        │  upsert (symbol, session_date)
        ▼
GET /api/market/session-facts/<symbol>/
        │  Redis cache 30s
        ▼
Frontend consumer (thuê bao)
```

**Trigger:**
1. **Celery beat** — mỗi 5 phút (`materialize-session-facts-5m`), tính lại tất cả symbol có whale data hôm nay
2. **On-demand** — khi frontend gọi API mà DB chưa có record cho hôm nay, tự compute ngay trước khi trả về

---

## 9. Tín hiệu giao dịch kết hợp

| Kết hợp | Tín hiệu |
|---|---|
| `cvd_normalized` > 65 + `buy_strength` > 60 | Xu hướng mua mạnh, xác suất tăng cao |
| `cvd_normalized` < 35 + `dark_flow_score` > 70 | Phân phối tổ chức — cảnh báo bán |
| `delta_strength_pct` > +15% | Aggressive buy — breakout potential |
| `cvd_normalized` tạo đáy mới khi giá tạo đỉnh | **CVD Divergence** — đảo chiều xuống |
| `institutional_strength` > 70 + giá đi ngang | Tích lũy tổ chức — accumulation zone |

---

## 10. Tham khảo quốc tế

- **CVD** được dùng tiêu chuẩn trên NinjaTrader, Sierra Chart, TradingView Pro (Footprint Chart)
- **Sigmoid normalization** từ portfolio legacy: `backend/portfolio/services_whale_analytics_snapshot.py` → `_build_flow_series()`
- **ADX / RSI** là chỉ số bổ trợ xu hướng, không thay thế CVD trong phân tích dòng tiền
- Để tính CVD **chính xác nhất** cần Tick Data Level 2; hiện tại dùng `WhaleAlertCanonical.matched_value` như proxy
