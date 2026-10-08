import { useState, useMemo, useCallback } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
} from "@tanstack/react-table";
import { useI18n } from "../../../context/LangContext.js";
import { useUrlValue, stringCodec, boolCodec } from "../../../hooks/useUrlState";
import {
  CAMPAIGN_STATUS_LABELS,
  CAMPAIGN_STATUS_COLORS,
  CAMPAIGN_TYPE_LABELS,
  CAMPAIGN_TYPE_COLORS,
} from "../constants/advertising.js";

function StatusBadge({ status, t }) {
  const label = t(CAMPAIGN_STATUS_LABELS[status] || status);
  const color = CAMPAIGN_STATUS_COLORS[status] || "";
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${color}`}>
      {label}
    </span>
  );
}

function TypeBadge({ type, t }) {
  const label = t(CAMPAIGN_TYPE_LABELS[type] || type);
  const color = CAMPAIGN_TYPE_COLORS[type] || "";
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${color}`}>
      {label}
    </span>
  );
}

function formatDate(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

export default function CampaignTable({ campaigns = [], loading, onEdit, onDelete }) {
  const { t } = useI18n();
  // W3-2 (AC-2.1): sap xep + loc toan cuc la 2 state cua bang. Truoc day chi
  // trong RAM ⇒ gui link cho nguoi khac thi ho thay bang CHUA sap xep/loc.
  // `sorting` la mang `[{ id, desc }]` cua react-table ⇒ tach thanh 2 tham so
  // URL: `sort` (cot) + `sortDir` (`asc`/`desc`).
  const [sortCol, setSortCol] = useUrlValue("sort", stringCodec, "");
  const [sortDesc, setSortDesc] = useUrlValue("sortDir", boolCodec("asc", "desc"), false);
  const sorting = useMemo(
    () => (sortCol ? [{ id: sortCol, desc: sortDesc }] : []),
    [sortCol, sortDesc]
  );
  const setSorting = useCallback(
    (updater) => {
      const next = typeof updater === "function" ? updater(sorting) : updater;
      const row = next?.[0];
      setSortCol(row?.id ?? "");
      setSortDesc(Boolean(row?.desc));
    },
    [sorting, setSortCol, setSortDesc]
  );
  const [globalFilter, setGlobalFilter] = useUrlValue("q", stringCodec, "");

  const columns = useMemo(
    () => [
      {
        accessorKey: "name",
        header: t("advertising.campaign.name"),
        cell: ({ getValue }) => (
          <span className="font-medium text-slate-900 dark:text-slate-100">{getValue()}</span>
        ),
      },
      {
        accessorKey: "campaign_type",
        header: t("advertising.campaign.type"),
        cell: ({ getValue }) => <TypeBadge type={getValue()} t={t} />,
      },
      {
        accessorKey: "status",
        header: t("advertising.campaign.status"),
        cell: ({ getValue }) => <StatusBadge status={getValue()} t={t} />,
      },
      {
        accessorKey: "weight",
        header: t("advertising.campaign.weight"),
        cell: ({ getValue }) => (
          <span className="tabular-nums text-slate-600 dark:text-slate-400">{getValue()}</span>
        ),
      },
      {
        accessorKey: "start_date",
        header: t("advertising.campaign.startDate"),
        cell: ({ getValue }) => (
          <span className="text-slate-600 dark:text-slate-400">{formatDate(getValue())}</span>
        ),
      },
      {
        accessorKey: "end_date",
        header: t("advertising.campaign.endDate"),
        cell: ({ getValue }) => (
          <span className="text-slate-600 dark:text-slate-400">{formatDate(getValue())}</span>
        ),
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <div className="flex items-center gap-1">
            <button
              onClick={() => onEdit?.(row.original)}
              className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              title={t("common.edit")}
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
              </svg>
            </button>
            <button
              onClick={() => onDelete?.(row.original)}
              className="rounded-lg p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600 dark:text-slate-400 dark:hover:bg-red-900/20 dark:hover:text-red-400"
              title={t("common.delete")}
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
              </svg>
            </button>
          </div>
        ),
      },
    ],
    [t, onEdit, onDelete]
  );

  const table = useReactTable({
    data: campaigns,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-12 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />
        ))}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm ring-1 ring-black/5 dark:border-slate-800 dark:bg-slate-900">
      <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-800">
        <input aria-label={t("advertising.campaign.searchPlaceholder")}
          type="text"
          value={globalFilter ?? ""}
          onChange={(e) => setGlobalFilter(e.target.value)}
          placeholder={t("advertising.campaign.searchPlaceholder")}
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500"
        />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="border-b border-slate-200 dark:border-slate-800">
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400"
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-12 text-center text-slate-500 dark:text-slate-400">
                  {t("advertising.campaign.noCampaigns")}
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50"
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-4 py-3 whitespace-nowrap">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 dark:border-slate-800">
        <span className="text-xs text-slate-500 dark:text-slate-400">
          {table.getFilteredRowModel().rows.length} / {campaigns.length} {t("advertising.campaign.title").toLowerCase()}
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Previous
          </button>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
          </span>
          <button
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
