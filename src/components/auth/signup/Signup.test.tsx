import { render, screen, waitFor } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Signup from "./Signup";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import axiosInstance from "@/config/axios-config";

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

describe("Signup Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders signup form with all required fields", () => {
    renderWithProviders(<Signup />);

    expect(
      screen.getByPlaceholderText("studio.login.placeholder.email"),
    ).toBeDefined();
    expect(
      screen.getByPlaceholderText("studio.signup.placeholder.first_name"),
    ).toBeDefined();
    expect(
      screen.getByPlaceholderText("studio.signup.placeholder.last_name"),
    ).toBeDefined();
    expect(
      screen.getAllByPlaceholderText("studio.signup.placeholder.password"),
    ).toHaveLength(2);
    expect(screen.getByText("common.button.submit")).toBeDefined();
  });

  it("displays the app title and description", () => {
    renderWithProviders(<Signup />);

    expect(screen.getByText("Webuddhist Studio")).toBeDefined();
    expect(screen.getByText("studio.ui.auth_card.tagline")).toBeDefined();
  });

  it("shows login link", () => {
    renderWithProviders(<Signup />);

    expect(screen.getByText("sign_up.already_have_account")).toBeDefined();
  });

  it("renders all form labels correctly", () => {
    renderWithProviders(<Signup />);

    expect(screen.getByText("common.email")).toBeDefined();
    expect(screen.getByText("sign_up.form.first_name")).toBeDefined();
    expect(screen.getByText("sign_up.form.last_name")).toBeDefined();
    expect(screen.getByText("common.password")).toBeDefined();
    expect(screen.getByText("common.confirm_password")).toBeDefined();
  });

  it("displays signup title", () => {
    renderWithProviders(<Signup />);

    expect(screen.getByText("studio.signup.title")).toBeDefined();
  });

  it("displays validation error when passwords do not match", async () => {
    const user = userEvent.setup();
    renderWithProviders(<Signup />);

    await user.type(
      screen.getByPlaceholderText("studio.login.placeholder.email"),
      "test@example.com",
    );
    await user.type(
      screen.getByPlaceholderText("studio.signup.placeholder.first_name"),
      "fname",
    );
    await user.type(
      screen.getByPlaceholderText("studio.signup.placeholder.last_name"),
      "lname",
    );
    const passwordFields = screen.getAllByPlaceholderText(
      "studio.signup.placeholder.password",
    );
    await user.type(passwordFields[0], "password123");
    await user.type(passwordFields[1], "differentPassword");
    await user.click(screen.getByText("common.button.submit"));
    await waitFor(() => {
      expect(
        screen.getByText("studio.validation.passwords_do_not_match"),
      ).toBeInTheDocument();
    });
  });

  it("displays error message when signup mutation fails", async () => {
    const user = userEvent.setup();
    vi.mocked(axiosInstance.post).mockRejectedValue({
      response: {
        data: {
          detail: {
            message: "Signup failed. Please try again.",
          },
        },
      },
    });
    renderWithProviders(<Signup />);

    await user.type(
      screen.getByPlaceholderText("studio.login.placeholder.email"),
      "test@example.com",
    );
    await user.type(
      screen.getByPlaceholderText("studio.signup.placeholder.first_name"),
      "fname",
    );
    await user.type(
      screen.getByPlaceholderText("studio.signup.placeholder.last_name"),
      "lname",
    );
    const passwordFields = screen.getAllByPlaceholderText(
      "studio.signup.placeholder.password",
    );
    await user.type(passwordFields[0], "password123");
    await user.type(passwordFields[1], "password123");
    await user.click(screen.getByText("common.button.submit"));
    await waitFor(() => {
      expect(
        screen.getByText("Signup failed. Please try again."),
      ).toBeInTheDocument();
    });
  });
});
