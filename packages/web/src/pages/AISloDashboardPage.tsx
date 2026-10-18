/**
 * R3.3 — Dashboard SLO LLM: p50/p95/p99, success rate, token/ngày, $/ngày theo model.
 *
 * AC2: không có số liệu ⇒ `—` (không `0%`) — đây là quyết định *hiển thị*, FE mới
 * là nơi quyết được `null` thành `—`. BE trả `null`, không trả `0`.
 * AC3: cột `$` chỉ hiện khi `pricing_complete`; thiếu bảng giá ⇒ hiện `—` chứ
 * không hiện `$0.00` (đọc nhầm thành "miễn phí").
 * AC5: range 7/30/90 ngày.
 * AC6: cache 60 s + **không** poll khi `document.hidden`.
 * AC4: màu chart đọc qua `chartToken()` của R1.6 — import lại, không khai báo bản
 * thứ hai (allowlist của `check-ai-cc` đang gắn vào bản gốc).
 */
import { useCallback, useEffect, useMemo, useRef, useState, type JSX } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { coreApiAdapter } from "../adapters/coreApiAdapter.js";
import { useI18n } from "../context/LangContext.js";
import { useRetryableAsync } from "../hooks/useRetryableAsync.js";
import styles from "../components/aiSettings.module.css";
import { AiHubNav } from "../components/AiHubNav.tsx";
import { Breadcrumb } from "../components/Breadcrumb.js";
import { chartToken } from "../components/AIUsageDashboard.tsx";

const RANGES = [7, 30, 90] as const;
const CACHE_MS = 60_000;

interface SloRow {
  model: string;
  requests: number;
  success_rate: number | null;
  p50_latency_ms: number | null;
  p95_latency_ms: number | null;
  p99_latency_ms: number | null;
  tokens_total: number;
  tokens_per_day: number;
  cost_total: string | number | null;
  cost_per_day: string | number | null;
  pricing_complete: boolean;
}

interface SloPayload {
  results: SloRow[];
  days: number;
  requests_total: number;
}

/** `null` ⇒ `—`. Không bao giờ ép về `0` — AC2. */
function dash(value: number | string | null | undefined): string | number {
  if (value === null || value === undefined || value === "") return "—";
  return value;
}

