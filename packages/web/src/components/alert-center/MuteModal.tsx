import { useState } from "react";
import { useI18n } from "../../context/LangContext.js";
import soc from "../soc/soc.module.css";

interface MuteTarget {
  symbol?: string;
  alert_family?: string;
  alert_type?: string;
  [key: string]: unknown;
}

interface MuteModalProps {
  alert: MuteTarget | null;
  busy?: boolean;
  onConfirm: (opts: { mute_minutes: number; reason: string }) => void;
  onClose: () => void;
}

const DURATIONS = [15, 30, 60, 240];

export function MuteModal(props: MuteModalProps) {
  const { t } = useI18n();
  const [minutes, setMinutes] = useState(30);
  const [reason, setReason] = useState("");

  if (!props.alert) return null;
  const family = String(props.alert.alert_family || props.alert.alert_type || "—");

  return (
    <div className={`${soc.drawerOverlay}`} onClick={props.onClose}>
      <div
        className={`${soc.sectionCard}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={String(t("alertCenter.muteTitle"))}
        style={{ maxWidth: 420, margin: "12vh auto 0", padding: 20 }}
      >
        <h3 style={{ margin: "0 0 4px", fontSize: 16, fontWeight: 800 }}>
          {t("alertCenter.muteTitle")}: {String(props.alert.symbol || "")}
        </h3>
        <p style={{ margin: "0 0 12px", fontSize: 12, color: "var(--text-muted)" }}>{family}</p>
        <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13, marginBottom: 12 }}>
          {t("alertCenter.muteDuration")}
          <select
            className={`${soc.searchInputWithIcon}`}
            value={minutes}
            onChange={(e) => setMinutes(Number(e.target.value))}
          >
            {DURATIONS.map((d) => (
              <option key={d} value={d}>{t("alertCenter.muteMinutes", { count: d })}</option>
            ))}
          </select>
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13, marginBottom: 16 }}>
          {t("alertCenter.muteReason")}
          <input
            type="text"
            className={`${soc.searchInputWithIcon}`}
            value={reason}
            maxLength={200}
            onChange={(e) => setReason(e.target.value)}
          />
        </label>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button
            type="button"
            className={`${soc.filterBtn} ${soc.filterBtnInactive}`}
            onClick={props.onClose}
          >
            {t("alertCenter.muteCancel")}
          </button>
          <button
            type="button"
            className={`${soc.filterBtn} ${soc.filterBtnActive}`}
            disabled={Boolean(props.busy)}
            onClick={() => props.onConfirm({ mute_minutes: minutes, reason })}
          >
            {t("alertCenter.muteConfirm")}
          </button>
        </div>
      </div>
    </div>
  );
}
