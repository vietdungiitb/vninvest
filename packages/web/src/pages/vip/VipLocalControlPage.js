import {
  createElement,
  startTransition,
  useEffect,
  useRef,
  useState,
} from "react";

import { createVipAppControlClient } from "../../adapters/vip-app/vipAppAdapter.js";
import { loadShellBootstrap } from "../../context/bootstrapClient.js";

const ROLE_OPTIONS = Object.freeze([
  { key: "vip_viewer", label: "Người xem VIP" },
  { key: "vip_operator", label: "Điều phối viên VIP" },
  { key: "vip_admin", label: "Quản trị viên VIP" },
  { key: "vip_superuser", label: "Siêu quản trị VIP" },
]);

const PAGE_STYLES = `
.vipLocalControlPage {
  --vip-ink: #102a43;
  --vip-muted: #486581;
  --vip-accent: #006d77;
  --vip-accent-soft: rgba(0, 109, 119, 0.12);
  --vip-signal: #ff7f50;
  --vip-signal-soft: rgba(255, 127, 80, 0.12);
  --vip-border: rgba(16, 42, 67, 0.14);
  --vip-surface: rgba(255, 252, 248, 0.88);
  --vip-shadow: 0 22px 48px rgba(16, 42, 67, 0.12);
  background:
    radial-gradient(circle at top right, rgba(255, 179, 71, 0.22), transparent 30%),
    radial-gradient(circle at left center, rgba(0, 109, 119, 0.12), transparent 32%),
    linear-gradient(160deg, #fffaf1 0%, #f4fbfb 52%, #eef7f2 100%);
  color: var(--vip-ink);
  font-family: "Segoe UI", "Arial", sans-serif;
  padding: 28px;
  border-radius: 28px;
  box-shadow: var(--vip-shadow);
}

.vipLocalControlPage__hero {
  display: grid;
  gap: 12px;
  margin-bottom: 22px;
}

.vipLocalControlPage__eyebrow {
  letter-spacing: 0.14em;
  text-transform: uppercase;
  font-size: 12px;
  font-weight: 700;
  color: var(--vip-accent);
}

.vipLocalControlPage__titleRow {
  display: flex;
  gap: 16px;
  align-items: center;
  flex-wrap: wrap;
  justify-content: space-between;
}

.vipLocalControlPage__title {
  margin: 0;
  font-size: 34px;
  line-height: 1.05;
}

.vipLocalControlPage__subtitle {
  margin: 0;
  max-width: 720px;
  color: var(--vip-muted);
  font-size: 15px;
  line-height: 1.65;
}

.vipLocalControlPage__heroBadge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.86);
  border: 1px solid var(--vip-border);
  color: var(--vip-muted);
  font-weight: 600;
}

.vipLocalControlPage__statusDot {
  width: 10px;
  height: 10px;
  border-radius: 999px;
  background: var(--vip-signal);
  box-shadow: 0 0 0 6px rgba(255, 127, 80, 0.16);
}

.vipLocalControlPage__metrics {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
  margin-bottom: 22px;
}

.vipLocalControlPage__metric {
  background: rgba(255, 255, 255, 0.86);
  border: 1px solid var(--vip-border);
  border-radius: 20px;
  padding: 16px 18px;
}

.vipLocalControlPage__metricLabel {
  display: block;
  font-size: 12px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--vip-muted);
  margin-bottom: 10px;
}

.vipLocalControlPage__metricValue {
  font-size: 21px;
  font-weight: 700;
}

.vipLocalControlPage__banner {
  border-radius: 18px;
  padding: 14px 16px;
  margin-bottom: 18px;
  font-size: 14px;
  line-height: 1.5;
}

.vipLocalControlPage__banner--notice {
  background: var(--vip-accent-soft);
  color: var(--vip-accent);
  border: 1px solid rgba(0, 109, 119, 0.18);
}

.vipLocalControlPage__banner--error {
  background: var(--vip-signal-soft);
  color: #8a3b12;
  border: 1px solid rgba(255, 127, 80, 0.22);
}

.vipLocalControlPage__grid {
  display: grid;
  grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr);
  gap: 18px;
}

.vipLocalControlPage__stack {
  display: grid;
  gap: 18px;
}

.vipLocalControlPage__panel {
  background: var(--vip-surface);
  border: 1px solid var(--vip-border);
  border-radius: 24px;
  padding: 20px;
  backdrop-filter: blur(12px);
}

.vipLocalControlPage__panelHeader {
  display: flex;
  gap: 14px;
  align-items: flex-start;
  justify-content: space-between;
  flex-wrap: wrap;
  margin-bottom: 16px;
}

.vipLocalControlPage__panelTitle {
  margin: 0 0 6px;
  font-size: 21px;
}

.vipLocalControlPage__panelSubtitle {
  margin: 0;
  color: var(--vip-muted);
  font-size: 14px;
  line-height: 1.6;
}

.vipLocalControlPage__actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.vipLocalControlPage__button {
  border: 0;
  border-radius: 14px;
  padding: 12px 14px;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease, opacity 0.2s ease;
}

.vipLocalControlPage__button:hover {
  transform: translateY(-1px);
}

.vipLocalControlPage__button:disabled {
  cursor: wait;
  opacity: 0.68;
  transform: none;
}

.vipLocalControlPage__button--primary {
  background: linear-gradient(135deg, #006d77 0%, #0a9396 100%);
  color: #fff;
  box-shadow: 0 14px 28px rgba(0, 109, 119, 0.22);
}

.vipLocalControlPage__button--secondary {
  background: rgba(255, 255, 255, 0.9);
  color: var(--vip-ink);
  border: 1px solid var(--vip-border);
}

.vipLocalControlPage__button--signal {
  background: linear-gradient(135deg, #ff7f50 0%, #ffb347 100%);
  color: #fff;
  box-shadow: 0 14px 28px rgba(255, 127, 80, 0.24);
}

.vipLocalControlPage__form {
  display: grid;
  gap: 14px;
}

.vipLocalControlPage__formGrid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.vipLocalControlPage__field {
  display: grid;
  gap: 8px;
}

.vipLocalControlPage__fieldLabel {
  font-size: 13px;
  font-weight: 700;
  color: var(--vip-muted);
}

.vipLocalControlPage__input,
.vipLocalControlPage__select {
  width: 100%;
  border-radius: 14px;
  border: 1px solid rgba(16, 42, 67, 0.16);
  background: rgba(255, 255, 255, 0.92);
  padding: 12px 14px;
  font-size: 14px;
  color: var(--vip-ink);
  box-sizing: border-box;
}

.vipLocalControlPage__sessionGrid,
.vipLocalControlPage__list {
  display: grid;
  gap: 12px;
}

.vipLocalControlPage__sessionGrid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
  margin-bottom: 18px;
}

.vipLocalControlPage__sessionCard,
.vipLocalControlPage__listItem {
  border-radius: 18px;
  border: 1px solid var(--vip-border);
  background: rgba(255, 255, 255, 0.84);
  padding: 14px 16px;
}

.vipLocalControlPage__listItemHeader {
  display: flex;
  gap: 10px;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  margin-bottom: 8px;
}

.vipLocalControlPage__itemTitle {
  margin: 0;
  font-size: 16px;
}

.vipLocalControlPage__itemMeta,
.vipLocalControlPage__sessionMeta {
  margin: 0;
  color: var(--vip-muted);
  font-size: 13px;
  line-height: 1.6;
}

.vipLocalControlPage__pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border-radius: 999px;
  background: var(--vip-accent-soft);
  color: var(--vip-accent);
  font-size: 12px;
  font-weight: 700;
}

.vipLocalControlPage__empty {
  border-radius: 18px;
  border: 1px dashed rgba(16, 42, 67, 0.18);
  padding: 18px;
  color: var(--vip-muted);
  background: rgba(255, 255, 255, 0.6);
}

@media (max-width: 980px) {
  .vipLocalControlPage {
    padding: 22px;
  }

  .vipLocalControlPage__metrics,
  .vipLocalControlPage__grid,
  .vipLocalControlPage__sessionGrid,
  .vipLocalControlPage__formGrid {
    grid-template-columns: 1fr;
  }
}
`;

