import { createElement, useState } from "react";
import { coreApiAdapter } from "../../adapters/coreApiAdapter.js";
import { tenantIdStorage } from "../../adapters/core/transport.js";
import { useI18n } from "../../context/LangContext.js";
import { useTenantAdminQuery, TENANT_ADMIN_QUERY_SCOPE } from "../../pages/tenant-admin/useTenantAdminQuery.js";
import { useQueryClient } from "@tanstack/react-query";
import type { ScreenerRule as Rule } from "../../types/screener.d.ts";

interface ScreenerCommunityProps {
  // Fork a public rule into my own list, then run it (page flow).
  onForkRun: (rule: Rule) => Promise<void>;
  // Fork only (page flow shows notice + invalidates rules).
  onFork: (rule: Rule) => Promise<void>;
}

export function ScreenerCommunity({ onForkRun, onFork }: ScreenerCommunityProps) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const { data: publicData } = useTenantAdminQuery<Rule[]>(
    ['screener', 'public'],
    '/screener/rules/public/',
    { queryFn: () => (coreApiAdapter as any).getScreenerPublicRules().then((d: any) => (Array.isArray(d) ? d : d.results || [])) },
  );
  const items: Rule[] = (publicData as unknown as Rule[] | undefined) ?? [];
  const [busyId, setBusyId] = useState<number | null>(null);
  const [mode, setMode] = useState<"run" | "fork" | null>(null);

  const invalidate = () => {
    const tenantId = typeof window !== 'undefined' ? tenantIdStorage.getTenantId() : null;
    queryClient.invalidateQueries({ queryKey: [TENANT_ADMIN_QUERY_SCOPE, tenantId ?? 'none', 'screener', 'rules'] });
    queryClient.invalidateQueries({ queryKey: [TENANT_ADMIN_QUERY_SCOPE, tenantId ?? 'none', 'screener', 'public'] });
  };

  const handleAction = async (rule: Rule, kind: "run" | "fork") => {
    if (rule.id == null) return;
    setBusyId(rule.id);
    setMode(kind);
    try {
      const created = await (coreApiAdapter as any).forkScreenerRule(rule.id);
      invalidate();
      if (kind === "run") await onForkRun(created);
      else await onFork(created);
    } catch {
      /* page surfaces error via notice */
    } finally {
      setBusyId(null);
      setMode(null);
    }
  };

  return createElement(
    "div",
    {
      style: {
        background: "var(--bg-panel, #0f172a)",
        border: "1px solid var(--border-default, rgba(80, 120, 168, 0.28))",
        borderRadius: "12px",
        padding: "20px",
        display: "flex",
        flexDirection: "column",
        gap: "12px",
      },
    },
    createElement(
      "h3",
      { style: { margin: 0, fontSize: "14px", fontWeight: 600, color: "var(--text-secondary, #94a3b8)" } },
      t("screener.community.title", { defaultValue: "Preset cộng đồng" }),
    ),
    createElement(
      "p",
      { style: { margin: 0, fontSize: "12px", color: "var(--text-muted, #94a3b8)" } },
      t("screener.community.hint", { defaultValue: "Bộ lọc do thành viên cùng tenant chia sẻ. Lưu bản sao để chạy và tùy biến riêng." }),
    ),
    items.length === 0
      ? createElement(
          "p",
          { style: { margin: 0, fontSize: "13px", color: "var(--text-muted, #94a3b8)" } },
          t("screener.community.empty", { defaultValue: "Chưa có preset nào được chia sẻ. Bật “Chia sẻ” ở rule của bạn để đóng góp." }),
        )
      : createElement(
          "div",
          {
            style: {
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
              gap: "12px",
            },
          },
          items.map((rule) =>
            createElement(
              "div",
              {
                key: rule.id,
                style: {
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                  padding: "14px",
                  background: "rgba(15,23,42,0.35)",
                  border: "1px solid var(--border-default, rgba(80, 120, 168, 0.28))",
                  borderRadius: "10px",
                },
              },
              createElement(
                "p",
                { style: { margin: 0, fontSize: "13px", fontWeight: 600, color: "var(--text-primary, #f1f5f9)" } },
                rule.name,
              ),
              createElement(
                "p",
                { style: { margin: 0, fontSize: "12px", color: "var(--text-muted, #94a3b8)" } },
                t("screener.community.byOwner", {
                  owner: rule.owner_username ?? "—",
                  count: Array.isArray(rule.rules_json) ? rule.rules_json.length : 0,
                  defaultValue: `Bởi ${rule.owner_username ?? "—"} · ${Array.isArray(rule.rules_json) ? rule.rules_json.length : 0} điều kiện`,
                }),
              ),
              createElement(
                "div",
                { style: { display: "flex", gap: "8px" } },
                createElement(
                  "button",
                  {
                    type: "button",
                    disabled: busyId === rule.id,
                    onClick: () => handleAction(rule, "run"),
                    "aria-label": "fork-run",
                    style: {
                      flex: 1, padding: "6px 12px",
                      background: "var(--accent-cyan, #06b6d4)", color: "#fff",
                      fontSize: "12px", borderRadius: "6px", border: "none",
                      cursor: busyId === rule.id ? "not-allowed" : "pointer",
                      fontWeight: 500, opacity: busyId === rule.id && mode === "run" ? 0.7 : 1,
                    },
                  },
                  busyId === rule.id && mode === "run"
                    ? t("screener.running")
                    : t("screener.community.forkRun", { defaultValue: "Lưu & Chạy" }),
                ),
                createElement(
                  "button",
                  {
                    type: "button",
                    disabled: busyId === rule.id,
                    onClick: () => handleAction(rule, "fork"),
                    "aria-label": "fork-only",
                    style: {
                      flex: 1, padding: "6px 12px",
                      background: "rgba(15,23,42,0.6)",
                      border: "1px solid var(--border-default, rgba(80, 120, 168, 0.28))",
                      color: "var(--text-primary, #f1f5f9)",
                      fontSize: "12px", borderRadius: "6px",
                      cursor: busyId === rule.id ? "not-allowed" : "pointer",
                      fontWeight: 500, opacity: busyId === rule.id && mode === "fork" ? 0.7 : 1,
                    },
                  },
                  busyId === rule.id && mode === "fork"
                    ? t("screener.running")
                    : t("screener.community.forkOnly", { defaultValue: "Lưu bản sao" }),
                ),
              ),
            ),
          ),
        ),
  );
}

export default ScreenerCommunity;
