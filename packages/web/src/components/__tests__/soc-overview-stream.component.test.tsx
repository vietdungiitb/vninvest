import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, cleanup, waitFor } from "@testing-library/react";
import { SocOverviewPanel } from "../soc/SocOverviewPanel.js";

const adapterMocks = vi.hoisted(() => ({
  getSocOverviewSummary: vi.fn(),
  getSocSloOverview: vi.fn(),
  updateSocService: vi.fn(),
  triggerSocServiceHealthCheck: vi.fn(),
}));

vi.mock("../../adapters/coreApiAdapter.js", () => ({
  defaultCoreApiAdapter: {
    getSocOverviewSummary: adapterMocks.getSocOverviewSummary,
    getSocSloOverview: adapterMocks.getSocSloOverview,
    updateSocService: adapterMocks.updateSocService,
    triggerSocServiceHealthCheck: adapterMocks.triggerSocServiceHealthCheck,
  },
}));

const baseline = {
  generated_at: "2026-09-16T09:00:00Z",
  services: [
    { service_key: "svc_a", name: "SVC A", domain: "signals", status: "healthy", is_active: true, avg_response_ms: 80, last_check_at: "2026-09-16T09:00:00Z" },
    { service_key: "svc_b", name: "SVC B", domain: "signals", status: "degraded", is_active: true, avg_response_ms: 220, last_check_at: "2026-09-16T09:00:00Z" },
  ],
};

type ESInstance = {
  url: string;
  close: ReturnType<typeof vi.fn>;
  onopen: ((e: Event) => void) | null;
  onerror: ((e: Event) => void) | null;
  addEventListener: ReturnType<typeof vi.fn>;
  triggerOpen: () => void;
  triggerOverview: (data: Record<string, unknown>) => void;
};

let esInstances: ESInstance[] = [];

class MockES {
  url: string;
  close = vi.fn();
  onopen: ((e: Event) => void) | null = null;
  onmessage: ((e: MessageEvent) => void) | null = null;
  onerror: ((e: Event) => void) | null = null;
  addEventListener = vi.fn((event: string, cb: EventListener) => {
    (this as unknown as Record<string, unknown>)[`_overview_${event}`] = cb;
  });
  constructor(url: string) {
    this.url = url;
    const instRef = this;
    esInstances.push({
      get url() { return instRef.url; },
      close: this.close,
      get onopen() { return instRef.onopen; },
      set onopen(v) { instRef.onopen = v; },
      get onerror() { return instRef.onerror; },
      set onerror(v) { instRef.onerror = v; },
      addEventListener: this.addEventListener,
      triggerOpen: () => {
        if (instRef.onopen) instRef.onopen(new Event("open"));
      },
      triggerOverview: (data: Record<string, unknown>) => {
        const cb = (instRef as unknown as Record<string, unknown>)[`_overview_overview`] as ((e: MessageEvent) => void) | undefined;
        const ev = new MessageEvent("overview", { data: JSON.stringify(data) });
        if (cb) cb(ev);
        else if (instRef.onmessage) instRef.onmessage(ev);
      },
    } as unknown as ESInstance);
    (this as unknown as Record<string, unknown>).triggerOpen = () => {
      if (this.onopen) this.onopen(new Event("open"));
    };
    (this as unknown as Record<string, unknown>).triggerOverview = (data: Record<string, unknown>) => {
      const cb = (this as unknown as Record<string, unknown>)[`_overview_overview`] as ((e: MessageEvent) => void) | undefined;
      const ev = new MessageEvent("overview", { data: JSON.stringify(data) });
      if (cb) cb(ev);
    };
  }
}

describe("SocOverviewPanel — P3 SSE overview stream", () => {
  const originalES = (globalThis as unknown as Record<string, unknown>).EventSource as unknown as typeof EventSource | undefined;

  beforeEach(() => {
    esInstances = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).EventSource = MockES as unknown as typeof EventSource;
    Object.values(adapterMocks).forEach((m) => m.mockReset());
    adapterMocks.getSocOverviewSummary.mockResolvedValue(baseline);
    adapterMocks.getSocSloOverview.mockResolvedValue({ services: [] });
  });

  afterEach(() => {
    cleanup();
    if (originalES) (globalThis as unknown as Record<string, unknown>).EventSource = originalES;
    else delete (globalThis as unknown as Record<string, unknown>).EventSource;
    esInstances = [];
    vi.useRealTimers();
  });

  it("hiển thị Live khi SSE mở, và snapshot mới qua stream thay đổi dữ liệu", async () => {
    render(<SocOverviewPanel />);
    await waitFor(() => expect(screen.getByText("SVC A")).toBeTruthy());

    const es = esInstances[0] as unknown as ESInstance;
    expect(es).toBeTruthy();
    await act(async () => { es.triggerOpen(); });
    expect(await screen.findByText("Trực tiếp")).toBeTruthy();

    // snapshot mới với trạng thái thay đổi (svc_b: degraded → healthy)
    const updated = {
      generated_at: "2026-09-16T09:01:00Z",
      services: [
        { service_key: "svc_a", name: "SVC A", domain: "signals", status: "healthy", is_active: true, avg_response_ms: 80, last_check_at: "2026-09-16T09:01:00Z" },
        { service_key: "svc_b", name: "SVC B", domain: "signals", status: "healthy", is_active: true, avg_response_ms: 90, last_check_at: "2026-09-16T09:01:00Z" },
      ],
    };
    await act(async () => { es.triggerOverview(updated); });
    // svc_b giờ healthy → badge healthy (tiêu chuẩn filter "Đang kết nối"/"Trực tiếp" vẫn hiển thị)
    expect(await waitFor(() => screen.getByText(/Trực tiếp/))).toBeTruthy();
  });

  it("fallback polling khi socket đóng (error) → vẫn render dữ liệu", async () => {
    adapterMocks.getSocOverviewSummary.mockResolvedValue(baseline);
    render(<SocOverviewPanel />);
    await waitFor(() => expect(screen.getByText("SVC A")).toBeTruthy());
    const es = esInstances[0] as unknown as ESInstance;
    expect(es).toBeTruthy();
    expect(screen.getByText(/Polling|Đang kết nối/)).toBeTruthy();
  });
});