export function AISloDashboardPage(): JSX.Element {
  const { t } = useI18n();
  const [days, setDays] = useState<number>(30);
  const lastFetchRef = useRef(0);

  const load = useCallback(
    async () =>
      (await coreApiAdapter.getAIUsageSlo({ days })) as SloPayload,
    [days],
  );

  const { data, loading, error, execute, retry } = useRetryableAsync(load);

  // AC6: cache 60 s + bỏ qua lúc tab ẩn. Gọi `execute()` trực tiếp — bản đầu dùng
  // state `tick` để "ép" chạy lại, nhưng `load` không đọc `tick` nên đó là hack
  // (và eslint bắt đúng: dependency thừa). `execute` tự hủy lượt cũ.
  useEffect(() => {
    void execute();
    lastFetchRef.current = Date.now();
  }, [execute]);

  useEffect(() => {
    if (typeof window === "undefined" || typeof setInterval === "undefined") return;
    const timer = setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) return;
      if (Date.now() - lastFetchRef.current < CACHE_MS) return;
      lastFetchRef.current = Date.now();
      void execute();
    }, CACHE_MS);
    return () => clearInterval(timer);
  }, [execute]);

  // `?? []` tạo mảng mới mỗi render ⇒ useMemo phía dưới sẽ đổi identity vô ích.
  const rows = useMemo(() => data?.results ?? [], [data]);

  const chartData = useMemo(
    () =>
      rows.map((row) => ({
        model: row.model || "—",
        p95: row.p95_latency_ms ?? 0,
        tokensPerDay: row.tokens_per_day ?? 0,
      })),
    [rows],
  );

  const accent = chartToken("--ai-accent");
  const muted = chartToken("--ai-muted");
  const grid = chartToken("--ai-border");
  const surface = chartToken("--ai-surface");
  const ink = chartToken("--ai-ink");

  const body = () => {
    if (loading && !data) {
      return (
        <div className={styles.loading} data-testid="slo-loading" aria-busy="true">
          {t("aiCommandCenter.sloLoading")}
        </div>
      );
    }
    if (error) {
      return (
        <div className={styles.alertError} data-testid="slo-error" role="alert">
          <p>{t("aiCommandCenter.loadTracesFailed")}</p>
          <button type="button" onClick={() => void retry()} data-testid="slo-retry">
            {t("aiCommandCenter.retryTraces")}
          </button>
        </div>
      );
    }
    if (!rows.length) {
      // AC2 — "chưa có dữ liệu", KHÔNG hiện bảng toàn 0%.
      return <p className={styles.empty} data-testid="slo-empty">{t("aiCommandCenter.sloEmpty")}</p>;
    }
    return (
      <div className={styles.tableWrap}>
        <table className={styles.table} data-testid="slo-table">
          <thead>
            <tr>
              <th className={styles.th}>{t("aiCommandCenter.sloModel")}</th>
              <th className={styles.th}>{t("aiCommandCenter.sloRequests")}</th>
              <th className={styles.th}>{t("aiCommandCenter.sloSuccessRate")}</th>
              <th className={styles.th}>p50</th>
              <th className={styles.th}>p95</th>
              <th className={styles.th}>p99</th>
              <th className={styles.th}>{t("aiCommandCenter.sloTokensPerDay")}</th>
              <th className={styles.th}>{t("aiCommandCenter.sloCostPerDay")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.model} data-testid="slo-row">
                <td className={styles.td}>{row.model || "—"}</td>
                <td className={styles.td}>{row.requests}</td>
                {/* AC2: `null` → `—`, không phải `0%`. */}
                <td className={styles.td} data-testid="slo-success-rate">
                  {dash(row.success_rate === null ? null : `${row.success_rate * 100}%`)}
                </td>
                <td className={styles.td}>{dash(row.p50_latency_ms)}</td>
                <td className={styles.td}>{dash(row.p95_latency_ms)}</td>
                <td className={styles.td}>{dash(row.p99_latency_ms)}</td>
                <td className={styles.td}>{dash(row.tokens_per_day)}</td>
                {/* AC3: không có bảng giá ⇒ `—`, không phải `$0.00`. */}
                <td className={styles.td} data-testid="slo-cost">
                  {row.pricing_complete ? `$${dash(row.cost_per_day)}` : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className={styles.chartWrap} data-testid="slo-chart">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData}>
              <CartesianGrid stroke={grid} />
              <XAxis dataKey="model" stroke={muted} />
              <YAxis stroke={muted} unit=" ms" />
              <Tooltip
                contentStyle={{ background: surface, border: `1px solid ${grid}`, color: ink }}
              />
              <Bar dataKey="p95" fill={accent} name="p95" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  };

  return (
<div className={styles.page} data-testid="ai-slo-page">
        {/* R4.4 AC2: breadcrumb 3 mức /settings -> /settings/ai -> tab con. */}
        <Breadcrumb />
        <h1>{t("aiCommandCenter.titleSlo")}</h1>
      <p>{t("aiCommandCenter.descriptionSlo")}</p>
      <AiHubNav />
      <div className={styles.filterBar} role="group" aria-label={t("aiCommandCenter.sloRange")}>
        {RANGES.map((value) => (
          <button
            key={value}
            type="button"
            className={value === days ? styles.btnActive : styles.btn}
            aria-pressed={value === days}
            onClick={() => setDays(value)}
            data-testid={`slo-range-${value}`}
          >
            {t("aiCommandCenter.sloRangeDays", { days: value })}
          </button>
        ))}
      </div>
      {body()}
      <p className={styles.helpText}>
        {t("aiCommandCenter.sloPricingNotice")}
      </p>
    </div>
  );
}

export default AISloDashboardPage;