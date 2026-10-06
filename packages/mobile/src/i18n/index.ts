export type Locale = 'vi' | 'en';

const vi = {
  tabs: {
    dashboard: 'Tổng quan',
    transactions: 'Giao dịch',
    watchlist: 'Watchlist',
    whale: 'Whale',
    profile: 'Tài khoản',
  },
  auth: {
    app_tagline: 'Quản lý danh mục cổ phiếu Việt Nam',
    login: 'Đăng nhập',
    register: 'Đăng ký',
    username_placeholder: 'Username (không phải email)',
    login_hint: 'Đăng nhập bằng username, không dùng email.',
    prefill_test: 'Điền nhanh tài khoản demo',
    email_placeholder: 'Email',
    password_placeholder: 'Password',
    confirm_password_placeholder: 'Confirm password',
    error_empty_fields: 'Vui lòng nhập username và password.',
    error_use_username: 'Đăng nhập bằng username, không dùng email.',
  },
  dashboard: {
    greeting: 'Xin chào, {name}',
    menu_open: 'Menu',
    menu_profile: 'Profile',
    menu_settings: 'Settings',
    menu_language: 'Ngôn ngữ',
    menu_logout: 'Đăng xuất',
    profile_info: 'Username: {username}\nEmail: {email}',
    settings_coming_soon: 'Settings sẽ được mở rộng trong Sprint 20.',
    portfolio_fallback: 'Bảng điều khiển danh mục',
    email_label: 'Email',
    plan_label: 'Gói',
    last_update: 'Cập nhật lúc',
    nav_label: 'NAV',
    reconciliation_required: 'Sổ cái cần đối soát',
    total_value: 'Tổng giá trị',
    unrealized_pl: 'Lãi/Lỗ chưa TH',
    realized_pl: 'Lãi/Lỗ đã TH',
    dividends: 'Cổ tức',
    top_holdings: 'Top Holdings',
    empty_holdings: 'Chưa có holdings.',
    qty_label: 'SL',
    mv_label: 'MV',
    top_allocation: 'Top Allocation',
    empty_allocation: 'Chưa có dữ liệu allocation.',
    error_load: 'Không thể tải dashboard. Vui lòng kéo để thử lại.',
    open_transactions: 'Xem Giao Dịch',
    logout: 'Đăng xuất',
    lang_label: 'Ngôn ngữ',
  },
  transactions: {
    title: 'Giao dịch',
    back: 'Quay lại',
    refresh: 'Làm mới',
    pick_subaccount: 'Chọn tiểu khoản',
    viewing: 'Đang xem: {name}',
    form_new: 'Tạo giao dịch mới',
    form_edit: 'Sửa giao dịch',
    symbol_placeholder: 'Mã cổ phiếu (VD: HPG)',
    date_placeholder: 'Ngày (YYYY-MM-DD)',
    price_placeholder: 'Giá',
    quantity_placeholder: 'Số lượng',
    fee_placeholder: 'Phí',
    notes_placeholder: 'Ghi chú',
    save_new: 'Lưu mới',
    update: 'Cập nhật',
    reset: 'Đặt lại',
    list_title: 'Danh sách giao dịch',
    empty_list: 'Chưa có giao dịch.',
    date_label: 'Ngày',
    price_label: 'Giá',
    qty_label: 'SL',
    fee_label: 'Phí',
    total_label: 'Tổng',
    edit_action: 'Sửa',
    delete_action: 'Xóa',
    type_buy: 'Mua',
    type_sell: 'Bán',
    type_dividend: 'Cổ tức',
    error_load: 'Không thể tải dữ liệu giao dịch. Vui lòng thử lại.',
    error_load_subaccount: 'Không thể tải giao dịch của tiểu khoản này.',
    error_empty_symbol: 'Vui lòng nhập mã cổ phiếu.',
    error_invalid_symbol: 'Mã cổ phiếu không hợp lệ trong hệ thống.',
    error_invalid_fields: 'Ngày, giá và khối lượng phải hợp lệ (> 0).',
    error_save: 'Không thể lưu giao dịch. Vui lòng thử lại.',
    error_delete: 'Không thể xóa giao dịch.',
  },
  watchlist: {
    title: 'Watchlist',
    tracked_count: 'Theo dõi: {count} | Nhóm: {groups}',
    add_symbol_title: 'Thêm symbol theo dõi',
    symbol_placeholder: 'VD: HPG',
    add_button: 'Thêm',
    remove_button: 'Xóa',
    empty_symbols: 'Chưa có symbol theo dõi.',
    groups_title: 'Nhóm Watchlist',
    error_load: 'Không thể tải watchlist. Vui lòng thử lại.',
    error_add: 'Không thể thêm symbol. Hãy kiểm tra mã và thử lại.',
    error_remove: 'Không thể xóa symbol.',
    info_added: 'Đã thêm {symbol} vào danh sách theo dõi.',
    info_removed: 'Đã xóa symbol khỏi danh sách theo dõi.',
  },
  whale: {
    title: 'Whale Alerts',
    connection_prefix: 'Kết nối: {status}',
    tracked_count: 'Theo dõi: {count} | Lọc: {symbol}',
    empty_tracked: 'Chưa có symbol theo dõi để subscribe whale feed.',
    whale_hub_title: 'Whale Alerts Hub',
    sort_time: 'Sắp xếp: Thời gian',
    sort_value: 'Sắp xếp: Giá trị',
    refresh: 'Làm mới',
    empty_alerts: 'Chưa có whale alert.',
    time_label: 'Thời gian: {time}',
    side_label: 'Bên: {side}',
    score_label: 'Điểm: {score}',
    whale_detail_title: 'Chi tiết Whale',
    symbol_filter: 'Symbol: {symbol}',
    all_symbols: 'Tất cả',
    empty_advisory: 'Chưa có advisory gần đây.',
    refresh_ai: 'Refresh AI',
    advisory_meta: 'Bên: {side} | {time}',
    matched_label: 'Khớp: {value} VND',
    no_summary: 'Không có summary.',
    status_connected: 'Đã kết nối',
    status_polling: 'Đang polling',
    status_disconnected: 'Mất kết nối',
    status_background: 'Tạm dừng nền',
    error_load: 'Không thể tải whale feed. Vui lòng thử lại.',
    error_refresh_advisory: 'Không thể refresh advisory lúc này.',
    error_whale_time: 'Không thể tải whale feed theo thời gian.',
    error_whale_value: 'Không thể tải whale feed theo matched value.',
    info_refreshed: 'Đã gửi lệnh refresh advisory cho {symbol}.',
  },
  profile: {
    title: 'Tài khoản',
    subtitle: 'Quản lý phiên đăng nhập, ngôn ngữ và trạng thái tài khoản mobile.',
    account_section: 'Thông tin tài khoản',
    username_label: 'Username',
    email_label: 'Email',
    plan_label: 'Gói',
    verified_label: 'Xác thực email',
    verified_yes: 'Đã xác thực',
    verified_no: 'Chưa xác thực',
    preferences_section: 'Tùy chọn',
    language_label: 'Ngôn ngữ',
    toggle_language: 'Đổi sang {language}',
    session_section: 'Phiên đăng nhập',
    logout: 'Đăng xuất',
    app_section: 'Ứng dụng',
    app_status: 'Sprint 19 mobile MVP đã sẵn sàng cho internal testing.',
  },
  home: {
    title: 'VNInvest Mobile MVP',
    subtitle: 'Nền tảng Sprint 19 đã sẵn sàng.',
    api_label: 'API',
    ws_label: 'WS',
  },
};

