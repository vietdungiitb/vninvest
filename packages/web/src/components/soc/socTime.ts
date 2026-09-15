/**
 * socTime.ts — helper cho SocOverviewPanel W8
 * Format last_check_at: absolute local + relative, dùng i18n keys time_*
 */

export function formatLastCheck(
  iso: string | null | undefined,
  localeTag: string,
  t: (key: string, opts?: Record<string, unknown>) => string,
): { display: string; title: string } {
  if (!iso) return { display: "—", title: "" };
  try {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return { display: "—", title: iso };
    const absolute = new Intl.DateTimeFormat(localeTag, {
      hour: "2-digit",
      minute: "2-digit",
      day: "2-digit",
      month: "2-digit",
    }).format(date);
    const now = Date.now();
    const diffMs = now - date.getTime();
    const diffSec = Math.max(0, Math.floor(diffMs / 1000));
    let relative: string;
    if (diffSec < 60) {
      relative = t("soc.overview.time_just_now");
    } else if (diffSec < 3600) {
      const n = Math.floor(diffSec / 60);
      relative = t("soc.overview.time_minutes_ago", { n: String(n) });
    } else if (diffSec < 86400) {
      const n = Math.floor(diffSec / 3600);
      relative = t("soc.overview.time_hours_ago", { n: String(n) });
    } else {
      const n = Math.floor(diffSec / 86400);
      relative = t("soc.overview.time_days_ago", { n: String(n) });
    }
    return { display: `${absolute} (${relative})`, title: iso };
  } catch {
    return { display: iso, title: iso };
  }
}
