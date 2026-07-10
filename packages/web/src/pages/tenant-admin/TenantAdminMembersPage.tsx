import { useCallback, useEffect, useState } from "react";
import { ShellPageChrome, ShellPanel, renderShellMetric, ShellField, ShellSelectField } from "../../components/ShellPageTemplate.js";
import { ShellEmptyState } from "../../components/ShellEmptyState.js";
import { defaultCoreApiAdapter } from "../../adapters/coreApiAdapter.js";
import { useI18n } from "../../context/LangContext.js";
import { usePortfolio } from "../../context/PortfolioContext.js";
import { useToast } from "../../components/ShellToast.js";
import { useConfirm } from "../../components/ConfirmModal.js";

interface Member {
  member_id: string;
  username: string;
  email: string;
  role: "owner" | "admin" | "editor" | "viewer";
  invited_by?: string;
  joined_at?: string;
}

interface Invite {
  invite_id: string;
  invited_email: string;
  role: string;
  inviter_username?: string;
  status: "pending" | "accepted" | "declined" | "expired";
  expires_at?: string;
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

  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<"members" | "invites">("members");
  const [inviteForm, setInviteForm] = useState<{ invited_email: string; role: string }>({ invited_email: "", role: "viewer" });
  const [submitting, setSubmitting] = useState(false);

