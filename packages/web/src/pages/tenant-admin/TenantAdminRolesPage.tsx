import { useEffect, useState } from "react";
import { ShellPageChrome, ShellPanel, ShellField } from "../../components/ShellPageTemplate.js";
import { ShellSkeleton } from "../../components/ShellSkeleton.js";
import { defaultCoreApiAdapter } from "../../adapters/coreApiAdapter.js";
import { useI18n } from "../../context/LangContext.js";
import { usePortfolio } from "../../context/PortfolioContext.js";
import { useToast } from "../../components/ShellToast.js";
import { useAbility } from "../../context/AbilityContext.js";
import { useQueryClient } from "@tanstack/react-query";
import { useTenantAdminQuery, invalidateTenantAdminQueries } from "./useTenantAdminQuery.js";

interface CustomRole {
  public_id: string;
  name: string;
  permissions: string[];
  is_system: boolean;
  member_count: number;
  created_at?: string;
  updated_at?: string;
}

const ALL_TOKENS: { token: string; label: string }[] = [
  { token: "member:read", label: "Thành viên (đọc)" },
  { token: "member:write", label: "Thành viên (ghi)" },
  { token: "sa:read", label: "Service Account (đọc)" },
  { token: "sa:write", label: "Service Account (ghi)" },
  { token: "pat:read", label: "PAT (đọc)" },
  { token: "pat:write", label: "PAT (ghi)" },
  { token: "usage:read", label: "Sử dụng (đọc)" },
  { token: "dashboard:read", label: "Dashboard (đọc)" },
  { token: "security:read", label: "Bảo mật (đọc)" },
  { token: "alert:read", label: "Cảnh báo (đọc)" },
  { token: "alert:write", label: "Cảnh báo (ghi)" },
  { token: "forecast:read", label: "Dự báo (đọc)" },
  { token: "forecast:write", label: "Dự báo (ghi)" },
  { token: "webhook:read", label: "Webhook (đọc)" },
  { token: "webhook:write", label: "Webhook (ghi)" },
  { token: "sso:read", label: "SSO (đọc)" },
  { token: "sso:write", label: "SSO (ghi)" },
  { token: "billing:read", label: "Billing (đọc)" },
  { token: "billing:write", label: "Billing (ghi)" },
  { token: "settings:read", label: "Cài đặt (đọc)" },
  { token: "settings:write", label: "Cài đặt (ghi)" },
  { token: "tenant:write", label: "Tenant (ghi)" },
];

const BUTTON_STYLE: React.CSSProperties = {
  padding: "10px 16px",
  borderRadius: "8px",
  fontSize: "13px",
  fontWeight: 600,
  cursor: "pointer",
  border: "1px solid rgba(255,255,255,0.1)",
  background: "var(--accent-shell)",
  color: "#fff",
  fontFamily: "inherit",
};

const BUTTON_SECONDARY_STYLE: React.CSSProperties = {
  ...BUTTON_STYLE,
  background: "transparent",
  color: "var(--text-secondary)",
};

const BUTTON_DANGER_STYLE: React.CSSProperties = {
  ...BUTTON_STYLE,
  background: "var(--ta-c-ef4444, #ef4444)",
  border: "1px solid var(--ta-c-ef4444, #ef4444)",
};

