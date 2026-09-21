import { describe, it, expect, vi, beforeEach, afterEach, afterAll } from "vitest";
import { render, screen, fireEvent, cleanup, act, waitFor } from "@testing-library/react";
import { mapRecentItem, signalKey, buildSignalsCsv, SocSignalsPanel } from "../soc/SocSignalsPanel.js";

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
  exportSocSignalFeed: vi.fn(),
  getSocSignalDeliveries: vi.fn(),
  markSocSignalDeliverySeen: vi.fn(),
  ackSocSignalDelivery: vi.fn(),
  muteSocSignalDeliveries: vi.fn(),
  getSocSignalRules: vi.fn(),
  getSocSignalRulesPerformance: vi.fn(),
  requestSocSignalRuleChange: vi.fn(),
  feedbackSocSignalRule: vi.fn(),
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
    exportSocSignalFeed: mocks.exportSocSignalFeed,
    getSocSignalDeliveries: mocks.getSocSignalDeliveries,
    markSocSignalDeliverySeen: mocks.markSocSignalDeliverySeen,
    ackSocSignalDelivery: mocks.ackSocSignalDelivery,
    muteSocSignalDeliveries: mocks.muteSocSignalDeliveries,
    getSocSignalRules: mocks.getSocSignalRules,
    getSocSignalRulesPerformance: mocks.getSocSignalRulesPerformance,
    requestSocSignalRuleChange: mocks.requestSocSignalRuleChange,
    feedbackSocSignalRule: mocks.feedbackSocSignalRule,
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
  mocks.getSocSignalDeliveries.mockResolvedValue({ results: [] });
  mocks.getSocSignalRules.mockResolvedValue({ rules: [], generated_at: "2026-09-16T09:00:00Z" });
  mocks.getSocSignalRulesPerformance.mockResolvedValue({ overall: null, by_family: [], top_noisy: [] });
  mocks.requestSocSignalRuleChange.mockResolvedValue({ request_id: "REQ-1", pending: true });
  mocks.feedbackSocSignalRule.mockResolvedValue({ delivery_id: "d-1", alert_id: "a-1", delivery_state: "acknowledged" });
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

  it("S6 summary co system/ai → the System + AI + phien dang doc", async () => {
    mocks.getSocSignalMetrics.mockResolvedValue({
      ...summaryFixture,
      active_alerts: 33,
      system_alerts: 2,
      ai_alerts: 1,
    });
    render(<SocSignalsPanel />);
    expect(await screen.findByText("soc.signals_overview.system_count")).toBeTruthy();
    expect(screen.getByText("soc.signals_overview.ai_count")).toBeTruthy();
    expect(screen.getByText(/soc.signals_overview.session_reading/)).toBeTruthy();
    expect(screen.getByText(/2026-09-16/)).toBeTruthy();
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
    expect((await screen.findAllByText("signal_whale_canonical_pipeline")).length).toBe(2);
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
    expect((await screen.findAllByText("signal_whale_canonical_pipeline")).length).toBe(2);
    expect(screen.getByText("Kế hoạch thực thi")).toBeTruthy();
    // không còn cắt ngày YYYY-MM-DD trần
    expect(screen.queryByText("2026-09-16")).toBeNull();
  });

  it("mat card shows started time + progress bar + job link jumps to console (W1.4)", async () => {
    mocks.getSocSignalJobStatus.mockResolvedValue({ status: "success", run_log_id: 7 });
    const { container } = render(<SocSignalsPanel />);
    fireEvent.click(await screen.findByText("soc.signals_overview.materialization"));
    await screen.findAllByText("signal_whale_canonical_pipeline");
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
    expect(tabs.length).toBe(7);
    expect(tabs[0].getAttribute("aria-selected")).toBe("true");
    expect(tabs[6].textContent).toBe("Rules");
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
    expect(await screen.findByText("whale_threshold_vnd")).toBeTruthy();
    expect(await screen.findByText("500.000.000")).toBeTruthy();
    expect(screen.getByText(/locked by owner/)).toBeTruthy();
    expect(screen.getByText(/SOC chỉ đọc/)).toBeTruthy();
    expect(mocks.getSocSignalConfig).toHaveBeenCalledTimes(1);
  });

  it("detection tab renders 3 cards + test button shows result with smoke label", async () => {
    mocks.getSocWhaleDetection.mockResolvedValue({ enabled: true, threshold_vnd: 500000000, top_pct: 0.1 });
    mocks.getSocDarkPoolDetection.mockResolvedValue({ enabled: false });
    mocks.getSocScreenerDetection.mockResolvedValue({ enabled: true, active_rules: 3 });
    mocks.testSocWhaleDetection.mockResolvedValue({ symbol: "VNM", test_result: "success", detection_possible: true });
    render(<SocSignalsPanel />);
    await screen.findAllByText("VCI");
    fireEvent.click(screen.getByText("Phát hiện"));
    expect(await screen.findByText("Ngưỡng (VNĐ)")).toBeTruthy();
    expect(await screen.findByText("500.000.000 ₫")).toBeTruthy();
    expect(screen.getByText("Top %")).toBeTruthy();
    expect(screen.getByText("10%")).toBeTruthy();
    expect(screen.getAllByText("Đang bật").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Kết quả smoke/)).toBeTruthy();
    fireEvent.click(screen.getByText("Chạy thử"));
    expect(mocks.testSocWhaleDetection).toHaveBeenCalledWith("VNM");
    expect(await screen.findByText("Thành công")).toBeTruthy();
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
    expect(await screen.findByText("intraday_tick_days")).toBeTruthy();
    expect((await screen.findAllByText("7")).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByText("Xem ảnh hưởng"));
    expect(mocks.previewSocSignalRetention).toHaveBeenCalledWith({});
    expect(await screen.findByText("alerts_in_scope")).toBeTruthy();
    expect((await screen.findAllByText("30")).length).toBeGreaterThan(0);
  });

  it("job console offers only whale + dark_pool (screener rejected by BE)", async () => {
    const { container } = render(<SocSignalsPanel />);
    await screen.findAllByText("VCI");
    fireEvent.click(screen.getByText("soc.signals_overview.job_console"));
    const selects = Array.from(container.querySelectorAll("select"));
    const jobSelect = selects.find((s) =>
      Array.from(s.querySelectorAll("option")).some((o) => o.getAttribute("value") === "whale"),
    ) as HTMLSelectElement | null;
    expect(jobSelect).toBeTruthy();
    const options = Array.from(jobSelect!.querySelectorAll("option")).map((o) => o.getAttribute("value"));
    expect(options).toEqual(["whale", "dark_pool"]);
  });
});

