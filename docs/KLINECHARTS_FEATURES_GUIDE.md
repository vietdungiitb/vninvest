# Hướng Dẫn Các Chức Năng KlineCharts Nâng Cấp

## 📊 Tổng Quan
Dự án đã được nâng cấp để hỗ trợ đầy đủ các chức năng của KlineCharts tương tự trang https://preview.klinecharts.com/#en-US

## 🎯 Các Chức Năng Chính

### 1. **Các Chỉ Báo Kỹ Thuật (Indicators)**

Các chỉ báo có sẵn (nhấp nút để bật/tắt):

| Chỉ báo | Tên Đầy Đủ | Mục Đích |
|---------|-----------|---------|
| **MA** | Moving Average | Đường trung bình động 5, 10, 20, 30, 60 kỳ |
| **EMA** | Exponential MA | Trung bình động theo trọng số hàm mũ |
| **BOLL** | Bollinger Bands | Dải bollinger cho volatility |
| **MACD** | Moving Avg Convergence Divergence | Động lượng và xu hướng |
| **RSI** | Relative Strength Index | Vùng quá mua/quá bán (14 kỳ) |
| **KDJ** | Stochastic K-D-J | Dao động giá trong khoảng 0-100 |
| **STOCH** | Stochastic Oscillator | Oscillator stochastic |
| **SAR** | Parabolic SAR | Dừng - Dảo chiều tặng (SAR) |
| **ATR** | Average True Range | Độ biến động trung bình |
| **OBV** | On-Balance Volume | Khối lượng cân bằng |

**Cách sử dụng:**
- Nhấp nút chỉ báo → nút chuyển sang XÁC xanh (active)
- Nhấp lại để tắt chỉ báo
- Có thể bật nhiều chỉ báo cùng lúc

### 2. **Công Cụ Vẽ (Drawing Tools)**

#### Các công cụ khả dụng:
- **📏 Line** - Vẽ đường thẳng trên biểu đồ
- **📦 Rectangle** - Vẽ hình chữ nhật
- **🔺 Polygon** - Vẽ đa giác (nhiều điểm)
- **📝 Text** - Thêm ghi chú văn bản

**Cách sử dụng:**
1. Nhấp nút công cụ vẽ (nút chuyển sang tím - active)
2. Click các điểm trên biểu đồ để vẽ
3. Nhấp lại nút công cụ hoặc nút "Clear" để dừng vẽ
4. Nhấp "🗑️ Clear" để xóa tất cả các vẽ

**Ví dụ Workflow:**
```
1. Nhấp "📏 Line" → nút chuyển tím
2. Nhấp điểm đầu trên biểu đồ
3. Nhấp điểm cuối → hoàn thành đường
4. Nhấp "📏 Line" lại → thoát mode vẽ đường
```

### 3. **Chụp Ảnh (Screenshot)**

