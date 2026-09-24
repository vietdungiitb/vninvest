import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { createElement } from "react";
import { StaffSwitchBanner, readStaffSwitch, clearStaffSwitch } from "../StaffSwitchBanner.js";

afterEach(() => {
  cleanup();
  window.sessionStorage.removeItem("staff_switch");
});

describe("StaffSwitchBanner (R5 tenant-admin-refactor)", () => {
  it("renders nothing without a switch session", () => {
    const { container } = render(createElement(StaffSwitchBanner));
    expect(container.textContent).toBe("");
    expect(readStaffSwitch()).toBeNull();
  });

  it("shows tenant label and exits on click", () => {
    window.sessionStorage.setItem("staff_switch", JSON.stringify({
      token: "tok", tenant: { display_name: "Acme" },
    }));
    const reloadSpy = vi.fn();
    Object.defineProperty(window, "location", {
      value: { reload: reloadSpy },
      writable: true,
      configurable: true,
    });
    render(createElement(StaffSwitchBanner));
    expect(screen.getByText(/Acme/)).toBeTruthy();
    fireEvent.click(screen.getByText("Thoát xem hộ"));
    expect(window.sessionStorage.getItem("staff_switch")).toBeNull();
    expect(reloadSpy).toHaveBeenCalled();
    expect(clearStaffSwitch).toBeDefined();
  });
});
