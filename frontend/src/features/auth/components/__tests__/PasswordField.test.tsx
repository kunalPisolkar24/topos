import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/render-with-providers";
import { PasswordField } from "../PasswordField";

const mockRegister = {
  onChange: vi.fn(),
  onBlur: vi.fn(),
  ref: vi.fn(),
  name: "password",
};

describe("PasswordField", () => {
  it("toggles password visibility on button click", async () => {
    const user = userEvent.setup();

    renderWithProviders(
      <PasswordField
        id="password"
        label="Password"
        registration={mockRegister}
      />,
    );

    const input = screen.getByLabelText("Password");
    expect(input).toHaveAttribute("type", "password");

    await user.click(screen.getByRole("button", { name: /show password/i }));
    expect(input).toHaveAttribute("type", "text");
    expect(screen.getByRole("button", { name: /hide password/i })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /hide password/i }));
    expect(input).toHaveAttribute("type", "password");
  });

  it("uses default placeholder when none provided", () => {
    renderWithProviders(
      <PasswordField
        id="password"
        label="Password"
        registration={mockRegister}
      />,
    );

    expect(screen.getByPlaceholderText("Enter your password")).toBeInTheDocument();
  });

  it("renders error message", () => {
    renderWithProviders(
      <PasswordField
        id="password"
        label="Password"
        registration={mockRegister}
        error="Password is required"
      />,
    );

    expect(screen.getByText("Password is required")).toBeInTheDocument();
  });

  it("renders right label", () => {
    renderWithProviders(
      <PasswordField
        id="password"
        label="Password"
        registration={mockRegister}
        rightLabel={<span>Forgot?</span>}
      />,
    );

    expect(screen.getByText("Forgot?")).toBeInTheDocument();
  });
});
