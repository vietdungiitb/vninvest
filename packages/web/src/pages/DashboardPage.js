/**
 * SM-P4.3 — DashboardPage
 * Trang tổng quan chính, hiển thị danh mục và watchlist từ core API.
 * Không dùng JSX — tuân theo convention packages/web (createElement).
 */
import { createElement, useEffect, useRef, useState } from "react";

import { coreApiAdapter } from "../adapters/coreApiAdapter.js";

const DEFAULT_ENV = {};
const e = createElement;

function useCoreDashboard({ env = DEFAULT_ENV } = {}) {
  const [state, setState] = useState({ loading: true, error: null, portfolios: [], watchlists: [], profile: null });
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    async function load() {
      try {
        const adapter = coreApiAdapter({ env });
        const [portfoliosRes, watchlistsRes, profileRes] = await Promise.all([
          adapter.getPortfolios(),
          adapter.getWatchlists(),
          adapter.getUserProfile(),
        ]);
        if (!mountedRef.current) return;
        setState({
          loading: false, error: null,
          portfolios: portfoliosRes?.results ?? portfoliosRes ?? [],
          watchlists: watchlistsRes?.results ?? watchlistsRes ?? [],
          profile: profileRes ?? null,
        });
      } catch (err) {
        if (!mountedRef.current) return;
        setState((s) => ({ ...s, loading: false, error: err?.message || "Không thể tải dữ liệu tổng quan." }));
      }
    }
    load();
    return () => { mountedRef.current = false; };
  }, [env]);

  return state;
}

export function DashboardPage({ env = DEFAULT_ENV, className = "" }) {
  const { loading, error, portfolios, watchlists, profile } = useCoreDashboard({ env });

  if (loading) return e("div", { className: "core-dashboard-page " + className },
    e("p", { className: "core-loading" }, "Đang tải tổng quan…")
  );

  if (error) return e("div", { className: "core-dashboard-page " + className },
    e("p", { className: "core-error" }, error)
  );

  return e("div", { className: "core-dashboard-page " + className },
    e("header", { className: "core-dashboard-header" },
      e("h1", null, "Tổng quan"),
      profile ? e("span", { className: "core-dashboard-welcome" },
        "Xin chào, " + (profile.display_name || profile.username)
      ) : null
    ),
    e("section", { className: "core-dashboard-section" },
      e("h2", null, "Danh mục (" + portfolios.length + ")"),
      portfolios.length === 0
        ? e("p", { className: "core-empty" }, "Chưa có danh mục nào.")
        : e("ul", { className: "core-portfolio-list" },
            portfolios.map((p) =>
              e("li", { key: p.id ?? p.name, className: "core-portfolio-item" },
                e("span", { className: "core-portfolio-name" }, p.name),
                e("span", { className: "core-portfolio-currency" }, p.currency),
                e("span", { className: "core-portfolio-status core-status-" + p.status }, p.status)
              )
            )
          )
    ),
    e("section", { className: "core-dashboard-section" },
      e("h2", null, "Danh sách theo dõi (" + watchlists.length + ")"),
      watchlists.length === 0
        ? e("p", { className: "core-empty" }, "Chưa có danh sách theo dõi nào.")
        : e("ul", { className: "core-watchlist-list" },
            watchlists.map((w) =>
              e("li", { key: w.id ?? w.name, className: "core-watchlist-item" },
                e("span", { className: "core-watchlist-name" }, w.name)
              )
            )
          )
    )
  );
}