export function TenantAdminRolesPage() {
  const { t } = useI18n();
  const { activeTenantId } = usePortfolio();
  const ability = useAbility();
  const toast = useToast();
  const queryClient = useQueryClient();

  const [roles, setRoles] = useState<CustomRole[]>([]);
  const [saving, setSaving] = useState(false);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<CustomRole | null>(null);
  const [formName, setFormName] = useState("");
  const [formPerms, setFormPerms] = useState<string[]>([]);
  const [formError, setFormError] = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<CustomRole | null>(null);
  const [deleting, setDeleting] = useState(false);

  const canManage = ability.can("manage", "TenantRoleAdmin");

  const { data, isLoading: loading, error } = useTenantAdminQuery<{ roles: CustomRole[] }>(
    ["tenant-roles"],
    `/core/v1/partner/roles/`,
    { headers: activeTenantId ? { "X-Tenant-ID": activeTenantId } : undefined, enabled: !!activeTenantId },
  );

  useEffect(() => {
    if (data?.roles) {
      setRoles(Array.isArray(data.roles) ? data.roles : []);
    }
  }, [data]);

  const openCreate = () => {
    setEditing(null);
    setFormName("");
    setFormPerms([]);
    setFormError(null);
    setEditorOpen(true);
  };

  const openEdit = (role: CustomRole) => {
    if (role.is_system) return;
    setEditing(role);
    setFormName(role.name);
    setFormPerms(role.permissions || []);
    setFormError(null);
    setEditorOpen(true);
  };

  const togglePerm = (token: string) => {
    setFormPerms((prev) =>
      prev.includes(token) ? prev.filter((p) => p !== token) : [...prev, token],
    );
  };

  const saveRole = async () => {
    if (!formName.trim()) {
      setFormError(t("tenantRoles.nameRequired") || "Tên vai trò là bắt buộc.");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const payload = { name: formName.trim(), permissions: formPerms };
      if (editing) {
        await (defaultCoreApiAdapter as any).corePatch(
          `/core/v1/partner/roles/${editing.public_id}/`,
          payload,
          { headers: { "X-Tenant-ID": activeTenantId } },
        );
        toast.success(t("tenantRoles.updateSuccess") || "Role updated");
      } else {
        await (defaultCoreApiAdapter as any).corePost(
          `/core/v1/partner/roles/`,
          payload,
          { headers: { "X-Tenant-ID": activeTenantId } },
        );
        toast.success(t("tenantRoles.createSuccess") || "Role created");
      }
      setEditorOpen(false);
      invalidateTenantAdminQueries(queryClient);
    } catch (err: any) {
      const detail = err?.payload?.detail || err?.message;
      setFormError(detail || (t("tenantRoles.saveFailed") || "Failed to save role"));
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await (defaultCoreApiAdapter as any).coreDelete(
        `/core/v1/partner/roles/${deleteTarget.public_id}/`,
        { headers: { "X-Tenant-ID": activeTenantId } },
      );
      toast.success(t("tenantRoles.deleteSuccess") || "Role deleted");
      setDeleteTarget(null);
      invalidateTenantAdminQueries(queryClient);
    } catch {
      toast.error(t("tenantRoles.deleteFailed") || "Failed to delete role");
    } finally {
      setDeleting(false);
    }
  };

  if (loading && !data) {
    return (
      <ShellPageChrome
        eyebrow={t("tenantRoles.eyebrow") || "Tenant Roles"}
        title={t("tenantRoles.title") || "Vai trò tùy chỉnh"}
      >
        <ShellSkeleton variant="card" count={4} />
      </ShellPageChrome>
    );
  }

  if (error) {
    return (
      <ShellPageChrome
        eyebrow={t("tenantRoles.eyebrow") || "Tenant Roles"}
        title={t("tenantRoles.title") || "Vai trò tùy chỉnh"}
        error={error.message || t("tenantRoles.loadFailed")}
      >
        <div className="panel-error">{error.message || t("tenantRoles.loadFailed")}</div>
      </ShellPageChrome>
    );
  }

  return (
    <ShellPageChrome
      eyebrow={t("tenantRoles.eyebrow") || "Tenant Roles"}
      title={t("tenantRoles.title") || "Vai trò tùy chỉnh"}
      description={t("tenantRoles.description") || "Định nghĩa vai trò với quyền hạt giống cho thành viên tenant."}
    >
      <ShellPanel>
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "16px" }}>
          <button
            style={{ ...BUTTON_STYLE, opacity: canManage ? 1 : 0.5 }}
            onClick={openCreate}
            disabled={!canManage}
          >
            {t("tenantRoles.create") || "Tạo vai trò"}
          </button>
        </div>

        {roles.length === 0 ? (
          <p style={{ color: "var(--text-secondary)", fontSize: "13px" }}>
            {t("tenantRoles.empty") || "Chưa có vai trò tùy chỉnh nào."}
          </p>
        ) : (
          <div style={{ display: "grid", gap: "12px" }}>
            {roles.map((role) => (
              <div
                key={role.public_id}
                style={{
                  border: "1px solid rgba(255,255,255,0.06)",
                  borderRadius: "10px",
                  padding: "14px 16px",
                  background: "rgba(255,255,255,0.02)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <strong style={{ fontSize: "14px" }}>{role.name}</strong>
                    {role.is_system && (
                      <span
                        style={{
                          fontSize: "10px", fontWeight: 800, color: "var(--ta-c-f59e0b, #f59e0b)",
                          background: "rgba(245,158,11,0.12)", padding: "2px 6px",
                          borderRadius: "999px", textTransform: "uppercase",
                        }}
                      >
                        {t("tenantRoles.system") || "Hệ thống"}
                      </span>
                    )}
                    <span style={{ fontSize: "11px", color: "var(--text-tertiary)" }}>
                      {role.member_count} {t("tenantRoles.members") || "thành viên"}
                    </span>
                  </div>
                  {!role.is_system && canManage && (
                    <div style={{ display: "flex", gap: "8px" }}>
                      <button style={BUTTON_SECONDARY_STYLE} onClick={() => openEdit(role)}>
                        {t("tenantRoles.edit") || "Sửa"}
                      </button>
                      <button style={BUTTON_DANGER_STYLE} onClick={() => setDeleteTarget(role)}>
                        {t("tenantRoles.delete") || "Xoá"}
                      </button>
                    </div>
                  )}
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", marginTop: "10px" }}>
                  {(role.permissions || []).map((p) => {
                    const label = ALL_TOKENS.find((x) => x.token === p)?.label || p;
                    return (
                      <span
                        key={p}
                        style={{
                          fontSize: "11px", color: "var(--ta-c-00b4d8, #00b4d8)",
                          background: "rgba(0,180,216,0.12)", padding: "2px 8px",
                          borderRadius: "10px",
                        }}
                      >
                        {label}
                      </span>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </ShellPanel>

      {editorOpen && (
        <div
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)",
            display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000,
          }}
          onClick={() => !saving && setEditorOpen(false)}
        >
          <div
            style={{
              background: "var(--ta-c-1e293b, #1e293b)", borderRadius: "12px",
              padding: "24px", width: "90%", maxWidth: "560px", maxHeight: "90vh", overflow: "auto",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ fontSize: "16px", fontWeight: 700, marginBottom: "16px" }}>
              {editing
                ? (t("tenantRoles.editTitle") || "Sửa vai trò")
                : (t("tenantRoles.createTitle") || "Tạo vai trò")}
            </h3>

            <ShellField
              label={t("tenantRoles.nameLabel") || "Tên vai trò"}
              name="roleName"
              value={formName}
              onChange={(e: any) => setFormName(e.target.value)}
              placeholder="Analyst"
            />

            <p style={{ fontSize: "12px", color: "var(--text-secondary)", margin: "16px 0 8px" }}>
              {t("tenantRoles.permissionsLabel") || "Quyền hạt giống"}
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
              {ALL_TOKENS.map((x) => {
                const active = formPerms.includes(x.token);
                return (
                  <button
                    key={x.token}
                    type="button"
                    onClick={() => togglePerm(x.token)}
                    style={{
                      fontSize: "11px", padding: "4px 10px", borderRadius: "999px",
                      cursor: "pointer", fontFamily: "inherit",
                      border: active ? "1px solid var(--ta-c-00b4d8, #00b4d8)" : "1px solid rgba(255,255,255,0.08)",
                      background: active ? "rgba(0,180,216,0.18)" : "transparent",
                      color: active ? "var(--ta-c-00b4d8, #00b4d8)" : "var(--text-secondary)",
                      fontWeight: active ? 700 : 500,
                    }}
                  >
                    {x.label}
                  </button>
                );
              })}
            </div>

            {formError && (
              <p style={{ color: "var(--ta-c-ef4444, #ef4444)", fontSize: "13px", marginTop: "12px" }}>
                {formError}
              </p>
            )}

            <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end", marginTop: "20px" }}>
              <button style={BUTTON_SECONDARY_STYLE} onClick={() => setEditorOpen(false)} disabled={saving}>
                {t("tenantRoles.cancel") || "Huỷ"}
              </button>
              <button style={{ ...BUTTON_STYLE, opacity: saving ? 0.5 : 1 }} onClick={saveRole} disabled={saving}>
                {saving
                  ? (t("tenantRoles.saving") || "Đang lưu...")
                  : (editing ? (t("tenantRoles.save") || "Lưu") : (t("tenantRoles.create") || "Tạo vai trò"))}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)",
            display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000,
          }}
          onClick={() => !deleting && setDeleteTarget(null)}
        >
          <div
            style={{
              background: "var(--ta-c-1e293b, #1e293b)", borderRadius: "12px",
              padding: "24px", width: "90%", maxWidth: "440px",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ fontSize: "16px", fontWeight: 700, marginBottom: "12px", color: "var(--ta-c-ef4444, #ef4444)" }}>
              {t("tenantRoles.deleteTitle") || "Xoá vai trò"}
            </h3>
            <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "16px", lineHeight: 1.5 }}>
              {t("tenantRoles.deleteConfirm") || "Xoá vai trò"} "{deleteTarget.name}"?{" "}
              {t("tenantRoles.deleteReassign") || "Thành viên sẽ được gán lại vai trò mặc định."}
            </p>
            <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
              <button style={BUTTON_SECONDARY_STYLE} onClick={() => setDeleteTarget(null)} disabled={deleting}>
                {t("tenantRoles.cancel") || "Huỷ"}
              </button>
              <button style={{ ...BUTTON_DANGER_STYLE, opacity: deleting ? 0.5 : 1 }} onClick={confirmDelete} disabled={deleting}>
                {deleting ? (t("tenantRoles.deleting") || "Đang xoá...") : (t("tenantRoles.delete") || "Xoá")}
              </button>
            </div>
          </div>
        </div>
      )}
    </ShellPageChrome>
  );
}
