import { describe, it, expect, vi, beforeEach } from "vitest";
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
  getScreenerSchedules: vi.fn(),
  getScreenerScheduleAlerts: vi.fn(),
  createScreenerSchedule: vi.fn(),
  updateScreenerSchedule: vi.fn(),
  deleteScreenerSchedule: vi.fn(),
  runScreenerScheduleNow: vi.fn(),
}));

vi.mock("../../../adapters/coreApiAdapter.js", () => ({
  coreApiAdapter: {
    getScreenerSchedules: (...args: any[]) => mocks.getScreenerSchedules(...args),
    getScreenerScheduleAlerts: (...args: any[]) => mocks.getScreenerScheduleAlerts(...args),
    createScreenerSchedule: (...args: any[]) => mocks.createScreenerSchedule(...args),
    updateScreenerSchedule: (...args: any[]) => mocks.updateScreenerSchedule(...args),
    deleteScreenerSchedule: (...args: any[]) => mocks.deleteScreenerSchedule(...args),
    runScreenerScheduleNow: (...args: any[]) => mocks.runScreenerScheduleNow(...args),
  },
}));

import { ScreenerSchedulePanel } from "../ScreenerSchedulePanel.js";

function renderPanel(rules: any[] = [{ id: 1, name: "R1", rules_json: [] }]) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(createElement(QueryClientProvider, { client: qc }, createElement(ScreenerSchedulePanel, { rules } as any)));
}

describe("ScreenerSchedulePanel (P2.4)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  it("renders empty state and creates a schedule", async () => {
    mocks.getScreenerSchedules.mockResolvedValue([]);
    mocks.getScreenerScheduleAlerts.mockResolvedValue({ results: [] });
    mocks.createScreenerSchedule.mockResolvedValue({ id: 9, name: "Evening", rule_ids: [1], run_time: "18:00" });
    renderPanel();
    await waitFor(() => expect(screen.getByText("screener.schedule.title")).toBeTruthy());
    // Fill name + pick rule
    const inputs = screen.getAllByRole("textbox");
    fireEvent.change(inputs[0], { target: { value: "Evening" } });
    const selects = document.querySelectorAll("select");
    fireEvent.change(selects[0], { target: { value: "1" } });
    fireEvent.click(screen.getByText("screener.schedule.create"));
    await waitFor(() => expect(mocks.createScreenerSchedule).toHaveBeenCalledTimes(1));
    expect(mocks.createScreenerSchedule.mock.calls[0][0]).toMatchObject({ name: "Evening", rule_ids: [1], run_time: "18:00" });
  });

  it("renders schedules list with toggle/run/delete and alerts", async () => {    mocks.getScreenerSchedules.mockResolvedValue([
      { id: 3, name: "Evening", rule_ids: [1], run_time: "18:00", weekdays: [0, 1, 2, 3, 4], is_active: true, notify_channels: ["in_app"], last_run_at: null, next_run_at: "2026-09-14T18:00:00" },
    ]);
    mocks.getScreenerScheduleAlerts.mockResolvedValue({
      results: [{ rule_id: 1, rule_name: "R1", run_at: "2026-09-13", new_symbols: ["AAA", "BBB"], matched_count: 2, job_id: "x" }],
    });
    mocks.updateScreenerSchedule.mockResolvedValue({});
    mocks.runScreenerScheduleNow.mockResolvedValue({ jobs: [] });
    mocks.deleteScreenerSchedule.mockResolvedValue({});
    renderPanel();
    await waitFor(() => expect(screen.getByText("Evening · 18:00", { exact: false })).toBeTruthy());
    expect(screen.getByText("+2 mã mới", { exact: false })).toBeTruthy();
    fireEvent.click(screen.getByText("screener.schedule.disable"));
    await waitFor(() => expect(mocks.updateScreenerSchedule).toHaveBeenCalledWith(3, { is_active: false }));
    fireEvent.click(screen.getByText("screener.schedule.runNow"));
    await waitFor(() => expect(mocks.runScreenerScheduleNow).toHaveBeenCalledWith(3));
  });

  it("UE-06: create sends selected weekdays + channels", async () => {
    mocks.getScreenerSchedules.mockResolvedValue([]);
    mocks.getScreenerScheduleAlerts.mockResolvedValue({ results: [] });
    mocks.createScreenerSchedule.mockResolvedValue({ id: 10 });
    renderPanel();
    await waitFor(() => expect(screen.getByText("screener.schedule.title")).toBeTruthy());
    const inputs = screen.getAllByRole("textbox");
    fireEvent.change(inputs[0], { target: { value: "Morning" } });
    const selects = document.querySelectorAll("select");
    fireEvent.change(selects[0], { target: { value: "1" } });
    // Toggle Saturday on (default Mon–Fri) + enable email channel.
    const buttons = screen.getAllByRole("button");
    const createBtn = buttons.find((b) => b.textContent === "screener.schedule.create");
    const dayBtns = buttons.filter((b) => b !== createBtn);
    expect(dayBtns).toHaveLength(7);
    fireEvent.click(dayBtns[5]);
    const checkboxes = screen.getAllByRole("checkbox");
    expect(checkboxes).toHaveLength(2);
    fireEvent.click(checkboxes[1]);
    fireEvent.click(createBtn!);
    await waitFor(() => expect(mocks.createScreenerSchedule).toHaveBeenCalledTimes(1));
    expect(mocks.createScreenerSchedule.mock.calls[0][0]).toMatchObject({
      name: "Morning",
      rule_ids: [1],
      weekdays: [0, 1, 2, 3, 4, 5],
      notify_channels: ["in_app", "email"],
    });
  });
});
