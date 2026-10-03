# Kế hoạch nâng cấp UX Biểu đồ Dark Money Master Chart
**Ngày:** 14/04/2026  
**Mục tiêu:** Biểu đồ tại `/whale-alerts/<symbol>` phải đọc được ý nghĩa ngay cả với người dùng chưa có kinh nghiệm phân tích kỹ thuật.  
**File chính:** `frontend/src/components/DarkMoneyMasterChart.jsx`

---

## Tổng quan vấn đề hiện tại

| # | Vấn đề | Căn nguyên kỹ thuật |
|---|---|---|
| 🔴 | Biểu đồ CVD và Dark Flow không trùng thời gian với biểu đồ nến | Sync dùng `setVisibleLogicalRange` (theo index) — mỗi pane có số điểm khác nhau nên index map sai thời gian |
| 🔴 | Trục X không có thông tin | Chart1 và Chart2 cố ý `timeScale: { visible: false }`, chỉ Chart3 hiện — nhưng Chart3 không có label định dạng |
| 🔴 | CVD Y-axis hiển thị `-2500000000.00` | Không có `priceFormatter` tùy chỉnh, dùng mặc định raw number |
| 🟡 | Không có nút chuyển dạng đường / nến | Chưa có state `chartType` |
| 🟡 | Hover không hiện OHLC/Volume | Chưa subscribe `crosshairMove` |
| 🟡 | MA20/MA50 legend không hiện giá trị số hiện tại | Chỉ hiện màu + tên, không lấy `data[last].value` |
| 🟡 | MA line mảnh, chìm vào grid | `lineWidth: 2`, không có shadow effect |
| 🟢 | Không có khung giờ intraday (1h, 30m, 15m) | Backend chỉ có `1D`/`1W` — cần thêm interval intraday |
| 🟢 | Quick Signal Bar tóm tắt trạng thái | Chưa có component summary hiện thị ở đầu chart |

---

## Danh sách thay đổi chi tiết

### A1 — Fix Time Sync giữa 3 panes (BUG QUAN TRỌNG NHẤT)

**File:** `frontend/src/components/DarkMoneyMasterChart.jsx`

**Vấn đề:**  
Hiện tại dùng `subscribeVisibleLogicalRangeChange` → sync theo **index vị trí**. CVD có thể có 45 điểm, nến có 60 điểm, nên index 30 ở nến ≠ index 30 ở CVD.

**Fix:**  
Dùng `subscribeVisibleTimeRangeChange` → sync theo **giá trị thời gian thực**, đảm bảo các pane hiện đúng cùng một khoảng ngày.

**Code pattern:**
```js
// Trước (sai):
source.timeScale().subscribeVisibleLogicalRangeChange((range) => {
  target.timeScale().setVisibleLogicalRange(range);
});

// Sau (đúng):
source.timeScale().subscribeVisibleTimeRangeChange((range) => {
  if (range) target.timeScale().setVisibleRange(range);
});
```

---

### A2 — Hiển thị trục X có ngày tháng

**File:** `frontend/src/components/DarkMoneyMasterChart.jsx`

**Thay đổi:**  
- Chart1 (nến): đổi `timeScale: { visible: false }` → `visible: true`, format `dd/MM`
- Chart2 (CVD): tương tự, nhưng **ẩn trục X** vì liền kề Chart1 (tránh trùng lặp) → giữ `visible: false`  
- Chart3 (Dark Flow): **hiện trục X** với format đầy đủ `dd/MM/yy`, đây là pane dưới cùng nên user nhìn vào là biết

