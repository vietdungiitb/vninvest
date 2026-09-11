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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
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
      { },
      createElement("label", { },
        t("soc.dataops.custom_group_list")),
      loading
        ? createElement("p", { className: styles.emptyState }, t("soc.dataops.loading"))
        : groups.length === 0
          ? createElement("p", { className: styles.emptyState }, t("soc.dataops.custom_group_no_groups"))
          : createElement(
              "div",
              { },
              groups.map((g) =>
                editingSlug === g.slug
                  ? renderEditForm(g)
                  : createElement(
                      "div",
                      {
                        key: g.slug,
                        },
                      createElement(
                        "div",
                        { onClick: () => startEdit(g) },
                        createElement("span", { },
                          `\u2605 ${g.name}`),
                        createElement("span", { },
                          `(${g.symbol_count ?? "?"})`),
                        g.description
                          ? createElement("div", { }, g.description)
                          : null,
                      ),
                      createElement(
                        "div",
                        { },
                        createElement(
                          "button",
                          {
                            className: styles.actionBtn,
                            onClick: () => startEdit(g),
                            
                          },
                          t("soc.dataops.custom_group_edit"),
                        ),
                        createElement(
                          "button",
                          {
                            className: styles.actionBtn,
                            onClick: () => handleDelete(g.slug),
                            
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
        },
      createElement(
        "div",
        { },
        createElement("label", { },
          t("soc.dataops.group_manager_name_label")),
        createElement("input", {
          type: "text", value: editName, className: styles.searchInput,
          onChange: (e: React.ChangeEvent<HTMLInputElement>) => setEditName(e.target.value),
          
        }),
      ),
      createElement(
        "div",
        { },
        createElement("label", { },
          t("soc.dataops.group_manager_desc_label")),
        createElement("input", {
          type: "text", value: editDescription, className: styles.searchInput,
          onChange: (e: React.ChangeEvent<HTMLInputElement>) => setEditDescription(e.target.value),
          
        }),
      ),
      createElement(
        "div",
        { },
        createElement("label", { },
          t("soc.dataops.group_manager_symbols_label")),
        createElement("textarea", {
          value: editSymbols, className: styles.searchInput,
          placeholder: t("soc.dataops.custom_group_symbols_placeholder"),
          onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => setEditSymbols(e.target.value),
          
        }),
        createElement("p", { },
          t("soc.dataops.group_manager_symbols_hint")),
      ),
      createElement(
        "div",
        { },
        createElement(
          "button",
          {
            className: styles.runBtn,
            onClick: handleUpdate,
            disabled: savingEdit,
            
          },
          savingEdit ? t("soc.dataops.group_manager_creating") : t("soc.dataops.group_manager_save_btn"),
        ),
        createElement(
          "button",
          {
            className: styles.actionBtn,
            onClick: cancelEdit,
            
          },
          t("soc.actions.cancel"),
        ),
      ),
    );

  const renderCreateForm = () =>
    createElement(
      "div",
      {
        },
      createElement(
        "div",
        { },
        createElement("label", { },
          t("soc.dataops.group_manager_name_label")),
        createElement("input", {
          type: "text", value: name, className: styles.searchInput,
          placeholder: t("soc.dataops.custom_group_name_placeholder"),
          onChange: (e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value),
          
        }),
      ),
      createElement(
        "div",
        { },
        createElement("label", { },
          t("soc.dataops.group_manager_desc_label")),
        createElement("input", {
          type: "text", value: description, className: styles.searchInput,
          placeholder: t("soc.dataops.group_manager_desc_placeholder"),
          onChange: (e: React.ChangeEvent<HTMLInputElement>) => setDescription(e.target.value),
          
        }),
      ),
      createElement(
        "div",
        { },
        createElement("label", { },
          t("soc.dataops.group_manager_symbols_label")),
        createElement("textarea", {
          value: symbols, className: styles.searchInput,
          placeholder: t("soc.dataops.custom_group_symbols_placeholder"),
          onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => setSymbols(e.target.value),
          
        }),
        createElement("p", { },
          t("soc.dataops.group_manager_symbols_hint")),
      ),
      createElement(
        "div",
        { },
        createElement(
          "button",
          {
            className: styles.runBtn,
            onClick: handleCreate,
            disabled: creating,
            
          },
          creating ? t("soc.dataops.group_manager_creating") : t("soc.dataops.group_manager_create_btn"),
        ),
        createElement(
          "button",
          {
            className: styles.actionBtn,
            onClick: () => { resetCreate(); },
            
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
      { },
      createElement("div", { className: styles.sectionCardTitle }, t("soc.dataops.group_manager_title")),
      !showForm
        ? createElement(
            "button",
            {
              className: styles.runBtn,
              onClick: () => setShowForm(true),
              
            },
            "+",
          )
        : null,
    ),
    createElement("p", { },
      t("soc.dataops.group_manager_description")),
    error ? createElement("div", { className: styles.inlineError,  }, error) : null,
    success ? createElement("div", { className: styles.inlineSuccess,  }, success) : null,
    renderGroupList(),
    showForm ? renderCreateForm() : null,
  );
}
