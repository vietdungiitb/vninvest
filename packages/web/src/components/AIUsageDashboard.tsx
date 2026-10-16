import { formatNumber, formatDateTime, formatCurrency } from "../i18n";
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
import { useUrlState, intCodec, stringCodec, type UrlStateCodec } from "../hooks/useUrlState";

const e = createElement;

/**
 * R1.6: màu chart đọc từ token --ai-* qua computed style (attribute SVG không
 * hiểu var()). Fallback là hằng số cũ — allowlist tường minh cho gate check-ai-cc
 * (CHART_TOKEN_FALLBACK). jsdom trả rỗng ⇒ fallback, test không vỡ.
 */
const CHART_TOKEN_FALLBACK: Record<string, string> = {
  "--ai-border": "rgba(148,163,184,0.15)",
  "--ai-muted": "#94a3b8",
  "--ai-surface": "rgba(15,23,42,0.95)",
  "--ai-ink": "#f1f5f9",
  "--ai-accent": "#12c7e8",
};
export function chartToken(name: string): string {
  try {
    if (typeof document === "undefined" || typeof getComputedStyle === "undefined") {
      return CHART_TOKEN_FALLBACK[name] ?? "";
    }
    return (
      getComputedStyle(document.documentElement).getPropertyValue(name).trim() ||
      CHART_TOKEN_FALLBACK[name] ||
      ""
    );
  } catch {
    return CHART_TOKEN_FALLBACK[name] ?? "";
  }
}

/** R1.6 AC4: union thay ternary inline cho màu trạng thái. */
const STATUS_TONE: Record<string, "statusSuccess" | "statusError" | "statusDefault"> = {
  success: "statusSuccess",
  error: "statusError",
};

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
const DEFAULT_PAGE_SIZE = 20;

type UsageUrlState = {
  page: number; pageSize: number; modelFilter: string; statusFilter: string;
};

/**
 * Gia tri mac dinh ⇒ `serialize` tra `undefined` ⇒ `?page=1` / `?pageSize=20`
 * KHONG duoc ghi (link copy ra khong dinh tham so thua).
 *
 * ⚠ `parse` cung phai tra `undefined` cho gia tri mac dinh, khong tra chinh no —
 * cung nguyen tac voi `boolCodec` (`useUrlState.ts:80-90`): `parse` tra gia tri
 * ≠ `undefined` thi hook dung gia tri do THAY cho `fallback`.
 *
 * Vì sao khong dung `intCodec` thang: `intCodec.serialize(1)` = `"1"` ⇒ doi
 * filter se de lai `?page=1` ben canh gia tri filter.
 */
const pageCodec: UrlStateCodec<number> = {
  parse: (raw) => {
    const n = intCodec.parse(raw);
    return n === undefined || n < 1 ? undefined : n;
  },
  serialize: (v) => (v === 1 ? undefined : intCodec.serialize(v)),
};

/**
 * `pageSize` chi chap nhan gia tri co that trong `PAGE_SIZES` — URL do nguoi
 * sua tay (`?pageSize=9999`) khong duoc bien thanh `limit=9999` gui len BE.
 */
const pageSizeCodec: UrlStateCodec<number> = {
  parse: (raw) => {
    const n = intCodec.parse(raw);
    return n !== undefined && (PAGE_SIZES as number[]).includes(n) ? n : undefined;
  },
  serialize: (v) => (v === DEFAULT_PAGE_SIZE ? undefined : intCodec.serialize(v)),
};