**Chức năng:** 📸 Screenshot
- Chụp lại toàn bộ biểu đồ hiện tại
- Lưu cho tệp PNG di động: `chart-[timestamp].png`
- Áp dụng background tối (#0f172a)

**Cách sử dụng:**
```
1. Tùy chỉnh biểu đồ (thêm chỉ báo, vẽ công cụ)
2. Nhấp nút "📸 Screenshot"
3. Ảnh sẽ tự động tải xuống
```

### 4. **Chế Độ Toàn Màn Hình (Fullscreen)**

**Chức năng:** ⛶ Fullscreen
- Hiển thị biểu đồ ở chế độ toàn màn hình
- Nhấp để vào/thoát fullscreen
- Hữu ích để phân tích chi tiết

### 5. **Bánh Công Cụ (Toolbar)**

#### Cấu Trúc Toolbar:
```
[Chỉ báo] | [Công cụ vẽ] ... | [Chụp] [Fullscreen]
    ↑            ↑              ↑
Nhóm tham số  Nhóm vẽ       Nhóm hành động
```

**Tính năng Visual:**
- Nút **xanh** = Chỉ báo đang bật
- Nút **tím** = Công cụ vẽ đang hoạt động
- Nút **xám** = Chế độ không hoạt động
- Nút **đỏ** = Hành động xóa/nguy hiểm
- Nút **xanh lá** = Hành động tích cực (chụp ảnh)

## 🔧 Cấu Hình Kỹ Thuật

### Frontend (React - StockDetail.jsx)

**Component:** `KLineChartComponent`

**State:**
```javascript
- activeIndicators: Theo dõi chỉ báo đang bật
- drawingMode: Công cụ vẽ hiện tại
- fullScreen: Trạng thái fullscreen
```

**Chức năng chính:**
```javascript
handleToggleIndicator()    // Bật/tắt chỉ báo
handleDrawingMode()        // Chuyển đổi công cụ vẽ
handleClearDrawings()      // Xóa tất cả vẽ
handleScreenshot()         // Tải xuống ảnh
handleToggleFullscreen()   // Vào/thoát fullscreen
```

### Backend (Django - workspace.html)

**Cấu trúc:**
- Toolbar HTML được tạo động bằng JavaScript
- 3 nhóm chức năng: Chỉ báo | Vẽ | Hành động
- State quản lý ở phía client

**Hàm helper:**
```javascript
toggleIndicator()      // Bật/tắt chỉ báo
toggleDrawingMode()    // Chuyển đổi công cụ vẽ
```

## 📱 Responsive Design

- Toolbar sử dụng **flexbox** với `flex-wrap: wrap`
- Hiệu ứng hover trên tất cả nút
- Nhóm chức năng tách biệt bằng border trái
- Nút hành động phía bên phải (`margin-left: auto`)

## 🎨 Bảng Màu

| Thành phần | Màu |
|-----------|-----|
| Background Toolbar | `#1e293b` (Slate 800) |
| Background Chart | `#0f172a` (Slate 950) |
| Nút Mặc Định | `#334155` (Slate 700) |
| Nút Active | `#3b82f6` (Blue 500) |
| Nút Drawing | `#a855f7` (Purple 600) |
| Nút Screenshot | `#16a34a` (Green 600) |
| Nút Clear | `#dc2626` (Red 600) |
| Text Color | `#cbd5e1` (Slate 200) |

## 🚀 Tính Năng Nâng Cao

### Kết Hợp Ngôn Ngữ MA

Ví dụ: Sử dụng **MA + RSI** để xác nhận xu hướng:
1. Bật **MA** (xác định xu hướng)
2. Bật **RSI** (xác nhận vùng quá mua/bán)
3. Vẽ **Line** để đánh dấu điểm hỗ trợ/kháng cự

### Phân Tích Volatility

Sử dụng **BOLL + ATR**:
1. Bật **Bollinger Bands** (hiệu suất biến động)
2. Bật **ATR** (độ lớn biến động)
3. Chụp ảnh để lưu phân tích

### Ghi Chú Kỹ Thuật

- Sử dụng **Text Tool** để ghi chú điểm quan trọng
- Sử dụng **Rectangle** để khoanh vùng pattern
- Screenshot để lưu tư vấn

## ⚠️ Lưu Ý Quan Trọng

1. **Chỉ báo được bật mặc định:** MA, VOL
2. **Drawing mode tự động tắt** khi chuyển sang chỉ báo khác
3. **Xóa vẽ không thể hoàn tác** - hãy chụp ảnh trước
4. **Screenshot hoạt động tốt nhất** ở kích thước màn hình lớn
5. **Hiệu suất:** Bật quá nhiều chỉ báo có thể làm chậm chart

## 🔄 Cập Nhật KlineCharts

**Phiên bản hiện tại:** `klinecharts@9.8.12`

Để cập nhật:
```bash
npm install klinecharts@latest
```

**Các indicator hỗ trợ khác:** DEMA, TEMA, HMA, SMA, TRIX, DMI, CCI, etc.

## 📞 Hỗ Trợ & Tài Liệu

- **Trang Chính Thức:** https://www.klinecharts.com/
- **GitHub:** https://github.com/klinecharts/klinecharts
- **API Docs:** https://klinecharts.com/zh-CN/docs/

---

**Ngày Cập Nhật:** 2024-04-03
**Phiên Bản:** 2.0 (Nâng cấp Full Features)
