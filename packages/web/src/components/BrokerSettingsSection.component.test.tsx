import { render, screen, waitFor, fireEvent, act } from "@testing-library/react";
import { createElement } from "react";
import { BrokerSettingsSection } from "./BrokerSettingsSection";
import { coreApiAdapter } from "../adapters/coreApiAdapter.js";
import * as LangContext from "../context/LangContext.js";

vi.mock("./ConfirmModal.js", () => ({
  useConfirm: () => () => Promise.resolve(true),
  ConfirmProvider: ({ children }: { children: unknown }) => children,
}));

const i18nValue = {
  locale: "vi",
  localeTag: "vi-VN",
  t: (key: string) => key,
  formatNumber: (n: unknown) => n,
  formatCurrency: (n: unknown) => n,
  formatPriceVND: (n: unknown) => n,
  formatQuotePrice: (p: unknown) => p,
  formatQuoteVolume: (v: unknown) => v,
  formatQuoteInteger: (v: unknown) => v,
  formatDate: (d: unknown) => d,
  formatTime: (t: unknown) => t,
  formatDateTime: (dt: unknown) => dt,
};

const schemaDnse = {
  provider: "dnse",
  test_connection_kind: "accounts",
  fields: [
    { key: "client_id", type: "text", required: true, secret: true, label_i18n: "broker.dnse.client_id" },
    { key: "client_secret", type: "password", required: true, secret: true, label_i18n: "broker.dnse.client_secret" },
  ],
};

beforeEach(() => {
  vi.spyOn(coreApiAdapter as unknown as Record<string, (...a: never[]) => Promise<unknown>>, "getBrokerProviders")
    .mockResolvedValue({
      providers: [
        { id: "dnse", status: "never_connected", is_configured: false },
        { id: "ssi", status: "not_supported_yet", is_configured: false },
        { id: "tcbs", status: "not_supported_yet", is_configured: false },
      ],
    });
  vi.spyOn(coreApiAdapter as unknown as Record<string, (...a: never[]) => Promise<unknown>>, "getBrokerSchema")
    .mockResolvedValue(schemaDnse);
  vi.spyOn(coreApiAdapter as unknown as Record<string, (...a: never[]) => Promise<unknown>>, "getBrokerConfig")
    .mockResolvedValue({ is_configured: false });
  vi.spyOn(coreApiAdapter as unknown as Record<string, (...a: never[]) => Promise<unknown>>, "saveBrokerConfig")
    .mockResolvedValue({ ok: true, is_configured: true });
  vi.spyOn(coreApiAdapter as unknown as Record<string, (...a: never[]) => Promise<unknown>>, "deleteBrokerConfig")
    .mockResolvedValue({ ok: true });
  vi.spyOn(coreApiAdapter as unknown as Record<string, (...a: never[]) => Promise<unknown>>, "testBrokerConnection")
    .mockResolvedValue({ job_id: "job-1" });
  vi.spyOn(coreApiAdapter as unknown as Record<string, (...a: never[]) => Promise<unknown>>, "getBrokerJob")
    .mockResolvedValue({ state: "succeeded", result: { ok: true, account_count: 2 } });
  vi.spyOn(LangContext, "useI18n").mockReturnValue(i18nValue);
});

afterEach(() => {
  vi.restoreAllMocks();
});

async function renderSection() {
  await act(async () => {
    render(createElement(BrokerSettingsSection, {}));
  });
  await waitFor(() => {
    expect(screen.getByText("broker.title")).toBeTruthy();
  });
  await waitFor(() => {
    expect(screen.getByText("broker.form_save")).toBeTruthy();
  });
}

describe("BrokerSettingsSection", () => {
  it("renders 3 broker tiles with SSI/TCBS marked coming soon", async () => {
    await renderSection();
    expect(screen.getByText("broker.name_dnse")).toBeTruthy();
    expect(screen.getAllByTitle("broker.tile_coming_soon")).toHaveLength(2);
  });

  it("blocks save with inline error when required fields are empty", async () => {
    await renderSection();
    await act(async () => {
      fireEvent.click(screen.getByText("broker.form_save"));
    });
    await waitFor(() => {
      expect(screen.getAllByText("broker.field_required").length).toBeGreaterThan(0);
    });
    expect(
      (coreApiAdapter as unknown as Record<string, (...a: never[]) => Promise<unknown>>).saveBrokerConfig,
    ).not.toHaveBeenCalled();
  });

  it("saves valid form via saveBrokerConfig", async () => {
    await renderSection();
    const idInput = document.querySelector('input[name="client_id"]') as HTMLInputElement;
    const secretInput = document.querySelector('input[name="client_secret"]') as HTMLInputElement;
    expect(idInput).toBeTruthy();
    expect(secretInput).toBeTruthy();
    await act(async () => {
      fireEvent.change(idInput, { target: { value: "CID1" } });
      fireEvent.change(secretInput, { target: { value: "SEC1" } });
      fireEvent.click(screen.getByText("broker.form_save"));
    });
    await waitFor(() => {
      expect(
        (coreApiAdapter as unknown as Record<string, (...a: never[]) => Promise<unknown>>).saveBrokerConfig,
      ).toHaveBeenCalledWith("dnse", { client_id: "CID1", client_secret: "SEC1" });
    });
  });

  it("runs test-connection and polls job to success", async () => {
    await renderSection();
    await act(async () => {
      fireEvent.click(screen.getByText("broker.test_button"));
    });
    const adapter = coreApiAdapter as unknown as Record<string, (...a: never[]) => Promise<unknown>>;
    await waitFor(
      () => {
        expect(adapter.testBrokerConnection).toHaveBeenCalledWith("dnse");
      },
      { timeout: 5000 },
    );
    await waitFor(
      () => {
        expect(
          screen.getByText((_content, el) =>
            (el?.textContent || "").startsWith("broker.test_ok")),
        ).toBeTruthy();
      },
      { timeout: 8000 },
    );
  }, 20000);
});
