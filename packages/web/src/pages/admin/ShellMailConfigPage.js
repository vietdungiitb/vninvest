import { createElement, Fragment, useState, useEffect } from "react";
import { coreApiAdapter } from "../../adapters/coreApiAdapter.js";
import {
  renderShellPageChrome,
  renderShellPanel,
  renderShellMetric,
  renderShellField,
  renderShellSelectField,
} from "../../components/ShellPageTemplate.js";

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
  google_oauth2_refresh_token: "",
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
        const rt = formData.google_oauth2_refresh_token.trim();
        let saJson = formData.google_service_account_json.trim();
        // Nếu có refresh_token, nhúng vào JSON trước khi lưu
        if (rt && saJson) {
          try {
            const parsed = JSON.parse(saJson);
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

  // ── derived state ──────────────────────────────────────────────────────────
  const PROVIDER_LABELS = { smtp: "SMTP", gmail_api: "Gmail API" };
  const activeConfig = configs.find((c) => c.is_active);

  // ── metrics strip ──────────────────────────────────────────────────────────
  const metrics = [
    renderShellMetric("Tổng cấu hình", loading ? "…" : String(configs.length)),
    renderShellMetric(
      "Đang hoạt động",
      activeConfig ? activeConfig.from_email || "ID " + activeConfig.id : "Chưa có"
    ),
    renderShellMetric(
      "Provider",
      activeConfig ? PROVIDER_LABELS[activeConfig.provider] || activeConfig.provider : "—"
    ),
  ];

  // ── config card helper ─────────────────────────────────────────────────────
  const renderConfigCard = (config) => {
    const hostPort =
      config.provider === "smtp"
        ? (config.smtp_host || "—") + ":" + (config.smtp_port || "587")
        : config.google_delegated_user_email
        ? "Gmail API · " + config.google_delegated_user_email
        : "Gmail API";

    return createElement(
      "div",
      { key: String(config.id), className: "shellPage__listItem" },
      createElement(
        "div",
        { className: "shellPage__listItemHeader" },
        createElement(
          "div",
          null,
          createElement(
            "h3",
            { className: "shellPage__itemTitle" },
            (PROVIDER_LABELS[config.provider] || config.provider) + " — " + (config.from_email || "—")
          ),
          createElement("p", { className: "shellPage__itemMeta" }, hostPort)
        ),
        createElement(
          "div",
          { style: { display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" } },
          config.is_active
            ? createElement("span", { className: "shellPage__pill" }, "✓ Đang hoạt động")
            : createElement(
                "span",
                {
                  className: "shellPage__pill",
                  style: { background: "rgba(16,42,67,0.08)", color: "var(--shell-muted)" },
                },
                "Không hoạt động"
              ),
          createElement(
            "button",
            {
              className: "shellPage__button shellPage__button--secondary",
              style: { padding: "6px 12px", fontSize: "13px" },
              onClick: () => handleOpenEdit(config),
            },
            "Sửa"
          ),
          !config.is_active &&
            createElement(
              "button",
              {
                className: "shellPage__button shellPage__button--primary",
                style: { padding: "6px 12px", fontSize: "13px" },
                onClick: () => handleActivate(config.id),
              },
              "Kích hoạt"
            ),
          !config.is_active &&
            createElement(
              "button",
              {
                className: "shellPage__button shellPage__button--signal",
                style: { padding: "6px 12px", fontSize: "13px" },
                onClick: () => handleDelete(config.id),
              },
              "Xóa"
            )
        )
      )
    );
  };

  // ── config list panel ──────────────────────────────────────────────────────
  const configListContent = loading
    ? createElement("p", { className: "shellPage__empty" }, "Đang tải cấu hình…")
    : configs.length === 0
    ? createElement("div", { className: "shellPage__empty" }, "Chưa có cấu hình mail nào.")
    : createElement("div", { className: "shellPage__list" }, configs.map(renderConfigCard));

  // ── test panel ─────────────────────────────────────────────────────────────
  const testPanelContent = createElement(
    "div",
    { className: "shellPage__form" },
    renderShellField({
      label: "Email nhận test",
      name: "testEmail",
      type: "email",
      value: testEmail,
      onChange: (e) => setTestEmail(e.target.value),
      placeholder: "admin@vninvest.vn",
    }),
    configs.length > 0 &&
      createElement(
        "div",
        { style: { display: "flex", gap: "8px", flexWrap: "wrap" } },
        configs.map((config) =>
          createElement(
            "button",
            {
              key: "test-" + config.id,
              className: "shellPage__button shellPage__button--signal",
              style: { fontSize: "13px" },
              onClick: () => handleTestConnection(config),
              disabled: testLoading || !testEmail,
            },
            testLoading
              ? "Đang thử…"
              : "Test " + (PROVIDER_LABELS[config.provider] || config.provider) + " #" + config.id
          )
        )
      ),
    testMessage &&
      createElement(
        "div",
        {
          className:
            "shellPage__banner " +
            (testMessage.type === "success" ? "shellPage__banner--notice" : "shellPage__banner--error"),
        },
        testMessage.text
      )
  );

  // ── modal overlay ──────────────────────────────────────────────────────────
  const modalOverlay =
    showModal &&
    createElement(
      "div",
      {
        style: {
          position: "fixed",
          inset: 0,
          background: "rgba(10,20,40,0.6)",
          zIndex: 1000,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        },
        onClick: (e) => {
          if (e.target === e.currentTarget) handleCloseModal();
        },
      },
      createElement(
        "div",
        {
          className: "shellPage__panel",
          style: {
            minWidth: "480px",
            maxWidth: "640px",
            width: "100%",
            maxHeight: "90vh",
            overflowY: "auto",
          },
        },
        createElement(
          "div",
          { className: "shellPage__panelHeader" },
          createElement(
            "div",
            null,
            createElement(
              "h2",
              { className: "shellPage__panelTitle" },
              editingConfig ? "Sửa cấu hình #" + editingConfig.id : "Tạo cấu hình mail mới"
            )
          ),
          createElement(
            "button",
            {
              className: "shellPage__button shellPage__button--secondary",
              style: { padding: "6px 12px", fontSize: "16px" },
              onClick: handleCloseModal,
              type: "button",
            },
            "✕"
          )
        ),
        createElement(
          "form",
          { className: "shellPage__form", onSubmit: handleSubmitForm },
          // Provider + From Email
          createElement(
            "div",
            { className: "shellPage__formGrid" },
            renderShellSelectField({
              label: "Provider",
              name: "provider",
              value: formData.provider,
              onChange: (e) => handleFormChange("provider", e.target.value),
              options: [
                { key: "smtp", label: "SMTP" },
                { key: "gmail_api", label: "Gmail API" },
              ],
            }),
            renderShellField({
              label: "From Email *",
              name: "from_email",
              type: "email",
              value: formData.from_email,
              onChange: (e) => handleFormChange("from_email", e.target.value),
              placeholder: "no-reply@example.com",
            })
          ),
          // SMTP-specific fields
          formData.provider === "smtp" &&
            createElement(
              Fragment,
              null,
              createElement(
                "div",
                { className: "shellPage__formGrid" },
                renderShellField({
                  label: "SMTP Host",
                  name: "smtp_host",
                  value: formData.smtp_host,
                  onChange: (e) => handleFormChange("smtp_host", e.target.value),
                  placeholder: "smtp.gmail.com",
                }),
                renderShellField({
                  label: "SMTP Port",
                  name: "smtp_port",
                  type: "number",
                  value: formData.smtp_port,
                  onChange: (e) => handleFormChange("smtp_port", e.target.value),
                  placeholder: "587",
                })
              ),
              createElement(
                "div",
                { className: "shellPage__formGrid" },
                renderShellField({
                  label: "SMTP Username",
                  name: "smtp_username",
                  value: formData.smtp_username,
                  onChange: (e) => handleFormChange("smtp_username", e.target.value),
                }),
                renderShellField({
                  label: editingConfig ? "SMTP Password (để trống = giữ nguyên)" : "SMTP Password",
                  name: "smtp_password",
                  type: "password",
                  value: formData.smtp_password,
                  onChange: (e) => handleFormChange("smtp_password", e.target.value),
                  placeholder: editingConfig ? "(Để trống nếu không đổi)" : "",
                })
              ),
              createElement(
                "div",
                { style: { display: "flex", gap: "24px" } },
                createElement(
                  "label",
                  {
                    style: {
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      cursor: "pointer",
                      fontSize: "14px",
                      fontWeight: "700",
                      color: "var(--shell-muted)",
                    },
                  },
                  createElement("input", {
                    type: "checkbox",
                    checked: formData.smtp_use_tls,
                    onChange: (e) => handleFormChange("smtp_use_tls", e.target.checked),
                  }),
                  "Dùng TLS"
                ),
                createElement(
                  "label",
                  {
                    style: {
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      cursor: "pointer",
                      fontSize: "14px",
                      fontWeight: "700",
                      color: "var(--shell-muted)",
                    },
                  },
                  createElement("input", {
                    type: "checkbox",
                    checked: formData.smtp_use_ssl,
                    onChange: (e) => handleFormChange("smtp_use_ssl", e.target.checked),
                  }),
                  "Dùng SSL"
                )
              )
            ),
          // Gmail API-specific fields
          formData.provider === "gmail_api" &&
            createElement(
              Fragment,
              null,
              createElement(
                "label",
                { className: "shellPage__field" },
                createElement(
                  "span",
                  { className: "shellPage__fieldLabel" },
                  "Credentials JSON (Service Account hoặc OAuth2 Web Client)"
                ),
                createElement("textarea", {
                  className: "shellPage__input",
                  value: formData.google_service_account_json,
                  onChange: (e) => handleFormChange("google_service_account_json", e.target.value),
                  placeholder: editingConfig
                    ? "(Để trống nếu không đổi)"
                    : 'Dán JSON từ Google Cloud Console\n(Service Account JSON hoặc OAuth2 Web Client JSON)',
                  rows: 6,
                  style: { resize: "vertical" },
                }),
                createElement(
                  "span",
                  {
                    style: {
                      fontSize: "12px",
                      color: "var(--shell-muted)",
                      marginTop: "4px",
                      display: "block",
                    },
                  },
                  "Service Account: type=\"service_account\". OAuth2 Web Client: type không có / wrapper \"web\"."
                )
              ),
              renderShellField({
                label: "OAuth2 Refresh Token",
                name: "google_oauth2_refresh_token",
                type: "password",
                value: formData.google_oauth2_refresh_token,
                onChange: (e) => handleFormChange("google_oauth2_refresh_token", e.target.value),
                placeholder: "1//... (OAuth2 Web Client flow — để trống nếu dùng Service Account)",
              }),
              renderShellField({
                label: "Delegated User Email (Service Account DWD)",
                name: "google_delegated_user_email",
                type: "email",
                value: formData.google_delegated_user_email,
                onChange: (e) => handleFormChange("google_delegated_user_email", e.target.value),
                placeholder: "admin@yourdomain.com (chỉ cần với Service Account DWD)",
              })
            ),
          // Form error
          formError &&
            createElement(
              "div",
              { className: "shellPage__banner shellPage__banner--error" },
              formError
            ),
          // Action buttons
          createElement(
            "div",
            { className: "shellPage__actions", style: { justifyContent: "flex-end" } },
            createElement(
              "button",
              {
                type: "button",
                className: "shellPage__button shellPage__button--secondary",
                onClick: handleCloseModal,
                disabled: formLoading,
              },
              "Hủy"
            ),
            createElement(
              "button",
              {
                type: "submit",
                className: "shellPage__button shellPage__button--primary",
                disabled: formLoading,
              },
              formLoading ? "Đang lưu…" : editingConfig ? "Cập nhật" : "Tạo mới"
            )
          )
        )
      )
    );

  // ── page chrome ────────────────────────────────────────────────────────────
  return renderShellPageChrome({
    eyebrow: "Hệ thống · SOC",
    title: "Quản trị Mail Vận Hành",
    description: "Cấu hình email hệ thống dùng để gửi thông báo, cảnh báo và liên lạc vận hành.",
    badge: createElement(
      "button",
      {
        className: "shellPage__button shellPage__button--primary",
        onClick: handleOpenCreate,
        type: "button",
      },
      "+ Tạo mới"
    ),
    metrics,
    error: error || "",
    children: createElement(
      Fragment,
      null,
      createElement(
        "div",
        { className: "shellPage__bodyGrid" },
        renderShellPanel({
          key: "configs",
          title: "Danh sách cấu hình",
          subtitle: "Chọn Kích hoạt để đặt làm provider gửi mail mặc định của hệ thống.",
          children: configListContent,
        }),
        renderShellPanel({
          key: "test",
          title: "Thử Nghiệm Kết Nối",
          subtitle: "Gửi email thử để kiểm tra cấu hình đang hoạt động.",
          children: testPanelContent,
        })
      ),
      modalOverlay
    ),
  });
}
