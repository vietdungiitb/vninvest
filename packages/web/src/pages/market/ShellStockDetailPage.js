import { createElement, useEffect, useState } from "react";
import { StockDetailPage } from "../StockDetailPage.tsx";
import { WorkstationShell } from "../../components/WorkstationShell.tsx";

const e = createElement;

export function resolveStockSymbolFromPathname(pathname = "") {
  const m = String(pathname).match(/\/stocks\/([^/?#]+)/i);
  return m ? decodeURIComponent(m[1]).toUpperCase().trim() : "";
}

export function syncStockLocation(symbol) {
  if (typeof window === "undefined" || !symbol) return;
  const next = `/stocks/${encodeURIComponent(symbol)}`;
  if (window.location.pathname !== next) {
    window.history.replaceState(null, "", next);
  }
}

export function ShellStockDetailPage(props) {
  const [symbol, setSymbol] = useState(() => {
    if (props.symbol) return String(props.symbol).toUpperCase().trim();
    if (typeof window !== "undefined") return resolveStockSymbolFromPathname(window.location.pathname);
    return "";
  });

  useEffect(() => {
    if (!symbol) return;
    syncStockLocation(symbol);
  }, [symbol]);

  return e(
    WorkstationShell,
    { symbol, eyebrow: "Workstation", title: symbol || "Stock Detail" },
    e(StockDetailPage, { ...props, symbol }),
  );
}

export default ShellStockDetailPage;