describe("buildSignalsCsv — W2.5", () => {
  it("renders header + rows with RFC4180 escaping", () => {
    const csv = buildSignalsCsv(
      ["id", "symbol", "title"],
      [[1, "VCI", "plain"], [2, "SSI", 'has "quote", comma']],
    );
    expect(csv).toBe('id,symbol,title\n1,VCI,plain\n2,SSI,"has ""quote"", comma"');
  });
});

describe("SocSignalsPanel — W2.1 poll-diff", () => {
  it("highlights arrivals, shows unread badge + title, clears on click", async () => {
    vi.useFakeTimers();
    try {
      const { container } = render(<SocSignalsPanel />);
      await act(async () => undefined);
      expect(screen.getAllByText("VCI").length).toBeGreaterThan(0);
      // poll 15s sắp tới trả thêm id 3 → arrival mới
      mocks.getSocWhaleRecent.mockResolvedValue({
        recent: [
          ...whaleFixture.recent,
          {
            id: 3,
            symbol: "HPG",
            severity: "low",
            metadata: {},
            session_date: "2026-09-16",
            value: 100,
            side: "buy",
            timestamp: "2026-09-16T09:02:00Z",
            title: "Whale HPG",
          },
        ],
        total_today: 2,
        total_filtered: 2,
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(20000);
      });
      expect(screen.getByText("1 mới")).toBeTruthy();
      expect(document.title).toContain("(1)");
      expect(container.querySelectorAll('[class*="signalRowNew"]')).toHaveLength(1);
      // poll 2: thêm id 4 → unread tích lũy 2, cả 2 row đều highlight (F-P2A-A)
      mocks.getSocWhaleRecent.mockResolvedValue({
        recent: [
          ...whaleFixture.recent,
          {
            id: 3,
            symbol: "HPG",
            severity: "low",
            metadata: {},
            session_date: "2026-09-16",
            value: 100,
            side: "buy",
            timestamp: "2026-09-16T09:02:00Z",
            title: "Whale HPG",
          },
          {
            id: 4,
            symbol: "SSI",
            severity: "high",
            metadata: {},
            session_date: "2026-09-16",
            value: 5,
            side: "sell",
            timestamp: "2026-09-16T09:03:00Z",
            title: "Whale SSI",
          },
        ],
        total_today: 3,
        total_filtered: 3,
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(20000);
      });
      expect(screen.getByText("2 mới")).toBeTruthy();
      expect(document.title).toContain("(2)");
      expect(container.querySelectorAll('[class*="signalRowNew"]')).toHaveLength(2);
      fireEvent.click(screen.getByText("2 mới"));
      expect(screen.queryByText("2 mới")).toBeNull();
      expect(document.title).not.toContain("(2)");
      expect(container.querySelectorAll('[class*="signalRowNew"]')).toHaveLength(0);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("SocSignalsPanel — W2.5 export CSV", () => {
  it("export button downloads CSV blob with current filters", async () => {
    const createObjectURL = vi.fn(() => "blob:mock-csv");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", { ...URL, createObjectURL, revokeObjectURL });
    try {
      mocks.exportSocSignalFeed.mockResolvedValue({
        columns: ["id", "symbol", "title"],
        rows: [[1, "VCI", "Whale buy detected"]],
        count: 1,
        truncated: false,
      });
      render(<SocSignalsPanel />);
      await screen.findAllByText("VCI");
      fireEvent.click(screen.getByText("Xuất CSV"));
      await waitFor(() => expect(createObjectURL).toHaveBeenCalledTimes(1));
      expect(mocks.exportSocSignalFeed).toHaveBeenCalledWith({
        type: undefined,
        symbol: undefined,
        severity: undefined,
        direction: undefined,
      });
      const blob = createObjectURL.mock.calls[0][0] as Blob;
      expect(await blob.text()).toBe("id,symbol,title\n1,VCI,Whale buy detected");
      expect(revokeObjectURL).toHaveBeenCalledWith("blob:mock-csv");
    } finally {
      vi.unstubAllGlobals();
    }
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

describe("SocSignalsPanel — W2.2 triage ack/mute", () => {
  const whaleDelivery = {
    delivery_id: "d-whale-1",
    alert_id: "a-1",
    delivery_state: "new",
    symbol: "VCI",
    alert_type: "whale",
    severity: "high",
    title: "Whale buy detected",
    triggered_at: "2026-09-16T09:00:00Z",
  };
  const darkDeliveryAcked = {
    delivery_id: "d-dark-2",
    alert_id: "a-2",
    delivery_state: "acknowledged",
    symbol: "VCI",
    alert_type: "dark_flow",
    severity: "medium",
    title: "Dark pool trade",
    triggered_at: "2026-09-16T08:55:00Z",
  };

  function mockTriageOk() {
    mocks.getSocSignalDeliveries.mockResolvedValue({ results: [whaleDelivery, darkDeliveryAcked] });
    mocks.markSocSignalDeliverySeen.mockResolvedValue({ ...whaleDelivery, delivery_state: "seen" });
    mocks.ackSocSignalDelivery.mockImplementation((id: string) =>
      Promise.resolve({ ...(id === "d-dark-2" ? darkDeliveryAcked : whaleDelivery), delivery_state: "acknowledged" }),
    );
    mocks.muteSocSignalDeliveries.mockResolvedValue({ symbol: "VCI", mute_until: "2026-09-16T10:00:00Z" });
  }

  it("renders delivery badge for matched row, none for unmatched shape", async () => {
    mockTriageOk();
    render(<SocSignalsPanel />);
    await screen.findAllByText("VCI");
    // whale row khớp (new), dark row khớp (acknowledged) — t() test-env trả defaultValue = raw state
    expect(await screen.findByText("new")).toBeTruthy();
    expect(screen.getByText("acknowledged")).toBeTruthy();
  });

  it("expand new row → markSeen called, badge chuyển seen", async () => {
    mockTriageOk();
    render(<SocSignalsPanel />);
    const vciCells = await screen.findAllByText("VCI");
    const rows = vciCells.map((el) => el.parentElement as HTMLElement);
    await act(async () => {
      fireEvent.click(rows[0]);
    });
    expect(mocks.markSocSignalDeliverySeen).toHaveBeenCalledWith("d-whale-1");
    expect(await screen.findByText("seen")).toBeTruthy();
  });

  it("ack flow: nút Đã nhận trong expand → ack + badge acknowledged + message", async () => {
    mockTriageOk();
    render(<SocSignalsPanel />);
    const vciCells = await screen.findAllByText("VCI");
    fireEvent.click((vciCells[0].parentElement as HTMLElement));
    await act(async () => {
      fireEvent.click(screen.getByText("Đã nhận"));
    });
    expect(mocks.ackSocSignalDelivery).toHaveBeenCalledWith("d-whale-1");
    expect(await screen.findByText("Đã ghi nhận 1 tín hiệu.")).toBeTruthy();
  });

  it("bulk ack: checkbox + nút Đã nhận (n)", async () => {
    mockTriageOk();
    render(<SocSignalsPanel />);
    await screen.findAllByText("VCI");
    fireEvent.click(screen.getByLabelText("Đã nhận VCI"));
    await act(async () => {
      fireEvent.click(screen.getByText("Đã nhận (1)"));
    });
    expect(mocks.ackSocSignalDelivery).toHaveBeenCalledWith("d-whale-1");
  });

  it("unacked filter ẩn row đã acknowledged, giữ row new", async () => {
    mockTriageOk();
    render(<SocSignalsPanel />);
    expect((await screen.findAllByText("VCI")).length).toBe(2);
    fireEvent.click(screen.getByText("Chưa ack"));
    await waitFor(() => {
      expect(screen.getAllByText("VCI").length).toBe(1);
    });
  });

  it("mute modal: mở từ expand, submit gửi symbol/family/minutes/reason", async () => {
    mockTriageOk();
    render(<SocSignalsPanel />);
    const vciCells = await screen.findAllByText("VCI");
    fireEvent.click((vciCells[0].parentElement as HTMLElement));
    fireEvent.click(await screen.findByText("Tắt tiếng"));
    expect(await screen.findByText("Tắt tiếng tín hiệu")).toBeTruthy();
    fireEvent.change(screen.getByPlaceholderText("VD: Nhiễu trong phiên ATC..."), {
      target: { value: "Nhiễu ATC" },
    });
    await act(async () => {
      fireEvent.click(screen.getByText("Xác nhận tắt tiếng"));
    });
    expect(mocks.muteSocSignalDeliveries).toHaveBeenCalledWith({
      symbol: "VCI",
      alert_family: "whale",
      mute_minutes: 60,
      reason: "Nhiễu ATC",
    });
    expect(await screen.findByText("Đã tắt tiếng VCI.")).toBeTruthy();
  });
});

describe("SocSignalsPanel — W2.3 rules + precision", () => {
  const rulesFixture = {
    rules: [
      { rule_key: "whale_threshold_vnd", alert_family: "whale", label: "Whale threshold", kind: "threshold", enabled: true, value: 500000000, alert_count: 10, precision_proxy: 0.75, hit_rate: 0.6 },
      { rule_key: "dark_pool_block_ratio_min", alert_family: "dark_pool", label: "Dark pool ratio", kind: "ratio", enabled: true, value: 0.3, alert_count: 4, precision_proxy: null, hit_rate: null },
    ],
    generated_at: "2026-09-16T09:00:00Z",
  };
  const perfFixture = {
    overall: { alert_count: 14, acked: 10, muted: 2, suppressed: 2, precision_proxy: 0.714, hit_rate: 0.857 },
    top_noisy: [{ rule_key: "whale_threshold_vnd", label: "Whale threshold", alert_count: 10, precision_proxy: 0.5 }],
    by_family: [],
    generated_at: "2026-09-16T09:00:00Z",
  };

  it("rules tab lazily fetches list + performance and renders rows + overall", async () => {
    mocks.getSocSignalRules.mockResolvedValue(rulesFixture);
    mocks.getSocSignalRulesPerformance.mockResolvedValue(perfFixture);
    render(<SocSignalsPanel />);
    await screen.findAllByText("VCI");
    expect(mocks.getSocSignalRules).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText("Rules"));
    expect((await screen.findAllByText("Whale threshold")).length).toBeGreaterThanOrEqual(1);
    expect(mocks.getSocSignalRules).toHaveBeenCalledTimes(1);
    expect(mocks.getSocSignalRulesPerformance).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Dark pool ratio")).toBeTruthy();
    // overall precision + hit rate (proxy, làm tròn %)
    expect(screen.getByText("71%")).toBeTruthy();
    expect(screen.getByText("86%")).toBeTruthy();
    // top noisy table row
    expect(screen.getAllByText("50%")).toHaveLength(1);
  });

  it("request modal sends payload per kind + bridge-write note", async () => {
    mocks.getSocSignalRules.mockResolvedValue(rulesFixture);
    mocks.getSocSignalRulesPerformance.mockResolvedValue(perfFixture);
    mocks.requestSocSignalRuleChange.mockResolvedValue({ request_id: "REQ-9", pending: true });
    render(<SocSignalsPanel />);
    await screen.findAllByText("VCI");
    fireEvent.click(screen.getByText("Rules"));
    await screen.findAllByText("Whale threshold");
    // row button (2 rows đều label giống submit modal → chọn row đầu)
    fireEvent.click(screen.getAllByText("Gửi yêu cầu đổi")[0]);
    expect(await screen.findByText(/Xem trước thay đổi/)).toBeTruthy();
    fireEvent.change(screen.getByPlaceholderText(/Ngưỡng lớn gây nhiễu/), {
      target: { value: "Ngưỡng quá cao" },
    });
    await act(async () => {
      fireEvent.click(screen.getAllByText("Gửi yêu cầu đổi")[0] as HTMLElement);
    });
    expect(mocks.requestSocSignalRuleChange).toHaveBeenCalledWith({
      rule_key: "whale_threshold_vnd",
      threshold_vnd: 500000000,
      change_reason: "Ngưỡng quá cao",
    });
    expect((await screen.findAllByText(/bridge-write/)).length).toBeGreaterThanOrEqual(1);
  });

  it("feedback thumbs on expanded row: up → acknowledged, down → suppressed", async () => {
    const dNew = {
      delivery_id: "d-w1",
      alert_id: "a-w1",
      delivery_state: "new",
      symbol: "VCI",
      alert_type: "whale",
      severity: "high",
      triggered_at: "2026-09-16T09:00:00Z",
    };
    const dAcked = {
      delivery_id: "d-d1",
      alert_id: "a-d1",
      delivery_state: "acknowledged",
      symbol: "VCI",
      alert_type: "dark_flow",
      severity: "medium",
      triggered_at: "2026-09-16T08:55:00Z",
    };
    mocks.getSocSignalDeliveries.mockResolvedValue({ results: [dNew, dAcked] });
    mocks.feedbackSocSignalRule.mockImplementation((p: { signal: string }) =>
      Promise.resolve({
        ...(p.signal === "up" ? dNew : dAcked),
        delivery_state: p.signal === "up" ? "acknowledged" : "suppressed",
      }),
    );
    render(<SocSignalsPanel />);
    const vciCells = await screen.findAllByText("VCI");
    fireEvent.click(vciCells[0].parentElement as HTMLElement);
    await act(async () => {
      fireEvent.click(screen.getByText("Chính xác"));
    });
    expect(mocks.feedbackSocSignalRule).toHaveBeenCalledWith({ alert_id: "a-w1", signal: "up", reason: "" });
    expect(await screen.findByText("Đã ghi phản hồi.")).toBeTruthy();
    // expand row 2 → down (row đã acknowledged vẫn hiện nút down cho precision feedback)
    fireEvent.click(vciCells[1].parentElement as HTMLElement);
    await act(async () => {
      fireEvent.click(screen.getByText("Không chính xác"));
    });
    expect(mocks.feedbackSocSignalRule).toHaveBeenCalledWith(expect.objectContaining({ alert_id: "a-d1", signal: "down" }));
  });
});