**LW Charts timeScale options cần thêm:**
```js
timeScale: {
  visible: true,          // chart1 và chart3
  timeVisible: true,
  secondsVisible: false,
  tickMarkFormatter: (time) => {
    const d = new Date(time * 1000);
    return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`;
  },
}
```

> **Lưu ý:** LW Charts dùng Unix timestamp (seconds) cho `time` field khi là string `YYYY-MM-DD` — đảm bảo backend trả đúng format ISO date string.

---

### A3 — Format CVD Y-axis dạng compact

**File:** `frontend/src/components/DarkMoneyMasterChart.jsx`

**Thay đổi:**  
Thêm `priceFormatter` vào `rightPriceScale` của Chart2:

```js
chart2.priceScale('right').applyOptions({
  scaleMargins: { top: 0.1, bottom: 0.1 },
  priceFormatter: (v) => fmtCompact(v),  // hàm fmtCompact đã có sẵn
});
```

Kết quả: `-2500000000` → `-2.5B`, `750000000` → `750M`

---

### A4 — Tăng MA line visibility

**File:** `frontend/src/components/DarkMoneyMasterChart.jsx`

**Thay đổi MA20 và MA50:**
```js
// Trước:
{ color: '#22d3ee', lineWidth: 2 }

// Sau:
{ color: '#22d3ee', lineWidth: 2.5, crosshairMarkerVisible: true, crosshairMarkerRadius: 4 }
```

---

### B1 — Toggle Line / Candle chart type

**File:** `frontend/src/components/DarkMoneyMasterChart.jsx`

**Thêm state:**
```js
const [chartType, setChartType] = useState('candle'); // 'candle' | 'line'
```

**Logic render:**
- `chartType === 'candle'` → dùng `CandlestickSeries` như hiện tại
- `chartType === 'line'` → dùng `AreaSeries` với `close` price, màu gradient cyan/emerald

```js
if (chartType === 'line') {
  const areaSeries = addSeriesCompat(chart1, 'addAreaSeries', AreaSeries, {
    lineColor: '#22d3ee',
    topColor: 'rgba(34,211,238,0.15)',
    bottomColor: 'rgba(34,211,238,0.02)',
    lineWidth: 2,
    priceLineVisible: true,
    lastValueVisible: true,
  });
  areaSeries.setData(candles.map(c => ({ time: c.time, value: c.close })));
} else {
  // candlestick như cũ
}
```

**UI Toggle button** (thêm vào header toolbar):
```jsx
<div className="flex rounded-lg border border-slate-700 overflow-hidden text-[10px]">
  {['candle', 'line'].map(type => (
    <button key={type} onClick={() => setChartType(type)}
      className={type === chartType ? 'bg-cyan-600 text-white px-2.5 py-1' : 'bg-slate-900 text-slate-400 px-2.5 py-1'}>
      {type === 'candle' ? t('darkMoneyChart.typeCandle') : t('darkMoneyChart.typeLine')}
    </button>
  ))}
</div>
```

**i18n keys cần thêm:**
```js
typeCandle: 'Nến'  // vi
typeLine:   'Đường' // vi
typeCandle: 'Candle' // en
typeLine:   'Line'   // en
```

---

### B2 — OHLC Crosshair Tooltip khi hover

**File:** `frontend/src/components/DarkMoneyMasterChart.jsx`

**Thêm state:**
```js
const [ohlcTooltip, setOhlcTooltip] = useState(null);
// { time, open, high, low, close, volume, change }
```

**Subscribe crosshairMove** sau khi tạo chart1:
```js
const candlesByTime = Object.fromEntries(data.candles.map(c => [c.time, c]));

