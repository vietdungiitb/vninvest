import { useEffect, useState, useCallback } from "react";
import { ShellPageChrome, ShellPanel, renderShellMetric } from "../../components/ShellPageTemplate.js";
import { ShellEmptyState } from "../../components/ShellEmptyState.js";
import { ShellSkeleton } from "../../components/ShellSkeleton.js";
import { defaultCoreApiAdapter } from "../../adapters/coreApiAdapter.js";
import { useI18n } from "../../context/LangContext.js";
import { usePortfolio } from "../../context/PortfolioContext.js";
import { useToast } from "../../components/ShellToast.js";
import { useConfirm } from "../../components/ConfirmModal.js";

interface ScheduledReport {
  id: number;
  name: string;
  report_type: string;
  schedule: string;
  recipients: string[];
  format: string;
  is_active: boolean;
  last_sent_at: string | null;
  total_deliveries: number;
  created_at: string;
}

interface TenantAdminReportsPageProps {
  env?: Record<string, unknown>;
  fetchImpl?: unknown;
  bootstrapLoader?: unknown;
  autoLoad?: boolean;
  initialSnapshot?: Record<string, unknown> | null;
}

interface FormData {
  name: string;
  report_type: string;
  schedule: string;
  format: string;
  recipients: string[];
}

const REPORT_TYPES = ["usage_summary", "billing_summary", "security_digest", "audit_log"] as const;
const SCHEDULES = ["daily", "weekly_mon", "weekly_fri", "monthly_1", "monthly_15"] as const;
const FORMATS = ["html", "csv"] as const;

function getReportTypeLabel(type: string, t: (k: string, opts?: object) => string): string {
  const map: Record<string, string> = {
    usage_summary: t("tenantReports.typeUsageSummary"),
    billing_summary: t("tenantReports.typeBillingSummary"),
    security_digest: t("tenantReports.typeSecurityDigest"),
    audit_log: t("tenantReports.typeAuditLog"),
  };
  return map[type] || type;
}

function getScheduleLabel(schedule: string, t: (k: string, opts?: object) => string): string {
  const map: Record<string, string> = {
    daily: t("tenantReports.scheduleDaily"),
    weekly_mon: t("tenantReports.scheduleWeeklyMon"),
    weekly_fri: t("tenantReports.scheduleWeeklyFri"),
    monthly_1: t("tenantReports.scheduleMonthly1"),
    monthly_15: t("tenantReports.scheduleMonthly15"),
  };
  return map[schedule] || schedule;
}

function formatDateField(value: string | null | undefined, fmtDate: (d: string) => string): string {
  if (!value) return "\u2014";
  return fmtDate(value);
}

