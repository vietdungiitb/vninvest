import { useEffect, useState, useMemo } from "react";
import { createElement } from "react";
import { useUrlValue } from "../../hooks/useUrlState";

/**
 * WAVE 8 / NAV-1 — codec bỏ giá trị MẶC ĐỊNH khỏi URL.
 *
 * Vì sao không dùng `stringCodec`: nó chỉ bỏ giá trị **rỗng**
 * (`serialize: (v) => (v === "" ? undefined : v)`), nên bấm về tab `chart`
 * sẽ để lại `?ws_tab=chart` — URL bẩn dù người dùng đã về trạng thái mặc định.
 * Cùng nguyên tắc với `boolCodec` của hook và với `usageTabCodec` bên
 * `TenantUsageSummaryPage.tsx`.
 *
 * `parse` cũng phải trả `undefined` cho giá trị lạ, để `?ws_tab=bogus` rơi về
 * mặc định thay vì rơi vào trạng thái không có tab nào được chọn.
 */
const WS_TABS = ["chart", "orderbook", "tradelog"];
const WS_TAB_DEFAULT = "chart";
const wsTabCodec = {
  parse: (raw) => (WS_TABS.includes(raw) ? raw : undefined),
  serialize: (v) => (v === WS_TAB_DEFAULT ? undefined : v),
};

/**
 * WorkstationLayout - Responsive layout wrapper for Stock Detail Workstation
 * 
 * Desktop (>768px): Split-screen 65/35
 *   Left: Chart + Radar (children.left)
 *   Right: Order Book + Trade Log (children.right)
 * 
 * Mobile (<768px): Tab switcher
 *   Tabs: [Biểu đồ | Sổ lệnh | Khớp lệnh]
 * 
 * Feature flag: WORKSTATION_LAYOUT_V2
 * 
 * @param {Object} props
 * @param {ReactNode} props.children.left - Left column content (Chart + Radar)
 * @param {ReactNode} props.children.right - Right column content (OrderBook + TradeLog)
 * @param {boolean} props.enabled - Feature flag
 * @param {string} props.className - Additional className
 */
export function WorkstationLayout({ children, enabled = true, className = "" }) {
  const e = createElement;
  const [isMobile, setIsMobile] = useState(false);
  // WAVE 6 / NAV-1 — tab mobile chua dong bo URL: F5 luon quay ve `chart`.
  // Mac dinh giong het `useState` cu (`chart`) va KHONG ghi ra URL.
  // WAVE 8 / NAV-1 — `wsTabCodec` (không phải `stringCodec`): bấm về tab mặc
  // định `chart` sẽ **xoá** tham số khỏi URL thay vì để lại `?ws_tab=chart`.
  const [activeTab, setActiveTab] = useUrlValue("ws_tab", wsTabCodec, WS_TAB_DEFAULT); // chart | orderbook | tradelog

  // Check feature flag from window.__ENV__ or localStorage, fallback to enabled prop
  const isFeatureEnabled = useMemo(() => {
    if (typeof window !== "undefined") {
      const localVal = localStorage.getItem("workstation_v2");
      if (localVal !== null) {
        return localVal === "true";
      }
      if (window.__ENV__?.WORKSTATION_LAYOUT_V2 !== undefined) {
        return window.__ENV__.WORKSTATION_LAYOUT_V2 === true;
      }
    }
    return enabled;
  }, [enabled]);

  // Responsive breakpoint detection
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // If feature disabled, render children in legacy vertical stack
  if (!isFeatureEnabled) {
    return e(
      "div",
      { className: `ws-legacy ${className}` },
      children?.left,
      children?.right
    );
  }

  // Mobile: Tab switcher
  if (isMobile) {
    return e(
      "div",
      { className: `ws-mobile ${className}` },
      e(
        "div",
        { 
          className: "ws-tab-bar", 
          role: "tablist", 
          "aria-label": "Chế độ xem Workstation" 
        },
        e(
          "button",
          {
            role: "tab",
            "aria-selected": activeTab === "chart",
            "aria-controls": "panel-chart",
            id: "tab-chart",
            className: `ws-tab ${activeTab === "chart" ? "ws-tab-active" : ""}`,
            onClick: () => setActiveTab("chart"),
            type: "button",
          },
          "📈 Biểu đồ"
        ),
        e(
          "button",
          {
            role: "tab",
            "aria-selected": activeTab === "orderbook",
            "aria-controls": "panel-orderbook",
            id: "tab-orderbook",
            className: `ws-tab ${activeTab === "orderbook" ? "ws-tab-active" : ""}`,
            onClick: () => setActiveTab("orderbook"),
            type: "button",
          },
          "📊 Sổ lệnh"
        ),
        e(
          "button",
          {
            role: "tab",
            "aria-selected": activeTab === "tradelog",
            "aria-controls": "panel-tradelog",
            id: "tab-tradelog",
            className: `ws-tab ${activeTab === "tradelog" ? "ws-tab-active" : ""}`,
            onClick: () => setActiveTab("tradelog"),
            type: "button",
          },
          "📋 Khớp lệnh"
        )
      ),
      e(
        "div",
        {
          role: "tabpanel",
          id: "panel-chart",
          "aria-labelledby": "tab-chart",
          hidden: activeTab !== "chart",
          className: "ws-tab-panel"
        },
        children?.left
      ),
      e(
        "div",
        {
          role: "tabpanel",
          id: "panel-orderbook",
          "aria-labelledby": "tab-orderbook",
          hidden: activeTab !== "orderbook",
          className: "ws-tab-panel"
        },
        e("div", { className: "ws-mobile-panel-title" }, "Sổ lệnh (Market Depth)"),
        children?.right?.props?.children?.[0] // OrderBookWidget
      ),
      e(
        "div",
        {
          role: "tabpanel",
          id: "panel-tradelog",
          "aria-labelledby": "tab-tradelog",
          hidden: activeTab !== "tradelog",
          className: "ws-tab-panel"
        },
        e("div", { className: "ws-mobile-panel-title" }, "Nhật ký khớp lệnh (Trade Log)"),
        children?.right?.props?.children?.[1] // TradeLogWidget
      )
    );
  }

  // Desktop: Split-screen layout
  return e(
    "div",
    { className: `ws-desktop ${className}` },
    e(
      "div",
      { className: "ws-left-column" },
      children?.left
    ),
    e(
      "div",
      { className: "ws-right-column" },
      children?.right
    )
  );
}