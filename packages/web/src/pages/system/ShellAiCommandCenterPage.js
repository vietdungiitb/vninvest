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

  return "Không thể tải snapshot điều hành AI từ core runtime.";
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

function renderFlagList(flags, emptyText, keyPrefix) {
  if (flags.length === 0) {
    return renderElement(
      "div",
      { className: "shellPage__empty", key: `${keyPrefix}-empty` },
      emptyText,
    );
  }

  return renderElement(
    "div",
    { className: "shellPage__list", key: `${keyPrefix}-list` },
    flags.map((flag) =>
      renderElement(
        "article",
        { className: "shellPage__listItem", key: `${keyPrefix}:${flag.label}` },
        renderElement(
          "div",
          { className: "shellPage__listItemHeader" },
          renderElement("h3", { className: "shellPage__itemTitle" }, flag.label),
          renderElement("span", { className: "shellPage__pill" }, flag.state),
        ),
        renderElement("p", { className: "shellPage__itemMeta" }, flag.detail),
      ),
    ),
  );
}

function renderAbilityList(abilities) {
  if (abilities.length === 0) {
    return renderElement(
      "div",
      { className: "shellPage__empty", key: "ai-abilities-empty" },
      "Runtime hiện chưa trả về ability AI lane nào cho route này.",
    );
  }

  return renderElement(
    "div",
    { className: "shellPage__list", key: "ai-abilities-list" },
    abilities.map((ability, index) =>
      renderElement(
        "article",
        { className: "shellPage__listItem", key: `ai-ability:${index}:${ability.action}:${ability.subject}` },
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

export function ShellAiCommandCenterPage({
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
      await refreshSnapshot("Đã làm mới snapshot điều hành AI từ core runtime.");
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
  const navigation = capabilities?.navigation || {};
  const surfaces = capabilities?.surfaces || {};
  const visibleGroups = Array.isArray(navigation.visible_groups) ? navigation.visible_groups : [];
  const visibleRoutes = Array.isArray(navigation.visible_routes) ? navigation.visible_routes : [];
  const abilities = Array.isArray(capabilities?.abilities) ? capabilities.abilities : [];
  const aiRoutes = visibleRoutes.filter((routeId) => routeId === "ai-command-center" || routeId === "ai-advisory");
  const aiFlags = [
    {
      label: "show_ai_command_center",
      state: surfaces.show_ai_command_center ? "ON" : "OFF",
      detail: "Flag chính xác nhận runtime đang mở lane điều hành AI cho shell hiện tại.",
    },
    {
      label: "show_admin_ops",
      state: surfaces.show_admin_ops ? "ON" : "OFF",
      detail: "Cho biết operator lane có đồng thời bật để phối hợp với control center AI hay không.",
    },
    {
      label: "show_vip_shell",
      state: surfaces.show_vip_shell ? "ON" : "OFF",
      detail: "Dùng để đối chiếu xem shell AI hiện tại có đang nằm trong build target VIP hay không.",
    },
  ];
  const aiAbilities = abilities.filter(
    (ability) => ability.subject === "all" || String(ability.subject).toLowerCase().includes("ai"),
  );

  const metrics = [
    renderShellMetric("Build target", buildMeta?.target || capabilities?.build?.target || "n/a"),
    renderShellMetric("AI routes", String(aiRoutes.length)),
    renderShellMetric("AI flags ON", String(aiFlags.filter((flag) => flag.state === "ON").length)),
    renderShellMetric("AI abilities", String(aiAbilities.length)),
  ];

  const summaryCards = [
    renderSummaryCard({
      key: "ai-session",
      title: "Operator và session hiện tại",
      rows: [
        { label: "Username", value: identity.username || session?.principal?.username || "Chưa có" },
        { label: "Plan", value: capabilities?.build?.plan || "n/a" },
        { label: "Session ID", value: session?.session_id || "Chưa có" },
      ],
    }),
    renderSummaryCard({
      key: "ai-runtime",
      title: "Core runtime và adapter",
      rows: [
        { label: "Service", value: health?.service || "core-api" },
        { label: "Environment", value: health?.environment || "foundation" },
        { label: "Base URL", value: buildMeta?.baseUrl || "n/a" },
      ],
    }),
  ];

  const groupFlags = visibleGroups.map((groupId) => ({
    label: groupId,
    state: groupId === "system" ? "ACTIVE" : "VISIBLE",
    detail: groupId === "system"
      ? "Đây là group gating chính chứa route AI command center."
      : "Group này vẫn đi cùng session AI hiện tại.",
  }));

  const routeFlags = aiRoutes.map((routeId) => ({
    label: routeId,
    state: "VISIBLE",
    detail: "Route này đang được runtime cho phép xuất hiện trong shell hiện tại.",
  }));

  return renderShellPageChrome({
    eyebrow: "Core AI command center",
    title: "Trung tâm điều hành AI shell",
    description:
      "Trang này xác nhận lane AI của core shell đã có route-level page thật, bám đúng surface flag `show_ai_command_center`, AI routes và operator session mà không cần thêm backend contract mới.",
    badge: renderElement(
      "div",
      { className: "shellPage__heroBadge" },
      renderElement("span", { className: "shellPage__statusDot" }),
      viewState.loading ? "Đang đồng bộ lane AI" : "Lane AI sẵn sàng cho kiểm tra",
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
          title: "Snapshot operator và runtime",
          subtitle: "Đọc nhanh session, build meta và runtime health trước khi nối các control AI thật vào page này.",
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
          title: "AI routes và navigation groups",
          subtitle: "Kiểm tra route `ai-command-center` cùng các route AI liên quan đã được runtime mở đúng theo shell hiện tại hay chưa.",
          children: [
            renderElement(
              "div",
              { key: "ai-groups" },
              renderElement("h3", { className: "shellPage__itemTitle" }, "Visible groups"),
              renderFlagList(groupFlags, "Session hiện chưa mở group điều hướng nào.", "ai-groups"),
            ),
            renderElement(
              "div",
              { key: "ai-routes" },
              renderElement("h3", { className: "shellPage__itemTitle" }, "AI routes"),
              renderFlagList(routeFlags, "Runtime hiện chưa expose route AI nào cho session này.", "ai-routes"),
            ),
          ],
        }),
      ),
      renderShellPanel({
        title: "Surface flags và AI abilities",
        subtitle: "Giữ cùng một viewport cho auditor đọc tình trạng flag AI, route exposure và quyền quản trị liên quan đến AI lane.",
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
          renderFlagList(aiFlags, "Runtime chưa công bố surface flag AI nào.", "ai-flags"),
          renderElement(
            "article",
            { className: "shellPage__surfaceCard", key: "ai-build-meta" },
            renderElement("h3", { className: "shellPage__itemTitle" }, "Build metadata"),
            renderElement("p", { className: "shellPage__itemMeta" }, `Adapter: ${buildMeta?.adapterId || "core"}`),
            renderElement("p", { className: "shellPage__itemMeta" }, `Display name: ${buildMeta?.displayName || "Core API"}`),
            renderElement("p", { className: "shellPage__itemMeta" }, `Base URL: ${buildMeta?.baseUrl || "n/a"}`),
          ),
          renderAbilityList(aiAbilities),
        ],
      }),
    ),
  });
}