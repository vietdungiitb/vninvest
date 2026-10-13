/**
 * `/portfolios/manage/broker` — nơi duy nhất để nhập thông tin broker, đồng bộ
 * tài khoản và **đặt lệnh**.
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
 * `DNSEConnectionPanel` **không sửa một dòng** — giữ nguyên để diff của thay đổi
 * này chỉ nằm ở chỗ dời chỗ. Panel còn chứa ~28 chuỗi hardcode; việc i18n hoá nó
 * là slice riêng, không gộp vào đây để diff đọc được.
 */

import { Link } from "react-router-dom";

import DNSEConnectionPanel from "../components/DNSEConnectionPanel.js";
import { ShellPageChrome } from "../components/ShellPageTemplate.js";
import { useI18n } from "../context/LangContext.js";
import "../components/soc/soc.tokens.css";

export interface PortfoliosBrokerPageProps {
  className?: string;
  /** `DNSEConnectionPanel` bắt buộc prop này — giữ nguyên khi tách route. */
  onConnected?: () => void;
}

export function PortfoliosBrokerPage({
  className = "",
  onConnected,
}: PortfoliosBrokerPageProps) {
  const { t } = useI18n();

  return (
    <ShellPageChrome
      eyebrow={t("portfoliosManage.broker.eyebrow", { defaultValue: "Broker" })}
      title={t("portfoliosManage.broker.title", { defaultValue: "Kết nối broker & đặt lệnh" })}
      className={className}
    >
      <p>
        <Link to="/portfolios/manage">
          ← {t("portfoliosManage.broker.back", { defaultValue: "Về quản lý danh mục" })}
        </Link>
      </p>
      <DNSEConnectionPanel onConnected={onConnected} />
    </ShellPageChrome>
  );
}

export default PortfoliosBrokerPage;