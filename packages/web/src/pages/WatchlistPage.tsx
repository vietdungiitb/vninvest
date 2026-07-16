import { createElement, useEffect, useRef } from "react";
import "./WatchlistPage.css";
import { ShellPageChrome } from "../components/ShellPageTemplate.js";
import { WatchlistProvider, useWatchlist } from "./watchlist/components/WatchlistContext";
import { WatchlistSidebar } from "./watchlist/components/WatchlistSidebar";
import { WatchlistMainWorkspace } from "./watchlist/components/WatchlistMainWorkspace";
import { WatchlistDetailPanel } from "./watchlist/components/WatchlistDetailPanel";
import { useI18n } from "../context/LangContext.js";

export interface Identity {
  is_staff?: boolean;
  is_superuser?: boolean;
}

export interface Session {
  is_staff?: boolean;
  is_superuser?: boolean;
  principal?: {
    identity?: Identity;
  };
}

export interface WatchlistPageProps {
  env?: Record<string, unknown>;
  autoLoad?: boolean;
  t?: (key: string, defaultVal: string) => string;
  identity?: Identity;
  session?: Session;
}

function WatchlistPageContent({ autoLoad = true }: WatchlistPageProps) {
  const { loadAllLists, fetchPriceAlertsList } = useWatchlist();
  const { t } = useI18n();
  const didInitRef = useRef(false);

  useEffect(() => {
    if (!autoLoad || didInitRef.current) return;
    didInitRef.current = true;
    loadAllLists(true);
    fetchPriceAlertsList();
  }, [autoLoad, loadAllLists, fetchPriceAlertsList]);

  return createElement(
    ShellPageChrome,
    {
      eyebrow: t("watchlist.eyebrow", { defaultValue: "Rada Thi Tr\u01B0\u1EDDng" }),
      title: t("watchlist.title", { defaultValue: "Danh M\u00DAc Theo D\u00F5i" }),
      description: t("watchlist.description", { defaultValue: "Theo d\u00F5i bi\u1EBFn \u0111\u1ED9ng gi\u00E1 c\u1ED5 phi\u1EBFu, rsi, rvol v\u00E0 xu h\u01B0\u1EDBng th\u1ECB tr\u01B0\u1EDDng." }),
    },
    createElement(
      "div",
      { className: "watchlistPage__layout" },
      createElement(WatchlistSidebar),
      createElement(WatchlistMainWorkspace)
    ),
    createElement(WatchlistDetailPanel)
  );
}

export function WatchlistPage(props: WatchlistPageProps) {
  return createElement(
    WatchlistProvider,
    null,
    createElement(WatchlistPageContent, props)
  );
}

export default WatchlistPage;
