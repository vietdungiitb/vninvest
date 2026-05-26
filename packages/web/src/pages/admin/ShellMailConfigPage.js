import React, { useState, useEffect } from "react";
import { coreApiAdapter } from "../../adapters/coreApiAdapter.js";

const EMPTY_FORM = {
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
};

export function ShellMailConfigPage() {
  const [configs, setConfigs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingConfig, setEditingConfig] = useState(null);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState(null);

  // Live test state
  const [testEmail, setTestEmail] = useState("");
  const [testLoading, setTestLoading] = useState(false);
  const [testMessage, setTestMessage] = useState(null);

  useEffect(() => {
    fetchConfigs();
  }, []);

  const fetchConfigs = async () => {
    try {
      setLoading(true);
      const res = await coreApiAdapter.getOperatorMailConfigs();
      setConfigs(res.results || []);
    } catch (err) {
      setError(err.message || "Không thể tải danh sách cấu hình mail.");
    } finally {
      setLoading(false);
    }
  };

  const handleActivate = async (id) => {
    try {
      await coreApiAdapter.activateOperatorMailConfig(id);
      fetchConfigs();
    } catch (err) {
      alert("Lỗi khi kích hoạt: " + err.message);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Bạn có chắc chắn muốn xóa cấu hình này?")) return;
    try {
      await coreApiAdapter.deleteOperatorMailConfig(id);
      fetchConfigs();
    } catch (err) {
      alert("Lỗi khi xóa: " + err.message);
    }
  };

  // Send only config_id — backend decrypts password from DB (no password over the wire)
  const handleTestConnection = async (config) => {
    if (!testEmail) {
      alert("Vui lòng nhập email nhận test.");
      return;
    }
    setTestLoading(true);
    setTestMessage(null);
    try {
      await coreApiAdapter.testOperatorMailConfig({
        config_id: config.id,
        test_email: testEmail,
      });
      setTestMessage({ type: "success", text: "Thử nghiệm kết nối thành công!" });
    } catch (err) {
      setTestMessage({ type: "error", text: "Thử nghiệm thất bại: " + err.message });
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

  const handleOpenEdit = (config) => {
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

  const handleFormChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmitForm = async (e) => {
    e.preventDefault();
    setFormLoading(true);
    setFormError(null);
    try {
      const payload = {
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
        if (formData.google_service_account_json)
          payload.google_service_account_json = formData.google_service_account_json;
        payload.google_delegated_user_email = formData.google_delegated_user_email;
      }
      if (editingConfig) {
        await coreApiAdapter.updateOperatorMailConfig(editingConfig.id, payload);
      } else {
        await coreApiAdapter.createOperatorMailConfig(payload);
      }
      handleCloseModal();
      fetchConfigs();
    } catch (err) {
      setFormError(err.message || "Lỗi khi lưu cấu hình.");
    } finally {
      setFormLoading(false);
    }
  };

  if (loading) return <div>Đang tải cấu hình mail...</div>;
  if (error) return <div>Lỗi: {error}</div>;

  return (
    <div className="shell-page shell-mail-config-page">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <h2>Quản trị Mail Vận Hành (SOC)</h2>
        <button onClick={handleOpenCreate} style={{ padding: "0.5rem 1rem" }}>
          + Tạo mới
        </button>
      </div>

      <div className="mail-config-list">
        {configs.length === 0 ? (
          <p>Chưa có cấu hình mail nào.</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th>ID</th>
                <th>Provider</th>
                <th>From Email</th>
                <th>Host/Port</th>
                <th>Trạng thái</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {configs.map((config) => (
                <tr key={config.id}>
                  <td>{config.id}</td>
                  <td>{config.provider}</td>
                  <td>{config.from_email}</td>
                  <td>
                    {config.provider === "smtp"
                      ? `${config.smtp_host}:${config.smtp_port}`
                      : "N/A"}
                  </td>
                  <td>
                    {config.is_active ? (
                      <span style={{ color: "green", fontWeight: "bold" }}>ACTIVE</span>
                    ) : (
                      <span style={{ color: "gray" }}>INACTIVE</span>
                    )}
                  </td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <button
                      onClick={() => handleOpenEdit(config)}
                      style={{ marginRight: "0.25rem" }}
                    >
                      Sửa
                    </button>
                    {!config.is_active && (
                      <button
                        onClick={() => handleActivate(config.id)}
                        style={{ marginRight: "0.25rem" }}
                      >
                        Kích hoạt
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(config.id)}
                      disabled={config.is_active}
                    >
                      Xóa
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div
        className="mail-config-test-panel"
        style={{ marginTop: "2rem", padding: "1rem", border: "1px solid #ccc" }}
      >
        <h3>Bộ Thử Nghiệm Kết Nối (Live Testing)</h3>
        <div>
          <label>Email nhận test: </label>
          <input
            type="email"
            value={testEmail}
            onChange={(e) => setTestEmail(e.target.value)}
            placeholder="admin@vninvest.vn"
          />
        </div>
        <div style={{ marginTop: "1rem" }}>
          {configs.map((config) => (
            <button
              key={`test-${config.id}`}
              onClick={() => handleTestConnection(config)}
              disabled={testLoading}
              style={{ marginRight: "0.5rem" }}
            >
              {testLoading ? "Đang thử..." : `Test ${config.provider} (ID: ${config.id})`}
            </button>
          ))}
        </div>
        {testMessage && (
          <div
            style={{
              marginTop: "1rem",
              color: testMessage.type === "success" ? "green" : "red",
            }}
          >
            {testMessage.text}
          </div>
        )}
      </div>

      {showModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.5)",
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: "8px",
              padding: "2rem",
              minWidth: "480px",
              maxWidth: "640px",
              maxHeight: "90vh",
              overflowY: "auto",
            }}
          >
            <h3>
              {editingConfig
                ? `Sửa cấu hình #${editingConfig.id}`
                : "Tạo cấu hình mail mới"}
            </h3>
            <form onSubmit={handleSubmitForm}>
              <div style={{ marginBottom: "1rem" }}>
                <label>Provider: </label>
                <select
                  value={formData.provider}
                  onChange={(e) => handleFormChange("provider", e.target.value)}
                >
                  <option value="smtp">SMTP</option>
                  <option value="gmail_api">Gmail API</option>
                </select>
              </div>
              <div style={{ marginBottom: "1rem" }}>
                <label>From Email: </label>
                <input
                  type="email"
                  value={formData.from_email}
                  onChange={(e) => handleFormChange("from_email", e.target.value)}
                  required
                  style={{ width: "100%", boxSizing: "border-box" }}
                />
              </div>
              {formData.provider === "smtp" && (
                <>
                  <div style={{ marginBottom: "0.75rem" }}>
                    <label>SMTP Host: </label>
                    <input
                      type="text"
                      value={formData.smtp_host}
                      onChange={(e) => handleFormChange("smtp_host", e.target.value)}
                      placeholder="smtp.gmail.com"
                      style={{ width: "100%", boxSizing: "border-box" }}
                    />
                  </div>
                  <div style={{ marginBottom: "0.75rem" }}>
                    <label>SMTP Port: </label>
                    <input
                      type="number"
                      value={formData.smtp_port}
                      onChange={(e) => handleFormChange("smtp_port", e.target.value)}
                      placeholder="587"
                      style={{ width: "100%", boxSizing: "border-box" }}
                    />
                  </div>
                  <div style={{ marginBottom: "0.75rem" }}>
                    <label>SMTP Username: </label>
                    <input
                      type="text"
                      value={formData.smtp_username}
                      onChange={(e) => handleFormChange("smtp_username", e.target.value)}
                      style={{ width: "100%", boxSizing: "border-box" }}
                    />
                  </div>
                  <div style={{ marginBottom: "0.75rem" }}>
                    <label>SMTP Password: </label>
                    <input
                      type="password"
                      value={formData.smtp_password}
                      onChange={(e) => handleFormChange("smtp_password", e.target.value)}
                      placeholder={editingConfig ? "(Để trống nếu không đổi mật khẩu)" : ""}
                      style={{ width: "100%", boxSizing: "border-box" }}
                    />
                  </div>
                  <div style={{ marginBottom: "0.75rem" }}>
                    <label>
                      <input
                        type="checkbox"
                        checked={formData.smtp_use_tls}
                        onChange={(e) => handleFormChange("smtp_use_tls", e.target.checked)}
                      />{" "}
                      Dùng TLS
                    </label>{" "}
                    <label>
                      <input
                        type="checkbox"
                        checked={formData.smtp_use_ssl}
                        onChange={(e) => handleFormChange("smtp_use_ssl", e.target.checked)}
                      />{" "}
                      Dùng SSL
                    </label>
                  </div>
                </>
              )}
              {formData.provider === "gmail_api" && (
                <>
                  <div style={{ marginBottom: "0.75rem" }}>
                    <label>Service Account JSON: </label>
                    <textarea
                      value={formData.google_service_account_json}
                      onChange={(e) =>
                        handleFormChange("google_service_account_json", e.target.value)
                      }
                      placeholder={
                        editingConfig ? "(Để trống nếu không đổi)" : "Dán JSON service account..."
                      }
                      rows={6}
                      style={{ width: "100%", boxSizing: "border-box" }}
                    />
                  </div>
                  <div style={{ marginBottom: "0.75rem" }}>
                    <label>Delegated User Email: </label>
                    <input
                      type="email"
                      value={formData.google_delegated_user_email}
                      onChange={(e) =>
                        handleFormChange("google_delegated_user_email", e.target.value)
                      }
                      style={{ width: "100%", boxSizing: "border-box" }}
                    />
                  </div>
                </>
              )}
              {formError && (
                <div style={{ color: "red", marginBottom: "1rem" }}>{formError}</div>
              )}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "1rem" }}>
                <button type="button" onClick={handleCloseModal} disabled={formLoading}>
                  Hủy
                </button>
                <button type="submit" disabled={formLoading}>
                  {formLoading
                    ? "Đang lưu..."
                    : editingConfig
                    ? "Cập nhật"
                    : "Tạo mới"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
