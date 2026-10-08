import { formatNumber } from "../i18n";
import { useState, useEffect, useCallback, createElement } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import styles from "./aiSettings.module.css";
import { coreApiAdapter } from "../adapters/coreApiAdapter.js";
import { useI18n } from "../context/LangContext.js";
import { useRetryableAsync } from "../hooks/useRetryableAsync.js";

const e = createElement;

interface AggregateData {
  total_requests: number;
  total_tokens_in: number;
  total_tokens_out: number;
  total_cost: string;
  avg_latency: number;
}

interface UsageRecord {
  id: number;
  username: string;
  action: string;
  provider: string;
  model: string;
  tokens_in: number;
  tokens_out: number;
  cost: string;
  latency_ms: number;
  status: string;
  created_at: string;
}

interface UsageSummaryRow {
  date: string;
  action: string;
  total_requests: number;
  total_tokens_in: number;
  total_tokens_out: number;
  total_cost: string;
  avg_latency_ms: number;
}

interface AIUsageDashboardProps {
  className?: string;
}

const PAGE_SIZES = [20, 50, 100];

const CSV_HEADER_KEYS = [
  "aiUsageAnalytics.createdAt", "aiUsageAnalytics.action", "aiUsageAnalytics.provider", "aiUsageAnalytics.model",
  "aiUsageAnalytics.tokensIn", "aiUsageAnalytics.tokensOut", "aiUsageAnalytics.cost", "aiUsageAnalytics.latency", "aiUsageAnalytics.status",
];

const TABLE_HEADER_KEYS = [
  "aiUsageAnalytics.createdAt", "aiUsageAnalytics.action", "aiUsageAnalytics.provider", "aiUsageAnalytics.model",
  "aiUsageAnalytics.tokensIn", "aiUsageAnalytics.tokensOut", "aiUsageAnalytics.cost", "aiUsageAnalytics.latency", "aiUsageAnalytics.status",
];

const PERIOD_KEYS: Record<string, string> = {
  "7": "aiUsageAnalytics.last7Days",
  "30": "aiUsageAnalytics.last30Days",
  "90": "aiUsageAnalytics.last90Days",
};

const STATUS_OPTIONS = ["success", "error"] as const;

function toCsv(records: UsageRecord[], localeTag: string, t: (key: string) => string): string {
  const escape = (val: string | number) => {
    const s = String(val);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const headers = CSV_HEADER_KEYS.map((k) => t(k));
  const rows = records.map((rec) => [
    new Date(rec.created_at).toLocaleString(localeTag),
    rec.action,
    rec.provider,
    rec.model,
    rec.tokens_in,
    rec.tokens_out,
    `$${parseFloat(rec.cost || "0").toFixed(6)}`,
    `${rec.latency_ms}ms`,
    rec.status,
  ].map(escape).join(","));
  return "﻿" + headers.join(",") + "\n" + rows.join("\n");
}

/** Aggregate summary rows by date for F1 chart (real API, not mock). */
function buildChartData(summary: UsageSummaryRow[] | null): Array<{ date: string; tokensIn: number }> {
  if (!summary?.length) return [];
  const byDate = new Map<string, number>();
  for (const row of summary) {
    const key = String(row.date).slice(0, 10);
    byDate.set(key, (byDate.get(key) || 0) + (Number(row.total_tokens_in) || 0));
  }
  return [...byDate.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, tokensIn]) => ({ date, tokensIn }));
}

