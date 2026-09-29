# Kế hoạch Giải pháp: Khắc phục Lỗi Render Heatmap & Tích hợp Dialog Thông tin Mã Cổ phiếu

> **Doc packs áp dụng:**
> - `docs/DASHBOARD_INFORMATION_ARCHITECTURE_REDESIGN_HANDOFF_MASTER_20260519.md`
> - `docs/DASHBOARD_INFORMATION_ARCHITECTURE_REDESIGN_CODE_QUALITY_CONSTITUTION_20260519.md`
> - `docs/FRONTEND_DESIGN_DASHBOARD_INFORMATION_ARCHITECTURE_REDESIGN_20260519.md`
> - `quality/QUALITY.md`

Tài liệu này phân tích nguyên nhân sự cố hiển thị khi tương tác với Bản đồ danh mục (Portfolio Heatmap) và đề xuất kế hoạch chi tiết để tích hợp Dialog thông tin cổ phiếu cao cấp có tích hợp đồ thị xu hướng 24h và chuyển hướng thông minh.

---

## 1. Phân tích Nguyên nhân Gốc (Root Cause Analysis)

### Hiện tượng lỗi
Khi click chuột vào một mã chứng khoán (như `MWG`, `STB`, `PNJ`), Bản đồ nhiệt bị mất cấu trúc hiển thị:
- Các ô chữ nhật màu sắc của các mã hàng đầu bị biến mất, nhãn chữ bị đẩy lên trên cùng và trôi nổi tự do.
- Xuất hiện một hình khối hoặc vùng chữ nhật màu đen bao phủ phần lớn diện tích biểu đồ.

### Nguyên nhân kỹ thuật
- **Cơ chế mặc định của ECharts Treemap**: Thuộc tính `nodeClick` mặc định có giá trị `'zoomToNode'`. Khi click vào một ô, ECharts kích hoạt hiệu ứng thu phóng/drill-down.
- **Xung đột cấu trúc dữ liệu**: Các mã cổ phiếu đều là leaf node, việc drill-down vào leaf node gây lỗi tính toán tọa độ canvas, dẫn đến biến mất ô, vẽ đè mảng đen và đẩy text nhãn ra ngoài.
- **Xác minh**: Sunburst không bị lỗi này do cơ chế click khác, nhưng Treemap bắt buộc phải cấu hình `nodeClick: false` nếu muốn bắt sự kiện click tùy biến.

---

## 2. Đề xuất Giải pháp Kỹ thuật

Giải pháp gồm 3 phần:

### Phần A: Khắc phục lỗi render bằng cách chặn Drill-down mặc định
- Cấu hình `nodeClick: false` trong series Treemap (ECharts 5+ support).
- **Lưu ý**: Với Sunburst, `nodeClick` cũng support giá trị `false` — set tương tự để đồng nhất behavior.

### Phần B: Làm giàu dữ liệu Heatmap tại DashboardPage
Hiện tại, `heatmapData` được xây dựng thủ công và thiếu `company_name`, `industry`, `volume`. Ta sẽ cấu trúc lại bằng `buildModernDashboardSymbolUniverse` — utility đã có sẵn tại `src/utils/modernDashboardSymbolUniverse.js`, được dùng bởi `CoreDashboardPositionDeck.tsx` và `FactsFirstModularPositionDeck.jsx`.

**Không sửa** `DashboardPage.tsx` vì data đã được cast `as any` xuống `PortfolioHeatmap` — chỉ cần mở rộng `chartData` mapping bên trong `PortfolioHeatmap.js` để trích xuất thêm `company_name`, `industry`, `volume`.

### Phần C: Tích hợp Dialog Thông tin Cổ phiếu
Khi click vào ô cổ phiếu:
1. Ẩn tooltip mặc định của ECharts qua `echartsInstance.dispatchAction({ type: 'hideTip' })`.
2. Mở Dialog Glassmorphism chồng lên góc phải Heatmap.
3. Dialog hiển thị: tên mã (clickable → `/stocks/SYMBOL`), tên công ty, ngành, giá, % thay đổi, biểu đồ xu hướng 24h (SVG Sparkline nhẹ), khối lượng, vốn hóa, mức biến động.
4. API `getStockChartHistory` gọi từ `coreApiAdapter.getStockChartHistory` (lấy dữ liệu xu hướng thực tế).

