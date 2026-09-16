import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, act, cleanup } from "@testing-library/react";
import { useSignalStream } from "./useSignalStream.js";

// Mock EventSource
type MockESInstance = {
  url: string;
  close: ReturnType<typeof vi.fn>;
  addEventListener: ReturnType<typeof vi.fn>;
  onopen: ((e: Event) => void) | null;
  onmessage: ((e: MessageEvent) => void) | null;
  onerror: ((e: Event) => void) | null;
  triggerOpen: () => void;
  triggerSignal: (data: Record<string, unknown>, id?: string) => void;
  triggerError: () => void;
};

let instances: MockESInstance[] = [];

class MockEventSource {
  url: string;
  close = vi.fn();
  addEventListener = vi.fn((event: string, cb: EventListener) => {
    // store for manual trigger via instances array
    (this as unknown as Record<string, unknown>)[`_cb_${event}`] = cb;
  });
  onopen: ((e: Event) => void) | null = null;
  onmessage: ((e: MessageEvent) => void) | null = null;
  onerror: ((e: Event) => void) | null = null;

  constructor(url: string) {
    this.url = url;
    const inst: MockESInstance = {
      url,
      close: this.close,
      addEventListener: this.addEventListener,
      get onopen() { return (this as unknown as MockEventSource).onopen; },
      set onopen(v) { (this as unknown as MockEventSource).onopen = v; },
      get onmessage() { return (this as unknown as MockEventSource).onmessage; },
      set onmessage(v) { (this as unknown as MockEventSource).onmessage = v; },
      get onerror() { return (this as unknown as MockEventSource).onerror; },
      set onerror(v) { (this as unknown as MockEventSource).onerror = v; },
      triggerOpen: () => {},
      triggerSignal: () => {},
      triggerError: () => {},
    };
    // Provide helpers bound to this
    const self = this;
    (inst as unknown as Record<string, unknown>).triggerOpen = () => {
      if (self.onopen) self.onopen(new Event("open"));
    };
    (inst as unknown as Record<string, unknown>).triggerSignal = (data: Record<string, unknown>, id = "1") => {
      const cb = (self as unknown as Record<string, unknown>)[`_cb_signal`] as ((e: MessageEvent) => void) | undefined;
      const ev = new MessageEvent("signal", { data: JSON.stringify(data) });
      Object.defineProperty(ev, "lastEventId", { value: id });
      if (cb) cb(ev);
      else if (self.onmessage) self.onmessage(ev);
    };
    (inst as unknown as Record<string, unknown>).triggerError = () => {
      if (self.onerror) self.onerror(new Event("error"));
    };
    instances.push(inst as unknown as MockESInstance);
    // attach helpers to the MockEventSource instance for test access
    (this as unknown as Record<string, unknown>).triggerOpen = (inst as unknown as Record<string, unknown>).triggerOpen;
    (this as unknown as Record<string, unknown>).triggerSignal = (inst as unknown as Record<string, unknown>).triggerSignal;
    (this as unknown as Record<string, unknown>).triggerError = (inst as unknown as Record<string, unknown>).triggerError;
  }
}

function TestComponent(props: { enabled: boolean; query?: Record<string, string>; onSignal?: (s: unknown) => void }) {
  const { enabled, query, onSignal } = props;
  const { status, reconnectAttempt } = useSignalStream({ enabled, query, onSignal: onSignal ?? (() => {}) });
  return (
    <div>
      <span data-testid="status">{status}</span>
      <span data-testid="attempt">{reconnectAttempt}</span>
    </div>
  );
}

