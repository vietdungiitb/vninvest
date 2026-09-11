import { useState, useEffect, useCallback, createElement } from "react";
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

interface AIUsageDashboardProps {
  className?: string;
}

const PERIODS = [
  { value: "7", label: "7 ngày" },
  { value: "30", label: "30 ngày" },
  { value: "90", label: "90 ngày" },
];

const PAGE_SIZES = [20, 50, 100];

const CSV_HEADERS = [
  "Thời gian", "Hành động", "Provider", "Model",
  "Token vào", "Token ra", "Chi phí", "Độ trễ", "Trạng thái",
];

function toCsv(records: UsageRecord[]): string {
  const escape = (val: string | number) => {
    const s = String(val);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const rows = records.map((rec) => [
    new Date(rec.created_at).toLocaleString("vi-VN"),
    rec.action,
    rec.provider,
    rec.model,
    rec.tokens_in,
    rec.tokens_out,
    `$${parseFloat(rec.cost || "0").toFixed(6)}`,
    `${rec.latency_ms}ms`,
    rec.status,
  ].map(escape).join(","));
  return "﻿" + CSV_HEADERS.join(",") + "\n" + rows.join("\n");
}

export function AIUsageDashboard({ className = "" }: AIUsageDashboardProps) {
  const { t } = useI18n();
  const [days, setDays] = useState("7");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [exporting, setExporting] = useState(false);

  const usageClient = coreApiAdapter as unknown as {
    getAIUsageAggregate: (p: Record<string, string>) => Promise<AggregateData>;
    getAIUsageRecords: (p: Record<string, string>) => Promise<{ results: UsageRecord[]; total: number }>;
  };

  const fetchData = useCallback(async () => {
    const params = { days };
    const limit = String(pageSize);
    const offset = String((page - 1) * pageSize);
    const [agg, rec] = await Promise.all([
      usageClient.getAIUsageAggregate(params),
      usageClient.getAIUsageRecords({ ...params, limit, offset }),
    ]);
    return { agg, rec };
  }, [days, page, pageSize, usageClient]);

  const { data, loading: fetchLoading, error: fetchError, execute: loadData, retry: retryLoadData } = useRetryableAsync(fetchData, 2);

  const aggregate = data?.agg ?? null;
  const records = data?.rec?.results ?? [];
  const total = data?.rec?.total ?? 0;
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

  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      const all: UsageRecord[] = [];
      let offset = 0;
      const batch = 100;
      for (;;) {
        const res = await usageClient.getAIUsageRecords({ days, limit: String(batch), offset: String(offset) });
        const results = res.results || [];
        all.push(...results);
        if (results.length < batch) break;
        offset += batch;
      }
      const csv = toCsv(all);
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
  }, [days, usageClient]);

  const summaryCards = [
    { label: t("usage.requests") || "Tổng yêu cầu", value: aggregate?.total_requests?.toLocaleString() || "0", key: "requests" },
    { label: t("usage.tokens") || "Tổng token", value: ((aggregate?.total_tokens_in || 0) + (aggregate?.total_tokens_out || 0)).toLocaleString(), key: "tokens" },
    { label: t("usage.cost") || "Tổng chi phí", value: `$${parseFloat(aggregate?.total_cost || "0").toFixed(4)}`, key: "cost" },
    { label: t("usage.latency") || "Độ trễ TB", value: aggregate?.avg_latency ? `${Math.round(aggregate.avg_latency)}ms` : "0ms", key: "latency" },
  ];

  return e("div", { className: styles.panel + " " + className },
    e("div", { className: styles.panelHeader },
      e("div", null,
        e("h2", { className: styles.panelTitle }, t("usage.title") || "Usage AI Analytics"),
        e("p", { className: styles.panelSubtitle }, t("usage.description") || "Theo dõi mức sử dụng, chi phí và hiệu năng của các dịch vụ AI."),
      ),
      e("div", { className: styles.toolbar },
        ...PERIODS.map((p) =>
          e("button", {
            key: p.value,
            className: `${styles.btn} ${styles.btnSm} ${days === p.value ? styles.btnActive : ""}`,
            onClick: () => handlePeriodChange(p.value),
          }, p.label)
        ),
        e("button", {
          className: `${styles.btn} ${styles.btnSm}`,
          onClick: () => { loadData(); retryLoadData(); },
          disabled: fetchLoading,
        }, t("usage.refresh") || "Làm mới"),
        e("button", {
          key: "export-csv",
          className: `${styles.btn} ${styles.btnSm}`,
          onClick: handleExport,
          disabled: exporting || fetchLoading,
        }, exporting ? (t("usage.exporting") || "Đang xuất...") : (t("usage.exportCsv") || "Xuất CSV")),
      ),
    ),

    fetchError && e("div", { className: styles.alert + " " + styles.alertError, role: "alert" }, fetchError),

    fetchLoading && e("p", { className: styles.loading }, t("usage.loading") || "Đang tải usage data..."),

    !fetchLoading && e("div", { className: styles.metricGrid, style: { marginBottom: 24 } },
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

    !fetchLoading && e("div", null,
      records.length === 0
        ? e("p", { className: styles.empty }, t("usage.empty") || "Chưa có dữ liệu sử dụng trong khoảng thời gian này.")
        : e("div", { className: styles.tableWrap },
          e("table", { className: styles.table },
            e("thead",
              e("tr", null,
                ...["Thời gian", "Hành động", "Provider", "Model", "Token vào", "Token ra", "Chi phí", "Độ trễ", "Trạng thái"].map((h, i) =>
                  e("th", { key: i, className: styles.th }, h)
                )
              )
            ),
            e("tbody", null,
              records.map((rec) =>
                e("tr", {
                  key: rec.id,
                  className: styles.tr,
                },
                  e("td", { className: styles.td }, new Date(rec.created_at).toLocaleString("vi-VN")),
                  e("td", { className: styles.td }, rec.action),
                  e("td", { className: styles.td }, rec.provider),
                  e("td", { className: styles.td }, rec.model),
                  e("td", { className: styles.td }, rec.tokens_in.toLocaleString()),
                  e("td", { className: styles.td }, rec.tokens_out.toLocaleString()),
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
          (t("usage.showing") || "Hiển thị {shown} / {total} bản ghi.")
            .replace("{shown}", String(records.length))
            .replace("{total}", String(total))
        ),
        e("div", { style: { display: "flex", alignItems: "center", gap: 6 } },
          e("button", {
            key: "prev",
            className: `${styles.btn} ${styles.btnSm}`,
            onClick: () => setPage((p) => Math.max(1, p - 1)),
            disabled: page <= 1,
          }, "← Trước"),
          e("span", null, `Trang ${page} / ${totalPages}`),
          e("button", {
            key: "next",
            className: `${styles.btn} ${styles.btnSm}`,
            onClick: () => setPage((p) => Math.min(totalPages, p + 1)),
            disabled: page >= totalPages,
          }, "Sau →"),
        ),
        e("label", { style: { display: "flex", alignItems: "center", gap: 6 } },
          "Hiển thị:",
          e("select", {
            className: styles.select,
            value: pageSize,
            onChange: (ev: { target: { value: string } }) => handlePageSizeChange(Number(ev.target.value)),
          }, ...PAGE_SIZES.map((s) => e("option", { key: s, value: s }, `${s}`))),
        ),
      ),
    );
}