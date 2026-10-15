import { createElement, useEffect, useRef } from "react";
import "./WatchlistPage.css";
import { ShellPageChrome } from "../components/ShellPageTemplate.js";
import { WatchlistProvider, useWatchlist } from "./watchlist/components/WatchlistContext";
import { WatchlistSidebar } from "./watchlist/components/WatchlistSidebar";
import { WatchlistMainWorkspace } from "./watchlist/components/WatchlistMainWorkspace";
import { WatchlistDetailPanel } from "./watchlist/components/WatchlistDetailPanel";
import { ScopedWatchlist } from "../components/brokerData/ScopedWatchlist.js";
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
      eyebrow: undefined,
      title: t("watchlist.title", { defaultValue: "Danh M\u00DAc Theo D\u00F5i" }),
      description: undefined,
    },
    createElement(
      "div",
      { className: "watchlistPage__layout" },
      createElement(WatchlistSidebar),
      createElement(WatchlistMainWorkspace)
    ),
    // watchlist-mount: manual theo scope (khong account) + derived khi co
    // brokerAccountId (o day null nen chi manual). Chi mount, 0 sua DATA.
    createElement(ScopedWatchlist),
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
