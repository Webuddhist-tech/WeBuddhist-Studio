import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchEditionSections } from "./libraryTocApi";

const { get } = vi.hoisted(() => ({ get: vi.fn() }));

vi.mock("axios", async () => {
  const actual = await vi.importActual<typeof import("axios")>("axios");
  return {
    ...actual,
    default: { ...actual.default, create: () => ({ get }) },
  };
});

/** An upstream 404, as axios reports one. */
const notFound = () => ({
  isAxiosError: true,
  response: { status: 404 },
});

/** Segment spans, one line each, laid out end to end from `start`. */
const spans = (count: number, width = 10, start = 0) =>
  Array.from({ length: count }, (_, i) => ({
    id: `seg-${i + 1}`,
    lines: [{ start: start + i * width, end: start + (i + 1) * width }],
  }));

type Routes = {
  edition?: unknown;
  editions?: unknown;
  toc?: unknown;
  pages?: { items: unknown[]; has_more: boolean }[];
};

/** Answers each library path the module reads, in the order it reads them. */
const serve = ({ edition, editions, toc, pages = [] }: Routes) => {
  let page = 0;
  get.mockImplementation(async (url: string) => {
    if (url.endsWith("/segmentation/segments")) {
      const current = pages[page] ?? { items: [], has_more: false };
      page += 1;
      return { data: current };
    }
    if (url.endsWith("/table-of-contents")) return { data: toc ?? [] };
    if (url.endsWith("/editions")) return { data: editions ?? [] };
    if (edition instanceof Error || (edition as { isAxiosError?: boolean })?.isAxiosError)
      throw edition;
    return { data: edition ?? { id: "ed-1" } };
  });
};

