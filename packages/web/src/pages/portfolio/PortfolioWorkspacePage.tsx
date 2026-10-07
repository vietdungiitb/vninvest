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

import { useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
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
  const tab = useMemo(
    () => tabFromPath(typeof window !== "undefined" ? window.location.pathname : ""),
    [],
  );
  // Chuyển tab = đổi path để deep-link + F5 giữ đúng màn hình.
  const onTabChange = (next: WorkspaceTabId) => {
    const id = params.portfolioId ?? "";
    navigate(`/portfolios/${id}/${next}`);
  };

  const portfolioId = params.portfolioId ?? null;

  return (
    <PortfolioWorkspace tab={tab} onTabChange={onTabChange}>
      {tab === "overview" && <PortfolioOverviewPage portfolioId={portfolioId} />}
      {tab === "holdings" && <PortfolioHoldingsPage portfolioId={portfolioId} />}
      {tab === "allocation" && <PortfolioAllocationPage portfolioId={portfolioId} />}
      {tab === "analytics" && <PortfolioAnalyticsPage portfolioId={portfolioId} />}
      {tab === "activity" && <PortfolioActivityPage portfolioId={portfolioId} />}
    </PortfolioWorkspace>
  );
}

export default PortfolioWorkspacePage;
