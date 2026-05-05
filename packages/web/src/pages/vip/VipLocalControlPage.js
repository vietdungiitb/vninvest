import {
  createElement,
  startTransition,
  useEffect,
  useRef,
  useState,
} from "react";

import { createVipAppControlClient } from "../../adapters/vip-app/vipAppAdapter.js";
import {
  renderShellField,
  renderShellMetric,
  renderShellPageChrome,
  renderShellPanel,
  renderShellSelectField,
} from "../../components/ShellPageTemplate.js";
import { loadShellBootstrap } from "../../context/bootstrapClient.js";

const ROLE_OPTIONS = Object.freeze([
  { key: "vip_viewer", label: "Người xem VIP" },
  { key: "vip_operator", label: "Điều phối viên VIP" },
  { key: "vip_admin", label: "Quản trị viên VIP" },
  { key: "vip_superuser", label: "Siêu quản trị VIP" },
]);

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

function renderUserItem(user) {
  const roleKeys = Array.isArray(user.role_keys) ? user.role_keys : [];
  const roleText = roleKeys.length > 0 ? roleKeys.map(getRoleLabel).join(" • ") : "Chưa gán vai trò";

  return renderElement(
    "li",
    { className: "shellPage__listItem", key: `${user.user_id}:${user.username}` },
    renderElement(
      "div",
      { className: "shellPage__listItemHeader" },
      renderElement("h3", { className: "shellPage__itemTitle" }, user.username),
      renderElement("span", { className: "shellPage__pill" }, roleText),
    ),
    renderElement(
      "p",
      { className: "shellPage__itemMeta" },
      `${user.email || "Chưa có email"} · Mã người dùng ${user.user_id}`,
    ),
  );
}

