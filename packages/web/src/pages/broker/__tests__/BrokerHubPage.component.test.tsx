import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { BrokerHubPage } from "../BrokerHubPage.js";

/**
 * TDD fail-before (mbw2-hub, B2.1/AC1): route `/broker` render 3 tile, badge
 * chữ lấy từ `GET /broker/capabilities/` (matrix versioned BE `broker/base.py`),
 * trạng thái cấu hình từ `getBrokerProviders`. Mock đúng signature adapter
 * (DATA sở hữu `broker.js` — HUB không tự viết adapter).
 */

const adapterMocks = vi.hoisted(() => ({
  getBrokerProviders: vi.fn(),
  coreGet: vi.fn(),
  getBrokerSchema: vi.fn(),
  getDNSEConfig: vi.fn(),
}));

vi.mock("../../../adapters/coreApiAdapter.js", () => ({
  defaultCoreApiAdapter: {
    getBrokerProviders: adapterMocks.getBrokerProviders,
    coreGet: adapterMocks.coreGet,
    getBrokerSchema: adapterMocks.getBrokerSchema,
    getDNSEConfig: adapterMocks.getDNSEConfig,
  },
  coreApiAdapter: {
    getBrokerProviders: adapterMocks.getBrokerProviders,
    coreGet: adapterMocks.coreGet,
    getBrokerSchema: adapterMocks.getBrokerSchema,
    getDNSEConfig: adapterMocks.getDNSEConfig,
  },
}));

const PROVIDERS = {
  providers: [
    { id: "dnse", status: "active", is_configured: true, fully_supported: true },
    { id: "ssi", status: "never_connected", is_configured: false, fully_supported: false },
    { id: "tcbs", status: "never_connected", is_configured: false, fully_supported: false },
  ],
};

const CAPABILITIES = {
  version: "2026-09-26.1",
  providers: {
    dnse: {
      read_basic: true,
      read_positions: true,
      read_orders: true,
      trade: false,
      otp_required: false,
      verified_contract: true,
      verified_contract_by: "contract test + live sync production",
    },
    ssi: {
      read_basic: true,
      read_positions: true,
      read_orders: true,
      trade: false,
      otp_required: true,
      verified_contract: false,
      verified_contract_by: "market-only",
    },
    tcbs: {
      read_basic: true,
      read_positions: true,
      read_orders: true,
      trade: false,
      otp_required: true,
      verified_contract: false,
      verified_contract_by: "format-valid",
    },
  },
};

const DNSE_SCHEMA = {
  provider: "dnse",
  test_connection_kind: "accounts",
  fields: [
    {
      key: "client_id",
      type: "text",
      required: true,
      secret: true,
      label_i18n: "broker.dnse.client_id",
      placeholder: "EntradeX Client ID",
    },
    {
      key: "client_secret",
      type: "password",
      required: true,
      secret: true,
      label_i18n: "broker.dnse.client_secret",
      placeholder: "Client Secret",
    },
  ],
};

const SSI_SCHEMA = {
  provider: "ssi",
  test_connection_kind: "market_only",
  fields: [
    {
      key: "api_key",
      type: "password",
      required: true,
      secret: true,
      label_i18n: "broker.ssi.api_key",
      placeholder: "SSI API Key",
    },
  ],
};

function mockLoaded() {
  adapterMocks.getBrokerProviders.mockResolvedValue(PROVIDERS);
  adapterMocks.coreGet.mockImplementation(async (path: string) => {
    if (path === "/broker/capabilities/") return CAPABILITIES;
    throw new Error(`unexpected GET ${path}`);
  });
  adapterMocks.getBrokerSchema.mockImplementation(async (provider: string) =>
    provider === "ssi" ? SSI_SCHEMA : DNSE_SCHEMA,
  );
  adapterMocks.getDNSEConfig.mockResolvedValue({ is_configured: false });
}

function renderPage(initialEntries: string[] = ["/broker"]) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <BrokerHubPage />
    </MemoryRouter>,
  );
}

describe("BrokerHubPage — tiles + capability badges (B2.1/AC1)", () => {
  beforeEach(() => {
    Object.values(adapterMocks).forEach((m) => m.mockReset());
    mockLoaded();
  });

  afterEach(() => cleanup());

  it("renders one tile per provider with badge text from capabilities", async () => {
    renderPage();
    await waitFor(() => {
      expect(adapterMocks.coreGet).toHaveBeenCalledWith("/broker/capabilities/");
    });
    // 3 tile theo đúng provider BE trả về.
    expect(screen.getByText("DNSE")).toBeTruthy();
    expect(screen.getByText("SSI")).toBeTruthy();
    expect(screen.getByText("TCBS")).toBeTruthy();
    // Badge chữ từ matrix capabilities, không suy từ tên provider.
    await waitFor(() => {
      expect(screen.getByText("Đã xác minh đầy đủ")).toBeTruthy();
    });
    expect(screen.getAllByText("Chờ xác minh").length).toBe(2);
    expect(screen.getAllByText("Chỉ đọc").length).toBe(3);
    expect(screen.getAllByText("Yêu cầu OTP").length).toBe(2);
  });

  it("shows configured status from providers (not from capabilities)", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId("broker-tile-status-dnse")).toBeTruthy();
    });
    // Scope theo tile — panel DNSE legacy cũng render chữ "Chưa kết nối" riêng.
    expect(screen.getByTestId("broker-tile-status-dnse").textContent).toBe("Đã kết nối");
    expect(screen.getByTestId("broker-tile-status-ssi").textContent).toBe("Chưa kết nối");
    expect(screen.getByTestId("broker-tile-status-tcbs").textContent).toBe("Chưa kết nối");
  });

  it("renders the legacy DNSE panel untouched for the dnse lane", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Kết nối DNSE LightSpeed API")).toBeTruthy();
    });
  });

  it("selects lane via ?provider= (single full-state patch) and renders its schema form", async () => {
    renderPage(["/broker?provider=ssi"]);
    await waitFor(() => {
      expect(screen.getByPlaceholderText("SSI API Key")).toBeTruthy();
    });
    expect(screen.queryByText("Kết nối DNSE LightSpeed API")).toBeNull();
  });

  it("switching tile updates the URL provider param", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("SSI")).toBeTruthy();
    });
    fireEvent.click(screen.getByText("SSI"));
    await waitFor(() => {
      expect(screen.getByPlaceholderText("SSI API Key")).toBeTruthy();
    });
  });

  it("shows load error when providers fail (key brokerHub.hub.*)", async () => {
    adapterMocks.getBrokerProviders.mockRejectedValue(new Error("boom"));
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Không thể tải danh sách broker.")).toBeTruthy();
    });
  });
});
