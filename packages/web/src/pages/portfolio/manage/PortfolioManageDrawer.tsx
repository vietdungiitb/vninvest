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
  getWatchlists(): Promise<unknown>;
};

/** 1 watchlist: `id`, `name`, `items[].symbol` (`serializers.py:17-30`). */
interface WatchlistRow {
  id?: number | string;
  name?: string;
  items?: { symbol?: string }[];
}

/**
 * Danh sách mã đang nằm trong BẤT KỲ watchlist nào của user.
 *
 * Vì sao giao thay vì liệt kê watchlist: `Watchlist` **không có FK tới
 * `Portfolio`** (`user_workspace/models.py:209-253` chỉ có `user`, `tenant`,
 * `provider`, `broker_account`). Nên "watchlist của danh mục này" không tồn tại —
 * hiện cả danh sách chung trong mọi drawer sẽ khiến user tưởng nó thuộc danh
 * mục. Ta chỉ trả lời được câu hỏi có nghĩa: **mã nào đang giữ trong danh mục
 * này mà bạn cũng đang theo dõi**.
 */
function collectWatchedSymbols(raw: unknown): Map<string, string[]> {
  const data = (raw as { data?: unknown })?.data ?? raw;
  const map = new Map<string, string[]>();
  if (!Array.isArray(data)) return map;
  for (const wl of data as WatchlistRow[]) {
    const name = typeof wl?.name === "string" && wl.name ? wl.name : "—";
    for (const item of wl?.items ?? []) {
      const symbol = typeof item?.symbol === "string" ? item.symbol.trim() : "";
      if (!symbol) continue;
      const hit = map.get(symbol);
      if (hit) {
        if (!hit.includes(name)) hit.push(name);
      } else {
        map.set(symbol, [name]);
      }
    }
  }
  return map;
}

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
  /** Tiêm bản giả trong test; mặc định là adapter thật. */
  getWatchlists?: () => Promise<unknown>;
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
  portfolio, summary, getHoldings = adapter.getPortfolioHoldings,
  getWatchlists = adapter.getWatchlists, onClose,
}: PortfolioManageDrawerProps) {
  const { t, localeTag } = useI18n();
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [holdings, setHoldings] = useState<HoldingRow[]>([]);
  const [meta, setMeta] = useState<HoldingsMeta>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ManagedError | null>(null);
  const [tab, setTab] = useState<"holdings" | "watched">("holdings");
  const [watched, setWatched] = useState<Map<string, string[]>>(
    () => new Map(),
  );
  const [watchLoading, setWatchLoading] = useState(false);
  /** Drawer là modal ⇒ focus trap sẽ hút focus về panel khi đóng tab. */
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});

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

  // Watchlist nạp **song song** với holdings, không chặn tab hiện tại: lỗi
  // watchlist KHÔNG được làm hỏng tab "Vị thế đang giữ" (đã có dữ liệu).
  useEffect(() => {
    if (portfolioId === null) {
      setWatched(new Map());
      return;
    }
    let alive = true;
    setWatchLoading(true);
    getWatchlists()
      .then((raw: unknown) => {
        if (alive) setWatched(collectWatchedSymbols(raw));
      })
      .catch(() => {
        // Im lặng có chủ đích: tab Theo dõi tự hiện thông báo lỗi riêng.
        if (alive) setWatched(new Map());
      })
      .finally(() => {
        if (alive) setWatchLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [portfolioId, getWatchlists]);

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
  /** Giao: mã đang giữ trong danh mục ∩ mã nằm trong watchlist của user. */
  const watchedRows = holdings.filter((h) => watched.has(h.symbol));
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

        <div className="pfm-drawer__tabs" role="tablist" aria-label={t("portfoliosManage.drawer.tabsLabel", { defaultValue: "Khoá dữ liệu" })}>
          <button
            type="button"
            role="tab"
            id="pfm-tab-holdings"
            aria-selected={tab === "holdings"}
            aria-controls="pfm-panel-holdings"
            tabIndex={tab === "holdings" ? 0 : -1}
            className={tab === "holdings" ? "pfm-drawer__tab is-active" : "pfm-drawer__tab"}
            onClick={() => setTab("holdings")}
            ref={(el) => { tabRefs.current.holdings = el; }}
          >
            {t("portfoliosManage.drawer.tabHoldings", { defaultValue: "Vị thế đang giữ" })}
          </button>
          <button
            type="button"
            role="tab"
            id="pfm-tab-watched"
            aria-selected={tab === "watched"}
            aria-controls="pfm-panel-watched"
            tabIndex={tab === "watched" ? 0 : -1}
            className={tab === "watched" ? "pfm-drawer__tab is-active" : "pfm-drawer__tab"}
            onClick={() => setTab("watched")}
            ref={(el) => { tabRefs.current.watched = el; }}
          >
            {t("portfoliosManage.drawer.tabWatched", { defaultValue: "Theo dõi" })}
            {watchedRows.length > 0 ? (
              <span className="pfm-drawer__tab-count">{watchedRows.length}</span>
            ) : null}
          </button>
        </div>

        <div
          id="pfm-panel-holdings"
          role="tabpanel"
          aria-labelledby="pfm-tab-holdings"
          hidden={tab !== "holdings"}
        >
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
        </div>

        <div
          id="pfm-panel-watched"
          role="tabpanel"
          aria-labelledby="pfm-tab-watched"
          hidden={tab !== "watched"}
        >
          <h3 className="pfm-drawer__subtitle">
            {t("portfoliosManage.drawer.watchedTitle", { defaultValue: "Mã đang giữ và cũng đang theo dõi" })}
          </h3>
          <p className="pfm-drawer__empty">
            {t("portfoliosManage.drawer.watchedHint", {
              defaultValue:
                "Danh sách theo dõi là của tài khoản bạn nên có thể dùng chung cho mọi danh mục. Bảng này chỉ liệt kê mã vừa nằm trong vị thế của danh mục vừa có trong danh sách theo dõi.",
            })}
          </p>

          {watchLoading && (
            <p role="status">{t("portfoliosManage.drawer.watchedLoading", { defaultValue: "Đang tải danh sách theo dõi..." })}</p>
          )}

          {!watchLoading && watchedRows.length === 0 && (
            <p className="pfm-drawer__empty">
              {holdings.length === 0
                ? t("portfoliosManage.drawer.watchedNoHoldings", {
                    defaultValue: "Danh mục chưa có vị thế nào để so sánh.",
                  })
                : t("portfoliosManage.drawer.watchedEmpty", {
                    defaultValue: "Không mã nào đang giữ trong danh mục này có trong danh sách theo dõi của bạn.",
                  })}
            </p>
          )}

          {watchedRows.length > 0 && (
            <div className="pfm-table-wrap">
              <table className="pfm-table pfm-table--watched">
                <thead>
                  <tr>
                    <th scope="col">{t("portfoliosManage.drawer.symbol", { defaultValue: "Mã" })}</th>
                    <th scope="col">{t("portfoliosManage.drawer.company", { defaultValue: "Tên công ty" })}</th>
                    <th scope="col">{t("portfoliosManage.drawer.watchedIn", { defaultValue: "Nằm trong danh sách" })}</th>
                    <th scope="col" className="pfm-table__num">
                      {t("portfoliosManage.drawer.weight", { defaultValue: "Tỷ trọng" })}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {watchedRows.map((h) => (
                    <tr key={h.symbol}>
                      <th scope="row">{h.symbol}</th>
                      <td>{h.company_name || EM_DASH}</td>
                      <td>{(watched.get(h.symbol) ?? []).join(", ")}</td>
                      <td className="pfm-table__num">{formatPct(h.weight_pct, localeTag) ?? EM_DASH}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <footer className="pfm-drawer__footer">
          <Link to={`/portfolios/${portfolio.id}/overview`} className="pfm-btn-primary">
            {t("portfoliosManage.drawer.openWorkspace", { defaultValue: "Mở không gian danh mục" })}
          </Link>
          <Link to="/portfolios/manage/broker">
            {t("portfoliosManage.drawer.broker", { defaultValue: "Kết nối broker" })}
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