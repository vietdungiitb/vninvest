# Sprint 34 — AI News Module (Layer 1 + Layer 2)

**Trạng thái:** ✅ IMPLEMENTED  
**Ngày tạo:** 2026-04-15  
**Scope:** Layer 1 (Stock News Panel) + Layer 2 (Advisory Grounding)  
**Layer 3** (Portfolio Daily Narrative, Celery Beat post-16:00): deferred → Sprint 35

---

## 1. Mục tiêu

Tích hợp tin tức theo mã cổ phiếu vào `StockDetail` workspace nhằm cung cấp ngữ cảnh thời sự cho người dùng khi phân tích và nhận tư vấn AI.

---

## 2. Kiến trúc 3 lớp

| Lớp | Tên | Vị trí | Mô tả | Phức tạp |
|-----|-----|---------|-------|----------|
| **L1** | Stock News Panel | `StockDetail.jsx` | vnstock `.company.news()` per symbol, không AI, cache Redis 30 phút | S |
| **L2** | Advisory Grounding | `tasks.py` | Inject 4 tiêu đề gần nhất vào prompt AI advisory | M |
| **L3** | Portfolio Digest | Celery Beat | Tóm tắt cá nhân hóa sau 16:00 mỗi ngày | M — Sprint 35 |

---

## 3. API Contract

### `GET /api/stock-management/stocks/<symbol>/news/`

**Headers:** `Authorization: Bearer <token>` (IsAuthenticated)

**Response 200:**
```json
{
  "symbol": "VCB",
  "items": [
    {
      "title": "Vietcombank công bố kết quả kinh doanh quý 1",
      "url": "https://...",
      "source": "cafef.vn",
      "published_at": "2026-04-14T09:00:00"
    }
  ],
  "fetched_at": "2026-04-15T08:30:00Z",
  "cached": true
}
```

**Response khi vnstock không hoạt động (graceful degradation):**
```json
{
  "symbol": "VCB",
  "items": [],
  "fetched_at": "...",
  "cached": false,
  "unavailable": true
}
```

**Cache:** Redis key `stock:news:{SYMBOL}`, TTL 1800 giây (30 phút)

---

## 4. Files thay đổi

### Backend
| File | Thay đổi |
|------|---------|
| `backend/portfolio/views.py` | Thêm `stock_news_api` sau `stock_order_flow_api` |
| `backend/portfolio/urls_stock.py` | Thêm route `/stocks/<symbol>/news/` trước route `/stocks/<symbol>/` |
| `backend/portfolio/tasks.py` | Thêm `_fetch_news_context_for_advisory()` + inject vào `generate_whale_advisory_task` |

### Frontend
| File | Thay đổi |
|------|---------|
| `frontend/src/api/client.js` | Thêm `getStockNews(symbol)` |
| `frontend/src/i18n/vi.js` | Thêm keys `stockNews.*` |
| `frontend/src/i18n/en.js` | Thêm keys `stockNews.*` |
| `frontend/src/components/StockNewsPanel.jsx` | TẠO MỚI — component hiển thị danh sách tin tức |
| `frontend/src/pages/StockDetail.jsx` | Import và thêm `<StockNewsPanel>` vào layout |

---

## 5. Tiêu chí chấp nhận (Acceptance Criteria)

- [ ] `GET /api/stock-management/stocks/VCB/news/` trả về JSON hợp lệ khi đăng nhập
- [ ] Cache miss gọi vnstock; cache hit trả từ Redis trong < 50ms
- [ ] Khi vnstock không khả dụng: `items: []`, `unavailable: true`, không trả 500
- [ ] StockDetail hiển thị section "Tin tức" với danh sách bài báo, link ngoại bộ
- [ ] Advisory prompt cho mã có tin tức gần đây chứa block `Recent news for {symbol}:`
- [ ] Advisory prompt cho mã không có tin tức vẫn hoạt động bình thường (không lỗi)
- [ ] i18n: tất cả văn bản hiển thị bằng tiếng Việt; bản tiếng Anh song song

---

## 6. Layer 2 — Chi tiết Grounding

Hàm helper `_fetch_news_context_for_advisory(symbol, max_items=4)`:
- Đọc từ Redis cache key `stock:news:{symbol}` (TTL 30 phút)
- Nếu cache miss: gọi vnstock với timeout 5 giây, lỗi → trả `""`
- Định dạng inject vào prompt:
  ```
  Tin tức gần đây về {symbol}:
  - {title} ({source}, {date})
  - ...
  ```
- Max 4 headlines; max ~200 token bổ sung mỗi lần gọi AI

---

## 7. Phi chức năng

- **Security:** URL ngoại bộ trong `StockNewsPanel` luôn `target="_blank" rel="noopener noreferrer"`
- **Rate limiting:** không gọi vnstock news service quá 1 lần / 30 phút / symbol
- **Graceful degradation:** mọi lỗi vnstock → empty state, không crash
- **Token safety:** news grounding bỏ qua khi advisory đang dùng `use_concise=True` (ngân sách thấp)

---

## 8. Layer 3 (Sprint 35 Backlog)

- Celery Beat task chạy sau 16:00 mỗi ngày giao dịch
- Tóm tắt tin tức cho tất cả mã trong watchlist của user
- AI narrative cá nhân hóa, lưu vào DB
- WebSocket push, hiển thị trong Dashboard notification panel
