import {
  createElement,
  startTransition,
  useEffect,
  useRef,
  useState,
} from "react";

import { loadShellBootstrap } from "../context/bootstrapClient.js";

export function renderElement(type, props, ...children) {
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

function normalizePageErrorMessage(error, fallbackMessage) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallbackMessage;
}

export function useCoreShellPageSnapshot({
  env = {},
  fetchImpl,
  bootstrapLoader,
  adapter = "core",
  autoLoad = true,
  initialSnapshot = null,
  fallbackErrorMessage,
  refreshNotice = "",
}) {
  const envRef = useRef(null);
  const fetchImplRef = useRef(null);
  const bootstrapLoaderRef = useRef(null);
  const fallbackErrorMessageRef = useRef(null);

  envRef.current = env;
  fetchImplRef.current = fetchImpl;
  bootstrapLoaderRef.current = bootstrapLoader || loadShellBootstrap;
  fallbackErrorMessageRef.current = fallbackErrorMessage;

  const [viewState, setViewState] = useState(() => createInitialViewState(initialSnapshot));

  async function refreshSnapshot(notice = "") {
    const snapshot = await bootstrapLoaderRef.current({
      adapter,
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

    return snapshot;
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
          adapter,
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
          error: normalizePageErrorMessage(error, fallbackErrorMessageRef.current),
        }));
      }
    }

    void runInitialLoad();

    return () => {
      active = false;
    };
  }, [adapter, autoLoad]);

  async function handleRefresh() {
    try {
      await refreshSnapshot(refreshNotice);
    } catch (error) {
      setViewState((previous) => ({
        ...previous,
        loading: false,
        error: normalizePageErrorMessage(error, fallbackErrorMessageRef.current),
      }));
    }
  }

  return {
    viewState,
    handleRefresh,
    refreshSnapshot,
  };
}

export function renderSummaryCard({ key, title, rows }) {
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

export function renderBuildMetaCard({ key = "build-meta-card", buildMeta }) {
  return renderElement(
    "article",
    { className: "shellPage__surfaceCard", key },
    renderElement("h3", { className: "shellPage__itemTitle" }, "Build metadata"),
    renderElement("p", { className: "shellPage__itemMeta" }, `Adapter: ${buildMeta?.adapterId || "core"}`),
    renderElement("p", { className: "shellPage__itemMeta" }, `Display name: ${buildMeta?.displayName || "Core API"}`),
    renderElement("p", { className: "shellPage__itemMeta" }, `Base URL: ${buildMeta?.baseUrl || "n/a"}`),
  );
}

export function renderValueList(items, emptyText, keyPrefix) {
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

export function renderFlagList(flags, emptyText, keyPrefix) {
  if (!Array.isArray(flags) || flags.length === 0) {
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

export function renderAbilityList({
  abilities,
  emptyText,
  keyPrefix = "ability",
  getTitle = (ability) => `${ability.action} ${ability.subject}`,
  getPill = (ability) => ability.action,
  getDetail = (ability) => `Subject: ${ability.subject}`,
}) {
  if (!Array.isArray(abilities) || abilities.length === 0) {
    return renderElement(
      "div",
      { className: "shellPage__empty", key: `${keyPrefix}-empty` },
      emptyText,
    );
  }

  return renderElement(
    "div",
    { className: "shellPage__list", key: `${keyPrefix}-list` },
    abilities.map((ability, index) =>
      renderElement(
        "article",
        { className: "shellPage__listItem", key: `${keyPrefix}:${index}:${ability.action}:${ability.subject}` },
        renderElement(
          "div",
          { className: "shellPage__listItemHeader" },
          renderElement("h3", { className: "shellPage__itemTitle" }, getTitle(ability)),
          renderElement("span", { className: "shellPage__pill" }, getPill(ability)),
        ),
        renderElement("p", { className: "shellPage__itemMeta" }, getDetail(ability)),
      ),
    ),
  );
}