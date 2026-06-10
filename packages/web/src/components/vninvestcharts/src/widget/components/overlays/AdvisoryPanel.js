import { jsxs as _jsxs, jsx as _jsx, Fragment as _Fragment } from "react/jsx-runtime";
/**
 * WE2 P3a-03: AdvisoryPanel (moved from src/lib/advisory/AdvisoryPanel.tsx)
 *
 * Pure-presentational panel displaying AI advisory session results.
 * Data is fetched externally (demo shell → VNInvestClient) and passed
 * via props so this component has zero API dependency (testable).
 * All text goes through useWidgetI18n().t() — no hardcoded Vietnamese.
 *
 * Layout: vertical card — decision badge + confidence + 4 agent rows + explanation.
 */
import { useState } from "react";
import { useWidgetI18n } from "../../context/WidgetI18nContext.js";
// ── Constants ─────────────────────────────────────────────────────────────────
const DECISION_STYLES = {
    STRONG_BUY: { bg: "#0d6b2e", color: "#ffffff" },
    BUY: { bg: "#22a85e", color: "#ffffff" },
    HOLD: { bg: "#6c757d", color: "#ffffff" },
    SELL: { bg: "#e67e22", color: "#ffffff" },
    STRONG_SELL: { bg: "#c0392b", color: "#ffffff" },
};
// ── Helpers ───────────────────────────────────────────────────────────────────
function scoreToPercent(score) {
    return Math.round((score + 100) / 2);
}
function scoreBarColor(score) {
    if (score > 30)
        return "#22a85e";
    if (score < -30)
        return "#c0392b";
    return "#6c757d";
}
function formatWeight(w) {
    return `${Math.round(w * 100)}%`;
}
function formatConfidence(c) {
    return `${Math.round(c * 100)}%`;
}
function formatTimestamp(iso) {
    try {
        return new Date(iso).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
    }
    catch {
        return iso;
    }
}
function AgentRow({ agent, isExpanded, onToggle }) {
    const { t } = useWidgetI18n();
    const pct = scoreToPercent(agent.score);
    const barColor = scoreBarColor(agent.score);
    const decisionKey = `advisory.decision.${agent.signal}`;
    const decisionLabel = t(decisionKey);
    const agentKey = `advisory.agent.${agent.name}`;
    const label = t(agentKey);
    return (_jsxs("div", { style: {
            borderBottom: "1px solid #2a2a2a",
            paddingBottom: "8px",
            marginBottom: "8px",
        }, children: [_jsxs("div", { style: {
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    cursor: "pointer",
                    userSelect: "none",
                }, onClick: onToggle, title: isExpanded ? t("advisory.collapse") : t("advisory.expand"), children: [_jsxs("span", { style: { flex: 1, fontSize: "12px", color: "#c0c0c0", fontWeight: 500 }, children: [label, _jsxs("span", { style: { color: "#707070", fontSize: "11px", marginLeft: "4px" }, children: ["(", formatWeight(agent.weight), ")"] })] }), _jsx("span", { style: {
                            fontSize: "10px",
                            fontWeight: 700,
                            padding: "2px 6px",
                            borderRadius: "4px",
                            background: "#6c757d",
                            color: "#ffffff",
                            letterSpacing: "0.5px",
                        }, children: decisionLabel }), _jsx("span", { style: { color: "#707070", fontSize: "10px" }, children: isExpanded ? "▲" : "▼" })] }), _jsx("div", { style: {
                    height: "4px",
                    background: "#2a2a2a",
                    borderRadius: "2px",
                    marginTop: "6px",
                    overflow: "hidden",
                }, children: _jsx("div", { style: {
                        height: "100%",
                        width: `${pct}%`,
                        background: barColor,
                        borderRadius: "2px",
                        transition: "width 0.3s ease",
                    } }) }), isExpanded && agent.explanation ? (_jsx("div", { style: {
                    marginTop: "8px",
                    fontSize: "11px",
                    color: "#b0b0b0",
                    lineHeight: "1.5",
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                }, children: agent.explanation })) : null] }));
}
// ── Skeleton ──────────────────────────────────────────────────────────────────
function SkeletonRow() {
    return (_jsx("div", { style: {
            height: "40px",
            background: "#1e1e1e",
            borderRadius: "4px",
            marginBottom: "8px",
            animation: "pulse 1.2s ease-in-out infinite",
        } }));
}
export function AdvisoryPanel({ show, result, isLoading, symbol, onRefresh, onClose, }) {
    const { t } = useWidgetI18n();
    const [expandedAgent, setExpandedAgent] = useState(null);
    const [explanationOpen, setExplanationOpen] = useState(false);
    if (!show)
        return null;
    return (_jsxs("div", { className: "vnsc-advisory-panel", style: {
            position: "absolute",
            top: 0,
            right: 0,
            bottom: 0,
            width: "260px",
            zIndex: 50,
            background: "#141414",
            borderLeft: "1px solid #2a2a2a",
            display: "flex",
            flexDirection: "column",
            fontSize: "12px",
            color: "#e0e0e0",
            overflow: "hidden",
        }, "data-testid": "advisory-panel", children: [_jsxs("div", { style: {
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "10px 12px 8px",
                    borderBottom: "1px solid #2a2a2a",
                    background: "#1a1a1a",
                }, children: [_jsxs("span", { style: { fontWeight: 700, fontSize: "13px" }, children: [t("advisory.title"), symbol ? ` — ${symbol}` : ""] }), _jsxs("div", { style: { display: "flex", gap: "6px" }, children: [onRefresh ? (_jsx("button", { onClick: onRefresh, disabled: isLoading, title: t("advisory.refresh"), style: {
                                    background: "none",
                                    border: "1px solid #3a3a3a",
                                    color: "#a0a0a0",
                                    borderRadius: "4px",
                                    cursor: isLoading ? "not-allowed" : "pointer",
                                    padding: "2px 6px",
                                    fontSize: "11px",
                                }, children: "\u21BB" })) : null, onClose ? (_jsx("button", { onClick: onClose, title: t("advisory.close"), style: {
                                    background: "none",
                                    border: "none",
                                    color: "#707070",
                                    cursor: "pointer",
                                    fontSize: "14px",
                                    padding: "0 4px",
                                }, children: "\u00D7" })) : null] })] }), _jsx("div", { style: { flex: 1, overflowY: "auto", padding: "12px" }, children: isLoading ? (_jsxs(_Fragment, { children: [_jsx(SkeletonRow, {}), _jsx(SkeletonRow, {}), _jsx(SkeletonRow, {}), _jsx(SkeletonRow, {})] })) : result ? (_jsxs(_Fragment, { children: [result.decision ? (_jsxs("div", { style: {
                                display: "flex",
                                alignItems: "center",
                                gap: "10px",
                                marginBottom: "12px",
                            }, children: [(() => {
                                    const decisionStyle = DECISION_STYLES[result.decision] ?? DECISION_STYLES.HOLD;
                                    return (_jsx("div", { style: {
                                            flex: 1,
                                            padding: "8px 12px",
                                            borderRadius: "6px",
                                            background: decisionStyle.bg,
                                            color: decisionStyle.color,
                                            fontWeight: 700,
                                            fontSize: "14px",
                                            textAlign: "center",
                                            letterSpacing: "0.5px",
                                        }, "data-testid": "advisory-decision", children: t(`advisory.decision.${result.decision}`) }));
                                })(), _jsxs("div", { style: { textAlign: "center" }, children: [_jsx("div", { style: { color: "#707070", fontSize: "10px" }, children: t("advisory.confidence") }), _jsx("div", { style: { fontWeight: 700, fontSize: "13px" }, children: formatConfidence(result.confidence) })] })] })) : null, _jsx("div", { style: { marginBottom: "8px" }, children: result.agents.map((agent) => (_jsx(AgentRow, { agent: agent, isExpanded: expandedAgent === agent.name, onToggle: () => setExpandedAgent((prev) => prev === agent.name ? null : agent.name) }, agent.name))) }), result.explanation ? (_jsxs("div", { children: [_jsx("button", { onClick: () => setExplanationOpen((v) => !v), style: {
                                        background: "none",
                                        border: "none",
                                        color: "#7090c0",
                                        cursor: "pointer",
                                        fontSize: "11px",
                                        padding: 0,
                                        textDecoration: "underline",
                                    }, children: explanationOpen ? t("advisory.hideSummary") : t("advisory.showSummary") }), explanationOpen ? (_jsx("div", { style: {
                                        marginTop: "8px",
                                        fontSize: "11px",
                                        color: "#b0b0b0",
                                        lineHeight: "1.6",
                                        whiteSpace: "pre-wrap",
                                        wordBreak: "break-word",
                                    }, "data-testid": "advisory-explanation", children: result.explanation })) : null] })) : null, _jsx("div", { style: {
                                marginTop: "10px",
                                fontSize: "10px",
                                color: "#505050",
                                textAlign: "right",
                            }, children: formatTimestamp(result.triggered_at) })] })) : (_jsxs("div", { style: {
                        textAlign: "center",
                        color: "#606060",
                        paddingTop: "24px",
                        fontSize: "12px",
                    }, "data-testid": "advisory-empty", children: [_jsx("div", { style: { fontSize: "24px", marginBottom: "8px" }, children: "\uD83E\uDD16" }), t("advisory.empty")] })) })] }));
}