chart1.subscribeCrosshairMove((param) => {
  if (!param.time || !param.point) {
    setOhlcTooltip(null);
    return;
  }
  const timeStr = typeof param.time === 'string' ? param.time
    : new Date(param.time * 1000).toISOString().slice(0, 10);
  const candle = candlesByTime[timeStr];
  if (!candle) { setOhlcTooltip(null); return; }

  // Tính % thay đổi so với phiên trước
  const idx = data.candles.findIndex(c => c.time === timeStr);
  const prev = idx > 0 ? data.candles[idx - 1] : null;
  const change = prev ? ((candle.close - prev.close) / prev.close) * 100 : null;

  setOhlcTooltip({ ...candle, change });
});
```

**Component `OhlcTooltip`** (đã được thêm vào file):  
Hiển thị O/H/L/C, % thay đổi (màu xanh/đỏ), Volume dạng compact. Đặt `absolute` trong container của Chart1's div.

---

### B3 — MA current value trong legend

**File:** `frontend/src/components/DarkMoneyMasterChart.jsx`

**Tính toán giá trị cuối MA:**
```js
const ma20Last = data?.moving_averages?.ma20?.at(-1)?.value;
const ma50Last = data?.moving_averages?.ma50?.at(-1)?.value;
```

**Cập nhật legend JSX:**
```jsx
// Trước:
<span className="text-cyan-400">MA20</span>

// Sau:
<span className="text-cyan-400">
  MA20{ma20Last ? `: ${fmtPrice(ma20Last)}` : ''}
</span>
```

---

### C3 — Quick Signal Bar (Summary Widget)

**File:** `frontend/src/components/DarkMoneyMasterChart.jsx`

**Component `QuickSignalBar`** (đã được thêm vào file):  
Thanh ngang ngay dưới header card, hiện trạng thái chiến thuật đang active với màu sắc theo trạng thái:
- 🟢 All-in → nền emerald
- 🟡 Gom thầm → nền amber  
- 🔴 Thoát hàng → nền rose
- ⚪ Đứng ngoài → nền slate

**Vị trí render:** Ngay sau `</div>` của header, trước `{loading ? ...}` block.

---

## Backend: Intraday Intervals (1h, 30m, 15m)

**File:** `backend/portfolio/views_dark_money_history.py`

### Yêu cầu

Hiện tại `VALID_INTERVALS = {'1D', '1W'}`. Để hỗ trợ intraday cần:

1. **Nguồn dữ liệu giá OHLC intraday:**  
   `fetch_history_dataframe` trong `vnbroker_adapter.py` hỗ trợ interval `'1'` (1 phút), `'5'`, `'15'`, `'30'`, `'60'` (1 giờ). Mapping cần làm:
   ```python
   INTERVAL_VNBROKER_MAP = {
       '1D': '1D', '1W': '1W',
       '1h': '60', '30m': '30', '15m': '15',
   }
   ```

2. **Period cho intraday khác với daily:**  
   1h → period tối đa ~30 ngày (tránh quá nhiều data)  
   ```python
   INTRADAY_PERIOD_DAYS_MAP = {
       '1h': 7, '30m': 3, '15m': 2,
   }
   ```

3. **Time format:** Intraday trả về timestamp dạng `YYYY-MM-DD HH:MM:SS`, LW Charts cần **Unix timestamp** cho intraday:
   ```python
   # Với intraday, time phải là Unix timestamp (int seconds)
   import calendar
   ts = calendar.timegm(dt.timetuple())
   candle['time'] = ts
   ```
   
   Frontend cần đổi `tickMarkFormatter` để hiển thị `HH:MM dd/MM`.

4. **Dark Flow Series intraday:**  
   Dùng `TruncHour` / `TruncMinute` thay vì `TruncDate`:
   ```python
   from django.db.models.functions import TruncHour, TruncMinute
   
   TRUNC_FN_MAP = {
       '1D': TruncDate, '1W': TruncWeek,
       '1h': TruncHour, '30m': TruncMinute,  # 30m cần custom
   }
   ```

5. **Whale signals intraday:**  
   Lọc theo `created_at__range` thay vì `trade_date__gte`, vì `IntradayTick.trade_date` chỉ có date.

6. **API param validation mở rộng:**
   ```python
   VALID_INTERVALS = {'1D', '1W', '1h', '30m', '15m'}
   ```

> **Ưu tiên:** `1h` trước vì data phong phú nhất. `30m` và `15m` sau, cần kiểm tra `OrderFlowSignal` có đủ điểm dữ liệu không.

---

## Frontend API Client

**File:** `frontend/src/api/client.js`

Cần cập nhật `getDarkMoneyHistory` để nhận thêm param:
```js
// Hiện tại:
export const getDarkMoneyHistory = (symbol, { period = '3M', interval = '1D' } = {}) =>

