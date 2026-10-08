import styles from "../../components/ShellPageTemplate.module.css";
import ta from "./TenantAdmin.module.css";
import { useState } from "react";
import { ShellPageChrome, ShellPanel, renderShellMetric, ShellField, ShellSelectField } from "../../components/ShellPageTemplate.js";
import { ShellEmptyState } from "../../components/ShellEmptyState.js";
import { defaultCoreApiAdapter } from "../../adapters/coreApiAdapter.js";
import { useI18n } from "../../context/LangContext.js";
import { usePortfolio } from "../../context/PortfolioContext.js";
import { useToast } from "../../components/ShellToast.js";
import { useConfirm } from "../../components/ConfirmModal.js";
import { useTenantAdminQuery, useTenantAdminMutation } from "./useTenantAdminQuery.js";
import { useUrlState, stringCodec, type UrlStateCodec } from "../../hooks/useUrlState";

type MembersTab = "members" | "invites";
type MembersUrlState = { searchQuery: string; roleFilter: string; activeTab: MembersTab };

const MEMBERS_TABS: readonly MembersTab[] = ["members", "invites"];
// W3-2 (AC-2.3): `spec`/`defaults` o CAP MODULE => identity on dinh giua render,
// `useMemo([params, spec, defaults])` trong `useUrlState.ts:117` moi memo hoa duoc.
const MEMBERS_URL_SPEC: { [K in keyof MembersUrlState]: UrlStateCodec<MembersUrlState[K]> } = {
  searchQuery: stringCodec,
  // 'all' la mac dinh ⇒ serialize tra `undefined` cho 'all' (khong ghi tham so).
  roleFilter: { parse: stringCodec.parse, serialize: (v: string) => (v === "all" ? undefined : v) },
  activeTab: {
    parse: (raw) =>
      raw != null && (MEMBERS_TABS as readonly string[]).includes(raw) ? (raw as MembersTab) : undefined,
    serialize: (v) => (v === "members" ? undefined : v),
  },
};
const MEMBERS_URL_DEFAULTS: MembersUrlState = { searchQuery: "", roleFilter: "all", activeTab: "members" };
interface Member {
  member_id: string;
  username: string;
  email: string;
  role: "owner" | "admin" | "editor" | "viewer";
  custom_role_name?: string;
  invited_by?: string;
  joined_at?: string;
}

interface Invite {
  invite_id: string;
  invited_email: string;
  role: string;
  custom_role_id?: string;
  custom_role_name?: string;
  inviter_username?: string;
  status: "pending" | "accepted" | "declined" | "expired";
  expires_at?: string;
}

interface CustomRole {
  public_id: string;
  name: string;
  is_system: boolean;
}

interface MembersResponse {
  members?: Member[];
}

interface InvitesResponse {
  invites?: Invite[];
}

interface RolesResponse {
  roles?: CustomRole[];
}

interface TenantAdminMembersPageProps {
  env?: Record<string, unknown>;
  fetchImpl?: unknown;
  bootstrapLoader?: unknown;
  autoLoad?: boolean;
  initialSnapshot?: Record<string, unknown> | null;
}

