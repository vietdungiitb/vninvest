/**
 * SmartStatsHeader — phai phan biet "0" voi "chua biet".
 *
 * Review doc lap vong 2 bat duoc mot P0 o FE: backend da dung tra
 * `total_market_value: null` khi co ma chua co gia phien hom nay (xem
 * `PortfolioSummaryView.unpriced_symbols`), nhung FE lai lam
 *
 *     const marketValue = Number(summary?.total_market_value) || 0;
 *     const isEmptyPortfolio = !loading && marketValue === 0 && !hasAnalytics;
 *
 * `Number(null) === 0` nen mot danh muc DAY VI THE THAT nhung thieu gia se
 * bi hien thi nhu danh muc TRONG, kem CTA "bat dau dau tu dau". Backend sua
 * xong loi "0 gia" o BE, FE lap tuc dua no vao lai.
 *
 * Bai test nay kiem HANH VI cua component, khong kiem source.
 */
import { render, screen } from "@testing-library/react";
import { createElement } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";

const t = (key, opts) => key;

vi.mock("../../context/LangContext.js", () => ({
  useI18n: () => ({ t, locale: "vi" }),
}));

vi.mock("../../utils/formatMarket.js", () => ({
  signOf: (v) => (v > 0 ? 1 : v < 0 ? -1 : 0),
  formatUpdateTime: () => "",
  formatTimeAgo: () => "",
}));

import { SmartStatsHeader } from "./SmartStatsHeader.js";

function renderHeader(summary) {
  return render(
    createElement(SmartStatsHeader, {
      summary,
      analytics: null,
      loading: false,
      className: "",
    }),
  );
}

describe("SmartStatsHeader — null khong phai la 0", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("total_market_value null thi KHONG hien danh muc trong", () => {
    renderHeader({ total_market_value: null, total_unrealized_pnl: null });

    // CTA danh muc trong phai xuat hien — day la hau qua cua bug.
    expect(screen.queryByText("smartStats.emptyCta")).toBeNull();
  });

  it("total_market_value null thi hien em dash, khong hien 0", () => {
    renderHeader({ total_market_value: null, total_unrealized_pnl: null });
    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(1);
  });

  it("total_market_value = '0.00' moi la danh muc trong THAT", () => {
    renderHeader({ total_market_value: "0.00", total_unrealized_pnl: "0.00" });
    expect(screen.queryByText("smartStats.emptyCta")).not.toBeNull();
  });

  it("gia tri that thi hien so, khong phai em dash", () => {
    renderHeader({
      total_market_value: "75000000.00",
      total_unrealized_pnl: "5000000.00",
      total_unrealized_pnl_pct: 7.14,
    });
    expect(screen.getByText("75.000.000")).not.toBeNull();
    expect(screen.getByText("+5.000.000")).not.toBeNull();
    expect(screen.getByText("7.14%")).not.toBeNull();
  });

  it("doc dung ten field total_unrealized_pnl, khong phai ..._pl", () => {
    // Ban cu doc `total_unrealized_pl` (thieu 'n') trong khi BE phat
    // `total_unrealized_pnl` => o lãi/lỗ luon hien 0. MOT con so gia lai.
    renderHeader({
      total_market_value: "1000.00",
      total_unrealized_pnl: "250.00",
      total_unrealized_pnl_pct: 25.0,
    });
    expect(screen.getByText("+250")).not.toBeNull();
  });
});
