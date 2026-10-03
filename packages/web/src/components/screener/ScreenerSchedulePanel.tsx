import { createElement, useState } from "react";
import { coreApiAdapter } from "../../adapters/coreApiAdapter.js";
import { tenantIdStorage } from "../../adapters/core/transport.js";
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
  const { t, localeTag } = useI18n() as { t: (k: string, o?: any) => string; localeTag?: string };
  const tag = localeTag || "vi-VN";
  const dayLabel = (wd: number) => {
    try {
      // 2026-01-05 is a Monday; +wd days gives the matching weekday name.
      return new Intl.DateTimeFormat(tag, { weekday: "short" }).format(new Date(2026, 0, 5 + wd));
    } catch {
      return `T${wd + 1}`;
    }
  };
  const fmtDateTime = (iso: string | null) => {
    if (!iso) return "—";
    try {
      return new Date(iso).toLocaleString(tag);
    } catch {
      return iso;
    }
  };
  const ruleName = (id: number) => rules.find((r) => r.id === id)?.name ?? `#${id}`;
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
  // UE-06: selectable run days (default Mon–Fri) + notify channels (default in-app).
  const [weekdays, setWeekdays] = useState<number[]>([0, 1, 2, 3, 4]);
  const [channels, setChannels] = useState<string[]>(["in_app"]);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const toggleWeekday = (wd: number) => {
    setWeekdays((prev) => (prev.includes(wd) ? prev.filter((d) => d !== wd) : [...prev, wd].sort()));
  };

  const toggleChannel = (ch: string) => {
    setChannels((prev) => (prev.includes(ch) ? prev.filter((c) => c !== ch) : [...prev, ch]));
  };

  const invalidate = () => {
    const tenantId = typeof window !== 'undefined' ? tenantIdStorage.getTenantId() : null;
    queryClient.invalidateQueries({ queryKey: [TENANT_ADMIN_QUERY_SCOPE, tenantId ?? 'none', 'screener', 'schedules'] });
    queryClient.invalidateQueries({ queryKey: [TENANT_ADMIN_QUERY_SCOPE, tenantId ?? 'none', 'screener', 'schedule-alerts'] });
  };

  const handleCreate = async () => {
    if (!name.trim() || !ruleId) { setErr(t("screener.schedule.errorRequired")); return; }
    if (weekdays.length === 0) { setErr(t("screener.schedule.weekdaysRequired")); return; }
    setSaving(true);
    setErr("");
    try {
      await (coreApiAdapter as any).createScreenerSchedule({ name: name.trim(), rule_ids: [parseInt(ruleId, 10)], run_time: runTime, weekdays, notify_channels: channels.length ? channels : ["in_app"] });
      setName("");
      setRuleId("");
      invalidate();
    } catch (e: any) {
      setErr(e?.response?.data?.detail || t("screener.schedule.createFailed"));
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
    createElement("h2", { style: { fontSize: "16px", fontWeight: 600, color: "var(--text-primary, #f1f5f9)", margin: 0 } }, t("screener.schedule.title")),
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
        value: name, onChange: (e: any) => setName(e.target.value), placeholder: t("screener.schedule.namePlaceholder"),
        style: { flex: "1", minWidth: "160px", background: "rgba(15,23,42,0.6)", border: "1px solid var(--border-default, rgba(80, 120, 168, 0.28))", color: "var(--text-primary, #f1f5f9)", fontSize: "13px", borderRadius: "6px", padding: "6px 10px", outline: "none" },
      }),
      createElement(
        "select",
        {
          value: ruleId, onChange: (e: any) => setRuleId(e.target.value),
          style: { background: "rgba(15,23,42,0.6)", border: "1px solid var(--border-default, rgba(80, 120, 168, 0.28))", color: "var(--text-primary, #f1f5f9)", fontSize: "13px", borderRadius: "6px", padding: "6px 10px" },
        },
        createElement("option", { value: "" }, t("screener.schedule.ruleOption")),
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
        t("screener.schedule.create")
      )
    ),
    // UE-06: run-day picker + notify channels.
    createElement(
      "div",
      { style: { display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "center" } },
      createElement("span", { style: { fontSize: "12px", color: "var(--text-muted, #94a3b8)" } }, t("screener.schedule.weekdaysLabel")),
      createElement(
        "div",
        { style: { display: "flex", gap: "4px" } },
        ...[0, 1, 2, 3, 4, 5, 6].map((wd) => {
          const on = weekdays.includes(wd);
          return createElement(
            "button",
            {
              key: wd, type: "button", onClick: () => toggleWeekday(wd), title: dayLabel(wd),
              style: {
                fontSize: "11px", padding: "3px 8px", borderRadius: "6px", cursor: "pointer",
                background: on ? "rgba(34,211,238,0.2)" : "rgba(15,23,42,0.6)",
                border: on ? "1px solid rgba(34,211,238,0.4)" : "1px solid var(--border-default, rgba(80, 120, 168, 0.28))",
                color: on ? "#22d3ee" : "var(--text-secondary, #94a3b8)",
              },
            },
            dayLabel(wd)
          );
        })
      ),
      createElement("span", { style: { fontSize: "12px", color: "var(--text-muted, #94a3b8)" } }, t("screener.schedule.channelsLabel")),
      ...(["in_app", "email"] as const).map((ch) =>
        createElement(
          "label",
          { key: ch, style: { display: "flex", alignItems: "center", gap: "4px", fontSize: "12px", color: "var(--text-secondary, #94a3b8)", cursor: "pointer" } },
          createElement("input", { type: "checkbox", checked: channels.includes(ch), onChange: () => toggleChannel(ch) }),
          t(ch === "in_app" ? "screener.schedule.channelInApp" : "screener.schedule.channelEmail")
        )
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
          createElement("span", { style: { fontSize: "13px", color: "var(--text-primary, #f1f5f9)", fontWeight: 600 } }, `${s.name} · ${s.run_time ?? "?"} · ${(s.weekdays || []).map(dayLabel).join(" ")}`),
          createElement("span", { style: { fontSize: "11px", color: "var(--text-muted, #94a3b8)" } }, `${t("screener.schedule.rulesLabel")}: ${(s.rule_ids || []).map(ruleName).join(", ")} · ${t("screener.schedule.nextRun")}: ${fmtDateTime(s.next_run_at)} · ${s.is_active ? t("screener.schedule.enable") : t("screener.schedule.disable")}`)
        ),
        createElement(
          "div",
          { style: { display: "flex", gap: "6px" } },
          createElement("button", { type: "button", onClick: () => { void handleRunNow(s); }, style: { fontSize: "12px", color: "#4ade80", background: "none", border: "1px solid rgba(74,222,128,0.3)", borderRadius: "6px", padding: "4px 10px", cursor: "pointer" } }, t("screener.schedule.runNow")),
          createElement("button", { type: "button", onClick: () => { void handleToggle(s); }, style: { fontSize: "12px", color: "var(--text-secondary, #94a3b8)", background: "none", border: "1px solid var(--border-default, rgba(80, 120, 168, 0.28))", borderRadius: "6px", padding: "4px 10px", cursor: "pointer" } }, s.is_active ? t("screener.schedule.disable") : t("screener.schedule.enable")),
          createElement("button", { type: "button", title: t("screener.schedule.deleteTitle"), onClick: () => { void handleDelete(s); }, style: { fontSize: "12px", color: "#f87171", background: "none", border: "none", cursor: "pointer" } }, "✕")
        )
      )
    ),
    schedules.length === 0 && createElement("p", { style: { fontSize: "12px", color: "var(--text-muted, #94a3b8)", margin: 0 } }, t("screener.schedule.empty"))
  );
}
