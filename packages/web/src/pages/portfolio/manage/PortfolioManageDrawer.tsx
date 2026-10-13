/**
 * Drawer chi tiết danh mục: vị thế đang giữ + số liệu tổng hợp của riêng danh mục đó.
 *
 * Dữ liệu: `GET /workspace/portfolios/<id>/holdings/` và `.../summary/` —
 * **không** dựng số ở client. Shape lấy từ `portfolio_analytics_views.py:211-229`
 * (holdings) và `:366-407` (summary).
 *
 * Vị sao có cột "Trạng thái dữ liệu": `price_missing_reason` và `stale` là hai
 * cờ **fail-closed** từ BE. Mã chưa có giá phiên hôm nay không có giá trị thị
 * trường, nhưng **vẫn đang được giữ** — nếu ẩn luôn dòng đó thì tổng tỷ trọng bị
 * tăng lên vọt và user tưởng danh mục nhỏ hơn thực tế. Hiện dòng với `—` + nhãn
 * lý do là lựa chọn trung thực.
 *
 * Vị sao focus được giữ trong drawer: Escape đóng, focus quay về nút đã mở nó.
 * Drawer là modal ⇒ bắt buộc theo WCAG 2.2 (focus trap + phục hồi focus).
 */

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Link } from "react-router-dom";

import { coreApiAdapter } from "../../../adapters/coreApiAdapter.js";
import { useI18n } from "../../../context/LangContext.js";
import {
  EM_DASH,
  formatDay,
  formatPct,
  formatQty,
  formatVnd,
  moneyOrDash,
  toneOf,
  type HoldingRow,
  type HoldingsMeta,
  type PortfolioRow,
  type PortfolioSummary,
} from "./format";
import {
  toManagedError,
  type ManagedError,
  type PortfolioManageAdapter,
} from "./usePortfolioManage";
import "./portfolioManage.css";

const adapter = coreApiAdapter as unknown as {
  getPortfolioHoldings(id: string | number): Promise<unknown>;
};

/**
 * `nav_reason` là MÃ MÁY (`no_opening_balance` / `no_positions` —
 * `ledger/valuation.py:36-45`), `nav_reason_text` là câu tiếng Việt **hardcode
 * trong backend** nên đổi sang tiếng Anh sẽ còn tiếng Việt. Vì vậy tra mã sang
 * key i18n trước; `nav_reason_text` chỉ làm phương án dự phòng + tooltip.
 */
const NAV_REASON_KEYS: Record<string, string> = {
  no_opening_balance: "portfoliosManage.drawer.navNoOpeningBalance",
  no_positions: "portfoliosManage.drawer.navNoPositions",
};

export interface PortfolioManageDrawerProps {
  portfolio: PortfolioRow | null;
  summary?: PortfolioSummary;
  /** Tiêm bản giả trong test; mặc định là adapter thật. */
  getHoldings?: PortfolioManageAdapter["getPortfolioHoldings"];
  onClose(): void;
}

/** `getPortfolioHoldings` trả `data` là list phẳng, `meta` mang tổng (urls.py:270-285). */
function readHoldings(raw: unknown): HoldingRow[] {
  const data = (raw as { data?: unknown })?.data ?? raw;
  return Array.isArray(data) ? (data as HoldingRow[]) : [];
}

function readMeta(raw: unknown): HoldingsMeta {
  const meta = (raw as { meta?: HoldingsMeta })?.meta;
  return meta && typeof meta === "object" ? meta : {};
}

