/**
 * W0/D5 — cơ chế bật light theme CHỈ ở dev/staging để chụp ảnh QA.
 *
 * Production luôn dark: flag chỉ active khi build dev (`MODE=development`)
 * HOẶC build staging có `VITE_DEV_THEME_FLAG=1` VÀ URL có `?theme=light`.
 * Không đưa PAT/secret vào query — chỉ 1 cờ boolean.
 */
const FLAG_STORAGE_KEY = "vninvest-theme";

export function isDevThemeFlagActive(): boolean {
  if (typeof window === "undefined" || typeof document === "undefined") return false;
  const mode = import.meta.env.MODE as string | undefined;
  const buildAllowed = mode === "development" || import.meta.env.VITE_DEV_THEME_FLAG === "1";
  if (!buildAllowed) return false;
  return new URLSearchParams(window.location.search).get("theme") === "light";
}

/** Trả true khi đã áp light (để caller early-return, không force dark ghi đè). */
export function applyDevThemeFlag(): boolean {
  if (!isDevThemeFlagActive()) return false;
  document.documentElement.setAttribute("data-theme", "light");
  try {
    window.localStorage.setItem(FLAG_STORAGE_KEY, "light");
  } catch {
    /* private mode — bỏ qua */
  }
  return true;
}
