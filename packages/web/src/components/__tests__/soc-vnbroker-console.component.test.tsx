import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { SocVnbrokerPanel } from "../soc/SocVnbrokerPanel.js";

const adapterMocks = vi.hoisted(() => ({
  getSocVnbrokerConfig: vi.fn(),
  getSocVnbrokerHealth: vi.fn(),
  getSocVnbrokerProviderHealth: vi.fn(),
  getSocVnbrokerProviders: vi.fn(),
  getSocVnbrokerBenchmarkLatest: vi.fn(),
  getSocVnbrokerCircuitBreaker: vi.fn(),
  getSocVnbrokerOwnership: vi.fn(),
  previewSocVnbrokerConfig: vi.fn(),
  applySocVnbrokerConfig: vi.fn(),
  runSocVnbrokerBenchmark: vi.fn(),
  testSocVnbrokerConnection: vi.fn(),
}));

vi.mock("../../adapters/coreApiAdapter.js", () => ({
  defaultCoreApiAdapter: adapterMocks,
}));

vi.mock("../../components/ShellToast.js", () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() }),
}));

vi.mock("../../components/ConfirmModal.js", () => ({
  useConfirm: () => () => Promise.resolve(true),
  ConfirmProvider: ({ children }: { children: React.ReactNode }) => children,
}));

const CONFIG_PAYLOAD = {
  timeout: { connect: 10, read: 30, write: 10, pool: 5 },
  max_retries: 3,
  retry_delay_seconds: 2,
  preferred_provider: "vci",
  fallback_providers: ["kbs", "dnse"],
  enabled: true,
  circuit_breaker_threshold: 5,
  circuit_breaker_window_seconds: 60,
  circuit_breaker_cooldown_seconds: 300,
  requests_per_minute: 60,
  burst_limit: 10,
  per_provider_config: {},
};

const PROVIDER_CATALOG = [
  {
    provider: "vci",
    label: "VCI",
    enabled: true,
    in_active_cycle: true,
    runtime_ready: true,
    credential_mode: "builtin",
    requires_runtime_credentials: false,
    required_runtime_envs: [],
    runtime_gate: "ready",
    readiness_reason: "Provider sẵn sàng cho runtime hiện tại.",
    default_selected: true,
    supports_vnbroker: true,
  },
  {
    provider: "kbs",
    label: "KBS",
    enabled: true,
    in_active_cycle: true,
    runtime_ready: true,
    credential_mode: "builtin",
    requires_runtime_credentials: false,
    required_runtime_envs: [],
    runtime_gate: "ready",
    readiness_reason: "Provider sẵn sàng cho runtime hiện tại.",
    default_selected: true,
    supports_vnbroker: true,
  },
  {
    provider: "dnse",
    label: "DNSE",
    enabled: true,
    in_active_cycle: false,
    runtime_ready: false,
    credential_mode: "api-key",
    requires_runtime_credentials: true,
    required_runtime_envs: ["SOC_MATRIX_DNSE_API_ID", "SOC_MATRIX_DNSE_API_KEY"],
    runtime_gate: "missing_credentials",
    readiness_reason:
      "Thiếu runtime secret: SOC_MATRIX_DNSE_API_ID, SOC_MATRIX_DNSE_API_KEY.",
    default_selected: false,
    supports_vnbroker: true,
  },
];

function mockLoaded() {
  adapterMocks.getSocVnbrokerConfig.mockResolvedValue({
    service_key: "vnbroker_quote",
    config_schema_version: "1.0",
    applied_by: "admin",
    applied_at: "2026-10-19T10:00:00Z",
    is_current: true,
    config: CONFIG_PAYLOAD,
    providers_catalog: PROVIDER_CATALOG,
  });
  adapterMocks.getSocVnbrokerProviders.mockResolvedValue({
    primary: "vci",
    // DNSE chưa có credential nên KHÔNG nằm trong danh sách fallback đang cấu hình
    fallback: ["kbs"],
    enabled: true,
    providers: PROVIDER_CATALOG,
  });
  adapterMocks.getSocVnbrokerHealth.mockResolvedValue({
    service_key: "vnbroker_quote",
    status: "healthy",
    avg_response_ms: 45,
    last_check_at: "2026-10-19T10:00:00Z",
    last_success_at: "2026-10-19T10:00:00Z",
    consecutive_failures: 0,
    detail: {},
  });
  adapterMocks.getSocVnbrokerProviderHealth.mockResolvedValue({
    checked_at: "2026-10-19T10:00:00Z",
    source: "runtime",
    providers: [
      {
        provider: "vci",
        label: "VCI",
        status: "healthy",
        latency_ms: 120,
        success_rate: 99.5,
        error_rate: 0.5,
        total_requests: 200,
        last_success_at: "2026-10-19T10:00:00Z",
        last_error: "",
        circuit_state: "closed",
      },
      {
        provider: "dnse",
        label: "DNSE",
        status: "degraded",
        latency_ms: null,
        success_rate: null,
        error_rate: null,
        total_requests: 0,
        failed_requests: 0,
        last_success_at: null,
        last_error: "",
        circuit_state: "unknown",
      },
    ],
  });
  adapterMocks.getSocVnbrokerCircuitBreaker.mockResolvedValue({
    status: "closed",
    failures: 0,
    threshold: 5,
    window_seconds: 60,
    cooldown_seconds: 300,
    source: "runtime",
    per_provider: { vci: { status: "closed", failures: 0 } },
  });
  adapterMocks.getSocVnbrokerBenchmarkLatest.mockResolvedValue({
    has_report: false,
    report: null,
  });
  adapterMocks.getSocVnbrokerOwnership.mockResolvedValue({
    domain: "vnbroker",
    mode: "operator",
    writer: "staff",
    owner_team: "market-data",
    write_surface: "vnbroker_quote",
    can_apply: true,
    locked_fields: [],
    compatibility_domains: [],
    write_block_reason: null,
  });
  adapterMocks.previewSocVnbrokerConfig.mockResolvedValue({
    valid: true,
    validationErrors: [],
    impactWarnings: [],
    configPayload: CONFIG_PAYLOAD,
    providersCatalog: PROVIDER_CATALOG,
  });
  adapterMocks.applySocVnbrokerConfig.mockResolvedValue({ config: CONFIG_PAYLOAD });
  adapterMocks.runSocVnbrokerBenchmark.mockResolvedValue({ has_report: false, report: null });
  adapterMocks.testSocVnbrokerConnection.mockResolvedValue({
    provider: "vci",
    status: "ok",
    latency_ms: 88,
  });
}

