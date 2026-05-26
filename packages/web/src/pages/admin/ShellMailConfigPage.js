import { createElement, Fragment, useState, useEffect } from "react";
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

  if (loading) return createElement("div", null, "Đang tải cấu hình mail...");
  if (error) return createElement("div", null, "Lỗi: " + error);

  return createElement(
    "div",
    { className: "shell-page shell-mail-config-page" },
    // Header
    createElement(
      "div",
      { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" } },
      createElement("h2", null, "Quản trị Mail Vận Hành (SOC)"),
      createElement("button", { onClick: handleOpenCreate, style: { padding: "0.5rem 1rem" } }, "+ Tạo mới")
    ),
    // Config list
    createElement(
      "div",
      { className: "mail-config-list" },
      configs.length === 0
        ? createElement("p", null, "Chưa có cấu hình mail nào.")
        : createElement(
            "table",
            { style: { width: "100%", borderCollapse: "collapse" } },
            createElement(
              "thead",
              null,
              createElement(
                "tr",
                null,
                createElement("th", null, "ID"),
                createElement("th", null, "Provider"),
                createElement("th", null, "From Email"),
                createElement("th", null, "Host/Port"),
                createElement("th", null, "Trạng thái"),
                createElement("th", null, "Thao tác")
              )
            ),
            createElement(
              "tbody",
              null,
              configs.map((config) =>
                createElement(
                  "tr",
                  { key: config.id },
                  createElement("td", null, config.id),
                  createElement("td", null, config.provider),
                  createElement("td", null, config.from_email),
                  createElement(
                    "td",
                    null,
                    config.provider === "smtp" ? config.smtp_host + ":" + config.smtp_port : "N/A"
                  ),
                  createElement(
                    "td",
                    null,
                    config.is_active
                      ? createElement("span", { style: { color: "green", fontWeight: "bold" } }, "ACTIVE")
                      : createElement("span", { style: { color: "gray" } }, "INACTIVE")
                  ),
                  createElement(
                    "td",
                    { style: { whiteSpace: "nowrap" } },
                    createElement(
                      "button",
                      { onClick: () => handleOpenEdit(config), style: { marginRight: "0.25rem" } },
                      "Sửa"
                    ),
                    !config.is_active &&
                      createElement(
                        "button",
                        { onClick: () => handleActivate(config.id), style: { marginRight: "0.25rem" } },
                        "Kích hoạt"
                      ),
                    createElement(
                      "button",
                      { onClick: () => handleDelete(config.id), disabled: config.is_active },
                      "Xóa"
                    )
                  )
                )
              )
            )
          )
    ),
    // Test panel
    createElement(
      "div",
      { className: "mail-config-test-panel", style: { marginTop: "2rem", padding: "1rem", border: "1px solid #ccc" } },
      createElement("h3", null, "Bộ Thử Nghiệm Kết Nối (Live Testing)"),
      createElement(
        "div",
        null,
        createElement("label", null, "Email nhận test: "),
        createElement("input", {
          type: "email",
          value: testEmail,
          onChange: (e) => setTestEmail(e.target.value),
          placeholder: "admin@vninvest.vn",
        })
      ),
      createElement(
        "div",
        { style: { marginTop: "1rem" } },
        configs.map((config) =>
          createElement(
            "button",
            {
              key: "test-" + config.id,
              onClick: () => handleTestConnection(config),
              disabled: testLoading,
              style: { marginRight: "0.5rem" },
            },
            testLoading ? "Đang thử..." : "Test " + config.provider + " (ID: " + config.id + ")"
          )
        )
      ),
      testMessage &&
        createElement(
          "div",
          { style: { marginTop: "1rem", color: testMessage.type === "success" ? "green" : "red" } },
          testMessage.text
        )
    ),
    // Modal
    showModal &&
      createElement(
        "div",
        {
          style: {
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
          },
        },
        createElement(
          "div",
          {
            style: {
              background: "#fff",
              borderRadius: "8px",
              padding: "2rem",
              minWidth: "480px",
              maxWidth: "640px",
              maxHeight: "90vh",
              overflowY: "auto",
            },
          },
          createElement(
            "h3",
            null,
            editingConfig ? "Sửa cấu hình #" + editingConfig.id : "Tạo cấu hình mail mới"
          ),
          createElement(
            "form",
            { onSubmit: handleSubmitForm },
            // Provider
            createElement(
              "div",
              { style: { marginBottom: "1rem" } },
              createElement("label", null, "Provider: "),
              createElement(
                "select",
                { value: formData.provider, onChange: (e) => handleFormChange("provider", e.target.value) },
                createElement("option", { value: "smtp" }, "SMTP"),
                createElement("option", { value: "gmail_api" }, "Gmail API")
              )
            ),
            // From Email
            createElement(
              "div",
              { style: { marginBottom: "1rem" } },
              createElement("label", null, "From Email: "),
              createElement("input", {
                type: "email",
                value: formData.from_email,
                onChange: (e) => handleFormChange("from_email", e.target.value),
                required: true,
                style: { width: "100%", boxSizing: "border-box" },
              })
            ),
            // SMTP fields
            formData.provider === "smtp" &&
              createElement(
                Fragment,
                null,
                createElement(
                  "div",
                  { style: { marginBottom: "0.75rem" } },
                  createElement("label", null, "SMTP Host: "),
                  createElement("input", {
                    type: "text",
                    value: formData.smtp_host,
                    onChange: (e) => handleFormChange("smtp_host", e.target.value),
                    placeholder: "smtp.gmail.com",
                    style: { width: "100%", boxSizing: "border-box" },
                  })
                ),
                createElement(
                  "div",
                  { style: { marginBottom: "0.75rem" } },
                  createElement("label", null, "SMTP Port: "),
                  createElement("input", {
                    type: "number",
                    value: formData.smtp_port,
                    onChange: (e) => handleFormChange("smtp_port", e.target.value),
                    placeholder: "587",
                    style: { width: "100%", boxSizing: "border-box" },
                  })
                ),
                createElement(
                  "div",
                  { style: { marginBottom: "0.75rem" } },
                  createElement("label", null, "SMTP Username: "),
                  createElement("input", {
                    type: "text",
                    value: formData.smtp_username,
                    onChange: (e) => handleFormChange("smtp_username", e.target.value),
                    style: { width: "100%", boxSizing: "border-box" },
                  })
                ),
                createElement(
                  "div",
                  { style: { marginBottom: "0.75rem" } },
                  createElement("label", null, "SMTP Password: "),
                  createElement("input", {
                    type: "password",
                    value: formData.smtp_password,
                    onChange: (e) => handleFormChange("smtp_password", e.target.value),
                    placeholder: editingConfig ? "(Để trống nếu không đổi mật khẩu)" : "",
                    style: { width: "100%", boxSizing: "border-box" },
                  })
                ),
                createElement(
                  "div",
                  { style: { marginBottom: "0.75rem" } },
                  createElement(
                    "label",
                    null,
                    createElement("input", {
                      type: "checkbox",
                      checked: formData.smtp_use_tls,
                      onChange: (e) => handleFormChange("smtp_use_tls", e.target.checked),
                    }),
                    " Dùng TLS"
                  ),
                  " ",
                  createElement(
                    "label",
                    null,
                    createElement("input", {
                      type: "checkbox",
                      checked: formData.smtp_use_ssl,
                      onChange: (e) => handleFormChange("smtp_use_ssl", e.target.checked),
                    }),
                    " Dùng SSL"
                  )
                )
              ),
            // Gmail API fields
            formData.provider === "gmail_api" &&
              createElement(
                Fragment,
                null,
                createElement(
                  "div",
                  { style: { marginBottom: "0.75rem" } },
                  createElement("label", null, "Service Account JSON: "),
                  createElement("textarea", {
                    value: formData.google_service_account_json,
                    onChange: (e) => handleFormChange("google_service_account_json", e.target.value),
                    placeholder: editingConfig ? "(Để trống nếu không đổi)" : "Dán JSON service account...",
                    rows: 6,
                    style: { width: "100%", boxSizing: "border-box" },
                  })
                ),
                createElement(
                  "div",
                  { style: { marginBottom: "0.75rem" } },
                  createElement("label", null, "Delegated User Email: "),
                  createElement("input", {
                    type: "email",
                    value: formData.google_delegated_user_email,
                    onChange: (e) => handleFormChange("google_delegated_user_email", e.target.value),
                    style: { width: "100%", boxSizing: "border-box" },
                  })
                )
              ),
            // Form error
            formError &&
              createElement("div", { style: { color: "red", marginBottom: "1rem" } }, formError),
            // Action buttons
            createElement(
              "div",
              { style: { display: "flex", justifyContent: "flex-end", gap: "1rem" } },
              createElement(
                "button",
                { type: "button", onClick: handleCloseModal, disabled: formLoading },
                "Hủy"
              ),
              createElement(
                "button",
                { type: "submit", disabled: formLoading },
                formLoading ? "Đang lưu..." : editingConfig ? "Cập nhật" : "Tạo mới"
              )
            )
          )
        )
      )
  );
}
