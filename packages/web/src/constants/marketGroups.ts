/**
 * Market group constants — SSOT cho giá trị cố định.
 *
 * Group DATA lấy từ API (GET /api/soc/symbol-groups/), KHÔNG hardcode.
 * File này chỉ chứa các giá trị cố định cần thiết cho UI logic.
 */

/** Group mặc định khi chưa select */
export const DEFAULT_SYMBOL_GROUP = "VN30";

/** Key sentinel cho custom group trong UI (dùng làm key trong group list) */
export const CUSTOM_GROUP_KEY = "__custom__";

/** ID gửi lên backend khi chọn custom group */
export const CUSTOM_GROUP_ID = "custom";

/**
 * IDs của system groups cần loại khỏi danh sách watchlist user.
 * So sánh bằng group_id (lowercase, slug form) — KHÔNG so name (i18n/drift risk).
 */
export const SYSTEM_GROUP_IDS = [
  // Index groups
  "vn30", "vn50", "vn100", "hnx30",
  // Exchange groups
  "hose", "hnx", "upcom",
  // Sector groups (từ default_groups.py — slug form)
  "ngan-hang", "bat-dong-san", "thep-vat-lieu",
  "dau-khi", "cong-nghe", "ban-le-tieu-dung",
];

/**
 * Các `group_type` của nhóm THỊ TRƯỜNG (CachedSymbolGroup) — KHÔNG phải
 * danh mục do user tạo (BE `stock_mgmt_native_views.py:3821`).
 * Nguồn: `vnbroker_adapter.py:1430-1459` + `default_groups.py:98,137`.
 * Dùng tiêu chí này thay vì slug vì có 29 nhóm nhưng SYSTEM_GROUP_IDS chỉ 14.
 */
const SYSTEM_GROUP_TYPES = new Set([
  "SECTOR", "INDEX", "EXCHANGE", "ETF", "CW", "BOND", "DERIVATIVE", "MARKET_CAP",
]);

function slugifyGroup(value: unknown): string {
  return String(value ?? "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** True = nhóm hệ thống/thị trường (cần loại khỏi universe của user). */
export function isSystemMarketGroup(group: Record<string, unknown> | null | undefined): boolean {
  if (!group) return false;
  const type = String(group.group_type ?? "").trim().toUpperCase();
  if (SYSTEM_GROUP_TYPES.has(type)) return true;
  // Fallback khi API thiếu group_type: slug theo cả id/name (bỏ dấu, gom separator).
  return [group.id, group.group_id, group.slug, group.name, group.group_name]
    .map(slugifyGroup)
    .some((slug) => slug !== "" && SYSTEM_GROUP_IDS.includes(slug));
}