function renderAuditItem(entry) {
  return renderElement(
    "li",
    { className: "shellPage__listItem", key: `${entry.audit_id}:${entry.action}` },
    renderElement(
      "div",
      { className: "shellPage__listItemHeader" },
      renderElement("h3", { className: "shellPage__itemTitle" }, entry.action),
      renderElement("span", { className: "shellPage__pill" }, formatTimestamp(entry.created_at)),
    ),
    renderElement(
      "p",
      { className: "shellPage__itemMeta" },
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
    renderShellMetric("Phiên hiện tại", currentSessionUsername),
    renderShellMetric("Người dùng cục bộ", String(viewState.users.length)),
    renderShellMetric("Bản ghi audit", String(viewState.auditLogs.length)),
    renderShellMetric("Quyền đã nạp", String(abilityCount)),
  ];

  const sessionCards = [
    renderElement(
      "article",
      { className: "shellPage__surfaceCard", key: "session" },
      renderElement("h3", { className: "shellPage__itemTitle" }, "Tóm tắt phiên local"),
      renderElement(
        "p",
        { className: "shellPage__itemMeta" },
        `Tài khoản: ${currentSessionUsername}`,
      ),
      renderElement(
        "p",
        { className: "shellPage__itemMeta" },
        `Mã phiên: ${currentSessionId}`,
      ),
    ),
    renderElement(
      "article",
      { className: "shellPage__surfaceCard", key: "surface" },
      renderElement("h3", { className: "shellPage__itemTitle" }, "Health và route đang mở"),
      renderElement(
        "p",
        { className: "shellPage__itemMeta" },
        `Dịch vụ: ${viewState.health?.service || "vip-app-local-api"}`,
      ),
      renderElement(
        "p",
        { className: "shellPage__itemMeta" },
        `Route nhìn thấy: ${visibleRouteCount}`,
      ),
    ),
  ];

  const userList = viewState.users.length > 0
    ? renderElement("ul", { className: "shellPage__list", key: "user-list" }, viewState.users.map(renderUserItem))
    : renderElement(
        "div",
        { className: "shellPage__empty", key: "user-empty" },
        "Local backend chưa có người dùng nào ngoài seed user.",
      );

  const auditList = viewState.auditLogs.length > 0
    ? renderElement("ol", { className: "shellPage__list", key: "audit-list" }, viewState.auditLogs.map(renderAuditItem))
    : renderElement(
        "div",
        { className: "shellPage__empty", key: "audit-empty" },
        "Nhật ký audit chưa có bản ghi nào để hiển thị.",
      );

  return renderShellPageChrome({
    eyebrow: "VIP local control",
    title: "Trung tâm điều khiển VIP cục bộ",
    description:
      "Bề mặt này neo trực tiếp vào local backend của VIP để đăng nhập thử, rà soát tài khoản con và đọc chuỗi audit gần nhất mà không cần tự ghép URL ngoài adapter seam.",
    badge: renderElement(
      "div",
      { className: "shellPage__heroBadge" },
      renderElement("span", { className: "shellPage__statusDot" }),
      viewState.loading || viewState.working ? "Đang đồng bộ local backend" : "Local backend sẵn sàng cho audit",
    ),
    metrics,
    notice: viewState.notice,
    error: viewState.error,
    children: renderElement(
      "section",
      { className: "shellPage__bodyGrid" },
      renderElement(
        "div",
        { className: "shellPage__stack" },
        renderShellPanel({
          title: "Đăng nhập và phục hồi phiên",
          subtitle: "Dùng seed account mặc định hoặc đăng nhập bằng sub-user đã tạo ngay trong local backend.",
          actions: renderElement(
            "div",
            { className: "shellPage__actions" },
            renderElement(
              "button",
              {
                type: "button",
                className: "shellPage__button shellPage__button--secondary",
                onClick: handleRefresh,
                disabled: viewState.working,
              },
              "Làm mới snapshot",
            ),
          ),
          children: [
            renderElement("section", { className: "shellPage__summaryGrid", key: "session-grid" }, sessionCards),
            renderElement(
              "form",
              { className: "shellPage__form", onSubmit: handleLogin, key: "login-form" },
              renderElement(
                "div",
                { className: "shellPage__formGrid" },
                renderShellField({
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
                renderShellField({
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
                { className: "shellPage__actions" },
                renderElement(
                  "button",
                  {
                    type: "submit",
                    className: "shellPage__button shellPage__button--primary",
                    disabled: viewState.working,
                  },
                  "Đăng nhập local",
                ),
                renderElement(
                  "button",
                  {
                    type: "button",
                    className: "shellPage__button shellPage__button--signal",
                    onClick: handleResetSession,
                    disabled: viewState.working,
                  },
                  "Khôi phục phiên seed",
                ),
                renderElement(
                  "button",
                  {
                    type: "button",
                    className: "shellPage__button shellPage__button--secondary",
                    onClick: handleLogout,
                    disabled: viewState.working,
                  },
                  "Đóng phiên",
                ),
              ),
            ),
          ],
        }),
        renderShellPanel({
          title: "Danh sách người dùng cục bộ",
          subtitle: "Tạo nhanh sub-user để test lane operator/admin trước khi dựng các surface sâu hơn.",
          children: [
            renderElement(
              "form",
              { className: "shellPage__form", onSubmit: handleUserSubmit, key: "user-form" },
              renderElement(
                "div",
                { className: "shellPage__formGrid" },
                renderShellField({
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
                renderShellField({
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
                renderShellSelectField({
                  label: "Vai trò local",
                  name: "vip-user-role",
                  value: userDraft.roleKey,
                  options: ROLE_OPTIONS,
                  onChange: (event) => {
                    const nextValue = event.target.value;
                    setUserDraft((previous) => ({ ...previous, roleKey: nextValue }));
                  },
                }),
                renderShellField({
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
                { className: "shellPage__actions" },
                renderElement(
                  "button",
                  {
                    type: "submit",
                    className: "shellPage__button shellPage__button--primary",
                    disabled: viewState.working,
                  },
                  "Lưu người dùng local",
                ),
              ),
            ),
            userList,
          ],
        }),
      ),
      renderShellPanel({
        title: "Nhật ký audit gần nhất",
        subtitle:
          "Theo dõi nhanh chuỗi đăng nhập, reset phiên và thay đổi RBAC để auditor có thể kiểm tra ngay trên route local control.",
        actions: renderElement(
          "div",
          { className: "shellPage__actions" },
          renderElement(
            "span",
            { className: "shellPage__pill" },
            `Health: ${viewState.health?.ok ? "OK" : "Chưa xác nhận"}`,
          ),
        ),
        children: auditList,
      }),
    ),
  });
}