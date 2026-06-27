import { useState, useEffect, useCallback, createElement, FormEvent, ChangeEvent } from "react";
import { coreApiAdapter } from "../adapters/coreApiAdapter.js";
import { useI18n } from "../context/LangContext.js";

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
  useI18n();
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
      .catch(() => { setError("Không thể tải danh sách agent."); })
      .finally(() => { setLoading(false); });
  }, [agentClient]);

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
        setNotice(editingId ? "Đã cập nhật agent thành công." : "Đã tạo agent thành công.");
        setShowForm(false);
        setEditingId(null);
        setFormData({ name: "", agent_type: "advisory", provider: "openai", model: "gpt-4o-mini", capabilities: [], system_prompt: "", is_active: true });
        loadAgents();
      })
      .catch(() => { setError("Không thể lưu agent."); })
      .finally(() => { setSaving(false); });
  };

  const handleDelete = (id: number) => {
    if (!confirm("Xác nhận xoá agent này?")) return;
    agentClient.deleteAIAgent(id)
      .then(() => {
        setNotice("Đã xoá agent thành công.");
        loadAgents();
      })
      .catch(() => { setError("Không thể xoá agent."); });
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

  const typeLabel = (t: string) => AGENT_TYPES.find((a) => a.value === t)?.label || t;

  return e("div", { className: `ai-agent-federation ${className}` },
    notice && e("div", { className: "core-page-notice", onClick: () => setNotice("") }, notice),

    e("div", { className: "core-page-section-header" },
      e("h2", null, "Quản lý Agent AI"),
      e("p", null, "Đăng ký và quản lý các agent AI trong hệ thống."),
      e("button", {
        className: "core-btn core-btn--primary",
        onClick: openCreate,
        disabled: showForm,
      }, "Thêm agent"),
    ),

    error && e("div", { className: "core-page-error", role: "alert" }, error),

    showForm && e("form", {
      className: "core-page-form",
      onSubmit: handleSubmit,
    },
      e("div", { className: "core-form-group" },
        e("label", null, "Tên agent"),
        e("input", {
          className: "core-input",
          value: formData.name,
          onChange: handleFieldChange("name"),
          placeholder: "VD: Phân tích ngành",
          required: true,
        }),
      ),
      e("div", { className: "core-form-group" },
        e("label", null, "Loại agent"),
        e("select", {
          className: "core-input",
          value: formData.agent_type,
          onChange: handleFieldChange("agent_type"),
        }, ...AGENT_TYPES.map((t) =>
          e("option", { key: t.value, value: t.value }, t.label)
        )),
      ),
      e("div", { className: "core-form-group" },
        e("label", null, "Nhà cung cấp"),
        e("input", {
          className: "core-input",
          value: formData.provider,
          onChange: handleFieldChange("provider"),
        }),
      ),
      e("div", { className: "core-form-group" },
        e("label", null, "Mô hình"),
        e("input", {
          className: "core-input",
          value: formData.model,
          onChange: handleFieldChange("model"),
        }),
      ),
      e("div", { className: "core-form-group" },
        e("label", null, "Năng lực (phân cách bằng dấu phẩy)"),
        e("input", {
          className: "core-input",
          value: Array.isArray(formData.capabilities) ? formData.capabilities.join(", ") : formData.capabilities,
          onChange: handleFieldChange("capabilities"),
          placeholder: "phân_tích_ngành, báo_cáo",
        }),
      ),
      e("div", { className: "core-form-group" },
        e("label", null, "System prompt"),
        e("textarea", {
          className: "core-input core-textarea",
          value: formData.system_prompt,
          onChange: handleFieldChange("system_prompt"),
          rows: 3,
        }),
      ),
      e("div", { className: "core-form-group core-form-group--checkbox" },
        e("label", null,
          e("input", {
            type: "checkbox",
            checked: formData.is_active,
            onChange: handleFieldChange("is_active"),
          }),
          " Đang kích hoạt"
        ),
      ),
      e("div", { className: "core-form-actions" },
        e("button", {
          type: "submit",
          className: "core-btn core-btn--primary",
          disabled: saving,
        }, saving ? "Đang lưu..." : "Lưu agent"),
        e("button", {
          type: "button",
          className: "core-btn core-btn--secondary",
          onClick: () => { setShowForm(false); setEditingId(null); },
          disabled: saving,
        }, "Huỷ"),
      ),
    ),

    loading && e("p", { className: "core-page-loading" }, "Đang tải agent AI..."),

    !loading && agents.length === 0 && e("p", null, "Chưa có agent nào."),

    !loading && agents.length > 0 && e("div", { className: "core-page-table-wrap" },
      e("table", { className: "core-page-table" },
        e("thead", null,
          e("tr", null,
            e("th", null, "Tên"),
            e("th", null, "Loại"),
            e("th", null, "Provider"),
            e("th", null, "Model"),
            e("th", null, "Năng lực"),
            e("th", null, "Kích hoạt"),
            e("th", null, "Hành động"),
          ),
        ),
        e("tbody", null, ...agents.map((agent) =>
          e("tr", { key: agent.id },
            e("td", null, agent.name),
            e("td", null, typeLabel(agent.agent_type)),
            e("td", null, agent.provider),
            e("td", null, agent.model),
            e("td", null, (agent.capabilities || []).join(", ")),
            e("td", null, agent.is_active ? "Có" : "Không"),
            e("td", null,
              e("button", {
                className: "core-btn core-btn--small core-btn--secondary",
                onClick: () => openEdit(agent),
                style: { marginRight: 8 },
              }, "Sửa"),
              e("button", {
                className: "core-btn core-btn--small core-btn--danger",
                onClick: () => handleDelete(agent.id!),
              }, "Xoá"),
            ),
          ),
        )),
      ),
    ),
  );
}
