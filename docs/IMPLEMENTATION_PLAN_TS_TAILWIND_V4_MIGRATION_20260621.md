# IMPLEMENTATION PLAN: MIGRATION TO TYPESCRIPT AND TAILWIND CSS V4

**Mã tài liệu**: `IMPLEMENTATION_PLAN_TS_TAILWIND_V4_MIGRATION_20260621.md`  
**Ngày khởi tạo**: 2026-06-21  
**Trạng thái**: Chờ duyệt (DRAFT)  
**Phạm vi tác động**: `packages/web` (VNInvest SaaS Native Frontend)  

---

## 1. Bối cảnh & Mục tiêu (Context & Objectives)

Hệ thống frontend của VNInvest SaaS Native (`packages/web`) hiện đang chạy trên nền tảng React 18, Tailwind CSS v3 và JavaScript thuần. Trong quá trình phát triển, việc thiếu kiểm soát kiểu dữ liệu (Type Safety) dẫn tới một số lỗi runtime tiềm ẩn khi tích hợp các luồng dữ liệu phức tạp (như Realtime Feed, Whale Alerts, AI Advisory). Đồng thời, việc bố trí giao diện hiện tại gặp nhiều bất cập về độ phản hồi (responsiveness) và thẩm mỹ.

Nhằm đồng bộ hóa toàn diện thiết kế giao diện theo tiêu chuẩn quốc tế và nâng cấp hạ tầng công nghệ lõi, chúng tôi đề xuất kế hoạch di chuyển toàn diện sang:
1. **TypeScript (TSX/TS)**: Đảm bảo Type Safety chặt chẽ cho toàn bộ ứng dụng, đặc biệt là các mô hình dữ liệu (Data models) và API adapters.
2. **Tailwind CSS v4**: Sử dụng các tính năng mới nhất (như `@tailwindcss/vite` plugin biên dịch trực tiếp, `@theme` directive khai báo trong file CSS, tối ưu hóa kích thước build).
3. **Đồng bộ hóa Giao diện theo Template mới**: Áp dụng thiết kế hiện đại, cao cấp từ template `tailwind-admin-reactjs-free` (Layout Sidebar trượt nổi linh hoạt, Header đồng bộ, các component UI đồng bộ dựa trên Radix UI).

---

## 2. Kiến trúc & Công nghệ Đề xuất (Architecture & Tech Stack)

| Thành phần | Công nghệ Hiện tại | Công nghệ Mới | Lý do nâng cấp |
| :--- | :--- | :--- | :--- |
| **Ngôn ngữ** | JavaScript (JS/JSX) | **TypeScript (TS/TSX)** | Tự động phát hiện lỗi biên dịch, quản lý chặt chẽ cấu trúc API response & WebSocket payload. |
| **Styling Engine** | Tailwind CSS v3.4.3 | **Tailwind CSS v4.0.0** | Tốc độ biên dịch cực nhanh, loại bỏ các file cấu hình js cồng kềnh, cấu hình trực tiếp qua CSS variables. |
| **Vite Compiler** | `@vitejs/plugin-react` | `@tailwindcss/vite` + `@vitejs/plugin-react` | Tích hợp sâu Tailwind v4 vào luồng build của Vite mà không cần qua PostCSS. |
| **Layouts & UI** | AppShell cũ (static sidebar) | **FullLayout + Floating Sidebar** (Radix Sheet) | Sidebar đóng/mở linh hoạt, mở rộng 100% viewport trên Desktop, thiết kế sang trọng. |

---

## 3. Danh sách tệp tin ảnh hưởng (Proposed Changes)

### 3.1. Build & Configurations
*   [DELETE] `packages/web/vite.config.js`
*   [NEW] `packages/web/vite.config.ts` (Cấu hình plugin `@tailwindcss/vite` và aliases)
*   [NEW] `packages/web/tsconfig.json` (Cấu hình TypeScript cho compiler)
*   [NEW] `packages/web/tsconfig.node.json` (Cấu hình TS cho Vite runner)
*   [DELETE] `packages/web/tailwind.config.js` (Chuyển cấu hình vào `@theme` trong CSS)
*   [DELETE] `packages/web/postcss.config.js` (Không cần thiết với Tailwind v4)

### 3.2. Entry Points & Styles
*   [MODIFY] `packages/web/index.html` (Đổi import từ `src/main.js` sang `src/main.tsx`)
*   [DELETE] `packages/web/src/main.js`
*   [NEW] `packages/web/src/main.tsx` (Khởi chạy bằng TSX)
*   [MODIFY] `packages/web/src/index.css` (Import Tailwind v4 và khai báo `@theme` custom variables)

### 3.3. New Layout & Components (Migrated from Template)
*   [NEW] `packages/web/src/components/ui/`
    *   `button.tsx` (Radix Slot + cva)
    *   `sheet.tsx` (Radix Dialog + sheet animations)
    *   `select.tsx` (Radix Select)
    *   `dialog.tsx` (Radix Dialog)
    *   `dropdown-menu.tsx` (Radix Dropdown Menu)
