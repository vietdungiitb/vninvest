# FRONTEND DESIGN — Unified Stock Command Center
## Feature: UNIFIED_STOCK_COMMAND_CENTER | Ngày: 2026-05-20

---

## 1. Wireframe tổng thể

```
┌─────────────────────────────────────────────────────────────────────┐
│  TOPBAR: [BMP Logo] BMP  137.00  -2.91%  [Theo dõi] [Lưu] [Cảnh báo]│
├──────────────────────────────────────────────┬──────────────────────┤
│  KLINE WORKSPACE                             │  SỔ LỆNH            │
│  ┌──────────────────────────────────────────┐│  3 MỨC GIÁ          │
│  │  Biểu đồ nến BMP         [1H] [Tooltip] ││  ──────────────────  │
│  │  [VOL][MA][EMA][BOLL]...  [Heatmap] [Net]││  Mua  Giá  Bán     │
│  │                                          ││  ...                │
│  │         ████ ████                        ││  141.10             │
│  │      █  ████ ████  ██                    ││  140.60             │
│  │  ────────────────────────────────        ││  139.30             │
│  │  Pane CVD chuẩn hoá (cùng trục X)       │├──────────────────────┤
│  │  ────────────────────────────────        ││  KHỚP LỆNH          │
│  │  Pane Sức mạnh tổ chức                  ││  GIỜ  GIÁ   KL     │
│  └──────────────────────────────────────────┘│  14:45 137  11,900  │
│                                              │  14:45 137  11,900  │
│  ┌─ ANALYTICS TAB DECK ───────────────────┐ │  14:45 137  11,900  │
│  │ [🐋 Cá Mập] [📊 Order Flow] [🤖 AI]   │ │                     │
│  ├────────────────────────────────────────┤ │  [◀ Thu gọn]        │
│  │  (nội dung tab hiện tại)               │ │                     │
│  └────────────────────────────────────────┘ │                     │
└──────────────────────────────────────────────┴──────────────────────┘
```

---

## 2. CommandCenterTopBar design

```
┌─────────────────────────────────────────────────────────────────────┐
│  [BMP]  BMP                        │ Theo dõi realtime │ Thép & VL │
│         Chưa rõ sàn · Chưa rõ ngành│                               │
│                                                                     │
│  GIÁ HIỆN TẠI (nghìn VND)                                          │
│  137.00   -4.10  -2.91%                                             │
│                                                                     │
│  [Bỏ theo dõi] [Ngân hàng ▾] [Lưu vào nhóm] [Mức cảnh báo] [Tạo] │
│                                                                     │
│  Shortlist: ✓ Theo dõi  |  DS nhóm (1): Thép & VL                 │
├─────────────────────────────────────────────────────────────────────┤
│  REF/TRẦN/SÀN      BIÊN ĐỘ NGÀY       BIÊN ĐỘ 52W                 │
│  141.10            136.50 → 140.60    114.64                        │
│  150.90/131.30     KL: 176,000        +180.67                       │
├─────────────────────────────────────────────────────────────────────┤
│  GIÁ TB PHIÊN      THIÊN HƯỚNG        BIẾN ĐỘNG KHUNG CHART        │
│  138.58            Trung tính          +3.13%                       │
└─────────────────────────────────────────────────────────────────────┘
```

**Compact mode** (khi scroll xuống — sticky top bar):
```
[BMP] 137.00  -2.91%  │  [🐋] [📊] [🤖]  │  [Sổ lệnh ▾]
```

---

## 3. AnalyticsTabDeck — Tab layouts

### Tab 1: 🐋 Cá Mập

```
┌──────────────────────────────────────────────────────┐
│  PHÂN BỔ LỆNH LỚN — Giá × Khối lượng (Bubble)       │
│  [Khoảng thời gian: Cả phiên ▾]  Phiên: 20/05/2026  │
│  ┌──────────────────┐  ┌──────────────────────────┐  │
│  │  BẢNG THÔNG TIN  │  │   BUBBLE CHART           │  │
│  │  BMP · session   │  │                          │  │
│  │  Tổng lệnh lớn 5 │  │    ●  ●    ●             │  │
│  │  Lệnh mua     1  │  │         ●                │  │
│  │  Lệnh bán     4  │  │                          │  │
│  └──────────────────┘  └──────────────────────────┘  │
│                                                       │
│  CẢNH BÁO DÒNG TIỀN LỚN (Realtime)                  │
│  CVD chuẩn hóa: 0.0  | Sức mua 60 | Tổ chức 54.8   │
│  [Cả phiên] [Buổi sáng] [Buổi chiều]                │
│                                                       │
│  KHỐI LƯỢNG TƯƠNG ĐỐI (RVOL)                        │
│  Khối lượng 15 phút so với nền 20 phiên              │
└──────────────────────────────────────────────────────┘
```

