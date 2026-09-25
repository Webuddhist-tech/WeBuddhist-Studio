import { describe, expect, it } from "vitest";
import type { FieldErrors } from "react-hook-form";
import type { EventFormData } from "@/schema/EventSchema";
import { EVENT_TABS, EVENT_TAB_FIELDS, tabsWithErrors } from "./eventFormTabs";

const errorsFor = (...fields: string[]): FieldErrors<EventFormData> =>
  Object.fromEntries(
    fields.map((field) => [field, { type: "custom", message: "bad" }]),
  ) as FieldErrors<EventFormData>;

describe("EVENT_TAB_FIELDS", () => {
  it("claims each field for exactly one tab", () => {
    const all = EVENT_TABS.flatMap(({ id }) => [...EVENT_TAB_FIELDS[id]]);

    expect(all).toHaveLength(new Set(all).size);
  });

  it("covers every tab in the header list", () => {
    for (const { id } of EVENT_TABS) {
      expect(EVENT_TAB_FIELDS[id].length).toBeGreaterThan(0);
    }
  });
});

describe("tabsWithErrors", () => {
  it("returns nothing for a clean form", () => {
    expect(tabsWithErrors({})).toEqual([]);
  });

  it("maps a field error back to its tab", () => {
    expect(tabsWithErrors(errorsFor("youtube"))).toEqual(["youtube"]);
  });

  /** The submit handler takes the first entry to decide where to jump, so the
   *  order has to follow the tab strip rather than the error object's keys. */
  it("reports tabs in header order, not error order", () => {
    expect(tabsWithErrors(errorsFor("youtube", "metadata"))).toEqual([
      "about",
      "youtube",
    ]);
  });

  it("groups several errors on one tab into a single entry", () => {
    expect(tabsWithErrors(errorsFor("start_date", "end_date"))).toEqual([
      "schedule",
    ]);
  });
});
