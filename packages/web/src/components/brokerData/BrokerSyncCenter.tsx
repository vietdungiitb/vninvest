/**
 * mbw2-data B2.4 — Sync Center: lịch sử runs/issues + nút Đồng bộ.
 *
 * AC4: bấm Đồng bộ ⇒ POST sync trả 202 + `job_id` ⇒ poll `jobs/<id>/` tới
 * trạng thái cuối (succeeded/failed) ⇒ refetch `sync-runs/` để run mới hiện.
 * Unlinked ⇒ không poll, hiện thông báo (0 request thừa).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useI18n } from "../../context/LangContext";
import { defaultCoreApiAdapter } from "../../adapters/coreApiAdapter.js";
import "./brokerData.css";

export interface BrokerSyncRun {
  id: string | number;
  provider?: string;
  status?: string;
  started_at?: string | null;
  finished_at?: string | null;
  stats?: Record<string, unknown> | null;
  error?: string | null;
}

export interface BrokerSyncIssue {
  id: string | number;
  severity?: string;
  code?: string;
  payload?: Record<string, unknown> | null;
  resolved?: boolean;
  created_at?: string | null;
}

export interface BrokerSyncAdapter {
  syncBrokerAccount: (accountId: string | number) => Promise<{ job_id?: string; state?: string }>;
  getBrokerJob: (jobId: string) => Promise<{ job_id?: string; state?: string; error?: string }>;
  getBrokerSyncRuns: (params?: { limit?: number }) => Promise<BrokerSyncRun[]>;
  getBrokerSyncIssues: (params?: { resolved?: boolean; severity?: string }) => Promise<BrokerSyncIssue[]>;
}

/** Trạng thái cuối của job — poll dừng. Cấp module (L-F10). */
const TERMINAL_JOB_STATES: ReadonlySet<string> = new Set(["succeeded", "failed"]);
const MAX_POLL_ATTEMPTS = 60;

