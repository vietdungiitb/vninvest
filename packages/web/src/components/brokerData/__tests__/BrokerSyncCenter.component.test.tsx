/**
 * mbw2-data B2.4 — TDD fail-before cho BrokerSyncCenter.
 *
 * AC4: bấm Đồng bộ ⇒ POST sync trả 202 + job_id ⇒ poll `jobs/<id>/` tới trạng
 * thái cuối ⇒ Sync Center hiện run mới trong `sync-runs/`.
 */
import { describe, expect, test, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { LangProvider } from "../../../context/LangContext";
import { PortfolioProvider } from "../../../context/PortfolioContext";
import { BrokerSyncCenter } from "../BrokerSyncCenter";

const RUNS = [
  { id: 11, provider: "dnse", status: "succeeded", started_at: "2026-10-15T01:00:00Z", finished_at: "2026-10-15T01:01:00Z", stats: {}, error: null },
];

const ISSUES = [
  { id: 21, severity: "warning", code: "position_drift", payload: {}, resolved: false, created_at: "2026-10-15T01:02:00Z" },
];

function makeAdapter() {
  return {
    syncBrokerAccount: vi.fn(async () => ({ ok: true, job_id: "job-1", state: "pending" })),
    getBrokerJob: vi.fn(async () => ({ job_id: "job-1", state: "pending" })),
    getBrokerSyncRuns: vi.fn(async () => RUNS),
    getBrokerSyncIssues: vi.fn(async () => ISSUES),
  };
}

function wrap(node) {
  return render(
    <MemoryRouter initialEntries={["/broker"]}>
      <PortfolioProvider>
        <LangProvider>{node}</LangProvider>
      </PortfolioProvider>
    </MemoryRouter>,
  );
}

describe("BrokerSyncCenter (B2.4)", () => {
  beforeEach(() => cleanup());
  afterEach(() => vi.clearAllMocks());

  test("hien runs + issues tu fixture that", async () => {
    wrap(<BrokerSyncCenter adapter={makeAdapter()} />);
    expect(await screen.findByText("position_drift")).toBeTruthy();
    expect(screen.getByText(/Lịch sử đồng bộ/)).toBeTruthy();
    expect(screen.getByText(/Lệch cần xử lý/)).toBeTruthy();
  });

  test("bam Dong bo ⇒ 202 job_id ⇒ poll toi succeeded ⇒ refetch runs", async () => {
    const adapter = makeAdapter();
    adapter.getBrokerJob
      .mockResolvedValueOnce({ job_id: "job-1", state: "pending" })
      .mockResolvedValueOnce({ job_id: "job-1", state: "succeeded", result: {} });
    wrap(<BrokerSyncCenter accountId={7} adapter={adapter} pollIntervalMs={10} />);
    await screen.findByText("position_drift");
    fireEvent.click(screen.getByRole("button", { name: /Đồng bộ ngay/ }));
    await waitFor(() => expect(adapter.syncBrokerAccount).toHaveBeenCalledWith(7), { timeout: 3000 });
    await waitFor(() => expect(adapter.getBrokerJob).toHaveBeenCalledWith("job-1"), { timeout: 3000 });
    await waitFor(() => expect(adapter.getBrokerSyncRuns.mock.calls.length).toBeGreaterThanOrEqual(2), { timeout: 5000 });
  });

  test("account unlinked ⇒ khong goi sync, hien thong bao (0 POST)", async () => {
    const adapter = makeAdapter();
    adapter.syncBrokerAccount.mockRejectedValueOnce({ code: "account_not_linked" });
    wrap(<BrokerSyncCenter accountId={8} adapter={adapter} pollIntervalMs={10} />);
    await screen.findByText("position_drift");
    fireEvent.click(screen.getByRole("button", { name: /Đồng bộ ngay/ }));
    await waitFor(() => expect(adapter.syncBrokerAccount).toHaveBeenCalledWith(8), { timeout: 3000 });
    expect(await screen.findByText(/chưa liên kết/i)).toBeTruthy();
    expect(adapter.getBrokerJob).not.toHaveBeenCalled();
  });
});
