import { createElement, useMemo } from "react";
import { Link, useLocation } from "react-router-dom";
import { useI18n } from "../context/LangContext.js";
import styles from "./aiSettings.module.css";

const e = createElement;

// Grain filter của audit panel (?page= là trang audit, KHÁC usage page).
const AUDIT_KEYS = ["action", "actor", "dateFrom", "dateTo", "page"];
const USAGE_KEYS = ["pageSize", "modelFilter", "statusFilter"];

const SNAPSHOT_KEY = "ai-hubnav:audit-search";

/** R1.8 AC4: nhớ filter audit cùng session để tab Tổng quan khôi phục sau khi qua tab khác. */
export function writeAuditSnapshot(search: string): void {
  try {
    const kept = pickKeys(search, AUDIT_KEYS);
    if (typeof sessionStorage !== "undefined") {
      if (kept) sessionStorage.setItem(SNAPSHOT_KEY, kept);
      else sessionStorage.removeItem(SNAPSHOT_KEY);
    }
  } catch {
    /* storage không khả dụng (SSR/test) — bỏ qua, link về không giữ filter */
  }
}

export function readAuditSnapshot(): string {
  try {
    if (typeof sessionStorage !== "undefined") return sessionStorage.getItem(SNAPSHOT_KEY) || "";
  } catch {
    /* bỏ qua */
  }
  return "";
}

function pickKeys(search: string, keys: string[]): string {
  const src = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const out = new URLSearchParams();
  for (const k of keys) {
    const v = src.get(k);
    if (v !== null && v !== "") out.set(k, v);
  }
  const s = out.toString();
  return s ? `?${s}` : "";
}

interface HubTab {
  to: string;
  labelKey: string;
  active: boolean;
}

/**
 * R1.8: tab bar dùng chung cho 3 route AI CC. Mỗi tab chỉ giữ param của route
 * đích (tránh ?page= của audit làm lệch trang usage và ngược lại).
 */
export function AiHubNav({ className = "" }: { className?: string }) {
  const { t } = useI18n();
  const location = useLocation();
  const tabs: HubTab[] = useMemo(() => {
    // Tab Tổng quan LUÔN dùng snapshot (không pick từ URL hiện tại): ?page=
    // trên route khác là grain khác (usage page ≠ audit page), pick nhầm là leak
    // 2 chiều (đây chính là bug đã bắt ở AC4: tab Usage mang ?page=3 của audit sang).
    // Snapshot do panel ghi mỗi khi filter đổi nên luôn đồng bộ khi ở hub.
    // Tab Usage chỉ mang pageSize/modelFilter/statusFilter (KHÔNG mang page).
    const auditSearch = readAuditSnapshot();
    return [
      {
        to: `/settings/ai${auditSearch}`,
        labelKey: "aiCommandCenter.tabOverview",
        active: location.pathname === "/settings/ai",
      },
      {
        to: "/settings/ai/agents",
        labelKey: "aiCommandCenter.tabAgents",
        active: location.pathname.startsWith("/settings/ai/agents"),
      },
      {
        to: `/settings/ai/usage${pickKeys(location.search, USAGE_KEYS)}`,
        labelKey: "aiCommandCenter.tabUsage",
        active: location.pathname.startsWith("/settings/ai/usage"),
      },
      // R3.2: tab Traces. KHÔNG mang theo filter của tab khác (giống Usage) —
      // `?symbol=` của trang này là tham số riêng, đem sang tab khác sẽ rác URL.
      {
        to: "/settings/ai/traces",
        labelKey: "aiCommandCenter.tabTraces",
        active: location.pathname.startsWith("/settings/ai/traces"),
      },
      // R3.3: tab SLO. Không mang filter của tab khác.
      {
        to: "/settings/ai/slo",
        labelKey: "aiCommandCenter.tabSlo",
        active: location.pathname.startsWith("/settings/ai/slo"),
      },
    ];
  }, [location.pathname, location.search]);
  return e(
    "nav",
    { className: `${styles.hubNav} ${className}`, "aria-label": t("aiCommandCenter.title") },
    tabs.map((tab) =>
      e(
        Link,
        {
          key: tab.labelKey,
          to: tab.to,
          className: styles.hubNavLink + (tab.active ? " " + styles.hubNavLinkActive : ""),
          ...(tab.active ? { "aria-current": "page" } : {}),
        },
        t(tab.labelKey)
      )
    )
  );
}
