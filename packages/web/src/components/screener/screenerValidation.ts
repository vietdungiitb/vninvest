import { SCREENER_FIELD_GROUPS, type ScreenerFieldSpec } from "../../types/screener.js";

export type ConditionValidationError =
  | { kind: "required" }
  | { kind: "number" }
  | { kind: "range"; min?: number; max?: number };

/** Find a field spec across all groups (undefined for unknown fields). */
export function getFieldSpec(fieldKey: string): ScreenerFieldSpec | undefined {
  for (const group of Object.values(SCREENER_FIELD_GROUPS)) {
    const spec = group.fields[fieldKey];
    if (spec) return spec;
  }
  return undefined;
}

/**
 * Validate one condition value (P0.3 R3.1/R3.2).
 * "" (cleared input) -> required; non-finite -> number; outside [min,max] -> range.
 * Unknown fields (not in the picker registry, e.g. BE-only whale fields) only
 * get the finite-number check — the backend allowlist is the final gate.
 */
export function validateConditionValue(
  fieldKey: string,
  value: number | "" | null | undefined,
): ConditionValidationError | null {
  if (value === "" || value === null || value === undefined) return { kind: "required" };
  if (typeof value !== "number" || !Number.isFinite(value)) return { kind: "number" };
  const spec = getFieldSpec(fieldKey);
  if (spec && ((spec.min !== undefined && value < spec.min) || (spec.max !== undefined && value > spec.max))) {
    return { kind: "range", min: spec.min, max: spec.max };
  }
  return null;
}
