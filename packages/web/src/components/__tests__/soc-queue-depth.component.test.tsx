import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { SocDataOpsMonitorSection } from "../soc/SocDataOpsMonitorSection.js";

const adapterMocks = vi.hoisted(() => ({
  getSocDataOpsQueueTiers: vi.fn(),
  getSocDataOpsObservability: vi.fn(),
  getSocDataOpsCoverage: vi.fn(),
  getSocMatrixMonitor: vi.fn(),
  getSocMatrixProviders: vi.fn(),
  exportSocConfigAudits: vi.fn(),
  exportSocRunLogs: vi.fn(),
}));

vi.mock("../../adapters/coreApiAdapter.js", () => ({
  defaultCoreApiAdapter: {
    getSocDataOpsQueueTiers: adapterMocks.getSocDataOpsQueueTiers,
    getSocDataOpsObservability: adapterMocks.getSocDataOpsObservability,
    getSocDataOpsCoverage: adapterMocks.getSocDataOpsCoverage,
    getSocMatrixMonitor: adapterMocks.getSocMatrixMonitor,
    getSocMatrixProviders: adapterMocks.getSocMatrixProviders,
    exportSocConfigAudits: adapterMocks.exportSocConfigAudits,
    exportSocRunLogs: adapterMocks.exportSocRunLogs,
  },
}));

vi.mock("../soc/DataOpsContext.js", () => ({
  useDataOps: () => ({
    state: {
      coverage: null,
      loading: { coverage: false, inventory: false, runs: false },
      errors: {},
      runs: [],
      inventory: null,
    },
    actions: {
      refreshCoverage: vi.fn(),
      refreshInventory: vi.fn(),
      refreshRuns: vi.fn(),
    },
  }),
  DataOpsProvider: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock("../../components/ShellToast.js", () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() }),
}));

vi.mock("../../components/ConfirmModal.js", () => ({
  useConfirm: () => () => Promise.resolve(true),
  ConfirmProvider: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock("../../hooks/useDataOpsStream.js", () => ({
  useDataOpsStream: () => ({ status: "disabled" }),
}));

function mockObservability(queueDepths: Record<string, number>) {
  adapterMocks.getSocDataOpsQueueTiers.mockResolvedValue({ tiers: [] });
  adapterMocks.getSocDataOpsObservability.mockResolvedValue({
    backlog: { by_dataset: [], by_tier: [] },
    fail_rates: {},
    queue_depths: queueDepths,
    updated_at: new Date().toISOString(),
  });
  adapterMocks.getSocMatrixMonitor.mockResolvedValue({ cycles: [] });
  adapterMocks.getSocMatrixProviders.mockResolvedValue({ providers: [] });
}

describe("SocDataOpsMonitorSection - queue depth (Slice G)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  afterEach(() => cleanup());

  it("hiển thị banner + bảng khi queue vượt ngưỡng 200", async () => {
    mockObservability({ realtime_prefetch: 5000, celery: 3 });
    render(<SocDataOpsMonitorSection />);
    // test env: t() trả raw key
    await screen.findByText("soc.dataops.queue_depth_title");
    // tên queue + số depth render thô (không qua t)
    expect(screen.getByText("realtime_prefetch")).toBeTruthy();
    // UX-07: test trước đây kỳ vọng "5,000" — đó là `toLocaleString()` không
  // tham số, tức theo locale CỦA MÁY CHẠY TEST (jsdom mặc định en-US).
  // Nay dùng `formatNumber(x, localeTag)` với `localeTag='vi-VN'` ⇒ "5.000".
  // Đây chính là lỗi mà luat I18N-1 nhắm tới: app đổi sang EN vẫn ra kiểu Việt.
  expect(screen.getByText("5.000")).toBeTruthy();
    expect(screen.getByText("celery")).toBeTruthy();
    // banner cảnh báo có role=status
    expect(screen.getByRole("status")).toBeTruthy();
  });

  it("không banner khi mọi queue dưới ngưỡng", async () => {
    mockObservability({ realtime_prefetch: 12, celery: 0 });
    render(<SocDataOpsMonitorSection />);
    await screen.findByText("soc.dataops.queue_depth_title");
    expect(screen.queryByRole("status")).toBeNull();
  });
});
