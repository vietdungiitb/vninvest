import { createElement, useState } from "react";
import { coreApiAdapter } from "../../adapters/coreApiAdapter.js";
import { useI18n } from "../../context/LangContext.js";
import { useTenantAdminQuery, TENANT_ADMIN_QUERY_SCOPE } from "../../pages/tenant-admin/useTenantAdminQuery.js";
import { useQueryClient } from "@tanstack/react-query";
import type { ScreenerRule as Rule } from "../../types/screener.d.ts";

interface Schedule {
  id: number;
  name: string;
  rule_ids: number[];
  run_time: string | null;
  weekdays: number[];
  is_active: boolean;
  notify_channels: string[];
  last_run_at: string | null;
  next_run_at: string | null;
}

interface AlertItem {
  rule_id: number;
  rule_name: string;
  run_at: string;
  new_symbols: string[];
  matched_count: number;
  job_id: string;
}

export function ScreenerSchedulePanel({ rules }: { rules: Rule[] }) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const { data: schedData } = useTenantAdminQuery<Schedule[]>(
    ['screener', 'schedules'],
    '/screener/schedules/',
    { queryFn: () => (coreApiAdapter as any).getScreenerSchedules().then((d: any) => (Array.isArray(d) ? d : d.results || [])) },
  );
  const { data: alertsData } = useTenantAdminQuery<{ results?: AlertItem[] }>(
    ['screener', 'schedule-alerts'],
    '/screener/schedules/alerts/',
    { queryFn: () => (coreApiAdapter as any).getScreenerScheduleAlerts().catch(() => ({ results: [] })) },
  );
  const schedules: Schedule[] = (schedData as unknown as Schedule[] | undefined) ?? [];
  const alerts: AlertItem[] = ((alertsData as any)?.results as AlertItem[] | undefined) ?? [];
  const [name, setName] = useState("");
  const [runTime, setRunTime] = useState("18:00");
  const [ruleId, setRuleId] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const invalidate = () => {
    const tenantId = typeof window !== 'undefined' ? window.localStorage.getItem('tenant_id') : null;
    queryClient.invalidateQueries({ queryKey: [TENANT_ADMIN_QUERY_SCOPE, tenantId ?? 'none', 'screener', 'schedules'] });
    queryClient.invalidateQueries({ queryKey: [TENANT_ADMIN_QUERY_SCOPE, tenantId ?? 'none', 'screener', 'schedule-alerts'] });
  };

  const handleCreate = async () => {
    if (!name.trim() || !ruleId) { setErr("Tên và rule là bắt buộc."); return; }
    setSaving(true);
    setErr("");
    try {
      await (coreApiAdapter as any).createScreenerSchedule({ name: name.trim(), rule_ids: [parseInt(ruleId, 10)], run_time: runTime, weekdays: [0, 1, 2, 3, 4], notify_channels: ["in_app"] });
      setName("");
      setRuleId("");
      invalidate();
    } catch (e: any) {
      setErr(e?.response?.data?.detail || "Tạo lịch thất bại.");
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (s: Schedule) => {
    try {
      await (coreApiAdapter as any).updateScreenerSchedule(s.id, { is_active: !s.is_active });
      invalidate();
    } catch { /* ignore */ }
  };

  const handleDelete = async (s: Schedule) => {
    try {
      await (coreApiAdapter as any).deleteScreenerSchedule(s.id);
      invalidate();
    } catch { /* ignore */ }
  };

  const handleRunNow = async (s: Schedule) => {
    try {
      await (coreApiAdapter as any).runScreenerScheduleNow(s.id);
      invalidate();
    } catch { /* ignore */ }
  };

  return createElement(
    "div",
    { style: { background: "var(--bg-panel, #0f172a)", border: "1px solid var(--border-default, rgba(80, 120, 168, 0.28))", borderRadius: "12px", padding: "20px", display: "flex", flexDirection: "column", gap: "12px" } },
    createElement("h2", { style: { fontSize: "16px", fontWeight: 600, color: "var(--text-primary, #f1f5f9)", margin: 0 } }, t("screener.schedule.title" as any, { defaultValue: "Lịch quét tự động" } as any)),
    alerts.length > 0 &&
      createElement(
        "div",
        { style: { display: "flex", flexDirection: "column", gap: "6px" } },
        ...alerts.slice(0, 5).map((a, i) =>
          createElement(
            "div",
            { key: `${a.job_id}-${i}`, style: { fontSize: "12px", color: "#86efac", background: "rgba(74,222,128,0.12)", border: "1px solid rgba(74,222,128,0.4)", borderRadius: "8px", padding: "8px 12px" } },
            `${a.rule_name}: +${a.new_symbols.length} mã mới (${a.new_symbols.slice(0, 5).join(", ")})`
          )
        )
      ),
    createElement(
      "div",
      { style: { display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" } },
      createElement("input", {
        value: name, onChange: (e: any) => setName(e.target.value), placeholder: "Tên lịch (VD: Chiều T2-T6)",
        style: { flex: "1", minWidth: "160px", background: "rgba(15,23,42,0.6)", border: "1px solid var(--border-default, rgba(80, 120, 168, 0.28))", color: "var(--text-primary, #f1f5f9)", fontSize: "13px", borderRadius: "6px", padding: "6px 10px", outline: "none" },
      }),
      createElement(
        "select",
        {
          value: ruleId, onChange: (e: any) => setRuleId(e.target.value),
          style: { background: "rgba(15,23,42,0.6)", border: "1px solid var(--border-default, rgba(80, 120, 168, 0.28))", color: "var(--text-primary, #f1f5f9)", fontSize: "13px", borderRadius: "6px", padding: "6px 10px" },
        },
        createElement("option", { value: "" }, "— Rule —"),
        ...rules.filter((r) => r.id != null).map((r) => createElement("option", { key: r.id, value: String(r.id) }, r.name))
      ),
      createElement("input", {
        type: "time", value: runTime, onChange: (e: any) => setRunTime(e.target.value),
        style: { background: "rgba(15,23,42,0.6)", border: "1px solid var(--border-default, rgba(80, 120, 168, 0.28))", color: "var(--text-primary, #f1f5f9)", fontSize: "13px", borderRadius: "6px", padding: "6px 10px" },
      }),
      createElement(
        "button",
        {
          type: "button", onClick: () => { void handleCreate(); }, disabled: saving,
          style: { padding: "6px 14px", background: "var(--accent-cyan, #06b6d4)", color: "#fff", fontSize: "13px", borderRadius: "8px", border: "none", cursor: saving ? "wait" : "pointer", fontWeight: 600, opacity: saving ? 0.6 : 1 },
        },
        t("screener.schedule.create" as any, { defaultValue: "+ Tạo lịch" } as any)
      )
    ),
    err && createElement("p", { style: { color: "#fca5a5", fontSize: "12px", margin: 0 } }, err),
    ...schedules.map((s) =>
      createElement(
        "div",
        { key: s.id, style: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", flexWrap: "wrap", borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: "8px" } },
        createElement(
          "div",
          { style: { display: "flex", flexDirection: "column", gap: "2px" } },
          createElement("span", { style: { fontSize: "13px", color: "var(--text-primary, #f1f5f9)", fontWeight: 600 } }, `${s.name} · ${s.run_time ?? "?"} · T2-T6`),
          createElement("span", { style: { fontSize: "11px", color: "var(--text-muted, #94a3b8)" } }, `Rules: ${(s.rule_ids || []).join(", ")} · Tiếp: ${s.next_run_at ?? "—"} · ${s.is_active ? "Bật" : "Tắt"}`)
        ),
        createElement(
          "div",
          { style: { display: "flex", gap: "6px" } },
          createElement("button", { type: "button", onClick: () => { void handleRunNow(s); }, style: { fontSize: "12px", color: "#4ade80", background: "none", border: "1px solid rgba(74,222,128,0.3)", borderRadius: "6px", padding: "4px 10px", cursor: "pointer" } }, "Chạy ngay"),
          createElement("button", { type: "button", onClick: () => { void handleToggle(s); }, style: { fontSize: "12px", color: "var(--text-secondary, #94a3b8)", background: "none", border: "1px solid var(--border-default, rgba(80, 120, 168, 0.28))", borderRadius: "6px", padding: "4px 10px", cursor: "pointer" } }, s.is_active ? "Tắt" : "Bật"),
          createElement("button", { type: "button", onClick: () => { void handleDelete(s); }, style: { fontSize: "12px", color: "#f87171", background: "none", border: "none", cursor: "pointer" } }, "✕")
        )
      )
    ),
    schedules.length === 0 && createElement("p", { style: { fontSize: "12px", color: "var(--text-muted, #94a3b8)", margin: 0 } }, t("screener.schedule.empty" as any, { defaultValue: "Chưa có lịch nào. Tạo lịch để tự quét sau đóng phiên." } as any))
  );
}
