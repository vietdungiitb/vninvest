import { useState } from "react";
import {
  ShellPageChrome, ShellPanel,
} from "../../components/ShellPageTemplate.js";
import { ShellEmptyState } from "../../components/ShellEmptyState.js";
import { ShellSkeleton } from "../../components/ShellSkeleton.js";
import { useI18n } from "../../context/LangContext.js";
import { usePortfolio } from "../../context/PortfolioContext.js";
import { useTenantSelfQuery } from "./useTenantSelfQuery.js";

interface MeSummary {
  tenant?: { plan?: string; status?: string; display_name?: string; tenant_code?: string };
  quotas?: { api_calls_limit?: number; period_start?: string | null; period_end?: string | null };
  my?: { total_keys?: number; active_keys?: number; calls_30d?: number };
}

interface TrendPoint {
  date?: string;
  day?: string;
  calls?: number;
  value?: number;
}

export function TenantUsageSummaryPage() {
  const { t } = useI18n();
  const { ability } = usePortfolio() as { ability?: { can?: (a: string, s: string) => boolean } };
  const [tab, setTab] = useState<"meters" | "history">("meters");

  const canRead = ability?.can?.("read", "TenantUsageView") ?? false;

  const summaryQuery = useTenantSelfQuery<MeSummary>(
    ["tenant-self", "summary"], "/partner/me/summary/", { enabled: canRead },
  );
  const analyticsQuery = useTenantSelfQuery<{ results?: Array<{ endpoint?: string; calls?: number }> }>(
    ["tenant-self", "analytics"], "/partner/usage/api-calls/?group_by=endpoint&days=7",
    { enabled: canRead && tab === "meters" },
  );
  const trendQuery = useTenantSelfQuery<{ points?: TrendPoint[]; results?: TrendPoint[] }>(
    ["tenant-self", "trend"], "/partner/dashboard/usage-trend/?days=30",
    { enabled: canRead && tab === "history" },
  );

  if (!canRead) {
    return (
      <ShellPageChrome eyebrow={t("tenantUsageSummary.eyebrow")} title={t("tenantUsageSummary.title")} notice={t("common.noPermission")}>
        <ShellEmptyState description={t("common.noPermission")} />
      </ShellPageChrome>
    );
  }

  if (summaryQuery.isLoading) {
    return (
      <ShellPageChrome eyebrow={t("tenantUsageSummary.eyebrow")} title={t("tenantUsageSummary.title")}>
        <ShellSkeleton variant="card" count={4} />
      </ShellPageChrome>
    );
  }

  const summary = summaryQuery.data;
  const quotaLimit = summary?.quotas?.api_calls_limit;
  const quotaLabel = quotaLimit === -1 || quotaLimit === null || quotaLimit === undefined
    ? t("tenantUsageSummary.unlimited")
    : String(quotaLimit);
  const meters = analyticsQuery.data?.results || [];
  const points = trendQuery.data?.points || trendQuery.data?.results || [];

  const tabBtn = (active: boolean) => ({
    className: active
      ? "rounded-full bg-slate-900 px-4 py-1.5 text-sm font-semibold text-white dark:bg-white dark:text-slate-900"
      : "rounded-full px-4 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800",
  });

  return (
    <ShellPageChrome
      eyebrow={t("tenantUsageSummary.eyebrow")}
      title={t("tenantUsageSummary.title")}
      description={t("tenantUsageSummary.description")}
    >
      <div className="grid gap-4 md:grid-cols-4">
        <ShellPanel title={t("tenantUsageSummary.cardPlan")}>
          <p className="text-lg font-semibold capitalize">{summary?.tenant?.plan || "—"}</p>
          <p className="text-xs text-slate-500">{summary?.tenant?.display_name || summary?.tenant?.tenant_code || ""}</p>
        </ShellPanel>
        <ShellPanel title={t("tenantUsageSummary.cardQuota")}>
          <p className="text-lg font-semibold">{quotaLabel}</p>
          <p className="text-xs text-slate-500">
            {summary?.quotas?.period_start && summary?.quotas?.period_end
              ? `${summary.quotas.period_start} → ${summary.quotas.period_end}`
              : ""}
          </p>
        </ShellPanel>
        <ShellPanel title={t("tenantUsageSummary.cardMyKeys")}>
          <p className="text-lg font-semibold">{summary?.my?.total_keys ?? 0}</p>
          <p className="text-xs text-slate-500">{t("tenantUsageSummary.cardMyCalls")}: {summary?.my?.calls_30d ?? 0}</p>
        </ShellPanel>
        <ShellPanel title={t("tenantUsageSummary.cardMyCalls")}>
          <p className="text-lg font-semibold">{summary?.my?.calls_30d ?? 0}</p>
          <p className="text-xs text-slate-500">30 ngày</p>
        </ShellPanel>
      </div>

      <ShellPanel>
        <div className="mb-4 flex gap-2">
          <button type="button" onClick={() => setTab("meters")} {...tabBtn(tab === "meters")}>
            {t("tenantUsageSummary.tabMeters")}
          </button>
          <button type="button" onClick={() => setTab("history")} {...tabBtn(tab === "history")}>
            {t("tenantUsageSummary.tabHistory")}
          </button>
        </div>

        {tab === "meters" && (
          meters.length === 0 ? (
            <ShellEmptyState description={t("tenantUsageSummary.emptyMeters")} />
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500 dark:bg-slate-800/50">
                  <tr><th className="px-4 py-2">Endpoint</th><th className="px-4 py-2 text-right">Calls</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {meters.map((m, i) => (
                    <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                      <td className="px-4 py-2 font-mono text-xs">{m.endpoint}</td>
                      <td className="px-4 py-2 text-right font-semibold">{m.calls}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}

        {tab === "history" && (
          points.length === 0 ? (
            <ShellEmptyState description={t("tenantUsageSummary.emptyHistory")} />
          ) : (
            <ul className="space-y-1 text-sm">
              {points.map((p, i) => (
                <li key={i} className="flex justify-between rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800/50">
                  <span>{p.date || p.day}</span><span className="font-semibold">{p.calls ?? p.value}</span>
                </li>
              ))}
            </ul>
          )
        )}
      </ShellPanel>
    </ShellPageChrome>
  );
}
