# Sprint 20 — Cấu hình ngôn ngữ (i18n) cho Frontend & Mobile App

**Sprint**: 20  
**Thời gian ước tính**: 2 tuần (10 ngày làm việc)  
**Ưu tiên**: Medium-High (UX quality + quốc tế hóa)  
**Trạng thái**: PLANNED (Mobile đã được tích hợp vào Sprint 19)

---

## ⚠️ Điều chỉnh phạm vi (2026-04-05)

**Phần Mobile App (Bước 7-9 bên dưới) đã được thực hiện sớm trong Sprint 19** vì:
- Mobile app đang trong giai đoạn code tích cực, migrate strings ngay lúc này tránh nợ kỹ thuật.
- Các dependency đã sẵn sàng (`AsyncStorage`, `zustand` đều đã cài).
- Scope mobile nhỏ (~9 giờ), không ảnh hưởng đến timeline Sprint 19.

**Sprint 20 chỉ còn**: Backend (`UserConfig.language`) + Frontend React (8 pages) + sync cross-platform.

---

## Mục tiêu

Cho phép người dùng chuyển đổi giao diện giữa **Tiếng Việt** và **English** trên cả Frontend (React) và Mobile App (React Native + Expo), với ngôn ngữ được đồng bộ giữa các thiết bị qua backend `UserConfig`.

---

## Phân tích hiện trạng

### Frontend (React + Tailwind)
| Hạng mục | Tình trạng |
|---|---|
| Framework | React 18, JSX, không có i18n library |
| State | PortfolioContext → `userConfig` lấy từ `/api/ai-config/` |
| Persistence | `localStorage` cho tokens, sidebar state |
| Chuỗi UI | Hard-code trực tiếp trong JSX (tiếng Việt lẫn tiếng Anh), ví dụ: `'Tổng quan'`, `'Giao dịch'` trong Layout.jsx |
| Số/ngày | `Intl.NumberFormat('vi-VN')` cố định locale |
| i18n lib | Chưa có |

### Mobile App (React Native + Expo + TypeScript)
| Hạng mục | Tình trạng |
|---|---|
| Framework | Expo ~54, TypeScript ~5.9 |
| State | Zustand v5 (authStore), không có locale store |
| Persistence | `expo-secure-store` cho tokens, `@react-native-async-storage` đã cài |
| Chuỗi UI | Hard-code trong TSX, mix VI/EN không nhất quán |
| i18n lib | Chưa có |

### Backend (Django + DRF)
| Hạng mục | Tình trạng |
|---|---|
| `UserConfig` model | Có các trường: `theme`, `ai_provider`, `plan`, ... nhưng **chưa có `language`** |
| Serializer | `UserConfigSerializer` expose qua `/api/ai-config/` GET/PUT |
| Migration | Cần tạo mới |

---

## Quyết định thiết kế

### Lựa chọn thư viện

**Không dùng `react-i18next` hay `i18n-js`** ở giai đoạn này vì:
- Thêm ~150KB vào bundle, cần setup phức tạp (namespace, backend loader, detector)
- Product có scope UI strings bounded và xác định
- Team control tốt hơn với typed custom dictionary
- Dễ migrate lên thư viện nặng hơn sau nếu cần (Sprint 25+)

**Quyết định**: Lightweight custom i18n với typed dictionary + React Context (frontend) / Zustand slice (mobile).

### Lưu trữ preference
1. **Backend** (`UserConfig.language`) — nguồn sự thật, sync cross-device
2. **Frontend** localStorage (`lang`) — fallback nhanh khi chưa login, cache khi offline
3. **Mobile** AsyncStorage (`vninvest_language`) — persist qua lần mở app

Thứ tự ưu tiên khi resolve: `userConfig.language` > localStorage/AsyncStorage > browser lang header > `'vi'`

---

## Kiến trúc tổng thể