const en: Translations = {
  tabs: {
    dashboard: 'Overview',
    transactions: 'Transactions',
    watchlist: 'Watchlist',
    whale: 'Whale',
    profile: 'Profile',
  },
  auth: {
    app_tagline: 'Vietnamese Stock Portfolio Manager',
    login: 'Log In',
    register: 'Register',
    username_placeholder: 'Username (not email)',
    login_hint: 'Log in with username, not email.',
    prefill_test: 'Fill demo account',
    email_placeholder: 'Email',
    password_placeholder: 'Password',
    confirm_password_placeholder: 'Confirm password',
    error_empty_fields: 'Please enter username and password.',
    error_use_username: 'Log in with username, not email.',
  },
  dashboard: {
    greeting: 'Hello, {name}',
    menu_open: 'Menu',
    menu_profile: 'Profile',
    menu_settings: 'Settings',
    menu_language: 'Language',
    menu_logout: 'Log Out',
    profile_info: 'Username: {username}\nEmail: {email}',
    settings_coming_soon: 'Settings will be expanded in Sprint 20.',
    portfolio_fallback: 'Portfolio Dashboard',
    email_label: 'Email',
    plan_label: 'Plan',
    last_update: 'Last update',
    nav_label: 'NAV',
    reconciliation_required: 'Ledger needs reconciliation',
    total_value: 'Total Value',
    unrealized_pl: 'Unrealized P/L',
    realized_pl: 'Realized P/L',
    dividends: 'Dividends',
    top_holdings: 'Top Holdings',
    empty_holdings: 'No holdings yet.',
    qty_label: 'Qty',
    mv_label: 'MV',
    top_allocation: 'Top Allocation',
    empty_allocation: 'No allocation data.',
    error_load: 'Failed to load dashboard. Pull to refresh.',
    open_transactions: 'View Transactions',
    logout: 'Log Out',
    lang_label: 'Language',
  },
  transactions: {
    title: 'Transactions',
    back: 'Back',
    refresh: 'Refresh',
    pick_subaccount: 'Select Account',
    viewing: 'Viewing: {name}',
    form_new: 'New Transaction',
    form_edit: 'Edit Transaction',
    symbol_placeholder: 'Stock symbol (e.g. HPG)',
    date_placeholder: 'Date (YYYY-MM-DD)',
    price_placeholder: 'Price',
    quantity_placeholder: 'Quantity',
    fee_placeholder: 'Fee',
    notes_placeholder: 'Notes',
    save_new: 'Save',
    update: 'Update',
    reset: 'Reset',
    list_title: 'Transaction List',
    empty_list: 'No transactions yet.',
    date_label: 'Date',
    price_label: 'Price',
    qty_label: 'Qty',
    fee_label: 'Fee',
    total_label: 'Total',
    edit_action: 'Edit',
    delete_action: 'Delete',
    type_buy: 'Buy',
    type_sell: 'Sell',
    type_dividend: 'Dividend',
    error_load: 'Failed to load transactions. Please try again.',
    error_load_subaccount: 'Failed to load transactions for this account.',
    error_empty_symbol: 'Please enter a stock symbol.',
    error_invalid_symbol: 'Invalid stock symbol in the system.',
    error_invalid_fields: 'Date, price and quantity must be valid (> 0).',
    error_save: 'Failed to save transaction. Please try again.',
    error_delete: 'Failed to delete transaction.',
  },
  watchlist: {
    title: 'Watchlist',
    tracked_count: 'Tracked: {count} | Groups: {groups}',
    add_symbol_title: 'Add Tracked Symbol',
    symbol_placeholder: 'e.g. HPG',
    add_button: 'Add',
    remove_button: 'Remove',
    empty_symbols: 'No tracked symbols yet.',
    groups_title: 'Watchlist Groups',
    error_load: 'Failed to load watchlist. Please try again.',
    error_add: 'Failed to add symbol. Check the code and try again.',
    error_remove: 'Failed to remove symbol.',
    info_added: 'Added {symbol} to watchlist.',
    info_removed: 'Removed symbol from watchlist.',
  },
  whale: {
    title: 'Whale Alerts',
    connection_prefix: 'Connection: {status}',
    tracked_count: 'Tracked: {count} | Filter: {symbol}',
    empty_tracked: 'Track at least one symbol to subscribe to whale feed.',
    whale_hub_title: 'Whale Alerts Hub',
    sort_time: 'Sort: Time',
    sort_value: 'Sort: Value',
    refresh: 'Refresh',
    empty_alerts: 'No whale alerts yet.',
    time_label: 'Time: {time}',
    side_label: 'Side: {side}',
    score_label: 'Score: {score}',
    whale_detail_title: 'Whale Detail',
    symbol_filter: 'Symbol: {symbol}',
    all_symbols: 'All',
    empty_advisory: 'No recent advisories.',
    refresh_ai: 'Refresh AI',
    advisory_meta: 'Side: {side} | {time}',
    matched_label: 'Matched: {value} VND',
    no_summary: 'No summary available.',
    status_connected: 'Connected',
    status_polling: 'Polling',
    status_disconnected: 'Disconnected',
    status_background: 'Paused in background',
    error_load: 'Failed to load whale feed. Please try again.',
    error_refresh_advisory: 'Failed to refresh advisory.',
    error_whale_time: 'Failed to load whale feed by time.',
    error_whale_value: 'Failed to load whale feed by value.',
    info_refreshed: 'Refresh advisory sent for {symbol}.',
  },
  profile: {
    title: 'Profile',
    subtitle: 'Manage session, language and current mobile account state.',
    account_section: 'Account',
    username_label: 'Username',
    email_label: 'Email',
    plan_label: 'Plan',
    verified_label: 'Email verified',
    verified_yes: 'Verified',
    verified_no: 'Not verified',
    preferences_section: 'Preferences',
    language_label: 'Language',
    toggle_language: 'Switch to {language}',
    session_section: 'Session',
    logout: 'Log Out',
    app_section: 'App',
    app_status: 'Sprint 19 mobile MVP is ready for internal testing.',
  },
  home: {
    title: 'VNInvest Mobile MVP',
    subtitle: 'Sprint 19 foundation is ready.',
    api_label: 'API',
    ws_label: 'WS',
  },
};

