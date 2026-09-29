/**
 * SAFE-01 R4 — badge Paper/Live phai hien thi mode do SERVER quyet dinh.
 *
 * Bug goc (verify bang lenh, khong phai doc code):
 *   grep "return Response(" views_dnse.py = 12 lan, KHONG lan nao co key `mode`.
 *   => Client gui `mode: "paper"` nhung khong bao gio biet server thuc su chay
 *      gi. Nguoi dung nhin "Dat lenh DNSE thanh cong." va co the tuong minh
 *      minh vua dat lenh THAT.
 *
 * Bai test nay kiem 3 thu:
 *   1. Server tra `mode: "paper"` => badge PAPER.
 *   2. Server tra `mode: "live"`  => badge LIVE (ke ca client gui `paper`).
 *   3. Server KHONG tra `mode`     => fallback PAPER, KHONG bao gio doan LIVE.
 */
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { createElement } from "react";
import * as coreApi from "../adapters/coreApiAdapter.js";
import DNSEConnectionPanel from "./DNSEConnectionPanel.js";

/**
 * Chay tron flow that cua panel: tao trading token truoc, roi dat lenh.
 * Token khong nhap tay — panel lay tu `createDNSETradingToken`, nen test phai
 * bam nut that thay vi gán state.
 */
async function submitOrder() {
  // Panel hien "Dang tai..." cho den khi `useDNSEStatus` fetch xong.
  await screen.findByText(/Kết nối DNSE LightSpeed API/i);

  const setById = (id, value) => {
    const el = document.getElementById(id);
    if (el) fireEvent.change(el, { target: { value } });
  };
  setById("dnse-passcode", "123456");

  const tokenBtn = await waitFor(() =>
    screen.getByRole("button", { name: /tạo trading token/i }),
  );
  fireEvent.click(tokenBtn);
  await waitFor(() => expect(coreApi.coreApiAdapter.createDNSETradingToken).toHaveBeenCalled());

  setById("dnse-order-account", "ACC001");
  setById("dnse-order-symbol", "VNM");
  setById("dnse-order-price", "10000");
  setById("dnse-order-quantity", "100");

  const button = await waitFor(() =>
    screen.getByRole("button", { name: /đặt lệnh thử nghiệm/i }),
  );
  fireEvent.click(button);
}

function renderPanel() {
  return render(createElement(DNSEConnectionPanel));
}

describe("SAFE-01 — badge mode cho don hang DNSE", () => {
  let spies;

  beforeEach(() => {
    spies = {
      place: vi.spyOn(coreApi.coreApiAdapter, "placeDNSEOrder"),
      otp: vi.spyOn(coreApi.coreApiAdapter, "sendDNSEEmailOtp").mockResolvedValue({
        mode: "paper",
        dry_run: true,
        result: {},
      }),
      token: vi.spyOn(coreApi.coreApiAdapter, "createDNSETradingToken").mockResolvedValue({
        ok: true,
        trading_token: "tok-123",
        mode: "paper",
        dry_run: true,
        result: {},
      }),
      configs: vi.spyOn(coreApi.coreApiAdapter, "getDNSEConfig").mockResolvedValue({
        ok: true,
        // Panel chi render khoi dat lenh khi `is_configured === true`
        // (`DNSEConnectionPanel.js:247`). Neu thieu, ca khoi order bi bo qua
        // va test se FAIL vi "khong tim thay nut", khong phai vi logic badge.
        is_configured: true,
        is_active: true,
      }),
      accounts: vi.spyOn(coreApi.coreApiAdapter, "syncDNSEAccounts").mockResolvedValue({ ok: true }),
      balances: vi.spyOn(coreApi.coreApiAdapter, "syncDNSEBalances").mockResolvedValue({ ok: true }),
      reconcile: vi
        .spyOn(coreApi.coreApiAdapter, "reconcileDNSETransactions")
        .mockResolvedValue({ ok: true }),
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("hien PAPER khi server xac nhan mode=paper", async () => {
    spies.place.mockResolvedValue({
      result: { ok: 1 },
      mode: "paper",
      dry_run: true,
      idempotent_replay: false,
    });
    renderPanel();
    await submitOrder();
    await waitFor(() => expect(spies.place).toHaveBeenCalled());
    const badge = await screen.findByTestId("dnse-order-mode-badge");
    expect(badge.textContent).toBe("PAPER");
  });

  it("hien LIVE khi server xac nhan mode=live, du client gui paper", async () => {
    // Client van gui `paper`; server quyet dinh `live`. Badge phai theo SERVER.
    spies.place.mockResolvedValue({
      result: { ok: 1 },
      mode: "live",
      dry_run: false,
      idempotent_replay: false,
    });
    renderPanel();
    await submitOrder();
    await waitFor(() => expect(spies.place).toHaveBeenCalled());
    const badge = await screen.findByTestId("dnse-order-mode-badge");
    expect(badge.textContent).toBe("LIVE");
  });

  it("KHONG hien LIVE khi server khong tra mode", async () => {
    // Response cu khong co `mode` (BE cu / contract chua doi). Phai fallback
    // PAPER — hien "LIVE" tren su doan thi nguy hiem hon hien sai.
    spies.place.mockResolvedValue({ result: { ok: 1 } });
    renderPanel();
    await submitOrder();
    await waitFor(() => expect(spies.place).toHaveBeenCalled());
    const badge = await screen.findByTestId("dnse-order-mode-badge");
    expect(badge.textContent).toBe("PAPER");
  });
});