function renderElement(type, props, ...children) {
  return createElement(type, props, ...children);
}

function createCredentials(initialCredentials = {}) {
  return {
    username: initialCredentials.username ?? "vip-local-admin",
    password: initialCredentials.password ?? "vip-demo-pass",
  };
}

function createUserDraft(initialUserDraft = {}) {
  return {
    username: initialUserDraft.username ?? "",
    email: initialUserDraft.email ?? "",
    roleKey: initialUserDraft.roleKey ?? "vip_operator",
    password: initialUserDraft.password ?? "",
  };
}

function createEmptySnapshot() {
  return {
    health: null,
    capabilities: null,
    session: null,
    users: [],
    auditLogs: [],
  };
}

function createInitialViewState(initialSnapshot = null) {
  if (!initialSnapshot) {
    return {
      loading: true,
      working: false,
      error: "",
      notice: "",
      ...createEmptySnapshot(),
    };
  }

  return {
    loading: false,
    working: false,
    error: "",
    notice: "",
    ...createEmptySnapshot(),
    ...initialSnapshot,
    users: Array.isArray(initialSnapshot.users) ? initialSnapshot.users : [],
    auditLogs: Array.isArray(initialSnapshot.auditLogs) ? initialSnapshot.auditLogs : [],
  };
}