export function PortfolioManageDrawer({
  portfolio, summary, getHoldings = adapter.getPortfolioHoldings, onClose,
}: PortfolioManageDrawerProps) {
  const { t, localeTag } = useI18n();
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [holdings, setHoldings] = useState<HoldingRow[]>([]);
  const [meta, setMeta] = useState<HoldingsMeta>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ManagedError | null>(null);

  const open = Boolean(portfolio);
  const portfolioId = portfolio?.id ?? null;

  useEffect(() => {
    if (portfolioId === null) {
      setHoldings([]);
      setMeta({});
      setError(null);
      return;
    }
    let alive = true;
    setLoading(true);
    setError(null);
    setHoldings([]);
    setMeta({});
    getHoldings(portfolioId)
      .then((raw: unknown) => {
        if (!alive) return;
        setHoldings(readHoldings(raw));
        setMeta(readMeta(raw));
      })
      .catch((err: unknown) => {
        if (!alive) return;
        setError(toManagedError(err));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [portfolioId, getHoldings]);

  // Focus trap + phục hồi focus: bắt buộc cho modal theo WCAG 2.2.
  const onKeyDown = useCallback(
    (ev: React.KeyboardEvent<HTMLDivElement>) => {
      if (ev.key === "Escape") {
        ev.stopPropagation();
        onClose();
        return;
      }
      if (ev.key !== "Tab") return;
      const panel = panelRef.current;
      if (!panel) return;
      const focusable = panel.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (ev.shiftKey && active === first) {
        ev.preventDefault();
        last.focus();
      } else if (!ev.shiftKey && active === last) {
        ev.preventDefault();
        first.focus();
      }
    },
    [onClose],
  );

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
  }, [open]);

  if (!open || !portfolio) return null;

  const unpriced = meta.unpriced_symbols ?? summary?.unpriced_symbols ?? [];
  const navReasonKey = summary?.nav_reason ? NAV_REASON_KEYS[summary.nav_reason] : null;
  const navReasonText = navReasonKey
    ? t(navReasonKey, {
        defaultValue:
          summary?.nav_reason_text ??
          t("portfoliosManage.drawer.navBlocked", {
            defaultValue: "NAV chưa tính được ({reason})",
            reason: summary?.nav_reason ?? "",
          }),
      })
    : null;

  return (
    <div className="pfm-drawer" role="presentation" onMouseDown={(ev) => {
      if (ev.target === ev.currentTarget) onClose();
    }}>
      <div
        className="pfm-drawer__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={onKeyDown}
        ref={panelRef}
      >
        <header className="pfm-drawer__header">
          <h2 id={titleId}>{portfolio.name}</h2>
          <button type="button" onClick={onClose} ref={closeRef} aria-label={t("common.close", { defaultValue: "Đóng" })}>
            ✕
          </button>
        </header>

        <dl className="pfm-drawer__stats">
          <div>
            <dt>{t("portfoliosManage.drawer.marketValue", { defaultValue: "Giá trị thị trường" })}</dt>
            <dd>{summary ? moneyOrDash(summary.total_market_value, localeTag) : EM_DASH}</dd>
          </div>
          <div>
            <dt>{t("portfoliosManage.drawer.cost", { defaultValue: "Giá vốn" })}</dt>
            <dd>{summary ? moneyOrDash(summary.total_cost, localeTag) : EM_DASH}</dd>
          </div>
          <div>
            <dt>{t("portfoliosManage.drawer.pnl", { defaultValue: "Lãi/lỗ chưa thực hiện" })}</dt>
            <dd className={`pfm-tone-${toneOf(summary ? Number(summary.total_unrealized_pnl) : null)}`}>
              {summary ? moneyOrDash(summary.total_unrealized_pnl, localeTag) : EM_DASH}
              {summary?.total_unrealized_pnl_pct !== null && summary?.total_unrealized_pnl_pct !== undefined
                ? ` (${formatPct(summary.total_unrealized_pnl_pct, localeTag) ?? EM_DASH})`
                : ""}
            </dd>
          </div>
          <div>
            <dt>{t("portfoliosManage.drawer.nav", { defaultValue: "NAV" })}</dt>
            <dd>
              {formatVnd(summary?.nav ?? null, localeTag) ?? EM_DASH}
              {navReasonText ? (
                <span className="pfm-drawer__reason" title={summary?.nav_reason_text ?? undefined}>
                  {navReasonText}
                </span>
              ) : null}
            </dd>
          </div>
          <div>
            <dt>{t("portfoliosManage.drawer.cash", { defaultValue: "Tiền mặt" })}</dt>
            <dd>
              {formatVnd(summary?.cash ?? null, localeTag) ?? EM_DASH}
              {summary?.cash_complete === false ? (
                /* `cash_note` từ BE là GHI CHÚ KỸ THUẬT dài 2 câu
                   ("cash = tổng dòng tiền gom từ Transaction…"). Đo thật trên
                   staging 2026-10-13: hiện thẳng vào UI. Chỉ hiện câu ngắn cho
                   user, đặt ghi chú gốc vào `title` để kỹ thuật còn tra được. */
                <span
                  className="pfm-drawer__reason"
                  title={summary.cash_note ?? undefined}
                >
                  {t("portfoliosManage.drawer.cashIncomplete", {
                    defaultValue: "Sổ cái chưa đầy đủ",
                  })}
                </span>
              ) : null}
            </dd>
          </div>
          <div>
            <dt>{t("portfoliosManage.drawer.asOf", { defaultValue: "Số liệu chốt ngày" })}</dt>
            <dd>{formatDay(summary?.as_of, localeTag)}</dd>
          </div>
        </dl>

        {navReasonText && (
          <p className="pfm-drawer__notice" role="status">
            {navReasonText}
          </p>
        )}

        {unpriced.length > 0 && (
          <p className="pfm-drawer__notice" role="status">
            {t("portfoliosManage.drawer.unpriced", {
              defaultValue: "Còn mã chưa có giá hôm nay: {symbols}",
              symbols: unpriced.join(", "),
            })}
          </p>
        )}

        <h3 className="pfm-drawer__subtitle">
          {t("portfoliosManage.drawer.holdingsTitle", { defaultValue: "Vị thế đang giữ" })}
        </h3>

        {loading && <p role="status">{t("portfoliosManage.drawer.loading", { defaultValue: "Đang tải vị thế..." })}</p>}
        {error && (
          <p className="pfm-form__error" role="alert">
            {error.message}
          </p>
        )}
        {!loading && !error && holdings.length === 0 && (
          <p className="pfm-drawer__empty">
            {t("portfoliosManage.drawer.empty", {
              defaultValue: "Danh mục chưa có vị thế. Hãy nhập giao dịch hoặc đồng bộ từ broker.",
            })}
          </p>
        )}

        {holdings.length > 0 && (
          <div className="pfm-table-wrap">
            <table className="pfm-table pfm-table--holdings">
              <thead>
                <tr>
                  <th scope="col">{t("portfoliosManage.drawer.symbol", { defaultValue: "Mã" })}</th>
                  <th scope="col">{t("portfoliosManage.drawer.company", { defaultValue: "Tên công ty" })}</th>
                  <th scope="col" className="pfm-table__num">
                    {t("portfoliosManage.drawer.quantity", { defaultValue: "SL" })}
                  </th>
                  <th scope="col" className="pfm-table__num">
                    {t("portfoliosManage.drawer.avgCost", { defaultValue: "Giá vốn" })}
                  </th>
                  <th scope="col" className="pfm-table__num">
                    {t("portfoliosManage.drawer.last", { defaultValue: "Giá mới nhất" })}
                  </th>
                  <th scope="col" className="pfm-table__num">
                    {t("portfoliosManage.drawer.marketValue", { defaultValue: "Giá trị" })}
                  </th>
                  <th scope="col" className="pfm-table__num">
                    {t("portfoliosManage.drawer.pnlShort", { defaultValue: "Lãi/lỗ" })}
                  </th>
                  <th scope="col" className="pfm-table__num">
                    {t("portfoliosManage.drawer.weight", { defaultValue: "Tỷ trọng" })}
                  </th>
                  <th scope="col">{t("portfoliosManage.drawer.state", { defaultValue: "Trạng thái" })}</th>
                </tr>
              </thead>
              <tbody>
                {holdings.map((h) => {
                  const pnl = h.unrealized_pnl === null || h.unrealized_pnl === undefined
                    ? null
                    : Number(h.unrealized_pnl);
                  const missing = Boolean(h.price_missing_reason);
                  return (
                    <tr key={h.symbol}>
                      <th scope="row">
                        {h.symbol}
                        {h.industry && h.industry_reason === null ? (
                          <span className="pfm-table__desc">{h.industry}</span>
                        ) : null}
                      </th>
                      <td>{h.company_name || EM_DASH}</td>
                      <td className="pfm-table__num">{formatQty(h.quantity, localeTag)}</td>
                      <td className="pfm-table__num">{moneyOrDash(h.avg_cost, localeTag)}</td>
                      <td className="pfm-table__num" title={h.price_missing_reason ?? undefined}>
                        {missing
                          ? EM_DASH
                          : formatVnd(h.current_price, localeTag) ?? EM_DASH}
                      </td>
                      <td className="pfm-table__num">{moneyOrDash(h.market_value, localeTag)}</td>
                      <td className={`pfm-table__num pfm-tone-${toneOf(pnl)}`}>
                        {moneyOrDash(h.unrealized_pnl, localeTag)}
                        <span className="pfm-table__pct">
                          {formatPct(h.unrealized_pnl_pct, localeTag) ?? ""}
                        </span>
                      </td>
                      <td className="pfm-table__num">{formatPct(h.weight_pct, localeTag) ?? EM_DASH}</td>
                      <td>
                        {missing ? (
                          <span className="pfm-badge pfm-badge--warn">
                            {t("portfoliosManage.drawer.noPrice", { defaultValue: "Chưa có giá" })}
                          </span>
                        ) : h.stale ? (
                          <span className="pfm-badge pfm-badge--warn">
                            {t("portfoliosManage.drawer.stale", { defaultValue: "Giá cũ" })}
                          </span>
                        ) : (
                          <span className="pfm-badge pfm-badge--ok">
                            {t("portfoliosManage.drawer.fresh", { defaultValue: "Mới" })}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <footer className="pfm-drawer__footer">
          <Link to={`/portfolios/${portfolio.id}/overview`} className="pfm-btn-primary">
            {t("portfoliosManage.drawer.openWorkspace", { defaultValue: "Mở không gian danh mục" })}
          </Link>
          <Link to="/portfolios/manage/broker">
            {t("portfoliosManage.drawer.broker", { defaultValue: "Kết nối broker / đặt lệnh" })}
          </Link>
          <button type="button" onClick={onClose}>
            {t("portfoliosManage.drawer.close", { defaultValue: "Đóng" })}
          </button>
        </footer>
      </div>
    </div>
  );
}

export default PortfolioManageDrawer;