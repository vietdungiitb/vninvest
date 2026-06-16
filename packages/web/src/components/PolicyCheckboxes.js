import { createElement, useMemo } from "react";

export const POLICIES = [
  { id: "pol_market_read", label: "Đọc dữ liệu thị trường", description: "Cho phép đọc dữ liệu giá, khối lượng, OHLCV", scopes: ["market:read"] },
  { id: "pol_signals_read", label: "Đọc tín hiệu cá mập", description: "Cho phép đọc tín hiệu whale, dark flow, order flow", scopes: ["signals:read"] },
  { id: "pol_ai_invoke", label: "Gọi AI Advisory", description: "Cho phép gọi API tư vấn AI", scopes: ["ai:invoke"] },
  { id: "pol_manage_pats", label: "Quản trị API Token", description: "Cho phép tạo, xoay, thu hồi PAT", scopes: ["manage_pats"] },
  { id: "pol_manage_service_accounts", label: "Quản trị Service Accounts", description: "Cho phép tạo, sửa, xóa service accounts", scopes: ["manage_service_accounts"] },
  { id: "pol_manage_tenant", label: "Quản lý Tenant", description: "Cho phép cập nhật thông tin tenant, quản lý thành viên", scopes: ["manage_tenant"] },
];

export const POLICY_TO_SCOPE_CODES = {
  pol_market_read: ["market:read"],
  pol_signals_read: ["signals:read"],
  pol_ai_invoke: ["ai:invoke"],
  pol_manage_pats: ["manage_pats"],
  pol_manage_service_accounts: ["manage_service_accounts"],
  pol_manage_tenant: ["manage_tenant"],
};

export const SCOPE_CODE_TO_POLICY = {
  "market:read": "pol_market_read",
  "signals:read": "pol_signals_read",
  "ai:invoke": "pol_ai_invoke",
  "manage_pats": "pol_manage_pats",
  "manage_service_accounts": "pol_manage_service_accounts",
  "manage_tenant": "pol_manage_tenant",
};

export function policyIdsToScopeCodes(policyIds) {
  const scopeCodes = [];
  const seen = new Set();
  for (const policyId of policyIds || []) {
    const scopes = POLICY_TO_SCOPE_CODES[policyId] || [policyId];
    for (const scope of scopes) {
      if (!seen.has(scope)) {
        seen.add(scope);
        scopeCodes.push(scope);
      }
    }
  }
  return scopeCodes;
}

export function scopeCodesToPolicyIds(scopeCodes) {
  const policyIds = [];
  const seen = new Set();
  for (const scopeCode of scopeCodes || []) {
    const policyId = SCOPE_CODE_TO_POLICY[scopeCode] || scopeCode;
    if (!seen.has(policyId)) {
      seen.add(policyId);
      policyIds.push(policyId);
    }
  }
  return policyIds;
}

export function PolicyCheckboxes({ selectedPolicies = [], onChange, disabled = false }) {
  const selectedSet = useMemo(() => new Set(selectedPolicies), [selectedPolicies]);

  const handleToggle = (policyId) => {
    if (disabled) return;
    const newSelected = new Set(selectedSet);
    if (newSelected.has(policyId)) {
      newSelected.delete(policyId);
    } else {
      newSelected.add(policyId);
    }
    onChange(Array.from(newSelected));
  };

  return createElement(
    "div",
    { style: { display: "flex", flexDirection: "column", gap: "10px" } },
    POLICIES.map(policy =>
      createElement(
        "label",
        {
          key: policy.id,
          style: {
            display: "flex",
            alignItems: "flex-start",
            gap: "12px",
            padding: "12px",
            background: selectedSet.has(policy.id) ? "rgba(0,180,216,0.1)" : "rgba(15,23,42,0.5)",
            border: selectedSet.has(policy.id) ? "1px solid rgba(0,180,216,0.3)" : "1px solid rgba(255,255,255,0.08)",
            borderRadius: "10px",
            cursor: disabled ? "not-allowed" : "pointer",
            opacity: disabled ? 0.6 : 1,
            transition: "all 0.2s ease",
          },
        },
        createElement("input", {
          type: "checkbox",
          checked: selectedSet.has(policy.id),
          onChange: () => handleToggle(policy.id),
          disabled: disabled,
          style: {
            width: "18px",
            height: "18px",
            marginTop: "2px",
            accentColor: "#00b4d8",
            cursor: disabled ? "not-allowed" : "pointer",
          },
        }),
        createElement(
          "div",
          { style: { flex: 1 } },
          createElement(
            "div",
            { style: { fontWeight: 600, fontSize: "14px", color: "#f1f5f9" } },
            policy.label
          ),
          createElement(
            "div",
            { style: { fontSize: "12px", color: "#94a3b8", marginTop: "2px" } },
            policy.description
          ),
          createElement(
            "div",
            { style: { fontSize: "11px", color: "#64748b", marginTop: "4px", fontFamily: "monospace" } },
            "Scopes: ",
            policy.scopes.join(", ")
          )
        )
      )
    )
  );
}