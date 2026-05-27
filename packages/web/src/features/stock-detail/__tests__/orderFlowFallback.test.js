import { describe, expect, test } from "@jest/globals";

import { buildEffectiveOrderFlowData } from "../orderFlowFallback.js";

describe("buildEffectiveOrderFlowData", () => {
  test("uses whale snapshot CVD when session facts buckets are empty", () => {
    const result = buildEffectiveOrderFlowData({
      symbol: "TPB",
      fallbackWindow: "1h",
      orderFlowPayload: {
        symbol: "TPB",
        window: "1h",
        dark_flow: { signal_type: "dark_flow", strength: 100 },
      },
      sessionFactsCvdPayload: {
        symbol: "TPB",
        window: "1h",
        session_date: "2026-05-27",
        cvd_series: [],
      },
      whaleSnapshotPayload: {
        symbol: "TPB",
        timeframe: "1h",
        materialization: { read_path: "canonical_fallback" },
        flow_series: {
          cvd: [
            { bucket_ts: "2026-05-27T09:00:00+07:00", value: 1200 },
            { bucket_ts: "2026-05-27T10:00:00+07:00", value: 1800 },
          ],
        },
      },
    });

    expect(result._cvd_source).toBe("whale-analytics-fallback");
    expect(result._cvd_materialization).toBe("canonical_fallback");
    expect(result.cvd_series).toHaveLength(2);
    expect(result.cvd_series[0]).toMatchObject({
      bucket_ts: "2026-05-27T09:00:00+07:00",
      cumulative_cvd: 1200,
    });
  });

  test("keeps session facts CVD when buckets already exist", () => {
    const result = buildEffectiveOrderFlowData({
      symbol: "TPB",
      fallbackWindow: "1h",
      orderFlowPayload: {
        symbol: "TPB",
        window: "1h",
      },
      sessionFactsCvdPayload: {
        symbol: "TPB",
        window: "1h",
        cvd_series: [{ bucket_ts: "2026-05-27T09:00:00+07:00", cumulative_cvd: 400 }],
      },
      whaleSnapshotPayload: {
        symbol: "TPB",
        flow_series: {
          cvd: [{ bucket_ts: "2026-05-27T09:00:00+07:00", value: 1200 }],
        },
      },
    });

    expect(result._cvd_source).toBe("whale-ssot");
    expect(result.cvd_series).toEqual([
      { bucket_ts: "2026-05-27T09:00:00+07:00", cumulative_cvd: 400 },
    ]);
  });
});