### Tab 2: 📊 Order Flow

```
┌──────────────────────────────────────────────────────┐
│  ORDER FLOW RADAR                                     │
│  ┌─────────────────────────────┐  ┌───────────────┐  │
│  │  Radar chart phân bổ lệnh  │  │  MONEY FLOW   │  │
│  │  (CVD series, Dark Flow,   │  │  DONUT        │  │
│  │   tick rate, size dist)    │  │               │  │
│  │                             │  │  Flow ròng   │  │
│  │                             │  │  +0           │  │
│  └─────────────────────────────┘  └───────────────┘  │
│                                                       │
│  TỈ LỆ SIZE DISTRIBUTION  │  TICK RATE  │  CVD RAW   │
└──────────────────────────────────────────────────────┘
```

### Tab 3: 🤖 AI Advisory

```
┌──────────────────────────────────────────────────────┐
│  AI ADVISORY — BMP  |  Phiên: 20/05/2026            │
│  [Tạo mới] [Tải lại] [Cấu hình prompt ▾]           │
│                                                       │
│  ┌─────────────────────────────────────────────────┐ │
│  │  NHẬN ĐỊNH TỔNG HỢP (Executive Summary)         │ │
│  │  ...                                            │ │
│  ├─────────────────────────────────────────────────┤ │
│  │  [Kỹ thuật] [Cơ bản] [Cá mập] [Dòng tiền]     │ │
│  │  Chi tiết từng component...                     │ │
│  └─────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────┘
```

---

## 4. Right Sidebar design

```
┌──────────────────────────┐
│  SỔ LỆNH 3 MỨC GIÁ      │
│  [Ô Tự làm mới]  [↻]    │
│  ▲ Mua: 0  ▼ Bán: 0     │
│  KL: 161,000             │
│  ─────────────────────── │
│  GIỜ    GIÁ    KL   M/B  │
│  14:45  137  11,900  —   │
│  ...                     │
├──────────────────────────┤
│  ĐỘ SÂU THỊ TRƯỜNG       │
│  Sổ lệnh 3 mức giá       │
│  [Cập nhật]              │
│  MUA     GIÁ    BÁN      │
│  ...                     │
└──────────────────────────┘
[◀ Thu gọn sidebar]
```

---

## 5. Color & Typography tokens

```css
/* Reuse existing design tokens từ project */
--surface-1: #0e1117;          /* Background chính */
--surface-2: #161b22;          /* Card/panel bg */
--surface-3: #21262d;          /* Tab bar, input bg */
--border-subtle: #30363d;      /* Border nhẹ */
--accent-blue: #58a6ff;        /* Active tab indicator, CTA */
--accent-green: #3fb950;       /* Tăng giá, mua */
--accent-red: #f85149;         /* Giảm giá, bán */
--text-primary: #e6edf3;       /* Text chính */
--text-muted: #8b949e;         /* Label phụ */
--text-subtle: #6e7681;        /* Placeholder, timestamp */

/* Tab deck specific */
--tab-height: 36px;
--tab-padding: 8px 20px;
--tab-font-size: 13px;
--tab-active-border: 2px solid var(--accent-blue);
```

---

## 6. Animation & Micro-interactions

### Tab switching
```css
/* Fade + slide từ dưới lên */
@keyframes tabFadeIn {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
}
.tab-content-panel { animation: tabFadeIn 0.18s ease-out; }
```

### Sidebar toggle
```css
.right-sidebar {
  transition: width 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
}
.right-sidebar.collapsed { width: 0; }
.right-sidebar.expanded { width: 320px; }
```

### Compact TopBar (scroll-triggered)
```css
.command-center-topbar {
  transition: padding 0.2s, font-size 0.2s;
}
.command-center-topbar.compact {
  padding: 6px 16px;
}
.command-center-topbar.compact .price-display {
  font-size: 18px;
}
```

---

## 7. Scroll behavior

- `KLineChartPanel` và `AnalyticsTabDeck` nằm trong `overflow: hidden` container.
- Scroll chỉ xảy ra **bên trong** AnalyticsTabDeck (overflow-y: auto).
- TopBar sticky: dùng `position: sticky; top: 0; z-index: 100`.
- Compact TopBar trigger: khi scroll trong analytics deck vượt 40px.
