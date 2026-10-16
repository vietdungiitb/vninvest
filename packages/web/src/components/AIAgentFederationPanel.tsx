import { useState, useEffect, useCallback, useRef, createElement, FormEvent, ChangeEvent } from "react";
import styles from "./aiSettings.module.css";
import { coreApiAdapter } from "../adapters/coreApiAdapter.js";
import { useI18n } from "../context/LangContext.js";
import { useConfirm } from "./ConfirmModal.js";
import { PROVIDER_MODELS, PROVIDER_OPTIONS } from "../shared/providerModels.js";
import { parseCapabilities } from "../lib/capabilities.js";

const e = createElement;

/** R1.11 AC4: default form lấy từ PROVIDER_MODELS (không hardcode openai). */
function defaultAgentForm(): AgentRecord {
  const provider = PROVIDER_OPTIONS[0]?.key ?? "openclaw";
  const model = (PROVIDER_MODELS[provider] || [])[0]?.key ?? "";
  return {
    name: "",
    agent_type: "advisory",
    provider,
    model,
    capabilities: [],
    system_prompt: "",
    is_active: true,
  };
}

const AGENT_TYPES = [
  { value: "advisory", label: "AI Advisory", labelKey: "aiAgentFederation.typeAdvisory" },
  { value: "analyst", label: "Market Analyst", labelKey: "aiAgentFederation.typeAnalyst" },
  { value: "screener", label: "Stock Screener", labelKey: "aiAgentFederation.typeScreener" },
  { value: "whale", label: "Whale Monitor", labelKey: "aiAgentFederation.typeWhale" },
  { value: "news", label: "News Aggregator", labelKey: "aiAgentFederation.typeNews" },
  { value: "custom", label: "Custom Agent", labelKey: "aiAgentFederation.typeCustom" },
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
  const confirm = useConfirm();
  const [agents, setAgents] = useState<AgentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState<AgentRecord>(defaultAgentForm);
  const [saving, setSaving] = useState(false);
  // R1.11 AC2: notice tự tắt sau 4s + nút đóng (timer có cleanup).
  const noticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
  }, []);
  const flashNotice = useCallback((message: string) => {
    setNotice(message);
    if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
    noticeTimerRef.current = setTimeout(() => setNotice(""), 4000);
  }, []);

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
      .catch(() => { setError(t("aiAgentFederation.errorLoad")); })
      .finally(() => { setLoading(false); });
  }, [agentClient, t]);

  useEffect(() => { loadAgents(); }, [loadAgents]);

  const handleSubmit = (ev: FormEvent) => {
    ev.preventDefault();
    setSaving(true);
    setError("");
    const payload = {
      ...formData,
      // R1.11 AC3: parse qua util có test (không split inline nữa).
      capabilities: parseCapabilities(formData.capabilities),
    };
    const promise = editingId
      ? agentClient.updateAIAgent(editingId, payload)
      : agentClient.createAIAgent(payload);
    promise
      .then(() => {
        flashNotice(editingId ? t("aiAgentFederation.updated") : t("aiAgentFederation.created"));
        setShowForm(false);
        setEditingId(null);
        setFormData(defaultAgentForm());
        loadAgents();
      })
      .catch(() => { setError(t("aiAgentFederation.errorSave")); })
      .finally(() => { setSaving(false); });
  };

  const handleDelete = async (id: number) => {
    const ok = await confirm({
      title: t("common.delete"),
      message: t("aiAgentFederation.deleteConfirm"),
      variant: "destructive",
    });
    if (!ok) return;
    agentClient.deleteAIAgent(id)
      .then(() => {
        flashNotice(t("aiAgentFederation.deleted"));
        loadAgents();
      })
      .catch(() => { setError(t("aiAgentFederation.errorDelete")); });
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
    setFormData(defaultAgentForm());
    setEditingId(null);
    setShowForm(true);
  };

  const handleFieldChange = (field: string) => (ev: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const value = field === "is_active" ? (ev as ChangeEvent<HTMLInputElement>).target.checked : ev.target.value;
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleProviderChange = (ev: ChangeEvent<HTMLSelectElement>) => {
    const provider = ev.target.value;
    const models = PROVIDER_MODELS[provider] || [];
    // R1.11 AC5: provider chỉ có "custom" (hoặc rỗng) ⇒ GIỮ model cũ,
    // không tự điền "custom" làm model (form này không có ô nhập custom).
    const firstReal = models.find((m) => m.key !== "custom")?.key;
    setFormData((prev) => ({ ...prev, provider, model: firstReal ?? prev.model }));
  };

  const typeLabel = (type: string) => { const a = AGENT_TYPES.find((x) => x.value === type); return a ? t(a.labelKey ?? a.label) : type; };

  const btnPrimary = `${styles.btn} ${styles.btnPrimary}`;
  const btnGhost = `${styles.btn} ${styles.btnGhost}`;
  const btnDangerSm = `${styles.btn} ${styles.btnSm} ${styles.btnDanger}`;
  const btnGhostSm = `${styles.btn} ${styles.btnSm} ${styles.btnGhost}`;

  return e("div", { className: `${styles.panel} ${className}` },
    // R1.11 AC2: role=status + tự tắt 4s + nút đóng (không chỉ click vào notice).
    notice && e("div", {
      className: `${styles.alert} ${styles.alertSuccess}`,
      role: "status",
    }, [
      e("span", { key: "msg" }, notice),
      e("button", {
        key: "close",
        type: "button",
        className: `${styles.btn} ${styles.btnGhost} ${styles.btnSm}`,
        onClick: () => setNotice(""),
        "aria-label": t("aiAgentFederation.dismissNotice"),
      }, "✕"),
    ]),

    e("div", { className: styles.panelHeader },
      e("div", null,
        e("h2", { className: styles.panelTitle }, t("aiAgentFederation.title")),
        e("p", { className: styles.panelSubtitle }, t("aiAgentFederation.description")),
      ),
      e("button", {
        className: btnPrimary,
        onClick: openCreate,
        disabled: showForm,
      }, t("aiAgentFederation.addAgent")),
    ),

    error && e("div", { className: `${styles.alert} ${styles.alertError}`, role: "alert" }, error),

    showForm && e("form", {
      className: styles.formGrid,
      onSubmit: handleSubmit,
    },
      e("div", { className: styles.field },
        e("label", { className: styles.label }, t("aiAgentFederation.name")),
        e("input", {
          className: styles.input,
          value: formData.name,
          onChange: handleFieldChange("name"),
          placeholder: t("aiAgentFederation.placeholderName"),
          required: true,
        }),
      ),
      e("div", { className: styles.field },
        e("label", { className: styles.label }, t("aiAgentFederation.agentType")),
        e("select", {
          className: styles.input,
          value: formData.agent_type,
          onChange: handleFieldChange("agent_type"),
        }, ...AGENT_TYPES.map((tp) =>
          e("option", { key: tp.value, value: tp.value }, t(tp.labelKey ?? tp.label))
        )),
      ),
      e("div", { className: styles.field },
        e("label", { className: styles.label }, t("aiAgentFederation.provider")),
        e("select", {
          className: styles.input,
          value: formData.provider,
          onChange: handleProviderChange,
        }, ...PROVIDER_OPTIONS.map((p) =>
          e("option", { key: p.key, value: p.key }, t(p.labelKey ?? p.label))
        )),
      ),
      e("div", { className: styles.field },
        e("label", { className: styles.label }, t("aiAgentFederation.model")),
        e("select", {
          className: styles.input,
          value: formData.model,
          onChange: handleFieldChange("model"),
        }, ...(PROVIDER_MODELS[formData.provider] || []).map((m) =>
          e("option", { key: m.key, value: m.key }, t(m.labelKey ?? m.label))
        )),
      ),
      e("div", { className: styles.field, style: { gridColumn: "1 / -1" } },
        e("label", { className: styles.label }, t("aiAgentFederation.capabilities")),
        e("input", {
          className: styles.input,
          value: Array.isArray(formData.capabilities) ? formData.capabilities.join(", ") : formData.capabilities,
          onChange: handleFieldChange("capabilities"),
          placeholder: t("aiAgentFederation.placeholderCapabilities"),
        }),
      ),
      e("div", { className: styles.field, style: { gridColumn: "1 / -1" } },
        e("label", { className: styles.label }, t("aiAgentFederation.systemPrompt")),
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
          " " + t("aiAgentFederation.isActive"),
        ),
      ),
      e("div", { className: styles.toolbar, style: { gridColumn: "1 / -1" } },
        e("button", {
          type: "submit",
          className: btnPrimary,
          disabled: saving,
        }, saving ? t("aiAgentFederation.saving") : t("aiAgentFederation.save")),
        e("button", {
          type: "button",
          className: btnGhost,
          onClick: () => { setShowForm(false); setEditingId(null); },
          disabled: saving,
        }, t("aiAgentFederation.cancel")),
      ),
    ),

    loading && e("p", { className: styles.loading }, t("aiAgentFederation.loading")),

    !loading && agents.length === 0 && e("p", { className: styles.empty }, t("aiAgentFederation.noAgents")),

    !loading && agents.length > 0 && e("div", { className: styles.tableWrap },
      e("table", { className: styles.table },
        e("thead", null,
          e("tr", null,
            e("th", { className: styles.th }, t("aiAgentFederation.name")),
            e("th", { className: styles.th }, t("aiAgentFederation.agentType")),
            e("th", { className: styles.th }, t("aiAgentFederation.provider")),
            e("th", { className: styles.th }, t("aiAgentFederation.model")),
            e("th", { className: styles.th }, t("aiAgentFederation.capabilities")),
            e("th", { className: styles.th }, t("aiAgentFederation.isActive")),
            e("th", { className: styles.th }, t("aiAgentFederation.actions")),
          ),
        ),
        e("tbody", null, ...agents.map((agent) =>
          e("tr", { key: agent.id, className: styles.tr },
            e("td", { className: styles.td }, agent.name),
            e("td", { className: styles.td }, typeLabel(agent.agent_type)),
            e("td", { className: styles.td }, agent.provider),
            e("td", { className: styles.td }, agent.model),
            e("td", { className: styles.td }, (agent.capabilities || []).join(", ")),
            e("td", { className: styles.td }, agent.is_active ? t("aiAgentFederation.yes") : t("aiAgentFederation.no")),
            e("td", { className: styles.td },
              e("button", {
                className: btnGhostSm,
                onClick: () => openEdit(agent),
                style: { marginRight: 8 },
              }, t("aiAgentFederation.editAgent")),
              e("button", {
                className: btnDangerSm,
                onClick: () => handleDelete(agent.id!),
              }, t("aiAgentFederation.deleteAgent")),
            ),
          ),
        )),
      ),
    ),
  );
}