export function TenantAdminReportsPage({}: TenantAdminReportsPageProps) {
  const { t, formatDate: fmtDate } = useI18n();
  const { ability } = usePortfolio();
  const toast = useToast();
  const confirm = useConfirm();

  const [reports, setReports] = useState<ScheduledReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>(undefined);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    name: "",
    report_type: "usage_summary",
    schedule: "daily",
    format: "html",
    recipients: [""],
  });
  const [saving, setSaving] = useState(false);
  const [testingId, setTestingId] = useState<number | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(undefined);
      const data = await defaultCoreApiAdapter.getScheduledReports();
      setReports(Array.isArray(data) ? data : []);
    } catch (err) {
      setError((err as Error).message || t("tenantReports.loadError"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreate = async () => {
    if (!formData.name.trim()) return;
    const payload = {
      ...formData,
      recipients: formData.recipients.filter(r => r.trim()),
    };
    if (payload.recipients.length === 0) return;
    try {
      setSaving(true);
      await defaultCoreApiAdapter.createScheduledReport(payload);
      setShowCreateModal(false);
      setFormData({ name: "", report_type: "usage_summary", schedule: "daily", format: "html", recipients: [""] });
      await loadData();
    } catch (err) {
      setError((err as Error).message || t("tenantReports.createError"));
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (report: ScheduledReport) => {
    try {
      await defaultCoreApiAdapter.updateScheduledReport(report.id, { is_active: !report.is_active });
      await loadData();
    } catch (err) {
      setError((err as Error).message || t("tenantReports.updateError"));
    }
  };

  const handleDelete = async (report: ScheduledReport) => {
    const ok = await confirm({ title: t("common.delete"), message: t("tenantReports.deleteConfirm", { name: report.name }) });
    if (!ok) return;
    try {
      await defaultCoreApiAdapter.deleteScheduledReport(report.id);
      await loadData();
    } catch (err) {
      setError((err as Error).message || t("tenantReports.deleteError"));
    }
  };

  const handleTest = async (report: ScheduledReport) => {
    try {
      setTestingId(report.id);
      await defaultCoreApiAdapter.testScheduledReport(report.id);
      toast.success(t("tenantReports.testQueued"));
    } catch (err) {
      setError((err as Error).message || t("tenantReports.testError"));
    } finally {
      setTestingId(null);
    }
  };

  const canManage = ability?.can?.("manage", "TenantReportsView") ?? true;

  const activeReports = reports.filter(r => r.is_active).length;
  const totalDeliveries = reports.reduce((s, r) => s + r.total_deliveries, 0);

  const metrics = [
    renderShellMetric(t("tenantReports.metricActive"), String(activeReports)),
    renderShellMetric(t("tenantReports.metricTotal"), String(reports.length)),
    renderShellMetric(t("tenantReports.metricDeliveries"), String(totalDeliveries)),
  ];

  const createAction = canManage ? (
    <button onClick={() => setShowCreateModal(true)} className="shellPage__button shellPage__button--primary">
      {t("tenantReports.createAction")}
    </button>
  ) : null;

  if (!canManage && reports.length === 0) {
    return (
      <ShellPageChrome
        eyebrow={t("tenantReports.eyebrow")}
        title={t("tenantReports.title")}
        description={t("tenantReports.description")}
        notice={t("common.noPermission")}
      />
    );
  }

  if (loading && reports.length === 0) {
    return (
      <ShellPageChrome
        eyebrow={t("tenantReports.eyebrow")}
        title={t("tenantReports.title")}
        description={t("common.loading")}
      >
        <ShellSkeleton variant="metric" count={2} />
        <div style={{ height: 16 }} />
        <ShellSkeleton variant="table-row" count={5} />
      </ShellPageChrome>
    );
  }

  return (
    <ShellPageChrome
      eyebrow={t("tenantReports.eyebrow")}
      title={t("tenantReports.title")}
      description={t("tenantReports.description")}
      metrics={metrics}
      error={error || undefined}
    >
      <div className="shellPage__stack">
        {reports.length === 0 ? (
          <ShellPanel title={t("tenantReports.listTitle")} actions={canManage ? createAction : null}>
            <ShellEmptyState description={t("tenantReports.empty")} ctaLabel={t("tenantReports.createAction")} ctaOnClick={() => setShowCreateModal(true)} />
          </ShellPanel>
        ) : (
          <ShellPanel title={t("tenantReports.listTitle")} subtitle={`${reports.length}`} actions={canManage ? createAction : null}>
            <div className="shellPage__list">
              {reports.map(report => (
                <div key={report.id} className="shellPage__listItem" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div className="shellPage__itemTitle" style={{ fontSize: "14px" }}>
                      {report.name}
                      {!report.is_active && <span style={{ color: "#f59e0b", marginLeft: "8px", fontSize: "11px" }}>({t("tenantReports.paused")})</span>}
                    </div>
                    <div className="shellPage__itemMeta" style={{ marginTop: "2px" }}>
                      {getReportTypeLabel(report.report_type, t)} · {getScheduleLabel(report.schedule, t)} · {report.format.toUpperCase()}
                    </div>
                    <div className="shellPage__itemMeta" style={{ marginTop: "2px" }}>
                      {t("tenantReports.recipients")}: {report.recipients.join(", ")}
                    </div>
                    <div className="shellPage__itemMeta" style={{ marginTop: "2px" }}>
                      {t("tenantReports.lastSent")}: {formatDateField(report.last_sent_at, fmtDate)} · {t("tenantReports.deliveries")}: {report.total_deliveries}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                    {canManage && (
                      <>
                        <button onClick={() => handleToggleActive(report)} className="shellPage__button shellPage__button--secondary" style={{ fontSize: "11px", padding: "4px 8px" }}>
                          {report.is_active ? t("tenantReports.pauseAction") : t("tenantReports.resumeAction")}
                        </button>
                        <button onClick={() => handleTest(report)} disabled={testingId === report.id} className="shellPage__button shellPage__button--secondary" style={{ fontSize: "11px", padding: "4px 8px" }}>
                          {testingId === report.id ? "..." : t("tenantReports.testAction")}
                        </button>
                        <button onClick={() => handleDelete(report)} className="shellPage__button shellPage__button--danger" style={{ fontSize: "11px", padding: "4px 8px" }}>
                          {t("tenantReports.deleteAction")}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </ShellPanel>
        )}
      </div>

      {showCreateModal && (
        <div className="shellPage__modal" onClick={() => setShowCreateModal(false)}>
          <div className="shellPage__modalContent" onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: "0 0 16px", color: "#cbd5e1" }}>{t("tenantReports.createTitle")}</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <label style={{ fontSize: "12px", color: "#94a3b8" }}>{t("tenantReports.nameLabel")}</label>
              <input
                type="text"
                value={formData.name}
                onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                className="shellPage__input"
                placeholder={t("tenantReports.namePlaceholder")}
              />
              <label style={{ fontSize: "12px", color: "#94a3b8" }}>{t("tenantReports.typeLabel")}</label>
              <select
                value={formData.report_type}
                onChange={e => setFormData(prev => ({ ...prev, report_type: e.target.value }))}
                className="shellPage__input"
              >
                {REPORT_TYPES.map(type => (
                  <option key={type} value={type}>{getReportTypeLabel(type, t)}</option>
                ))}
              </select>
              <label style={{ fontSize: "12px", color: "#94a3b8" }}>{t("tenantReports.scheduleLabel")}</label>
              <select
                value={formData.schedule}
                onChange={e => setFormData(prev => ({ ...prev, schedule: e.target.value }))}
                className="shellPage__input"
              >
                {SCHEDULES.map(sch => (
                  <option key={sch} value={sch}>{getScheduleLabel(sch, t)}</option>
                ))}
              </select>
              <label style={{ fontSize: "12px", color: "#94a3b8" }}>{t("tenantReports.formatLabel")}</label>
              <div style={{ display: "flex", gap: "12px" }}>
                {FORMATS.map(fmt => (
                  <label key={fmt} style={{ fontSize: "13px", color: "#cbd5e1", display: "flex", alignItems: "center", gap: "4px" }}>
                    <input
                      type="radio"
                      name="format"
                      value={fmt}
                      checked={formData.format === fmt}
                      onChange={e => setFormData(prev => ({ ...prev, format: e.target.value }))}
                    />
                    {fmt.toUpperCase()}
                  </label>
                ))}
              </div>
              <label style={{ fontSize: "12px", color: "#94a3b8" }}>{t("tenantReports.recipientsLabel")}</label>
              {formData.recipients.map((recipient, i) => (
                <div key={i} style={{ display: "flex", gap: "6px" }}>
                  <input
                    type="email"
                    value={recipient}
                    onChange={e => {
                      const updated = [...formData.recipients];
                      updated[i] = e.target.value;
                      setFormData(prev => ({ ...prev, recipients: updated }));
                    }}
                    className="shellPage__input"
                    placeholder="email@example.com"
                  />
                  {formData.recipients.length > 1 && (
                    <button
                      onClick={() => setFormData(prev => ({ ...prev, recipients: prev.recipients.filter((_, j) => j !== i) }))}
                      className="shellPage__button shellPage__button--danger"
                      style={{ fontSize: "11px", padding: "4px 8px" }}
                    >
                      &times;
                    </button>
                  )}
                  {i === formData.recipients.length - 1 && (
                    <button
                      onClick={() => setFormData(prev => ({ ...prev, recipients: [...prev.recipients, ""] }))}
                      className="shellPage__button shellPage__button--secondary"
                      style={{ fontSize: "11px", padding: "4px 8px" }}
                    >
                      +{t("tenantReports.addRecipient")}
                    </button>
                  )}
                </div>
              ))}
              <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end", marginTop: "8px" }}>
                <button onClick={() => setShowCreateModal(false)} className="shellPage__button shellPage__button--secondary">
                  {t("tenantReports.cancelAction")}
                </button>
                <button onClick={handleCreate} disabled={saving} className="shellPage__button shellPage__button--primary">
                  {saving ? "..." : t("tenantReports.createAction")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </ShellPageChrome>
  );
}
