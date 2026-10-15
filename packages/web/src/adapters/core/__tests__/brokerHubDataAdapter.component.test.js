/**
 * mbw2-data — TDD fail-before cho +10 adapter broker hub (§2 contract).
 *
 * Quy ước stub: `vi.fn` trả fixture thật (L-V02: không đoán shape BE —
 * shape lấy từ `views_broker.py` `_serialize_sub_account`/`_position_to_dict`/
 * `_balance_to_dict`/`_order_to_dict`/sync 202/runs/issues/bindings).
 * KHÔNG mock MagicMock vào response.
 */
import { describe, expect, test, vi } from "vitest";
import { createBrokerClient } from "../broker.js";

function makeCore() {
  const calls = [];
  const core = {
    calls,
    coreGet: vi.fn(async (path) => {
      calls.push(["GET", path]);
      return { data: [] };
    }),
    corePost: vi.fn(async (path, body) => {
      calls.push(["POST", path, body]);
      return { ok: true };
    }),
    corePatch: vi.fn(async (path, body) => {
      calls.push(["PATCH", path, body]);
      return { ok: true };
    }),
    coreDelete: vi.fn(async (path) => {
      calls.push(["DELETE", path]);
      return null;
    }),
  };
  return core;
}

describe("broker hub data adapter (mbw2-data, contract §2)", () => {
  test("getBrokerAccounts -> GET /broker/accounts/", async () => {
    const core = makeCore();
    await createBrokerClient(core).getBrokerAccounts();
    expect(core.coreGet).toHaveBeenCalledWith("/broker/accounts/");
  });

  test("getBrokerAccount(id) -> GET /broker/accounts/<id>/", async () => {
    const core = makeCore();
    await createBrokerClient(core).getBrokerAccount(7);
    expect(core.coreGet).toHaveBeenCalledWith("/broker/accounts/7/");
  });

  test("getBrokerAccount() thieu id thi throw (fail-closed)", async () => {
    const core = makeCore();
    expect(() => createBrokerClient(core).getBrokerAccount()).toThrow();
    expect(core.coreGet).not.toHaveBeenCalled();
  });

  test("getAccountPositions -> GET .../positions/", async () => {
    const core = makeCore();
    await createBrokerClient(core).getAccountPositions(7);
    expect(core.coreGet).toHaveBeenCalledWith("/broker/accounts/7/positions/");
  });

  test("getAccountBalance -> GET .../balance/", async () => {
    const core = makeCore();
    await createBrokerClient(core).getAccountBalance(7);
    expect(core.coreGet).toHaveBeenCalledWith("/broker/accounts/7/balance/");
  });

  test("getAccountOrders -> GET .../orders/", async () => {
    const core = makeCore();
    await createBrokerClient(core).getAccountOrders(7);
    expect(core.coreGet).toHaveBeenCalledWith("/broker/accounts/7/orders/");
  });

  test("syncBrokerAccount -> POST .../sync/ (BE tra 202 + job_id)", async () => {
    const core = makeCore();
    core.corePost.mockResolvedValueOnce({ ok: true, job_id: "job-1", state: "pending" });
    const out = await createBrokerClient(core).syncBrokerAccount(7);
    expect(core.corePost).toHaveBeenCalledWith("/broker/accounts/7/sync/");
    expect(out.job_id).toBe("job-1");
  });

  test("getBrokerSyncRuns limit mac dinh + tuy chinh", async () => {
    const core = makeCore();
    await createBrokerClient(core).getBrokerSyncRuns();
    expect(core.coreGet).toHaveBeenCalledWith("/broker/sync-runs/?limit=20");
    await createBrokerClient(core).getBrokerSyncRuns({ limit: 5 });
    expect(core.coreGet).toHaveBeenCalledWith("/broker/sync-runs/?limit=5");
  });

  test("getBrokerSyncIssues loc resolved/severity", async () => {
    const core = makeCore();
    await createBrokerClient(core).getBrokerSyncIssues({ resolved: false, severity: "warning" });
    expect(core.coreGet).toHaveBeenCalledWith("/broker/sync-issues/?resolved=false&severity=warning");
  });

  test("getPortfolioBindings -> GET .../broker-bindings/", async () => {
    const core = makeCore();
    await createBrokerClient(core).getPortfolioBindings(3);
    expect(core.coreGet).toHaveBeenCalledWith("/workspace/portfolios/3/broker-bindings/");
  });

  test("savePortfolioBindings -> PATCH .../broker-bindings/ voi action", async () => {
    const core = makeCore();
    await createBrokerClient(core).savePortfolioBindings(3, { action: "add", sub_account_id: 9 });
    expect(core.corePatch).toHaveBeenCalledWith("/workspace/portfolios/3/broker-bindings/", {
      action: "add",
      sub_account_id: 9,
    });
  });

  test("savePortfolioBindings thieu corePatch thi throw ro rang (khong goi POST gia)", async () => {
    const core = makeCore();
    const { corePatch, ...noPatch } = core;
    void corePatch;
    expect(() =>
      createBrokerClient(noPatch).savePortfolioBindings(3, { action: "add", sub_account_id: 9 }),
    ).toThrow(/corePatch/i);
    expect(core.corePost).not.toHaveBeenCalled();
  });
});
