import { createElement, useState } from "react";

const e = createElement;

const STORAGE_KEY = "staff_switch";

export function readStaffSwitch(): { token?: string; tenant?: { id?: string; tenant_code?: string; display_name?: string }; expires_at?: string } | null {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.token) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearStaffSwitch() {
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch { /* private mode */ }
  window.location.reload();
}

/**
 * R5: banner "đang xem hộ tenant" — hiện khi có staff_switch token.
 * Nút Thoát xoá token + reload về context thật.
 */
export function StaffSwitchBanner() {
  const [ctx] = useState(readStaffSwitch);
  if (!ctx) return null;
  const label = ctx.tenant?.display_name || ctx.tenant?.tenant_code || ctx.tenant?.id || "?";
  return e(
    "div",
    {
      role: "alert",
      style: {
        background: "#92400e", color: "#fff", padding: "8px 16px",
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px",
        fontSize: "13px", fontWeight: 600,
      },
    },
    e("span", null, `Đang xem hộ tenant: ${label} (chỉ đọc)`),
    e("button", {
      type: "button",
      onClick: clearStaffSwitch,
      style: {
        background: "#fff", color: "#92400e", border: "none", borderRadius: "999px",
        padding: "4px 14px", fontWeight: 700, cursor: "pointer", fontSize: "12px",
      },
    }, "Thoát xem hộ"),
  );
}