```
Backend
└── UserConfig.language  CharField('vi'|'en', default='vi')
         ↕ GET/PUT /api/ai-config/
Frontend (React)                    Mobile (React Native)
├── src/i18n/                       ├── src/i18n/
│   ├── vi.js  (tất cả strings VI)  │   ├── vi.ts
│   ├── en.js  (tất cả strings EN)  │   ├── en.ts
│   └── index.js (t() factory)      │   └── index.ts (typed t())
├── src/context/                     ├── src/store/
│   └── LangContext.jsx              │   └── localeStore.ts  (Zustand+AsyncStorage)
└── (toggle button in Layout.jsx)   └── (toggle trong DashboardScreen.tsx)
```

---

## Chi tiết triển khai

### Bước 1 — Backend: Thêm `language` vào UserConfig (0.5 ngày)

**File**: `backend/portfolio/models.py`

Thêm field vào class `UserConfig`:
```python
LANGUAGE_CHOICES = [
    ('vi', 'Tiếng Việt'),
    ('en', 'English'),
]

language = models.CharField(
    max_length=5,
    choices=LANGUAGE_CHOICES,
    default='vi',
    verbose_name='Ngôn ngữ giao diện',
)
```

**File**: `backend/portfolio/serializers.py` — `UserConfigSerializer.Meta.fields`  
Thêm `'language'` vào `fields` list. Không thêm vào `read_only_fields` (user được phép tự đổi).

**Tạo migration**:
```bash
python manage.py makemigrations portfolio --name add_language_to_userconfig
python manage.py migrate
```

---

### Bước 2 — Frontend: Translation dictionaries (1 ngày)

**File**: `frontend/src/i18n/vi.js`
```js
export default {
  nav: {
    overview: 'Tổng quan',
    transactions: 'Giao dịch',
    market_radar: 'Radar thị trường',
    whale_alerts: 'Whale Alerts',
    screener: 'Screener',
    ai_advisory: 'AI Advisory',
    admin_ops: 'Admin Ops',
  },
  plan: {
    free: 'Miễn phí',
    basic: 'Cơ bản',
    pro: 'Chuyên nghiệp',
    premium: 'Cao cấp',
    admin: 'Quản trị viên',
  },
  auth: {
    login: 'Đăng nhập',
    register: 'Đăng ký',
    logout: 'Đăng xuất',
    username: 'Tên đăng nhập',
    password: 'Mật khẩu',
    email: 'Email',
  },
  dashboard: {
    title: 'Tổng quan danh mục',
    total_value: 'Tổng giá trị',
    unrealized_pl: 'Lãi/Lỗ chưa thực hiện',
    realized_pl: 'Lãi/Lỗ đã thực hiện',
    dividends: 'Cổ tức',
    top_holdings: 'Cổ phiếu lớn nhất',
    top_allocation: 'Phân bổ danh mục',
    loading: 'Đang tải...',
    error_load: 'Không thể tải dashboard. Vui lòng thử lại.',
    empty: 'Chưa có dữ liệu.',
  },
  transactions: {
    title: 'Giao dịch',
    add: 'Thêm giao dịch',
    edit: 'Sửa',
    delete: 'Xoá',
    symbol: 'Mã CK',
    quantity: 'Số lượng',
    price: 'Giá',
    date: 'Ngày',
    type: 'Loại',
    buy: 'Mua',
    sell: 'Bán',
    save: 'Lưu',
    cancel: 'Huỷ',
  },
  watchlist: {
    title: 'Watchlist & Whale Alerts',
    add_symbol: 'Thêm mã theo dõi',
    remove: 'Xoá',
    whale_hub: 'Whale Alerts Hub',
    whale_detail: 'Chi tiết Whale',
    connected: 'Đã kết nối',
    polling: 'Đang polling',
    disconnected: 'Mất kết nối',
    sort_time: 'Sắp xếp: Thời gian',
    sort_value: 'Sắp xếp: Giá trị',
    refresh: 'Làm mới',
    no_alerts: 'Chưa có whale alert.',
    no_advisory: 'Chưa có advisory.',
    refresh_ai: 'Refresh AI',
    groups: 'Nhóm Watchlist',
  },
  settings: {
    language: 'Ngôn ngữ',
    theme: 'Giao diện',
    save: 'Lưu cài đặt',
    saved: 'Đã lưu',
  },
  common: {
    loading: 'Đang tải...',
    error: 'Đã có lỗi. Vui lòng thử lại.',
    empty: 'Không có dữ liệu.',
    confirm_delete: 'Bạn có chắc muốn xoá?',
  },
};
```

