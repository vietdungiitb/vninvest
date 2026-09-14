import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { createElement } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("../../../context/LangContext.js", () => ({
  useI18n: () => ({
    t: (key: string, opts?: any) => opts?.defaultValue ?? key,
    formatNumber: (n: unknown) => String(n),
  }),
}));

const mocks = vi.hoisted(() => ({
  getScreenerPublicRules: vi.fn(),
  forkScreenerRule: vi.fn(),
}));

vi.mock("../../../adapters/coreApiAdapter.js", () => ({
  coreApiAdapter: {
    getScreenerPublicRules: (...args: any[]) => mocks.getScreenerPublicRules(...args),
    forkScreenerRule: (...args: any[]) => mocks.forkScreenerRule(...args),
  },
}));

import { ScreenerCommunity } from "../ScreenerCommunity.js";

function renderCommunity(props: any = {}) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const merged = {
    onForkRun: vi.fn(async () => {}),
    onFork: vi.fn(async () => {}),
    ...props,
  };
  render(createElement(QueryClientProvider, { client: qc }, createElement(ScreenerCommunity, merged)));
  return merged;
}

describe("ScreenerCommunity (W8 P3 preset cộng đồng)", () => {
  it("renders empty state when no shared presets", async () => {
    mocks.getScreenerPublicRules.mockResolvedValue([]);
    renderCommunity();
    await waitFor(() => expect(screen.getByText("Chưa có preset", { exact: false })).toBeTruthy());
  });

  it("lists public rules with owner and fork actions", async () => {
    mocks.getScreenerPublicRules.mockResolvedValue([
      { id: 7, name: "SharedAlpha", rules_json: [{ field: "close", op: "gt", value: 5 }], owner_username: "alice", is_public: true },
    ]);
    renderCommunity();
    await waitFor(() => expect(screen.getByText("SharedAlpha")).toBeTruthy());
    expect(screen.getAllByRole("button", { name: "fork-run" })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: "fork-only" })).toHaveLength(1);
  });

  it("fork-only calls API then onFork with the created copy", async () => {
    mocks.getScreenerPublicRules.mockResolvedValue([
      { id: 7, name: "SharedAlpha", rules_json: [], owner_username: "alice", is_public: true },
    ]);
    const created = { id: 9, name: "SharedAlpha (bản sao)", rules_json: [] };
    mocks.forkScreenerRule.mockResolvedValue(created);
    const props = renderCommunity();
    await waitFor(() => expect(screen.getByText("SharedAlpha")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "fork-only" }));
    await waitFor(() => expect(mocks.forkScreenerRule).toHaveBeenCalledWith(7));
    await waitFor(() => expect(props.onFork).toHaveBeenCalledWith(created));
  });

  it("fork-run calls API then onForkRun with the created copy", async () => {
    mocks.getScreenerPublicRules.mockResolvedValue([
      { id: 7, name: "SharedAlpha", rules_json: [], owner_username: "alice", is_public: true },
    ]);
    const created = { id: 10, name: "SharedAlpha (bản sao)", rules_json: [] };
    mocks.forkScreenerRule.mockResolvedValue(created);
    const props = renderCommunity();
    await waitFor(() => expect(screen.getByText("SharedAlpha")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "fork-run" }));
    await waitFor(() => expect(mocks.forkScreenerRule).toHaveBeenCalledWith(7));
    await waitFor(() => expect(props.onForkRun).toHaveBeenCalledWith(created));
  });
});
