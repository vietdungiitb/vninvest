import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { AlertCard } from "./AlertCard.js";

function baseAlert(over: any = {}) {
  return {
    alert_id: "card-1",
    symbol: "VBB",
    severity: "medium",
    title: "Cá mập mua VBB: 588,479,248đ",
    body: "Cá mập mua VBB: 588,479,248đ",
    freshness_state: "fresh",
    session_date: "2026-09-21",
    triggered_at: "2026-09-21T06:36:40Z",
    value: 588479248,
    direction: "buy",
    confidence: 0.85,
    alert_family: "whale",
    evidence: {},
    ...over,
  };
}

function baseProps(over: any = {}) {
  const noop = vi.fn();
  return {
    alert: baseAlert(),
    lane: "main",
    busyAlertId: "",
    isEvidenceExpanded: false,
    toggleEvidence: noop,
    handleLoadDetail: noop,
    handleAcknowledge: noop,
    handleMuteSymbol: noop,
    formatAlertValue: (v: unknown) => String(v),
    formatAlertTimestamp: (v: unknown) => String(v),
    ...over,
  };
}

describe("AlertCard (Slice 1.2 + 3.1)", () => {
  afterEach(() => cleanup());

  it("an summary khi trung title (comma-đ vs dot-VND)", () => {
    const { container } = render(<AlertCard {...baseProps()} />);
    // title hien 1 lan, khong con doan summary lap lai
    const matches = (container.textContent!.match(/Cá mập mua VBB/g) || []).length;
    expect(matches).toBe(1);
  });

  it("hien summary khi khac title", () => {
    render(<AlertCard {...baseProps({ alert: baseAlert({ body: "Nội dung bổ sung thật" }) })} />);
    expect(screen.getByText("Nội dung bổ sung thật")).toBeTruthy();
  });

  it("Xem thêm/Thu gon toggle chi tiet", () => {
    const { container } = render(
      <AlertCard {...baseProps({ alert: baseAlert({ evidence: { a: 1 } }) })} />
    );
    expect(container.textContent).not.toContain("alertCenter.labelSession");
    fireEvent.click(screen.getByRole("button", { name: "alertCenter.detailExpand" }));
    expect(container.textContent).toContain("alertCenter.labelSession");
    fireEvent.click(screen.getByRole("button", { name: "alertCenter.detailCollapse" }));
    expect(container.textContent).not.toContain("alertCenter.labelSession");
  });

  it("evidence marker doi ▼/▶ theo expanded", () => {
    const { rerender } = render(
      <AlertCard {...baseProps({ alert: baseAlert({ evidence: { a: 1 } }) })} />
    );
    fireEvent.click(screen.getByRole("button", { name: "alertCenter.detailExpand" }));
    expect(screen.getByText("▶")).toBeTruthy();
    rerender(<AlertCard {...baseProps({ alert: baseAlert({ evidence: { a: 1 } }), isEvidenceExpanded: true })} />);
    expect(screen.getByText("▼")).toBeTruthy();
  });

  it("hien dong whale fill khi co whale_detail", () => {
    render(
      <AlertCard
        {...baseProps({
          alert: baseAlert({ whale_detail: { price: 49000, volume: 12000 } }),
        })}
      />
    );
    expect(screen.getByText("alertCenter.whaleFill")).toBeTruthy();
  });

  it("symbol la hyperlink toi /stocks/:symbol", () => {
    const { container } = render(<AlertCard {...baseProps()} />);
    const link = container.querySelector('a[href="/stocks/VBB"]');
    expect(link).toBeTruthy();
    expect(link?.textContent).toContain("VBB");
  });
});
