/**
 * S-06 - Trang Danh mục (13 cột).
 *
 * 13 cột lấy TỪ NGUỒN GỐC, không tự đoán:
 * `docs/archive/docs-flat/portfolio_exec_slices/PORTFOLIO_EXEC_SLICES_LEDGER_FE_20260927.md:482`
 *   select · symbol · name · quantity · avg cost · last price · market value ·
 *   unrealized P&L · P&L % · weight · sector · 24h% · actions
 *
 * 4 cột sau này trước đây KHÔNG có dữ liệu (audit C4) — S-00c đã bổ sung
 * `company_name` / `industry` / `weight_pct` / `price_change_pct`.
 *
 * Ô THIẾU DỮ LIỆU hiện `—`, không hiện 0 (D7). Lọc/sắp xếp cột SỐ so sánh
 * theo giá trị số — không theo chuỗi (bẫy PB2 của FE-03: "1.000.000" so với
 * "900.000" mà so chuỗi thì sai).
 */

import { useCallback, useMemo, useState } from "react";
import { useI18n } from "../../context/LangContext";
import { usePortfolioResource, asRows, type PortfolioAdapter } from "../../hooks/usePortfolioWorkspace";

export interface HoldingRow {
  symbol?: string;
  company_name?: string;
  industry?: string;
  industry_reason?: string | null;
  quantity?: number | string;
  avg_cost?: string | null;
  current_price?: string | null;
  market_value?: string | null;
  unrealized_pnl?: string | null;
  unrealized_pnl_pct?: number | null;
  weight_pct?: number | null;
  price_change_pct?: number | null;
  price_missing_reason?: string | null;
  stale?: boolean;
}

const DASH = "—";

function num(v: string | number | null | undefined): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "string" ? Number(v) : v;
  return Number.isFinite(n) ? n : null;
}

function fmtMoney(v: string | number | null | undefined): string {
  const n = num(v);
  return n === null ? DASH : n.toLocaleString("vi-VN");
}

function fmtPct(v: string | number | null | undefined, digits = 2): string {
  const n = num(v);
  return n === null ? DASH : `${n.toFixed(digits)}%`;
}

/** Dấu +/- để người đọc không phải tự so với 0. */
function signed(v: string | number | null | undefined, digits = 2): string {
  const n = num(v);
  if (n === null) return DASH;
  return `${n > 0 ? "+" : ""}${n.toFixed(digits)}`;
}

type SortKey = "symbol" | "market_value" | "unrealized_pnl" | "unrealized_pnl_pct"
  | "weight_pct" | "price_change_pct";

