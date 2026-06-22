import { useEffect, useState } from "react";
import { ShellPageChrome, ShellPanel, renderShellMetric } from "../../components/ShellPageTemplate.js";
import { defaultCoreApiAdapter } from "../../adapters/coreApiAdapter.js";

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

const ROLE_LABELS: Record<string, string> = {
  owner: "Chủ sở hữu",
  admin: "Quản trị viên",
  editor: "Biên tập viên",
  viewer: "Người xem",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Chờ duyệt",
  accepted: "Đã chấp nhận",
  declined: "Đã từ chối",
  expired: "Hết hạn",
};

export function TenantAdminMembersPage({}: TenantAdminMembersPageProps) {
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"members" | "invites">("members");
  const [inviteForm, setInviteForm] = useState<{ invited_email: string; role: string }>({ invited_email: "", role: "viewer" });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const [membersRes, invitesRes] = await Promise.all([
          defaultCoreApiAdapter.coreGet("/tenant-members/"),
          defaultCoreApiAdapter.coreGet("/tenant-members/invites/"),
        ]);
        if (membersRes.ok) {
          const data = await membersRes.json();
          setMembers(data.members || []);
        }
        if (invitesRes.ok) {
          const data = await invitesRes.json();
          setInvites(data.invites || []);
        }
      } catch (err) {
        setError((err as Error).message || "Lỗi khi tải dữ liệu");
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const handleInviteSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!inviteForm.invited_email.trim()) return;

    setSubmitting(true);
    try {
      const response = await defaultCoreApiAdapter.corePost("/tenant-members/invites/", inviteForm);
      if (response.ok) {
        const data = await response.json();
        setInvites(prev => [data, ...prev]);
        setInviteForm({ invited_email: "", role: "viewer" });
      } else {
        const errorData = await response.json();
        alert(errorData.error || "Không thể gửi lời mời");
      }
    } catch (err) {
      alert((err as Error).message || "Lỗi khi gửi lời mời");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!confirm("Bạn có chắc chắn muốn xóa thành viên này?")) return;

    try {
      const response = await defaultCoreApiAdapter.coreDelete(`/tenant-members/${memberId}/`);
      if (response.ok) {
        setMembers(prev => prev.filter(m => m.member_id !== memberId));
      } else {
        const errorData = await response.json();
        alert(errorData.error || "Không thể xóa thành viên");
      }
    } catch (err) {
      alert((err as Error).message || "Lỗi khi xóa thành viên");
    }
  };

  if (loading) {
    return (
      <ShellPageChrome
        eyebrow="Tenant Admin"
        title="Quản lý thành viên"
        description="Đang tải danh sách thành viên..."
      >
        <div className="shellPage__panel">Đang tải...</div>
      </ShellPageChrome>
    );
  }

  if (error) {
    return (
      <ShellPageChrome
        eyebrow="Tenant Admin"
        title="Quản lý thành viên"
        description="Không thể tải danh sách thành viên"
        error={error}
      >
        <div className="shellPage__panel">{error}</div>
      </ShellPageChrome>
    );
  }

  const metrics = [
    renderShellMetric("Tổng thành viên", String(members.length)),
    renderShellMetric("Lời mời chờ", String(invites.filter(i => i.status === "pending").length)),
    renderShellMetric("Owner", String(members.filter(m => m.role === "owner").length)),
    renderShellMetric("Admin", String(members.filter(m => m.role === "admin").length)),
  ];

  return (
    <ShellPageChrome
      eyebrow="Tenant Admin"
      title="Quản lý thành viên"
      description="Quản lý thành viên và lời mời cho tenant"
      metrics={metrics}
    >
      <section className="shellPage__bodyGrid">
        <div className="shellPage__stack">
          <div style={{ display: "flex", gap: "8px", marginBottom: "20px", borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: "8px" }}>
            <button
              onClick={() => setActiveTab("members")}
              style={{
                padding: "10px 20px",
                background: activeTab === "members" ? "rgba(0,180,216,0.2)" : "rgba(15,23,42,0.5)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: "8px",
                color: "#f1f5f9",
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              {`Thành viên (${members.length})`}
            </button>
            <button
              onClick={() => setActiveTab("invites")}
              style={{
                padding: "10px 20px",
                background: activeTab === "invites" ? "rgba(0,180,216,0.2)" : "rgba(15,23,42,0.5)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: "8px",
                color: "#f1f5f9",
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              {`Lời mời (${invites.filter(i => i.status === "pending").length})`}
            </button>
          </div>

          {activeTab === "members" && (
            <div>
              <ShellPanel
                title="Danh sách thành viên"
                subtitle={`${members.length} thành viên trong tenant`}
              >
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                        {["Tên đăng nhập", "Email", "Vai trò", "Được mời bởi", "Tham gia lúc", "Thao tác"].map(h => (
                          <th key={h} style={{ padding: "12px", textAlign: "left", color: "#94a3b8", fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.08em" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {members.map(member => (
                        <tr key={member.member_id} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                          <td style={{ padding: "12px" }}>{member.username}</td>
                          <td style={{ padding: "12px" }}>{member.email}</td>
                          <td style={{ padding: "12px" }}>
                            <span style={{
                              padding: "4px 10px",
                              borderRadius: "999px",
                              fontSize: "11px",
                              fontWeight: 600,
                              background: member.role === "owner" ? "rgba(255,127,80,0.2)" : member.role === "admin" ? "rgba(0,180,216,0.2)" : "rgba(148,163,184,0.2)",
                              color: member.role === "owner" ? "#ff7f50" : member.role === "admin" ? "#00b4d8" : "#94a3b8",
                            }}>
                              {ROLE_LABELS[member.role] || member.role}
                            </span>
                          </td>
                          <td style={{ padding: "12px" }}>{member.invited_by || "Hệ thống"}</td>
                          <td style={{ padding: "12px" }}>{member.joined_at ? new Date(member.joined_at).toLocaleDateString("vi-VN") : "N/A"}</td>
                          <td style={{ padding: "12px" }}>
                            {member.role !== "owner" && (
                              <button
                                onClick={() => handleRemoveMember(member.member_id)}
                                style={{
                                  padding: "6px 12px",
                                  background: "rgba(255,127,80,0.15)",
                                  border: "1px solid rgba(255,127,80,0.3)",
                                  borderRadius: "6px",
                                  color: "#ff7f50",
                                  cursor: "pointer",
                                  fontSize: "12px",
                                }}
                              >
                                Xóa
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
              <ShellPanel
                title="Mời thành viên mới"
                subtitle="Gửi lời mời qua email để thêm thành viên vào tenant"
              >
                <form onSubmit={handleInviteSubmit} style={{ maxWidth: "400px" }}>
                  <div style={{ marginBottom: "16px" }}>
                    <label style={{ display: "block", marginBottom: "6px", fontWeight: 500 }}>Email</label>
                    <input
                      type="email"
                      value={inviteForm.invited_email}
                      onChange={e => setInviteForm(prev => ({ ...prev, invited_email: e.target.value }))}
                      placeholder="email@example.com"
                      required
                      style={{ width: "100%", padding: "10px 12px", background: "rgba(15,23,42,0.5)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "8px", color: "#f1f5f9", fontSize: "14px" }}
                    />
                  </div>
                  <div style={{ marginBottom: "16px" }}>
                    <label style={{ display: "block", marginBottom: "6px", fontWeight: 500 }}>Vai trò</label>
                    <select
                      value={inviteForm.role}
                      onChange={e => setInviteForm(prev => ({ ...prev, role: e.target.value }))}
                      style={{ width: "100%", padding: "10px 12px", background: "rgba(15,23,42,0.5)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "8px", color: "#f1f5f9", fontSize: "14px" }}
                    >
                      <option value="viewer">Người xem (Viewer)</option>
                      <option value="editor">Biên tập viên (Editor)</option>
                      <option value="admin">Quản trị viên (Admin)</option>
                    </select>
                  </div>
                  <button
                    type="submit"
                    disabled={submitting}
                    style={{ width: "100%", padding: "12px", background: "rgba(0,180,216,0.2)", border: "1px solid rgba(0,180,216,0.3)", borderRadius: "8px", color: "#00b4d8", fontWeight: 600, cursor: submitting ? "not-allowed" : "pointer" }}
                  >
                    {submitting ? "Đang gửi..." : "Gửi lời mời"}
                  </button>
                </form>
              </ShellPanel>

              <ShellPanel
                title="Lời mời đang chờ"
                subtitle={`${invites.filter(i => i.status === "pending").length} lời mời chờ duyệt`}
              >
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                        {["Email", "Vai trò", "Người mời", "Trạng thái", "Hết hạn lúc", "Thao tác"].map(h => (
                          <th key={h} style={{ padding: "12px", textAlign: "left", color: "#94a3b8", fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.08em" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {invites.map(invite => (
                        <tr key={invite.invite_id} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                          <td style={{ padding: "12px" }}>{invite.invited_email}</td>
                          <td style={{ padding: "12px" }}>{ROLE_LABELS[invite.role] || invite.role}</td>
                          <td style={{ padding: "12px" }}>{invite.inviter_username || "N/A"}</td>
                          <td style={{ padding: "12px" }}>
                            <span style={{
                              padding: "4px 10px",
                              borderRadius: "999px",
                              fontSize: "11px",
                              fontWeight: 600,
                              background: invite.status === "pending" ? "rgba(255,193,7,0.2)" : invite.status === "accepted" ? "rgba(34,197,94,0.2)" : "rgba(148,163,184,0.2)",
                              color: invite.status === "pending" ? "#ffc107" : invite.status === "accepted" ? "#22c55e" : "#94a3b8",
                            }}>
                              {STATUS_LABELS[invite.status] || invite.status}
                            </span>
                          </td>
                          <td style={{ padding: "12px" }}>{invite.expires_at ? new Date(invite.expires_at).toLocaleDateString("vi-VN") : "N/A"}</td>
                          <td style={{ padding: "12px" }}>
                            {invite.status === "pending" && (
                              <button
                                onClick={async () => {
                                  if (!confirm("Hủy lời mời này?")) return;
                                  try {
                                    alert("Chức năng hủy lời mời chưa được triển khai");
                                  } catch (err) {
                                    alert((err as Error).message);
                                  }
                                }}
                                style={{
                                  padding: "6px 12px",
                                  background: "rgba(255,127,80,0.15)",
                                  border: "1px solid rgba(255,127,80,0.3)",
                                  borderRadius: "6px",
                                  color: "#ff7f50",
                                  cursor: "pointer",
                                  fontSize: "12px",
                                }}
                              >
                                Hủy
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
        </div>
      </section>
    </ShellPageChrome>
  );
}