function normalizeErrorMessage(error) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Không thể hoàn tất thao tác điều khiển VIP cục bộ.";
}

function formatTimestamp(value) {
  if (!value) {
    return "Chưa có mốc thời gian";
  }

  const timestamp = new Date(value);
  if (Number.isNaN(timestamp.getTime())) {
    return String(value);
  }

  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "medium",
  }).format(timestamp);
}

function getRoleLabel(roleKey) {
  const roleEntry = ROLE_OPTIONS.find((candidate) => candidate.key === roleKey);
  return roleEntry ? roleEntry.label : roleKey;
}

async function loadControlSnapshot({ bootstrapLoader, controlClient, env, fetchImpl, auditLimit }) {
  const [bootstrap, usersPayload, auditPayload] = await Promise.all([
    bootstrapLoader({ adapter: "vip-app", env, fetchImpl }),
    controlClient.listUsers(),
    controlClient.listAuditLogs({ limit: auditLimit }),
  ]);

  return {
    health: bootstrap.health || null,
    capabilities: bootstrap.capabilities || null,
    session: bootstrap.session || null,
    users: Array.isArray(usersPayload.users) ? usersPayload.users : [],
    auditLogs: Array.isArray(auditPayload.audit_logs) ? auditPayload.audit_logs : [],
  };
}

function renderMetric(label, value) {
  return renderElement(
    "article",
    { className: "vipLocalControlPage__metric", key: label },
    renderElement("span", { className: "vipLocalControlPage__metricLabel" }, label),
    renderElement("strong", { className: "vipLocalControlPage__metricValue" }, value),
  );
}

function renderField({ label, name, type = "text", value, onChange, placeholder, autoComplete }) {
  return renderElement(
    "label",
    { className: "vipLocalControlPage__field", htmlFor: name, key: name },
    renderElement("span", { className: "vipLocalControlPage__fieldLabel" }, label),
    renderElement("input", {
      id: name,
      name,
      type,
      className: "vipLocalControlPage__input",
      value,
      onChange,
      placeholder,
      autoComplete,
    }),
  );
}

function renderSelectField({ label, name, value, options, onChange }) {
  return renderElement(
    "label",
    { className: "vipLocalControlPage__field", htmlFor: name },
    renderElement("span", { className: "vipLocalControlPage__fieldLabel" }, label),
    renderElement(
      "select",
      {
        id: name,
        name,
        className: "vipLocalControlPage__select",
        value,
        onChange,
      },
      options.map((option) =>
        renderElement(
          "option",
          { key: option.key, value: option.key },
          option.label,
        ),
      ),
    ),
  );
}

function renderUserItem(user) {
  const roleKeys = Array.isArray(user.role_keys) ? user.role_keys : [];
  const roleText = roleKeys.length > 0 ? roleKeys.map(getRoleLabel).join(" • ") : "Chưa gán vai trò";

  return renderElement(
    "li",
    { className: "vipLocalControlPage__listItem", key: `${user.user_id}:${user.username}` },
    renderElement(
      "div",
      { className: "vipLocalControlPage__listItemHeader" },
      renderElement("h3", { className: "vipLocalControlPage__itemTitle" }, user.username),
      renderElement("span", { className: "vipLocalControlPage__pill" }, roleText),
    ),
    renderElement(
      "p",
      { className: "vipLocalControlPage__itemMeta" },
      `${user.email || "Chưa có email"} · Mã người dùng ${user.user_id}`,
    ),
  );
}

