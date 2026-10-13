/**
 * Bảng danh mục — trái tim của `/portfolios/manage`.
 *
 * Cột so với bảng cũ (`PortfoliosPage.tsx:138-157`, 4 cột):
 * `Tên | Số dư mở đầu | Ngày tạo | Thao tác` → thêm **giá trị thị trường**,
 * **lãi/lỗ chưa thực hiện (+ %)**, **số mã đang giữ**, **ngày cập nhật dữ liệu**.
 * Đây là 4 cột mà một trang quản lý danh mục đáng ra phải có; bảng cũ chỉ cho
 * phép user biết "danh mục tồn tại" chứ không biết "nó đang ăn bao nhiêu tiền".
 *
 * Ô không có số liệu hiện `—` + `title` giải thích, KHÔNG hiện `0`
 * (nguyên tắc NO ZERO DISPLAY). Lý do cụ thể lấy từ chính BE:
 * `market_value_reason` và `price_missing_reason`.
 *
 * Sắp xếp: sort **client-side trên trang hiện tại** — BE dùng cursor pagination
 * nên `?ordering=` không có tác dụng, và sắp xếp toàn bộ danh sách sẽ sai với
 * bản chất phân trang. Bảng đánh dấu rõ phạm vi: sort trong trang này.
 */

import { useI18n } from "../../../context/LangContext.js";
import {
  EM_DASH,
  formatDay,
  formatPct,
  formatQty,
  moneyOrDash,
  toneOf,
  type PortfolioRow,
  type PortfolioSummary,
} from "./format";
import "./portfolioManage.css";

export type SortKey = "name" | "marketValue" | "cost" | "pnl" | "createdAt";
export type SortDir = "asc" | "desc";

export interface PortfolioManageTableProps {
  portfolios: PortfolioRow[];
  summaries: Record<string, PortfolioSummary>;
  loading: boolean;
  loadingMoney: boolean;
  sort: { key: SortKey; dir: SortDir };
  onSort(key: SortKey): void;
  onEdit(row: PortfolioRow): void;
  onDelete(row: PortfolioRow): void;
  onOpenDetail(row: PortfolioRow): void;
  savingId: string | number | null;
  deletingId: string | number | null;
}

/** Giá trị sort của một dòng. `null` luôn đẩy xuống cuối, bất kể chiều. */
function sortValue(row: PortfolioRow, summary: PortfolioSummary | undefined, key: SortKey): number | string | null {
  switch (key) {
    case "name":
      return String(row.name ?? "").toLowerCase();
    case "marketValue":
      return numOrNull(summary?.total_market_value);
    case "cost":
      return numOrNull(summary?.total_cost);
    case "pnl":
      return numOrNull(summary?.total_unrealized_pnl);
    case "createdAt":
      return row.created_at ? Date.parse(row.created_at) : null;
    default:
      return null;
  }
}

function numOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function PortfolioManageTable(props: PortfolioManageTableProps) {
  const { t, localeTag } = useI18n();
  const {
    portfolios, summaries, loading, loadingMoney, sort,
    onSort, onEdit, onDelete, onOpenDetail, savingId, deletingId,
  } = props;

  const rows = portfolios
    .map((row) => ({ row, summary: summaries[String(row.id)] }))
    .sort((a, b) => {
      const av = sortValue(a.row, a.summary, sort.key);
      const bv = sortValue(b.row, b.summary, sort.key);
      if (av === null && bv === null) return 0;
      if (av === null) return 1;
      if (bv === null) return -1;
      const cmp = typeof av === "string" && typeof bv === "string"
        ? av.localeCompare(bv, localeTag)
        : Number(av) - Number(bv);
      return sort.dir === "asc" ? cmp : -cmp;
    });

  const headers: Array<{ key: SortKey | null; label: string; numeric?: boolean }> = [
    { key: "name", label: t("portfoliosManage.table.name", { defaultValue: "Tên danh mục" }) },
    { key: "marketValue", label: t("portfoliosManage.table.marketValue", { defaultValue: "Giá trị thị trường" }), numeric: true },
    { key: "cost", label: t("portfoliosManage.table.cost", { defaultValue: "Giá vốn" }), numeric: true },
    { key: "pnl", label: t("portfoliosManage.table.pnl", { defaultValue: "Lãi/lỗ chưa thực hiện" }), numeric: true },
    { key: null, label: t("portfoliosManage.table.holdings", { defaultValue: "Mã đang giữ" }), numeric: true },
    { key: "createdAt", label: t("portfoliosManage.table.created", { defaultValue: "Ngày tạo" }) },
    { key: null, label: t("portfoliosManage.table.asOf", { defaultValue: "Số liệu cập nhật" }) },
    { key: null, label: t("portfoliosManage.table.actions", { defaultValue: "Thao tác" }) },
  ];

  const ariaSort = (key: SortKey | null): "ascending" | "descending" | "none" => {
    if (!key) return "none";
    if (sort.key !== key) return "none";
    return sort.dir === "asc" ? "ascending" : "descending";
  };

  return (
    <div className="pfm-table-wrap">
      <table className="pfm-table">
        <caption className="pf-visually-hidden">
          {t("portfoliosManage.table.caption", {
            defaultValue: "Danh sách danh mục đầu tư của bạn",
          })}
        </caption>
        <thead>
          <tr>
            {headers.map((h) => (
              <th
                key={h.label}
                scope="col"
                aria-sort={ariaSort(h.key)}
                className={h.numeric ? "pfm-table__num" : undefined}
              >
                {h.key ? (
                  <button type="button" className="pfm-sortbtn" onClick={() => onSort(h.key as SortKey)}>
                    {h.label}
                    <span aria-hidden="true" className="pfm-sortbtn__mark">
                      {sort.key === h.key ? (sort.dir === "asc" ? "▲" : "▼") : "⇅"}
                    </span>
                  </button>
                ) : (
                  h.label
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody aria-busy={loading || loadingMoney || undefined}>
          {rows.map(({ row, summary }) => {
            const id = String(row.id);
            const pnl = numOrNull(summary?.total_unrealized_pnl);
            const mvReason = summary?.market_value_reason ?? null;
            const busyRow = savingId === row.id || deletingId === row.id;
            return (
              <tr key={id} className={busyRow ? "pfm-table__row--busy" : undefined}>
                <th scope="row" className="pfm-table__name">
                  <span className="pfm-table__nameText">{row.name}</span>
                  {row.is_default ? (
                    <span className="pfm-badge pfm-badge--default">
                      {t("portfoliosManage.badge.default", { defaultValue: "Mặc định" })}
                    </span>
                  ) : null}
                  {row.description ? (
                    <span className="pfm-table__desc">{row.description}</span>
                  ) : null}
                </th>
                <td className="pfm-table__num" title={mvReason ?? undefined}>
                  {summary ? moneyOrDash(summary.total_market_value, localeTag) : loadingMoney ? "…" : EM_DASH}
                </td>
                <td className="pfm-table__num">
                  {summary ? moneyOrDash(summary.total_cost, localeTag) : loadingMoney ? "…" : EM_DASH}
                </td>
                <td className={`pfm-table__num pfm-tone-${toneOf(pnl)}`}>
                  {summary ? (
                    <>
                      <span>{moneyOrDash(summary.total_unrealized_pnl, localeTag)}</span>{" "}
                      <span className="pfm-table__pct">
                        {formatPct(summary.total_unrealized_pnl_pct, localeTag) ?? EM_DASH}
                      </span>
                    </>
                  ) : loadingMoney ? (
                    "…"
                  ) : (
                    EM_DASH
                  )}
                </td>
                <td className="pfm-table__num">
                  {summary
                    ? formatQty(summary.num_holdings ?? 0, localeTag)
                    : loadingMoney
                      ? "…"
                      : EM_DASH}
                </td>
                <td>{formatDay(row.created_at, localeTag)}</td>
                <td>{formatDay(summary?.as_of, localeTag)}</td>
                <td className="pfm-table__actions">
                  <button type="button" onClick={() => onOpenDetail(row)}>
                    {t("portfoliosManage.action.detail", { defaultValue: "Chi tiết" })}
                  </button>
                  <button type="button" onClick={() => onEdit(row)} disabled={busyRow}>
                    {t("portfoliosManage.action.edit", { defaultValue: "Sửa" })}
                  </button>
                  <button
                    type="button"
                    className="pfm-btn-danger"
                    onClick={() => onDelete(row)}
                    disabled={busyRow}
                  >
                    {deletingId === row.id
                      ? t("portfoliosManage.action.deleting", { defaultValue: "Đang xoá..." })
                      : t("portfoliosManage.action.delete", { defaultValue: "Xoá" })}
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

export default PortfolioManageTable;