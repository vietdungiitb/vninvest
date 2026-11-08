import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { FormField } from "../FormField";

describe("FormField", () => {
  it("renders label linked to htmlFor", () => {
    render(
      <FormField label="Email" htmlFor="email-input">
        <input id="email-input" />
      </FormField>,
    );
    const label = screen.getByText("Email");
    expect(label.getAttribute("for")).toBe("email-input");
  });

  it("renders error with role alert and id", () => {
    render(
      <FormField label="Email" htmlFor="email-input" error="Required">
        <input id="email-input" />
      </FormField>,
    );
    const err = screen.getByRole("alert");
    expect(err.textContent).toBe("Required");
    expect(err.id).toBe("email-input-error");
  });

  it("renders hint with id", () => {
    render(
      <FormField label="Email" htmlFor="email-input" hint="Enter your email">
        <input id="email-input" />
      </FormField>,
    );
    const hint = screen.getByText("Enter your email");
    expect(hint.id).toBe("email-input-hint");
  });

  it("renders required marker", () => {
    render(
      <FormField label="Email" htmlFor="email-input" required>
        <input id="email-input" />
      </FormField>,
    );
    expect(screen.getByText("*", { exact: false })).toBeTruthy();
  });

  it("does not render error/hint when absent", () => {
    render(
      <FormField label="Email" htmlFor="email-input">
        <input id="email-input" />
      </FormField>,
    );
    expect(screen.queryByRole("alert")).toBeNull();
  });
});