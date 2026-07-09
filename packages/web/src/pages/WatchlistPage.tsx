import { createElement, useEffect } from "react";
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

  useEffect(() => {
    if (autoLoad) {
      loadAllLists(true);
      fetchPriceAlertsList();
    }
  }, [autoLoad]);

  return createElement(
    ShellPageChrome,
    {
      eyebrow: t("watchlist.eyebrow", { defaultValue: "Rada Thị Trường" }),
      title: t("watchlist.title", { defaultValue: "Danh Mục Theo Dõi" }),
      description: t("watchlist.description", { defaultValue: "Theo dõi biến động giá cổ phiếu, rsi, rvol và xu hướng thị trường." }),
    },
    createElement(
      "div",
      {
        className: "watchlistPage__container",
        style: {
          display: "grid",
          gridTemplateColumns: "300px 1fr 340px",
          gap: "1.5rem",
          height: "calc(100vh - 200px)",
          alignItems: "stretch",
          overflow: "hidden"
        }
      },
      createElement(WatchlistSidebar),
      createElement(WatchlistMainWorkspace),
      createElement(WatchlistDetailPanel)
    )
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
