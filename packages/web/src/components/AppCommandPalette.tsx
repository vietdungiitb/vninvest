import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useI18n } from "@/context/LangContext.js";
import { usePortfolio } from "@/context/PortfolioContext.js";
import { ALL_COMMANDS } from "./CommandRegistry";

/**
 * Palette dùng chung toàn app. Mount DUY NHẤT ở FullLayout — route tenant-admin
 * là con của `/` nên nằm trong FullLayout; không mount riêng ở TenantAdminLayout
 * (nếu không sẽ có 2 palette + 2 listener Cmd+K).
 */
export function AppCommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const { t } = useI18n();
  const { ability } = usePortfolio();
  const navigate = useNavigate();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
        setQuery("");
      } else if (e.key === "Escape" && open) {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!open) return null;

  const filtered = ALL_COMMANDS
    .filter((entry) => !entry.subject || (ability as any)?.can?.("read", entry.subject))
    .filter((entry) => !query || t(entry.labelKey).toLowerCase().includes(query.toLowerCase()) || entry.labelKey.toLowerCase().includes(query.toLowerCase()))
    .slice(0, 8);

  return (
    <div role="dialog" aria-modal="true" aria-label="Quick navigation" data-testid="app-command-palette" onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: 80, zIndex: 1000 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "var(--bg-shell-surface)", border: "1px solid var(--border-shell)", borderRadius: 12, width: 480, maxWidth: "90vw", maxHeight: "60vh", overflow: "hidden", boxShadow: "0 20px 60px rgba(0,0,0,0.5)" }}>
        <input aria-label={t("common.searchPages")} autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Tìm trang… (Ctrl+K)" style={{ width: "100%", padding: "12px 16px", border: "none", borderBottom: "1px solid var(--border-shell)", background: "transparent", color: "var(--text-primary)", fontSize: 14 }} />
        <div style={{ maxHeight: 320, overflowY: "auto", padding: 8 }}>
          {filtered.map((entry) => (
            <button key={entry.to} onClick={() => { setOpen(false); navigate(entry.to); }} style={{ display: "flex", gap: 12, alignItems: "center", width: "100%", padding: "10px 12px", borderRadius: 8, border: "none", background: "transparent", color: "var(--text-primary)", cursor: "pointer", textAlign: "left" }}>
              <entry.Icon size={16} aria-hidden />
              <span style={{ flex: 1, fontSize: 13 }}>{t(entry.labelKey)}</span>
              <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>{entry.to}</span>
            </button>
          ))}
          {filtered.length === 0 && <div style={{ padding: 16, fontSize: 13, color: "var(--text-secondary)", textAlign: "center" }}>Không tìm thấy</div>}
        </div>
      </div>
    </div>
  );
}
