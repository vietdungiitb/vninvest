import { describe, it, expect } from "vitest";
import { mergeScreenerConfigPayload } from "../soc/SocScreenerPanel.js";
import { formatScreenerTimestamp } from "../soc/SocScreenerPanel.js";
import { formatScreenerAlertMessage } from "../soc/SocScreenerPanel.js";
import { resolveScreenerConfigSource } from "../soc/SocScreenerConfigForm.js";

// SC-02: saving the 5-field form must not wipe rules/flags.
// SC-05: the form must read values from the normalized envelope.
describe("SocScreenerPanel config helpers (SC-02/SC-05)", () => {
  it("SC-02: merge preserves rules + flags, edited scalars win", () => {
    const envelope = {
      id: 7,
      service_key: "screener_rule_engine",
      config_payload: {
        rules: [{ name: "R", type: "volume_spike_ratio", enabled: true, threshold: 2 }],
        enabled: false,
        scan_interval_seconds: 120,
        publish_to_redis: false,
        redis_channel_prefix: "x:",
      },
      config: { rules: [] },
    };
    const merged = mergeScreenerConfigPayload(envelope, { scan_interval_seconds: 60 });
    expect((merged as any).rules).toHaveLength(1);
    expect((merged as any).enabled).toBe(false);
    expect((merged as any).publish_to_redis).toBe(false);
    expect((merged as any).scan_interval_seconds).toBe(60);
  });

  it("SC-02: merge with empty envelope returns edited only", () => {
    const merged = mergeScreenerConfigPayload(null, { scan_interval_seconds: 60 });
    expect(merged).toEqual({ scan_interval_seconds: 60 });
  });

  it("SC-05: source resolves from config_payload", () => {
    const src = resolveScreenerConfigSource({
      config_payload: { scan_interval_seconds: 120, max_symbols_per_scan: 500 },
    } as any);
    expect(src.scan_interval_seconds).toBe(120);
    expect(src.max_symbols_per_scan).toBe(500);
  });

  it("SC-05: source falls back to flat payload", () => {
    const src = resolveScreenerConfigSource({ scan_interval_seconds: 90 } as any);
    expect(src.scan_interval_seconds).toBe(90);
  });

  it("SC-14: timestamp formats date + HH:MM, tolerates plain dates", () => {
    expect(formatScreenerTimestamp("2026-09-20T14:05:33")).toBe("2026-09-20 14:05");
    expect(formatScreenerTimestamp("2026-09-20")).toBe("2026-09-20");
    expect(formatScreenerTimestamp(null)).toBe("");
    expect(formatScreenerTimestamp(undefined)).toBe("");
  });

  it("UI-PRO: alert message strips duplicated leading symbol", () => {
    expect(formatScreenerAlertMessage("VRE", "VRE: something")).toBe("something");
    expect(formatScreenerAlertMessage("VRE", "vre: something")).toBe("something");
    expect(formatScreenerAlertMessage("VRE", "Biến động VRE: 1.18")).toBe("Biến động VRE: 1.18");
    expect(formatScreenerAlertMessage("VRE", null)).toBe("");
    expect(formatScreenerAlertMessage("", "plain")).toBe("plain");
  });
});
