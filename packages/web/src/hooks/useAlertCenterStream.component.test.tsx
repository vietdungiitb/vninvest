import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, act, cleanup } from "@testing-library/react";
import {
  getAlertCenterStreamUrl,
  mapAlertCenterStreamItem,
  useAlertCenterStream,
  ALERT_CENTER_STREAM_PATH,
} from "./useAlertCenterStream.js";

let instances: any[] = [];

class MockEventSource {
  url: string;
  close = vi.fn();
  addEventListener = vi.fn((event: string, cb: EventListener) => {
    (this as any)[`_cb_${event}`] = cb;
  });
  onopen: any = null;
  onmessage: any = null;
  onerror: any = null;

  constructor(url: string) {
    this.url = url;
    instances.push(this);
  }
}

function TestComponent(props: { enabled: boolean; onItem?: (s: unknown) => void }) {
  const { status } = useAlertCenterStream({
    enabled: props.enabled,
    query: { lane: "main" },
    onItem: (props.onItem ?? (() => {})) as any,
  });
  return <span data-testid="status">{status}</span>;
}

describe("useAlertCenterStream — S7", () => {
  const originalES = (globalThis as any).EventSource;

  beforeEach(() => {
    instances = [];
    (globalThis as any).EventSource = MockEventSource;
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    (globalThis as any).EventSource = originalES;
    instances = [];
  });

  it("URL tro toi alert-center stream + lane", () => {
    const url = getAlertCenterStreamUrl({ lane: "main", symbol: "VCI" }, 42);
    expect(url).toContain(ALERT_CENTER_STREAM_PATH);
    expect(url).toContain("lane=main");
    expect(url).toContain("symbol=VCI");
    expect(url).toContain("since=42");
  });

  it("map full payload giu alert_id/body/confidence", () => {
    const mapped = mapAlertCenterStreamItem({
      id: 7, alert_id: "uuid-1", type: "price_shock", lane: "main", symbol: "FPT",
      severity: "medium", confidence: 0.85, title: "Bien dong", body: "Body",
      value: 7.5, direction: "sell", triggered_at: "2026-09-18T10:00:00Z",
      source_ref: "market_anomaly:demo:x", metadata: {}, evidence: {},
    });
    expect(mapped?.alert_id).toBe("uuid-1");
    expect(mapped?.alert_family).toBe("price_shock");
    expect(mapped?.body).toBe("Body");
    expect(mapped?.confidence).toBe(0.85);
    expect(mapped?.triggered_at).toBe("2026-09-18T10:00:00Z");
  });

  it("hook lang nghe event alert-center (khong phai signal)", async () => {
    const onItem = vi.fn();
    const { getByTestId } = render(<TestComponent enabled onItem={onItem} />);
    const es = instances[0] as MockEventSource;
    expect(es.url).toContain(ALERT_CENTER_STREAM_PATH);
    await act(async () => {
      if (es.onopen) es.onopen(new Event("open"));
    });
    expect(getByTestId("status").textContent).toBe("open");
    await act(async () => {
      const cb = (es as any)["_cb_alert-center"];
      expect(cb).toBeTruthy();
      cb(new MessageEvent("alert-center", {
        data: JSON.stringify({
          id: 8, alert_id: "uuid-2", type: "whale", symbol: "VCI",
          severity: "high", detected_at: "2026-09-18T11:00:00Z",
          triggered_at: "2026-09-18T11:00:00Z",
          title: "Whale", value: 1000, direction: "buy",
        }),
      }));
    });
    expect(onItem).toHaveBeenCalledWith(expect.objectContaining({ alert_id: "uuid-2", symbol: "VCI" }));
  });
});
