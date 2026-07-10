import { useState, useEffect, useCallback, createElement } from "react";
import { coreApiAdapter } from "../adapters/coreApiAdapter.js";
import { useI18n } from "../context/LangContext.js";

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

export function AIUsageDashboard({ className = "" }: AIUsageDashboardProps) {
  useI18n();
  const [days, setDays] = useState("7");
  const [aggregate, setAggregate] = useState<AggregateData | null>(null);
  const [records, setRecords] = useState<UsageRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const usageClient = coreApiAdapter as unknown as {
    getAIUsageAggregate: (p: Record<string, string>) => Promise<AggregateData>;
    getAIUsageRecords: (p: Record<string, string>) => Promise<{ results: UsageRecord[]; total: number }>;
  };

  const loadData = useCallback(() => {
    setLoading(true);
    setError("");
    const params = { days };
    Promise.all([
      usageClient.getAIUsageAggregate(params),
      usageClient.getAIUsageRecords({ ...params, limit: "20", offset: "0" }),
    ])
      .then(([agg, rec]) => {
        setAggregate(agg);
        setRecords(rec.results || []);
        setTotal(rec.total);
      })
      .catch(() => setError("Không thể tải usage data."))
      .finally(() => setLoading(false));
  }, [days, usageClient]);

  useEffect(() => { loadData(); }, [loadData]);

  const summaryCards = [
    { label: "Tổng yêu cầu", value: aggregate?.total_requests?.toLocaleString() || "0", key: "requests" },
    { label: "Tổng token", value: ((aggregate?.total_tokens_in || 0) + (aggregate?.total_tokens_out || 0)).toLocaleString(), key: "tokens" },
    { label: "Tổng chi phí", value: `$${parseFloat(aggregate?.total_cost || "0").toFixed(4)}`, key: "cost" },
    { label: "Độ trễ TB", value: aggregate?.avg_latency ? `${Math.round(aggregate.avg_latency)}ms` : "0ms", key: "latency" },
  ];

  return e("div", { className: `ai-usage-dashboard ${className}` },
    e("div", { className: "core-page-section-header" },
      e("h2", null, "Usage AI Analytics"),
      e("p", null, "Theo dõi mức sử dụng, chi phí và hiệu năng của các dịch vụ AI."),
      e("div", { className: "core-page-period-selector" },
        ...PERIODS.map((p) =>
          e("button", {
            key: p.value,
            className: `core-btn core-btn--small ${days === p.value ? "core-btn--primary" : "core-btn--secondary"}`,
            onClick: () => setDays(p.value),
            style: { marginRight: 4 },
          }, p.label)
        ),
        e("button", {
          className: "core-btn core-btn--small core-btn--secondary",
          onClick: loadData,
          disabled: loading,
          style: { marginLeft: 8 },
        }, "Làm mới"),
      ),
    ),

    error && e("div", { className: "core-page-error", role: "alert" }, error),

    loading && e("p", { className: "core-page-loading" }, "Đang tải usage data..."),

    !loading && e("div", { className: "core-page-summary-grid", style: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 } },
      ...summaryCards.map((card) =>
        e("div", {
          key: card.key,
          className: "core-page-summary-card",
          style: { background: "var(--shell-surface, #1e293b)", borderRadius: 8, padding: "16px 20px" },
        },
          e("div", { style: { fontSize: 13, color: "var(--shell-muted, #94a3b8)", marginBottom: 4 } }, card.label),
          e("div", { style: { fontSize: 24, fontWeight: 700 } }, card.value),
        ),
      ),
    ),

    !loading && e("div", null,
      e("h3", { style: { marginBottom: 8 } }, "Bản ghi usage"),
      records.length === 0 && e("p", null, "Chưa có bản ghi usage nào."),
      records.length > 0 && e("div", { className: "core-page-table-wrap" },
        e("table", { className: "core-page-table" },
          e("thead", null,
            e("tr", null,
              e("th", null, "Thời gian"),
              e("th", null, "Hành động"),
              e("th", null, "Provider"),
              e("th", null, "Model"),
              e("th", null, "Token vào"),
              e("th", null, "Token ra"),
              e("th", null, "Chi phí"),
              e("th", null, "Độ trễ"),
              e("th", null, "Trạng thái"),
            ),
          ),
          e("tbody", null, ...records.map((rec) =>
            e("tr", { key: rec.id },
              e("td", null, new Date(rec.created_at).toLocaleString("vi-VN")),
              e("td", null, rec.action),
              e("td", null, rec.provider),
              e("td", null, rec.model),
              e("td", null, rec.tokens_in.toLocaleString()),
              e("td", null, rec.tokens_out.toLocaleString()),
              e("td", null, `$${parseFloat(rec.cost || "0").toFixed(6)}`),
              e("td", null, `${rec.latency_ms}ms`),
              e("td", null,
                e("span", {
                  style: { color: rec.status === "success" ? "var(--color-success, #22c55e)" : "var(--color-danger, #ef4444)" },
                }, rec.status),
              ),
            ),
          )),
        ),
        total > 20 && e("p", { style: { marginTop: 8, fontSize: 13, color: "var(--shell-muted, #94a3b8)" } },
          `Hiển thị 20 / ${total} bản ghi.`,
        ),
      ),
    ),
  );
}
