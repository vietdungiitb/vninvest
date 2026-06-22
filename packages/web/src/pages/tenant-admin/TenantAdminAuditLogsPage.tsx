import { useEffect, useState } from "react";
import { ShellPageChrome, ShellPanel, renderShellMetric } from "../../components/ShellPageTemplate.js";
import { defaultCoreApiAdapter } from "../../adapters/coreApiAdapter.js";

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

function getQueryParam(url: string | null, paramName: string): string | null {
  if (!url) return null;
  try {
    const match = url.match(new RegExp("[?&]" + paramName + "=([^&#]*)"));
    return match ? decodeURIComponent(match[1]) : null;
  } catch {
    return null;
  }
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleString("vi-VN");
}

export function TenantAdminAuditLogsPage({
  env: _env = {},
  fetchImpl: _fetchImpl,
  bootstrapLoader: _bootstrapLoader,
  autoLoad: _autoLoad = true,
  initialSnapshot: _initialSnapshot = null,
}: TenantAdminAuditLogsPageProps) {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [prevCursor, setPrevCursor] = useState<string | null>(null);
  const [eventType, setEventType] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

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

      const response = await defaultCoreApiAdapter.coreGet(queryPath);
      const data = response.ok ? await response.json() : { results: [], next: null, previous: null };

      setLogs(data.results || []);
      setNextCursor(getQueryParam(data.next, "cursor"));
      setPrevCursor(getQueryParam(data.previous, "cursor"));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Lỗi khi tải dữ liệu nhật ký vận hành");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, []);

  if (error && logs.length === 0) {
    return (
      <ShellPageChrome
        eyebrow="Tenant Admin"
        title="Nhật ký vận hành (Audit Logs)"
        description="Không thể tải dữ liệu nhật ký vận hành"
        error={error}
      >
        <div className="shellPage__panel">{error}</div>
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
    renderShellMetric("Số bản ghi hiển thị", String(logs.length)),
    renderShellMetric("Bộ lọc sự kiện", eventType || "Không có"),
  ];

  return (
    <ShellPageChrome
      eyebrow="Tenant Admin"
      title="Nhật ký vận hành (Audit Logs)"
      description="Nhật ký lưu giữ lịch sử thay đổi cấu hình, tạo/thu hồi token và thành viên nhóm"
      metrics={metrics}
    >
      <section className="shellPage__bodyGrid">
        <div className="shellPage__stack">
          <ShellPanel
            title="Bộ lọc nhật ký"
            subtitle="Lọc tìm kiếm theo loại sự kiện và khoảng thời gian"
          >
            <form onSubmit={handleFilterSubmit} style={{ display: "flex", flexWrap: "wrap", gap: "16px", alignItems: "flex-end" }}>
              <div style={{ flex: "1 1 200px" }}>
                <label style={{ display: "block", marginBottom: "6px", fontSize: "12px", color: "#94a3b8" }}>Loại sự kiện</label>
                <input
                  type="text"
                  value={eventType}
                  onChange={e => setEventType(e.target.value)}
                  placeholder="Ví dụ: pat_issued, sa_created"
                  style={{ width: "100%", padding: "8px 12px", background: "rgba(15,23,42,0.5)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "8px", color: "#f1f5f9", fontSize: "14px" }}
                />
              </div>
              <div style={{ flex: "1 1 150px" }}>
                <label style={{ display: "block", marginBottom: "6px", fontSize: "12px", color: "#94a3b8" }}>Từ ngày</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  style={{ width: "100%", padding: "8px 12px", background: "rgba(15,23,42,0.5)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "8px", color: "#f1f5f9", fontSize: "14px" }}
                />
              </div>
              <div style={{ flex: "1 1 150px" }}>
                <label style={{ display: "block", marginBottom: "6px", fontSize: "12px", color: "#94a3b8" }}>Đến ngày</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                  style={{ width: "100%", padding: "8px 12px", background: "rgba(15,23,42,0.5)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "8px", color: "#f1f5f9", fontSize: "14px" }}
                />
              </div>
              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  type="submit"
                  style={{
                    padding: "9px 18px",
                    background: "rgba(0,180,216,0.2)",
                    border: "1px solid rgba(0,180,216,0.3)",
                    borderRadius: "8px",
                    color: "#00b4d8",
                    fontWeight: 600,
                    cursor: "pointer",
                    fontSize: "14px",
                  }}
                >
                  Tìm kiếm
                </button>
                <button
                  type="button"
                  onClick={handleClearFilters}
                  style={{
                    padding: "9px 18px",
                    background: "rgba(148,163,184,0.1)",
                    border: "1px solid rgba(148,163,184,0.2)",
                    borderRadius: "8px",
                    color: "#cbd5e1",
                    cursor: "pointer",
                    fontSize: "14px",
                  }}
                >
                  Xóa lọc
                </button>
              </div>
            </form>
          </ShellPanel>

          <ShellPanel
            title="Timeline Nhật ký vận hành"
            subtitle="Hiển thị các thay đổi được ghi nhận"
          >
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {loading && logs.length === 0 ? (
                <div style={{ padding: "24px", textAlign: "center", color: "#64748b" }}>Đang tải...</div>
              ) : logs.length === 0 ? (
                <div style={{ padding: "24px", textAlign: "center", color: "#64748b" }}>Không tìm thấy nhật ký vận hành nào phù hợp.</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  {logs.map(log => {
                    const isExpanded = expandedLogId === log.id;
                    const hasDetails = log.old_value || log.new_value || log.metadata;

                    return (
                      <div
                        key={log.id}
                        style={{
                          border: "1px solid rgba(255,255,255,0.04)",
                          background: "rgba(15,23,42,0.3)",
                          borderRadius: "10px",
                          padding: "14px",
                          cursor: hasDetails ? "pointer" : "default",
                          transition: "all 0.2s ease",
                        }}
                        onClick={() => hasDetails && toggleExpandLog(log.id)}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
                          <div>
                            <span
                              style={{
                                fontWeight: 600,
                                color: "#f1f5f9",
                                fontSize: "14px",
                                padding: "4px 8px",
                                background: "rgba(0,180,216,0.1)",
                                borderRadius: "6px",
                                border: "1px solid rgba(0,180,216,0.2)",
                              }}
                            >
                              {log.event_type}
                            </span>
                            <span style={{ marginLeft: "12px", fontSize: "13px", color: "#cbd5e1" }}>
                              Người thực hiện: {log.actor_username || "Hệ thống"}
                            </span>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: "12px", fontSize: "12px", color: "#64748b" }}>
                            {log.ip_address && <span>IP: {log.ip_address}</span>}
                            <span>{formatDate(log.created_at)}</span>
                          </div>
                        </div>

                        {isExpanded && hasDetails && (
                          <div
                            onClick={e => e.stopPropagation()}
                            style={{
                              marginTop: "12px",
                              borderTop: "1px solid rgba(255,255,255,0.06)",
                              paddingTop: "12px",
                              fontSize: "13px",
                            }}
                          >
                            {log.metadata ? (
                              <div style={{ marginBottom: "10px" }}>
                                <span style={{ color: "#64748b", fontWeight: 600, fontSize: "11px", textTransform: "uppercase" }}>Metadata</span>
                                <pre style={{ background: "rgba(15,23,42,0.6)", padding: "10px", borderRadius: "6px", overflowX: "auto", margin: "4px 0", color: "#38bdf8", fontFamily: "monospace", fontSize: "12px" }}>
                                  {JSON.stringify(log.metadata, null, 2)}
                                </pre>
                              </div>
                            ) : null}
                            {log.old_value ? (
                              <div style={{ marginBottom: "10px" }}>
                                <span style={{ color: "#64748b", fontWeight: 600, fontSize: "11px", textTransform: "uppercase" }}>Giá trị cũ</span>
                                <pre style={{ background: "rgba(15,23,42,0.6)", padding: "10px", borderRadius: "6px", overflowX: "auto", margin: "4px 0", color: "#f87171", fontFamily: "monospace", fontSize: "12px" }}>
                                  {JSON.stringify(log.old_value, null, 2)}
                                </pre>
                              </div>
                            ) : null}
                            {log.new_value ? (
                              <div style={{ marginBottom: "10px" }}>
                                <span style={{ color: "#64748b", fontWeight: 600, fontSize: "11px", textTransform: "uppercase" }}>Giá trị mới</span>
                                <pre style={{ background: "rgba(15,23,42,0.6)", padding: "10px", borderRadius: "6px", overflowX: "auto", margin: "4px 0", color: "#4ade80", fontFamily: "monospace", fontSize: "12px" }}>
                                  {JSON.stringify(log.new_value, null, 2)}
                                </pre>
                              </div>
                            ) : null}
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
                        style={{
                          padding: "8px 16px",
                          background: "rgba(148,163,184,0.1)",
                          border: "1px solid rgba(148,163,184,0.2)",
                          borderRadius: "8px",
                          color: !prevCursor || loading ? "#64748b" : "#cbd5e1",
                          cursor: !prevCursor || loading ? "not-allowed" : "pointer",
                          fontSize: "13px",
                        }}
                      >
                        Trước
                      </button>
                      <button
                        onClick={() => nextCursor !== null && loadLogs(nextCursor)}
                        disabled={!nextCursor || loading}
                        style={{
                          padding: "8px 16px",
                          background: "rgba(148,163,184,0.1)",
                          border: "1px solid rgba(148,163,184,0.2)",
                          borderRadius: "8px",
                          color: !nextCursor || loading ? "#64748b" : "#cbd5e1",
                          cursor: !nextCursor || loading ? "not-allowed" : "pointer",
                          fontSize: "13px",
                        }}
                      >
                        Sau
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </ShellPanel>
        </div>
      </section>
    </ShellPageChrome>
  );
}