describe("useSignalStream — P2c SSE hook", () => {
  const originalES = globalThis.EventSource;

  beforeEach(() => {
    instances = [];
    vi.useFakeTimers({ shouldAdvanceTime: true });
    // @ts-ignore
    globalThis.EventSource = MockEventSource as unknown as typeof EventSource;
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.clearAllMocks();
    globalThis.EventSource = originalES;
    instances = [];
  });

  it("không kết nối khi enabled=false", () => {
    const onSignal = vi.fn();
    render(<TestComponent enabled={false} onSignal={onSignal} />);
    expect(instances.length).toBe(0);
  });

  it("kết nối và chuyển connecting → open khi EventSource mở", async () => {
    const onSignal = vi.fn();
    const { getByTestId } = render(<TestComponent enabled onSignal={onSignal} />);
    expect(getByTestId("status").textContent).toBe("connecting");
    const es = instances[0] as unknown as MockEventSource & { triggerOpen: () => void };
    await act(async () => {
      es.triggerOpen();
    });
    expect(getByTestId("status").textContent).toBe("open");
  });

  it("nhận event signal và gọi onSignal với mapping", async () => {
    const onSignal = vi.fn();
    render(<TestComponent enabled onSignal={onSignal} />);
    const es = instances[0] as unknown as MockEventSource & { triggerOpen: () => void; triggerSignal: (d: Record<string, unknown>) => void };
    await act(async () => { es.triggerOpen(); });
    await act(async () => {
      es.triggerSignal({ id: 99, symbol: "VCI", type: "whale", severity: "high", direction: "buy", detected_at: "2026-09-16T09:00:00Z", title: "Whale", value: 1000 });
    });
    expect(onSignal).toHaveBeenCalledWith(expect.objectContaining({ symbol: "VCI", type: "whale", detected_at: "2026-09-16T09:00:00Z" }));
  });

  it("query params được gắn vào URL", async () => {
    const onSignal = vi.fn();
    render(<TestComponent enabled query={{ type: "whale", symbol: "VCI" }} onSignal={onSignal} />);
    const url = instances[0]?.url ?? "";
    expect(url).toContain("type=whale");
    expect(url).toContain("symbol=VCI");
  });

  it("token trong localStorage được gắn vào URL cho EventSource fallback", async () => {
    localStorage.setItem("access_token", "test-pat-token");
    const onSignal = vi.fn();
    render(<TestComponent enabled onSignal={onSignal} />);
    const url = instances[0]?.url ?? "";
    expect(url).toContain("token=test-pat-token");
  });

  it("khi lỗi, chuyển error và tự reconnect với backoff", async () => {
    const onSignal = vi.fn();
    const { getByTestId } = render(<TestComponent enabled onSignal={onSignal} />);
    const es = instances[0] as unknown as MockEventSource & { triggerOpen: () => void; triggerError: () => void };
    await act(async () => { es.triggerOpen(); });
    expect(getByTestId("status").textContent).toBe("open");
    await act(async () => { es.triggerError(); });
    expect(getByTestId("status").textContent).toBe("error");
    expect(getByTestId("attempt").textContent).toBe("1");
    // Sau 1s (backoff đầu) sẽ reconnect → tạo instance thứ 2
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    expect(instances.length).toBe(2);
    expect(getByTestId("status").textContent).toBe("connecting");
  });

  it("F1: watchdog 35s không ping → tự đóng và reconnect", async () => {
    const onSignal = vi.fn();
    const { getByTestId } = render(<TestComponent enabled onSignal={onSignal} />);
    const es = instances[0] as unknown as MockEventSource & { triggerOpen: () => void };
    await act(async () => { es.triggerOpen(); });
    expect(getByTestId("status").textContent).toBe("open");
    // 35s không có event → watchdog phải trigger reconnect
    await act(async () => { await vi.advanceTimersByTimeAsync(35000); });
    // Sau watchdog, status phải là error và đã schedule reconnect
    expect(getByTestId("status").textContent).toBe("error");
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    expect(instances.length).toBe(2);
  });

  it("F3: reconnect giữ lastId qua ?since=", async () => {
    const onSignal = vi.fn();
    render(<TestComponent enabled onSignal={onSignal} />);
    const es1 = instances[0] as unknown as MockEventSource & { triggerOpen: () => void; triggerSignal: (d: Record<string, unknown>) => void; triggerError: () => void };
    await act(async () => { es1.triggerOpen(); });
    await act(async () => {
      es1.triggerSignal({ id: 99, symbol: "VCI", type: "whale", severity: "high", direction: "buy", detected_at: "2026-09-16T09:00:00Z", title: "t", value: 1 });
    });
    // Gây lỗi để reconnect
    await act(async () => { es1.triggerError(); });
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    const secondUrl = instances[1]?.url ?? "";
    expect(secondUrl).toContain("since=99");
  });
});
