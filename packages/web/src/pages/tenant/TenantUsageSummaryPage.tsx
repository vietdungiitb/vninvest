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
  const meters = analyticsQuery.data?.results || [];
  const points = trendQuery.data?.points || trendQuery.data?.results || [];

  return (
    <ShellPageChrome
      eyebrow={t("tenantUsageSummary.eyebrow")}
      title={t("tenantUsageSummary.title")}
      description={t("tenantUsageSummary.description")}
    >
      <ShellPanel title={t("tenantUsageSummary.title")}>
        <div>
          <div>{t("tenantUsageSummary.cardPlan")}: {summary?.tenant?.plan || "—"}</div>
          <div>{t("tenantUsageSummary.cardQuota")}: {summary?.quotas?.api_calls_limit ?? "—"}</div>
          <div>{t("tenantUsageSummary.cardMyKeys")}: {summary?.my?.total_keys ?? 0}</div>
          <div>{t("tenantUsageSummary.cardMyCalls")}: {summary?.my?.calls_30d ?? 0}</div>
        </div>

        <div>
          <button type="button" onClick={() => setTab("meters")}>
            {t("tenantUsageSummary.tabMeters")}
          </button>
          <button type="button" onClick={() => setTab("history")}>
            {t("tenantUsageSummary.tabHistory")}
          </button>
        </div>

        {tab === "meters" && (
          meters.length === 0 ? (
            <ShellEmptyState description={t("tenantUsageSummary.tabMeters")} />
          ) : (
            <table>
              <tbody>
                {meters.map((m, i) => (
                  <tr key={i}>
                    <td>{m.endpoint}</td>
                    <td>{m.calls}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        )}

        {tab === "history" && (
          points.length === 0 ? (
            <ShellEmptyState description={t("tenantUsageSummary.tabHistory")} />
          ) : (
            <ul>
              {points.map((p, i) => (
                <li key={i}>{p.date || p.day}: {p.calls ?? p.value}</li>
              ))}
            </ul>
          )
        )}
      </ShellPanel>
    </ShellPageChrome>
  );
}
