import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { createElement } from "react";
import { AdvisoryBacktestPanel } from "../advisory/AdvisoryBacktestPanel.js";

describe("AdvisoryBacktestPanel (S12)", () => {
  it("renders hit-rate + avgs + N when enough data", async () => {
    render(
      createElement(AdvisoryBacktestPanel, {
        symbol: "FPT",
        fetchBacktest: vi.fn(async () => ({
          symbol: "FPT",
          window_days: 30,
          n_samples: 6,
          enough_data: true,
          hit_rate: 0.6667,
          hit_rate_t1: 0.5,
          hit_rate_t3: 0.6667,
          hit_rate_t5: 0.6667,
          avg_return_t1: 0.0123,
          avg_return_t3: 0.0234,
          avg_return_t5: -0.0045,
          samples: [],
        })),
      }),
    );
    expect(await screen.findByText("+66.67%")).toBeTruthy();
    expect(screen.getByText("6")).toBeTruthy();
    expect(screen.getByText("+1.23%")).toBeTruthy();
  });

  it("renders honest empty when not enough samples", async () => {
    render(
      createElement(AdvisoryBacktestPanel, {
        symbol: "FPT",
        fetchBacktest: vi.fn(async () => ({
          symbol: "FPT",
          window_days: 30,
          n_samples: 2,
          enough_data: false,
          hit_rate: null,
          avg_return_t1: null,
          avg_return_t3: null,
          avg_return_t5: null,
          samples: [],
        })),
      }),
    );
    expect(await screen.findByText(/Chưa đủ mẫu/)).toBeTruthy();
  });
});
