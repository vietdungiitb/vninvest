import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { UserSettingsPage } from "../UserSettingsPage";

const mocks = vi.hoisted(() => ({ getUserProfile: vi.fn(), changeUserPassword: vi.fn() }));

vi.mock("../../adapters/coreApiAdapter.js", () => ({
  coreApiAdapter: {
    getUserProfile: mocks.getUserProfile,
    updateUserProfile: vi.fn(async () => ({})),
    changeUserPassword: mocks.changeUserPassword,
  },
}));

afterEach(() => {
  cleanup();
  mocks.getUserProfile.mockReset();
  mocks.changeUserPassword.mockReset();
});

describe("UserSettingsPage password form RHF+zod (B6)", () => {
  it("wraps password inputs in FormField", async () => {
    mocks.getUserProfile.mockResolvedValue({ username: "u", email: "e@x.com", display_name: "", language: "vi", theme: "dark" });
    const { container } = render(
      <MemoryRouter>
        <UserSettingsPage />
      </MemoryRouter>,
    );
    await waitFor(() => {
      expect(screen.getByLabelText(/Mật khẩu hiện tại/)).toBeTruthy();
    });
    expect(container.querySelectorAll(".form-field").length).toBeGreaterThan(0);
  });

  it("mismatch shows alert and does not call API", async () => {
    mocks.getUserProfile.mockResolvedValue({ username: "u", email: "e@x.com", display_name: "", language: "vi", theme: "dark" });
    render(
      <MemoryRouter>
        <UserSettingsPage />
      </MemoryRouter>,
    );
    await waitFor(() => screen.getByLabelText(/Mật khẩu hiện tại/));
    fireEvent.change(screen.getByLabelText(/Mật khẩu hiện tại/), { target: { value: "cur1234567" } });
    fireEvent.change(screen.getByLabelText(/Mật khẩu mới/), { target: { value: "secret-12345" } });
    fireEvent.change(screen.getByLabelText(/Nhập lại mật khẩu mới/), { target: { value: "different-12" } });
    fireEvent.click(screen.getByRole("button", { name: /userSettings\.passwordSave|Đổi mật khẩu/ }));
    await waitFor(() => {
      expect(screen.getAllByRole("alert").length).toBeGreaterThan(0);
    });
    expect(mocks.changeUserPassword).not.toHaveBeenCalled();
  });
});
