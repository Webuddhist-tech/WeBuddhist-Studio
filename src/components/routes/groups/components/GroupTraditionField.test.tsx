import { useEffect } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Pecha } from "@/components/ui/shadimport";
import { fetchTraditionOptions } from "@/components/routes/traditions/api/traditionsApi";
import type { GroupCoreFormData } from "@/schema/GroupSchema";
import type { GroupTraditionDTO } from "../api/groupsApi";
import GroupTraditionField from "./GroupTraditionField";

vi.mock("@/components/routes/traditions/api/traditionsApi", () => ({
  fetchTraditionOptions: vi.fn(),
}));

const TRADITIONS = [
  { code: "pali", name: "Pāli scriptures" },
  { code: "tibetan", name: "Sanskrit & Tibetan scriptures" },
];

/** The edit page shape: the saved code lands via `reset` after mount. */
const Harness = ({
  hydrateWith,
  currentTradition,
}: {
  hydrateWith?: string;
  currentTradition?: GroupTraditionDTO | null;
}) => {
  const form = useForm<GroupCoreFormData>({
    defaultValues: {
      slug: "g",
      group_type: "COMMUNITY",
      is_public: true,
      languages: {},
      tradition_code: "",
    },
  });

  useEffect(() => {
    if (hydrateWith === undefined) return;
    form.reset({ ...form.getValues(), tradition_code: hydrateWith });
  }, [form, hydrateWith]);

  return (
    <Pecha.Form {...form}>
      <form>
        <GroupTraditionField form={form} currentTradition={currentTradition} />
        <output data-testid="value">{form.watch("tradition_code")}</output>
      </form>
    </Pecha.Form>
  );
};

const renderField = (props: Parameters<typeof Harness>[0] = {}) => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <Harness {...props} />
    </QueryClientProvider>,
  );
};

describe("GroupTraditionField", () => {
  beforeEach(() => {
    vi.mocked(fetchTraditionOptions).mockReset();
  });

  it("shows the group's saved tradition by name", async () => {
    vi.mocked(fetchTraditionOptions).mockResolvedValue(TRADITIONS);

    renderField({ hydrateWith: "tibetan" });

    await waitFor(() =>
      expect(screen.getByRole("combobox")).toHaveTextContent(
        "Sanskrit & Tibetan scriptures",
      ),
    );
    expect(screen.getByTestId("value")).toHaveTextContent("tibetan");
    expect(fetchTraditionOptions).toHaveBeenCalledWith("en");
  });

  it("shows 'No tradition' for a group without one", async () => {
    vi.mocked(fetchTraditionOptions).mockResolvedValue(TRADITIONS);

    renderField();

    await waitFor(() =>
      expect(screen.getByRole("combobox")).toHaveTextContent(
        "studio.groups.components.tradition.none",
      ),
    );
    expect(screen.getByTestId("value")).toBeEmptyDOMElement();
  });

  it("still shows the saved tradition when the list fails to load", async () => {
    vi.mocked(fetchTraditionOptions).mockRejectedValue(new Error("offline"));

    renderField({
      hydrateWith: "tibetan",
      currentTradition: { id: "t1", code: "tibetan", name: "Tibetan" },
    });

    await waitFor(() =>
      expect(
        screen.getByText("studio.groups.components.tradition.load_error"),
      ).toBeInTheDocument(),
    );
    expect(screen.getByRole("combobox")).toHaveTextContent("Tibetan");
  });
});