export function TenantAdminMembersPage({}: TenantAdminMembersPageProps) {
  const { t, formatDate: fmtDate } = useI18n();
  const { ability } = usePortfolio();
  const toast = useToast();
  const confirm = useConfirm();

  // W3-2 (AC-2.1): 3 state nay la loc + tab cua bang thanh vien. Truoc day chi
  // trong RAM ⇒ gui link cho nguoi khac thi ho thay trang CHUA loc.
  // `spec`/`defaults` o CAP MODULE (AC-2.3) de identity on dinh giua render.
  const [{ searchQuery, roleFilter, activeTab }, setUrlState] = useUrlState(
    MEMBERS_URL_SPEC,
    MEMBERS_URL_DEFAULTS,
  );
  const setSearchQuery = (v: string) => setUrlState({ searchQuery: v });
  const setRoleFilter = (v: string) => setUrlState({ roleFilter: v });
  const setActiveTab = (v: MembersTab) => setUrlState({ activeTab: v });
  const [inviteForm, setInviteForm] = useState<{ invited_email: string; role: string; custom_role_id: string }>({
    invited_email: "", role: "viewer", custom_role_id: "",
  });

  const canRead = ability?.can?.("read", "TenantMemberAdmin") ?? false;

  const membersQuery = useTenantAdminQuery<MembersResponse>(
    ["tenant-admin", "members"],
    "/tenant-members/",
    { enabled: canRead },
  );

  const invitesQuery = useTenantAdminQuery<InvitesResponse>(
    ["tenant-admin", "members", "invites"],
    "/tenant-members/invites/",
    { enabled: canRead },
  );

  const rolesQuery = useTenantAdminQuery<RolesResponse>(
    ["tenant-admin", "members", "roles"],
    "/partner/roles/",
    { enabled: canRead },
  );

  const members: Member[] = membersQuery.data?.members || [];
  const invites: Invite[] = invitesQuery.data?.invites || [];
  const customRoles: CustomRole[] = (rolesQuery.data?.roles || []).filter((r: CustomRole) => !r.is_system);

  const loading = membersQuery.isLoading || invitesQuery.isLoading || rolesQuery.isLoading;
  const error = membersQuery.error || invitesQuery.error || rolesQuery.error;

  const inviteMutation = useTenantAdminMutation(
    "post", "/tenant-members/invites/",
    [["tenant-admin", "members", "invites"]],
    {
      onSuccess: () => {
        setInviteForm({ invited_email: "", role: "viewer", custom_role_id: "" });
      },
      onError: (err) => {
        toast.error(err?.message || t("tenantMembers.inviteError"));
      },
    },
  );

  const roleT = (role: string): string => t(`tenantMembers.roleOptions.${role}`, { defaultValue: role });
  const statusT = (status: string): string => t(`tenantMembers.statuses.${status}`, { defaultValue: status });

  const handleInviteSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!inviteForm.invited_email.trim()) return;
    const payload: Record<string, string> = {
      invited_email: inviteForm.invited_email,
      role: inviteForm.role,
    };
    if (inviteForm.custom_role_id) {
      payload.custom_role_id = inviteForm.custom_role_id;
    }
    inviteMutation.mutate(payload);
  };

  const handleRemoveMember = async (memberId: string) => {
    const ok = await confirm({ title: t("common.delete"), message: t("tenantMembers.removeConfirm") });
    if (!ok) return;
    try {
      await defaultCoreApiAdapter.coreDelete(`/tenant-members/${memberId}/`);
    } catch (err) {
      toast.error((err as Error).message || t("tenantMembers.removeError"));
    }
  };

  if (!canRead) {
    return (
      <ShellPageChrome
        eyebrow={t("tenantMembers.eyebrow")}
        title={t("tenantMembers.title")}
        description={t("tenantMembers.description")}
        notice={t("common.noPermission")}
      >
        <div className={`${styles.panel}`}>
          <ShellEmptyState description={t("tenantMembers.membersEmpty")} />
        </div>
      </ShellPageChrome>
    );
  }

  if (loading && members.length === 0) {
    return (
      <ShellPageChrome
        eyebrow={t("tenantMembers.eyebrow")}
        title={t("tenantMembers.title")}
        description={t("common.loading")}
      >
        <div className={`${styles.panel}`}>{t("common.loading")}</div>
      </ShellPageChrome>
    );
  }

  if (error && members.length === 0) {
    return (
      <ShellPageChrome
        eyebrow={t("tenantMembers.eyebrow")}
        title={t("tenantMembers.title")}
        description={t("tenantMembers.loadError")}
        error={error?.message || t("tenantMembers.loadError")}
      >
        <div className={`${styles.panel}`}>{error?.message || t("tenantMembers.loadError")}</div>
      </ShellPageChrome>
    );
  }

  const pendingInvites = invites.filter(i => i.status === "pending").length;

  const metrics = [
    renderShellMetric(t("tenantMembers.metricMembers"), String(members.length)),
    renderShellMetric(t("tenantMembers.metricInvites"), String(pendingInvites)),
    renderShellMetric("Owner", String(members.filter(m => m.role === "owner").length)),
    renderShellMetric("Admin", String(members.filter(m => m.role === "admin").length)),
  ];

  const roleBadgeStyle = (role: string): Record<string, string> => {
    if (role === "owner") return { background: "rgba(255,127,80,0.2)", color: "#ff7f50" };
    if (role === "admin") return { background: "rgba(0,180,216,0.2)", color: "#00b4d8" };
    return { background: "rgba(148,163,184,0.2)", color: "#94a3b8" };
  };

  const statusBadgeStyle = (status: string): Record<string, string> => {
    if (status === "pending") return { background: "rgba(255,193,7,0.2)", color: "#ffc107" };
    if (status === "accepted") return { background: "rgba(34,197,94,0.2)", color: "#22c55e" };
    return { background: "rgba(148,163,184,0.2)", color: "#94a3b8" };
  };

  function AvatarInitials({ name, size = 32 }: { name: string; size?: number }) {
    const initial = (name || "?").charAt(0).toUpperCase();
    const bgColor = `hsl(${name.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360}, 55%, 45%)`;
    return (
      <div className={ta.mem_1} style={{ width: size, height: size, background: bgColor, fontSize: size * 0.45 }}>
        {initial}
      </div>
    );
  }

  const filteredMembers = members.filter(m => {
    const matchesSearch = !searchQuery ||
      m.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === "all" || m.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const MEMBER_CSS = `
.memberSearch { margin-bottom: 12px; }
.memberRoleFilter { display: flex; gap: 6px; margin-bottom: 12px; flex-wrap: wrap; }
`;

  return (
    <ShellPageChrome
      eyebrow={t("tenantMembers.eyebrow")}
      title={t("tenantMembers.title")}
      description={t("tenantMembers.description")}
      metrics={metrics}
    >
      <section className={`${styles.stack}`}>
          <div className={ta.mem_2}>
            <button
              onClick={() => setActiveTab("members")}
              className={[`${styles.button}`, ta.mem_3].filter(Boolean).join(" ")}
              style={{ background: activeTab === "members" ? "rgba(0,180,216,0.2)" : "rgba(15,23,42,0.5)", border: "1px solid rgba(255,255,255,0.08)" }}
            >
              {`${t("tenantMembers.membersListTitle")} (${searchQuery || roleFilter !== "all" ? `${filteredMembers.length}/${members.length}` : members.length})`}
            </button>
            <button
              onClick={() => setActiveTab("invites")}
              className={[`${styles.button}`, ta.mem_4].filter(Boolean).join(" ")}
              style={{ background: activeTab === "invites" ? "rgba(0,180,216,0.2)" : "rgba(15,23,42,0.5)", border: "1px solid rgba(255,255,255,0.08)" }}
            >
              {`${t("tenantMembers.invitesListTitle")} (${pendingInvites})`}
            </button>
          </div>

          {activeTab === "members" && (
            <div>
              <style>{MEMBER_CSS}</style>
              <div className="memberRoleFilter">
                {["all", "owner", "admin", "editor", "viewer"].map(role => (
                  <button
                    key={role}
                    onClick={() => setRoleFilter(role)}
                    className={`${styles.button}`}
                    style={{
                      fontSize: 11, padding: "4px 10px",
                      background: roleFilter === role ? "rgba(0,180,216,0.2)" : "rgba(255,255,255,0.06)",
                      color: roleFilter === role ? "var(--accent-shell)" : "var(--text-primary)",
                      border: roleFilter === role ? "1px solid rgba(0,180,216,0.3)" : "1px solid var(--border-shell)",
                    }}
                  >
                    {role === "all" ? t("common.all") : t(`tenantMembers.roleOptions.${role}`)}
                  </button>
                ))}
              </div>
              <div className="memberSearch">
                <input aria-label={t("tenantMembers.searchPlaceholder")}
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder={t("tenantMembers.searchPlaceholder")}
                  className={[`${styles.input}`, ta.mem_5].filter(Boolean).join(" ")}
                  style={{ width: "100%" }}
                />
              </div>
              <ShellPanel title={t("tenantMembers.membersListTitle")} subtitle={`${filteredMembers.length}/${members.length}`}>
                <div className={ta.mem_6}>
                  <table className={ta.mem_7}>
                    <thead>
                      <tr className={ta.mem_8}>
                        <th className={[`${styles.itemMeta}`, ta.mem_9].filter(Boolean).join(" ")} style={{ fontSize: "12px" }}>
                          {t("tenantMembers.tableHeaderUsername")}
                        </th>
                        <th className={[`${styles.itemMeta}`, ta.mem_10].filter(Boolean).join(" ")} style={{ fontSize: "12px" }}>
                          {t("tenantMembers.emailLabel")}
                        </th>
                        <th className={[`${styles.itemMeta}`, ta.mem_11].filter(Boolean).join(" ")} style={{ fontSize: "12px" }}>
                          {t("tenantMembers.roleLabel")}
                        </th>
                        <th className={[`${styles.itemMeta}`, ta.mem_12].filter(Boolean).join(" ")} style={{ fontSize: "12px" }}>
                          {t("tenantMembers.inviterLabel")}
                        </th>
                        <th className={[`${styles.itemMeta}`, ta.mem_13].filter(Boolean).join(" ")} style={{ fontSize: "12px" }}>
                          {t("tenantMembers.joinedAtLabel")}
                        </th>
                        <th className={[`${styles.itemMeta}`, ta.mem_14].filter(Boolean).join(" ")} style={{ fontSize: "12px" }}>
                          {t("tenantMembers.tableHeaderActions")}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredMembers.map(member => (
                        <tr key={member.member_id} className={ta.mem_15}>
                          <td className={ta.mem_16}>
                            <div className={ta.mem_17}>
                              <AvatarInitials name={member.username} size={28} />
                              {member.username}
                            </div>
                          </td>
                          <td className={ta.mem_18}>{member.email}</td>
                          <td className={ta.mem_19}>
                            <span
                              className={`${styles.pill}`}
                              style={roleBadgeStyle(member.role)}
                            >
                              {roleT(member.role)}
                            </span>
                          </td>
                          <td className={ta.mem_20}>{member.invited_by || t("tenantMembers.invitedBySystem")}</td>
                          <td className={ta.mem_21}>{member.joined_at ? fmtDate(member.joined_at) : t("common.notAvailable")}</td>
                          <td className={ta.mem_22}>
                            {member.role !== "owner" && (
                              <button
                                onClick={() => handleRemoveMember(member.member_id)}
                                className={[`${styles.button}`, ta.mem_23].filter(Boolean).join(" ")}
                                style={{ border: "1px solid rgba(255,127,80,0.3)", fontSize: "12px", padding: "6px 12px" }}
                              >
                                {t("tenantMembers.removeAction")}
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </ShellPanel>
            </div>
          )}

          {activeTab === "invites" && (
            <div>
              <ShellPanel title={t("tenantMembers.inviteTitle")}>
                <form onSubmit={handleInviteSubmit} className={ta.mem_24}>
                  <ShellField
                    label={t("tenantMembers.emailLabel")}
                    name="invited_email"
                    type="email"
                    value={inviteForm.invited_email}
                    onChange={e => setInviteForm(prev => ({ ...prev, invited_email: e.target.value }))}
                    placeholder={t("tenantMembers.invitedEmailPlaceholder")}
                  />
                  <ShellSelectField
                    label={t("tenantMembers.roleLabel")}
                    name="role"
                    value={inviteForm.role}
                    onChange={e => setInviteForm(prev => ({ ...prev, role: e.target.value, custom_role_id: "" }))}
                    options={[
                      { key: "viewer", label: t("tenantMembers.roleOptions.viewer") },
                      { key: "editor", label: t("tenantMembers.roleOptions.editor") },
                      { key: "admin", label: t("tenantMembers.roleOptions.admin") },
                    ]}
                  />
                  {customRoles.length > 0 && (
                    <ShellSelectField
                      label={t("tenantMembers.customRoleLabel")}
                      name="custom_role_id"
                      value={inviteForm.custom_role_id}
                      onChange={e => setInviteForm(prev => ({ ...prev, custom_role_id: e.target.value }))}
                      options={[
                        { key: "", label: t("tenantMembers.customRoleNone") },
                        ...customRoles.map(r => ({ key: r.public_id, label: r.name })),
                      ]}
                    />
                  )}
                  <button
                    type="submit"
                    disabled={inviteMutation.isPending}
                    className={[`${styles.button} ${styles.buttonPrimary}`, ta.mem_25].filter(Boolean).join(" ")}
                    
                  >
                    {inviteMutation.isPending ? t("tenantMembers.submitting") : t("tenantMembers.inviteAction")}
                  </button>
                </form>
              </ShellPanel>

              <ShellPanel title={t("tenantMembers.invitesListTitle")} subtitle={`${pendingInvites}`}>
                <div className={ta.mem_26}>
                  <table className={ta.mem_27}>
                    <thead>
                      <tr className={ta.mem_28}>
                        <th className={[`${styles.itemMeta}`, ta.mem_29].filter(Boolean).join(" ")} style={{ fontSize: "12px" }}>
                          {t("tenantMembers.emailLabel")}
                        </th>
                        <th className={[`${styles.itemMeta}`, ta.mem_30].filter(Boolean).join(" ")} style={{ fontSize: "12px" }}>
                          {t("tenantMembers.roleLabel")}
                        </th>
                        <th className={[`${styles.itemMeta}`, ta.mem_31].filter(Boolean).join(" ")} style={{ fontSize: "12px" }}>
                          {t("tenantMembers.inviterLabel")}
                        </th>
                        <th className={[`${styles.itemMeta}`, ta.mem_32].filter(Boolean).join(" ")} style={{ fontSize: "12px" }}>
                          {t("tenantMembers.metricInvites")}
                        </th>
                        <th className={[`${styles.itemMeta}`, ta.mem_33].filter(Boolean).join(" ")} style={{ fontSize: "12px" }}>
                          {t("tenantMembers.expiresAtLabel")}
                        </th>
                        <th className={[`${styles.itemMeta}`, ta.mem_34].filter(Boolean).join(" ")} style={{ fontSize: "12px" }}>
                          {t("tenantMembers.tableHeaderActions")}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {invites.map(invite => (
                        <tr key={invite.invite_id} className={ta.mem_35}>
                          <td className={ta.mem_36}>{invite.invited_email}</td>
                          <td className={ta.mem_37}>{roleT(invite.role)}</td>
                          <td className={ta.mem_38}>{invite.inviter_username || t("common.notAvailable")}</td>
                          <td className={ta.mem_39}>
                            <span className={`${styles.pill}`} style={statusBadgeStyle(invite.status)}>
                              {statusT(invite.status)}
                            </span>
                          </td>
                          <td className={ta.mem_40}>{invite.expires_at ? fmtDate(invite.expires_at) : t("common.notAvailable")}</td>
                          <td className={ta.mem_41}>
                              {invite.status === "pending" && (
                              <button
                                onClick={async () => {
                                  const ok = await confirm({ title: t("common.cancel"), message: t("tenantMembers.cancelInviteAction") });
                                  if (!ok) return;
                                  try {
                                    await defaultCoreApiAdapter.corePost(`/tenant-members/invites/${invite.invite_id}/cancel/`);
                                  } catch (err) {
                                    toast.error((err as Error).message);
                                  }
                                }}
                                className={[`${styles.button}`, ta.mem_42].filter(Boolean).join(" ")}
                                style={{ border: "1px solid rgba(255,127,80,0.3)", fontSize: "12px", padding: "6px 12px" }}
                              >
                                {t("common.cancel")}
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </ShellPanel>
            </div>
          )}
      </section>
    </ShellPageChrome>
  );
}