export function AIUsageDashboard({ className = "" }: AIUsageDashboardProps) {
  const { t, localeTag } = useI18n();
  const [days, setDays] = useState("7");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [modelFilter, setModelFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [exporting, setExporting] = useState(false);

  const usageClient = coreApiAdapter as unknown as {
    getAIUsageAggregate: (p: Record<string, string>) => Promise<AggregateData>;
    getAIUsageRecords: (p: Record<string, string>) => Promise<{ results: UsageRecord[]; total: number }>;
    getAIUsageSummary: (p: Record<string, string>) => Promise<{ results: UsageSummaryRow[] }>;
  };

  const fetchData = useCallback(async () => {
    const params: Record<string, string> = { days };
    if (modelFilter) params.model = modelFilter;
    if (statusFilter) params.status = statusFilter;
    const limit = String(pageSize);
    const offset = String((page - 1) * pageSize);
    const [agg, rec, summary] = await Promise.all([
      usageClient.getAIUsageAggregate(params),
      usageClient.getAIUsageRecords({ ...params, limit, offset }),
      usageClient.getAIUsageSummary({ days }),
    ]);
    return { agg, rec, summary };
  }, [days, page, pageSize, modelFilter, statusFilter, usageClient]);

  const { data, loading: fetchLoading, error: fetchError, execute: loadData, retry: retryLoadData } = useRetryableAsync(fetchData, 2);

  const aggregate = data?.agg ?? null;
  const records = data?.rec?.results ?? [];
  const total = data?.rec?.total ?? 0;
  const chartData = buildChartData(data?.summary?.results ?? null);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  useEffect(() => { loadData(); }, [loadData]);

  const handlePeriodChange = (value: string) => {
    setDays(value);
    setPage(1);
  };

  const handlePageSizeChange = (value: number) => {
    setPageSize(value);
    setPage(1);
  };

  const handleModelFilterChange = (value: string) => {
    setModelFilter(value);
    setPage(1);
  };

  const handleStatusFilterChange = (value: string) => {
    setStatusFilter(value);
    setPage(1);
  };

  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      const all: UsageRecord[] = [];
      let offset = 0;
      const batch = 100;
      const exportParams: Record<string, string> = { days };
      if (modelFilter) exportParams.model = modelFilter;
      if (statusFilter) exportParams.status = statusFilter;
      for (;;) {
        const res = await usageClient.getAIUsageRecords({
          ...exportParams,
          limit: String(batch),
          offset: String(offset),
        });
        const results = res.results || [];
        all.push(...results);
        if (results.length < batch) break;
        offset += batch;
      }
      const csv = toCsv(all, localeTag, t);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `ai-usage-${days}days-${Date.now()}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch {
      console.error("Export failed");
    } finally {
      setExporting(false);
    }
  }, [days, modelFilter, statusFilter, usageClient, localeTag, t]);

  const summaryCards = [
    { label: t("aiUsageAnalytics.totalRequests"), value: formatNumber(aggregate?.total_requests ?? 0), key: "requests" },
    { label: t("aiUsageAnalytics.totalTokens"), value: formatNumber((aggregate?.total_tokens_in || 0) + (aggregate?.total_tokens_out || 0)), key: "tokens" },
    { label: t("aiUsageAnalytics.totalCost"), value: `$${parseFloat(aggregate?.total_cost || "0").toFixed(4)}`, key: "cost" },
    { label: t("aiUsageAnalytics.avgLatency"), value: aggregate?.avg_latency ? `${Math.round(aggregate.avg_latency)}ms` : "0ms", key: "latency" },
  ];

  return e("div", { className: styles.panel + " " + className },
    e("div", { className: styles.panelHeader },
      e("div", null,
        e("h2", { className: styles.panelTitle }, t("aiUsageAnalytics.title")),
        e("p", { className: styles.panelSubtitle }, t("aiUsageAnalytics.description")),
      ),
      e("div", { className: styles.toolbar },
        ...Object.entries(PERIOD_KEYS).map(([value, key]) =>
          e("button", {
            key: value,
            className: `${styles.btn} ${styles.btnSm} ${days === value ? styles.btnActive : ""}`,
            onClick: () => handlePeriodChange(value),
          }, t(key))
        ),
        e("button", {
          className: `${styles.btn} ${styles.btnSm}`,
          onClick: () => { loadData(); retryLoadData(); },
          disabled: fetchLoading,
        }, t("aiUsageAnalytics.refresh")),
        e("button", {
          key: "export-csv",
          className: `${styles.btn} ${styles.btnSm}`,
          onClick: handleExport,
          disabled: exporting || fetchLoading,
        }, exporting ? t("aiUsageAnalytics.exporting") : t("aiUsageAnalytics.exportCsv")),
      ),
    ),

    !fetchLoading && e("div", { className: styles.metricGrid, style: { marginBottom: 16 } },
      ...summaryCards.map((card) =>
        e("div", {
          key: card.key,
          className: styles.metricCard,
        },
          e("div", { className: styles.metricLabel }, card.label),
          e("div", { className: styles.metricValue }, card.value),
        ),
      ),
    ),

    fetchError && e("div", { className: styles.alert + " " + styles.alertError, role: "alert" }, fetchError),

    fetchLoading && e("p", { className: styles.loading }, t("aiUsageAnalytics.loading")),

    !fetchLoading && e("div", { className: styles.filterBar, "data-testid": "usage-filters" },
      e("label", null,
        t("aiUsageAnalytics.filterModel"),
        e("select", {
          value: modelFilter,
          onChange: (ev: { target: { value: string } }) => handleModelFilterChange(ev.target.value),
          "data-testid": "filter-model",
        },
          e("option", { key: "all-model", value: "" }, t("aiUsageAnalytics.filterAll")),
          ...[...new Set(records.map((r) => r.model).filter(Boolean))].map((m) =>
            e("option", { key: m, value: m }, m)
          ),
          modelFilter && !records.some((r) => r.model === modelFilter)
            ? e("option", { key: "custom-model", value: modelFilter }, modelFilter)
            : null
        )
      ),
      e("label", null,
        t("aiUsageAnalytics.filterStatus"),
        e("select", {
          value: statusFilter,
          onChange: (ev: { target: { value: string } }) => handleStatusFilterChange(ev.target.value),
          "data-testid": "filter-status",
        },
          e("option", { key: "all-status", value: "" }, t("aiUsageAnalytics.filterAll")),
          ...STATUS_OPTIONS.map((s) => e("option", { key: s, value: s }, s)),
          statusFilter && !STATUS_OPTIONS.includes(statusFilter as typeof STATUS_OPTIONS[number])
            ? e("option", { key: "custom-status", value: statusFilter }, statusFilter)
            : null
        )
      )
    ),

    !fetchLoading && e("div", { className: styles.chartWrap, "data-testid": "usage-chart" },
      chartData.length === 0
        ? e("p", { className: styles.empty }, t("aiUsageAnalytics.chartEmpty"))
        : e(ResponsiveContainer as React.ComponentType<{ width?: string | number; height?: string | number; children?: React.ReactNode }>, { width: "100%", height: "100%" },
            e(BarChart as React.ComponentType<{ data?: unknown; margin?: Record<string, number>; children?: React.ReactNode }>, { data: chartData, margin: { top: 8, right: 8, left: 0, bottom: 0 } },
              e(CartesianGrid as React.ComponentType<Record<string, unknown>>, { strokeDasharray: "3 3", stroke: "rgba(148,163,184,0.15)" }),
              e(XAxis as React.ComponentType<Record<string, unknown>>, { dataKey: "date", tick: { fontSize: 11, fill: "#94a3b8" }, axisLine: false, tickLine: false }),
              e(YAxis as React.ComponentType<Record<string, unknown>>, { tick: { fontSize: 11, fill: "#94a3b8" }, axisLine: false, tickLine: false }),
              e(Tooltip as React.ComponentType<Record<string, unknown>>, {
                contentStyle: {
                  background: "rgba(15,23,42,0.95)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 12,
                  fontSize: 12,
                  color: "#f1f5f9",
                },
                labelFormatter: (label: string) => `${t("aiUsageAnalytics.chartTitle")}: ${label}`,
              }),
              e(Bar as unknown as React.ComponentType<Record<string, unknown>>, { dataKey: "tokensIn", name: t("aiUsageAnalytics.chartTokensIn"), fill: "#12c7e8", radius: [4, 4, 0, 0] })
            )
          )
      ),

    !fetchLoading && e("div", null,
      records.length === 0
        ? e("p", { className: styles.empty }, t("aiUsageAnalytics.empty"))
        : e("div", { className: styles.tableWrap },
          e("table", { className: styles.table },
            e("thead", null,
              e("tr", null,
                ...TABLE_HEADER_KEYS.map((h, i) =>
                  e("th", { key: i, className: styles.th }, t(h))
                )
              )
            ),
            e("tbody", null,
              records.map((rec) =>
                e("tr", {
                  key: rec.id,
                  className: styles.tr,
                },
                  e("td", { className: styles.td }, new Date(rec.created_at).toLocaleString(localeTag)),
                  e("td", { className: styles.td }, rec.action),
                  e("td", { className: styles.td }, rec.provider),
                  e("td", { className: styles.td }, rec.model),
                  e("td", { className: styles.td }, formatNumber(rec.tokens_in, localeTag)),
                  e("td", { className: styles.td }, formatNumber(rec.tokens_out, localeTag)),
                  e("td", { className: styles.td }, `$${parseFloat(rec.cost || "0").toFixed(6)}`),
                  e("td", { className: styles.td }, `${rec.latency_ms}ms`),
                  e("td", { className: styles.td },
                    e("span", {
                      className: rec.status === "success" ? styles.statusSuccess : styles.statusError,
                    }, rec.status),
                  ),
                )
              ),
            ),
          ),
        ),
      ),
      e("div", { className: styles.tableFooter },
        e("span", null,
          t("aiUsageAnalytics.showing")
            .replace("{shown}", String(records.length))
            .replace("{total}", String(total))
        ),
        e("div", { style: { display: "flex", alignItems: "center", gap: 6 } },
          e("button", {
            key: "prev",
            className: `${styles.btn} ${styles.btnSm}`,
            onClick: () => setPage((p) => Math.max(1, p - 1)),
            disabled: page <= 1,
          }, t("aiUsageAnalytics.prev")),
          e("span", null, t("aiUsageAnalytics.pageOf").replace("{page}", String(page)).replace("{total}", String(totalPages))),
          e("button", {
            key: "next",
            className: `${styles.btn} ${styles.btnSm}`,
            onClick: () => setPage((p) => Math.min(totalPages, p + 1)),
            disabled: page >= totalPages,
          }, t("aiUsageAnalytics.next")),
        ),
        e("label", { style: { display: "flex", alignItems: "center", gap: 6 } },
          t("aiUsageAnalytics.perPage"),
          e("select", {
            className: styles.select,
            value: pageSize,
            onChange: (ev: { target: { value: string } }) => handlePageSizeChange(Number(ev.target.value)),
          }, ...PAGE_SIZES.map((s) => e("option", { key: s, value: s }, `${s}`))),
        ),
      ),
    );
}