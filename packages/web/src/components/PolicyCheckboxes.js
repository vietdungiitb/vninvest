import styles from "./ShellPageTemplate.module.css";
import { createElement, useMemo } from "react";
export const POLICIES = [
  { id: "pol_market_read", label: "Đọc dữ liệu thị trường", description: "Cho phép đọc dữ liệu giá, khối lượng, OHLCV", scopes: ["market:read"] },
  { id: "pol_signals_read", label: "Đọc tín hiệu cá mập", description: "Cho phép đọc tín hiệu whale, dark flow, order flow", scopes: ["signals:read"] },
  { id: "pol_ai_invoke", label: "Gọi AI Advisory", description: "Cho phép gọi API tư vấn AI", scopes: ["ai:invoke"] },
  { id: "pol_manage_pats", label: "Quản trị API Token", description: "Cho phép tạo, xoay, thu hồi PAT", scopes: ["manage_pats"] },
  { id: "pol_manage_service_accounts", label: "Quản trị Service Accounts", description: "Cho phép tạo, sửa, xóa service accounts", scopes: ["manage_service_accounts"] },
  { id: "pol_manage_tenant", label: "Quản lý Tenant", description: "Cho phép cập nhật thông tin tenant, quản lý thành viên", scopes: ["manage_tenant"] },
  { id: "pol_admin_operator_read", label: "Đọc dữ liệu Operator", description: "Cho phép đọc dữ liệu giám sát hệ thống và cấu hình dịch vụ", scopes: ["admin.operator.read"] },
  { id: "pol_system_ai_command_center_manage", label: "Quản trị AI Command Center", description: "Cho phép quản trị và cấu hình AI Command Center", scopes: ["system.ai_command_center.manage"] },
];

export const POLICY_TO_SCOPE_CODES = {
  pol_market_read: ["market:read"],
  pol_signals_read: ["signals:read"],
  pol_ai_invoke: ["ai:invoke"],
  pol_manage_pats: ["manage_pats"],
  pol_manage_service_accounts: ["manage_service_accounts"],
  pol_manage_tenant: ["manage_tenant"],
  pol_admin_operator_read: ["admin.operator.read"],
  pol_system_ai_command_center_manage: ["system.ai_command_center.manage"],
};

export const SCOPE_CODE_TO_POLICY = {
  "market:read": "pol_market_read",
  "signals:read": "pol_signals_read",
  "ai:invoke": "pol_ai_invoke",
  "manage_pats": "pol_manage_pats",
  "manage_service_accounts": "pol_manage_service_accounts",
  "manage_tenant": "pol_manage_tenant",
  "admin.operator.read": "pol_admin_operator_read",
  "system.ai_command_center.manage": "pol_system_ai_command_center_manage",
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

export function PolicyCheckboxes({ selectedPolicies = [], onChange, disabled = false, allowedScopes = null }) {
  const selectedSet = useMemo(() => new Set(selectedPolicies), [selectedPolicies]);

  const displayedPolicies = useMemo(() => {
    if (!allowedScopes) return POLICIES;
    const scopeSet = new Set(allowedScopes);
    return POLICIES.filter(policy => policy.scopes.every(s => scopeSet.has(s)));
  }, [allowedScopes]);

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

  if (displayedPolicies.length === 0) {
    return createElement(
      "div",
      {
        style: {
          padding: "16px",
          background: "rgba(255,255,255,0.02)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: "10px",
          color: "#94a3b8",
          fontSize: "13px",
          lineHeight: "1.5",
          backdropFilter: "blur(10px)",
        }
      },
      "Tài khoản dịch vụ này có các quyền đặc biệt được gán trực tiếp bởi hệ thống (chính sách chuẩn không áp dụng):",
      allowedScopes && allowedScopes.length > 0
        ? createElement(
            "div",
            { style: { display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "12px" } },
            allowedScopes.map(scope =>
              createElement(
                "span",
                {
                  key: scope,
                  className: `${styles.pill}`,
                  style: {
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    color: "#f1f5f9",
                    fontFamily: "monospace",
                    fontSize: "11px",
                    padding: "4px 8px",
                    borderRadius: "6px",
                  }
                },
                scope
              )
            )
          )
        : createElement(
            "div",
            { style: { marginTop: "8px", fontStyle: "italic", color: "#64748b" } },
            "Không có quyền hạn"
          )
    );
  }

  return createElement(
    "div",
    { style: { display: "flex", flexDirection: "column", gap: "10px" } },
    displayedPolicies.map(policy =>
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