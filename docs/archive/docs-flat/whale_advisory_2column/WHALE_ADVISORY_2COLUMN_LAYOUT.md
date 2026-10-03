# Whale Advisory - Bố Cục 2 Cột Nâng Cấp

## 📋 Tóm Tắt Cải Tiến

Trang Whale Advisory đã được **chỉnh sửa hoàn toàn** để sử dụng bố cục 2 cột hiện đại theo phong cách **Fintech Dashboard**:

- **Cột Trái (35%):** Whale Heatmap & Frequency Tracker
- **Cột Phải (65%):** AI Advisory Feed (Dòng chảy tư vấn AI)

---

## 🎯 Các Chức Năng Chính

### 1. **Cột Trái: Whale Heatmap Tracker**

#### Mục Đích
Bộ lọc nhanh giúp người dùng biết "tiền lớn" đang đổ vào mã nào, được sắp xếp theo **tần suất xuất hiện giảm dần**.

#### Thành Phần Chi Tiết

**Thẻ Mã (Whale Tracker Card):**
- **Tên mã:** Ví dụ `FPT`, `HPG`, `VNM` (in hoa, đậm)
- **Heatmap Color:**
  - 🔥🔥🔥 **Đỏ heat** (`bg-red-900/70`) = Tần suất cao (> 10 lần)
  - 🔥🔥 **Cam** (`bg-amber-900/70`) = Trung bình (5-10 lần)
  - 🔥 **Xanh** (`bg-emerald-900/70`) = Thấp (< 5 lần)

- **Frequency Badge:** Vòng tròn badge với số lần xuất hiện (ví dụ: `12`)
- **Sparkline Mini:** Biểu đồ đường nhỏ gọn (5 nến gần nhất) để thấy xu hướng giá khớp lệnh
- **Giá Trị Trung Bình:** Hiển thị `Avg: XXX VND` dưới mã
- **Tương tác:** 
  - **Click một mã → Cột phải filter ngay lập tức** (không cần reload)
  - **Highlight với ring cyan** khi mã được chọn
  - **Hover tooltip** hiện lên gợi ý

#### Hành Vi Realtime
- Khi có whale alert mới, heatmap **tự động cập nhật** tần suất
- Danh sách **tự động sắp xếp lại** theo tần suất giảm dần
- Sparkline cập nhật với giá trị giao dịch mới

---

### 2. **Cột Phải: AI Advisory Feed**

#### Mục Đích
Dòng chảy tư vấn AI chi tiết cho mã được chọn hoặc toàn bộ.

#### Thành Phần Chi Tiết

**Header Section:**
- **Ngôn ngữ:** "AI Advisory Feed" (Dòng chảy tư vấn AI)
- **Thông tin mã:** Hiển thị mã hiện tại + số advisory (ví dụ: `FPT` `12 advisory`)
- **Nếu chọn "Xem tất cả":** Hiển thị `Tất cả mã` + tổng số advisory

**Advisory Card:**
- **Header Card:**
  - Tên mã (to, đậm)
  - Badge chiều lệnh: `BUY` (xanh emerald) hoặc `SELL` (hồng rose)
  - Giá trị khớp lệnh: "Khớp XXX.XXX.XXX VND"
  - Thời gian tạo (hh:mm AM/PM)
  - AI Provider (ví dụ: `openclaw`)

- **Body Card - 2 Phần:**
  - **Tóm tắt AI (Pro+):** Phần bên trái, ~100 ký tự, khung cyan nhạt
  - **Phân tích Sâu (Premium+):** Phần bên phải, ~250 ký tự, khung slate
    - Nếu chưa unlock: hiển thị prompt nâng cấp với nút `Nâng cấp để xem chi tiết`

**Tag & Insights (Tùy chọn):**
- Có thể thêm tag như: `#BùngNổ` `#TíchLũy` `#RủiRo` (nếu AI tính được)
- Hành động: Nút "Xem biểu đồ kỹ thuật" hoặc "Đặt lệnh" có thể tích hợp sau

---

### 3. **Phần Mềm: Gợi Ý (Sidebar Tip)**

Bên trái, phía dưới danh sách mã, hiển thị:
```
💡 Mẹo
• Click mã để xem AI Advisory riêng của mã
• Heatmap tự động cập nhật khi có lệnh mới
• Biến động (Frequency) = số lệnh lớn trong phiên
```

---

## 🎨 Bảng Màu (Color Scheme)

| Thành Phần | Màu | Hex / Tailwind |
|-----------|-----|---------------|
| **Nền chính** | Đen sâu | `#0f172a` / `slate-950` |
| **Card background** | Xám đen | `#1e293b` / `slate-800` |
| **Heatmap cao** | Đỏ | `bg-red-900/70` `text-red-200` |
| **Heatmap trung** | Cam | `bg-amber-900/70` `text-amber-200` |
| **Heatmap thấp** | Xanh | `bg-emerald-900/70` `text-emerald-200` |
| **Highlight/Active** | Cyan | `ring-cyan-500` / `text-cyan-300` |
| **BUY side** | Emerald | `bg-emerald-950/50` `text-emerald-300` |
| **SELL side** | Rose | `bg-rose-950/50` `text-rose-300` |
| **Tóm tắt container** | Cyan nhạt | `border-cyan-900/60` `bg-cyan-950/20` |
| **Chi tiết container** | Slate | `border-slate-800` `bg-slate-950/65` |

