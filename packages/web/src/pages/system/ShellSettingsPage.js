import {
  createElement,
  startTransition,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  renderShellMetric,
  renderShellPageChrome,
  renderShellPanel,
} from "../../components/ShellPageTemplate.js";
import { loadShellBootstrap } from "../../context/bootstrapClient.js";

function renderElement(type, props, ...children) {
  return createElement(type, props, ...children);
}

function createEmptySnapshot() {
  return {
    buildMeta: null,
    health: null,
    capabilities: null,
    session: null,
  };
}

function createInitialViewState(initialSnapshot = null) {
  if (!initialSnapshot) {
    return {
      loading: true,
      error: "",
      notice: "",
      ...createEmptySnapshot(),
    };
  }

  return {
    loading: false,
    error: "",
    notice: "",
    ...createEmptySnapshot(),
    ...initialSnapshot,
  };
}

function normalizeErrorMessage(error) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Không thể tải snapshot cấu hình shell từ core runtime.";
}

function renderSummaryCard({ key, title, rows }) {
  return renderElement(
    "article",
    { className: "shellPage__surfaceCard", key },
    renderElement("h3", { className: "shellPage__itemTitle" }, title),
    rows.map((row) =>
      renderElement(
        "p",
        { className: "shellPage__itemMeta", key: `${key}:${row.label}` },
        `${row.label}: ${row.value}`,
      ),
    ),
  );
}

function renderValueList(title, items, emptyText, keyPrefix) {
  if (!Array.isArray(items) || items.length === 0) {
    return renderElement(
      "div",
      { className: "shellPage__empty", key: `${keyPrefix}-empty` },
      emptyText,
    );
  }

  return renderElement(
    "div",
    { className: "shellPage__list", key: `${keyPrefix}-list` },
    items.map((item, index) =>
      renderElement(
        "article",
        { className: "shellPage__listItem", key: `${keyPrefix}:${index}:${String(item)}` },
        renderElement("p", { className: "shellPage__itemMeta" }, item),
      ),
    ),
  );
}

function renderAbilityList(abilities) {
  if (!Array.isArray(abilities) || abilities.length === 0) {
    return renderElement(
      "div",
      { className: "shellPage__empty", key: "abilities-empty" },
      "Runtime hiện chưa trả về ability nào cho shell page này.",
    );
  }

  return renderElement(
    "div",
    { className: "shellPage__list", key: "abilities-list" },
    abilities.map((ability, index) =>
      renderElement(
        "article",
        { className: "shellPage__listItem", key: `ability:${index}:${ability.action}:${ability.subject}` },
        renderElement(
          "div",
          { className: "shellPage__listItemHeader" },
          renderElement("h3", { className: "shellPage__itemTitle" }, `${ability.action} ${ability.subject}`),
          renderElement("span", { className: "shellPage__pill" }, ability.action),
        ),
        renderElement("p", { className: "shellPage__itemMeta" }, `Subject: ${ability.subject}`),
      ),
    ),
  );
}

