/**
 * mbw2-data B2.3/B2.5 — badge nguồn + provider cho broker hub.
 *
 * Quy tắc join (§2 contract, ADR-005 QĐ-C): badge provider = provider của
 * account trong URL (detail), KHÔNG suy từ dòng dữ liệu. `source` QĐ-C chỉ
 * nhận `manual|broker_backed|aggregate`; account chưa liên kết config ⇒
 * badge `unlinked`. Giá trị khác/null ⇒ render null (fail-closed, L-V02:
 * không bịa badge khi BE chưa trả nguồn).
 */
import { useI18n } from "../../context/LangContext";
import "./brokerData.css";

export type SourceKind = "manual" | "broker_backed" | "aggregate" | "unlinked";

const KNOWN_SOURCES: readonly string[] = ["manual", "broker_backed", "aggregate", "unlinked"];

/** Cấp module (L-F10): tone ổn định, không tạo object trong render. */
const SOURCE_TONE: Record<SourceKind, "info" | "ok" | "neutral" | "off"> = {
  manual: "info",
  broker_backed: "ok",
  aggregate: "neutral",
  unlinked: "off",
};

export function SourceBadge({ source }: { source?: string | null }) {
  const { t } = useI18n();
  if (source == null || !KNOWN_SOURCES.includes(source)) return null;
  const kind = source as SourceKind;
  const label =
    kind === "manual"
      ? t("brokerHub.data.badge.manual", { defaultValue: "Thủ công" })
      : kind === "broker_backed"
        ? t("brokerHub.data.badge.brokerBacked", { defaultValue: "Môi giới" })
        : kind === "aggregate"
          ? t("brokerHub.data.badge.aggregate", { defaultValue: "Tổng hợp" })
          : t("brokerHub.data.badge.unlinked", { defaultValue: "Chưa liên kết" });
  return (
    <span className="bdata-badge" data-tone={SOURCE_TONE[kind]}>
      {label}
    </span>
  );
}

/**
 * Badge provider cho MỌI dòng account (AC3): text là provider của account
 * trong URL (truyền từ detail xuống), không đọc từ dòng.
 */
export function ProviderBadge({
  provider,
  unlinked,
}: {
  provider?: string | null;
  unlinked?: boolean;
}) {
  const { t } = useI18n();
  if (unlinked || !provider) {
    return <SourceBadge source="unlinked" />;
  }
  void t;
  return (
    <span className="bdata-badge" data-tone="provider">
      {String(provider).toUpperCase()}
    </span>
  );
}

/**
 * Tab "Khớp lệnh" = orders đã khớp, lọc client-side vì BE không có endpoint
 * fills riêng (§2 contract). BE pass-through status của broker (không có
 * enum chuẩn — `adapters.py` chỉ `_first(item, 'status', ...)`), nên tập khớp
 * giữ tối thiểu {FILLED, MATCHED} + ghi rõ giới hạn ở UI (AC3).
 * Cấp module (L-F10) để identity ổn định.
 */
const MATCHED_ORDER_STATUSES: ReadonlySet<string> = new Set(["FILLED", "MATCHED"]);

export function isMatchedOrder(status: unknown): boolean {
  return MATCHED_ORDER_STATUSES.has(String(status ?? "").trim().toUpperCase());
}

export function filterMatchedOrders<T extends { status?: unknown }>(orders: readonly T[]): T[] {
  return orders.filter((o) => isMatchedOrder(o?.status));
}