export function PortfolioHoldingsPage({
  portfolioId, adapter,
}: {
  portfolioId: string | number | null;
  adapter?: PortfolioAdapter;
}) {
  const { t } = useI18n();
  const api = adapter as PortfolioAdapter;
  const [search, setSearch] = useState("");
  const [sector, setSector] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("market_value");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const fetchHoldings = useCallback(
    (id: string | number) => api.getPortfolioHoldings?.(id) ?? Promise.resolve([]),
    [api],
  );
  const res = usePortfolioResource<unknown>(portfolioId, fetchHoldings, () => "no_holdings");

  const all = useMemo<HoldingRow[]>(() => asRows(res.data) as HoldingRow[], [res.data]);

  const sectors = useMemo(() => {
    const set = new Set<string>();
    for (const r of all) if (r.industry) set.add(r.industry);
    return [...set].sort((a, b) => a.localeCompare(b, "vi"));
  }, [all]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    let rows = all.filter((r) => {
      if (q) {
        const hay = `${r.symbol ?? ""} ${r.company_name ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (sector && r.industry !== sector) return false;
      return true;
    });
    // Cột SỐ luôn so theo giá trị số; khi null luôn đẩy xuống cuối dù hướng
    // tăng hay giảm — vì null là "chưa biết", không phải giá trị nhỏ nhất.
    const dir = sortDir === "asc" ? 1 : -1;
    rows = [...rows].sort((a, b) => {
      if (sortKey === "symbol") {
        return dir * String(a.symbol ?? "").localeCompare(String(b.symbol ?? ""), "vi");
      }
      const av = num(a[sortKey] as never);
      const bv = num(b[sortKey] as never);
      if (av === null && bv === null) return 0;
      if (av === null) return 1;
      if (bv === null) return -1;
      return dir * (av - bv);
    });
    return rows;
  }, [all, search, sector, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("desc"); }
  };

  const ariaSort = (key: SortKey) => (sortKey === key ? (sortDir === "asc" ? "ascending" : "descending") : "none");

  if (res.loading) {
    return <p role="status">{t("portfolioWorkspace.loading", { defaultValue: "Đang tải…" })}</p>;
  }
  if (res.error) {
    return <p role="alert">{t("portfolioWorkspace.loadError", { defaultValue: "Không tải được danh mục" })}<code> {res.error}</code></p>;
  }

  const headers: Array<{ key: SortKey | null; label: string; numeric?: boolean }> = [
    { key: "symbol", label: t("portfolioWorkspace.holdings.symbol", { defaultValue: "Mã" }) },
    { key: null, label: t("portfolioWorkspace.holdings.name", { defaultValue: "Tên" }) },
    { key: null, label: t("portfolioWorkspace.holdings.quantity", { defaultValue: "KL" }), numeric: true },
    { key: null, label: t("portfolioWorkspace.holdings.avgCost", { defaultValue: "Giá vốn" }), numeric: true },
    { key: null, label: t("portfolioWorkspace.holdings.lastPrice", { defaultValue: "Giá hiện tại" }), numeric: true },
    { key: "market_value", label: t("portfolioWorkspace.holdings.marketValue", { defaultValue: "Giá trị" }), numeric: true },
    { key: "unrealized_pnl", label: t("portfolioWorkspace.holdings.unrealizedPnl", { defaultValue: "Lãi/lỗ" }), numeric: true },
    { key: "unrealized_pnl_pct", label: t("portfolioWorkspace.holdings.unrealizedPnlPct", { defaultValue: "%" }), numeric: true },
    { key: "weight_pct", label: t("portfolioWorkspace.holdings.weight", { defaultValue: "Tỷ trọng" }), numeric: true },
    { key: null, label: t("portfolioWorkspace.holdings.sector", { defaultValue: "Ngành" }) },
    { key: "price_change_pct", label: t("portfolioWorkspace.holdings.change24h", { defaultValue: "Thay đổi ngày" }), numeric: true },
    { key: null, label: t("portfolioWorkspace.holdings.status", { defaultValue: "Trạng thái" }) },
    { key: null, label: t("portfolioWorkspace.holdings.actions", { defaultValue: "Thao tác" }) },
  ];

  return (
    <div className="pf-holdings">
      <div className="pf-filters" role="search">
        <label>
          {t("portfolioWorkspace.holdings.search", { defaultValue: "Tìm mã hoặc tên" })}
          <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} />
        </label>
        <label>
          {t("portfolioWorkspace.holdings.filterSector", { defaultValue: "Ngành" })}
          <select value={sector} onChange={(e) => setSector(e.target.value)}>
            <option value="">{t("portfolioWorkspace.holdings.allSectors", { defaultValue: "Tất cả" })}</option>
            {sectors.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
      </div>

      <table className="pf-table">
        <caption className="pf-visually-hidden">
          {t("portfolioWorkspace.holdings.caption", { defaultValue: "Danh sách mã đang nắm giữ" })}
        </caption>
        <thead>
          <tr>
            {headers.map((h) => (
              <th
                key={h.label}
                scope="col"
                aria-sort={h.key ? ariaSort(h.key as SortKey) : undefined}
              >
                {h.key ? (
                  <button type="button" onClick={() => toggleSort(h.key as SortKey)}>
                    {h.label}
                  </button>
                ) : h.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {visible.length === 0 && (
            <tr>
              <td colSpan={headers.length}>
                {t("portfolioWorkspace.holdings.empty", {
                  defaultValue: all.length === 0 ? "Danh mục chưa có mã nào" : "Không có mã nào khớp bộ lọc",
                })}
              </td>
            </tr>
          )}
          {visible.map((r) => {
            const pnl = num(r.unrealized_pnl);
            return (
              <tr key={String(r.symbol)} data-stale={r.stale ? "true" : undefined}>
                <th scope="row">{r.symbol ?? DASH}</th>
                <td>{r.company_name || DASH}</td>
                <td>{fmtMoney(r.quantity)}</td>
                <td>{fmtMoney(r.avg_cost)}</td>
                <td>
                  {fmtMoney(r.current_price)}
                  {r.price_missing_reason && (
                    <span className="pf-cell-note">
                      {t("portfolioWorkspace.holdings.noQuote", { defaultValue: "chưa có giá" })}
                    </span>
                  )}
                </td>
                <td>{fmtMoney(r.market_value)}</td>
                <td data-sign={pnl === null ? undefined : pnl > 0 ? "pos" : pnl < 0 ? "neg" : "flat"}>
                  {signed(r.unrealized_pnl)}
                </td>
                <td>{fmtPct(r.unrealized_pnl_pct)}</td>
                <td>{fmtPct(r.weight_pct)}</td>
                <td>
                  {r.industry || t("portfolioWorkspace.holdings.unclassified", {
                    defaultValue: "Chưa phân ngành",
                  })}
                </td>
                <td>{fmtPct(r.price_change_pct)}</td>
                <td>
                  {r.price_missing_reason
                    ? t("portfolioWorkspace.holdings.stale", { defaultValue: "Chưa có giá" })
                    : r.stale
                      ? t("portfolioWorkspace.holdings.staleShort", { defaultValue: "Cũ" })
                      : t("portfolioWorkspace.holdings.fresh", { defaultValue: "Mới" })}
                </td>
                <td>
                  {/* Read-only theo pham vi: khong nut dat lenh, chi mo chi tiet. */}
                  <button type="button" disabled>
                    {t("portfolioWorkspace.holdings.view", { defaultValue: "Chi tiết" })}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default PortfolioHoldingsPage;
