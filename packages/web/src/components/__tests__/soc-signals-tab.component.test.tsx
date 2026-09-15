import { describe, it, expect, vi, beforeEach, afterEach, afterAll } from "vitest";
import { render, screen, fireEvent, cleanup, act } from "@testing-library/react";
import { mapRecentItem, signalKey, SocSignalsPanel } from "../soc/SocSignalsPanel.js";

const mocks = vi.hoisted(() => ({
  getSocSignalMetrics: vi.fn(),
  getSocWhaleRecent: vi.fn(),
  getSocDarkPoolRecent: vi.fn(),
  getSocScreenerRecent: vi.fn(),
  getSocSignalMaterialization: vi.fn(),
  runSocSignalJob: vi.fn(),
  getSocSignalJobStatus: vi.fn(),
  getSocSignalConfig: vi.fn(),
  getSocSignalOwnership: vi.fn(),
  getSocWhaleDetection: vi.fn(),
  getSocDarkPoolDetection: vi.fn(),
  getSocScreenerDetection: vi.fn(),
  getSocSignalRetention: vi.fn(),
  testSocWhaleDetection: vi.fn(),
  previewSocSignalRetention: vi.fn(),
}));

vi.mock("../../adapters/coreApiAdapter.js", () => ({
  defaultCoreApiAdapter: {
    getSocSignalMetrics: mocks.getSocSignalMetrics,
    getSocWhaleRecent: mocks.getSocWhaleRecent,
    getSocDarkPoolRecent: mocks.getSocDarkPoolRecent,
    getSocScreenerRecent: mocks.getSocScreenerRecent,
    getSocSignalMaterialization: mocks.getSocSignalMaterialization,
    runSocSignalJob: mocks.runSocSignalJob,
    getSocSignalJobStatus: mocks.getSocSignalJobStatus,
    getSocSignalConfig: mocks.getSocSignalConfig,
    getSocSignalOwnership: mocks.getSocSignalOwnership,
    getSocWhaleDetection: mocks.getSocWhaleDetection,
    getSocDarkPoolDetection: mocks.getSocDarkPoolDetection,
    getSocScreenerDetection: mocks.getSocScreenerDetection,
    getSocSignalRetention: mocks.getSocSignalRetention,
    testSocWhaleDetection: mocks.testSocWhaleDetection,
    previewSocSignalRetention: mocks.previewSocSignalRetention,
  },
}));

const summaryFixture = {
  session_date: "2026-09-16",
  active_alerts: 30,
  whale_alerts: 10,
  dark_flow_alerts: 12,
  signal_alerts: 8,
  order_flow_events: 40,
  detection_rate: 75.0,
  false_positive_rate: 0.0,
  avg_signal_latency_ms: 123.4,
  sentiment: { bullish: 2, bearish: 1, neutral: 0 },
  last_triggered_at: "2026-09-16T09:00:00Z",
};

const whaleFixture = {
  recent: [
    {
      id: 1,
      symbol: "VCI",
      severity: "high",
      metadata: { rule_name: "whale_flow" },
      session_date: "2026-09-16",
      value: "1250000000.00",
      side: "buy",
      timestamp: "2026-09-16T09:00:00Z",
      title: "Whale buy detected",
    },
  ],
  total_today: 10,
};

const darkFixture = {
  recent: [
    {
      id: 2,
      symbol: "VCI",
      severity: "medium",
      metadata: { rule_name: "dark_pool_ratio" },
      session_date: "2026-09-16",
      value: 980000000,
      side: "sell",
      timestamp: "2026-09-16T08:55:00Z",
      title: "Dark pool trade",
    },
  ],
  total_today: 12,
};

const screenerFixture = { recent: [], total_today: 8 };

const matFixture = {
  services: [
    {
      service_key: "signal_whale_canonical_pipeline",
      status: "healthy",
      last_started_at: "2026-09-16T09:00:00Z",
      last_finished_at: "2026-09-16T09:05:00Z",
      run_log_id: 7,
    },
  ],
  execution_plan: [
    {
      service_key: "signal_whale_canonical_pipeline",
      execution_supported: true,
      will_run: true,
      symbol: "VCI",
    },
  ],
  unified_alerts_available: 30,
  session_dates_available: 3,
  latest_detection_job_run_log_id: 7,
};

