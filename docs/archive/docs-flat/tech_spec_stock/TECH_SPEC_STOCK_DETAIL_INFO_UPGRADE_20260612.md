# TECHNICAL SPECIFICATION — Stock Detail Info Upgrade 20260612

## 1. Data Contracts (API Specifications)

### A. Stock Detail Header & Overview
`GET /api/stock-management/stocks/<symbol>/overview/`
```json
{
  "symbol": "TCB",
  "company_name": "Ngân hàng Thương mại Cổ phần Kỹ thương Việt Nam",
  "exchange": "HOSE",
  "industry": "Ngân hàng",
  "current_price": 31.25,
  "prev_price": 30.85,
  "change_value": 0.40,
  "change_pct": 1.30,
  "ceiling_price": 33.00,
  "floor_price": 28.70,
  "reference_price": 30.85,
  "open_price": 31.30,
  "average_price": 31.27,
  "high_price": 31.45,
  "low_price": 31.05,
  "volume": 10931200
}
```

### B. Tabs Data Endpoints

#### Tab 2: Hồ sơ (Profile) & Tab 3: Cổ đông (Shareholders)
`GET /api/stock-management/stocks/<symbol>/`
```json
{
  "symbol": "TCB",
  "company_name": "Ngân hàng Thương mại Cổ phần Kỹ thương Việt Nam",
  "exchange": "HOSE",
  "industry": "Ngân hàng",
  "status": "active",
  "outstanding_shares": 7086240414,
  "overview": {
    "address": "Techcombank Tower - Số 06 Quang Trung - P. Cửa Nam - Tp. Hà Nội",
    "phone": "(84.24) 3944 6368",
    "email": "ho@techcombank.com.vn",
    "website": "https://www.techcombank.com.vn",
    "business_model": "...",
    "history": "...",
    "founded_date": "06/08/1993",
    "listing_date": "04/06/2018",
    "charter_capital": 70862,
    "listed_volume": 7086
  },
  "officers": [
    {
      "name": "Hồ Hùng Anh",
      "position": "Chủ tịch HĐQT",
      "from_date": "2004"
    }
  ],
  "shareholders": [
    {
      "name": "CTCP Tập đoàn Masan",
      "shares_owned": 1047600000,
      "ownership_percentage": 14.79
    }
  ],
  "events": []
}
```

#### Tab 5: Tin tức (News)
`GET /api/stock-management/stocks/<symbol>/news/`
```json
{
  "symbol": "TCB",
  "news": [
    {
      "news_id": "...",
      "title": "Techcombank công bố kết quả kinh doanh quý mới...",
      "summary": "...",
      "url": "...",
      "published_at": "2026-06-12T15:00:00Z",
      "source": "CafeF"
    }
  ]
}
```

#### Tab 8: Tài chính (Financials) & Tab 7: Thống kê (Statistics)
`GET /api/stock-management/stocks/<symbol>/financials/`
```json
{
  "symbol": "TCB",
  "financials": {
    "ratio": [
      {
        "item": "Thu nhập trên mỗi cổ phần của 4 quý gần nhất (EPS)",
        "item_id": "trailing_eps",
        "2026-Q1": 3675.48,
        "2025-Q4": 3112.80,
        "2025-Q3": 3506.16
      }
    ],
    "income_statement": [
      {
        "item": "1. Thu nhập lãi và các khoản thu nhập tương tự",
        "item_id": "n_1.interest_income_and_similar_income",
        "2026-Q1": 44752640000,
        "2025-Q4": 41250000000
      }
    ],
    "balance_sheet": [
      {
        "item": "TỔNG CỘNG TÀI SẢN",
        "item_id": "total_assets",
        "2026-Q1": 950000000000,
        "2025-Q4": 920000000000
      }
    ]
  }
}
```

---

## 2. Caching Rules
- **Profile / Company details**: Cập nhật hàng ngày (DB metadata check `updated_at` trong vòng 24 giờ).
- **News**: Cache Redis 30 phút.
- **Financials**: Cache Redis 12 giờ (được cập nhật theo quý nên thay đổi rất chậm).

---

## 3. UI Component Structure

### StockDetailHeader
Giao diện 3 hàng linh hoạt, thích ứng responsive:
- Hàng 1: Mã (Badge) | Tên công ty | Tags | Action Buttons (Watchlist, AI Advisor, Đặt lệnh)
- Hàng 2: Giá lớn | Trend icon (▲/▼) | Thay đổi tuyệt đối | Thay đổi % (Màu sắc động: Tím/Xanh/Vàng/Đỏ/Xanh lơ)
- Hàng 3: Chỉ số SSI iBoard:
  `Trần: XX.XX` | `Sàn: YY.YY` | `TC: ZZ.ZZ` | `Mở cửa: AA.AA` | `TB: BB.BB` | `Cao: CC.CC` | `Thấp: DD.DD` | `Tổng KL: EE,EEE,EEE`

### StockDetailTabs
Thanh quản lý tab 8 panel sử dụng lazy loading qua hook. Renders:
- Giao dịch: `StockContextDeck` (Shark alerts, depth, strength matrix) + AI Advisory card.
- Hồ sơ: Overview grid + Officers table.
- Cổ đông: Shareholder ownership table.
- Vốn & Cổ tức: Vốn điều lệ, cổ phiếu niêm yết, tỷ suất cổ tức.
- Tin tức: Tin tức doanh nghiệp.
- Sự kiện: Lịch sử sự kiện doanh nghiệp.
- Thống kê: Grid cơ bản P/E, P/B, EPS, ROE, ROA, Beta, BVPS.
- Tài chính: Báo cáo kết quả kinh doanh & Bảng cân đối kế toán.

---

## 4. i18n Translation Keys (Tiếng Việt)
- `ceiling_price` -> "Trần" (Màu Tím)
- `floor_price` -> "Sàn" (Màu Xanh lơ)
- `reference_price` -> "TC" (Màu Vàng)
- `open_price` -> "Mở cửa"
- `average_price` -> "TB"
- `high_price` -> "Cao"
- `low_price` -> "Thấp"
- `volume` -> "Tổng KL"
