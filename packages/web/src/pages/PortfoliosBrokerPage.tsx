/**
 * `/portfolios/manage/broker` — GIỮ LẠI LÀM REDIRECT về `/broker` (B2.6, quyết
 * định PLAN_WAVE2 §0.6: giữ entry + redirect, không xoá để tránh link chết).
 *
 * Vì sao tách khỏi `/portfolios/manage`:
 * - **Ngữ nghĩa**: trang quản lý danh mục lo danh mục; thao tác tiền thật lo một
 *   chỗ riêng. Trộn hai thứ làm user không biết mình đang xem hay đang giao dịch.
 * - **An toàn**: một cú bấm nhầm ở màn hình danh sách đang đọc là một lệnh ra
 *   thị trường. Tách route làm ranh giới tâm lý *và* làm đường dẫn kiểm toán
 *   (`audit_log.action` ghi được dễ đối chiếu với route đã vào).
 * - D-36 của `PORTFOLIO_EXEC_PLAN_MASTER_20260927.md:83` đã chốt "Broker Hub tách
 *   riêng" nhưng bản thực thi cũ vẫn nhúng panel vào trang danh mục.
 *
 * C7 (đã sửa 2026-10-15, Wave 2): ghi chú cũ "Panel còn chứa ~28 chuỗi hardcode"
 * là STALE — `DNSEConnectionPanel.js` đã i18n xong từ claim `pf-manage-rebuild`
 * (2026-10-13, mọi chuỗi qua `t("dnsePanel.*")`, key có sẵn `vi.js:6770`,
 * `en.js:6744`). Panel giữ nguyên, render lại ở `BrokerHubPage` (lane `dnse`).
 */

import { Navigate } from "react-router-dom";

export interface PortfoliosBrokerPageProps {
  className?: string;
  /** Giữ prop để entry registry cũ không vỡ — redirect bỏ qua prop này. */
  onConnected?: () => void;
}

export function PortfoliosBrokerPage(_props: PortfoliosBrokerPageProps) {
  return <Navigate to="/broker" replace />;
}

export default PortfoliosBrokerPage;
