import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useEventForm } from "./useEventForm";

const wrapper = ({ children }: { children: ReactNode }) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

/** A calendar day safely in the past, in the `YYYY-MM-DD` shape the form uses. */
const PAST_DATE = "2020-01-01";

const validateWithPastStartDate = async (isNew: boolean) => {
  const { result } = renderHook(() => useEventForm(isNew), { wrapper });

  await act(async () => {
    result.current.form.setValue("start_date", PAST_DATE);
    result.current.form.setValue("end_date", PAST_DATE);
    result.current.form.setValue("metadata", [
      { language: "EN", name: "Morning live", description: "" },
    ]);
    await result.current.form.trigger();
  });

  return result.current.form.formState.errors;
};

describe("useEventForm resolver selection", () => {
  it("rejects a past start date when creating", async () => {
    const errors = await validateWithPastStartDate(true);

    expect(errors.start_date?.message).toBe("Start date cannot be in the past");
  });

  /** Regression: the page called `useEventForm()` with no argument, so the
   *  default `isNew = true` made edit mode run the create resolver. Editing an
   *  event that had already happened - changing only its YouTube link, say -
   *  then failed on a start date the editor never touched, and because the
   *  submit is blocked by `handleSubmit`, the Save button just looked dead. */
  it("allows a past start date when editing", async () => {
    const errors = await validateWithPastStartDate(false);

    expect(errors.start_date).toBeUndefined();
  });
});