export function BrokerSyncCenter({
  adapter,
  accountId,
  pollIntervalMs = 1500,
}: {
  adapter?: BrokerSyncAdapter;
  accountId?: string | number | null;
  pollIntervalMs?: number;
}) {
  const { t } = useI18n();
  const api = (adapter ?? defaultCoreApiAdapter) as unknown as BrokerSyncAdapter;
  const [runs, setRuns] = useState<BrokerSyncRun[]>([]);
  const [issues, setIssues] = useState<BrokerSyncIssue[]>([]);
  const [syncPhase, setSyncPhase] = useState<"idle" | "syncing" | "done" | "error">("idle");
  const [syncMessage, setSyncMessage] = useState<string>("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    const [r, i] = await Promise.all([api.getBrokerSyncRuns({ limit: 20 }), api.getBrokerSyncIssues({})]);
    setRuns(Array.isArray(r) ? r : []);
    setIssues(Array.isArray(i) ? i : []);
  }, [api]);

  useEffect(() => {
    let cancelled = false;
    load().catch(() => {
      if (!cancelled) {
        setRuns([]);
        setIssues([]);
      }
    });
    return () => {
      cancelled = true;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [load]);

  const runSync = () => {
    if (accountId === null || accountId === undefined) return;
    setSyncPhase("syncing");
    setSyncMessage(t("brokerHub.data.sync.syncing", { defaultValue: "Đang đồng bộ…" }));
    api
      .syncBrokerAccount(accountId)
      .then((res) => {
        const jobId = res?.job_id;
        if (!jobId) throw new Error("missing_job_id");
        let attempts = 0;
        const poll = () => {
          attempts += 1;
          api
            .getBrokerJob(jobId)
            .then((job) => {
              const state = String(job?.state ?? "pending").toLowerCase();
              if (TERMINAL_JOB_STATES.has(state)) {
                if (state === "succeeded") {
                  setSyncPhase("done");
                  setSyncMessage(t("brokerHub.data.sync.succeeded", { defaultValue: "Đồng bộ xong." }));
                } else {
                  setSyncPhase("error");
                  setSyncMessage(
                    job?.error ?? t("brokerHub.data.sync.failed", { defaultValue: "Đồng bộ thất bại." }),
                  );
                }
                load().catch(() => undefined);
                return;
              }
              if (attempts >= MAX_POLL_ATTEMPTS) {
                setSyncPhase("error");
                setSyncMessage(
                  t("brokerHub.data.sync.pollTimeout", {
                    defaultValue: "Hết thời gian chờ đồng bộ. Kiểm tra lại lịch sử.",
                  }),
                );
                return;
              }
              timer.current = setTimeout(poll, pollIntervalMs);
            })
            .catch((err) => {
              const code = (err as { code?: string })?.code;
              if (code === "account_not_linked") {
                setSyncPhase("error");
                setSyncMessage(
                  t("brokerHub.data.sync.unlinkedBlocked", {
                    defaultValue: "Tiểu khoản chưa liên kết cấu hình broker nên không đồng bộ được.",
                  }),
                );
                return;
              }
              setSyncPhase("error");
              setSyncMessage(t("brokerHub.data.sync.failed", { defaultValue: "Đồng bộ thất bại." }));
            });
        };
        poll();
      })
      .catch((err) => {
        const code = (err as { code?: string })?.code;
        setSyncPhase("error");
        setSyncMessage(
          code === "account_not_linked"
            ? t("brokerHub.data.sync.unlinkedBlocked", {
                defaultValue: "Tiểu khoản chưa liên kết cấu hình broker nên không đồng bộ được.",
              })
            : t("brokerHub.data.sync.failed", { defaultValue: "Đồng bộ thất bại." }),
        );
      });
  };

  const runStatus = (s: unknown) => {
    const v = String(s ?? "").toLowerCase();
    if (v === "pending") return t("brokerHub.data.status.pending", { defaultValue: "Đang chờ" });
    if (v === "running" || v === "started") return t("brokerHub.data.status.running", { defaultValue: "Đang chạy" });
    if (v === "succeeded") return t("brokerHub.data.status.succeeded", { defaultValue: "Xong" });
    if (v === "failed") return t("brokerHub.data.status.failed", { defaultValue: "Thất bại" });
    return String(s ?? "—");
  };

  const severityLabel = (s: unknown) => {
    const v = String(s ?? "").toLowerCase();
    if (v === "info") return t("brokerHub.data.severity.info", { defaultValue: "Thông tin" });
    if (v === "warning") return t("brokerHub.data.severity.warning", { defaultValue: "Cảnh báo" });
    if (v === "error") return t("brokerHub.data.severity.error", { defaultValue: "Lỗi" });
    return String(s ?? "—");
  };

  return (
    <div className="bdata-wrap">
      <div className="bdata-head">
        <span className="bdata-title">{t("brokerHub.data.sync.title", { defaultValue: "Đồng bộ" })}</span>
        {accountId !== null && accountId !== undefined && (
          <button type="button" onClick={runSync} disabled={syncPhase === "syncing"}>
            {t("brokerHub.data.sync.runNow", { defaultValue: "Đồng bộ ngay" })}
          </button>
        )}
      </div>
      {syncPhase !== "idle" && (
        <p className="bdata-note" role="status">
          {syncMessage}
        </p>
      )}

      <h3>{t("brokerHub.data.sync.runsTitle", { defaultValue: "Lịch sử đồng bộ" })}</h3>
      {runs.length === 0 ? (
        <p className="bdata-note">{t("brokerHub.data.sync.runsEmpty", { defaultValue: "Chưa có lần đồng bộ nào." })}</p>
      ) : (
        <table className="bdata-table">
          <thead>
            <tr>
              <th scope="col">{t("brokerHub.data.sync.provider", { defaultValue: "Nhà môi giới" })}</th>
              <th scope="col">{t("brokerHub.data.sync.status", { defaultValue: "Trạng thái" })}</th>
              <th scope="col">{t("brokerHub.data.sync.started", { defaultValue: "Bắt đầu" })}</th>
              <th scope="col">{t("brokerHub.data.sync.finished", { defaultValue: "Kết thúc" })}</th>
              <th scope="col">{t("brokerHub.data.sync.error", { defaultValue: "Lỗi" })}</th>
            </tr>
          </thead>
          <tbody>
            {runs.map((r) => (
              <tr key={String(r.id)}>
                <td>{r.provider ?? "—"}</td>
                <td>{runStatus(r.status)}</td>
                <td>{r.started_at ?? "—"}</td>
                <td>{r.finished_at ?? "—"}</td>
                <td className="bdata-error">{r.error ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h3>{t("brokerHub.data.sync.issuesTitle", { defaultValue: "Lệch cần xử lý" })}</h3>
      {issues.length === 0 ? (
        <p className="bdata-note">{t("brokerHub.data.sync.issuesEmpty", { defaultValue: "Không có lệch nào." })}</p>
      ) : (
        <table className="bdata-table">
          <thead>
            <tr>
              <th scope="col">{t("brokerHub.data.sync.severity", { defaultValue: "Mức" })}</th>
              <th scope="col">{t("brokerHub.data.sync.code", { defaultValue: "Mã" })}</th>
              <th scope="col">{t("brokerHub.data.sync.created", { defaultValue: "Ghi nhận" })}</th>
            </tr>
          </thead>
          <tbody>
            {issues.map((issue) => (
              <tr key={String(issue.id)}>
                <td>{severityLabel(issue.severity)}</td>
                <td>{issue.code ?? "—"}</td>
                <td>{issue.created_at ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default BrokerSyncCenter;
