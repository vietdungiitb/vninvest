import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AuthResetPasswordPage } from "../AuthResetPasswordPage";

const mocks = vi.hoisted(() => ({ requestPasswordReset: vi.fn(), confirmPasswordReset: vi.fn() }));

vi.mock("../../../adapters/coreApiAdapter.js", () => ({
  coreApiAdapter: { requestPasswordReset: mocks.requestPasswordReset, confirmPasswordReset: mocks.confirmPasswordReset },
}));

afterEach(() => {
  cleanup();
  mocks.requestPasswordReset.mockReset();
  mocks.confirmPasswordReset.mockReset();
});

describe("AuthResetPasswordPage RHF+zod (B6)", () => {
  it("wraps inputs in FormField (B6 migration marker)", async () => {
    const { container } = render(
      <MemoryRouter>
        <AuthResetPasswordPage />
      </MemoryRouter>,
    );
    expect(container.querySelectorAll(".form-field").length).toBeGreaterThan(0);
  });

  it("mismatch confirm shows alert and does not call confirm API", async () => {
    render(
      <MemoryRouter initialEntries={["/reset-password?token=abc"]}>
        <AuthResetPasswordPage />
      </MemoryRouter>,
    );
    fireEvent.change(screen.getByLabelText(/auth\.resetNewPasswordLabel/), { target: { value: "secret-12345" } });
    fireEvent.change(screen.getByLabelText(/auth\.resetConfirmPasswordLabel/), { target: { value: "different-123" } });
    fireEvent.click(screen.getByRole("button", { name: /auth\.resetConfirmSubmit/ }));
    await waitFor(() => {
      expect(screen.getAllByRole("alert").length).toBeGreaterThan(0);
    });
    expect(mocks.confirmPasswordReset).not.toHaveBeenCalled();
  });
});
