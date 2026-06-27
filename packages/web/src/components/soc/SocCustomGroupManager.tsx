import { createElement, useCallback, useEffect, useState } from "react";
import { useI18n } from "../../context/LangContext.js";
import { defaultCoreApiAdapter } from "../../adapters/coreApiAdapter.js";
import styles from "./soc.module.css";

interface SymbolGroup {
  slug: string;
  name: string;
  description?: string;
  type: string;
  symbol_count?: number;
}

interface SocCustomGroupManagerProps {
  onGroupsChanged?: () => void;
}

export function SocCustomGroupManager({ onGroupsChanged }: SocCustomGroupManagerProps) {
  const { t } = useI18n();

  const [groups, setGroups] = useState<SymbolGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [symbols, setSymbols] = useState("");
  const [creating, setCreating] = useState(false);

  const [editingSlug, setEditingSlug] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editSymbols, setEditSymbols] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  const adapter = defaultCoreApiAdapter as unknown as {
    getSocSymbolGroups: () => Promise<any>;
    createSocSymbolGroup: (p: Record<string, unknown>) => Promise<SymbolGroup>;
    updateSocSymbolGroup: (slug: string, p: Record<string, unknown>) => Promise<SymbolGroup>;
    deleteSocSymbolGroup: (slug: string) => Promise<void>;
  };

  const fetchGroups = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await adapter.getSocSymbolGroups();
      let custom: SymbolGroup[] = [];
      if (Array.isArray(data)) {
        custom = data.filter((g) => g.type === "custom");
      } else if (data && typeof data === "object") {
        const customData = (data as any).custom;
        if (Array.isArray(customData)) {
          custom = customData.map((g) => ({ ...g, type: g.type || "custom" }));
        } else {
          const flatValues = Object.values(data).filter(Array.isArray).flat() as SymbolGroup[];
          custom = flatValues.filter((g) => g.type === "custom");
        }
      }
      setGroups(custom);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("soc.dataops.custom_group_load_failed"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchGroups(); }, []);

  const resetCreate = () => {
    setName(""); setDescription(""); setSymbols(""); setShowForm(false); setError("");
  };

  const handleCreate = async () => {
    if (!name.trim()) { setError(t("soc.dataops.custom_group_name_required")); return; }
    if (!symbols.trim()) { setError(t("soc.dataops.custom_group_symbols_required")); return; }
    setError(""); setSuccess("");
    setCreating(true);
    try {
      await adapter.createSocSymbolGroup({
        name: name.trim(),
        description: description.trim() || undefined,
        symbols: symbols.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean),
      });
      setSuccess(t("soc.dataops.custom_group_created"));
      resetCreate();
      await fetchGroups();
      onGroupsChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("soc.dataops.custom_group_create_failed"));
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (slug: string) => {
    if (!window.confirm(t("soc.dataops.custom_group_delete_confirm"))) return;
    setError(""); setSuccess("");
    try {
      await adapter.deleteSocSymbolGroup(slug);
      setSuccess(t("soc.dataops.custom_group_deleted"));
      if (editingSlug === slug) setEditingSlug(null);
      await fetchGroups();
      onGroupsChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("soc.dataops.custom_group_delete_failed"));
    }
  };

  const startEdit = (g: SymbolGroup) => {
    setEditingSlug(g.slug);
    setEditName(g.name);
    setEditDescription(g.description || "");
    setEditSymbols("");
    setError("");
  };

  const cancelEdit = () => {
    setEditingSlug(null);
    setEditName(""); setEditDescription(""); setEditSymbols("");
  };

  const handleUpdate = async () => {
    if (!editName.trim()) { setError(t("soc.dataops.custom_group_name_required")); return; }
    setError(""); setSuccess("");
    setSavingEdit(true);
    try {
      const payload: Record<string, unknown> = { name: editName.trim() };
      if (editDescription.trim()) payload.description = editDescription.trim();
      if (editSymbols.trim()) {
        payload.symbols = editSymbols.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean);
      }
      await adapter.updateSocSymbolGroup(editingSlug!, payload);
      setSuccess(t("soc.dataops.custom_group_updated"));
      cancelEdit();
      await fetchGroups();
      onGroupsChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("soc.dataops.custom_group_update_failed"));
    } finally {
      setSavingEdit(false);
    }
  };

  const renderGroupList = () =>
    createElement(
      "div",
      { style: { marginBottom: "0.75rem" } },
      createElement("label", { style: { fontSize: "0.7rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: "0.25rem", display: "block" } },
        t("soc.dataops.custom_group_list")),
      loading
        ? createElement("p", { className: styles.emptyState }, t("soc.dataops.loading"))
        : groups.length === 0
          ? createElement("p", { className: styles.emptyState }, t("soc.dataops.custom_group_no_groups"))
          : createElement(
              "div",
              { style: { display: "flex", flexDirection: "column", gap: "0.3rem" } },
              groups.map((g) =>
                editingSlug === g.slug
                  ? renderEditForm(g)
                  : createElement(
                      "div",
                      {
                        key: g.slug,
                        style: {
                          display: "flex", justifyContent: "space-between", alignItems: "center",
                          padding: "0.4rem 0.6rem", borderRadius: "6px",
                          background: "rgba(15, 23, 42, 0.25)", border: "1px solid rgba(45, 212, 191, 0.15)",
                        },
                      },
                      createElement(
                        "div",
                        { style: { flex: 1, minWidth: 0, cursor: "pointer" }, onClick: () => startEdit(g) },
                        createElement("span", { style: { fontWeight: 600, fontSize: "0.75rem", color: "rgba(45, 212, 191, 0.9)" } },
                          `\u2605 ${g.name}`),
                        createElement("span", { style: { fontSize: "0.6rem", color: "var(--text-muted)", marginLeft: "0.35rem" } },
                          `(${g.symbol_count ?? "?"})`),
                        g.description
                          ? createElement("div", { style: { fontSize: "0.62rem", color: "var(--text-muted)", marginTop: "0.1rem" } }, g.description)
                          : null,
                      ),
                      createElement(
                        "div",
                        { style: { display: "flex", gap: "0.25rem" } },
                        createElement(
                          "button",
                          {
                            className: styles.actionBtn,
                            onClick: () => startEdit(g),
                            style: { background: "rgba(45, 212, 191, 0.12)", color: "#5eead4", fontSize: "0.6rem" },
                          },
                          t("soc.dataops.custom_group_edit"),
                        ),
                        createElement(
                          "button",
                          {
                            className: styles.actionBtn,
                            onClick: () => handleDelete(g.slug),
                            style: { background: "rgba(239, 68, 68, 0.12)", color: "#f87171", fontSize: "0.6rem" },
                          },
                          t("soc.dataops.group_manager_delete"),
                        ),
                      ),
                    ),
              ),
            ),
    );

  const renderEditForm = (g: SymbolGroup) =>
    createElement(
      "div",
      {
        key: `edit-${g.slug}`,
        style: {
          padding: "0.75rem", borderRadius: "8px",
          background: "rgba(15, 23, 42, 0.3)", border: "1px solid rgba(45, 212, 191, 0.3)",
        },
      },
      createElement(
        "div",
        { style: { marginBottom: "0.5rem" } },
        createElement("label", { style: { fontSize: "0.65rem", fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: "0.15rem" } },
          t("soc.dataops.group_manager_name_label")),
        createElement("input", {
          type: "text", value: editName, className: styles.searchInput,
          onChange: (e: React.ChangeEvent<HTMLInputElement>) => setEditName(e.target.value),
          style: { width: "100%" },
        }),
      ),
      createElement(
        "div",
        { style: { marginBottom: "0.5rem" } },
        createElement("label", { style: { fontSize: "0.65rem", fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: "0.15rem" } },
          t("soc.dataops.group_manager_desc_label")),
        createElement("input", {
          type: "text", value: editDescription, className: styles.searchInput,
          onChange: (e: React.ChangeEvent<HTMLInputElement>) => setEditDescription(e.target.value),
          style: { width: "100%" },
        }),
      ),
      createElement(
        "div",
        { style: { marginBottom: "0.5rem" } },
        createElement("label", { style: { fontSize: "0.65rem", fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: "0.15rem" } },
          t("soc.dataops.group_manager_symbols_label")),
        createElement("textarea", {
          value: editSymbols, className: styles.searchInput,
          placeholder: t("soc.dataops.custom_group_symbols_placeholder"),
          onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => setEditSymbols(e.target.value),
          style: { minHeight: "60px", resize: "vertical", fontSize: "0.75rem", width: "100%" },
        }),
        createElement("p", { style: { fontSize: "0.55rem", color: "var(--text-muted)", marginTop: "0.1rem" } },
          t("soc.dataops.group_manager_symbols_hint")),
      ),
      createElement(
        "div",
        { style: { display: "flex", gap: "0.4rem" } },
        createElement(
          "button",
          {
            className: styles.runBtn,
            onClick: handleUpdate,
            disabled: savingEdit,
            style: { fontSize: "0.7rem" },
          },
          savingEdit ? t("soc.dataops.group_manager_creating") : t("soc.dataops.group_manager_save_btn"),
        ),
        createElement(
          "button",
          {
            className: styles.actionBtn,
            onClick: cancelEdit,
            style: { fontSize: "0.7rem", background: "rgba(148, 163, 184, 0.12)", color: "#94a3b8" },
          },
          t("soc.actions.cancel"),
        ),
      ),
    );

  const renderCreateForm = () =>
    createElement(
      "div",
      {
        style: {
          padding: "0.75rem", borderRadius: "8px",
          background: "rgba(15, 23, 42, 0.3)", border: "1px solid var(--border-default)",
        },
      },
      createElement(
        "div",
        { style: { marginBottom: "0.5rem" } },
        createElement("label", { style: { fontSize: "0.65rem", fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: "0.15rem" } },
          t("soc.dataops.group_manager_name_label")),
        createElement("input", {
          type: "text", value: name, className: styles.searchInput,
          placeholder: t("soc.dataops.custom_group_name_placeholder"),
          onChange: (e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value),
          style: { width: "100%" },
        }),
      ),
      createElement(
        "div",
        { style: { marginBottom: "0.5rem" } },
        createElement("label", { style: { fontSize: "0.65rem", fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: "0.15rem" } },
          t("soc.dataops.group_manager_desc_label")),
        createElement("input", {
          type: "text", value: description, className: styles.searchInput,
          placeholder: t("soc.dataops.group_manager_desc_placeholder"),
          onChange: (e: React.ChangeEvent<HTMLInputElement>) => setDescription(e.target.value),
          style: { width: "100%" },
        }),
      ),
      createElement(
        "div",
        { style: { marginBottom: "0.5rem" } },
        createElement("label", { style: { fontSize: "0.65rem", fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: "0.15rem" } },
          t("soc.dataops.group_manager_symbols_label")),
        createElement("textarea", {
          value: symbols, className: styles.searchInput,
          placeholder: t("soc.dataops.custom_group_symbols_placeholder"),
          onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => setSymbols(e.target.value),
          style: { minHeight: "60px", resize: "vertical", fontSize: "0.75rem", width: "100%" },
        }),
        createElement("p", { style: { fontSize: "0.55rem", color: "var(--text-muted)", marginTop: "0.1rem" } },
          t("soc.dataops.group_manager_symbols_hint")),
      ),
      createElement(
        "div",
        { style: { display: "flex", gap: "0.4rem" } },
        createElement(
          "button",
          {
            className: styles.runBtn,
            onClick: handleCreate,
            disabled: creating,
            style: { fontSize: "0.7rem" },
          },
          creating ? t("soc.dataops.group_manager_creating") : t("soc.dataops.group_manager_create_btn"),
        ),
        createElement(
          "button",
          {
            className: styles.actionBtn,
            onClick: () => { resetCreate(); },
            style: { fontSize: "0.7rem", background: "rgba(148, 163, 184, 0.12)", color: "#94a3b8" },
          },
          t("soc.actions.cancel"),
        ),
      ),
    );

  return createElement(
    "div",
    { className: styles.sectionCard },
    createElement(
      "div",
      { style: { display: "flex", alignItems: "center", justifyContent: "space-between" } },
      createElement("div", { className: styles.sectionCardTitle }, t("soc.dataops.group_manager_title")),
      !showForm
        ? createElement(
            "button",
            {
              className: styles.runBtn,
              onClick: () => setShowForm(true),
              style: { fontSize: "0.65rem", padding: "0.25rem 0.5rem" },
            },
            "+",
          )
        : null,
    ),
    createElement("p", { style: { fontSize: "0.7rem", color: "var(--text-muted)", margin: "0 0 0.75rem 0" } },
      t("soc.dataops.group_manager_description")),
    error ? createElement("div", { className: styles.inlineError, style: { marginBottom: "0.5rem" } }, error) : null,
    success ? createElement("div", { className: styles.inlineSuccess, style: { marginBottom: "0.5rem" } }, success) : null,
    renderGroupList(),
    showForm ? renderCreateForm() : null,
  );
}