function renderAuditItem(entry) {
  return renderElement(
    "li",
    { className: "vipLocalControlPage__listItem", key: `${entry.audit_id}:${entry.action}` },
    renderElement(
      "div",
      { className: "vipLocalControlPage__listItemHeader" },
      renderElement("h3", { className: "vipLocalControlPage__itemTitle" }, entry.action),
      renderElement("span", { className: "vipLocalControlPage__pill" }, formatTimestamp(entry.created_at)),
    ),
    renderElement(
      "p",
      { className: "vipLocalControlPage__itemMeta" },
      `Tác nhân: ${entry.actor_username || "system"}`,
    ),
  );
}

export function VipLocalControlPage({
  env = {},
  fetchImpl,
  controlClient = null,
  bootstrapLoader = loadShellBootstrap,
  auditLimit = 8,
  autoLoad = true,
  initialCredentials = {},
  initialUserDraft = {},
  initialSnapshot = null,
}) {
  const clientRef = useRef(controlClient);
  const envRef = useRef(env);
  const fetchImplRef = useRef(fetchImpl);
  const bootstrapLoaderRef = useRef(bootstrapLoader);

  envRef.current = env;
  fetchImplRef.current = fetchImpl;
  bootstrapLoaderRef.current = bootstrapLoader;

  if (controlClient && clientRef.current !== controlClient) {
    clientRef.current = controlClient;
  }

  if (clientRef.current === null) {
    clientRef.current = createVipAppControlClient({ env, fetchImpl });
  }

  const controlPlaneClient = clientRef.current;
  const [credentials, setCredentials] = useState(() => createCredentials(initialCredentials));
  const [userDraft, setUserDraft] = useState(() => createUserDraft(initialUserDraft));
  const [viewState, setViewState] = useState(() => createInitialViewState(initialSnapshot));

  async function refreshSnapshot(notice = "") {
    const snapshot = await loadControlSnapshot({
      bootstrapLoader: bootstrapLoaderRef.current,
      controlClient: controlPlaneClient,
      env: envRef.current,
      fetchImpl: fetchImplRef.current,
      auditLimit,
    });

    startTransition(() => {
      setViewState((previous) => ({
        ...previous,
        loading: false,
        working: false,
        error: "",
        notice: notice || previous.notice,
        ...snapshot,
      }));
    });
  }

  useEffect(() => {
    if (!autoLoad) {
      return undefined;
    }

    let active = true;

    async function runInitialLoad() {
      setViewState((previous) => ({
        ...previous,
        loading: true,
        working: true,
        error: "",
      }));

      try {
        const snapshot = await loadControlSnapshot({
          bootstrapLoader: bootstrapLoaderRef.current,
          controlClient: controlPlaneClient,
          env: envRef.current,
          fetchImpl: fetchImplRef.current,
          auditLimit,
        });

        if (!active) {
          return;
        }

        startTransition(() => {
          setViewState((previous) => ({
            ...previous,
            loading: false,
            working: false,
            error: "",
            ...snapshot,
          }));
        });
      } catch (error) {
        if (!active) {
          return;
        }

        setViewState((previous) => ({
          ...previous,
          loading: false,
          working: false,
          error: normalizeErrorMessage(error),
        }));
      }
    }

    void runInitialLoad();

    return () => {
      active = false;
    };
  }, [auditLimit, autoLoad, controlPlaneClient]);

  async function runAction(action, noticeBuilder) {
    setViewState((previous) => ({
      ...previous,
      working: true,
      error: "",
    }));

    try {
      const payload = await action();
      const notice = typeof noticeBuilder === "function" ? noticeBuilder(payload) : noticeBuilder;
      await refreshSnapshot(notice);
      return payload;
    } catch (error) {
      setViewState((previous) => ({
        ...previous,
        working: false,
        error: normalizeErrorMessage(error),
      }));
      return null;
    }
  }

  async function handleLogin(event) {
    event.preventDefault();

    const username = credentials.username.trim();
    if (!username || !credentials.password) {
      setViewState((previous) => ({
        ...previous,
        error: "Vui lòng nhập tên đăng nhập và mật khẩu trước khi vào phiên cục bộ.",
      }));
      return;
    }

    await runAction(
      () => controlPlaneClient.login({ username, password: credentials.password }),
      (payload) => `Đã đăng nhập bằng tài khoản ${payload.session.principal.username}.`,
    );
  }

  async function handleLogout() {
    await runAction(
      () => controlPlaneClient.logout(),
      "Đã đóng phiên cục bộ và trả shell về trạng thái chờ.",
    );
  }

  async function handleResetSession() {
    await runAction(
      () => controlPlaneClient.resetSession(),
      (payload) => `Đã khôi phục phiên mặc định cho ${payload.session.principal.username}.`,
    );
  }

  async function handleRefresh() {
    await runAction(
      async () => ({ ok: true }),
      "Đã làm mới snapshot đăng nhập, danh sách người dùng và nhật ký audit.",
    );
  }

  async function handleUserSubmit(event) {
    event.preventDefault();

    const username = userDraft.username.trim();
    if (!username) {
      setViewState((previous) => ({
        ...previous,
        error: "Tên đăng nhập cho người dùng VIP không được để trống.",
      }));
      return;
    }

    const nextPayload = {
      username,
      email: userDraft.email.trim() || `${username}@vninvest.local`,
      role_keys: [userDraft.roleKey],
    };

    if (userDraft.password) {
      nextPayload.password = userDraft.password;
    }

    const result = await runAction(
      () => controlPlaneClient.upsertUser(nextPayload),
      (payload) =>
        payload.created
          ? `Đã tạo người dùng ${payload.user.username} trong local backend.`
          : `Đã cập nhật người dùng ${payload.user.username}.`,
    );

    if (result) {
      setUserDraft(createUserDraft(initialUserDraft));
    }
  }

  const currentSessionUsername = viewState.session?.principal?.username || "Chưa đăng nhập";
  const currentSessionId = viewState.session?.session_id || "Không có phiên";
  const abilityCount = Array.isArray(viewState.capabilities?.abilities)
    ? viewState.capabilities.abilities.length
    : 0;
  const visibleRouteCount = Array.isArray(viewState.capabilities?.navigation?.visible_routes)
    ? viewState.capabilities.navigation.visible_routes.length
    : 0;

  const metrics = [
    renderMetric("Phiên hiện tại", currentSessionUsername),
    renderMetric("Người dùng cục bộ", String(viewState.users.length)),
    renderMetric("Bản ghi audit", String(viewState.auditLogs.length)),
    renderMetric("Quyền đã nạp", String(abilityCount)),
  ];

  const sessionCards = [
    renderElement(
      "article",
      { className: "vipLocalControlPage__sessionCard", key: "session" },
      renderElement("h3", { className: "vipLocalControlPage__itemTitle" }, "Tóm tắt phiên local"),
      renderElement(
        "p",
        { className: "vipLocalControlPage__sessionMeta" },
        `Tài khoản: ${currentSessionUsername}`,
      ),
      renderElement(
        "p",
        { className: "vipLocalControlPage__sessionMeta" },
        `Mã phiên: ${currentSessionId}`,
      ),
    ),
    renderElement(
      "article",
      { className: "vipLocalControlPage__sessionCard", key: "surface" },
      renderElement("h3", { className: "vipLocalControlPage__itemTitle" }, "Health và route đang mở"),
      renderElement(
        "p",
        { className: "vipLocalControlPage__sessionMeta" },
        `Dịch vụ: ${viewState.health?.service || "vip-app-local-api"}`,
      ),
      renderElement(
        "p",
        { className: "vipLocalControlPage__sessionMeta" },
        `Route nhìn thấy: ${visibleRouteCount}`,
      ),
    ),
  ];

  const userList = viewState.users.length > 0
    ? renderElement("ul", { className: "vipLocalControlPage__list" }, viewState.users.map(renderUserItem))
    : renderElement(
        "div",
        { className: "vipLocalControlPage__empty" },
        "Local backend chưa có người dùng nào ngoài seed user.",
      );

  const auditList = viewState.auditLogs.length > 0
    ? renderElement("ol", { className: "vipLocalControlPage__list" }, viewState.auditLogs.map(renderAuditItem))
    : renderElement(
        "div",
        { className: "vipLocalControlPage__empty" },
        "Nhật ký audit chưa có bản ghi nào để hiển thị.",
      );

  return renderElement(
    "main",
    { className: "vipLocalControlPage" },
    renderElement("style", null, PAGE_STYLES),
    renderElement(
      "header",
      { className: "vipLocalControlPage__hero" },
      renderElement("span", { className: "vipLocalControlPage__eyebrow" }, "VIP local control"),
      renderElement(
        "div",
        { className: "vipLocalControlPage__titleRow" },
        renderElement(
          "div",
          null,
          renderElement("h1", { className: "vipLocalControlPage__title" }, "Trung tâm điều khiển VIP cục bộ"),
          renderElement(
            "p",
            { className: "vipLocalControlPage__subtitle" },
            "Bề mặt này neo trực tiếp vào local backend của VIP để đăng nhập thử, rà soát tài khoản con và đọc chuỗi audit gần nhất mà không cần tự ghép URL ngoài adapter seam.",
          ),
        ),
        renderElement(
          "div",
          { className: "vipLocalControlPage__heroBadge" },
          renderElement("span", { className: "vipLocalControlPage__statusDot" }),
          viewState.loading || viewState.working ? "Đang đồng bộ local backend" : "Local backend sẵn sàng cho audit",
        ),
      ),
    ),
    renderElement("section", { className: "vipLocalControlPage__metrics" }, metrics),
    viewState.notice
      ? renderElement(
          "div",
          {
            className: "vipLocalControlPage__banner vipLocalControlPage__banner--notice",
            role: "status",
            "aria-live": "polite",
          },
          viewState.notice,
        )
      : null,
    viewState.error
      ? renderElement(
          "div",
          {
            className: "vipLocalControlPage__banner vipLocalControlPage__banner--error",
            role: "alert",
          },
          viewState.error,
        )
      : null,
    renderElement(
      "section",
      { className: "vipLocalControlPage__grid" },
      renderElement(
        "div",
        { className: "vipLocalControlPage__stack" },
        renderElement(
          "article",
          { className: "vipLocalControlPage__panel" },
          renderElement(
            "div",
            { className: "vipLocalControlPage__panelHeader" },
            renderElement(
              "div",
              null,
              renderElement("h2", { className: "vipLocalControlPage__panelTitle" }, "Đăng nhập và phục hồi phiên"),
              renderElement(
                "p",
                { className: "vipLocalControlPage__panelSubtitle" },
                "Dùng seed account mặc định hoặc đăng nhập bằng sub-user đã tạo ngay trong local backend.",
              ),
            ),
            renderElement(
              "div",
              { className: "vipLocalControlPage__actions" },
              renderElement(
                "button",
                {
                  type: "button",
                  className: "vipLocalControlPage__button vipLocalControlPage__button--secondary",
                  onClick: handleRefresh,
                  disabled: viewState.working,
                },
                "Làm mới snapshot",
              ),
            ),
          ),
          renderElement("section", { className: "vipLocalControlPage__sessionGrid" }, sessionCards),
          renderElement(
            "form",
            { className: "vipLocalControlPage__form", onSubmit: handleLogin },
            renderElement(
              "div",
              { className: "vipLocalControlPage__formGrid" },
              renderField({
                label: "Tên đăng nhập local",
                name: "vip-local-username",
                value: credentials.username,
                placeholder: "vip-local-admin",
                autoComplete: "username",
                onChange: (event) => {
                  const nextValue = event.target.value;
                  setCredentials((previous) => ({ ...previous, username: nextValue }));
                },
              }),
              renderField({
                label: "Mật khẩu local",
                name: "vip-local-password",
                type: "password",
                value: credentials.password,
                placeholder: "vip-demo-pass",
                autoComplete: "current-password",
                onChange: (event) => {
                  const nextValue = event.target.value;
                  setCredentials((previous) => ({ ...previous, password: nextValue }));
                },
              }),
            ),
            renderElement(
              "div",
              { className: "vipLocalControlPage__actions" },
              renderElement(
                "button",
                {
                  type: "submit",
                  className: "vipLocalControlPage__button vipLocalControlPage__button--primary",
                  disabled: viewState.working,
                },
                "Đăng nhập local",
              ),
              renderElement(
                "button",
                {
                  type: "button",
                  className: "vipLocalControlPage__button vipLocalControlPage__button--signal",
                  onClick: handleResetSession,
                  disabled: viewState.working,
                },
                "Khôi phục phiên seed",
              ),
              renderElement(
                "button",
                {
                  type: "button",
                  className: "vipLocalControlPage__button vipLocalControlPage__button--secondary",
                  onClick: handleLogout,
                  disabled: viewState.working,
                },
                "Đóng phiên",
              ),
            ),
          ),
        ),
        renderElement(
          "article",
          { className: "vipLocalControlPage__panel" },
          renderElement(
            "div",
            { className: "vipLocalControlPage__panelHeader" },
            renderElement(
              "div",
              null,
              renderElement("h2", { className: "vipLocalControlPage__panelTitle" }, "Danh sách người dùng cục bộ"),
              renderElement(
                "p",
                { className: "vipLocalControlPage__panelSubtitle" },
                "Tạo nhanh sub-user để test lane operator/admin trước khi dựng các surface sâu hơn.",
              ),
            ),
          ),
          renderElement(
            "form",
            { className: "vipLocalControlPage__form", onSubmit: handleUserSubmit },
            renderElement(
              "div",
              { className: "vipLocalControlPage__formGrid" },
              renderField({
                label: "Tên đăng nhập mới",
                name: "vip-user-username",
                value: userDraft.username,
                placeholder: "vip-operator",
                autoComplete: "off",
                onChange: (event) => {
                  const nextValue = event.target.value;
                  setUserDraft((previous) => ({ ...previous, username: nextValue }));
                },
              }),
              renderField({
                label: "Email hiển thị",
                name: "vip-user-email",
                type: "email",
                value: userDraft.email,
                placeholder: "vip-operator@vninvest.local",
                autoComplete: "off",
                onChange: (event) => {
                  const nextValue = event.target.value;
                  setUserDraft((previous) => ({ ...previous, email: nextValue }));
                },
              }),
              renderSelectField({
                label: "Vai trò local",
                name: "vip-user-role",
                value: userDraft.roleKey,
                options: ROLE_OPTIONS,
                onChange: (event) => {
                  const nextValue = event.target.value;
                  setUserDraft((previous) => ({ ...previous, roleKey: nextValue }));
                },
              }),
              renderField({
                label: "Mật khẩu mới (tuỳ chọn)",
                name: "vip-user-password",
                type: "password",
                value: userDraft.password,
                placeholder: "Để trống để dùng mật khẩu seed",
                autoComplete: "new-password",
                onChange: (event) => {
                  const nextValue = event.target.value;
                  setUserDraft((previous) => ({ ...previous, password: nextValue }));
                },
              }),
            ),
            renderElement(
              "div",
              { className: "vipLocalControlPage__actions" },
              renderElement(
                "button",
                {
                  type: "submit",
                  className: "vipLocalControlPage__button vipLocalControlPage__button--primary",
                  disabled: viewState.working,
                },
                "Lưu người dùng local",
              ),
            ),
          ),
          userList,
        ),
      ),
      renderElement(
        "article",
        { className: "vipLocalControlPage__panel" },
        renderElement(
          "div",
          { className: "vipLocalControlPage__panelHeader" },
          renderElement(
            "div",
            null,
            renderElement("h2", { className: "vipLocalControlPage__panelTitle" }, "Nhật ký audit gần nhất"),
            renderElement(
              "p",
              { className: "vipLocalControlPage__panelSubtitle" },
              "Theo dõi nhanh chuỗi đăng nhập, reset phiên và thay đổi RBAC để auditor có thể kiểm tra ngay trên route local control.",
            ),
          ),
          renderElement(
            "div",
            { className: "vipLocalControlPage__actions" },
            renderElement(
              "span",
              { className: "vipLocalControlPage__pill" },
              `Health: ${viewState.health?.ok ? "OK" : "Chưa xác nhận"}`,
            ),
          ),
        ),
        auditList,
      ),
    ),
  );
}