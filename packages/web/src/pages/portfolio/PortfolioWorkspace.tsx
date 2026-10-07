/**
 * S-04 - khung chung cho 5 trang Portfolio workspace.
 *
 * Khung lo: chọn danh mục, điều hướng 5 tab, và khu vực nội dung. Mỗi trang
 * chỉ lo nội dung riêng — nhờ vậy đổi danh mục lan sang cả 5 tab.
 *
 * Không tự dựng danh sách tab bằng `children` rời rạc: tab được khai một
 * chỗ trong `TABS` để tiêu đề i18n và thứ tự luôn khớp với `routeCatalog.js`
 * (S-11 thêm 5 route tương ứng).
 */

import { useI18n } from "../../context/LangContext";
import {
  usePortfolioWorkspace,
  type PortfolioAdapter,
} from "../../hooks/usePortfolioWorkspace";

export type WorkspaceTabId = "overview" | "holdings" | "allocation" | "analytics" | "activity";

export const TABS: ReadonlyArray<{ id: WorkspaceTabId; labelKey: string }> = [
  { id: "overview", labelKey: "portfolioWorkspace.tabs.overview" },
  { id: "holdings", labelKey: "portfolioWorkspace.tabs.holdings" },
  { id: "allocation", labelKey: "portfolioWorkspace.tabs.allocation" },
  { id: "analytics", labelKey: "portfolioWorkspace.tabs.analytics" },
  { id: "activity", labelKey: "portfolioWorkspace.tabs.activity" },
];

export interface PortfolioWorkspaceProps {
  tab: WorkspaceTabId;
  onTabChange: (tab: WorkspaceTabId) => void;
  adapter?: PortfolioAdapter;
  children: React.ReactNode;
}

export function PortfolioWorkspace({
  tab, onTabChange, adapter, children,
}: PortfolioWorkspaceProps) {
  const { t } = useI18n();
  const { portfolios, selectedId, loading, error, selectPortfolio, reload } =
    usePortfolioWorkspace(adapter);

  return (
    <section className="pf-workspace" aria-label={t("portfolioWorkspace.title", {
      defaultValue: "Không gian danh mục",
    })}>
      <header className="pf-workspace__header">
        <label className="pf-workspace__picker" htmlFor="pf-portfolio-select">
          <span className="pf-visually-hidden">
            {t("portfolioWorkspace.pickerLabel", { defaultValue: "Chọn danh mục" })}
          </span>
          <select
            id="pf-portfolio-select"
            value={selectedId ?? ""}
            disabled={loading || portfolios.length === 0}
            onChange={(e) => selectPortfolio(e.target.value ? e.target.value : null)}
          >
            {portfolios.length === 0 && (
              <option value="">{t("portfolioWorkspace.noPortfolio", {
                defaultValue: "Chưa có danh mục",
              })}</option>
            )}
            {portfolios.map((p) => {
              const id = String(p.id ?? p.pk ?? "");
              const name = String(p.name ?? p.portfolio_name ?? `#${id}`);
              return <option key={id} value={id}>{name}</option>;
            })}
          </select>
        </label>
        <button type="button" onClick={() => void reload()} disabled={loading}>
          {t("portfolioWorkspace.reload", { defaultValue: "Tải lại" })}
        </button>
      </header>

      <nav className="pf-workspace__tabs" aria-label={t("portfolioWorkspace.tabsLabel", {
        defaultValue: "Các màn hình danh mục",
      })}>
        {TABS.map(({ id, labelKey }) => (
          <button
            key={id}
            type="button"
            aria-current={tab === id ? "page" : undefined}
            className={tab === id ? "is-active" : undefined}
            onClick={() => onTabChange(id)}
          >
            {t(labelKey, { defaultValue: id })}
          </button>
        ))}
      </nav>

      {error && (
        <p role="alert" className="pf-workspace__error">
          {t("portfolioWorkspace.loadError", { defaultValue: "Không tải được danh mục" })}
          <code> {error}</code>
        </p>
      )}

      <div className="pf-workspace__body">{children}</div>
    </section>
  );
}

export default PortfolioWorkspace;
