import { describe, expect, it } from "vitest";
import {
  metadataFromTranslationState,
  translationStateFromAccumulator,
} from "./accumulatorTranslations";

describe("translationStateFromAccumulator", () => {
  it("reads a title and About per language", () => {
    const state = translationStateFromAccumulator({
      title: "Mani Retreat",
      metadata: [
        { language: "EN", title: "Mani Retreat", description: "English about" },
        { language: "BO", title: "Tibetan title", description: null },
      ],
    });

    expect(state.languages).toEqual(["EN", "BO"]);
    expect(state.titles).toEqual({ EN: "Mani Retreat", BO: "Tibetan title" });
    expect(state.descriptions).toEqual({ EN: "English about", BO: "" });
  });

  it("seeds English from the row title when no language carries one", () => {
    const state = translationStateFromAccumulator({
      title: "Legacy title",
      metadata: [{ language: "BO", description: "Tibetan about" }],
    });

    expect(state.languages).toEqual(["EN", "BO"]);
    expect(state.titles.EN).toBe("Legacy title");
    expect(state.descriptions.BO).toBe("Tibetan about");
  });

  it("does not overwrite a stored title with the row title", () => {
    const state = translationStateFromAccumulator({
      title: "Row title",
      metadata: [{ language: "EN", title: "Stored title", description: null }],
    });

    expect(state.titles.EN).toBe("Stored title");
  });

  it("handles an accumulator with no metadata at all", () => {
    expect(
      translationStateFromAccumulator({ title: null, metadata: null }),
    ).toEqual({ languages: [], titles: {}, descriptions: {} });
  });
});

describe("metadataFromTranslationState", () => {
  it("sends every language with a title or an About", () => {
    const metadata = metadataFromTranslationState({
      languages: ["EN", "BO", "NE"],
      titles: { EN: "Mani Retreat", BO: "Tibetan title", NE: "  " },
      descriptions: { EN: " English about ", BO: "", NE: "" },
    });

    expect(metadata).toEqual([
      { language: "EN", title: "Mani Retreat", description: "English about" },
      { language: "BO", title: "Tibetan title", description: "" },
    ]);
  });

  it("drops a language the author emptied out", () => {
    const metadata = metadataFromTranslationState({
      languages: ["EN", "BO"],
      titles: { EN: "Kept", BO: "" },
      descriptions: { EN: "", BO: "" },
    });

    expect(metadata).toEqual([
      { language: "EN", title: "Kept", description: "" },
    ]);
  });
});
