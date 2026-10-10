import { fireEvent, render, screen } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import ForgotPassword from "./ForgotPassword";

const renderWithProviders = (component: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        {component}
      </QueryClientProvider>
    </BrowserRouter>,
  );
};

describe("ForgotPassword Component", () => {
  it("renders forgot password form with email field", () => {
    renderWithProviders(<ForgotPassword />);

    expect(
      screen.getByPlaceholderText("studio.login.placeholder.email"),
    ).toBeDefined();
    expect(screen.getByText("common.button.submit")).toBeDefined();
  });

  it("displays the app title and description", () => {
    renderWithProviders(<ForgotPassword />);

    expect(screen.getByText("Webuddhist Studio")).toBeDefined();
    expect(screen.getByText("studio.ui.auth_card.tagline")).toBeDefined();
  });

  it("shows back to login link", () => {
    renderWithProviders(<ForgotPassword />);

    expect(
      screen.getByText("studio.reset_password.back_to_login"),
    ).toBeDefined();
  });

  it("displays forgot password instructions", () => {
    renderWithProviders(<ForgotPassword />);

    expect(screen.getByText("studio.reset_password.description")).toBeDefined();
  });

  it("validates correct email format", () => {
    renderWithProviders(<ForgotPassword />);

    const emailInput = screen.getByPlaceholderText(
      "studio.login.placeholder.email",
    );
    const submitButton = screen.getByText("common.button.submit");

    fireEvent.change(emailInput, { target: { value: "test@example.com" } });
    fireEvent.click(submitButton);

    expect(screen.queryByText("studio.validation.email_invalid")).toBeNull();
  });
});
