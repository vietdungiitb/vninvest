import {
  LayoutDashboard, Users, Key, Fingerprint, Activity, CreditCard, ShieldCheck,
  FileText, ScrollText, Globe, Lock, Webhook, FileSpreadsheet, Settings,
  UserCog, Bell, PieChart, SlidersHorizontal,
} from "lucide-react";

export type CommandEntry = {
  to: string;
  labelKey: string;
  Icon: React.ComponentType<any>;
  subject?: string;
};

/** Lệnh dùng chung toàn app — mount 1 lần ở FullLayout (không mount riêng tenant-admin). */
export const GLOBAL_COMMANDS: CommandEntry[] = [
  { to: "/dashboard", labelKey: "dashboard.title", Icon: LayoutDashboard },
  { to: "/portfolios", labelKey: "routes.portfolios", Icon: PieChart },
  { to: "/alert-center", labelKey: "routes.alertCenter", Icon: Bell },
  { to: "/settings/ai", labelKey: "aiCommandCenter.title", Icon: SlidersHorizontal },
];

/** 15 entry cũ của tenant-admin — giữ nguyên subject CASL, chỉ chuyển nơi khai báo. */
export const TENANT_ADMIN_COMMANDS: CommandEntry[] = [
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

export const ALL_COMMANDS: CommandEntry[] = [...GLOBAL_COMMANDS, ...TENANT_ADMIN_COMMANDS];