**File**: `frontend/src/i18n/en.js`
```js
export default {
  nav: {
    overview: 'Overview',
    transactions: 'Transactions',
    market_radar: 'Market Radar',
    whale_alerts: 'Whale Alerts',
    screener: 'Screener',
    ai_advisory: 'AI Advisory',
    admin_ops: 'Admin Ops',
  },
  plan: {
    free: 'Free',
    basic: 'Basic',
    pro: 'Professional',
    premium: 'Premium',
    admin: 'Administrator',
  },
  auth: {
    login: 'Log In',
    register: 'Register',
    logout: 'Log Out',
    username: 'Username',
    password: 'Password',
    email: 'Email',
  },
  dashboard: {
    title: 'Portfolio Overview',
    total_value: 'Total Value',
    unrealized_pl: 'Unrealized P/L',
    realized_pl: 'Realized P/L',
    dividends: 'Dividends',
    top_holdings: 'Top Holdings',
    top_allocation: 'Portfolio Allocation',
    loading: 'Loading...',
    error_load: 'Failed to load dashboard. Please try again.',
    empty: 'No data available.',
  },
  transactions: {
    title: 'Transactions',
    add: 'Add Transaction',
    edit: 'Edit',
    delete: 'Delete',
    symbol: 'Symbol',
    quantity: 'Quantity',
    price: 'Price',
    date: 'Date',
    type: 'Type',
    buy: 'Buy',
    sell: 'Sell',
    save: 'Save',
    cancel: 'Cancel',
  },
  watchlist: {
    title: 'Watchlist & Whale Alerts',
    add_symbol: 'Add tracked symbol',
    remove: 'Remove',
    whale_hub: 'Whale Alerts Hub',
    whale_detail: 'Whale Detail',
    connected: 'Connected',
    polling: 'Polling',
    disconnected: 'Disconnected',
    sort_time: 'Sort: Time',
    sort_value: 'Sort: Value',
    refresh: 'Refresh',
    no_alerts: 'No whale alerts yet.',
    no_advisory: 'No advisory available.',
    refresh_ai: 'Refresh AI',
    groups: 'Watchlist Groups',
  },
  settings: {
    language: 'Language',
    theme: 'Theme',
    save: 'Save Settings',
    saved: 'Saved',
  },
  common: {
    loading: 'Loading...',
    error: 'An error occurred. Please try again.',
    empty: 'No data available.',
    confirm_delete: 'Are you sure you want to delete this?',
  },
};
```

**File**: `frontend/src/i18n/index.js`
```js
import vi from './vi';
import en from './en';

const LOCALES = { vi, en };

/**
 * Truy cập string bằng dot-notation.
 * Ví dụ: t('nav.overview'), t('dashboard.total_value')
 */
export function createTranslator(locale) {
  const dict = LOCALES[locale] || LOCALES.vi;
  return function t(key, fallback) {
    const parts = key.split('.');
    let node = dict;
    for (const part of parts) {
      if (node == null || typeof node !== 'object') return fallback ?? key;
      node = node[part];
    }
    return typeof node === 'string' ? node : (fallback ?? key);
  };
}

export const SUPPORTED_LOCALES = ['vi', 'en'];

export const LOCALE_LABELS = {
  vi: '🇻🇳 Tiếng Việt',
  en: '🇬🇧 English',
};
```

---

### Bước 3 — Frontend: LangContext (1 ngày)

