import { useRef, useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useModalA11y } from "../useModalA11y.js";

function Harness({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useModalA11y(true, onClose, ref);
  return (
    <div>
      <button data-testid="outside">outside</button>
      <div ref={ref} role="dialog" aria-modal="true">
        <button data-testid="first">first</button>
        <button data-testid="last">last</button>
      </div>
    </div>
  );
}

describe("W1-a11y modal behavior", () => {
  it("Escape đóng modal", () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("Tab từ nút cuối quay về nút đầu; Shift+Tab ngược lại", () => {
    render(<Harness onClose={vi.fn()} />);
    const first = screen.getByTestId("first");
    const last = screen.getByTestId("last");
    last.focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(document.activeElement).toBe(first);
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(last);
  });

  it("focus ban đầu nằm trong modal, KHÔNG nằm ngoài", () => {
    render(<Harness onClose={vi.fn()} />);
    expect(document.activeElement).toBe(screen.getByTestId("first"));
  });
});