export function ShellSettingsPage({
  env = {},
  fetchImpl,
  bootstrapLoader = loadShellBootstrap,
  autoLoad = true,
  initialSnapshot = null,
}) {
  const envRef = useRef(null);
  const fetchImplRef = useRef(null);
  const bootstrapLoaderRef = useRef(null);

  envRef.current = env;
  fetchImplRef.current = fetchImpl;
  bootstrapLoaderRef.current = bootstrapLoader;

  const [viewState, setViewState] = useState(() => createInitialViewState(initialSnapshot));

  async function refreshSnapshot(notice = "") {
    const snapshot = await bootstrapLoaderRef.current({
      adapter: "core",
      env: envRef.current,
      fetchImpl: fetchImplRef.current,
    });

    startTransition(() => {
      setViewState((previous) => ({
        ...previous,
        loading: false,
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
        error: "",
      }));

      try {
        const snapshot = await bootstrapLoaderRef.current({
          adapter: "core",
          env: envRef.current,
          fetchImpl: fetchImplRef.current,
        });

        if (!active) {
          return;
        }

        startTransition(() => {
          setViewState((previous) => ({
            ...previous,
            loading: false,
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
          error: normalizeErrorMessage(error),
        }));
      }
    }

    void runInitialLoad();

    return () => {
      active = false;
    };
  }, [autoLoad]);

  async function handleRefresh() {
    try {
      await refreshSnapshot("Đã làm mới snapshot cấu hình shell từ core runtime.");
    } catch (error) {
      setViewState((previous) => ({
        ...previous,
        loading: false,
        error: normalizeErrorMessage(error),
      }));
    }
  }

  const buildMeta = viewState.buildMeta || null;
  const health = viewState.health || null;
  const capabilities = viewState.capabilities || null;
  const session = viewState.session || null;
  const identity = capabilities?.principal?.identity || {};
  const visibleGroups = Array.isArray(capabilities?.navigation?.visible_groups)
    ? capabilities.navigation.visible_groups
    : [];
  const visibleRoutes = Array.isArray(capabilities?.navigation?.visible_routes)
    ? capabilities.navigation.visible_routes
    : [];
  const abilities = Array.isArray(capabilities?.abilities) ? capabilities.abilities : [];
  const enabledSurfaces = Object.entries(capabilities?.surfaces || {})
    .filter(([, enabled]) => Boolean(enabled))
    .map(([surfaceKey]) => surfaceKey);

  const metrics = [
    renderShellMetric("Build target", buildMeta?.target || capabilities?.build?.target || "n/a"),
    renderShellMetric("Gói hiện tại", capabilities?.build?.plan || "n/a"),
    renderShellMetric("Route nhìn thấy", String(visibleRoutes.length)),
    renderShellMetric("Ability active", String(abilities.length)),
  ];

  const summaryCards = [
    renderSummaryCard({
      key: "session",
      title: "Phiên shell hiện tại",
      rows: [
        { label: "Username", value: identity.username || session?.principal?.username || "Chưa có" },
        { label: "Session ID", value: session?.session_id || "Chưa có" },
        { label: "Email", value: identity.email || "Chưa có" },
      ],
    }),
    renderSummaryCard({
      key: "runtime",
      title: "Runtime và adapter",
      rows: [
        { label: "Service", value: health?.service || "core-api" },
        { label: "Environment", value: health?.environment || "foundation" },
        { label: "Base URL", value: buildMeta?.baseUrl || "n/a" },
      ],
    }),
  ];

  return renderShellPageChrome({
    eyebrow: "Core shell settings",
    title: "Thiết lập shell và quyền truy cập",
    description:
      "Trang này xác nhận shell core đang nhận đúng health, build meta, session, navigation và surface flags trước khi các route hệ thống sâu hơn được dựng tiếp.",
    badge: renderElement(
      "div",
      { className: "shellPage__heroBadge" },
      renderElement("span", { className: "shellPage__statusDot" }),
      viewState.loading ? "Đang đồng bộ core runtime" : "Core runtime sẵn sàng cho kiểm tra",
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
          title: "Snapshot runtime hiện tại",
          subtitle: "Đọc nhanh tình trạng phiên, môi trường và adapter đang được shell core sử dụng.",
          actions: renderElement(
            "div",
            { className: "shellPage__actions" },
            renderElement(
              "button",
              {
                type: "button",
                className: "shellPage__button shellPage__button--secondary",
                onClick: handleRefresh,
                disabled: viewState.loading,
              },
              "Làm mới snapshot",
            ),
          ),
          children: renderElement("section", { className: "shellPage__summaryGrid" }, summaryCards),
        }),
        renderShellPanel({
          title: "Nhóm điều hướng và surface flags",
          subtitle: "Cho phép kiểm tra nhanh gating hiện hành của system/workspace/admin trước khi page hệ thống thật được nối vào shell.",
          children: [
            renderElement(
              "div",
              { key: "visible-groups-block" },
              renderElement("h3", { className: "shellPage__itemTitle" }, "Visible groups"),
              renderValueList("Visible groups", visibleGroups, "Chưa có navigation group nào được mở.", "groups"),
            ),
            renderElement(
              "div",
              { key: "visible-routes-block" },
              renderElement("h3", { className: "shellPage__itemTitle" }, "Visible routes"),
              renderValueList("Visible routes", visibleRoutes, "Chưa có route nào được mở.", "routes"),
            ),
            renderElement(
              "div",
              { key: "surfaces-block" },
              renderElement("h3", { className: "shellPage__itemTitle" }, "Enabled surfaces"),
              renderValueList("Enabled surfaces", enabledSurfaces, "Runtime chưa bật surface flag nào.", "surfaces"),
            ),
          ],
        }),
      ),
      renderShellPanel({
        title: "Ability map và build metadata",
        subtitle: "Giữ cùng một viewport cho auditor đọc plan, abilities và metadata mà không cần rời khỏi route settings.",
        actions: renderElement(
          "div",
          { className: "shellPage__actions" },
          renderElement(
            "span",
            { className: "shellPage__pill" },
            `Health: ${health?.ok ? "OK" : "Chưa xác nhận"}`,
          ),
        ),
        children: [
          renderElement(
            "article",
            { className: "shellPage__surfaceCard", key: "build-meta-card" },
            renderElement("h3", { className: "shellPage__itemTitle" }, "Build metadata"),
            renderElement("p", { className: "shellPage__itemMeta" }, `Adapter: ${buildMeta?.adapterId || "core"}`),
            renderElement("p", { className: "shellPage__itemMeta" }, `Display name: ${buildMeta?.displayName || "Core API"}`),
            renderElement("p", { className: "shellPage__itemMeta" }, `Base URL: ${buildMeta?.baseUrl || "n/a"}`),
          ),
          renderAbilityList(abilities),
        ],
      }),
    ),
  });
}