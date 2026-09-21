// Shared AlertCenter formatters — single vi-VN / Asia/Ho_Chi_Minh pipeline.
// Slices 1.3 + 1.4: one place for money + timestamp rendering so the feed card,
// stats table and detail drawer can never drift into different formats again.

export const ALERT_CENTER_TIME_ZONE = "Asia/Ho_Chi_Minh";
export const ALERT_CENTER_LOCALE = "vi-VN";

function toDate(value: unknown): Date | null {
  if (value == null || value === "") return null;
  const d =
    value instanceof Date
      ? value
      : typeof value === "number"
        ? new Date(value)
        : new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d;
}

const timeFmt = new Intl.DateTimeFormat(ALERT_CENTER_LOCALE, {
  timeZone: ALERT_CENTER_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

const dateFmt = new Intl.DateTimeFormat(ALERT_CENTER_LOCALE, {
  timeZone: ALERT_CENTER_TIME_ZONE,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

/** VND integer — VND has no fractional unit, so backend Decimal(2) artifacts are rounded. */
export function formatVnd(value: unknown): string {
  if (value == null || value === "") return "—";
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value);
  return new Intl.NumberFormat(ALERT_CENTER_LOCALE, { maximumFractionDigits: 0 }).format(Math.round(n));
}

/** Compact VND for dense surfaces (stats table). Full value belongs in the tooltip. */
export function formatVndCompact(value: unknown): string {
  if (value == null || value === "") return "—";
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value);
  const abs = Math.abs(n);
  const grp = (v: number, digits: number) =>
    new Intl.NumberFormat(ALERT_CENTER_LOCALE, { maximumFractionDigits: digits }).format(v);
  if (abs >= 1e9) return `${grp(n / 1e9, 2)} tỷ`;
  if (abs >= 1e6) return `${grp(n / 1e6, 1)} triệu`;
  return formatVnd(n);
}

/** HH:mm:ss pinned to Asia/Ho_Chi_Minh (never the browser timezone). */
export function formatTimeICT(value: unknown): string {
  const d = toDate(value);
  if (!d) return "—";
  return timeFmt.format(d);
}

/** dd/MM/yyyy pinned to Asia/Ho_Chi_Minh. */
export function formatDateICT(value: unknown): string {
  const d = toDate(value);
  if (!d) return "—";
  return dateFmt.format(d);
}

/** HH:mm:ss dd/MM/yyyy pinned to Asia/Ho_Chi_Minh. */
export function formatDateTimeICT(value: unknown): string {
  const d = toDate(value);
  if (!d) return "—";
  return `${timeFmt.format(d)} ${dateFmt.format(d)}`;
}

const SESSION_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})/;

/** Backend session_date is a YYYY-MM-DD date (no instant) — render dd/MM/yyyy without TZ shift. */
export function formatSessionDate(value: unknown): string {
  const s = String(value ?? "").trim();
  if (!s) return "—";
  const m = SESSION_DATE_RE.exec(s);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  return formatDateICT(s);
}

/** Relative age ("5 phút trước") for dense rows; absolute time stays in the tooltip. */
export function formatAgo(value: unknown, locale: string = "vi"): string {
  const d = toDate(value);
  if (!d) return "—";
  const diffSec = Math.round((d.getTime() - Date.now()) / 1000);
  const rtf = new Intl.RelativeTimeFormat(locale === "en" ? "en" : "vi", { numeric: "auto" });
  const abs = Math.abs(diffSec);
  if (abs < 60) return rtf.format(diffSec, "second");
  if (abs < 3600) return rtf.format(Math.round(diffSec / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diffSec / 3600), "hour");
  return rtf.format(Math.round(diffSec / 86400), "day");
}

/**
 * Normalize alert copy so "Cá mập mua VBB: 588,479,248đ" and
 * "Cá mập mua VBB: 588.479.248 VND" compare equal.
 */
export function normalizeAlertText(value: unknown): string {
  return String(value ?? "")
    .toLowerCase()
    .replace(/vnd/g, "đ")
    .replace(/dong/g, "đ")
    .replace(/[\s.,_]/g, "");
}

/** True when the summary/body adds nothing over the title (Slice 1.2 dedupe). */
export function isDuplicateSummary(title: unknown, summary: unknown): boolean {
  const a = normalizeAlertText(title);
  const b = normalizeAlertText(summary);
  return a.length > 0 && a === b;
}
