export type DiffImpact = "none" | "runtime_risk" | "invalid";

export interface DiffRow {
  key: string;
  before: string;
  after: string;
  impact: DiffImpact;
}

const SENSITIVE_LEAVES = new Set([
  "poll_interval_seconds",
  "max_batch_size",
  "max_dispatch_per_cycle",
  "decay_days",
  "parity_snapshot_retention_days",
]);

function flatten(value: unknown, prefix: string, out: Map<string, string>): void {
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      flatten(child, prefix ? `${prefix}.${key}` : key, out);
    }
    return;
  }
  out.set(prefix, value === null || value === undefined ? "\u2014" : String(value));
}

function computeImpact(key: string, afterMap: Map<string, string>): DiffImpact {
  const leaf = key.split(".").pop() || "";
  if (!SENSITIVE_LEAVES.has(leaf)) return "none";
  const value = Number(afterMap.get(key));
  if (leaf === "poll_interval_seconds" && (!Number.isFinite(value) || value < 10)) {
    return "invalid";
  }
  if (leaf === "max_dispatch_per_cycle" && Number.isFinite(value)) {
    const tier = key.split(".").slice(0, -1).join(".");
    const batch = Number(afterMap.get(`${tier}.max_batch_size`));
    if (Number.isFinite(batch) && value > batch * 2) {
      return "invalid";
    }
  }
  return "runtime_risk";
}

export function diffObjects(
  before: Record<string, unknown> | null | undefined,
  after: Record<string, unknown> | null | undefined,
): DiffRow[] {
  const beforeMap = new Map<string, string>();
  const afterMap = new Map<string, string>();
  flatten(before || {}, "", beforeMap);
  flatten(after || {}, "", afterMap);
  const keys = Array.from(new Set([...beforeMap.keys(), ...afterMap.keys()])).sort();
  const rows: DiffRow[] = [];
  for (const key of keys) {
    const bStr = beforeMap.has(key) ? (beforeMap.get(key) as string) : "\u2014";
    const aStr = afterMap.has(key) ? (afterMap.get(key) as string) : "\u2014";
    if (bStr === aStr) continue;
    rows.push({ key, before: bStr, after: aStr, impact: computeImpact(key, afterMap) });
  }
  return rows;
}

export function changedLeafKeys(rows: DiffRow[]): Set<string> {
  const leaves = new Set<string>();
  for (const row of rows) {
    leaves.add(row.key.split(".").pop() || row.key);
  }
  return leaves;
}