describe("fetchEditionSections", () => {
  beforeEach(() => {
    get.mockReset();
  });

  it("anchors each section to the first segment inside its span", async () => {
    serve({
      toc: [
        {
          id: "toc-1",
          sections: [
            {
              id: "s1",
              title: { bo: "སྐྱབས་འགྲོ", en: "Refuge" },
              span: { start: 0, end: 20 },
            },
            {
              id: "s2",
              title: { bo: "བསྟོད་པ", en: "Praises" },
              span: { start: 20, end: 40 },
            },
          ],
        },
      ],
      pages: [{ items: spans(4), has_more: false }],
    });

    await expect(fetchEditionSections("ed-1", "bo")).resolves.toEqual([
      { id: "s1", title: "སྐྱབས་འགྲོ", depth: 0, segmentId: "seg-1" },
      { id: "s2", title: "བསྟོད་པ", depth: 0, segmentId: "seg-3" },
    ]);
  });

  it("falls back to any title the section carries", async () => {
    serve({
      toc: [
        {
          id: "toc-1",
          sections: [
            { id: "s1", title: { en: "Refuge" }, span: { start: 0, end: 10 } },
          ],
        },
      ],
      pages: [{ items: spans(1), has_more: false }],
    });

    const [section] = await fetchEditionSections("ed-1", "bo");

    expect(section.title).toBe("Refuge");
  });

  it("keeps the nesting as the depth of each entry", async () => {
    serve({
      toc: [
        {
          id: "toc-1",
          sections: [
            {
              id: "s1",
              title: "Praises",
              span: { start: 0, end: 40 },
              subsections: [
                { id: "s1a", title: "First Tārā", span: { start: 10, end: 20 } },
                {
                  id: "s1b",
                  title: "Second Tārā",
                  span: { start: 20, end: 30 },
                },
              ],
            },
          ],
        },
      ],
      pages: [{ items: spans(4), has_more: false }],
    });

    await expect(fetchEditionSections("ed-1")).resolves.toEqual([
      { id: "s1", title: "Praises", depth: 0, segmentId: "seg-1" },
      { id: "s1a", title: "First Tārā", depth: 1, segmentId: "seg-2" },
      { id: "s1b", title: "Second Tārā", depth: 1, segmentId: "seg-3" },
    ]);
  });

  it("anchors a heading with no text of its own to the segment at its position", async () => {
    serve({
      toc: [
        {
          id: "toc-1",
          // An empty span marks a position, not a range: a part title standing
          // above its subsections.
          sections: [{ id: "s1", title: "Part Two", span: { start: 20, end: 20 } }],
        },
      ],
      pages: [{ items: spans(4), has_more: false }],
    });

    const [section] = await fetchEditionSections("ed-1");

    expect(section.segmentId).toBe("seg-3");
  });

  it("borrows a subsection's anchor for a heading whose own span resolves to nothing", async () => {
    serve({
      toc: [
        {
          id: "toc-1",
          sections: [
            {
              id: "s1",
              title: "Praises",
              span: null,
              subsections: [
                { id: "s1a", title: "First Tārā", span: { start: 10, end: 20 } },
              ],
            },
          ],
        },
      ],
      pages: [{ items: spans(2), has_more: false }],
    });

    const [section] = await fetchEditionSections("ed-1");

    expect(section.segmentId).toBe("seg-2");
  });

  it("leaves a section with nothing to go to unanchored", async () => {
    serve({
      toc: [
        {
          id: "toc-1",
          sections: [
            { id: "s1", title: "Colophon", span: { start: 900, end: 950 } },
          ],
        },
      ],
      pages: [{ items: spans(2), has_more: false }],
    });

    await expect(fetchEditionSections("ed-1")).resolves.toEqual([
      { id: "s1", title: "Colophon", depth: 0, segmentId: undefined },
    ]);
  });

  it("drops an untitled section but keeps what nests under it", async () => {
    serve({
      toc: [
        {
          id: "toc-1",
          sections: [
            {
              id: "s1",
              title: null,
              span: { start: 0, end: 20 },
              subsections: [
                { id: "s1a", title: "Refuge", span: { start: 0, end: 10 } },
              ],
            },
          ],
        },
      ],
      pages: [{ items: spans(2), has_more: false }],
    });

    await expect(fetchEditionSections("ed-1")).resolves.toEqual([
      { id: "s1a", title: "Refuge", depth: 0, segmentId: "seg-1" },
    ]);
  });

  it("reads every page of the span scan", async () => {
    serve({
      toc: [
        {
          id: "toc-1",
          sections: [{ id: "s1", title: "Late", span: { start: 30, end: 40 } }],
        },
      ],
      pages: [
        { items: spans(2), has_more: true },
        { items: spans(2, 10, 20), has_more: false },
      ],
    });

    const [section] = await fetchEditionSections("ed-1");

    // The second page numbers its own ids from one, so this is its second span.
    expect(section.segmentId).toBe("seg-2");
    expect(
      get.mock.calls.filter(([url]) => url.endsWith("/segmentation/segments")),
    ).toHaveLength(2);
  });

  it("does not scan spans for an edition with no outline", async () => {
    serve({ toc: [] });

    await expect(fetchEditionSections("ed-1")).resolves.toEqual([]);
    expect(
      get.mock.calls.filter(([url]) => url.endsWith("/segmentation/segments")),
    ).toHaveLength(0);
  });

  it("reads a text id as its first critical edition", async () => {
    serve({
      edition: notFound(),
      editions: [{ id: "ed-9" }],
      toc: [
        {
          id: "toc-1",
          sections: [{ id: "s1", title: "Refuge", span: { start: 0, end: 10 } }],
        },
      ],
      pages: [{ items: spans(1), has_more: false }],
    });

    await fetchEditionSections("text-1");

    expect(get).toHaveBeenCalledWith("/v2/texts/text-1/editions", {
      params: { edition_type: "critical" },
    });
    expect(get).toHaveBeenCalledWith("/v2/editions/ed-9/table-of-contents");
  });

  it("does not read a failure other than 404 as a text id", async () => {
    serve({ edition: { isAxiosError: true, response: { status: 500 } } });

    await expect(fetchEditionSections("ed-1")).rejects.toBeTruthy();
    expect(get).not.toHaveBeenCalledWith(
      "/v2/texts/ed-1/editions",
      expect.anything(),
    );
  });
});
