import { createElement, useEffect, useState } from "react";
import { renderShellPageChrome, renderShellPanel, renderShellMetric } from "../../components/ShellPageTemplate.js";
import { defaultCoreApiAdapter } from "../../adapters/coreApiAdapter.js";

function getQueryParam(url, paramName) {
  if (!url) return null;
  try {
    // Relative path or full URL check
    const match = url.match(new RegExp('[?&]' + paramName + '=([^&#]*)'));
    return match ? decodeURIComponent(match[1]) : null;
  } catch (e) {
    return null;
  }
}

function formatDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleString("vi-VN");
}

export function TenantAdminAuditLogsPage({ env = {}, fetchImpl, bootstrapLoader, autoLoad = true, initialSnapshot = null }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [nextCursor, setNextCursor] = useState(null);
  const [prevCursor, setPrevCursor] = useState(null);
  const [currentCursor, setCurrentCursor] = useState("");
  
  // Filters
  const [eventType, setEventType] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  
  // Detail views expansion state
  const [expandedLogId, setExpandedLogId] = useState(null);

  const loadLogs = async (cursorValue = "") => {
    try {
      setLoading(true);
      setError(null);
      
      let queryPath = `/partner/audit-logs/?`;
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
      
      setLogs(response.results || []);
      setNextCursor(getQueryParam(response.next, "cursor"));
      setPrevCursor(getQueryParam(response.previous, "cursor"));
      setCurrentCursor(cursorValue);
    } catch (err) {
      setError(err.message || "Lỗi khi tải dữ liệu nhật ký vận hành");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, []);

  const handleFilterSubmit = (e) => {
    e.preventDefault();
    loadLogs(""); // reset to first page
  };

  const handleClearFilters = () => {
    setEventType("");
    setStartDate("");
    setEndDate("");
    // We must trigger reload with cleared filters
    setTimeout(() => {
      loadLogs("");
    }, 0);
  };

  const toggleExpandLog = (logId) => {
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

  return renderShellPageChrome({
    eyebrow: "Tenant Admin",
    title: "Nhật ký vận hành (Audit Logs)",
    description: "Nhật ký lưu giữ lịch sử thay đổi cấu hình, tạo/thu hồi token và thành viên nhóm",
    metrics,
    children: createElement(
      "section",
      { className: "shellPage__bodyGrid" },
      createElement(
        "div",
        { className: "shellPage__stack" },

        // Filter Form Panel
        renderShellPanel({
          title: "Bộ lọc nhật ký",
          subtitle: "Lọc tìm kiếm theo loại sự kiện và khoảng thời gian",
          children: createElement(
            "form",
            { onSubmit: handleFilterSubmit, style: { display: "flex", flexWrap: "wrap", gap: "16px", alignItems: "flex-end" } },
            createElement(
              "div",
              { style: { flex: "1 1 200px" } },
              createElement("label", { style: { display: "block", marginBottom: "6px", fontSize: "12px", color: "#94a3b8" } }, "Loại sự kiện"),
              createElement("input", {
                type: "text",
                value: eventType,
                onChange: e => setEventType(e.target.value),
                placeholder: "Ví dụ: pat_issued, sa_created",
                style: { width: "100%", padding: "8px 12px", background: "rgba(15,23,42,0.5)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "8px", color: "#f1f5f9", fontSize: "14px" },
              })
            ),
            createElement(
              "div",
              { style: { flex: "1 1 150px" } },
              createElement("label", { style: { display: "block", marginBottom: "6px", fontSize: "12px", color: "#94a3b8" } }, "Từ ngày"),
              createElement("input", {
                type: "date",
                value: startDate,
                onChange: e => setStartDate(e.target.value),
                style: { width: "100%", padding: "8px 12px", background: "rgba(15,23,42,0.5)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "8px", color: "#f1f5f9", fontSize: "14px" },
              })
            ),
            createElement(
              "div",
              { style: { flex: "1 1 150px" } },
              createElement("label", { style: { display: "block", marginBottom: "6px", fontSize: "12px", color: "#94a3b8" } }, "Đến ngày"),
              createElement("input", {
                type: "date",
                value: endDate,
                onChange: e => setEndDate(e.target.value),
                style: { width: "100%", padding: "8px 12px", background: "rgba(15,23,42,0.5)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "8px", color: "#f1f5f9", fontSize: "14px" },
              })
            ),
            createElement(
              "div",
              { style: { display: "flex", gap: "8px" } },
              createElement("button", {
                type: "submit",
                style: {
                  padding: "9px 18px",
                  background: "rgba(0,180,216,0.2)",
                  border: "1px solid rgba(0,180,216,0.3)",
                  borderRadius: "8px",
                  color: "#00b4d8",
                  fontWeight: 600,
                  cursor: "pointer",
                  fontSize: "14px",
                },
              }, "Tìm kiếm"),
              createElement("button", {
                type: "button",
                onClick: handleClearFilters,
                style: {
                  padding: "9px 18px",
                  background: "rgba(148,163,184,0.1)",
                  border: "1px solid rgba(148,163,184,0.2)",
                  borderRadius: "8px",
                  color: "#cbd5e1",
                  cursor: "pointer",
                  fontSize: "14px",
                },
              }, "Xóa lọc")
            )
          ),
        }),

        // Audit Logs Timeline List Panel
        renderShellPanel({
          title: "Timeline Nhật ký vận hành",
          subtitle: `Hiển thị các thay đổi được ghi nhận`,
          children: createElement(
            "div",
            { style: { display: "flex", flexDirection: "column", gap: "12px" } },
            loading && logs.length === 0 ? createElement("div", { style: { padding: "24px", textAlign: "center", color: "#64748b" } }, "Đang tải...") :
            logs.length === 0 ? createElement("div", { style: { padding: "24px", textAlign: "center", color: "#64748b" } }, "Không tìm thấy nhật ký vận hành nào phù hợp.") :
            createElement(
              "div",
              { style: { display: "flex", flexDirection: "column", gap: "12px" } },
              logs.map(log => {
                const isExpanded = expandedLogId === log.id;
                const hasDetails = log.old_value || log.new_value || log.metadata;

                return createElement(
                  "div",
                  {
                    key: log.id,
                    style: {
                      border: "1px solid rgba(255,255,255,0.04)",
                      background: "rgba(15,23,42,0.3)",
                      borderRadius: "10px",
                      padding: "14px",
                      cursor: hasDetails ? "pointer" : "default",
                      transition: "all 0.2s ease",
                    },
                    onClick: () => hasDetails && toggleExpandLog(log.id),
                  },
                  createElement(
                    "div",
                    { style: { display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" } },
                    createElement(
                      "div",
                      null,
                      createElement("span", {
                        style: {
                          fontWeight: 600,
                          color: "#f1f5f9",
                          fontSize: "14px",
                          padding: "4px 8px",
                          background: "rgba(0,180,216,0.1)",
                          borderRadius: "6px",
                          border: "1px solid rgba(0,180,216,0.2)",
                        },
                      }, log.event_type),
                      createElement("span", { style: { marginLeft: "12px", fontSize: "13px", color: "#cbd5e1" } }, `Người thực hiện: ${log.actor_username || "Hệ thống"}`)
                    ),
                    createElement(
                      "div",
                      { style: { display: "flex", alignItems: "center", gap: "12px", fontSize: "12px", color: "#64748b" } },
                      log.ip_address && createElement("span", null, `IP: ${log.ip_address}`),
                      createElement("span", null, formatDate(log.created_at))
                    )
                  ),
                  
                  // Expanded block for diff view
                  isExpanded && hasDetails && createElement(
                    "div",
                    {
                      onClick: (e) => e.stopPropagation(),
                      style: {
                        marginTop: "12px",
                        borderTop: "1px solid rgba(255,255,255,0.06)",
                        paddingTop: "12px",
                        fontSize: "13px",
                      },
                    },
                    log.metadata && createElement(
                      "div",
                      { style: { marginBottom: "10px" } },
                      createElement("span", { style: { color: "#64748b", fontWeight: "600", fontSize: "11px", textTransform: "uppercase" } }, "Metadata"),
                      createElement(
                        "pre",
                        { style: { background: "rgba(15,23,42,0.6)", padding: "10px", borderRadius: "6px", overflowX: "auto", margin: "4px 0", color: "#38bdf8", fontFamily: "monospace", fontSize: "12px" } },
                        JSON.stringify(log.metadata, null, 2)
                      )
                    ),
                    log.old_value && createElement(
                      "div",
                      { style: { marginBottom: "10px" } },
                      createElement("span", { style: { color: "#64748b", fontWeight: "600", fontSize: "11px", textTransform: "uppercase" } }, "Giá trị cũ"),
                      createElement(
                        "pre",
                        { style: { background: "rgba(15,23,42,0.6)", padding: "10px", borderRadius: "6px", overflowX: "auto", margin: "4px 0", color: "#f87171", fontFamily: "monospace", fontSize: "12px" } },
                        JSON.stringify(log.old_value, null, 2)
                      )
                    ),
                    log.new_value && createElement(
                      "div",
                      { style: { marginBottom: "10px" } },
                      createElement("span", { style: { color: "#64748b", fontWeight: "600", fontSize: "11px", textTransform: "uppercase" } }, "Giá trị mới"),
                      createElement(
                        "pre",
                        { style: { background: "rgba(15,23,42,0.6)", padding: "10px", borderRadius: "6px", overflowX: "auto", margin: "4px 0", color: "#4ade80", fontFamily: "monospace", fontSize: "12px" } },
                        JSON.stringify(log.new_value, null, 2)
                      )
                    )
                  )
                );
              }),
              
              // Pagination buttons
              (prevCursor || nextCursor) && createElement(
                "div",
                { style: { display: "flex", justifyContent: "space-between", marginTop: "16px" } },
                createElement("button", {
                  onClick: () => prevCursor !== null && loadLogs(prevCursor),
                  disabled: !prevCursor || loading,
                  style: {
                    padding: "8px 16px",
                    background: "rgba(148,163,184,0.1)",
                    border: "1px solid rgba(148,163,184,0.2)",
                    borderRadius: "8px",
                    color: !prevCursor || loading ? "#64748b" : "#cbd5e1",
                    cursor: !prevCursor || loading ? "not-allowed" : "pointer",
                    fontSize: "13px",
                  },
                }, "Trước"),
                createElement("button", {
                  onClick: () => nextCursor !== null && loadLogs(nextCursor),
                  disabled: !nextCursor || loading,
                  style: {
                    padding: "8px 16px",
                    background: "rgba(148,163,184,0.1)",
                    border: "1px solid rgba(148,163,184,0.2)",
                    borderRadius: "8px",
                    color: !nextCursor || loading ? "#64748b" : "#cbd5e1",
                    cursor: !nextCursor || loading ? "not-allowed" : "pointer",
                    fontSize: "13px",
                  },
                }, "Sau")
              )
            )
          ),
        }),

      )
    ),
  });
}
