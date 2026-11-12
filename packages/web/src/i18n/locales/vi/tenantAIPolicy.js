export const tenantAIPolicy = {
    title: 'Chính sách AI',
    intro: 'Giới hạn AI áp dụng cho mọi thành viên của tenant. Thành viên chỉ được đặt cấu hình trong trần này; hạn mức tiêu thụ hằng ngày do hệ thống quản lý riêng.',
    defaultNotice: 'Tenant chưa đặt chính sách. Đang dùng mặc định: cho phép khoá riêng (BYOK) và không đặt trần.',
    allowByok: 'Cho phép thành viên tự lưu khoá API (BYOK)',
    maxTokensPerDay: 'Trần token/ngày cho cấu hình thành viên (0 = không giới hạn)',
    maxCostPerDay: 'Trần chi phí/ngày cho cấu hình thành viên (để trống = không giới hạn)',
    allowedProviders: 'Provider được phép (phân tách bằng dấu phẩy, để trống = cho phép tất cả)',
    allowedModels: 'Model được phép (phân tách bằng dấu phẩy, để trống = cho phép tất cả)',
    version: 'Phiên bản: v{version}',
    saved: 'Đã lưu chính sách AI của tenant.',
    saveError: 'Không lưu được chính sách AI.',
  };