---

## ⚙️ Cấu Trúc Layout (CSS Grid)

```css
/* Main grid: 35% trái + 65% phải */
display: grid;
grid-template-columns: 0.35fr 0.65fr;
gap: 1rem;

/* Responsive: mobile stack */
@media (max-width: 1024px) {
  grid-template-columns: 1fr;
}
```

### Cung Cấp State Management

```javascript
// State chính
const [items, setItems] = useState([]);           // Tất cả advisory
const [selectedSymbol, setSelectedSymbol] = useState(null); // Mã được chọn
const [loading, setLoading] = useState(true);

// Derived state: heatmap tracker
const whaleTrackerData = useMemo(() => {
  // Tính tần suất từ items
  // Sắp xếp giảm dần
  // Trả về [{ symbol, frequency }, ...]
}, [items]);

// Filtered data
const filteredItems = useMemo(() => {
  if (!selectedSymbol) return items;
  return items.filter(item => item.symbol === selectedSymbol);
}, [items, selectedSymbol]);
```

---

## 🔄 Hành Vi Tương Tác

### Szenario 1: Người Dùng Click Mã `FPT`

```
Bước 1: Click card "FPT" ở cột trái
  → selectedSymbol = "FPT"

Bước 2: Cột phải tự động filter
  → filteredItems = items.filter(item => item.symbol === "FPT")

Bước 3: Header phải cập nhật
  → Hiển thị "FPT" + "12 advisory"

Bước 4: Advisory card highlight cyan
  → Tất cả FPT card có ring-cyan-500
```

### Szenario 2: Người Dùng Click "Xem Tất Cả"

```
Bước 1: Click nút "Xem tất cả"
  → selectedSymbol = null

Bước 2: Cột phải hiển thị tất cả
  → filteredItems = items (không filter)

Bước 3: Header phải cập nhật
  → Hiển thị "Tất cả mã" + tổng số advisory
```

### Szenario 3: Whale Alert Realtime

```
Bước 1: Backend gửi whale_alert mới
  → WebSocket nhận event

Bước 2: Component re-fetch danh sách
  → API call getWhaleAdvisories()

Bước 3: State items cập nhật
  → whaleTrackerData recalculate

Bước 4: UI cập nhật:
  - Heatmap sắp xếp lại
  - Spotlight new card (nếu cùng mã đã chọn)
```

---

## 📱 Responsive Design

| Breakpoint | Hành Vi |
|-----------|--------|
| **Desktop** (≥ 1024px) | 2 cột: 35% + 65% |
| **Tablet** (768-1024px) | Stack 1 cột (1fr), cột trái cuộn ngang |
| **Mobile** (< 768px) | Stack 1 cột, heatmap ở trên, feed ở dưới |

---

## 🚀 Các Tính Năng Tương Lai

### Phase 2 (Có thể thêm)
- ✅ **Sparkline tương tác:** Click mini chart để zoom vào timeseries
- ✅ **Tag AI động:** Backend trả về tags (`#BùngNổ`, `#RủiRo`) và hiển thị
- ✅ **Quick Action Buttons:** "Xem Biểu Đồ Kỹ Thuật" link tới StockDetail
- ✅ **Symbol Search:** Search box ở đầu cột trái để tìm mã nhanh
- ✅ **Watchlist Integration:** Thêm button "Theo dõi" để lưu vào watchlist
- ✅ **Notifications:** Push browser notification khi có advisory mới của mã yêu thích

---

## 📄 Files Đã Chỉnh Sửa

| File | Thay Đổi |
|------|---------|
| `frontend/src/pages/WhaleAdvisory.jsx` | Hoàn toàn redesign thành 2 cột + Heatmap tracker + Filter state |

---

## 🧪 Testing Checklist

- [ ] Load trang → Hiển thị heatmap danh sách mã đúng (sắp xếp tần suất)
- [ ] Click 1 mã → Cột phải filter ngay lập tức
- [ ] Click "Xem tất cả" → Cột phải hiển thị tất cả advisory
- [ ] Heatmap color đúng (đỏ > 10, cam 5-10, xanh < 5)
- [ ] Sparkline vẽ đúng (5 nến gần nhất)
- [ ] Mobile view stack 1 cột đúng
- [ ] Tooltip hover xuất hiện
- [ ] Refresh button hoạt động

---

## 📞 Support

**Bố cục:** Modern Fintech Dashboard (như TradingView, Binance Pro)
**Framework:** React 18 + Tailwind CSS
**State:** React Hooks (useState, useMemo, useCallback)
**Responsive:** Grid layout với media queries

Chúc bạn sử dụng tốt bố cục mới! 🎉

---

**Ngày Cập Nhật:** 2024-04-03  
**Phiên Bản:** 2.0 (Whale Advisory 2-Column Layout)
