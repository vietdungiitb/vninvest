import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AuthRegisterPage } from "../AuthRegisterPage";

const mocks = vi.hoisted(() => ({ registerUser: vi.fn() }));

vi.mock("../../../adapters/coreApiAdapter.js", () => ({
  coreApiAdapter: { registerUser: mocks.registerUser },
}));

// Giong widget that (test-key branch): KHONG tu ban onVerify trong effect
// (mock cu lam vay + parent truyen inline arrow => loop vo han => treo test).
// Thay vao do render nut; test phai click de xac minh — dung contract that.
vi.mock("../../../components/auth/TurnstileWidget.js", () => ({
  TurnstileWidget: ({ onVerify }: { onVerify?: (t: string) => void }) => {
    const { createElement } = require("react");
    return createElement(
      "button",
      { type: "button", "data-testid": "turnstile-test-trigger", onClick: () => onVerify?.("cf-test-token") },
      "Turnstile test token",
    );
  },
}));

afterEach(() => {
  cleanup();
  mocks.registerUser.mockReset();
});

describe("AuthRegisterPage RHF+zod (B6)", () => {
  it("wraps inputs in FormField (B6 migration marker)", async () => {
    const { container } = render(
      <MemoryRouter>
        <AuthRegisterPage />
      </MemoryRouter>,
    );
    expect(container.querySelectorAll(".form-field").length).toBeGreaterThan(0);
  });

  it("mismatch password_confirm shows alert and does not call API", async () => {
    render(
      <MemoryRouter>
        <AuthRegisterPage />
      </MemoryRouter>,
    );
    fireEvent.change(screen.getByLabelText(/auth\.registerUsernameLabel/), { target: { value: "user_1" } });
    fireEvent.change(screen.getByLabelText(/auth\.registerEmailLabel/), { target: { value: "u@example.com" } });
    fireEvent.change(screen.getByLabelText(/auth\.registerPasswordLabel/), { target: { value: "secret-12345" } });
    fireEvent.change(screen.getByLabelText(/auth\.registerPasswordConfirmLabel/), { target: { value: "different-123" } });
    // Nut submit disabled khi chua co turnstile token — phai verify truoc.
    // Mismatch van duoc kiem tra truoc API (onSubmit branch 1).
    fireEvent.click(screen.getByTestId("turnstile-test-trigger"));
    fireEvent.click(screen.getByRole("button", { name: /auth\.registerSubmit/ }));
    await waitFor(() => {
      expect(screen.getAllByRole("alert").length).toBeGreaterThan(0);
    });
    expect(mocks.registerUser).not.toHaveBeenCalled();
  });

  it("submits valid payload shape with normalized username and trimmed email", async () => {
    mocks.registerUser.mockResolvedValue({ username: "user_1", email: "u@example.com", message: "" });
    render(
      <MemoryRouter>
        <AuthRegisterPage />
      </MemoryRouter>,
    );
    fireEvent.change(screen.getByLabelText(/auth\.registerUsernameLabel/), { target: { value: "User_1" } });
    fireEvent.change(screen.getByLabelText(/auth\.registerEmailLabel/), { target: { value: "  u@example.com  " } });
    fireEvent.change(screen.getByLabelText(/auth\.registerPasswordLabel/), { target: { value: "secret-12345" } });
    fireEvent.change(screen.getByLabelText(/auth\.registerPasswordConfirmLabel/), { target: { value: "secret-12345" } });
    // Mock giong widget that: phai click nut test-trigger de co token (khong tu ban).
    fireEvent.click(screen.getByTestId("turnstile-test-trigger"));
    fireEvent.click(screen.getByRole("button", { name: /auth\.registerSubmit/ }));
    await waitFor(() => {
      expect(mocks.registerUser).toHaveBeenCalled();
    });
    const payload = mocks.registerUser.mock.calls[0][0] as Record<string, unknown>;
    expect(payload.username).toBe("user_1");
    expect(payload.email).toBe("u@example.com");
  });
});
