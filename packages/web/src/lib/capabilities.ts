/**
 * R1.11 AC3 — parse/format capabilities của agent (chuỗi nhập tay <-> mảng).
 * Tách khỏi AIAgentFederationPanel để test độc lập.
 */
export function parseCapabilities(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((v) => String(v).trim()).filter(Boolean);
  }
  if (typeof value !== "string") return [];
  return value
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

export function formatCapabilities(values: unknown): string {
  return parseCapabilities(values).join(", ");
}
