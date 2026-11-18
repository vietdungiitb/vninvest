import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";

const h = vi.hoisted(() => ({ navigate: vi.fn() }));

vi.mock("react-router-dom", () => ({ useNavigate: () => h.navigate }));
vi.mock("../../../context/LangContext.js", () => ({
  useI18n: () => ({ t: (key: string) => key, locale: "vi", setLanguage: vi.fn() }),
}));

import { SmartStatsHeader } from "../SmartStatsHeader.js";

function renderHeader() {
  return render(
    <SmartStatsHeader
      summary={{ total_market_value: 0 }}
      analytics={null}
      metrics={null}
      holdings={[]}
      loading={false}
      realtimeBreadth={{ up: 0, down: 0, flat: 0 }}
      onRefresh={vi.fn()}
    />,
  );
}

describe("P0-4 — CTA trên SmartStatsHeader phải điều hướng thật", () => {
  afterEach(() => {
    cleanup();
    h.navigate.mockReset();
  });

  it('"Tạo danh mục" → /portfolios/manage', () => {
    renderHeader();
    fireEvent.click(screen.getByText("smartStats.createPortfolio"));
    expect(h.navigate).toHaveBeenCalledWith("/portfolios/manage");
  });

  it('"Kết nối Paper Trading" → /broker', () => {
    renderHeader();
    fireEvent.click(screen.getByText("smartStats.connectPaper"));
    expect(h.navigate).toHaveBeenCalledWith("/broker");
  });

  it("KHÔNG gọi onRefresh khi bấm CTA", () => {
    const onRefresh = vi.fn();
    render(
      <SmartStatsHeader
        summary={{ total_market_value: 0 }}
        analytics={null}
        metrics={null}
        holdings={[]}
        loading={false}
        realtimeBreadth={{ up: 0, down: 0, flat: 0 }}
        onRefresh={onRefresh}
      />,
    );
    fireEvent.click(screen.getByText("smartStats.createPortfolio"));
    expect(onRefresh).not.toHaveBeenCalled();
  });
});