---

## 3. Kế hoạch Thay đổi Code Chi Tiết

### 1. File [PortfolioHeatmap.js](file:///c:/Mujoco%20Projects/vninvest/packages/web/src/components/dashboard/PortfolioHeatmap.js)

#### a. Thêm imports
```javascript
import { coreApiAdapter } from "../../adapters/coreApiAdapter.js";
```

#### b. Thêm i18n keys vào I18N
```javascript
const I18N = {
  vi: {
    // ... existing keys
    "heatmap.dialog.close": "Đóng",
    "heatmap.dialog.trend": "Xu hướng 24h",
    "heatmap.dialog.price": "Giá hiện tại",
    "heatmap.dialog.volume": "Khối lượng",
    "heatmap.dialog.marketCap": "Vốn hóa",
    "heatmap.dialog.volatility": "Mức biến động",
    "heatmap.dialog.loading": "Đang tải xu hướng...",
    "heatmap.dialog.noData": "Không có dữ liệu",
    "heatmap.dialog.companyDefault": "Công ty Cổ phần",
    "heatmap.dialog.industryUnknown": "Chưa phân loại",
    "heatmap.dialog.volLow": "Thấp",
    "heatmap.dialog.volMed": "Vừa",
    "heatmap.dialog.volHigh": "Cao",
  },
  en: {
    // ... existing keys
    "heatmap.dialog.close": "Close",
    "heatmap.dialog.trend": "24h Trend",
    "heatmap.dialog.price": "Current Price",
    "heatmap.dialog.volume": "Volume",
    "heatmap.dialog.marketCap": "Market Cap",
    "heatmap.dialog.volatility": "Volatility",
    "heatmap.dialog.loading": "Loading trend...",
    "heatmap.dialog.noData": "No trend data",
    "heatmap.dialog.companyDefault": "Joint Stock Company",
    "heatmap.dialog.industryUnknown": "Unclassified",
    "heatmap.dialog.volLow": "Low",
    "heatmap.dialog.volMed": "Medium",
    "heatmap.dialog.volHigh": "High",
  },
};
```

#### c. Thêm state quản lý Dialog
```javascript
const [selectedDetail, setSelectedDetail] = useState(null);
const [trendPoints, setTrendPoints] = useState([]);
const [loadingTrend, setLoadingTrend] = useState(false);
```

#### d. Mở rộng chartData mapping để lấy company_name, industry, volume
Trong `useMemo` của `chartData`, thêm các field:
```javascript
const h = holdings?.[0] || {}; // holdings prop now carries enriched fields
// ... inside the map:
company_name: h.company_name || quote?.company_name || null,
industry: h.industry || quote?.industry || null,
volume: Number(quote?.volume || h?.volume || 0),
```

#### e. Vô hiệu hóa `nodeClick` trong series Treemap
```javascript
// Treemap series:
{
  type: "treemap",
  nodeClick: false,
  // ... existing
}
```

#### f. Vô hiệu hóa `nodeClick` trong series Sunburst
```javascript
// Sunburst series:
{
  type: "sunburst",
  nodeClick: false,
  // ... existing
}
```

#### g. Thêm hàm `fetchTrendData` và `handleNavigateToStock`
```javascript
const navigate = useNavigate(); // import useNavigate từ react-router-dom

const fetchTrendData = useCallback(async (symbol) => {
  if (!symbol) return;
  setLoadingTrend(true);
  try {
    const result = await coreApiAdapter.getStockChartHistory(symbol, {
      timeframe: "1H",
      days: 1,
    });
    const prices = result?.data?.map((p) => p.close) || [];
    setTrendPoints(prices);
  } catch {
    setTrendPoints([]);
  } finally {
    setLoadingTrend(false);
  }
}, []);

const handleNavigateToStock = useCallback((symbol) => {
  if (symbol) navigate(`/stocks/${symbol}`);
}, [navigate]);
```

