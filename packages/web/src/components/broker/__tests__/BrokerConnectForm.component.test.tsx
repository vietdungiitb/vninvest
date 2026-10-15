import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { BrokerConnectForm } from "../BrokerConnectForm.js";

/**
 * TDD fail-before (mbw2-hub, B2.2/AC2): form connect PHẢI render field động từ
 * `GET /broker/config-schema/<provider>/`, không hardcode field DNSE.
 * Schema dưới đây là payload SSI thật (BE `broker/ssi.py:get_schema`) — form
 * nhận qua prop `schema` (page fetch bằng `getBrokerSchema`), test này chỉ
 * kiểm render + validate + submit.
 */

const adapterMocks = vi.hoisted(() => ({
  saveBrokerConfig: vi.fn(),
  testBrokerConnection: vi.fn(),
}));

vi.mock("../../../adapters/coreApiAdapter.js", () => ({
  defaultCoreApiAdapter: {
    saveBrokerConfig: adapterMocks.saveBrokerConfig,
    testBrokerConnection: adapterMocks.testBrokerConnection,
  },
  coreApiAdapter: {
    saveBrokerConfig: adapterMocks.saveBrokerConfig,
    testBrokerConnection: adapterMocks.testBrokerConnection,
  },
}));

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
      help_i18n: "broker.ssi.api_key_help",
    },
    {
      key: "api_secret",
      type: "password",
      required: true,
      secret: true,
      label_i18n: "broker.ssi.api_secret",
      placeholder: "SSI API Secret",
      help_i18n: "broker.ssi.api_secret_help",
    },
    {
      key: "client_id",
      type: "text",
      required: false,
      secret: false,
      label_i18n: "broker.ssi.client_id",
      placeholder: "VD: 1234561",
      help_i18n: "broker.ssi.client_id_help",
    },
    {
      key: "private_key",
      type: "password",
      required: false,
      secret: true,
      label_i18n: "broker.ssi.private_key",
      placeholder: "Khoa RSA ky lenh",
      help_i18n: "broker.ssi.private_key_help",
    },
  ],
};

describe("BrokerConnectForm — schema-driven (B2.2/AC2)", () => {
  beforeEach(() => {
    adapterMocks.saveBrokerConfig.mockReset().mockResolvedValue({ ok: true });
    adapterMocks.testBrokerConnection.mockReset().mockResolvedValue({ ok: true });
  });

  afterEach(() => cleanup());

  it("renders one input per schema field — no hardcoded DNSE fields", () => {
    const { container } = render(<BrokerConnectForm provider="ssi" schema={SSI_SCHEMA} />);
    const inputs = container.querySelectorAll("input");
    expect(inputs.length).toBe(SSI_SCHEMA.fields.length);
    expect(screen.getByPlaceholderText("SSI API Key")).toBeTruthy();
    expect(screen.getByPlaceholderText("SSI API Secret")).toBeTruthy();
    // Chuỗi chỉ tồn tại ở schema DNSE (BE `broker/dnse.py`) — form SSI không được có.
    expect(screen.queryByText("EntradeX")).toBeNull();
    expect(screen.queryByPlaceholderText("Client Secret")).toBeNull();
  });

  it("blocks save when a required field is missing (key brokerHub.hub.*)", async () => {
    render(<BrokerConnectForm provider="ssi" schema={SSI_SCHEMA} />);
    fireEvent.click(screen.getByRole("button", { name: "Lưu kết nối" }));
    await waitFor(() => {
      expect(screen.getByText("Vui lòng nhập api_key.")).toBeTruthy();
    });
    expect(adapterMocks.saveBrokerConfig).not.toHaveBeenCalled();
  });

  it("saves all field values when required fields are filled", async () => {
    render(<BrokerConnectForm provider="ssi" schema={SSI_SCHEMA} />);
    fireEvent.change(screen.getByPlaceholderText("SSI API Key"), {
      target: { value: "KEY123" },
    });
    fireEvent.change(screen.getByPlaceholderText("SSI API Secret"), {
      target: { value: "SECRET123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Lưu kết nối" }));
    await waitFor(() => {
      expect(adapterMocks.saveBrokerConfig).toHaveBeenCalledTimes(1);
    });
    const [provider, payload] = adapterMocks.saveBrokerConfig.mock.calls[0];
    expect(provider).toBe("ssi");
    expect(payload.api_key).toBe("KEY123");
    expect(payload.api_secret).toBe("SECRET123");
    await waitFor(() => {
      expect(screen.getByText("Đã lưu kết nối ssi.")).toBeTruthy();
    });
  });

  it("tests connection through the adapter for the active lane", async () => {
    adapterMocks.testBrokerConnection.mockResolvedValue({ ok: true, account_count: 2 });
    render(<BrokerConnectForm provider="ssi" schema={SSI_SCHEMA} />);
    fireEvent.change(screen.getByPlaceholderText("SSI API Key"), {
      target: { value: "KEY123" },
    });
    fireEvent.change(screen.getByPlaceholderText("SSI API Secret"), {
      target: { value: "SECRET123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Kiểm tra kết nối" }));
    await waitFor(() => {
      expect(adapterMocks.testBrokerConnection).toHaveBeenCalledWith("ssi");
    });
  });
});
