import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useI18n } from "@/context/LangContext.js";
import { usePortfolio } from "@/context/PortfolioContext.js";
import { LayoutDashboard, Users, Key, Fingerprint, Activity, CreditCard, ShieldCheck, FileText, ScrollText, Globe, Lock, Webhook, FileSpreadsheet, Settings, UserCog } from "lucide-react";

type Entry = { to: string; labelKey: string; Icon: React.ComponentType<any>; subject?: string };

const ENTRIES: Entry[] = [
  { to: "/tenant-admin/home", labelKey: "tenantHome.title", Icon: LayoutDashboard },
  { to: "/tenant-admin/members", labelKey: "tenantMembers.title", Icon: Users, subject: "TenantMemberAdmin" },
  { to: "/tenant-admin/service-accounts", labelKey: "tenantServiceAccounts.title", Icon: Key, subject: "TenantServiceAccountAdmin" },
  { to: "/tenant-admin/pats", labelKey: "tenantPats.title", Icon: Fingerprint, subject: "TenantPATAdmin" },
  { to: "/tenant-admin/usage", labelKey: "tenantUsage.title", Icon: Activity, subject: "TenantUsageView" },
  { to: "/tenant-admin/usage-history", labelKey: "tenantUsageHistory.title", Icon: ScrollText, subject: "TenantUsageView" },
  { to: "/tenant-admin/billing", labelKey: "tenantBilling.title", Icon: CreditCard, subject: "TenantBillingView" },
  { to: "/tenant-admin/capabilities", labelKey: "tenantCapabilities.title", Icon: ShieldCheck, subject: "TenantCapabilityView" },
  { to: "/tenant-admin/audit-logs", labelKey: "tenantAuditLogs.title", Icon: FileText, subject: "TenantAuditAdmin" },
  { to: "/tenant-admin/reports", labelKey: "tenantReports.title", Icon: FileSpreadsheet, subject: "TenantReportsView" },
  { to: "/tenant-admin/sso", labelKey: "tenantSSO.title", Icon: Globe, subject: "TenantSSOAdmin" },
  { to: "/tenant-admin/security", labelKey: "tenantSecurity.title", Icon: Lock, subject: "TenantSecurityView" },
  { to: "/tenant-admin/webhooks", labelKey: "tenantWebhooks.title", Icon: Webhook, subject: "TenantWebhookView" },
  { to: "/tenant-admin/settings", labelKey: "tenantSettings.title", Icon: Settings },
  { to: "/tenant-admin/roles", labelKey: "tenantRoles.title", Icon: UserCog, subject: "TenantRoleAdmin" },
];

export function TenantAdminCommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const { t } = useI18n();
  const { ability } = usePortfolio();
  const navigate = useNavigate();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
        setQuery("");
      } else if (e.key === "Escape" && open) {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!open) return null;

  const filtered = ENTRIES.filter((e) => !e.subject || (ability as any)?.can?.("read", e.subject))
    .filter((e) => !query || t(e.labelKey).toLowerCase().includes(query.toLowerCase()) || e.labelKey.toLowerCase().includes(query.toLowerCase()))
    .slice(0, 8);

  return (
    <div role="dialog" aria-modal="true" aria-label="Quick navigation" onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: 80, zIndex: 1000 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "var(--bg-shell-surface)", border: "1px solid var(--border-shell)", borderRadius: 12, width: 480, maxWidth: "90vw", maxHeight: "60vh", overflow: "hidden", boxShadow: "0 20px 60px rgba(0,0,0,0.5)" }}>
        <input aria-label={t('common.searchPages')} autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Tìm trang… (Ctrl+K)" style={{ width: "100%", padding: "12px 16px", border: "none", borderBottom: "1px solid var(--border-shell)", background: "transparent", color: "var(--text-primary)", fontSize: 14 }} />
        <div style={{ maxHeight: 320, overflowY: "auto", padding: 8 }}>
          {filtered.map((entry) => (
            <button key={entry.to} onClick={() => { setOpen(false); navigate(entry.to); }} style={{ display: "flex", gap: 12, alignItems: "center", width: "100%", padding: "10px 12px", borderRadius: 8, border: "none", background: "transparent", color: "var(--text-primary)", cursor: "pointer", textAlign: "left" }} onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.06)")} onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
              <entry.Icon size={16} aria-hidden />
              <span style={{ flex: 1, fontSize: 13 }}>{t(entry.labelKey)}</span>
              <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>{entry.to}</span>
            </button>
          ))}
          {filtered.length === 0 && <div style={{ padding: 16, fontSize: 13, color: "var(--text-secondary)", textAlign: "center" }}>Không tìm thấy</div>}
        </div>
        <div style={{ padding: "6px 12px", fontSize: 11, color: "var(--text-secondary)", borderTop: "1px solid var(--border-shell)", display: "flex", justifyContent: "space-between" }}>
          <span>↵ Chọn · Esc Đóng</span>
          <span>Ctrl+K</span>
        </div>
      </div>
    </div>
  );
}