*   [NEW] `packages/web/src/layouts/full/`
    *   `FullLayout.tsx` (Layout chính chứa Sidebar và Header)
    *   `vertical/sidebar/Sidebar.tsx` (Sidebar trượt nổi linh hoạt)
    *   `vertical/sidebar/sidebaritems.ts` (Danh sách menu định tuyến của VNInvest)
    *   `vertical/header/Header.tsx` (Thanh điều hướng đầu trang tích hợp Tìm kiếm, Đổi ngôn ngữ, Avatar)
    *   `vertical/header/Profile.tsx` (Dropdown profile kết nối logout)
    *   `vertical/header/Messages.tsx` (Dropdown notification)
    *   `shared/logo/FullLogo.tsx` (Thành phần hiển thị Logo VNInvest)

---

## 4. Kế hoạch triển khai từng bước (Execution Phases)

### Phase 1: Nâng cấp Dependencies & Cấu hình Build (Vite & TS & Tailwind v4)
1. Cài đặt các dependencies cần thiết vào `packages/web/package.json`:
   ```bash
   npm install --save-dev typescript @tailwindcss/vite @types/react @types/react-dom @types/node
   npm install @radix-ui/react-dialog @radix-ui/react-dropdown-menu @radix-ui/react-select @radix-ui/react-separator @radix-ui/react-sheet tailwind-sidebar simplebar-react @iconify/react lucide-react class-variance-authority tailwind-merge clsx
   ```
2. Tạo mới `tsconfig.json`, `tsconfig.node.json` và cấu hình `vite.config.ts`.
3. Xóa các tệp cấu hình cũ: `tailwind.config.js` và `postcss.config.js`.

### Phase 2: Đồng bộ Hóa Global Styles & Entry Point
1. Cập nhật `index.css`:
   ```css
   @import "tailwindcss";
   @import "tailwind-sidebar/styles.css";
   @import "simplebar/dist/simplebar.min.css";
   
   @theme {
     --color-primary: #5d87ff;
     --color-secondary: #49beff;
     --color-dark: #1c2536;
     --shadow-md: 0 1px 4px rgba(133, 146, 173, 0.2);
     --radius-lg: 10px;
     /* Các custom variables khác từ template... */
   }
   ```
2. Đổi tên `main.js` sang `main.tsx`. Cập nhật `main.tsx` để bọc ứng dụng trong `PortfolioProvider`, `LangProvider`, và `RealtimeProvider`.
3. Thay đổi script source trong `index.html`.

### Phase 3: Tích hợp Layout & UI Components mới
1. Sao chép và biên dịch các UI components của template vào thư mục `src/components/ui/`.
2. Sao chép thư mục layout `src/layouts/full/` từ template.
3. Sửa đổi `Sidebar.tsx` và `Header.tsx` để:
   * **sidebaritems.ts**: Khai báo đúng các router path của VNInvest (Dashboard, Screener, Whale Alerts, AI Advisory, v.v.).
   * **Header/Sidebar Context Integration**:
     * Thay đổi ngôn ngữ bằng cách gọi `setLanguage(val)` and `locale` từ `useI18n()`.
     * Hiển thị thông tin tenant/workspace hiện tại bằng cách gọi `userTenants`, `activeTenantId`, `switchTenant` từ `usePortfolio()`.
     * Hàm đăng xuất sử dụng `logout()` từ `usePortfolio()`.

### Phase 4: Chuyển dịch và Kiểm thử
1. Đảm bảo chạy lệnh `npm run build --prefix packages/web` biên dịch thành công 100% không cảnh báo.
2. Khởi chạy Docker dev container stack (`.\start_dev.ps1`).
3. Kiểm thử UAT trên trình duyệt:
   * Kiểm tra khả năng thu gọn / trượt mở sidebar.
   * Đổi workspace, đổi ngôn ngữ, logout.
   * Kiểm tra sự đồng bộ và độ tương phản màu sắc của Dark Mode mới.

---

## 5. Kế hoạch xác thực & Rollback (Verification & Rollback Plan)

### Kế hoạch Xác thực
*   **Compile Gate**: Build bundle tĩnh của Web package bằng lệnh `npm run build` không gặp bất kỳ lỗi biên dịch hay type checking nào.
*   **Smoke Test**: Chạy docker stack và truy cập tất cả các route chính (`/dashboard`, `/screener`, `/watchlist`, `/whale-alerts`) để đảm bảo không bị lỗi trắng trang (Blank Page) hoặc crash React.

### Kế hoạch Rollback
*   Trong trường hợp nâng cấp gặp lỗi lớn không thể giải quyết ngay lập tức:
    1. Sử dụng Git để hoàn tác toàn bộ thay đổi trong thư mục `packages/web/`.
    2. Chạy `npm install` để khôi phục các node_modules cũ.
    3. Build lại image cũ để khôi phục dịch vụ ổn định.