export type Translations = typeof vi;

export const SUPPORTED_LOCALES: Locale[] = ['vi', 'en'];

export const LOCALE_LABELS: Record<Locale, string> = {
  vi: '🇻🇳 Tiếng Việt',
  en: '🇬🇧 English',
};

export const LOCALE_TAGS: Record<Locale, string> = {
  vi: 'vi-VN',
  en: 'en-US',
};

const LOCALES: Record<Locale, Translations> = { vi, en };

export function getLocaleTag(locale: Locale): string {
  return LOCALE_TAGS[locale] ?? LOCALE_TAGS.vi;
}

export function formatNumber(
  value: number | string | undefined | null,
  locale: Locale,
  options?: Intl.NumberFormatOptions,
): string {
  const parsed = Number(value ?? 0);
  const safeValue = Number.isFinite(parsed) ? parsed : 0;
  return new Intl.NumberFormat(getLocaleTag(locale), options).format(safeValue);
}

export function formatTime(
  value: string | number | Date | undefined | null,
  locale: Locale,
  options?: Intl.DateTimeFormatOptions,
): string {
  if (!value) {
    return '--:--:--';
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }
  return date.toLocaleTimeString(getLocaleTag(locale), options);
}

export function createTranslator(locale: Locale) {
  const dict = LOCALES[locale] ?? LOCALES.vi;
  return function t(key: string, params?: Record<string, string | number>): string {
    const parts = key.split('.');
    let node: unknown = dict;
    for (const part of parts) {
      if (node == null || typeof node !== 'object') {
        return key;
      }
      node = (node as Record<string, unknown>)[part];
    }
    let result = typeof node === 'string' ? node : key;
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        result = result.replace(`{${k}}`, String(v));
      }
    }
    return result;
  };
}
