import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, PieChart, Pie, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ShellPageChrome, ShellPanel, renderShellMetric, ShellField } from "../../components/ShellPageTemplate.js";
import { ShellEmptyState } from "../../components/ShellEmptyState.js";
import { ShellSkeleton } from "../../components/ShellSkeleton.js";
import { defaultCoreApiAdapter } from "../../adapters/coreApiAdapter.js";
import { useI18n } from "../../context/LangContext.js";
import { usePortfolio } from "../../context/PortfolioContext.js";

interface AuditLog {
  id: string;
  event_type: string;
  actor_username?: string;
  ip_address?: string;
  created_at: string;
  old_value?: unknown;
  new_value?: unknown;
  metadata?: Record<string, unknown>;
}

interface TenantAdminAuditLogsPageProps {
  env?: Record<string, unknown>;
  fetchImpl?: unknown;
  bootstrapLoader?: unknown;
  autoLoad?: boolean;
  initialSnapshot?: Record<string, unknown> | null;
}

const EVENT_COLORS = ["#00b4d8", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16", "#f97316", "#6366f1"];

function getQueryParam(url: string | null, paramName: string): string | null {
  if (!url) return null;
  try {
    const match = url.match(new RegExp("[?&]" + paramName + "=([^&#]*)"));
    return match ? decodeURIComponent(match[1]) : null;
  } catch {
    return null;
  }
}

export function TenantAdminAuditLogsPage({
  env: _env = {},
  fetchImpl: _fetchImpl,
  bootstrapLoader: _bootstrapLoader,
  autoLoad: _autoLoad = true,
  initialSnapshot: _initialSnapshot = null,
}: TenantAdminAuditLogsPageProps) {
  const { t, formatDateTime: fmtDateTime } = useI18n();
  const { ability } = usePortfolio();

  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [prevCursor, setPrevCursor] = useState<string | null>(null);
  const [eventType, setEventType] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  const canRead = ability?.can?.("read", "TenantAuditAdmin") ?? true;

  const loadLogs = async (cursorValue = "") => {
    try {
      setLoading(true);
      setError(null);

      let queryPath = "/partner/audit-logs/?";
      if (cursorValue) {
        queryPath += `cursor=${cursorValue}&`;
      }
      if (eventType) {
        queryPath += `event_type=${encodeURIComponent(eventType)}&`;
      }
      if (startDate) {
        queryPath += `start_date=${encodeURIComponent(startDate)}&`;
      }
      if (endDate) {
        queryPath += `end_date=${encodeURIComponent(endDate)}&`;
      }

      const data = await defaultCoreApiAdapter.coreGet(queryPath);

      setLogs(data.results || []);
      setNextCursor(getQueryParam(data.next, "cursor"));
      setPrevCursor(getQueryParam(data.previous, "cursor"));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("tenantAuditLogs.loadError"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, []);

  if (!canRead) {
    return (
      <ShellPageChrome
        eyebrow={t("tenantAuditLogs.eyebrow")}
        title={t("tenantAuditLogs.title")}
        description={t("tenantAuditLogs.description")}
        notice={t("common.noPermission")}
      >
        <div className="shellPage__panel">
          <ShellEmptyState description={t("tenantAuditLogs.noLogs")} />
        </div>
      </ShellPageChrome>
    );
  }

  if (loading && logs.length === 0) {
    return (
      <ShellPageChrome
        eyebrow={t("tenantAuditLogs.eyebrow")}
        title={t("tenantAuditLogs.title")}
        description={t("common.loading")}
      >
        <ShellSkeleton variant="chart" count={6} />
        <div style={{ height: 16 }} />
        <ShellSkeleton variant="card" count={3} />
      </ShellPageChrome>
    );
  }

  if (error && logs.length === 0) {
    return (
      <ShellPageChrome
        eyebrow={t("tenantAuditLogs.eyebrow")}
        title={t("tenantAuditLogs.title")}
        description={t("tenantAuditLogs.loadError")}
        error={error}
      >
        <div className="shellPage__panel">{t("tenantAuditLogs.loadError")}</div>
      </ShellPageChrome>
    );
  }

  const handleFilterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadLogs("");
  };

  const handleClearFilters = () => {
    setEventType("");
    setStartDate("");
    setEndDate("");
    setTimeout(() => {
      loadLogs("");
    }, 0);
  };

  const toggleExpandLog = (logId: string) => {
    if (expandedLogId === logId) {
      setExpandedLogId(null);
    } else {
      setExpandedLogId(logId);
    }
  };

  // Event type breakdown for pie chart
  const eventBreakdown = useMemo(() => {
    const counts: Record<string, number> = {};
    logs.forEach(log => {
      counts[log.event_type] = (counts[log.event_type] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, value], idx) => ({ name, value, color: EVENT_COLORS[idx % EVENT_COLORS.length] }))
      .sort((a, b) => b.value - a.value);
  }, [logs]);

  // Daily activity heatmap data
  const dailyActivity = useMemo(() => {
    const counts: Record<string, number> = {};
    logs.forEach(log => {
      const day = log.created_at.slice(0, 10);
      counts[day] = (counts[day] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([date, count]) => ({ date: date.slice(5), count }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [logs]);

  const uniqueEventTypes = useMemo(() => {
    const types = new Set(logs.map(l => l.event_type));
    return Array.from(types);
  }, [logs]);

  const metrics = [
    renderShellMetric(t("tenantAuditLogs.metricLogs"), String(logs.length)),
    renderShellMetric(t("tenantAuditLogs.metricEventTypes"), String(uniqueEventTypes.length)),
    renderShellMetric(t("tenantAuditLogs.metricUniqueActors"), String(new Set(logs.map(l => l.actor_username || "system")).size)),
  ];

  return (
    <ShellPageChrome
      eyebrow={t("tenantAuditLogs.eyebrow")}
      title={t("tenantAuditLogs.title")}
      description={t("tenantAuditLogs.description")}
      metrics={metrics}
    >
      <section className="shellPage__stack">
        {/* Filters */}
        <ShellPanel
          title={t("tenantAuditLogs.filterTitle")}
          subtitle={t("tenantAuditLogs.filterSubtitle")}
        >
          <form onSubmit={handleFilterSubmit} style={{ display: "flex", flexWrap: "wrap", gap: "16px", alignItems: "flex-end" }}>
            <div style={{ flex: "1 1 200px" }}>
              <div className="shellPage__field">
                <label className="shellPage__fieldLabel">{t("tenantAuditLogs.eventType")}</label>
                <select
                  className="shellPage__input"
                  value={eventType}
                  onChange={e => setEventType(e.target.value)}
                >
                  <option value="">{t("tenantAuditLogs.allTypes") || "All types"}</option>
                  {uniqueEventTypes.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>
            </div>
            <div style={{ flex: "1 1 150px" }}>
              <ShellField
                label={t("tenantAuditLogs.fromDate")}
                name="startDate"
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
              />
            </div>
            <div style={{ flex: "1 1 150px" }}>
              <ShellField
                label={t("tenantAuditLogs.toDate")}
                name="endDate"
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
              />
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              <button type="submit" className="shellPage__button shellPage__button--primary">
                {t("tenantAuditLogs.search")}
              </button>
              <button type="button" onClick={handleClearFilters} className="shellPage__button shellPage__button--secondary">
                {t("tenantAuditLogs.clearFilter")}
              </button>
            </div>
          </form>
        </ShellPanel>

        {/* Analytics Row: Pie Chart + Daily Activity */}
        {logs.length > 0 && (<>
          <ShellPanel title={t("tenantAuditLogs.eventBreakdownTitle")}>
            <div style={{ width: "100%", height: 200 }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={eventBreakdown}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={70}
                    label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                    labelLine={false}
                  >
                    {eventBreakdown.map((entry, idx) => (
                      <Cell key={idx} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: "rgba(15,23,42,0.95)", border: "1px solid rgba(255,255,255,0.08)",
                      borderRadius: 12, fontSize: 12, color: "#f1f5f9",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </ShellPanel>

          <ShellPanel title={t("tenantAuditLogs.dailyActivityTitle")}>
            {dailyActivity.length > 0 ? (
              <div style={{ width: "100%", height: 200 }}>
                <ResponsiveContainer>
                  <BarChart data={dailyActivity} margin={{ top: 8, right: 8, bottom: 4, left: -8 }}>
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{
                        background: "rgba(15,23,42,0.95)", border: "1px solid rgba(255,255,255,0.08)",
                        borderRadius: 12, fontSize: 12, color: "#f1f5f9",
                      }}
                    />
                    <Bar dataKey="count" fill="#00b4d8" radius={[2, 2, 0, 0]} name={t("tenantAuditLogs.activitiesLabel")} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <ShellEmptyState description={t("tenantAuditLogs.noActivityData")} />
            )}
          </ShellPanel>
        </>)}

        {/* Timeline */}
        <ShellPanel
          title={t("tenantAuditLogs.timelineTitle")}
          subtitle={t("tenantAuditLogs.timelineSubtitle")}
        >
          <div className="shellPage__list">
            {loading && logs.length === 0 ? (
              <ShellSkeleton variant="card" count={3} />
            ) : logs.length === 0 ? (
              <ShellEmptyState description={t("tenantAuditLogs.noLogs")} />
            ) : (
              <>
                {logs.map(log => {
                  const isExpanded = expandedLogId === log.id;
                  const hasDetails = log.old_value || log.new_value || log.metadata;

                  return (
                    <div
                      key={log.id}
                      className="shellPage__listItem"
                      style={{ cursor: hasDetails ? "pointer" : "default" }}
                      {...(hasDetails ? { role: "button", tabIndex: 0, onKeyDown: (e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleExpandLog(log.id); } } } : {})}
                      onClick={() => hasDetails && toggleExpandLog(log.id)}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
                        <div>
                          <span className="shellPage__pill" style={{ background: "rgba(0,180,216,0.1)", color: "#00b4d8", border: "1px solid rgba(0,180,216,0.2)" }}>
                            {log.event_type}
                          </span>
                          <span className="shellPage__itemMeta" style={{ marginLeft: "12px" }}>
                            {t("tenantAuditLogs.performedBy")}: {log.actor_username || t("tenantAuditLogs.systemName")}
                          </span>
                        </div>
                        <div className="shellPage__itemMeta" style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                          {log.ip_address && <span>IP: {log.ip_address}</span>}
                          <span>{fmtDateTime(log.created_at)}</span>
                        </div>
                      </div>

                      {isExpanded && hasDetails && (
                        <div
                          onClick={e => e.stopPropagation()}
                          style={{ marginTop: "12px", borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: "12px", fontSize: "13px" }}
                        >
                          {log.metadata ? (
                            <div style={{ marginBottom: "10px" }}>
                              <span className="shellPage__itemMeta" style={{ fontWeight: 600, fontSize: "11px", textTransform: "uppercase" }}>
                                {t("tenantAuditLogs.metadata")}
                              </span>
                              <pre style={{ background: "rgba(15,23,42,0.6)", padding: "10px", borderRadius: "6px", overflowX: "auto", margin: "4px 0", color: "#38bdf8", fontFamily: "monospace", fontSize: "12px" }}>
                                {JSON.stringify(log.metadata, null, 2)}
                              </pre>
                            </div>
                          ) : null}

                          {(log.old_value || log.new_value) ? (
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                              <div>
                                <span className="shellPage__itemMeta" style={{ fontWeight: 600, fontSize: "11px", textTransform: "uppercase", color: "#f87171" }}>
                                  − {t("tenantAuditLogs.oldValue")}
                                </span>
                                <pre style={{ background: "rgba(248,113,113,0.06)", padding: "10px", borderRadius: "6px", overflowX: "auto", margin: "4px 0", color: "#fca5a5", fontFamily: "monospace", fontSize: "12px", borderLeft: "2px solid #f87171" }}>
                                  {log.old_value ? JSON.stringify(log.old_value, null, 2) : "—"}
                                </pre>
                              </div>
                              <div>
                                <span className="shellPage__itemMeta" style={{ fontWeight: 600, fontSize: "11px", textTransform: "uppercase", color: "#4ade80" }}>
                                  + {t("tenantAuditLogs.newValue")}
                                </span>
                                <pre style={{ background: "rgba(74,222,128,0.06)", padding: "10px", borderRadius: "6px", overflowX: "auto", margin: "4px 0", color: "#86efac", fontFamily: "monospace", fontSize: "12px", borderLeft: "2px solid #4ade80" }}>
                                  {log.new_value ? JSON.stringify(log.new_value, null, 2) : "—"}
                                </pre>
                              </div>
                            </div>
                          ) : (
                            <div style={{ color: "#94a3b8", fontStyle: "italic", fontSize: 12 }}>
                              {t("tenantAuditLogs.noDetails") || "No details available"}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}

                {(prevCursor || nextCursor) && (
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: "16px" }}>
                    <button
                      onClick={() => prevCursor !== null && loadLogs(prevCursor)}
                      disabled={!prevCursor || loading}
                      className="shellPage__button shellPage__button--secondary"
                      style={{ color: !prevCursor || loading ? "#94a3b8" : "#cbd5e1" }}
                    >
                      {t("tenantAuditLogs.previous")}
                    </button>
                    <button
                      onClick={() => nextCursor !== null && loadLogs(nextCursor)}
                      disabled={!nextCursor || loading}
                      className="shellPage__button shellPage__button--secondary"
                      style={{ color: !nextCursor || loading ? "#94a3b8" : "#cbd5e1" }}
                    >
                      {t("tenantAuditLogs.next")}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </ShellPanel>
      </section>
    </ShellPageChrome>
  );
}