#### h. Cập nhật `handleClick` — ẩn tooltip, mở dialog, fetch trend
```javascript
const handleClick = (params) => {
  if (params?.data) {
    if (chartRef.current) {
      const instance = chartRef.current.getEchartsInstance();
      instance.dispatchAction({ type: "hideTip" });
    }
    const data = params.data;
    setSelectedDetail(data);
    fetchTrendData(data.name);
  }
  if (params?.name && onSelectSymbol) {
    onSelectSymbol(params.name);
  }
};
```

#### i. Hàm render SVG Sparkline (dùng `<path>` thay `<polyline>`)
```javascript
function renderSparkline(prices, loading) {
  if (loading) {
    return e("div", { className: "h-12 w-full flex items-center justify-center text-[10px] text-slate-500" }, t("heatmap.dialog.loading"));
  }
  if (!prices || prices.length < 2) {
    return e("div", { className: "h-12 w-full flex items-center justify-center text-[10px] text-slate-500" }, t("heatmap.dialog.noData"));
  }

  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 1;
  const width = 240;
  const height = 40;

  const points = prices.map((p, i) => {
    const x = (i / (prices.length - 1)) * width;
    const y = height - ((p - min) / range) * height;
    return `${x},${y}`;
  });

  const d = points.map((pt, i) => `${i === 0 ? "M" : "L"} ${pt}`).join(" ");
  const color = prices[prices.length - 1] >= prices[0] ? "#22c55e" : "#ef4444";

  return e(
    "svg",
    { width: "100%", height, viewBox: `0 0 ${width} ${height}`, className: "overflow-visible" },
    e("path", {
      d,
      fill: "none",
      stroke: color,
      strokeWidth: 2.5,
      strokeLinecap: "round",
      strokeLinejoin: "round",
    })
  );
}
```

#### j. Hàm `getVolatilityLabel`
```javascript
function getVolatilityLabel(changePct) {
  const abs = Math.abs(changePct || 0);
  if (abs < 1) return t("heatmap.dialog.volLow");
  if (abs < 3) return t("heatmap.dialog.volMed");
  return t("heatmap.dialog.volHigh");
}
```

#### k. Render Dialog (thêm `relative` vào container cha)
Thêm `relative` vào container div:
```javascript
// Sửa className của container:
{ ref: containerRef, className: "core-heatmap h-full flex flex-col relative " + className }
```

Và render dialog overlay:
```javascript
// Bên trong return, sau thẻ div container kết thúc:
selectedDetail && e(
  "div",
  { className: "absolute top-12 right-4 w-72 glass-strong rounded-2xl border border-slate-800 p-5 shadow-2xl z-50 text-left animate-fade-in" },

  // Header
  e("div", { className: "flex items-start justify-between mb-1" },
    e("div", { className: "flex items-center gap-2" },
      e("button", {
        onClick: () => handleNavigateToStock(selectedDetail.name),
        className: "text-lg font-black text-slate-100 hover:text-cyan-400 hover:underline transition-all focus:outline-none",
      }, selectedDetail.name),
      e("span", {
        className: `px-1.5 py-0.5 rounded text-[10px] font-extrabold ${
          (selectedDetail.changePct || 0) >= 0
            ? "bg-emerald-500/10 text-emerald-400"
            : "bg-rose-500/10 text-rose-400"
        }`,
      }, `${(selectedDetail.changePct || 0) >= 0 ? "+" : ""}${(selectedDetail.changePct || 0).toFixed(2)}%`)
    ),
    e("button", {
      onClick: () => setSelectedDetail(null),
      className: "text-xs font-bold text-slate-500 hover:text-slate-300 transition-colors uppercase",
    }, t("heatmap.dialog.close"))
  ),

  // Company name & Industry
  e("div", { className: "text-xs text-slate-400 font-medium truncate mb-0.5" }, selectedDetail.company_name || t("heatmap.dialog.companyDefault")),
  e("div", { className: "text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-4" }, selectedDetail.industry || t("heatmap.dialog.industryUnknown")),

  // 24h Trend Chart
  e("div", { className: "mb-4" },
    e("div", { className: "text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-2" }, t("heatmap.dialog.trend")),
    renderSparkline(trendPoints, loadingTrend)
  ),

  // Details grid
  e("div", { className: "grid grid-cols-2 gap-y-3 gap-x-2 border-t border-slate-800/80 pt-4 text-xs" },
    e("div", null,
      e("div", { className: "text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-0.5" }, t("heatmap.dialog.price")),
      e("div", { className: "font-black text-slate-200" }, `${(selectedDetail.currentPrice || 0).toLocaleString("vi-VN")} VND`)
    ),
    e("div", null,
      e("div", { className: "text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-0.5" }, t("heatmap.dialog.volume")),
      e("div", { className: "font-black text-slate-200" }, selectedDetail.volume ? selectedDetail.volume.toLocaleString("vi-VN") : "--")
    ),
    e("div", null,
      e("div", { className: "text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-0.5" }, t("heatmap.dialog.marketCap")),
      e("div", { className: "font-black text-slate-200" }, selectedDetail.marketCap ? `${selectedDetail.marketCap.toLocaleString("vi-VN")} tỷ VND` : "--")
    ),
    e("div", null,
      e("div", { className: "text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-0.5" }, t("heatmap.dialog.volatility")),
      e("div", { className: "font-black text-slate-200" }, getVolatilityLabel(selectedDetail.changePct))
    )
  )
)
```

