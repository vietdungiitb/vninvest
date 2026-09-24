/**
 * formatMarket.js — formatter số/ngày dùng chung toàn app (vi-VN).
 * Khóa theo L7 của IMPLEMENTATION_PLAN_DASHBOARD_AUDIT_FIX_20260921:
 * compact dùng dấu phẩy thập phân VI (`1,52 tỷ ₫` / `660,5 triệu ₫`),
 * tooltip hiện số đầy đủ, ngày phiên `dd/MM/yyyy`.
 */

const viCompact1 = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1, minimumFractionDigits: 0 });
const viFull = new Intl.NumberFormat("vi-VN");

/**
 * Rút gọn giá trị VND: `1,52 tỷ ₫`, `660,5 triệu ₫`, số nhỏ giữ nguyên + `₫`.
 * Trả về `"—"` khi null/NaN.
 */
export function formatVNDCompact(value) {
  if (value == null) return "—";
  const num = Number(value);
  if (!Number.isFinite(num)) return "—";
  const abs = Math.abs(num);
  if (abs >= 1e9) return `${viCompact1.format(num / 1e9)} tỷ ₫`;
  if (abs >= 1e6) return `${viCompact1.format(num / 1e6)} triệu ₫`;
  if (abs >= 1e3) return `${viCompact1.format(num / 1e3)} nghìn ₫`;
  return `${viFull.format(num)} ₫`;
}

/** Số đầy đủ cho tooltip: `1.523.938.140 ₫`. */
export function formatFullVND(value) {
  if (value == null) return "—";
  const num = Number(value);
  if (!Number.isFinite(num)) return "—";
  return `${viFull.format(num)} ₫`;
}

/** Ngày phiên `dd/MM/yyyy` (mặc định hôm nay khi thiếu). */
export function formatSessionDate(iso) {
  const d = iso ? new Date(iso) : new Date();
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
}

/** Giờ `HH:mm` cho "cập nhật …". */
export function formatUpdateTime(ts) {
  const d = ts ? new Date(ts) : new Date();
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
}

/**
 * Relative time "Vừa xong / X phút trước" — style UnifiedAlertCenter.js:44-54.
 * Shared util cho SmartStatsHeader (S5.1) và UnifiedAlertCenter để tránh duplicate.
 * Không i18n: giữ VI như bản gốc dashboard (EN fallback vẫn đọc được).
 */
export function formatTimeAgo(ts) {
  if (!ts) return "";
  const diff = Date.now() - new Date(ts).getTime();
  if (!Number.isFinite(diff) || diff < 0) return "Vừa xong";
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Vừa xong";
  if (mins < 60) return `${mins} phút trước`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} giờ trước`;
  const days = Math.floor(hours / 24);
  return `${days} ngày trước`;
}

// Alias giữ tương thích với UnifiedAlertCenter cũ
export const timeAgo = formatTimeAgo;

/** -1 | 0 | 1 — dùng cho pill trung tính khi bằng 0 (audit #10). */
export function signOf(n) {
  const num = Number(n);
  if (!Number.isFinite(num) || num === 0) return 0;
  return num > 0 ? 1 : -1;
}
