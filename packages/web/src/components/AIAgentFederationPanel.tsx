import { useState, useEffect, useCallback, createElement, FormEvent, ChangeEvent } from "react";
import styles from "./aiSettings.module.css";
import { coreApiAdapter } from "../adapters/coreApiAdapter.js";
import { useI18n } from "../context/LangContext.js";
import { PROVIDER_MODELS, PROVIDER_OPTIONS } from "../shared/providerModels.js";

const e = createElement;

const AGENT_TYPES = [
  { value: "advisory", label: "AI Advisory" },
  { value: "analyst", label: "Market Analyst" },
  { value: "screener", label: "Stock Screener" },
  { value: "whale", label: "Whale Monitor" },
  { value: "news", label: "News Aggregator" },
  { value: "custom", label: "Custom Agent" },
];

interface AgentRecord {
  id?: number;
  name: string;
  agent_type: string;
  provider: string;
  model: string;
  capabilities: string[];
  system_prompt: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

interface AIAgentFederationPanelProps {
  className?: string;
}

export function AIAgentFederationPanel({ className = "" }: AIAgentFederationPanelProps) {
  const { t } = useI18n();
  const [agents, setAgents] = useState<AgentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState<AgentRecord>({
    name: "",
    agent_type: "advisory",
    provider: "openai",
    model: "gpt-4o-mini",
    capabilities: [],
    system_prompt: "",
    is_active: true,
  });
  const [saving, setSaving] = useState(false);

  const agentClient = coreApiAdapter as unknown as {
    getAIAgents: (p?: Record<string, string>) => Promise<{ results: AgentRecord[] }>;
    createAIAgent: (d: Record<string, unknown>) => Promise<AgentRecord>;
    updateAIAgent: (id: number, d: Record<string, unknown>) => Promise<AgentRecord>;
    deleteAIAgent: (id: number) => Promise<void>;
  };

  const loadAgents = useCallback(() => {
    setLoading(true);
    setError("");
    agentClient.getAIAgents()
      .then((res) => { setAgents(res.results || []); })
      .catch(() => { setError(t("agentFederation.loadError")); })
      .finally(() => { setLoading(false); });
  }, [agentClient, t]);

  useEffect(() => { loadAgents(); }, [loadAgents]);

  const handleSubmit = (ev: FormEvent) => {
    ev.preventDefault();
    setSaving(true);
    setError("");
    const payload = {
      ...formData,
      capabilities: typeof formData.capabilities === "string"
        ? (formData.capabilities as unknown as string).split(",").map((s: string) => s.trim()).filter(Boolean)
        : formData.capabilities,
    };
    const promise = editingId
      ? agentClient.updateAIAgent(editingId, payload)
      : agentClient.createAIAgent(payload);
    promise
      .then(() => {
        setNotice(editingId ? t("agentFederation.updated") : t("agentFederation.created"));
        setShowForm(false);
        setEditingId(null);
        setFormData({ name: "", agent_type: "advisory", provider: "openai", model: "gpt-4o-mini", capabilities: [], system_prompt: "", is_active: true });
        loadAgents();
      })
      .catch(() => { setError(t("agentFederation.saveError")); })
      .finally(() => { setSaving(false); });
  };

  const handleDelete = (id: number) => {
    if (!confirm(t("agentFederation.confirmDelete"))) return;
    agentClient.deleteAIAgent(id)
      .then(() => {
        setNotice(t("agentFederation.deleted"));
        loadAgents();
      })
      .catch(() => { setError(t("agentFederation.deleteError")); });
  };

  const openEdit = (agent: AgentRecord) => {
    setFormData({
      name: agent.name,
      agent_type: agent.agent_type,
      provider: agent.provider,
      model: agent.model,
      capabilities: agent.capabilities,
      system_prompt: agent.system_prompt,
      is_active: agent.is_active,
    });
    setEditingId(agent.id || null);
    setShowForm(true);
  };

  const openCreate = () => {
    setFormData({ name: "", agent_type: "advisory", provider: "openai", model: "gpt-4o-mini", capabilities: [], system_prompt: "", is_active: true });
    setEditingId(null);
    setShowForm(true);
  };

  const handleFieldChange = (field: string) => (ev: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const value = field === "is_active" ? (ev as ChangeEvent<HTMLInputElement>).target.checked : ev.target.value;
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleProviderChange = (ev: ChangeEvent<HTMLSelectElement>) => {
    const provider = ev.target.value;
    const firstModel = PROVIDER_MODELS[provider]?.[0]?.key || "gpt-4o-mini";
    setFormData((prev) => ({ ...prev, provider, model: firstModel }));
  };

  const typeLabel = (type: string) => AGENT_TYPES.find((a) => a.value === type)?.label || type;

  const btnPrimary = `${styles.btn} ${styles.btnPrimary}`;
  const btnGhost = `${styles.btn} ${styles.btnGhost}`;
  const btnDangerSm = `${styles.btn} ${styles.btnSm} ${styles.btnDanger}`;
  const btnGhostSm = `${styles.btn} ${styles.btnSm} ${styles.btnGhost}`;

  return e("div", { className: `${styles.panel} ${className}` },
    notice && e("div", {
      className: `${styles.alert} ${styles.alertSuccess}`,
      style: { cursor: "pointer" },
      onClick: () => setNotice(""),
    }, notice),

    e("div", { className: styles.panelHeader },
      e("div", null,
        e("h2", { className: styles.panelTitle }, t("agentFederation.title")),
        e("p", { className: styles.panelSubtitle }, t("agentFederation.description")),
      ),
      e("button", {
        className: btnPrimary,
        onClick: openCreate,
        disabled: showForm,
      }, t("agentFederation.addAgent")),
    ),

    error && e("div", { className: `${styles.alert} ${styles.alertError}`, role: "alert" }, error),

    showForm && e("form", {
      className: styles.formGrid,
      onSubmit: handleSubmit,
    },
      e("div", { className: styles.field },
        e("label", { className: styles.label }, t("agentFederation.name")),
        e("input", {
          className: styles.input,
          value: formData.name,
          onChange: handleFieldChange("name"),
          placeholder: "VD: Phân tích ngành",
          required: true,
        }),
      ),
      e("div", { className: styles.field },
        e("label", { className: styles.label }, t("agentFederation.type")),
        e("select", {
          className: styles.input,
          value: formData.agent_type,
          onChange: handleFieldChange("agent_type"),
        }, ...AGENT_TYPES.map((tp) =>
          e("option", { key: tp.value, value: tp.value }, tp.label)
        )),
      ),
      e("div", { className: styles.field },
        e("label", { className: styles.label }, t("agentFederation.provider")),
        e("select", {
          className: styles.input,
          value: formData.provider,
          onChange: handleProviderChange,
        }, ...PROVIDER_OPTIONS.map((p) =>
          e("option", { key: p.key, value: p.key }, p.label)
        )),
      ),
      e("div", { className: styles.field },
        e("label", { className: styles.label }, t("agentFederation.model")),
        e("select", {
          className: styles.input,
          value: formData.model,
          onChange: handleFieldChange("model"),
        }, ...(PROVIDER_MODELS[formData.provider] || []).map((m) =>
          e("option", { key: m.key, value: m.key }, m.label)
        )),
      ),
      e("div", { className: styles.field, style: { gridColumn: "1 / -1" } },
        e("label", { className: styles.label }, t("agentFederation.capabilities")),
        e("input", {
          className: styles.input,
          value: Array.isArray(formData.capabilities) ? formData.capabilities.join(", ") : formData.capabilities,
          onChange: handleFieldChange("capabilities"),
          placeholder: "phân_tích_ngành, báo_cáo",
        }),
      ),
      e("div", { className: styles.field, style: { gridColumn: "1 / -1" } },
        e("label", { className: styles.label }, t("agentFederation.systemPrompt")),
        e("textarea", {
          className: styles.textarea,
          value: formData.system_prompt,
          onChange: handleFieldChange("system_prompt"),
          rows: 3,
        }),
      ),
      e("div", { className: styles.field, style: { gridColumn: "1 / -1" } },
        e("label", { className: `${styles.toggleRow}` },
          e("input", {
            type: "checkbox",
            className: styles.checkbox,
            checked: formData.is_active,
            onChange: handleFieldChange("is_active"),
          }),
          " " + t("agentFederation.active"),
        ),
      ),
      e("div", { className: styles.toolbar, style: { gridColumn: "1 / -1" } },
        e("button", {
          type: "submit",
          className: btnPrimary,
          disabled: saving,
        }, saving ? t("agentFederation.loading") : t("agentFederation.save")),
        e("button", {
          type: "button",
          className: btnGhost,
          onClick: () => { setShowForm(false); setEditingId(null); },
          disabled: saving,
        }, t("agentFederation.cancel")),
      ),
    ),

    loading && e("p", { className: styles.loading }, t("agentFederation.loading")),

    !loading && agents.length === 0 && e("p", { className: styles.empty }, t("agentFederation.empty")),

    !loading && agents.length > 0 && e("div", { className: styles.tableWrap },
      e("table", { className: styles.table },
        e("thead", null,
          e("tr", null,
            e("th", { className: styles.th }, t("agentFederation.name")),
            e("th", { className: styles.th }, t("agentFederation.type")),
            e("th", { className: styles.th }, t("agentFederation.provider")),
            e("th", { className: styles.th }, t("agentFederation.model")),
            e("th", { className: styles.th }, t("agentFederation.capabilities")),
            e("th", { className: styles.th }, t("agentFederation.active")),
            e("th", { className: styles.th }, t("agentFederation.actions")),
          ),
        ),
        e("tbody", null, ...agents.map((agent) =>
          e("tr", { key: agent.id, className: styles.tr },
            e("td", { className: styles.td }, agent.name),
            e("td", { className: styles.td }, typeLabel(agent.agent_type)),
            e("td", { className: styles.td }, agent.provider),
            e("td", { className: styles.td }, agent.model),
            e("td", { className: styles.td }, (agent.capabilities || []).join(", ")),
            e("td", { className: styles.td }, agent.is_active ? "Có" : "Không"),
            e("td", { className: styles.td },
              e("button", {
                className: btnGhostSm,
                onClick: () => openEdit(agent),
                style: { marginRight: 8 },
              }, t("agentFederation.edit")),
              e("button", {
                className: btnDangerSm,
                onClick: () => handleDelete(agent.id!),
              }, t("agentFederation.delete")),
            ),
          ),
        )),
      ),
    ),
  );
}