**File**: `frontend/src/context/LangContext.jsx`
```jsx
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { createTranslator, SUPPORTED_LOCALES } from '../i18n';

const STORAGE_KEY = 'lang';

const LangContext = createContext(null);

export function LangProvider({ children, userConfig, onUpdateConfig }) {
  const [locale, setLocaleState] = useState(() => {
    // Thứ tự ưu tiên: userConfig > localStorage > 'vi'
    const stored = localStorage.getItem(STORAGE_KEY);
    const fromConfig = userConfig?.language;
    const resolved = fromConfig || stored || 'vi';
    return SUPPORTED_LOCALES.includes(resolved) ? resolved : 'vi';
  });

  // Đồng bộ khi userConfig thay đổi (sau login)
  useEffect(() => {
    if (userConfig?.language && SUPPORTED_LOCALES.includes(userConfig.language)) {
      setLocaleState(userConfig.language);
      localStorage.setItem(STORAGE_KEY, userConfig.language);
    }
  }, [userConfig?.language]);

  const setLocale = useCallback(async (nextLocale) => {
    if (!SUPPORTED_LOCALES.includes(nextLocale)) return;
    setLocaleState(nextLocale);
    localStorage.setItem(STORAGE_KEY, nextLocale);
    // Sync lên backend (fire-and-forget, không block UI)
    try {
      if (onUpdateConfig) await onUpdateConfig({ language: nextLocale });
    } catch {
      // Không có mạng → vẫn đổi local, sẽ sync lại sau
    }
  }, [onUpdateConfig]);

  const t = useMemo(() => createTranslator(locale), [locale]);

  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);

  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export function useTranslation() {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error('useTranslation must be used inside LangProvider');
  return ctx;
}
```

**Tích hợp vào `App.jsx`** — Wrap `LangProvider` bên trong `PortfolioProvider`:
```jsx
// Trong ProtectedLayout hoặc App.jsx:
const { userConfig, updateUserConfig } = usePortfolio();
return (
  <LangProvider userConfig={userConfig} onUpdateConfig={updateUserConfig}>
    <Layout />
  </LangProvider>
);
```

---

### Bước 4 — Frontend: Language toggle trong Layout.jsx (0.5 ngày)

Thêm nút toggle ở phần footer của sidebar (dưới nút Logout):
```jsx
import { useTranslation } from '../context/LangContext';
import { LOCALE_LABELS } from '../i18n';

// Trong Layout component:
const { locale, setLocale, t } = useTranslation();

// UI trong sidebar footer:
<div className="border-t border-gray-800 px-3 py-3">
  <button
    onClick={() => setLocale(locale === 'vi' ? 'en' : 'vi')}
    className="w-full rounded-md border border-gray-700 px-2 py-1.5 text-xs text-gray-400 hover:text-gray-200 hover:border-gray-500 transition-colors text-left"
    title="Đổi ngôn ngữ / Change language"
  >
    {LOCALE_LABELS[locale]}
  </button>
</div>
```

Cập nhật NAV_ITEMS để dùng `t()`:
```jsx
// Thay hard-code string bằng t() key
const NAV_ITEMS = [
  { to: '/dashboard', labelKey: 'nav.overview' },
  { to: '/transactions', labelKey: 'nav.transactions' },
];
// Render: <span>{t(item.labelKey)}</span>
```

---

### Bước 5 — Frontend: Cập nhật Intl.NumberFormat theo locale (0.5 ngày)

Các file dùng `Intl.NumberFormat('vi-VN', ...)`:
- `AllocationPieChart.jsx`, `PortfolioLineChart.jsx`, `StatCard.jsx`, `WhaleAlertsHub.jsx`, `AdminOps.jsx`

**Pattern sửa**: Thay `'vi-VN'` bằng `locale === 'vi' ? 'vi-VN' : 'en-US'` (nhận `locale` từ `useTranslation()`).

---

### Bước 6 — Frontend: Migration strings các trang (2 ngày)

Thứ tự migrate theo mức độ sử dụng cao nhất:

| Tuần | File | Strings cần dịch |
|---|---|---|
| 1 | `Layout.jsx` | Nav labels, plan labels, sidebar titles |
| 1 | `LoginModal.jsx` | Form labels, buttons, error messages |
| 1 | `Dashboard.jsx` | Metric labels, section titles |
| 2 | `Transactions.jsx` | Form labels, table headers, action buttons |
| 2 | `Watchlist.jsx` | All labels |
| 2 | `WhaleAlertsHub.jsx`, `WhaleAlertsDashboard.jsx` | All labels |
| 2 | `StockDetail.jsx`, `Screener.jsx`, `WhaleAdvisory.jsx` | All labels |
| 2 | `Upgrade.jsx`, `VerifyEmail.jsx` | All labels |

---

### Bước 7 — Mobile: Translation dictionaries & Zustand store (1 ngày)

