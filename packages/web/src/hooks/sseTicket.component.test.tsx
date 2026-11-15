import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, act, cleanup } from "@testing-library/react";

// Fail-before cho C-01: SSE không bao giờ gắn PAT vào URL, chỉ dùng ?ticket=.
// Chạy trên code cũ: ĐỎ (URL chứa token=, fetch ticket không được gọi).

vi.mock("../adapters/coreApiAdapter.js", () => ({
  coreApiAdapter: { corePost: vi.fn() },
}));

import { coreApiAdapter } from "../adapters/coreApiAdapter.js";
import { useSignalStream } from "./useSignalStream.js";
import { useAlertCenterStream, getAlertCenterStreamUrl } from "./useAlertCenterStream.js";
import { useDataOpsStream, getDataOpsStreamUrl } from "./useDataOpsStream.js";
import { useOverviewStream, getOverviewStreamUrl } from "./useOverviewStream.js";

const mockedPost = coreApiAdapter.corePost as unknown as ReturnType<typeof vi.fn>;

type ESRecord = { url: string; close: ReturnType<typeof vi.fn> };
let instances: ESRecord[] = [];

class MockEventSource {
  url: string;
  close = vi.fn();
  onopen: ((e: Event) => void) | null = null;
  onmessage: ((e: MessageEvent) => void) | null = null;
  onerror: ((e: Event) => void) | null = null;
  addEventListener = vi.fn();
  constructor(url: string) {
    this.url = url;
    instances.push(this as unknown as ESRecord);
  }
}

function flush() {
  return act(async () => {});
}

describe("C-01 SSE ticket — không PAT trong URL", () => {
  const originalES = globalThis.EventSource;

  beforeEach(() => {
    instances = [];
    // @ts-ignore
    globalThis.EventSource = MockEventSource as unknown as typeof EventSource;
    localStorage.clear();
    mockedPost.mockReset();
    mockedPost.mockResolvedValue({ ticket: "test-ticket-123", expiresIn: 60 });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    globalThis.EventSource = originalES;
    instances = [];
  });

  it("useSignalStream: URL có ticket=, không có token=", async () => {
    localStorage.setItem("access_token", "pat-long-lived-xyz");
    const onSignal = vi.fn();
    render(
      <TestSignal enabled onSignal={onSignal} />,
    );
    await flush();
    expect(mockedPost).toHaveBeenCalledWith("/auth/ws-ticket/", {});
    const url = instances[0]?.url ?? "";
    expect(url).toContain("ticket=test-ticket-123");
    expect(url).not.toContain("token=");
    expect(url).not.toContain("pat-long-lived-xyz");
  });

  it("useSignalStream fail-closed: fetch ticket lỗi thì không tạo EventSource", async () => {
    localStorage.setItem("access_token", "pat-long-lived-xyz");
    mockedPost.mockRejectedValue(new Error("401"));
    const onSignal = vi.fn();
    render(<TestSignal enabled onSignal={onSignal} />);
    await flush();
    expect(instances.length).toBe(0);
  });

  it("useAlertCenterStream: URL có ticket=, không có token=", async () => {
    localStorage.setItem("access_token", "pat-long-lived-xyz");
    const onItem = vi.fn();
    render(<TestAlert enabled onItem={onItem} />);
    await flush();
    const url = instances[0]?.url ?? "";
    expect(url).toContain("ticket=test-ticket-123");
    expect(url).not.toContain("token=");
  });

  it("useDataOpsStream: URL có ticket=, không có token=", async () => {
    localStorage.setItem("access_token", "pat-long-lived-xyz");
    render(<TestDataOps />);
    await flush();
    const url = instances[0]?.url ?? "";
    expect(url).toContain("ticket=test-ticket-123");
    expect(url).not.toContain("token=");
  });

  it("useOverviewStream: URL có ticket=, không có token=", async () => {
    localStorage.setItem("access_token", "pat-long-lived-xyz");
    render(<TestOverview />);
    await flush();
    const url = instances[0]?.url ?? "";
    expect(url).toContain("ticket=test-ticket-123");
    expect(url).not.toContain("token=");
  });

  it("helper đồng bộ không đọc PAT từ localStorage", () => {
    localStorage.setItem("access_token", "pat-long-lived-xyz");
    expect(getAlertCenterStreamUrl({ lane: "main" }, null, "t-1")).toContain("ticket=t-1");
    expect(getAlertCenterStreamUrl({ lane: "main" })).not.toContain("token=");
    expect(getDataOpsStreamUrl("t-2")).toContain("ticket=t-2");
    expect(getDataOpsStreamUrl()).not.toContain("token=");
    expect(getOverviewStreamUrl("t-3")).toContain("ticket=t-3");
    expect(getOverviewStreamUrl()).not.toContain("token=");
  });
});

function TestSignal(props: { enabled: boolean; onSignal: (s: unknown) => void }) {
  const { status } = useSignalStream({ enabled: props.enabled, onSignal: props.onSignal as never });
  return <span data-testid="status">{status}</span>;
}

function TestAlert(props: { enabled: boolean; onItem: (s: unknown) => void }) {
  const { status } = useAlertCenterStream({
    enabled: props.enabled,
    query: { lane: "main" },
    onItem: props.onItem as never,
  });
  return <span data-testid="status">{status}</span>;
}

function TestDataOps() {
  const { status } = useDataOpsStream({ enabled: true, onSnapshot: () => {} });
  return <span data-testid="status">{status}</span>;
}

function TestOverview() {
  const { status } = useOverviewStream({ enabled: true, onSnapshot: () => {} });
  return <span data-testid="status">{status}</span>;
}
