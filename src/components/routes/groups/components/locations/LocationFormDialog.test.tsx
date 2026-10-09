import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import LocationFormDialog from "./LocationFormDialog";
import type { LocationDetail } from "../../api/locationsApi";

vi.mock("@/hooks/useLanguages", () => ({
  useLanguages: () => ({
    languageOptions: [
      { value: "EN", label: "English", name: "English", enabled: true },
      { value: "BO", label: "བོད་ཡིག", name: "Tibetan", enabled: true },
    ],
    getLanguageLabel: (code: string) => code,
    getLanguageName: (code: string) => code,
  }),
}));

vi.mock("../../api/placeSearchApi", () => ({
  isPlaceSearchEnabled: () => false,
  reverseGeocode: vi.fn(),
}));

vi.mock("./LocationMap", () => ({
  default: () => <div data-testid="location-map" />,
}));

vi.mock("./PlaceSearch", () => ({
  default: () => null,
}));

const existingLocation: LocationDetail = {
  id: "loc-1",
  group_id: "group-1",
  name: "Bodh Gaya",
  event_count: 2,
  translations: [
    { id: "t-1", language: "EN", name: "Bodh Gaya" },
    { id: "t-2", language: "BO", name: "རྡོ་རྗེ་གདན།" },
  ],
};

type DialogProps = Parameters<typeof LocationFormDialog>[0];

const renderDialog = (props: Partial<DialogProps> = {}) => {
  const onSubmit = vi.fn();
  render(
    <LocationFormDialog
      open
      onOpenChange={vi.fn()}
      location={null}
      isSubmitting={false}
      onSubmit={onSubmit}
      {...props}
    />,
  );
  return { onSubmit };
};

describe("LocationFormDialog localized names", () => {
  it("seeds the stored names when editing", () => {
    renderDialog({ location: existingLocation });

    const nameInputs = screen.getAllByPlaceholderText("Name in this language");
    expect(nameInputs).toHaveLength(2);
    expect((nameInputs[0] as HTMLInputElement).value).toBe("Bodh Gaya");
    expect((nameInputs[1] as HTMLInputElement).value).toBe("རྡོ་རྗེ་གདན།");
  });

  it("adds and removes a localized name row", () => {
    renderDialog();

    expect(
      screen.queryByPlaceholderText("Name in this language"),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /add language/i }));
    expect(
      screen.getAllByPlaceholderText("Name in this language"),
    ).toHaveLength(1);

    fireEvent.click(
      screen.getByRole("button", { name: "Remove localized name" }),
    );
    expect(
      screen.queryByPlaceholderText("Name in this language"),
    ).not.toBeInTheDocument();
  });

  it("stops offering languages once every one has a name", () => {
    renderDialog({ location: existingLocation });

    // Both configured languages are taken, so there is nothing left to add.
    expect(
      screen.queryByRole("button", { name: /add language/i }),
    ).not.toBeInTheDocument();
  });

  it("submits the localized names alongside the canonical one", async () => {
    const { onSubmit } = renderDialog();

    fireEvent.change(screen.getByPlaceholderText("Enter a location name"), {
      target: { value: "Bodh Gaya" },
    });
    fireEvent.click(screen.getByRole("button", { name: /add language/i }));
    fireEvent.change(screen.getByPlaceholderText("Name in this language"), {
      target: { value: "Bodhgaya" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Create location" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0][0]).toMatchObject({
      name: "Bodh Gaya",
      translations: [{ language: "EN", name: "Bodhgaya" }],
    });
  });

  it("refuses a localized row with no name", async () => {
    const { onSubmit } = renderDialog();

    fireEvent.change(screen.getByPlaceholderText("Enter a location name"), {
      target: { value: "Bodh Gaya" },
    });
    fireEvent.click(screen.getByRole("button", { name: /add language/i }));

    fireEvent.click(screen.getByRole("button", { name: "Create location" }));

    await waitFor(() =>
      expect(screen.getByText("Name is required")).toBeInTheDocument(),
    );
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
