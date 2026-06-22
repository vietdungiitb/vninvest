import { type ReactNode } from "react";

export interface PolicyCheckboxesProps {
  selectedPolicies: string[];
  onChange: (policies: string[]) => void;
  disabled?: boolean;
}

export declare const POLICIES: { id: string; label: string; description: string; scopes: string[] }[];
export declare const POLICY_TO_SCOPE_CODES: Record<string, string[]>;
export declare const SCOPE_CODE_TO_POLICY: Record<string, string>;

export declare function policyIdsToScopeCodes(policyIds: string[]): string[];
export declare function scopeCodesToPolicyIds(scopeCodes: string[]): string[];
export declare function PolicyCheckboxes(props: PolicyCheckboxesProps): ReactNode;
