import { Fragment, useState, useEffect } from "react";
import { coreApiAdapter } from "../../adapters/coreApiAdapter.js";
import {
  ShellPageChrome,
  ShellPanel,
  ShellMetric,
  ShellField,
  ShellSelectField,
} from "../../components/ShellPageTemplate.js";

interface MailConfigFormData {
  provider: string;
  from_email: string;
  smtp_host: string;
  smtp_port: string;
  smtp_username: string;
  smtp_password: string;
  smtp_use_tls: boolean;
  smtp_use_ssl: boolean;
  google_service_account_json: string;
  google_delegated_user_email: string;
  google_oauth2_refresh_token: string;
}

interface MailConfig {
  id: number;
  provider: string;
  from_email: string;
  is_active: boolean;
  smtp_host?: string;
  smtp_port?: number;
  smtp_username?: string;
  smtp_use_tls?: boolean;
  smtp_use_ssl?: boolean;
  google_delegated_user_email?: string;
  [key: string]: unknown;
}

const EMPTY_FORM: MailConfigFormData = {
  provider: "smtp",
  from_email: "",
  smtp_host: "",
  smtp_port: "587",
  smtp_username: "",
  smtp_password: "",
  smtp_use_tls: true,
  smtp_use_ssl: false,
  google_service_account_json: "",
  google_delegated_user_email: "",
  google_oauth2_refresh_token: "",
};

interface TestMessage {
  type: "success" | "error";
  text: string;
}

const PROVIDER_LABELS: Record<string, string> = { smtp: "SMTP", gmail_api: "Gmail API" };

const mailApi = coreApiAdapter as unknown as {
  getOperatorMailConfigs: () => Promise<{ results?: MailConfig[] }>;
  activateOperatorMailConfig: (id: number) => Promise<void>;
  deleteOperatorMailConfig: (id: number) => Promise<void>;
  testOperatorMailConfig: (data: { config_id: number; test_email: string }) => Promise<void>;
  updateOperatorMailConfig: (id: number, data: Record<string, unknown>) => Promise<void>;
  createOperatorMailConfig: (data: Record<string, unknown>) => Promise<void>;
};

