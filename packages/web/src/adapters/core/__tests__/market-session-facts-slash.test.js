import { jest } from '@jest/globals';
import { createMarketClient } from "../market.js";

// F-07 (PEER_REVIEW_20261121): FE goi `/session-facts/VIC/cvd?window=1h`
// thieu trailing slash trong khi BE route co slash
// (`core-route-manifest.json` co `/core/v1/session-facts/<str:symbol>/cvd/`)
// => Django APPEND_SLASH tra 301, mat 8.7s moi request.
describe("market adapter - session facts trailing slash (F-07)", () => {
  it("getSessionFactsCvd requests the slash-terminated route (no 301)", async () => {
    const coreGet = jest.fn().mockResolvedValue({ data: [] });
    const client = createMarketClient({ coreGet });

    await client.getSessionFactsCvd("VIC", { window: "1h" });

    expect(coreGet).toHaveBeenCalledWith("/session-facts/VIC/cvd/?window=1h");
  });

  it("uppercase-normalizes the symbol like other market methods", async () => {
    const coreGet = jest.fn().mockResolvedValue({ data: [] });
    const client = createMarketClient({ coreGet });

    await client.getSessionFactsCvd("vic", { window: "1h" });

    expect(coreGet).toHaveBeenCalledWith("/session-facts/VIC/cvd/?window=1h");
  });
});
