import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { PortfoliosBrokerPage } from "../../PortfoliosBrokerPage.js";
import { BrokerHubPage } from "../BrokerHubPage.js";

/**
 * AC6 (B2.6): URL cũ `/portfolios/manage/broker` redirect về `/broker`.
 * Entry cũ giữ nguyên trong registry — component của nó là redirect thuần.
 */

afterEach(() => cleanup());

describe("Broker hub unification redirect (B2.6/AC6)", () => {
  it("redirects the legacy URL to /broker", async () => {
    render(
      <MemoryRouter initialEntries={["/portfolios/manage/broker"]}>
        <Routes>
          <Route path="/portfolios/manage/broker" element={<PortfoliosBrokerPage />} />
          <Route path="/broker" element={<div>broker-hub-landing</div>} />
        </Routes>
      </MemoryRouter>,
    );
    await waitFor(() => {
      expect(screen.getByText("broker-hub-landing")).toBeTruthy();
    });
  });

  it("keeps the legacy registry entry loadable (no dead reference)", async () => {
    const mod = await import("../../PortfoliosBrokerPage.js");
    expect(typeof mod.PortfoliosBrokerPage).toBe("function");
    expect(typeof BrokerHubPage).toBe("function");
  });
});
