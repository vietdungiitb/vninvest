import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AuthLoginPage } from "../AuthLoginPage";

const mocks = vi.hoisted(() => ({ loginUser: vi.fn() }));

vi.mock("../../../adapters/coreApiAdapter.js", () => ({
  authTokenStorage: { hasTokens: () => false, setTokens: vi.fn(), clearTokens: vi.fn() },
  coreApiAdapter: { loginUser: mocks.loginUser, getTenantLifecycle: vi.fn(() => Promise.reject(new Error("no session"))) },
}));

afterEach(() => {
  cleanup();
  mocks.loginUser.mockReset();
});

describe("AuthLoginPage RHF+zod (B6)", () => {
  it("uses FormField wiring: label htmlFor + error role alert", async () => {
    render(
      <MemoryRouter>
        <AuthLoginPage />
      </MemoryRouter>,
    );
    const userInput = screen.getByLabelText(/auth\.loginUsernameLabel/) as HTMLInputElement;
    expect(userInput.id).toBe("auth-login-username");
    // submit empty -> client validation error via RHF/zod, no API call
    fireEvent.click(screen.getByRole("button", { name: /auth\.loginSubmit/ }));
    await waitFor(() => {
      expect(screen.getAllByRole("alert").length).toBeGreaterThan(0);
    });
    expect(mocks.loginUser).not.toHaveBeenCalled();
  });

  it("submits valid payload matching old shape (trimmed username)", async () => {
    mocks.loginUser.mockResolvedValue({ access: "a", refresh: "r" });
    render(
      <MemoryRouter>
        <AuthLoginPage />
      </MemoryRouter>,
    );
    fireEvent.change(screen.getByLabelText(/auth\.loginUsernameLabel/), { target: { value: "  User_1  " } });
    fireEvent.change(screen.getByLabelText(/auth\.loginPasswordLabel/), { target: { value: "secret-1234" } });
    fireEvent.click(screen.getByRole("button", { name: /auth\.loginSubmit/ }));
    await waitFor(() => {
      expect(mocks.loginUser).toHaveBeenCalledWith({ username: "User_1", password: "secret-1234" });
    });
  });
});
