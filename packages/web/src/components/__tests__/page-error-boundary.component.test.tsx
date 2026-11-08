import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { PageErrorBoundary } from "../PageErrorBoundary";

afterEach(() => cleanup());

describe("PageErrorBoundary (B1)", () => {
  it("renders error shell with retry when child throws", () => {
    const onRetry = vi.fn();
    function Boom() {
      throw new Error("boom-fail");
    }
    render(
      <PageErrorBoundary fallbackTitle="Oops" errorMessage="msg-kept" retryLabel="Retry-kept" onRetry={onRetry}>
        <Boom />
      </PageErrorBoundary>,
    );
    expect(screen.getByText("Oops")).toBeTruthy();
    expect(screen.getByText("msg-kept")).toBeTruthy();
    const btn = screen.getByRole("button");
    expect(btn.textContent).toBe("Retry-kept");
    fireEvent.click(btn);
    expect(onRetry).toHaveBeenCalled();
  });

  it("does not hardcode StockDetail log or sdp classes", async () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    function Boom() {
      throw new Error("boom2");
    }
    const { container } = render(
      <PageErrorBoundary fallbackTitle="T" errorMessage="E" retryLabel="R">
        <Boom />
      </PageErrorBoundary>,
    );
    expect(container.querySelector('[class*="sdp-"]')).toBeNull();
    const logged = errSpy.mock.calls.map((c) => String(c[0]));
    expect(logged.some((s) => s.includes("[StockDetailPage]"))).toBe(false);
    errSpy.mockRestore();
  });
});