function mockFeedOk() {
  mocks.getSocSignalMetrics.mockResolvedValue(summaryFixture);
  mocks.getSocWhaleRecent.mockResolvedValue(whaleFixture);
  mocks.getSocDarkPoolRecent.mockResolvedValue(darkFixture);
  mocks.getSocScreenerRecent.mockResolvedValue(screenerFixture);
  mocks.getSocSignalMaterialization.mockResolvedValue(matFixture);
}

beforeEach(() => {
  Object.values(mocks).forEach((m) => m.mockReset());
  mockFeedOk();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("mapRecentItem — W0.1 BE canonical → FE", () => {
  it("maps whale/dark_pool/screener samples (timestamp→detected_at, side→action, value→volume)", () => {
    const whale = mapRecentItem(whaleFixture.recent[0], "whale");
    expect(whale.detected_at).toBe("2026-09-16T09:00:00Z");
    expect(whale.action).toBe("buy");
    expect(whale.volume).toBe(1250000000);
    expect(whale.id).toBe(1);
    expect(whale.severity).toBe("high");
    expect(whale.session_date).toBe("2026-09-16");
    expect(whale.metadata).toEqual({ rule_name: "whale_flow" });

    const dark = mapRecentItem(darkFixture.recent[0], "dark_pool");
    expect(dark.action).toBe("sell");
    expect(dark.volume).toBe(980000000);

    const screener = mapRecentItem(
      { symbol: "VNM", side: "neutral", timestamp: "2026-09-16T08:50:00Z", value: null, title: "x" },
      "screener",
    );
    expect(screener.detected_at).toBe("2026-09-16T08:50:00Z");
    expect(screener.volume).toBeUndefined();
  });

  it("falls back to order_value_vnd / matched_value_vnd when value is null", () => {
    const a = mapRecentItem({ symbol: "SSI", side: "buy", timestamp: "T", order_value_vnd: "500000000" }, "whale");
    expect(a.volume).toBe(500000000);
    const b = mapRecentItem({ symbol: "SSI", side: "sell", timestamp: "T", matched_value_vnd: 250000 }, "dark_pool");
    expect(b.volume).toBe(250000);
  });
});

describe("signalKey — W0.3 expand độc lập", () => {
  it("prefers id so two signals of the same symbol get different keys", () => {
    const k1 = signalKey({ symbol: "VCI", type: "whale", detected_at: "T", id: 1 }, 0);
    const k2 = signalKey({ symbol: "VCI", type: "dark_pool", detected_at: "T", id: 2 }, 0);
    expect(k1).not.toBe(k2);
  });

  it("falls back to symbol+detected_at+idx when id is missing", () => {
    const k1 = signalKey({ symbol: "VCI", type: "whale", detected_at: "T" }, 0);
    const k2 = signalKey({ symbol: "VCI", type: "whale", detected_at: "T" }, 1);
    expect(k1).not.toBe(k2);
  });
});

describe("SocSignalsPanel — P0 feed + stats", () => {
  it("renders feed rows from recent envelope and counts from summary (not ≤60 fallback)", async () => {
    render(<SocSignalsPanel />);
    // 2 rows cùng mã VCI (whale + dark_pool)
    const vciCells = await screen.findAllByText("VCI");
    expect(vciCells.length).toBe(2);
    // counts từ summary/: total 30 (không phải signals.length=2)
    expect(screen.getByText("30")).toBeTruthy();
    expect(screen.getByText("10")).toBeTruthy();
    expect(screen.getByText("12")).toBeTruthy();
    expect(screen.getByText("8")).toBeTruthy();
    // latency key chuẩn avg_signal_latency_ms
    expect(screen.getByText("123.4ms")).toBeTruthy();
    // sentiment từ summary
    expect(screen.getByText("▲ soc.signals_overview.bullish: 2")).toBeTruthy();
  });

  it("expands two same-symbol rows independently", async () => {
    render(<SocSignalsPanel />);
    const vciCells = await screen.findAllByText("VCI");
    expect(vciCells.length).toBe(2);
    const rows = vciCells.map((el) => el.parentElement as HTMLElement);
    fireEvent.click(rows[0]);
    // chỉ 1 meta mở (của whale id=1)
    expect(screen.getByText(/whale_flow/)).toBeTruthy();
    fireEvent.click(rows[1]);
    expect(screen.getByText(/dark_pool_ratio/)).toBeTruthy();
  });

  it("feed 500 → banner section, materialization vẫn sống (W0.3 isolation)", async () => {
    mocks.getSocWhaleRecent.mockRejectedValue(new Error("feed boom"));
    render(<SocSignalsPanel />);
    // banner feed: t() trả defaultValue trong test env + message lỗi BE
    expect(await screen.findByText(/feed boom/)).toBeTruthy();
    // chuyển sang tab materialization — services vẫn render
    fireEvent.click(screen.getByText("soc.signals_overview.materialization"));
    expect(await screen.findByText("signal_whale_canonical_pipeline")).toBeTruthy();
  });

  it("mat 500 → banner dùng key materialization_error, feed vẫn sống (F-NI-01)", async () => {
    mocks.getSocSignalMaterialization.mockRejectedValue(new Error("mat boom"));
    render(<SocSignalsPanel />);
    // feed vẫn sống
    expect(await screen.findAllByText("VCI")).toBeTruthy();
    fireEvent.click(screen.getByText("soc.signals_overview.materialization"));
    expect(await screen.findByText(/mat boom/)).toBeTruthy();
    expect(screen.getByText(/Không tải được trạng thái vật chất hóa/)).toBeTruthy();
  });

  it("materialization renders execution plan + full time + run id (F-SG-10/21)", async () => {
    render(<SocSignalsPanel />);
    fireEvent.click(await screen.findByText("soc.signals_overview.materialization"));
    expect(await screen.findByText("signal_whale_canonical_pipeline")).toBeTruthy();
    expect(screen.getByText("Kế hoạch thực thi")).toBeTruthy();
    // không còn cắt ngày YYYY-MM-DD trần
    expect(screen.queryByText("2026-09-16")).toBeNull();
  });

  it("mat card shows started time + progress bar + job link jumps to console (W1.4)", async () => {
    mocks.getSocSignalJobStatus.mockResolvedValue({ status: "success", run_log_id: 7 });
    const { container } = render(<SocSignalsPanel />);
    fireEvent.click(await screen.findByText("soc.signals_overview.materialization"));
    await screen.findByText("signal_whale_canonical_pipeline");
    const fill = container.querySelector('[class*="matCardBarFill"]') as HTMLElement | null;
    expect(fill).toBeTruthy();
    expect(fill!.style.width).toBe("100%");
    // started + finished đều giờ đầy đủ (2 title ISO)
    const withTitle = container.querySelectorAll('[title^="2026-09-16T"]');
    expect(withTitle.length).toBeGreaterThanOrEqual(2);
    // bấm Xem job → sang job console + hiện đúng run
    fireEvent.click(screen.getByText("Xem job"));
    expect(await screen.findByText("Job success (run #7)")).toBeTruthy();
    expect(mocks.getSocSignalJobStatus).toHaveBeenCalledWith(7);
  });
});

describe("SocSignalsPanel — W1.1 paging + filters", () => {
  function mockManyWhales(n: number) {
    const recent = Array.from({ length: n }, (_, i) => ({
      id: 101 + i,
      symbol: `T${String(i + 1).padStart(2, "0")}`,
      severity: i % 2 === 0 ? "high" : "low",
      metadata: {},
      session_date: "2026-09-16",
      value: 1000000 + i,
      side: i % 2 === 0 ? "buy" : "sell",
      timestamp: "2026-09-16T09:00:00Z",
      title: `Whale ${i + 1}`,
    }));
    mocks.getSocWhaleRecent.mockResolvedValue({ recent, total_today: n, total_filtered: n, page: 1, page_size: 100 });
    mocks.getSocDarkPoolRecent.mockResolvedValue({ recent: [], total_today: 0, total_filtered: 0 });
    mocks.getSocScreenerRecent.mockResolvedValue({ recent: [], total_today: 0, total_filtered: 0 });
  }

  it("paginates merged feed: page 1 shows 20, page 2 shows 5 of 25", async () => {
    mockManyWhales(25);
    render(<SocSignalsPanel />);
    expect(await screen.findAllByText(/T\d\d/)).toHaveLength(20);
    fireEvent.click(screen.getByText("2"));
    expect(await screen.findAllByText(/T\d\d/)).toHaveLength(5);
    // pageSize 50 → all 25 on one page
    fireEvent.change(screen.getByRole("combobox", { name: "soc.overview.page_size_label" }), {
      target: { value: "50" },
    });
    expect(await screen.findAllByText(/T\d\d/)).toHaveLength(25);
  });

  it("severity select filters client-side and sends BE query param", async () => {
    mockManyWhales(4);
    render(<SocSignalsPanel />);
    expect(await screen.findAllByText(/T\d\d/)).toHaveLength(4);
    fireEvent.change(screen.getByRole("combobox", { name: "Mức độ" }), { target: { value: "high" } });
    expect(await screen.findAllByText(/T\d\d/)).toHaveLength(2);
    const lastCall = mocks.getSocWhaleRecent.mock.calls.at(-1)?.[0] as Record<string, unknown> | undefined;
    expect(lastCall?.severity).toBe("high");
  });

  it("symbol search debounces 300ms before refetching with symbol param", async () => {
    render(<SocSignalsPanel />);
    await screen.findAllByText("VCI");
    const callsBefore = mocks.getSocWhaleRecent.mock.calls.length;
    vi.useFakeTimers();
    try {
      fireEvent.change(screen.getByPlaceholderText("soc.signals_overview.search_symbol"), {
        target: { value: "VCI" },
      });
      // chưa đủ 300ms → chưa refetch
      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });
      expect(mocks.getSocWhaleRecent.mock.calls.length).toBe(callsBefore);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(250);
      });
      await act(async () => undefined);
      const lastCall = mocks.getSocWhaleRecent.mock.calls.at(-1)?.[0] as Record<string, unknown> | undefined;
      expect(lastCall?.symbol).toBe("VCI");
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("SocSignalsPanel — W1.2 time + a11y", () => {
  it("row time uses formatLastCheck (local + relative, ISO tooltip)", async () => {
    const { container } = render(<SocSignalsPanel />);
    await screen.findAllByText("VCI");
    const timeCell = container.querySelector('[class*="signalTime"][title="2026-09-16T09:00:00Z"]');
    expect(timeCell).toBeTruthy();
    // không còn cắt HH:MM (UTC) trần — hiển thị local + relative trong ngoặc
    expect(timeCell!.textContent).not.toBe("09:00");
    expect(timeCell!.textContent).toContain("(");
  });

  it("search uses Lucide Search icon (no emoji) and subtabs expose tab roles", async () => {
    const { container } = render(<SocSignalsPanel />);
    await screen.findAllByText("VCI");
    expect(container.querySelector('[class*="searchIcon"] svg')).toBeTruthy();
    expect(container.textContent).not.toContain("🔍");
    const tablist = container.querySelector('[role="tablist"]');
    expect(tablist).toBeTruthy();
    const tabs = container.querySelectorAll('[role="tab"]');
    expect(tabs.length).toBe(6);
    expect(tabs[0].getAttribute("aria-selected")).toBe("true");
  });
});

describe("SocSignalsPanel — W1.3 config/detection/retention subtabs", () => {
  it("config tab renders thresholds + ownership bridge-write box", async () => {
    mocks.getSocSignalConfig.mockResolvedValue({
      config: { whale_threshold_vnd: 500000000, whale_enabled: true, universe_group_ids: ["vn30"] },
      ownership: { mode: "bridge-write", can_apply: false, write_block_reason: "locked by owner" },
    });
    mocks.getSocSignalOwnership.mockResolvedValue({ mode: "bridge-write", can_apply: false });
    render(<SocSignalsPanel />);
    await screen.findAllByText("VCI");
    fireEvent.click(screen.getByText("Cấu hình"));
    expect(await screen.findByText(/whale_threshold_vnd: 500000000/)).toBeTruthy();
    expect(screen.getByText(/locked by owner/)).toBeTruthy();
    expect(screen.getByText(/SOC chỉ đọc/)).toBeTruthy();
    expect(mocks.getSocSignalConfig).toHaveBeenCalledTimes(1);
  });

  it("detection tab renders 3 cards + test button shows result with smoke label", async () => {
    mocks.getSocWhaleDetection.mockResolvedValue({ enabled: true, threshold_vnd: 500000000 });
    mocks.getSocDarkPoolDetection.mockResolvedValue({ enabled: false });
    mocks.getSocScreenerDetection.mockResolvedValue({ enabled: true, active_rules: 3 });
    mocks.testSocWhaleDetection.mockResolvedValue({ symbol: "VNM", test_result: "success", detection_possible: true });
    render(<SocSignalsPanel />);
    await screen.findAllByText("VCI");
    fireEvent.click(screen.getByText("Phát hiện"));
    expect(await screen.findByText(/threshold_vnd: 500000000/)).toBeTruthy();
    expect(screen.getByText(/Kết quả smoke/)).toBeTruthy();
    fireEvent.click(screen.getByText("Chạy thử"));
    expect(mocks.testSocWhaleDetection).toHaveBeenCalledWith("VNM");
    expect(await screen.findByText(/test_result: success/)).toBeTruthy();
  });

  it("retention tab renders policy + preview shows impact", async () => {
    mocks.getSocSignalRetention.mockResolvedValue({ intraday_tick_days: 7, canonical_event_days: 90 });
    mocks.previewSocSignalRetention.mockResolvedValue({
      valid: true,
      retention_days: { intraday_tick: 7 },
      impact: { alerts_in_scope: 30, bridge_write_locked: true },
    });
    render(<SocSignalsPanel />);
    await screen.findAllByText("VCI");
    fireEvent.click(screen.getByText("Lưu trữ"));
    expect(await screen.findByText(/intraday_tick_days: 7/)).toBeTruthy();
    fireEvent.click(screen.getByText("Xem ảnh hưởng"));
    expect(mocks.previewSocSignalRetention).toHaveBeenCalledWith({});
    expect(await screen.findByText(/alerts_in_scope: 30/)).toBeTruthy();
  });

  it("job console offers only whale + dark_pool (screener rejected by BE)", async () => {
    const { container } = render(<SocSignalsPanel />);
    await screen.findAllByText("VCI");
    fireEvent.click(screen.getByText("soc.signals_overview.job_console"));
    const jobSelect = container.querySelector('select:not([aria-label])') as HTMLSelectElement | null;
    expect(jobSelect).toBeTruthy();
    const options = Array.from(jobSelect!.querySelectorAll("option")).map((o) => o.getAttribute("value"));
    expect(options).toEqual(["whale", "dark_pool"]);
  });
});

describe("SocSignalsPanel — W0.4 job polling", () => {
  it("polls status by run_log_id until terminal success", async () => {
    render(<SocSignalsPanel />);
    await screen.findAllByText("VCI");
    fireEvent.click(screen.getByText("soc.signals_overview.job_console"));

    mocks.runSocSignalJob.mockResolvedValue({ status: "queued", run_log_id: 42 });
    mocks.getSocSignalJobStatus
      .mockResolvedValueOnce({ status: "running", run_log_id: 42 })
      .mockResolvedValue({ status: "success", run_log_id: 42 });

    vi.useFakeTimers();
    const input = screen.getByPlaceholderText("soc.signals_overview.symbol_placeholder");
    fireEvent.change(input, { target: { value: "vci" } });
    await act(async () => {
      fireEvent.click(screen.getByText("soc.signals_overview.run_job"));
    });
    expect(mocks.runSocSignalJob).toHaveBeenCalledWith("whale", "VCI");
    expect(mocks.getSocSignalJobStatus).toHaveBeenCalledTimes(1);
    expect(mocks.getSocSignalJobStatus).toHaveBeenCalledWith(42);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });
    await act(async () => undefined);
    expect(mocks.getSocSignalJobStatus).toHaveBeenCalledTimes(2);
    expect(screen.getByText("Job success (run #42)")).toBeTruthy();
  });

  it("shows queued message when BE returns no run_log_id (backward compat)", async () => {
    render(<SocSignalsPanel />);
    await screen.findAllByText("VCI");
    fireEvent.click(screen.getByText("soc.signals_overview.job_console"));
    mocks.runSocSignalJob.mockResolvedValue({ status: "queued" });
    const input = screen.getByPlaceholderText("soc.signals_overview.symbol_placeholder");
    fireEvent.change(input, { target: { value: "SSI" } });
    await act(async () => {
      fireEvent.click(screen.getByText("soc.signals_overview.run_job"));
    });
    expect(mocks.getSocSignalJobStatus).not.toHaveBeenCalled();
    expect(screen.getByText("queued")).toBeTruthy();
  });
});

afterAll(() => {
  vi.useRealTimers();
});
