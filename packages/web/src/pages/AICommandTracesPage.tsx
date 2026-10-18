/**
 * R3.2 — Trang "Traces" cạnh Usage.
 *
 * AC1 route (khai ở `main.tsx` + `routeCatalog.js`) · AC2 waterfall 4 bước có
 * latency từng bước + tổng · AC3 click 1 bước xem metadata (**không** plaintext)
 * · AC4 filter + phân trang · AC5 empty state trung thực · AC7 skeleton + nút
 * "Thử lại".
 *
 * R3.1 chỉ lưu SHA-256 (PIPL 13/2023) nên trang này **không** có gì để hiện nội
 * dung prompt — hiện hash + routing. Đừng thêm ô "xem prompt": dữ liệu đó không tồn tại.
 */
import { useCallback, useEffect, useMemo, useState, type JSX } from "react";
import { coreApiAdapter } from "../adapters/coreApiAdapter.js";
import { useI18n } from "../context/LangContext.js";
import { useRetryableAsync } from "../hooks/useRetryableAsync.js";
import styles from "../components/aiSettings.module.css";
import { AiHubNav } from "../components/AiHubNav.tsx";
import { Breadcrumb } from "../components/Breadcrumb.js";

interface AITraceRow {
  id: number;
  trace_id: string;
  symbol: string;
  session_date: string;
  step: string;
  provider: string;
  model: string;
  prompt_hash: string;
  response_hash: string;
  tokens_in: number;
  tokens_out: number;
  latency_ms: number;
  status: string;
  error_code: string;
  routing_decision: Record<string, unknown>;
  created_at: string;
}

interface TracesPayload {
  results: AITraceRow[];
  total: number;
  limit: number;
  offset: number;
}

/** Thứ tự 4 bước cố định — waterfall phải đọc trái→phải theo luồng thật. */
const STEP_ORDER = ["technical", "flow", "sentiment", "synthesis"] as const;
const PAGE_SIZE = 20;

const STEP_KEY: Record<string, string> = {
  technical: "aiCommandCenter.stepTechnical",
  flow: "aiCommandCenter.stepFlow",
  sentiment: "aiCommandCenter.stepSentiment",
  synthesis: "aiCommandCenter.stepSynthesis",
};

const STATUS_KEY: Record<string, string> = {
  ok: "aiCommandCenter.statusOk",
  error: "aiCommandCenter.statusError",
};

interface TraceGroup {
  traceId: string;
  symbol: string;
  createdAt: string;
  rows: AITraceRow[];
  totalLatency: number;
}

function groupByTrace(rows: AITraceRow[]): TraceGroup[] {
  const map = new Map<string, TraceGroup>();
  for (const row of rows) {
    let group = map.get(row.trace_id);
    if (!group) {
      group = {
        traceId: row.trace_id,
        symbol: row.symbol,
        createdAt: row.created_at,
        rows: [],
        totalLatency: 0,
      };
      map.set(row.trace_id, group);
    }
    group.rows.push(row);
    group.totalLatency += row.latency_ms || 0;
    if (!group.symbol && row.symbol) group.symbol = row.symbol;
  }
  for (const group of map.values()) {
    group.rows.sort(
      (a, b) =>
        STEP_ORDER.indexOf(a.step as never) - STEP_ORDER.indexOf(b.step as never),
    );
  }
  return [...map.values()];
}

