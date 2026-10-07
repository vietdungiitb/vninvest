/**
 * S-09 - Trang Hoạt động (dòng thời gian giao dịch).
 *
 * PHÂN TRANG: `getTransactions` trả LIST PHẲNG, không có `count`/`total`
 * (`views.py` bọc `envelope(sorted(results, …))`). Vì vậy KHÔNG ghi
 * "Phân trang 1/0" hay "Tổng N mục" như thể BE đã cho biết tổng. Trang này
 * tự cắt trang và chỉ hiện "Đang xem X–Y" — con số suy ra từ dữ liệu đang có,
 * không phải tổng của cả tập (audit C25).
 *
 * Thứ tự: sắp xếp theo ngày giảm dần ngay trên client, vì BE không bảo đảm.
 */

import { useCallback, useMemo, useState } from "react";
import { useI18n } from "../../context/LangContext";
import { asRows, usePortfolioResource, type PortfolioAdapter } from "../../hooks/usePortfolioWorkspace";
import { defaultCoreApiAdapter } from "../../adapters/coreApiAdapter.js";

interface TxRow {
  id?: number | string;
  date?: string;
  transaction_date?: string;
  transaction_type?: string;
  type?: string;
  symbol?: string;
  quantity?: number | string;
  price?: number | string;
  total_value?: number | string;
  amount?: number | string;
  fees?: number | string;
  notes?: string;
  status?: string;
}

const PAGE_SIZE = 25;
const DASH = "—";

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "string" ? Number(v) : (v as number);
  return Number.isFinite(n) ? n : null;
}

function amount(row: TxRow): string {
  const v = num(row.total_value ?? row.amount);
  return v === null ? DASH : v.toLocaleString("vi-VN");
}

function dateOf(row: TxRow): string {
  return String(row.date ?? row.transaction_date ?? "");
}

export function PortfolioActivityPage({
  portfolioId, adapter,
}: {
  portfolioId: string | number | null;
  adapter?: PortfolioAdapter;
}) {
  const { t } = useI18n();
  // B0: `adapter` la prop TUY CHON de test inject duoc. Trong app that
  // main.tsx -> pageRegistry khong truyen prop nao, nen phai fallback ve
  // `defaultCoreApiAdapter` — neu khong, moi trang se nem
  // "Cannot read properties of undefined" khi chay that.
  const api = (adapter ?? defaultCoreApiAdapter) as PortfolioAdapter;
  const [page, setPage] = useState(0);

  const fetchTx = useCallback(
    (id: string | number) => api.getTransactions?.(id) ?? Promise.resolve([]),
    [api],
  );
  const res = usePortfolioResource<unknown>(portfolioId, fetchTx, () => "no_transactions");

  const rows = useMemo<TxRow[]>(() => asRows(res.data) as TxRow[], [res.data]);

  const sorted = useMemo(
    () => [...rows].sort((a, b) => (dateOf(b) < dateOf(a) ? -1 : dateOf(b) > dateOf(a) ? 1 : 0)),
    [rows],
  );

  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const slice = sorted.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  if (res.loading) {
    return <p role="status">{t("portfolioWorkspace.loading", { defaultValue: "Đang tải…" })}</p>;
  }
  if (res.error) {
    return <p role="alert">{t("portfolioWorkspace.loadError", { defaultValue: "Không tải được lịch sử" })}<code> {res.error}</code></p>;
  }

  return (
    <div className="pf-activity">
      {sorted.length === 0 ? (
        <p role="status">
          {t("portfolioWorkspace.activity.empty", { defaultValue: "Chưa có giao dịch nào" })}
        </p>
      ) : (
        <>
          <ol className="pf-timeline">
            {slice.map((row) => {
              const type = String(row.transaction_type ?? row.type ?? "");
              const side = /sell|bán/i.test(type) ? "neg" : /buy|mua/i.test(type) ? "pos" : "flat";
              return (
                <li key={String(row.id ?? `${row.symbol}-${dateOf(row)}`)} className="pf-timeline__item" data-side={side}>
                  <time dateTime={dateOf(row)}>{dateOf(row) || DASH}</time>
                  <span className="pf-timeline__type">{type || DASH}</span>
                  <span className="pf-timeline__symbol">{row.symbol || DASH}</span>
                  <span className="pf-timeline__qty">{num(row.quantity) === null ? DASH : String(num(row.quantity))}</span>
                  <span className="pf-timeline__amount">{amount(row)}</span>
                  {row.status && <span className="pf-timeline__status">{row.status}</span>}
                </li>
              );
            })}
          </ol>

          <nav className="pf-pager" aria-label={t("portfolioWorkspace.activity.pagerLabel", {
            defaultValue: "Phân trang giao dịch",
          })}>
            <button type="button" disabled={safePage === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
              {t("portfolioWorkspace.activity.prev", { defaultValue: "Trước" })}
            </button>
            {/* Chỉ hiện khoảng đang xem — BE KHÔNG trả tổng số bản ghi. */}
            <span aria-live="polite">
              {safePage * PAGE_SIZE + 1}
              {"–"}
              {Math.min(sorted.length, (safePage + 1) * PAGE_SIZE)}
            </span>
            <button
              type="button"
              disabled={safePage >= pageCount - 1}
              onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
            >
              {t("portfolioWorkspace.activity.next", { defaultValue: "Sau" })}
            </button>
          </nav>
        </>
      )}
    </div>
  );
}

export default PortfolioActivityPage;