// Sau khi backend hỗ trợ intraday:
// Không cần đổi signature — params là dynamic, chỉ cần truyền đúng giá trị
```

---

## i18n — Keys cần thêm

Thêm vào cả `frontend/src/i18n/vi.js` và `frontend/src/i18n/en.js` trong section `darkMoneyChart`:

| Key | vi | en |
|---|---|---|
| `typeCandle` | `'Nến'` | `'Candle'` |
| `typeLine` | `'Đường'` | `'Line'` |
| `chartTypeLabel` | `'Dạng biểu đồ'` | `'Chart Type'` |
| `intradayNote` | `'Intraday chỉ hỗ trợ tối đa 7 ngày'` | `'Intraday supports up to 7 days'` |

---

## Thứ tự triển khai

```
Bước 1 (song song):
  - A1: Fix sync → DarkMoneyMasterChart.jsx (chart render useEffect)
  - A2: Trục X → thay timeScale options chart1 + chart3
  - A3: CVD format → thêm priceFormatter chart2
  - A4: MA lineWidth 2.5 + crosshairMarker

Bước 2 (song song):
  - B1: Toggle candle/line state + render logic + UI button
  - B2: crosshairMove subscribe + OhlcTooltip render
  - B3: MA value trong legend

Bước 3 (song song):
  - C3: Render <QuickSignalBar> ở đầu chart card
  - i18n: Thêm keys mới vào vi.js + en.js

Bước 4 (backend):
  - views_dark_money_history.py: thêm 1h support
  - vnbroker_adapter.py: kiểm tra interval '60' có hoạt động không
  - Mở rộng sang 30m/15m sau khi 1h ổn định

Bước 5:
  - Build frontend: docker compose up -d --build frontend
  - Test tại localhost/whale-alerts/FPT
  - Commit + push dev
```

---

## Files thay đổi tổng hợp

| File | Loại thay đổi |
|---|---|
| `frontend/src/components/DarkMoneyMasterChart.jsx` | Fix A1-A4, thêm B1-B3, C3 |
| `frontend/src/i18n/vi.js` | Thêm 4 keys |
| `frontend/src/i18n/en.js` | Thêm 4 keys |
| `backend/portfolio/views_dark_money_history.py` | Thêm intraday intervals |
| `backend/portfolio/adapters/vnbroker_adapter.py` | Verify interval mapping |

---

## Trạng thái hiện tại (tính đến 14/04/2026)

| Hạng mục | Trạng thái | Ghi chú |
|---|---|---|
| Helper functions (`fmtPrice`, `fmtVolume`, `fmtDate`) | ✅ Đã thêm | Nằm trong section Helpers |
| `QuickSignalBar` component | ✅ Đã thêm | Chưa render vào JSX |
| `OhlcTooltip` component | ✅ Đã thêm | Chưa subscribe crosshairMove, chưa render |
| `INTRADAY_INTERVALS` constant | ✅ Đã khai báo | Chưa dùng, chờ backend |
| A1 Fix sync | ⬜ Chưa làm | |
| A2 Trục X | ⬜ Chưa làm | |
| A3 CVD format | ⬜ Chưa làm | |
| A4 MA line width | ⬜ Chưa làm | |
| B1 Toggle type | ⬜ Chưa làm | |
| B2 OHLC tooltip logic | ⬜ Chưa làm | Component đã có, cần subscribe event |
| B3 MA value legend | ⬜ Chưa làm | |
| C3 QuickSignalBar render | ⬜ Chưa làm | Component đã có, cần thêm vào JSX |
| Backend intraday 1h | ⬜ Chưa làm | |
| i18n keys | ⬜ Chưa làm | |
