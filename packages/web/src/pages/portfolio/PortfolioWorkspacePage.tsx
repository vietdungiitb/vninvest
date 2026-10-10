/**
 * S-11 - entry duy nhat cho 5 man hinh danh muc.
 *
 * 5 route trong `routeCatalog.js` cung tro toi MOT entry page registry
 * (`portfolio-workspace`). Tab nao duoc mo duoc suy ra tu `path`, nen deep-link
 * `/portfolios/7/holdings` mo dung man hinh ma khong can 5 entry rieng.
 *
 * `portfolioId` lay tu param cua route. Neu URL chi co `/portfolios/:id/...`
 * ma khong co id, workspace tu chon danh mục dau tien (xem `usePortfolioWorkspace`).
 */

import { useParams, useNavigate, useLocation } from "react-router-dom";
import { usePortfolioWorkspace } from "../../hooks/usePortfolioWorkspace";
import {
  PortfolioWorkspace,
  type WorkspaceTabId,
} from "./PortfolioWorkspace";
import { PortfolioOverviewPage } from "./PortfolioOverviewPage";
import { PortfolioHoldingsPage } from "./PortfolioHoldingsPage";
import { PortfolioAllocationPage } from "./PortfolioAllocationPage";
import { PortfolioAnalyticsPage } from "./PortfolioAnalyticsPage";
import { PortfolioActivityPage } from "./PortfolioActivityPage";

/** Đoạn cuối path quyết định tab. Không đoán — tra theo danh sách TABS. */
function tabFromPath(pathname: string): WorkspaceTabId {
  const tail = String(pathname ?? "").split("/").filter(Boolean).pop() ?? "";
  const known: WorkspaceTabId[] = ["overview", "holdings", "allocation", "analytics", "activity"];
  return (known.includes(tail as WorkspaceTabId) ? tail : "overview") as WorkspaceTabId;
}

export function PortfolioWorkspacePage() {
  const params = useParams();
  const navigate = useNavigate();
  // B5: phải theo `location` của router. Trước đây đọc `window.location.pathname`
  // trong `useMemo(..., [])` ⇒ đổi tab đổi URL nhưng `aria-current` vẫn báo tab
  // cũ, và nội dung không đổi. Cả 5 route trỏ cùng một component nên React
  // KHÔNG remount ⇒ state cũ còn nguyên (audit B5).
  const location = useLocation();
  const tab = tabFromPath(location.pathname);

  // Trang sở hữu trạng thái danh mục và truyền xuống khung. Nhờ vậy `effectiveId`
  // là NGUỒN DUY NHẤT cho cả ô chọn lẫn 5 tab con: vào `/portfolios` (không id)
  // thì hook tự chọn danh mục đầu tiên và các tab thật sự tải dữ liệu của nó.
  const { portfolios, selectedId, loading, error, selectPortfolio, reload } =
    usePortfolioWorkspace();
  const routeId = params.portfolioId ?? null;
  const effectiveId = routeId ?? selectedId;

  // Đổi danh mục: cập nhật hook + đổi URL để deep-link/F5 giữ đúng danh mục.
  const onPortfolioChange = (id: string | number | null) => {
    selectPortfolio(id);
    if (id === null) return;
    navigate(`/portfolios/${id}/${tab}`);
  };
  // Chuyển tab = đổi path để deep-link + F5 giữ đúng màn hình.
  const onTabChange = (next: WorkspaceTabId) => {
    if (effectiveId === null) return;
    navigate(`/portfolios/${effectiveId}/${next}`);
  };

  return (
    <PortfolioWorkspace
      tab={tab}
      onTabChange={onTabChange}
      portfolios={portfolios}
      selectedId={effectiveId}
      loading={loading}
      error={error}
      onPortfolioChange={onPortfolioChange}
      onReload={() => void reload()}
    >
      {tab === "overview" && <PortfolioOverviewPage portfolioId={effectiveId} />}
      {tab === "holdings" && <PortfolioHoldingsPage portfolioId={effectiveId} />}
      {tab === "allocation" && <PortfolioAllocationPage portfolioId={effectiveId} />}
      {tab === "analytics" && <PortfolioAnalyticsPage portfolioId={effectiveId} />}
      {tab === "activity" && <PortfolioActivityPage portfolioId={effectiveId} />}
    </PortfolioWorkspace>
  );
}

export default PortfolioWorkspacePage;
