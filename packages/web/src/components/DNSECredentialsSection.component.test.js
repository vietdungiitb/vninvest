import { render, screen, waitFor, fireEvent, act } from "@testing-library/react";
import { createElement } from "react";
import { DNSECredentialsSection } from "./DNSECredentialsSection";
import { coreApiAdapter } from "../adapters/coreApiAdapter.js";
import * as LangContext from "../context/LangContext.js";

vi.mock("./ConfirmModal.js", () => ({
  useConfirm: () => () => Promise.resolve(true),
  ConfirmProvider: ({ children }) => children,
}));

const i18nValue = {
  locale: "vi",
  localeTag: "vi-VN",
  t: (key) => key,
  formatNumber: (n) => n,
  formatCurrency: (n) => n,
  formatPriceVND: (n) => n,
  formatQuotePrice: (p) => p,
  formatQuoteVolume: (v) => v,
  formatQuoteInteger: (v) => v,
  formatDate: (d) => d,
  formatTime: (t) => t,
  formatDateTime: (dt) => dt,
};

beforeEach(() => {
  vi.spyOn(coreApiAdapter, "getDNSEConfig").mockResolvedValue({
    is_configured: true,
    data: { is_active: true, client_id_preview: "cid-1", last_sync_at: "2024-01-01T00:00:00Z" },
  });
  vi.spyOn(coreApiAdapter, "updateDNSEConfig").mockResolvedValue({ ok: true });
  vi.spyOn(coreApiAdapter, "deleteDNSEConfig").mockResolvedValue({ ok: true });
  vi.spyOn(LangContext, "useI18n").mockReturnValue(i18nValue);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("DNSECredentialsSection", () => {
  it("renders the DNSE credentials section title (Slice 1 restore)", async () => {
    await act(async () => {
      render(createElement(DNSECredentialsSection, {}));
    });
    await waitFor(() => {
      expect(screen.getByText("settings.dnseTitle")).toBeTruthy();
    });
    expect(coreApiAdapter.getDNSEConfig).toHaveBeenCalledTimes(1);
  });

  it("deletes the DNSE config when confirmed (Slice 1)", async () => {
    await act(async () => {
      render(createElement(DNSECredentialsSection, {}));
    });
    await waitFor(() => {
      expect(screen.getByText("settings.dnseTitle")).toBeTruthy();
    });

    await act(async () => {
      fireEvent.click(screen.getByText("settings.dnseDeleteBtn"));
    });

    await waitFor(() => {
      expect(coreApiAdapter.deleteDNSEConfig).toHaveBeenCalled();
    });
  });
});
