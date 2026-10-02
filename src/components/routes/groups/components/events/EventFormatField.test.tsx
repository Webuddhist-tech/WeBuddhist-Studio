import { useEffect } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { useForm } from "react-hook-form";
import { describe, expect, it } from "vitest";
import { Pecha } from "@/components/ui/shadimport";
import {
  defaultEventFormValues,
  type EventFormat,
  type EventFormData,
} from "@/schema/EventSchema";
import EventFormatField from "./EventFormatField";

/** The edit page shape: the field lives inside a <form> - which is what makes
 *  Radix render its hidden native <select> - and the saved value only lands
 *  once the event has been fetched, via `reset`, after the field has mounted. */
const Harness = ({ hydrateWith }: { hydrateWith?: EventFormat }) => {
  const form = useForm<EventFormData>({
    defaultValues: defaultEventFormValues(),
  });

  useEffect(() => {
    if (!hydrateWith) return;
    form.reset({ ...defaultEventFormValues(), event_format: hydrateWith });
  }, [form, hydrateWith]);

  return (
    <Pecha.Form {...form}>
      <form>
        <EventFormatField form={form} readOnly={false} />
        <output data-testid="value">{form.watch("event_format")}</output>
      </form>
    </Pecha.Form>
  );
};

describe("EventFormatField", () => {
  it("keeps a format hydrated after mount", async () => {
    render(<Harness hydrateWith="online" />);

    await waitFor(() =>
      expect(screen.getByRole("combobox")).toHaveTextContent("Live"),
    );
    expect(screen.getByTestId("value")).toHaveTextContent("online");
  });

  it("follows a later change of the same field", async () => {
    const { rerender } = render(<Harness hydrateWith="online" />);
    await waitFor(() =>
      expect(screen.getByRole("combobox")).toHaveTextContent("Live"),
    );

    rerender(<Harness hydrateWith="hybrid" />);

    await waitFor(() =>
      expect(screen.getByRole("combobox")).toHaveTextContent("Hybrid"),
    );
    expect(screen.getByTestId("value")).toHaveTextContent("hybrid");
  });
});