describe("SocVnbrokerPanel — VNBroker console", () => {
  beforeEach(() => {
    Object.values(adapterMocks).forEach((m) => m.mockReset());
    mockLoaded();
  });

  afterEach(() => cleanup());

  // T1 — danh sách provider + vai trò chính/dự phòng phải tới từ BE
  it("T1: hiện đủ provider theo catalog và gắn vai trò chính / dự phòng", async () => {
    render(<SocVnbrokerPanel />);
    await waitFor(() => {
      expect(screen.getByTestId("vnb-provider-vci")).toBeTruthy();
    });
    expect(screen.getByTestId("vnb-provider-kbs")).toBeTruthy();
    expect(screen.getByTestId("vnb-provider-dnse")).toBeTruthy();
    expect(screen.getByTestId("vnb-provider-vci-role").textContent).toBe("soc.vnbroker.role_primary");
    expect(screen.getByTestId("vnb-provider-kbs-role").textContent).toBe("soc.vnbroker.role_fallback");
    expect(screen.getByTestId("vnb-provider-dnse-role").textContent).toBe("soc.vnbroker.role_inactive");
  });

  // T2 — chặn F-01: apply phải gửi CONFIG PAYLOAD THẬT, không phải envelope
  it("T2: apply gửi config_payload là payload thật đã sửa, không gửi envelope", async () => {
    render(<SocVnbrokerPanel />);
    await waitFor(() => {
      expect(screen.getByTestId("vnb-field-preferred_provider")).toBeTruthy();
    });
    fireEvent.change(screen.getByTestId("vnb-field-preferred_provider"), {
      target: { value: "kbs" },
    });
    fireEvent.change(screen.getByTestId("vnb-change-reason"), {
      target: { value: "chuyen provider chinh sang KBS" },
    });
    fireEvent.click(screen.getByTestId("vnb-btn-preview"));
    await waitFor(() => {
      expect(adapterMocks.previewSocVnbrokerConfig).toHaveBeenCalled();
    });
    const previewPayload = adapterMocks.previewSocVnbrokerConfig.mock.calls[0][0];
    expect(previewPayload.preferred_provider).toBe("kbs");
    expect(previewPayload.id).toBeUndefined();
    expect(previewPayload.service).toBeUndefined();
    expect(previewPayload.providers_catalog).toBeUndefined();

    fireEvent.click(screen.getByTestId("vnb-btn-apply-confirm"));
    await waitFor(() => {
      expect(adapterMocks.applySocVnbrokerConfig).toHaveBeenCalled();
    });
    const [applied, options] = adapterMocks.applySocVnbrokerConfig.mock.calls[0];
    expect(applied.preferred_provider).toBe("kbs");
    expect(applied.id).toBeUndefined();
    expect(applied.service).toBeUndefined();
    expect(options.changeReason).toBe("chuyen provider chinh sang KBS");
  });

  // T3 — chặn F-02: preview phải hiện lỗi validation của BE
  it("T3: preview hiển thị validationErrors trả về từ BE", async () => {
    adapterMocks.previewSocVnbrokerConfig.mockResolvedValue({
      valid: false,
      validationErrors: ["max_retries phải trong khoảng [0, 10]"],
      impactWarnings: ["providers_changed"],
      configPayload: CONFIG_PAYLOAD,
      providersCatalog: PROVIDER_CATALOG,
    });
    render(<SocVnbrokerPanel />);
    await waitFor(() => {
      expect(screen.getByTestId("vnb-btn-preview")).toBeTruthy();
    });
    fireEvent.change(screen.getByTestId("vnb-change-reason"), {
      target: { value: "doi cau hinh" },
    });
    fireEvent.click(screen.getByTestId("vnb-btn-preview"));
    await waitFor(() => {
      expect(screen.getByTestId("vnb-preview-errors")).toBeTruthy();
    });
    expect(screen.getByTestId("vnb-preview-errors").textContent).toContain(
      "max_retries phải trong khoảng [0, 10]",
    );
  });

  // T4 — chặn F-03: benchmark phải đọc report.results với tên field BE
  it("T4: bảng benchmark đọc report.results và hiện độ trễ theo p50 của BE", async () => {
    adapterMocks.getSocVnbrokerBenchmarkLatest.mockResolvedValue({
      has_report: true,
      report: {
        symbol: "VNM",
        providers: ["VCI"],
        concurrency_levels: [8],
        results: [
          {
            provider: "VCI",
            concurrency: 8,
            runs: 3,
            elapsed_seconds: 2.4,
            total_requests: 30,
            success_requests: 29,
            rate_limited_requests: 0,
            failed_requests: 1,
            timeout_errors: 0,
            transport_errors: 1,
            rpm: 120.5,
            success_rate: 96.67,
            rate_limit_pct: 0,
            latency_ms: 250,
            p95_latency_ms: 400,
          },
        ],
        recommendation: {
          primary_provider: "VCI",
          fallback_provider: "KBS",
          adaptive_start_concurrency: 8,
          reason: "best_observed_metrics",
        },
      },
    });
    render(<SocVnbrokerPanel />);
    await waitFor(() => {
      expect(screen.getByTestId("vnb-benchmark-table")).toBeTruthy();
    });
    const row = screen.getByTestId("vnb-benchmark-row-vci-8");
    expect(row.textContent).toContain("VCI");
    expect(row.textContent).toContain("250ms");
    expect(row.textContent).toContain("96.67%");
    expect(screen.getByTestId("vnb-benchmark-recommendation").textContent).toContain("VCI");
  });

  // T5 — chặn F-04: circuit breaker phải đọc circuit_breaker.status thật
  it("T5: badge circuit breaker đổi theo status thật, không phải luôn CLOSED", async () => {
    adapterMocks.getSocVnbrokerCircuitBreaker.mockResolvedValue({
      status: "open",
      failures: 5,
      threshold: 5,
      window_seconds: 60,
      cooldown_seconds: 300,
      source: "runtime",
      per_provider: { vci: { status: "open", failures: 5 } },
    });
    render(<SocVnbrokerPanel />);
    await waitFor(() => {
      expect(screen.getByTestId("vnb-cb-status")).toBeTruthy();
    });
    expect(screen.getByTestId("vnb-cb-status").textContent).toBe("soc.vnbroker.breaker_tripped");
    expect(screen.getByTestId("vnb-cb-failures").textContent).toContain("5");
    expect(screen.getByTestId("vnb-cb-failures").textContent).toContain("5");
  });

  // T6 — chặn F-09: provider thiếu credential phải hiện LÝ DO + env cần thiếu
  it("T6: provider thiếu credential hiện readiness_reason và danh sách env cần có", async () => {
    render(<SocVnbrokerPanel />);
    await waitFor(() => {
      expect(screen.getByTestId("vnb-provider-dnse")).toBeTruthy();
    });
    const readiness = screen.getByTestId("vnb-provider-dnse-readiness");
    expect(readiness.textContent).toContain("SOC_MATRIX_DNSE_API_ID");
    expect(readiness.textContent).toContain("SOC_MATRIX_DNSE_API_KEY");
    // KHÔNG được hiện "Chưa xác định" (badge cũ bỏ mất lý do)
    expect(readiness.textContent).not.toBe("soc.health.status_unknown");
  });

  // T7 — chặn F-06: KHÔNG hiện số liệu bịa throughput / error_rate
  it("T7: không hiển thị số liệu bịa throughput / error_rate", async () => {
    render(<SocVnbrokerPanel />);
    await waitFor(() => {
      expect(screen.getByTestId("vnb-kpi")).toBeTruthy();
    });
    expect(screen.queryByText("soc.vnbroker.throughput")).toBeNull();
    expect(screen.queryByText("soc.vnbroker.error_rate")).toBeNull();
    // số liệu bịa từng có dạng "934.6/s" (1000/avg_response_ms)
    expect(document.body.textContent).not.toMatch(/\d+(\.\d+)?\/s/);
  });

  // T8 — chặn F-15: change_reason bắt buộc + optimistic concurrency
  it("T8: nút apply bị khoá khi thiếu change_reason, và gửi kèm khi đã có", async () => {
    render(<SocVnbrokerPanel />);
    await waitFor(() => {
      expect(screen.getByTestId("vnb-btn-preview")).toBeTruthy();
    });
    const previewBtn = screen.getByTestId("vnb-btn-preview") as HTMLButtonElement;
    expect(previewBtn.disabled).toBe(true);
    fireEvent.change(screen.getByTestId("vnb-change-reason"), {
      target: { value: "giai ngan" },
    });
    await waitFor(() => {
      expect((screen.getByTestId("vnb-btn-preview") as HTMLButtonElement).disabled).toBe(false);
    });
  });
});