---

## 4. Kế hoạch Kiểm thử & Xác minh (Verification Plan)

### Kiểm thử tự động
1. **TypeScript compile**: `npx tsc --noEmit` — 0 errors.
2. **Build frontend**: `npm run build` — 0 errors.

### Kiểm thử thủ công
1. **Rebuild stack**: Chạy `./start_dev.ps1` (theo AGENTS.md §6.6) để rebuild containers và restart dev stack.
2. Đăng nhập `admin` / `test@123456` tại `http://localhost/dashboard`.
3. Click vào các mã trên Treemap (`HPG`, `STB`, `PNJ`):
   - Bản đồ không bị mất màu, không trôi text, không khối đen.
   - Tooltip mặc định biến mất ngay.
   - Dialog Glassmorphism hiện ra với đúng thông tin mã, công ty, ngành.
   - SVG Sparkline hiển thị đường xu hướng xanh/đỏ.
   - Click tên mã → chuyển hướng `/stocks/SYMBOL`.
4. Chuyển sang Sunburst view, click lại — xác nhận behavior tương tự.

### Nghĩa vụ bằng chứng (AGENTS.md §7)
- Danh sách file đã sửa: `PortfolioHeatmap.js`.
- Output `npx tsc --noEmit` và `npm run build`.
- Screenshot Dialog sau khi click mã.
- Residual risk note nếu có.
- Cập nhật `docs/CODE_CHANGE_AUDIT_LEDGER.md` và `PROGRESS_DASHBOARD.md`.

---

## 5. Ràng buộc AGENTS.md cần tuân thủ

| Mục | Yêu cầu | Trạng thái |
|-----|---------|------------|
| §6.2 | Focused validation sau edit đầu tiên | ✅ `npx tsc --noEmit` |
| §6.3 | Cập nhật CODE_CHANGE_AUDIT_LEDGER.md + PROGRESS_DASHBOARD.md | ✅ Sau khi merge |
| §6.6 | Dùng `./start_dev.ps1` — không dùng docker compose trực tiếp | ✅ |
| §8.8 | Mọi API call qua `coreApiAdapter.js` | ✅ `getStockChartHistory` từ `coreApiAdapter` |
| §8.9 | Text mới qua i18n tiếng Việt đầy đủ dấu | ✅ Tất cả text dialog trong I18N dict |
| §10 | OpenAPI — không chạm contract | ✅ Không sửa backend |
| §8.11 | Chỉ sửa trong packages/web | ✅ Chỉ PortfolioHeatmap.js |
