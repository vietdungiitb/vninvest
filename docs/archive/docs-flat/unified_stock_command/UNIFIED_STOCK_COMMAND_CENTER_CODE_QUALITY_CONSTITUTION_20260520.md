# CODE QUALITY CONSTITUTION — Unified Stock Command Center
## Feature: UNIFIED_STOCK_COMMAND_CENTER | Ngày: 2026-05-20

---

## 1. Immutable source protection (Rule tuyệt đối)

Các file sau **KHÔNG ĐƯỢC PHÉP** thay đổi dù bất kỳ lý do gì:

```
frontend/src/components/WhaleBubbleChart.jsx
frontend/src/components/WhaleAnalyticsTab.jsx
frontend/src/components/modern/ModularPositionDeck.jsx
```

Violation → PR bị reject ngay lập tức, không cần review thêm.

---

## 2. Coding conventions

### 2.1 Component design
- Component mới phải là **functional component** với React hooks.
- Không dùng class component.
- Props phải được destructure tường minh, không spread `{...props}` vô tổ chức.
- Tên component phải PascalCase, mô tả đúng chức năng.

### 2.2 State management
- `selectedTradeDate` và `selectedTimeframe` phải là **page-level state** trong `StockDetailUnifiedPage`.
- Không được có local session state trong `AnalyticsTabDeck` hoặc các tab con.
- Không dùng global Redux/Zustand store cho session state (trừ trường hợp đã có sẵn trong project).

### 2.3 Data fetching
- Tái sử dụng hooks đã có (`useWhaleAnalyticsData`, `useAIAdvisor`).
- Lazy fetch: chỉ gọi API khi tab được activate lần đầu.
- Implement `isMounted` check hoặc dùng AbortController để cancel request khi unmount.

### 2.4 Performance
- `KLineChartPanel` phải được bọc trong `React.memo` nếu có nguy cơ re-render không cần thiết.
- Không render bất kỳ thứ gì trong Tab content cho đến khi tab đó được active lần đầu (lazy mount).
- Sau khi tab được mount lần đầu, giữ trong DOM với `display: none` thay vì unmount.

---

## 3. CSS/Styling rules

- Không dùng inline style cho layout (chỉ dùng cho dynamic values như width tính toán).
- Không dùng Tailwind class nếu project không có Tailwind.
- CSS class mới phải follow BEM hoặc naming convention hiện có của project.
- Tất cả color, spacing, border phải dùng CSS custom properties (`var(--token-name)`).
- Không hardcode màu hex trực tiếp trong component file.

---

## 4. i18n rules

- **100% text mới** trên UI phải dùng i18n key.
- Key phải theo pattern: `commandCenter.<section>.<key>`.
- Không viết text tiếng Việt hardcode trong JSX.
- Sau khi thêm key mới, phải kiểm tra xem key đó có trong tất cả locale files không.

```jsx
// ✅ Đúng:
const { t } = useTranslation();
<span>{t('commandCenter.tab.whale')}</span>

// ❌ Sai:
<span>🐋 Cá Mập</span>
```

---

## 5. Code review checklist

Reviewer phải xác nhận tất cả items sau trước khi approve PR:

- [ ] Không sửa các file immutable.
- [ ] `selectedTradeDate` là page-level state, không bị duplicate.
- [ ] Tất cả text UI mới có i18n key.
- [ ] Không có hardcode color hex trong JSX/JSS.
- [ ] Lazy mount được implement cho tab content.
- [ ] Không có new backend endpoint.
- [ ] `npm run build` pass.
- [ ] Unit tests pass.

---

## 6. Forbidden patterns

```jsx
// ❌ Forbidden: sửa immutable source
import WhaleBubbleChart from '../WhaleBubbleChart'; // READ ONLY
WhaleBubbleChart.defaultProps = { ... }; // FORBIDDEN

// ❌ Forbidden: session state trong tab con
function TabWhale() {
  const [localTradeDate, setLocalTradeDate] = useState(null); // FORBIDDEN
}

// ❌ Forbidden: hardcode text
<button>🐋 Cá Mập</button> // FORBIDDEN — phải dùng i18n

// ❌ Forbidden: unmount KLine khi switch tab
{activeTab === 'whale' && <KLineChartPanel />} // FORBIDDEN — KLine luôn mounted

// ✅ Allowed: hide tab content
<div style={{ display: activeTab === 'orderflow' ? 'block' : 'none' }}>
  <OrderFlowRadarPanel />
</div>
```
