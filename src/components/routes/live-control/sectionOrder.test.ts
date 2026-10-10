import { beforeEach, describe, expect, it } from "vitest";
import {
  applySectionOrder,
  readSectionOrder,
  sectionOrderStorageKey,
  storeSectionOrder,
} from "./sectionOrder";

const sections = (...ids: string[]) => ids.map((id) => ({ id }));
const ids = (list: { id: string }[]) => list.map((section) => section.id);

describe("sectionOrder", () => {
  beforeEach(() => localStorage.clear());

  it("keeps the outline's order when nothing was dragged", () => {
    expect(ids(applySectionOrder(sections("a", "b", "c"), []))).toEqual([
      "a",
      "b",
      "c",
    ]);
  });

  it("draws the sections in the stored order", () => {
    expect(
      ids(applySectionOrder(sections("a", "b", "c"), ["c", "a", "b"])),
    ).toEqual(["c", "a", "b"]);
  });

  it("keeps a section added since after the one it follows in the outline", () => {
    expect(
      ids(applySectionOrder(sections("a", "b", "new", "c"), ["c", "b", "a"])),
    ).toEqual(["c", "b", "new", "a"]);
    // One the outline opens with stays first.
    expect(
      ids(applySectionOrder(sections("new", "a", "b"), ["b", "a"])),
    ).toEqual(["new", "b", "a"]);
  });

  it("passes over sections no longer in the outline", () => {
    expect(
      ids(applySectionOrder(sections("a", "b"), ["gone", "b", "a", "b"])),
    ).toEqual(["b", "a"]);
  });

  it("stores an order per edition, and clears it when emptied", () => {
    expect(readSectionOrder("ed-1")).toEqual([]);
    storeSectionOrder("ed-1", ["b", "a"]);
    expect(readSectionOrder("ed-1")).toEqual(["b", "a"]);
    expect(readSectionOrder("ed-2")).toEqual([]);

    storeSectionOrder("ed-1", []);
    expect(localStorage.getItem(sectionOrderStorageKey("ed-1"))).toBeNull();
  });

  it("reads nonsense as no order", () => {
    localStorage.setItem(sectionOrderStorageKey("ed-1"), "not json");
    expect(readSectionOrder("ed-1")).toEqual([]);
    localStorage.setItem(sectionOrderStorageKey("ed-1"), '{"a":1}');
    expect(readSectionOrder("ed-1")).toEqual([]);
  });
});