export function ShellMailConfigPage() {
  const [configs, setConfigs] = useState<MailConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingConfig, setEditingConfig] = useState<MailConfig | null>(null);
  const [formData, setFormData] = useState<MailConfigFormData>(EMPTY_FORM);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Live test state
  const [testEmail, setTestEmail] = useState("");
  const [testLoading, setTestLoading] = useState(false);
  const [testMessage, setTestMessage] = useState<TestMessage | null>(null);

  useEffect(() => {
    fetchConfigs();
  }, []);

  const fetchConfigs = async () => {
    try {
      setLoading(true);
      const res = await mailApi.getOperatorMailConfigs();
      setConfigs(res.results || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể tải danh sách cấu hình mail.");
    } finally {
      setLoading(false);
    }
  };

  const handleActivate = async (id: number) => {
    try {
      await mailApi.activateOperatorMailConfig(id);
      fetchConfigs();
    } catch (err) {
      alert("Lỗi khi kích hoạt: " + (err instanceof Error ? err.message : String(err)));
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("Bạn có chắc chắn muốn xóa cấu hình này?")) return;
    try {
      await mailApi.deleteOperatorMailConfig(id);
      fetchConfigs();
    } catch (err) {
      alert("Lỗi khi xóa: " + (err instanceof Error ? err.message : String(err)));
    }
  };

  // Send only config_id — backend decrypts password from DB (no password over the wire)
  const handleTestConnection = async (config: MailConfig) => {
    if (!testEmail) {
      alert("Vui lòng nhập email nhận test.");
      return;
    }
    setTestLoading(true);
    setTestMessage(null);
    try {
      await mailApi.testOperatorMailConfig({
        config_id: config.id,
        test_email: testEmail,
      });
      setTestMessage({ type: "success", text: "Thử nghiệm kết nối thành công!" });
    } catch (err) {
      setTestMessage({ type: "error", text: "Thử nghiệm thất bại: " + (err instanceof Error ? err.message : String(err)) });
    } finally {
      setTestLoading(false);
    }
  };

  const handleOpenCreate = () => {
    setEditingConfig(null);
    setFormData(EMPTY_FORM);
    setFormError(null);
    setShowModal(true);
  };

  const handleOpenEdit = (config: MailConfig) => {
    setEditingConfig(config);
    setFormData({
      provider: config.provider || "smtp",
      from_email: config.from_email || "",
      smtp_host: config.smtp_host || "",
      smtp_port: String(config.smtp_port || "587"),
      smtp_username: config.smtp_username || "",
      smtp_password: "", // không pre-fill mật khẩu
      smtp_use_tls: config.smtp_use_tls !== undefined ? config.smtp_use_tls : true,
      smtp_use_ssl: config.smtp_use_ssl !== undefined ? config.smtp_use_ssl : false,
      google_service_account_json: "", // không pre-fill secret
      google_delegated_user_email: config.google_delegated_user_email || "",
      google_oauth2_refresh_token: "",
    });
    setFormError(null);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingConfig(null);
    setFormData(EMPTY_FORM);
    setFormError(null);
  };

  const handleFormChange = (field: keyof MailConfigFormData, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setFormError(null);
    try {
      const payload: Record<string, unknown> = {
        provider: formData.provider,
        from_email: formData.from_email,
      };
      if (formData.provider === "smtp") {
        payload.smtp_host = formData.smtp_host;
        payload.smtp_port = parseInt(formData.smtp_port, 10);
        payload.smtp_username = formData.smtp_username;
        if (formData.smtp_password) payload.smtp_password = formData.smtp_password;
        payload.smtp_use_tls = formData.smtp_use_tls;
        payload.smtp_use_ssl = formData.smtp_use_ssl;
      } else if (formData.provider === "gmail_api") {
        const rt = formData.google_oauth2_refresh_token.trim();
        let saJson = formData.google_service_account_json.trim();
        // Nếu có refresh_token, nhúng vào JSON trước khi lưu
        if (rt && saJson) {
          try {
            const parsed = JSON.parse(saJson) as Record<string, unknown>;
            parsed.refresh_token = rt;
            saJson = JSON.stringify(parsed);
          } catch (_) {
            // JSON không hợp lệ → để backend báo lỗi
          }
        }
        if (saJson) payload.google_service_account_json = saJson;
        payload.google_delegated_user_email = formData.google_delegated_user_email;
      }
      if (editingConfig) {
        await mailApi.updateOperatorMailConfig(editingConfig.id, payload);
      } else {
        await mailApi.createOperatorMailConfig(payload);
      }
      handleCloseModal();
      fetchConfigs();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Lỗi khi lưu cấu hình.");
    } finally {
      setFormLoading(false);
    }
  };

  // ── derived state ──────────────────────────────────────────────────────────
  const activeConfig = configs.find((c) => c.is_active);

  // ── metrics strip ──────────────────────────────────────────────────────────
  const metrics = [
    <ShellMetric key="total" label="Tổng cấu hình" value={loading ? "…" : String(configs.length)} />,
    <ShellMetric
      key="active"
      label="Đang hoạt động"
      value={activeConfig ? activeConfig.from_email || "ID " + activeConfig.id : "Chưa có"}
    />,
    <ShellMetric
      key="provider"
      label="Provider"
      value={activeConfig ? PROVIDER_LABELS[activeConfig.provider] || activeConfig.provider : "—"}
    />,
  ];

  // ── config list panel ──────────────────────────────────────────────────────
  const configListContent = loading
    ? <p className="shellPage__empty">Đang tải cấu hình…</p>
    : configs.length === 0
    ? <div className="shellPage__empty">Chưa có cấu hình mail nào.</div>
    : (
      <div className="shellPage__list">
        {configs.map((config) => {
          const hostPort =
            config.provider === "smtp"
              ? (config.smtp_host || "—") + ":" + (config.smtp_port || "587")
              : config.google_delegated_user_email
              ? "Gmail API · " + config.google_delegated_user_email
              : "Gmail API";

          return (
            <div key={String(config.id)} className="shellPage__listItem">
              <div className="shellPage__listItemHeader">
                <div>
                  <h3 className="shellPage__itemTitle">
                    {(PROVIDER_LABELS[config.provider] || config.provider) + " — " + (config.from_email || "—")}
                  </h3>
                  <p className="shellPage__itemMeta">{hostPort}</p>
                </div>
                <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
                  {config.is_active
                    ? <span className="shellPage__pill">✓ Đang hoạt động</span>
                    : (
                      <span
                        className="shellPage__pill"
                        style={{ background: "rgba(16,42,67,0.08)", color: "var(--shell-muted)" }}
                      >
                        Không hoạt động
                      </span>
                    )}
                  <button
                    className="shellPage__button shellPage__button--secondary"
                    style={{ padding: "6px 12px", fontSize: "13px" }}
                    onClick={() => handleOpenEdit(config)}
                  >
                    Sửa
                  </button>
                  {!config.is_active && (
                    <button
                      className="shellPage__button shellPage__button--primary"
                      style={{ padding: "6px 12px", fontSize: "13px" }}
                      onClick={() => handleActivate(config.id)}
                    >
                      Kích hoạt
                    </button>
                  )}
                  {!config.is_active && (
                    <button
                      className="shellPage__button shellPage__button--signal"
                      style={{ padding: "6px 12px", fontSize: "13px" }}
                      onClick={() => handleDelete(config.id)}
                    >
                      Xóa
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );

  // ── test panel ─────────────────────────────────────────────────────────────
  const testPanelContent = (
    <div className="shellPage__form">
      <ShellField
        label="Email nhận test"
        name="testEmail"
        type="email"
        value={testEmail}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTestEmail(e.target.value)}
        placeholder="admin@vninvest.vn"
      />
      {configs.length > 0 && (
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          {configs.map((config) => (
            <button
              key={"test-" + config.id}
              className="shellPage__button shellPage__button--signal"
              style={{ fontSize: "13px" }}
              onClick={() => handleTestConnection(config)}
              disabled={testLoading || !testEmail}
            >
              {testLoading
                ? "Đang thử…"
                : "Test " + (PROVIDER_LABELS[config.provider] || config.provider) + " #" + config.id}
            </button>
          ))}
        </div>
      )}
      {testMessage && (
        <div
          className={
            "shellPage__banner " +
            (testMessage.type === "success" ? "shellPage__banner--notice" : "shellPage__banner--error")
          }
        >
          {testMessage.text}
        </div>
      )}
    </div>
  );

  // ── modal overlay ──────────────────────────────────────────────────────────
  const modalOverlay = showModal && (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(10,20,40,0.6)",
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      onClick={(e: React.MouseEvent) => {
        if (e.target === e.currentTarget) handleCloseModal();
      }}
    >
      <div
        className="shellPage__panel"
        style={{
          minWidth: "480px",
          maxWidth: "640px",
          width: "100%",
          maxHeight: "90vh",
          overflowY: "auto",
        }}
      >
        <div className="shellPage__panelHeader">
          <div>
            <h2 className="shellPage__panelTitle">
              {editingConfig ? "Sửa cấu hình #" + editingConfig.id : "Tạo cấu hình mail mới"}
            </h2>
          </div>
          <button
            className="shellPage__button shellPage__button--secondary"
            style={{ padding: "6px 12px", fontSize: "16px" }}
            onClick={handleCloseModal}
            type="button"
          >
            ✕
          </button>
        </div>
        <form className="shellPage__form" onSubmit={handleSubmitForm}>
          {/* Provider + From Email */}
          <div className="shellPage__formGrid">
            <ShellSelectField
              label="Provider"
              name="provider"
              value={formData.provider}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => handleFormChange("provider", e.target.value)}
              options={[
                { key: "smtp", label: "SMTP" },
                { key: "gmail_api", label: "Gmail API" },
              ]}
            />
            <ShellField
              label="From Email *"
              name="from_email"
              type="email"
              value={formData.from_email}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleFormChange("from_email", e.target.value)}
              placeholder="no-reply@example.com"
            />
          </div>

          {/* SMTP-specific fields */}
          {formData.provider === "smtp" && (
            <Fragment>
              <div className="shellPage__formGrid">
                <ShellField
                  label="SMTP Host"
                  name="smtp_host"
                  value={formData.smtp_host}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleFormChange("smtp_host", e.target.value)}
                  placeholder="smtp.gmail.com"
                />
                <ShellField
                  label="SMTP Port"
                  name="smtp_port"
                  type="number"
                  value={formData.smtp_port}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleFormChange("smtp_port", e.target.value)}
                  placeholder="587"
                />
              </div>
              <div className="shellPage__formGrid">
                <ShellField
                  label="SMTP Username"
                  name="smtp_username"
                  value={formData.smtp_username}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleFormChange("smtp_username", e.target.value)}
                />
                <ShellField
                  label={editingConfig ? "SMTP Password (để trống = giữ nguyên)" : "SMTP Password"}
                  name="smtp_password"
                  type="password"
                  value={formData.smtp_password}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleFormChange("smtp_password", e.target.value)}
                  placeholder={editingConfig ? "(Để trống nếu không đổi)" : ""}
                />
              </div>
              <div style={{ display: "flex", gap: "24px" }}>
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    cursor: "pointer",
                    fontSize: "14px",
                    fontWeight: "700",
                    color: "var(--shell-muted)",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={formData.smtp_use_tls}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleFormChange("smtp_use_tls", e.target.checked)}
                  />
                  Dùng TLS
                </label>
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    cursor: "pointer",
                    fontSize: "14px",
                    fontWeight: "700",
                    color: "var(--shell-muted)",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={formData.smtp_use_ssl}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleFormChange("smtp_use_ssl", e.target.checked)}
                  />
                  Dùng SSL
                </label>
              </div>
            </Fragment>
          )}

          {/* Gmail API-specific fields */}
          {formData.provider === "gmail_api" && (
            <Fragment>
              <label className="shellPage__field">
                <span className="shellPage__fieldLabel">
                  Credentials JSON (Service Account hoặc OAuth2 Web Client)
                </span>
                <textarea
                  className="shellPage__input"
                  value={formData.google_service_account_json}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => handleFormChange("google_service_account_json", e.target.value)}
                  placeholder={editingConfig
                    ? "(Để trống nếu không đổi)"
                    : 'Dán JSON từ Google Cloud Console\n(Service Account JSON hoặc OAuth2 Web Client JSON)'}
                  rows={6}
                  style={{ resize: "vertical" }}
                />
                <span
                  style={{
                    fontSize: "12px",
                    color: "var(--shell-muted)",
                    marginTop: "4px",
                    display: "block",
                  }}
                >
                  Service Account: type="service_account". OAuth2 Web Client: type không có / wrapper "web".
                </span>
              </label>
              <ShellField
                label="OAuth2 Refresh Token"
                name="google_oauth2_refresh_token"
                type="password"
                value={formData.google_oauth2_refresh_token}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleFormChange("google_oauth2_refresh_token", e.target.value)}
                placeholder="1//... (OAuth2 Web Client flow — để trống nếu dùng Service Account)"
              />
              <ShellField
                label="Delegated User Email (Service Account DWD)"
                name="google_delegated_user_email"
                type="email"
                value={formData.google_delegated_user_email}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleFormChange("google_delegated_user_email", e.target.value)}
                placeholder="admin@yourdomain.com (chỉ cần với Service Account DWD)"
              />
            </Fragment>
          )}

          {/* Form error */}
          {formError && (
            <div className="shellPage__banner shellPage__banner--error">{formError}</div>
          )}

          {/* Action buttons */}
          <div className="shellPage__actions" style={{ justifyContent: "flex-end" }}>
            <button
              type="button"
              className="shellPage__button shellPage__button--secondary"
              onClick={handleCloseModal}
              disabled={formLoading}
            >
              Hủy
            </button>
            <button
              type="submit"
              className="shellPage__button shellPage__button--primary"
              disabled={formLoading}
            >
              {formLoading ? "Đang lưu…" : editingConfig ? "Cập nhật" : "Tạo mới"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  // ── page chrome ────────────────────────────────────────────────────────────
  return (
    <ShellPageChrome
      eyebrow="Hệ thống · SOC"
      title="Quản trị Mail Vận Hành"
      description="Cấu hình email hệ thống dùng để gửi thông báo, cảnh báo và liên lạc vận hành."
      badge={
        <button
          className="shellPage__button shellPage__button--primary"
          onClick={handleOpenCreate}
          type="button"
        >
          + Tạo mới
        </button>
      }
      metrics={metrics}
      error={error || undefined}
    >
      <div className="shellPage__bodyGrid">
        <ShellPanel
          title="Danh sách cấu hình"
          subtitle="Chọn Kích hoạt để đặt làm provider gửi mail mặc định của hệ thống."
        >
          {configListContent}
        </ShellPanel>
        <ShellPanel
          title="Thử Nghiệm Kết Nối"
          subtitle="Gửi email thử để kiểm tra cấu hình đang hoạt động."
        >
          {testPanelContent}
        </ShellPanel>
      </div>
      {modalOverlay}
    </ShellPageChrome>
  );
}
