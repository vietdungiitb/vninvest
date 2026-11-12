export const dashboard = {
    // FU-02c/M-6: `<h1>` của `DashboardPage`. Trước đó `<h1>` lấy từ prop `t`
    // có default `(_key, defaultText) => defaultText` ⇒ LUÔN ra tiếng Việt,
    // kể cả khi locale là `en`. Đây là key cho nhu cầu đó.
    title: 'Tổng quan',
    emptyTitle: 'Chưa có danh mục nào',
    noPortfolio: 'Tạo danh mục đầu tiên để bắt đầu theo dõi tài sản, giao dịch và hiệu suất ngay trên ứng dụng.',
    createPortfolioCta: '+ Tạo danh mục đầu tiên',
    lastUpdated: 'Giá cập nhật lần cuối: {value}',
    syncPrices: 'Đồng bộ giá',
    syncPricesLive: 'Đồng bộ giá trực tiếp',
    syncPricesIdle: 'Đồng bộ giá',
    syncingPrices: 'Đang đồng bộ...',
    syncSuccess: 'Đã đồng bộ {total} mã chứng khoán.',
    syncError: 'Đồng bộ thất bại, kiểm tra server.',
    marketValue: 'Tổng giá trị thị trường',
    unrealizedPL: 'Lãi/Lỗ chưa chốt',
    realizedPL: 'Lãi/Lỗ đã chốt',
    dividends: 'Cổ tức đã nhận',
    thousandVndUnitShort: 'nghìn đồng',
    holdings: 'Vị thế đang nắm giữ',
    breadthLabel: 'Độ rộng danh mục',
  };