  const canRead = ability?.can?.("read", "TenantMemberAdmin") ?? false;

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [membersData, invitesData] = await Promise.all([
        defaultCoreApiAdapter.coreGet("/tenant-members/"),
        defaultCoreApiAdapter.coreGet("/tenant-members/invites/"),
      ]);
      setMembers(membersData.members || []);
      setInvites(invitesData.invites || []);
    } catch (err) {
      setError((err as Error).message || t("tenantMembers.loadError"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const roleT = (role: string): string => t(`tenantMembers.roleOptions.${role}`, { defaultValue: role });
  const statusT = (status: string): string => t(`tenantMembers.statuses.${status}`, { defaultValue: status });

  const handleInviteSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!inviteForm.invited_email.trim()) return;

    setSubmitting(true);
    try {
      const data = await defaultCoreApiAdapter.corePost("/tenant-members/invites/", inviteForm);
      setInvites(prev => [data, ...prev]);
      setInviteForm({ invited_email: "", role: "viewer" });
    } catch (err) {
      toast.error((err as Error).message || t("tenantMembers.inviteError"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    const ok = await confirm({ title: t("common.delete"), message: t("tenantMembers.removeConfirm") });
    if (!ok) return;
    try {
      await defaultCoreApiAdapter.coreDelete(`/tenant-members/${memberId}/`);
      setMembers(prev => prev.filter(m => m.member_id !== memberId));
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
        <div className="shellPage__panel">
          <ShellEmptyState description={t("tenantMembers.membersEmpty")} />
        </div>
      </ShellPageChrome>
    );
  }

  if (loading) {
    return (
      <ShellPageChrome
        eyebrow={t("tenantMembers.eyebrow")}
        title={t("tenantMembers.title")}
        description={t("common.loading")}
      >
        <div className="shellPage__panel">{t("common.loading")}</div>
      </ShellPageChrome>
    );
  }

  if (error) {
    return (
      <ShellPageChrome
        eyebrow={t("tenantMembers.eyebrow")}
        title={t("tenantMembers.title")}
        description={t("tenantMembers.loadError")}
        error={error}
      >
        <div className="shellPage__panel">{error}</div>
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
      <div style={{
        width: size, height: size, borderRadius: "50%", background: bgColor,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: size * 0.45, fontWeight: 700, color: "#fff",
        flexShrink: 0,
      }}>
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
      <section className="shellPage__stack">
          <div style={{ display: "flex", gap: "8px", marginBottom: "20px", borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: "8px" }}>
            <button
              onClick={() => setActiveTab("members")}
              className="shellPage__button"
              style={{
                background: activeTab === "members" ? "rgba(0,180,216,0.2)" : "rgba(15,23,42,0.5)",
                border: "1px solid rgba(255,255,255,0.08)",
                color: "#f1f5f9",
              }}
            >
              {`${t("tenantMembers.membersListTitle")} (${searchQuery || roleFilter !== "all" ? `${filteredMembers.length}/${members.length}` : members.length})`}
            </button>
            <button
              onClick={() => setActiveTab("invites")}
              className="shellPage__button"
              style={{
                background: activeTab === "invites" ? "rgba(0,180,216,0.2)" : "rgba(15,23,42,0.5)",
                border: "1px solid rgba(255,255,255,0.08)",
                color: "#f1f5f9",
              }}
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
                    className="shellPage__button"
                    style={{
                      fontSize: 11, padding: "4px 10px",
                      background: roleFilter === role ? "rgba(0,180,216,0.2)" : "rgba(255,255,255,0.06)",
                      color: roleFilter === role ? "var(--shell-accent)" : "var(--shell-ink)",
                      border: roleFilter === role ? "1px solid rgba(0,180,216,0.3)" : "1px solid var(--shell-border)",
                    }}
                  >
                    {role === "all" ? t("common.all") : t(`tenantMembers.roleOptions.${role}`)}
                  </button>
                ))}
              </div>
              <div className="memberSearch">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder={t("tenantMembers.searchPlaceholder")}
                  className="shellPage__input"
                  style={{ width: "100%", maxWidth: 320 }}
                />
              </div>
              <ShellPanel title={t("tenantMembers.membersListTitle")} subtitle={`${filteredMembers.length}/${members.length}`}>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                        <th className="shellPage__itemMeta" style={{ padding: "12px", textAlign: "left", fontSize: "12px", textTransform: "uppercase" }}>
                          {t("tenantMembers.tableHeaderUsername")}
                        </th>
                        <th className="shellPage__itemMeta" style={{ padding: "12px", textAlign: "left", fontSize: "12px", textTransform: "uppercase" }}>
                          {t("tenantMembers.emailLabel")}
                        </th>
                        <th className="shellPage__itemMeta" style={{ padding: "12px", textAlign: "left", fontSize: "12px", textTransform: "uppercase" }}>
                          {t("tenantMembers.roleLabel")}
                        </th>
                        <th className="shellPage__itemMeta" style={{ padding: "12px", textAlign: "left", fontSize: "12px", textTransform: "uppercase" }}>
                          {t("tenantMembers.inviterLabel")}
                        </th>
                        <th className="shellPage__itemMeta" style={{ padding: "12px", textAlign: "left", fontSize: "12px", textTransform: "uppercase" }}>
                          {t("tenantMembers.joinedAtLabel")}
                        </th>
                        <th className="shellPage__itemMeta" style={{ padding: "12px", textAlign: "left", fontSize: "12px", textTransform: "uppercase" }}>
                          {t("tenantMembers.tableHeaderActions")}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredMembers.map(member => (
                        <tr key={member.member_id} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                          <td style={{ padding: "12px", color: "#cbd5e1" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <AvatarInitials name={member.username} size={28} />
                              {member.username}
                            </div>
                          </td>
                          <td style={{ padding: "12px", color: "#cbd5e1" }}>{member.email}</td>
                          <td style={{ padding: "12px" }}>
                            <span
                              className="shellPage__pill"
                              style={roleBadgeStyle(member.role)}
                            >
                              {roleT(member.role)}
                            </span>
                          </td>
                          <td style={{ padding: "12px", color: "#cbd5e1" }}>{member.invited_by || t("tenantMembers.invitedBySystem")}</td>
                          <td style={{ padding: "12px", color: "#cbd5e1" }}>{member.joined_at ? fmtDate(member.joined_at) : t("common.notAvailable")}</td>
                          <td style={{ padding: "12px" }}>
                            {member.role !== "owner" && (
                              <button
                                onClick={() => handleRemoveMember(member.member_id)}
                                className="shellPage__button"
                                style={{
                                  background: "rgba(255,127,80,0.15)",
                                  border: "1px solid rgba(255,127,80,0.3)",
                                  color: "#ff7f50",
                                  fontSize: "12px",
                                  padding: "6px 12px",
                                }}
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
                <form onSubmit={handleInviteSubmit} style={{ maxWidth: "400px" }}>
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
                    onChange={e => setInviteForm(prev => ({ ...prev, role: e.target.value }))}
                    options={[
                      { key: "viewer", label: t("tenantMembers.roleOptions.viewer") },
                      { key: "editor", label: t("tenantMembers.roleOptions.editor") },
                      { key: "admin", label: t("tenantMembers.roleOptions.admin") },
                    ]}
                  />
                  <button
                    type="submit"
                    disabled={submitting}
                    className="shellPage__button shellPage__button--primary"
                    style={{ width: "100%", marginTop: "16px" }}
                  >
                    {submitting ? t("tenantMembers.submitting") : t("tenantMembers.inviteAction")}
                  </button>
                </form>
              </ShellPanel>

              <ShellPanel title={t("tenantMembers.invitesListTitle")} subtitle={`${pendingInvites}`}>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                        <th className="shellPage__itemMeta" style={{ padding: "12px", textAlign: "left", fontSize: "12px", textTransform: "uppercase" }}>
                          {t("tenantMembers.emailLabel")}
                        </th>
                        <th className="shellPage__itemMeta" style={{ padding: "12px", textAlign: "left", fontSize: "12px", textTransform: "uppercase" }}>
                          {t("tenantMembers.roleLabel")}
                        </th>
                        <th className="shellPage__itemMeta" style={{ padding: "12px", textAlign: "left", fontSize: "12px", textTransform: "uppercase" }}>
                          {t("tenantMembers.inviterLabel")}
                        </th>
                        <th className="shellPage__itemMeta" style={{ padding: "12px", textAlign: "left", fontSize: "12px", textTransform: "uppercase" }}>
                          {t("tenantMembers.metricInvites")}
                        </th>
                        <th className="shellPage__itemMeta" style={{ padding: "12px", textAlign: "left", fontSize: "12px", textTransform: "uppercase" }}>
                          {t("tenantMembers.expiresAtLabel")}
                        </th>
                        <th className="shellPage__itemMeta" style={{ padding: "12px", textAlign: "left", fontSize: "12px", textTransform: "uppercase" }}>
                          {t("tenantMembers.tableHeaderActions")}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {invites.map(invite => (
                        <tr key={invite.invite_id} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                          <td style={{ padding: "12px", color: "#cbd5e1" }}>{invite.invited_email}</td>
                          <td style={{ padding: "12px", color: "#cbd5e1" }}>{roleT(invite.role)}</td>
                          <td style={{ padding: "12px", color: "#cbd5e1" }}>{invite.inviter_username || t("common.notAvailable")}</td>
                          <td style={{ padding: "12px" }}>
                            <span className="shellPage__pill" style={statusBadgeStyle(invite.status)}>
                              {statusT(invite.status)}
                            </span>
                          </td>
                          <td style={{ padding: "12px", color: "#cbd5e1" }}>{invite.expires_at ? fmtDate(invite.expires_at) : t("common.notAvailable")}</td>
                          <td style={{ padding: "12px" }}>
                              {invite.status === "pending" && (
                              <button
                                onClick={async () => {
                                  const ok = await confirm({ title: t("common.cancel"), message: t("tenantMembers.cancelInviteAction") });
                                  if (!ok) return;
                                  try {
                                    await defaultCoreApiAdapter.corePost(`/tenant-members/invites/${invite.invite_id}/cancel/`);
                                    setInvites(prev => prev.filter(i => i.invite_id !== invite.invite_id));
                                  } catch (err) {
                                    toast.error((err as Error).message);
                                  }
                                }}
                                className="shellPage__button"
                                style={{
                                  background: "rgba(255,127,80,0.15)",
                                  border: "1px solid rgba(255,127,80,0.3)",
                                  color: "#ff7f50",
                                  fontSize: "12px",
                                  padding: "6px 12px",
                                }}
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
