import styles from "../../components/ShellPageTemplate.module.css";
import ta from "./TenantAdmin.module.css";
import { useMemo, useState } from "react";
import { Bar, BarChart, PieChart, Pie, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ShellPageChrome, ShellPanel, renderShellMetric, ShellField } from "../../components/ShellPageTemplate.js";
import { ShellEmptyState } from "../../components/ShellEmptyState.js";
import { ShellSkeleton } from "../../components/ShellSkeleton.js";
import { useI18n } from "../../context/LangContext.js";
import { usePortfolio } from "../../context/PortfolioContext.js";
import { useTenantAdminQuery } from "./useTenantAdminQuery.js";
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

  const [cursor, setCursor] = useState("");
  const [eventType, setEventType] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  const canRead = ability?.can?.("read", "TenantAuditAdmin") ?? false;

  const buildQuery = (cursorValue: string) => {
    let queryPath = "/partner/audit-logs/?";
    if (cursorValue) queryPath += `cursor=${cursorValue}&`;
    if (eventType) queryPath += `event_type=${encodeURIComponent(eventType)}&`;
    if (startDate) queryPath += `start_date=${encodeURIComponent(startDate)}&`;
    if (endDate) queryPath += `end_date=${encodeURIComponent(endDate)}&`;
    return queryPath;
  };

  const { data, isLoading, isFetching, error } = useTenantAdminQuery<{
    results: AuditLog[];
    next: string | null;
    previous: string | null;
  }>(
    ["tenant-audit-logs", cursor, eventType, startDate, endDate],
    buildQuery(cursor),
  );

  const logs = useMemo(() => data?.results ?? [], [data]);
  const nextCursor = getQueryParam(data?.next ?? null, "cursor");
  const prevCursor = getQueryParam(data?.previous ?? null, "cursor");

  const eventBreakdown = useMemo(() => {
    const counts: Record<string, number> = {};
    logs.forEach(log => {
      counts[log.event_type] = (counts[log.event_type] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, value], idx) => ({ name, value, color: EVENT_COLORS[idx % EVENT_COLORS.length] }))
      .sort((a, b) => b.value - a.value);
  }, [logs]);

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

  const loadLogs = (cursorValue: string) => {
    setCursor(cursorValue);
  };

  if (!canRead) {
    return (
      <ShellPageChrome
        eyebrow={t("tenantAuditLogs.eyebrow")}
        title={t("tenantAuditLogs.title")}
        description={t("tenantAuditLogs.description")}
        notice={t("common.noPermission")}
      >
        <div className={`${styles.panel}`}>
          <ShellEmptyState description={t("tenantAuditLogs.noLogs")} />
        </div>
      </ShellPageChrome>
    );
  }

  if (isLoading && logs.length === 0) {
    return (
      <ShellPageChrome
        eyebrow={t("tenantAuditLogs.eyebrow")}
        title={t("tenantAuditLogs.title")}
        description={t("common.loading")}
      >
        <ShellSkeleton variant="chart" count={6} />
        <div className={ta.aud_1} />
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
        error={error?.message || t("tenantAuditLogs.loadError")}
      >
        <div className={`${styles.panel}`}>{t("tenantAuditLogs.loadError")}</div>
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
      <section className={`${styles.stack}`}>
        {/* Filters */}
        <ShellPanel
          title={t("tenantAuditLogs.filterTitle")}
          subtitle={t("tenantAuditLogs.filterSubtitle")}
        >
          <form onSubmit={handleFilterSubmit} className={ta.aud_2}>
            <div className={ta.aud_3}>
              <div className={`${styles.field}`}>
                <label className={`${styles.fieldLabel}`}>{t("tenantAuditLogs.eventType")}</label>
                <select
                  className={`${styles.input}`}
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
            <div className={ta.aud_4}>
              <ShellField
                label={t("tenantAuditLogs.fromDate")}
                name="startDate"
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
              />
            </div>
            <div className={ta.aud_5}>
              <ShellField
                label={t("tenantAuditLogs.toDate")}
                name="endDate"
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
              />
            </div>
            <div className={ta.aud_6}>
              <button type="submit" className={`${styles.button} ${styles.buttonPrimary}`}>
                {t("tenantAuditLogs.search")}
              </button>
              <button type="button" onClick={handleClearFilters} className={`${styles.button} ${styles.buttonSecondary}`}>
                {t("tenantAuditLogs.clearFilter")}
              </button>
            </div>
          </form>
        </ShellPanel>

        {/* Analytics Row: Pie Chart + Daily Activity */}
        {logs.length > 0 && (<>
          <ShellPanel title={t("tenantAuditLogs.eventBreakdownTitle")} subtitle={t("tenantAuditLogs.statsDisclaimer")}>
            <div className={ta.aud_7}>
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

          <ShellPanel title={t("tenantAuditLogs.dailyActivityTitle")} subtitle={t("tenantAuditLogs.statsDisclaimer")}>
            {dailyActivity.length > 0 ? (
              <div className={ta.aud_8}>
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
          <div className={`${styles.list}`}>
            {isLoading && logs.length === 0 ? (
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
                      className={`${styles.listItem}`}
                      style={{ cursor: hasDetails ? "pointer" : "default" }}
                      {...(hasDetails ? { role: "button", tabIndex: 0, onKeyDown: (e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleExpandLog(log.id); } } } : {})}
                      onClick={() => hasDetails && toggleExpandLog(log.id)}
                    >
                      <div className={ta.aud_9}>
                        <div>
                          <span className={[`${styles.pill}`, ta.aud_10].filter(Boolean).join(" ")} style={{ background: "rgba(0,180,216,0.1)", color: "#00b4d8" }}>
                            {log.event_type}
                          </span>
                          <span className={`${styles.itemMeta}`} style={{ marginLeft: "12px" }}>
                            {t("tenantAuditLogs.performedBy")}: {log.actor_username || t("tenantAuditLogs.systemName")}
                          </span>
                        </div>
                        <div className={[`${styles.itemMeta}`, ta.aud_11].filter(Boolean).join(" ")} >
                          {log.ip_address && <span>IP: {log.ip_address}</span>}
                          <span>{fmtDateTime(log.created_at)}</span>
                        </div>
                      </div>

                      {isExpanded && hasDetails && (
                        <div
                          onClick={e => e.stopPropagation()}
                          className={ta.aud_12}
                        >
                          {log.metadata ? (
                            <div className={ta.aud_13}>
                              <span className={[`${styles.itemMeta}`, ta.aud_14].filter(Boolean).join(" ")} style={{ fontSize: "11px" }}>
                                {t("tenantAuditLogs.metadata")}
                              </span>
                              <pre className={ta.aud_15}>
                                {JSON.stringify(log.metadata, null, 2)}
                              </pre>
                            </div>
                          ) : null}

                          {(log.old_value || log.new_value) ? (
                            <div className={ta.aud_16}>
                              <div>
                                <span className={[`${styles.itemMeta}`, ta.aud_17].filter(Boolean).join(" ")} style={{ fontSize: "11px", color: "#f87171" }}>
                                  − {t("tenantAuditLogs.oldValue")}
                                </span>
                                <pre className={ta.aud_18}>
                                  {log.old_value ? JSON.stringify(log.old_value, null, 2) : "—"}
                                </pre>
                              </div>
                              <div>
                                <span className={[`${styles.itemMeta}`, ta.aud_19].filter(Boolean).join(" ")} style={{ fontSize: "11px", color: "#4ade80" }}>
                                  + {t("tenantAuditLogs.newValue")}
                                </span>
                                <pre className={ta.aud_20}>
                                  {log.new_value ? JSON.stringify(log.new_value, null, 2) : "—"}
                                </pre>
                              </div>
                            </div>
                          ) : (
                            <div className={ta.aud_21}>
                              {t("tenantAuditLogs.noDetails") || "No details available"}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}

                {(prevCursor || nextCursor) && (
                  <div className={ta.aud_22}>
                    <button
                      onClick={() => prevCursor !== null && loadLogs(prevCursor)}
                      disabled={!prevCursor || isFetching}
                      className={`${styles.button} ${styles.buttonSecondary}`}
                      style={{ color: !prevCursor || isFetching ? "#94a3b8" : "#cbd5e1" }}
                    >
                      {t("tenantAuditLogs.previous")}
                    </button>
                    <button
                      onClick={() => nextCursor !== null && loadLogs(nextCursor)}
                      disabled={!nextCursor || isFetching}
                      className={`${styles.button} ${styles.buttonSecondary}`}
                      style={{ color: !nextCursor || isFetching ? "#94a3b8" : "#cbd5e1" }}
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
