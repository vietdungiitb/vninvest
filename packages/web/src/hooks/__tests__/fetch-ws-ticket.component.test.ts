import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * S6 (Entry 517): fetchWsTicket — lay ticket WS single-use 60s tu BE.
 * Khong lay raw PAT len URL WS => khong lo token trong access log.
 */
vi.mock("../../adapters/coreApiAdapter.js", () => ({
  coreApiAdapter: {
    corePost: vi.fn(async () => ({ ticket: "ws_ticket_abc", expiresIn: 60 })),
  },
}));

import { coreApiAdapter } from "../../adapters/coreApiAdapter.js";
import { fetchWsTicket } from "../useRealtimeFeedCore.js";

describe("fetchWsTicket (WS ticket, not raw PAT)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls POST /auth/ws-ticket/ with bearer token and returns ticket", async () => {
    const ticket = await fetchWsTicket("pat_xyz");
    expect(ticket).toBe("ws_ticket_abc");
    expect(coreApiAdapter.corePost).toHaveBeenCalledTimes(1);
    const [path, _body, opts] = (coreApiAdapter.corePost as any).mock.calls[0];
    expect(path).toBe("/auth/ws-ticket/");
    expect(opts.headers.Authorization).toBe("Bearer pat_xyz");
  });

  it("returns null when ticket missing", async () => {
    (coreApiAdapter.corePost as any).mockResolvedValueOnce({ json: async () => ({}) });
    const ticket = await fetchWsTicket("pat_xyz");
    expect(ticket).toBeNull();
  });

  it("returns null on network error", async () => {
    (coreApiAdapter.corePost as any).mockRejectedValueOnce(new Error("network"));
    const ticket = await fetchWsTicket("pat_xyz");
    expect(ticket).toBeNull();
  });
});
