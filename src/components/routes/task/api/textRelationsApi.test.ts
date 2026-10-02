import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  fetchTextRelations,
  fetchTextRelationsForSources,
} from "./textRelationsApi";

const { get } = vi.hoisted(() => ({ get: vi.fn() }));

vi.mock("axios", async () => {
  const actual = await vi.importActual<typeof import("axios")>("axios");
  return {
    ...actual,
    default: { ...actual.default, create: () => ({ get }) },
  };
});

const notFound = () => ({ isAxiosError: true, response: { status: 404 } });

type Text = {
  id: string;
  title?: Record<string, string> | string;
  language?: string;
  commentary_of?: string | null;
  translation_of?: string | null;
  commentaries?: string[];
  translations?: string[];
};

/** A library that knows these texts and editions, and 404s everything else. */
const serve = (texts: Text[], editions: Record<string, string> = {}) => {
  const byId = new Map(texts.map((text) => [text.id, text]));
  get.mockImplementation(async (url: string) => {
    const [, kind, id] = url.match(/^\/v2\/(texts|editions)\/([^/]+)$/) ?? [];
    if (kind === "editions" && editions[id])
      return { data: { id, text_id: editions[id] } };
    if (kind === "texts" && byId.has(id)) return { data: byId.get(id) };
    throw notFound();
  });
};

const text = (id: string, extra: Partial<Text> = {}): Text => ({
  id,
  title: { en: `Title ${id}` },
  language: "en",
  ...extra,
});

describe("fetchTextRelations", () => {
  beforeEach(() => {
    get.mockReset();
  });

  it("lists a text's own commentaries and translations", async () => {
    serve([
      text("root", { commentaries: ["c1"], translations: ["t1"] }),
      text("c1"),
      text("t1", { language: "bo", title: { bo: "བོད" } }),
    ]);

    await expect(fetchTextRelations("root")).resolves.toEqual({
      commentaries: [{ id: "c1", title: "Title c1", language: "en" }],
      translations: [{ id: "t1", title: "བོད", language: "bo" }],
    });
  });

  it("resolves an edition id to its text first", async () => {
    serve([text("root", { commentaries: ["c1"] }), text("c1")], {
      "ed-1": "root",
    });

    const relations = await fetchTextRelations("ed-1");

    expect(relations.commentaries.map((item) => item.id)).toEqual(["c1"]);
  });

  it("borrows from the parent when a translation has no lists of its own", async () => {
    serve([
      text("root", { commentaries: ["c1"], translations: ["t1", "t2"] }),
      text("t1", { translation_of: "root" }),
      text("t2"),
      text("c1"),
    ]);

    const relations = await fetchTextRelations("t1");

    expect(relations.commentaries.map((item) => item.id)).toEqual(["c1"]);
    // The parent is a version too; the text itself is left out.
    expect(relations.translations.map((item) => item.id)).toEqual([
      "root",
      "t2",
    ]);
  });

  it("gives a commentary its sibling commentaries and the root's versions", async () => {
    serve([
      text("root", { commentaries: ["c1", "c2"], translations: ["t1"] }),
      text("c1", { commentary_of: "root" }),
      text("c2"),
      text("t1"),
    ]);

    const relations = await fetchTextRelations("c1");

    expect(relations.commentaries.map((item) => item.id)).toEqual(["c2"]);
    expect(relations.translations.map((item) => item.id)).toEqual([
      "root",
      "t1",
    ]);
  });

  it("skips listed texts the library no longer has", async () => {
    serve([text("root", { commentaries: ["gone", "c1"] }), text("c1")]);

    const relations = await fetchTextRelations("root");

    expect(relations.commentaries.map((item) => item.id)).toEqual(["c1"]);
  });

  it("returns empty lists for an unknown text", async () => {
    serve([]);

    await expect(fetchTextRelations("missing")).resolves.toEqual({
      commentaries: [],
      translations: [],
    });
  });

  it("does not swallow a failure that is not a 404", async () => {
    get.mockRejectedValue({ isAxiosError: true, response: { status: 500 } });

    await expect(fetchTextRelations("root")).rejects.toBeTruthy();
  });
});

describe("fetchTextRelationsForSources", () => {
  beforeEach(() => {
    get.mockReset();
  });

  it("merges every source's lists, each text once", async () => {
    serve([
      text("a", { commentaries: ["c1", "c2"] }),
      text("b", { commentaries: ["c2", "c3"] }),
      text("c1"),
      text("c2"),
      text("c3"),
    ]);

    const relations = await fetchTextRelationsForSources(["a", "b", "a"]);

    expect(relations.commentaries.map((item) => item.id)).toEqual([
      "c1",
      "c2",
      "c3",
    ]);
  });
});
