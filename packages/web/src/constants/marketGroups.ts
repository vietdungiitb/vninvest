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