export function AICommandTracesPage(): JSX.Element {
  const { t } = useI18n();
  const [symbol, setSymbol] = useState("");
  const [model, setModel] = useState("");
  const [status, setStatus] = useState("");
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);

  const load = useCallback(
    async () =>
      (await coreApiAdapter.getAITraces({
        symbol,
        model,
        status,
        limit: PAGE_SIZE,
        offset,
      })) as TracesPayload,
    [symbol, model, status, offset],
  );

  // `useRetryableAsync` KHÔNG tự chạy — phải gọi `execute()` (mẫu của
  // `AIUsageDashboard.tsx:237`). Thiếu dòng này thì API không bao giờ được gọi và
  // trang rơi thẳng vào empty state — "chạy" nhưng không tải gì.
  const { data, loading, error, execute, retry } = useRetryableAsync(load);
  useEffect(() => {
    void execute();
  }, [execute]);

  const groups = useMemo(() => groupByTrace(data?.results ?? []), [data]);
  const total = data?.total ?? 0;
  const page = Math.floor(offset / PAGE_SIZE) + 1;
  const maxPage = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Đổi filter ⇒ về trang 1, nếu không sẽ kẹt ở offset không còn dòng nào.
  const applyFilter = (setter: (v: string) => void) => (value: string) => {
    setter(value);
    setOffset(0);
  };

  const filters = (
    <div className={styles.filterBar} data-testid="traces-filters">
      <label className={styles.auditFieldLabel}>
        <span>{t("aiCommandCenter.filterSymbol")}</span>
        <input
          className={styles.input}
          value={symbol}
          onChange={(ev) => applyFilter(setSymbol)(ev.target.value)}
          data-testid="filter-symbol"
        />
      </label>
      <label className={styles.auditFieldLabel}>
        <span>{t("aiCommandCenter.filterModel")}</span>
        <input
          className={styles.input}
          value={model}
          onChange={(ev) => applyFilter(setModel)(ev.target.value)}
          data-testid="filter-model"
        />
      </label>
      <label className={styles.auditFieldLabel}>
        <span>{t("aiCommandCenter.filterStatus")}</span>
        <select
          className={styles.select}
          value={status}
          onChange={(ev) => applyFilter(setStatus)(ev.target.value)}
          data-testid="filter-status"
        >
          <option value="">{t("aiCommandCenter.filterAll")}</option>
          <option value="ok">{t("aiCommandCenter.statusOk")}</option>
          <option value="error">{t("aiCommandCenter.statusError")}</option>
        </select>
      </label>
    </div>
  );

  const body = () => {
    if (loading) {
      return (
        <div className={styles.loading} data-testid="traces-loading" aria-busy="true">
          {t("aiCommandCenter.loadingTraces")}
        </div>
      );
    }
    if (error) {
      return (
        <div className={styles.alertError} data-testid="traces-error" role="alert">
          <p>{t("aiCommandCenter.loadTracesFailed")}</p>
          <button type="button" onClick={() => void retry()} data-testid="traces-retry">
            {t("aiCommandCenter.retryTraces")}
          </button>
        </div>
      );
    }
    if (!groups.length) {
      // AC5: nói thẳng chưa có gì + gợi ý hành động, KHÔNG hiện bảng rỗng.
      return (
        <p className={styles.empty} data-testid="traces-empty">{t("aiCommandCenter.emptyTraces")}</p>
      );
    }
    return (
      <>
        <p className={styles.helpText}>{t("aiCommandCenter.noPlaintextNotice")}</p>
        <ul data-testid="traces-list">
          {groups.map((group) => (
            <li key={group.traceId} data-testid="trace-group" className={styles.sourceCard}>
              <header>
                <strong>{group.symbol}</strong>{" "}
                <span data-testid="trace-created-at">{group.createdAt}</span>{" "}
                <span data-testid="trace-total-latency">
                  {t("aiCommandCenter.latencyTotal", {
                    ms: group.totalLatency,
                  })}
                </span>
              </header>
              <ol data-testid="trace-waterfall">
                {group.rows.map((row) => (
                  <li key={`${group.traceId}-${row.step}`} data-testid="trace-step">
                    <span>{t(STEP_KEY[row.step] ?? row.step)}</span>{" "}
                    <span data-testid="step-latency">
                      {t("aiCommandCenter.latencyMs", { ms: row.latency_ms })}
                    </span>{" "}
                    <span data-testid="step-status">{t(STATUS_KEY[row.status] ?? row.status)}</span>{" "}
                    <button
                      type="button"
                      onClick={() => setSelected(row.trace_id + ":" + row.step)}
                      data-testid="step-details"
                    >
                      {t("aiCommandCenter.detailsLabel")}
                    </button>
                    {selected === row.trace_id + ":" + row.step ? (
                      <dl data-testid="trace-metadata">
                        <dt>{t("aiCommandCenter.traceIdLabel")}</dt>
                        <dd>{row.trace_id}</dd>
                        <dt>{t("aiCommandCenter.promptHashLabel")}</dt>
                        <dd>{row.prompt_hash}</dd>
                        <dt>{t("aiCommandCenter.responseHashLabel")}</dt>
                        <dd>{row.response_hash}</dd>
                        <dt>{t("aiCommandCenter.tokensLabel")}</dt>
                        <dd>{`${row.tokens_in}/${row.tokens_out}`}</dd>
                        {row.error_code ? (
                          <>
                            <dt>error</dt>
                            <dd className={styles.statusError} data-testid="trace-error-code">{row.error_code}</dd>
                          </>
                        ) : null}
                      </dl>
                    ) : null}
                  </li>
                ))}
              </ol>
            </li>
          ))}
        </ul>
      </>
    );
  };

  return (
<div className={styles.page} data-testid="ai-traces-page">
        {/* R4.4 AC2: breadcrumb 3 mức /settings -> /settings/ai -> tab con. */}
        <Breadcrumb />
        <h1>{t("aiCommandCenter.titleTraces")}</h1>
      <p>{t("aiCommandCenter.descriptionTraces")}</p>
      <AiHubNav />
      {filters}
      {body()}
      {!loading && !error && groups.length ? (
        <nav className={styles.auditPager} data-testid="traces-pagination" aria-label={t("aiCommandCenter.pageInfo", { page, total })}>
          <button
            type="button"
            disabled={offset === 0}
            onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
            data-testid="traces-prev"
          >
            ‹
          </button>
          <span data-testid="traces-page-info">
            {t("aiCommandCenter.pageInfo", { page, total })}
          </span>
          <button
            type="button"
            disabled={page >= maxPage}
            onClick={() => setOffset(offset + PAGE_SIZE)}
            data-testid="traces-next"
          >
            ›
          </button>
        </nav>
      ) : null}
    </div>
  );
}

export default AICommandTracesPage;