// WAVE 10 / NAV-1 — `spec` + `defaults` khai o CAP MODULE de identity on dinh
// giua cac lan render. Truoc day truyen object literal trong render lam
// `useMemo([params, spec, defaults])` (useUrlState.ts:150) luon tinh lai.
const USAGE_URL_SPEC: { [K in keyof UsageUrlState]: UrlStateCodec<UsageUrlState[K]> } = {
  page: pageCodec,
  pageSize: pageSizeCodec,
  modelFilter: stringCodec,
  statusFilter: stringCodec,
};
const USAGE_URL_DEFAULTS: UsageUrlState = {
  page: 1, pageSize: DEFAULT_PAGE_SIZE, modelFilter: '', statusFilter: '',
};

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
    formatDateTime(rec.created_at, localeTag),
    rec.action,
    rec.provider,
    rec.model,
    rec.tokens_in,
    rec.tokens_out,
    formatCurrency(rec.cost ?? 0, localeTag, "USD", { minimumFractionDigits: 4, maximumFractionDigits: 4 }),
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
  const { t, localeTag, formatCurrency } = useI18n();
  const [days, setDays] = useState("7");
  // WAVE 10 / NAV-1: phan trang + kich thuoc trang + 2 bo loc nam trong RAM nen
  // gui link cho nguoi khac thi ho thay man hinh CHUA loc. `useUrlState` (patch)
  // de MOT lan doi bo loc + ve trang 1 chi tao MOT history entry.
  const [{ page, pageSize, modelFilter, statusFilter }, setUrlState] = useUrlState(
    USAGE_URL_SPEC,
    USAGE_URL_DEFAULTS,
  );
  const setPage = useCallback((v: number) => setUrlState({ page: v }), [setUrlState]);
  const [exporting, setExporting] = useState(false);

  // R1.6 AC6: USD 1 chỗ tròn số duy nhất — 4 chữ số thập phân.
  const usd4 = (value: unknown): string =>
    formatCurrency(Number(value ?? 0), "USD", { minimumFractionDigits: 4, maximumFractionDigits: 4 });

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
      // R1.5 AC6: summary cũng nhận đủ filter (model/status) để biểu đồ đổi theo.
      usageClient.getAIUsageSummary({ ...params }),
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

  // ⚠ 3 handler duoi day ghep "doi gia tri" + "ve trang 1" vao MOT patch.
  // Goi 2 lan `setUrlState` trong cung mot tick KHONG compose — lan hai doc
  // `prev` cu va ghi de ket qua lan mot (`useUrlState.ts:161-165`).
  const handlePageSizeChange = (value: number) => {
    setUrlState({ pageSize: value, page: 1 });
  };

  const handleModelFilterChange = (value: string) => {
    setUrlState({ modelFilter: value, page: 1 });
  };

  const handleStatusFilterChange = (value: string) => {
    setUrlState({ statusFilter: value, page: 1 });
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
    { label: t("aiUsageAnalytics.totalCost"), value: usd4(aggregate?.total_cost), key: "cost" },
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

    !fetchLoading && e("div", { className: styles.chartWrap, "data-testid": "usage-chart", "aria-hidden": true },
      chartData.length === 0
        ? e("p", { className: styles.empty }, t("aiUsageAnalytics.chartEmpty"))
        : e(ResponsiveContainer as React.ComponentType<{ width?: string | number; height?: string | number; children?: React.ReactNode }>, { width: "100%", height: "100%" },
            e(BarChart as React.ComponentType<{ data?: unknown; margin?: Record<string, number>; children?: React.ReactNode }>, { data: chartData, margin: { top: 8, right: 8, left: 0, bottom: 0 } },
              e(CartesianGrid as React.ComponentType<Record<string, unknown>>, { strokeDasharray: "3 3", stroke: chartToken("--ai-border") }),
              e(XAxis as React.ComponentType<Record<string, unknown>>, { dataKey: "date", tick: { fontSize: 11, fill: chartToken("--ai-muted") }, axisLine: false, tickLine: false }),
              e(YAxis as React.ComponentType<Record<string, unknown>>, { tick: { fontSize: 11, fill: chartToken("--ai-muted") }, axisLine: false, tickLine: false }),
              e(Tooltip as React.ComponentType<Record<string, unknown>>, {
                contentStyle: {
                  background: "var(--ai-surface)",
                  border: "1px solid var(--ai-border)",
                  borderRadius: 12,
                  fontSize: 12,
                  color: "var(--ai-ink)",
                },
                labelFormatter: (label: string) => `${t("aiUsageAnalytics.chartTitle")}: ${label}`,
              }),
              e(Bar as unknown as React.ComponentType<Record<string, unknown>>, { dataKey: "tokensIn", name: t("aiUsageAnalytics.chartTokensIn"), fill: chartToken("--ai-accent"), radius: [4, 4, 0, 0] })
            )
          )
      ),

    // R1.6 AC3: bảng số thay thế cho chart (screen reader) — cùng số liệu chartData.
    !fetchLoading && chartData.length > 0
      ? e("table", { key: "chart-data-table", className: styles.srOnly },
          e("tbody", null,
            chartData.map((row) =>
              e("tr", { key: row.date },
                e("td", null, row.date),
                e("td", null, String(row.tokensIn))
              )
            )
          )
        )
      : null,

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
                  e("td", { className: styles.td }, formatDateTime(rec.created_at, localeTag)),
                  e("td", { className: styles.td }, rec.action),
                  e("td", { className: styles.td }, rec.provider),
                  e("td", { className: styles.td }, rec.model),
                  e("td", { className: styles.td }, formatNumber(rec.tokens_in, localeTag)),
                  e("td", { className: styles.td }, formatNumber(rec.tokens_out, localeTag)),
                  e("td", { className: styles.td }, usd4(rec.cost)),
                  e("td", { className: styles.td }, `${rec.latency_ms}ms`),
                  e("td", { className: styles.td },
                    e("span", {
                      className: styles[STATUS_TONE[rec.status] ?? "statusDefault"],
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
            // WAVE 10 / NAV-1: setter cua `useUrlState` nhan **gia tri**, khong
            // phai updater lambda ⇒ doc `page` tu state thay vi `p`.
            onClick: () => setPage(Math.max(1, page - 1)),
            disabled: page <= 1,
          }, t("aiUsageAnalytics.prev")),
          e("span", null, t("aiUsageAnalytics.pageOf").replace("{page}", String(page)).replace("{total}", String(totalPages))),
          e("button", {
            key: "next",
            className: `${styles.btn} ${styles.btnSm}`,
            onClick: () => setPage(Math.min(totalPages, page + 1)),
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