import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { createElement } from "react";
import { MemoryRouter } from "react-router-dom";
import { AdvisoryAlertDialog } from "../advisory/AdvisoryAlertDialog.js";
import { AdvisoryOrderTicket } from "../advisory/AdvisoryOrderTicket.js";
import { ActionChecklist } from "../advisory/ActionChecklist.js";
import * as coreApiAdapterModule from "@/adapters/coreApiAdapter.js";

const advisory = {
  symbol: "FPT",
  side: "BUY",
  confidence: 82,
  whale_intensity: 75,
  matched_value: 46000,
  created_at: "2026-09-25T10:00:00+07:00",
};

function renderWithRouter(node: React.ReactElement) {
  return render(createElement(MemoryRouter, null, node));
}

describe("AdvisoryAlertDialog (S14 G4)", () => {
  it("prefills target from matched_value and posts create payload", async () => {
    const createAlert = vi.fn(async () => ({ id: 7 }));
    renderWithRouter(createElement(AdvisoryAlertDialog, { advisory, symbol: "FPT", onClose: vi.fn(), createAlert }));
    const target = document.querySelector('input[type="number"]') as HTMLInputElement;
    expect(target.value).toBe("46000");
    fireEvent.click(screen.getByText("Tạo cảnh báo"));
    expect(await screen.findByText("Đã tạo cảnh báo.")).toBeTruthy();
    expect(createAlert).toHaveBeenCalledWith({
      symbol: "FPT",
      condition: "BELOW",
      target_price: 46000,
      cooldown_seconds: 300,
      is_active: true,
    });
    expect(screen.getByText("Xem cảnh báo").getAttribute("href")).toBe("/alert-center?symbol=FPT");
  });
});

describe("AdvisoryOrderTicket (S14 G5)", () => {
  it("labels itself PAPER trial, never real orders (ADR-005)", () => {
    renderWithRouter(createElement(AdvisoryOrderTicket, { advisory, symbol: "FPT", onClose: vi.fn(), placeOrder: vi.fn() }));
    expect(screen.getByText("Phiếu lệnh thử nghiệm (PAPER)")).toBeTruthy();
    expect(screen.getByText(/không tiền thật, không ra thị trường/)).toBeTruthy();
    expect(screen.queryByText(/lệnh thật khớp tiền thật/)).toBeNull();
  });
  it("prefills symbol/price, never auto-submits, posts only on explicit confirm", async () => {
    const placeOrder = vi.fn(async () => ({ result: { ok: true } }));
    renderWithRouter(createElement(AdvisoryOrderTicket, { advisory, symbol: "FPT", onClose: vi.fn(), placeOrder }));
    const price = document.querySelectorAll('input[type="number"]')[0] as HTMLInputElement;
    expect(price.value).toBe("46000");
    expect(placeOrder).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText("Xem lại lệnh"));
    const token = document.querySelector('input[type="password"]') as HTMLInputElement;
    fireEvent.change(token, { target: { value: "tok-123" } });
    fireEvent.click(screen.getByText("Xác nhận lệnh thử nghiệm"));
    expect(await screen.findByText("Đã gửi lệnh thử nghiệm.")).toBeTruthy();
    expect(placeOrder).toHaveBeenCalledWith({
      // PA-5: BE fail-closed (SAFE-01) — `mode` bắt buộc trong body, thiếu thì 400
      // `order_mode_required`. Chỉ gửi `paper`; `live` bị từ chối tới khi có
      // policy + OTP + risk limit + commercial license vnbroker.
      mode: "paper",
      market_type: "STOCK",
      order_category: "NORMAL",
      trading_token: "tok-123",
      payload: { symbol: "FPT", side: "BUY", price: 46000, quantity: 100, order_type: "LO" },
    });
  });

  it("AC-3: checklist proceed does not touch order API", () => {
    const onProceed = vi.fn();
    const placeSpy = vi.spyOn(coreApiAdapterModule.coreApiAdapter, "placeDNSEOrder").mockRejectedValue(new Error("must-not-call"));
    render(createElement(ActionChecklist, { symbol: "FPT", onProceed }));
    document.querySelectorAll('input[type="checkbox"]').forEach((box) => {
      fireEvent.click(box);
    });
    fireEvent.click(screen.getByText("✓ Tiến hành"));
    expect(onProceed).toHaveBeenCalled();
    expect(placeSpy).not.toHaveBeenCalled();
    placeSpy.mockRestore();
  });

  it("sends SELL as SELL, never defaulting to BUY", async () => {
    const placeOrder = vi.fn(async () => ({ result: { ok: true } }));
    renderWithRouter(createElement(AdvisoryOrderTicket, {
      advisory: { ...advisory, side: "SELL" },
      symbol: "FPT",
      onClose: vi.fn(),
      placeOrder,
    }));
    fireEvent.click(screen.getByText("Xem lại lệnh"));
    const token = document.querySelector('input[type="password"]') as HTMLInputElement;
    fireEvent.change(token, { target: { value: "tok-456" } });
    fireEvent.click(screen.getByText("Xác nhận lệnh thử nghiệm"));
    await screen.findByText("Đã gửi lệnh thử nghiệm.");
    expect(placeOrder.mock.calls[0][0].payload.side).toBe("SELL");
  });

  it("blocks ordering when the advisory direction cannot be resolved", () => {
    const placeOrder = vi.fn();
    renderWithRouter(createElement(AdvisoryOrderTicket, {
      advisory: { ...advisory, side: "UNKNOWN" },
      symbol: "FPT",
      onClose: vi.fn(),
      placeOrder,
    }));
    expect(screen.getByText(/Không xác định được chiều lệnh/)).toBeTruthy();
    const reviewButton = screen.getByText("Xem lại lệnh") as HTMLButtonElement;
    expect(reviewButton.disabled).toBe(true);
    expect(placeOrder).not.toHaveBeenCalled();
  });

  it("rejects a non-lot quantity instead of sending it to the broker", async () => {
    const placeOrder = vi.fn();
    renderWithRouter(createElement(AdvisoryOrderTicket, { advisory, symbol: "FPT", onClose: vi.fn(), placeOrder }));
    const quantity = document.querySelectorAll('input[type="number"]')[1] as HTMLInputElement;
    fireEvent.change(quantity, { target: { value: "37" } });
    const reviewButton = screen.getByText("Xem lại lệnh") as HTMLButtonElement;
    expect(reviewButton.disabled).toBe(true);
    expect(placeOrder).not.toHaveBeenCalled();
  });
});