**File**: `mobile-app/src/i18n/vi.ts`  
**File**: `mobile-app/src/i18n/en.ts`  
Cấu trúc tương tự frontend, typed với TypeScript interface:
```typescript
export type Translations = {
  tabs: { dashboard: string; transactions: string; watchlist: string };
  auth: { login: string; register: string; logout: string; username: string; password: string; email: string };
  dashboard: { title: string; total_value: string; unrealized_pl: string; /* ... */ };
  transactions: { title: string; add: string; /* ... */ };
  watchlist: { title: string; add_symbol: string; /* ... */ };
  common: { loading: string; error: string; empty: string };
};
```

**File**: `mobile-app/src/i18n/index.ts`
```typescript
import vi from './vi';
import en from './en';
import type { Translations } from './vi';

const LOCALES: Record<string, Translations> = { vi, en };
export type Locale = 'vi' | 'en';
export const SUPPORTED_LOCALES: Locale[] = ['vi', 'en'];

export function createTranslator(locale: Locale) {
  const dict = LOCALES[locale] ?? LOCALES.vi;
  return function t(key: string, fallback?: string): string {
    const parts = key.split('.');
    let node: unknown = dict;
    for (const part of parts) {
      if (node == null || typeof node !== 'object') return fallback ?? key;
      node = (node as Record<string, unknown>)[part];
    }
    return typeof node === 'string' ? node : (fallback ?? key);
  };
}
```

**File**: `mobile-app/src/store/localeStore.ts`
```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createTranslator, SUPPORTED_LOCALES } from '../i18n';
import type { Locale } from '../i18n';

const STORAGE_KEY = 'vninvest_language';

type LocaleState = {
  locale: Locale;
  t: ReturnType<typeof createTranslator>;
  bootstrap: () => Promise<void>;
  setLocale: (l: Locale) => Promise<void>;
};

export const useLocaleStore = create<LocaleState>((set) => ({
  locale: 'vi',
  t: createTranslator('vi'),

  bootstrap: async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY) as Locale | null;
      const resolved: Locale = stored && SUPPORTED_LOCALES.includes(stored) ? stored : 'vi';
      set({ locale: resolved, t: createTranslator(resolved) });
    } catch {
      // Fallback to 'vi'
    }
  },

  setLocale: async (nextLocale: Locale) => {
    if (!SUPPORTED_LOCALES.includes(nextLocale)) return;
    set({ locale: nextLocale, t: createTranslator(nextLocale) });
    try {
      await AsyncStorage.setItem(STORAGE_KEY, nextLocale);
    } catch {
      // Không block UI khi AsyncStorage lỗi
    }
  },
}));
```

---

### Bước 8 — Mobile: Bootstrap locale + sync từ userConfig (0.5 ngày)

**Trong `AppRoot.tsx`** hoặc `authStore.ts`:
- Sau khi `bootstrap()` auth thành công, gọi `localeStore.bootstrap()`
- Khi `authStore.login()` trả về user với `userConfig.language`, gọi `localeStore.setLocale(user.language)`

**Trong `authApi.ts`** — `getMe()` cần trả về `language` từ API → cần cập nhật `AuthUser` type:
```typescript
export type AuthUser = {
  id: number;
  username: string;
  email: string;
  plan: string;
  language?: 'vi' | 'en';  // Thêm field này
};
```

---

### Bước 9 — Mobile: Language toggle UI + screen migration (1.5 ngày)

**Vị trí toggle**: Thêm row "Ngôn ngữ / Language" vào DashboardScreen (phần thông tin tài khoản):
```typescript
const { locale, setLocale, t } = useLocaleStore(
  (s) => ({ locale: s.locale, setLocale: s.setLocale, t: s.t })
);
// Button toggle
<Pressable onPress={() => setLocale(locale === 'vi' ? 'en' : 'vi')}>
  <Text>{locale === 'vi' ? '🇻🇳 Tiếng Việt' : '🇬🇧 English'}</Text>
</Pressable>
```

**Migration thứ tự**:
1. `BottomTabBar.tsx` — tab labels
2. `AuthScreen.tsx` — form labels, buttons
3. `DashboardScreen.tsx` — metric labels, section titles
4. `TransactionsScreen.tsx` — form labels, table headers
5. `WatchlistScreen.tsx` — tất cả labels (nhiều nhất)

---

## Acceptance Criteria

### A. Backend
- [ ] `UserConfig.language` field tồn tại trong DB với default `'vi'`
- [ ] `GET /api/ai-config/` trả về `language`
- [ ] `PUT /api/ai-config/ {"language": "en"}` cập nhật thành công
- [ ] Migration chạy clean, không breaking

### B. Frontend
- [ ] Toggle ngôn ngữ xuất hiện trong sidebar, hoạt động ngay lập tức (không cần reload)
- [ ] Preference được lưu vào `localStorage` + sync backend
- [ ] Sau login, ngôn ngữ đồng bộ từ `userConfig.language`
- [ ] Tất cả nav items, plan labels, form buttons đã được dịch
- [ ] Số tiền VND format theo locale (vi-VN vs en-US)
- [ ] Dashboard, Transactions, Watchlist đã migrate toàn bộ strings
- [ ] Không có TypeScript/JSX error

### C. Mobile App
- [ ] Toggle ngôn ngữ trong DashboardScreen hoạt động ngay lập tức
- [ ] Preference persist qua lần tắt/mở app (AsyncStorage)
- [ ] Sau login, ngôn ngữ sync từ `userConfig.language`
- [ ] Tất cả screens (Auth, Dashboard, Transactions, Watchlist) đã migrate
- [ ] BottomTabBar labels update theo locale
- [ ] Không có TypeScript error

### D. UX
- [ ] Chuyển ngôn ngữ không gây mất state (không reload page)
- [ ] Khi offline, ngôn ngữ vẫn hoạt động từ local cache
- [ ] Fallback về `'vi'` khi locale không hợp lệ

---

## Timeline

| Ngày | Việc cần làm |
|---|---|
| Day 1 | Backend: model field + serializer + migration |
| Day 2 | Frontend: vi.js, en.js, index.js dictionaries |
| Day 3 | Frontend: LangContext, tích hợp vào App.jsx |
| Day 4 | Frontend: Language toggle trong Layout.jsx, migrate nav/plan strings |
| Day 5 | Frontend: Migrate Dashboard.jsx, LoginModal.jsx |
| Day 6 | Frontend: Migrate Transactions.jsx, Watchlist.jsx |
| Day 7 | Frontend: Migrate WhaleAlertsHub, WhaleAlertsDashboard, StockDetail |
| Day 8 | Mobile: vi.ts, en.ts, index.ts, localeStore.ts |
| Day 9 | Mobile: Bootstrap sync + toggle UI + migrate Auth/Dashboard/Transactions |
| Day 10 | Mobile: Migrate WatchlistScreen + sprint QA + checklist |

---

## Rủi ro & Giải pháp

| Rủi ro | Xác suất | Giải pháp |
|---|---|---|
| String bị bỏ sót khi migrate (hard-code còn sót) | Cao | Review theo component, dùng grep tìm regex `'[A-Z][a-z]` trong JSX sau khi xong |
| Số tiền format sai khi EN (VND là tiền VN, không có ký hiệu $) | Trung bình | Luôn hiển thị "VND" suffix, chỉ đổi thousands separator |
| Conflict khi nhiều developer cùng sửa string | Thấp | Dictionary theo module, chia task theo file |
| Mobile AsyncStorage lỗi trên một số device | Thấp | Try/catch, fallback về `'vi'` |
| Backend migration conflict với production data | Rất thấp | Field mới có default, không nullable, không phá existing records |

---

## Mở rộng tương lai (Backlog)

- **Sprint 25+**: Migrate sang `react-i18next` nếu thêm ngôn ngữ thứ 3 (ví dụ: Chinese, Japanese)
- **Sprint 25+**: Lazy-load dictionary (chỉ load locale đang dùng, không bundle cả 2)  
- **Sprint 26+**: Pluralize rules (số nhiều tiếng Anh vs tiếng Việt không có)
- **Sprint 27+**: RTL support nếu thêm Arabic/Hebrew
- **Sprint 28+**: Detect ngôn ngữ tự động từ `Accept-Language` header hoặc device locale
