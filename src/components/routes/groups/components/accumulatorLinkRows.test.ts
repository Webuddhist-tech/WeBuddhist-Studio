import { describe, expect, it } from "vitest";
import {
  detectLinkPlatform,
  isLinkRowFilled,
  newLinkRow,
  parseYoutubeVideoId,
  validateLinkRows,
  type AccumulatorLinkRow,
} from "./accumulatorLinkRows";

const row = (
  overrides: Partial<AccumulatorLinkRow> = {},
): AccumulatorLinkRow => ({
  ...newLinkRow(),
  ...overrides,
});

describe("newLinkRow", () => {
  it("gives each row a distinct client id", () => {
    expect(newLinkRow().id).not.toBe(newLinkRow().id);
  });
});

describe("parseYoutubeVideoId", () => {
  it("reads the id from the common YouTube URL shapes", () => {
    const id = "dQw4w9WgXcQ";
    expect(parseYoutubeVideoId(`https://www.youtube.com/watch?v=${id}`)).toBe(
      id,
    );
    expect(parseYoutubeVideoId(`https://youtu.be/${id}`)).toBe(id);
    expect(parseYoutubeVideoId(`https://www.youtube.com/embed/${id}`)).toBe(id);
    expect(parseYoutubeVideoId(`https://www.youtube.com/shorts/${id}`)).toBe(
      id,
    );
    expect(parseYoutubeVideoId(`https://m.youtube.com/watch?v=${id}`)).toBe(id);
    expect(parseYoutubeVideoId(`https://youtube.com/watch?v=${id}&t=42s`)).toBe(
      id,
    );
  });

  it("returns null for non-YouTube and malformed URLs", () => {
    expect(parseYoutubeVideoId("https://vimeo.com/12345678")).toBeNull();
    expect(parseYoutubeVideoId("https://example.org/watch?v=abc")).toBeNull();
    expect(parseYoutubeVideoId("not a url")).toBeNull();
    expect(parseYoutubeVideoId("")).toBeNull();
  });

  it("rejects a v param that is not an 11-char id", () => {
    expect(
      parseYoutubeVideoId("https://www.youtube.com/watch?v=tooshort"),
    ).toBeNull();
  });

  it("does not treat a lookalike host as YouTube", () => {
    expect(
      parseYoutubeVideoId("https://notyoutube.com/watch?v=dQw4w9WgXcQ"),
    ).toBeNull();
  });
});

describe("detectLinkPlatform", () => {
  it("recognises the platforms we show an icon for", () => {
    expect(
      detectLinkPlatform("https://www.youtube.com/watch?v=dQw4w9WgXcQ"),
    ).toBe("YOUTUBE");
    expect(detectLinkPlatform("https://vimeo.com/12345678")).toBe("VIMEO");
    expect(detectLinkPlatform("https://www.facebook.com/share/v/1BFUzI")).toBe(
      "FACEBOOK",
    );
    expect(detectLinkPlatform("https://fb.watch/abc123")).toBe("FACEBOOK");
    expect(detectLinkPlatform("https://www.instagram.com/reel/xyz")).toBe(
      "INSTAGRAM",
    );
    expect(detectLinkPlatform("https://www.tiktok.com/@a/video/1")).toBe(
      "TIKTOK",
    );
    expect(detectLinkPlatform("https://soundcloud.com/a/b")).toBe("SOUNDCLOUD");
  });

  it("falls back to OTHER for an unrecognised host", () => {
    expect(detectLinkPlatform("https://example.org/a")).toBe("OTHER");
  });

  it("treats a YouTube host as YouTube even without a parsable id", () => {
    expect(detectLinkPlatform("https://www.youtube.com/@channel")).toBe(
      "YOUTUBE",
    );
  });

  it("returns null for blank and non-http URLs", () => {
    expect(detectLinkPlatform("")).toBeNull();
    expect(detectLinkPlatform("not a url")).toBeNull();
    expect(detectLinkPlatform("javascript:alert(1)")).toBeNull();
  });
});

describe("isLinkRowFilled", () => {
  it("treats a blank row as empty", () => {
    expect(isLinkRowFilled(row())).toBe(false);
    expect(isLinkRowFilled(row({ url: "   " }))).toBe(false);
  });

  it("counts a row with only a title as filled so it is validated", () => {
    expect(isLinkRowFilled(row({ title: "Teaching" }))).toBe(true);
  });
});

describe("validateLinkRows", () => {
  it("accepts http and https URLs", () => {
    const rows = [
      row({ url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" }),
      row({ url: "http://example.org/a" }),
    ];
    expect(validateLinkRows(rows)).toEqual({});
  });

  it("rejects non-http schemes and malformed URLs", () => {
    const bad = [
      row({ url: "javascript:alert(1)" }),
      row({ url: "ftp://example.org" }),
      row({ url: "not a url" }),
    ];
    const errors = validateLinkRows(bad);
    expect(Object.keys(errors)).toHaveLength(3);
    bad.forEach((r) => {
      expect(errors[r.id]).toBe("Enter a valid http or https URL");
    });
  });

  it("flags a row that has a title but no URL", () => {
    const titleOnly = row({ title: "Teaching from the retreat" });
    expect(validateLinkRows([titleOnly])[titleOnly.id]).toBe(
      "Enter a valid http or https URL",
    );
  });

  it("ignores blank rows so trailing empties do not block a save", () => {
    expect(validateLinkRows([row(), row()])).toEqual({});
  });

  it("rejects a title over 500 characters", () => {
    const long = row({
      url: "https://example.org",
      title: "x".repeat(501),
    });
    expect(validateLinkRows([long])[long.id]).toBe(
      "Title must be 500 characters or fewer",
    );
  });

  it("accepts a title at exactly 500 characters", () => {
    const atLimit = row({
      url: "https://example.org",
      title: "x".repeat(500),
    });
    expect(validateLinkRows([atLimit])).toEqual({});
  });

  it("rejects a URL over 2000 characters", () => {
    const long = row({ url: `https://example.org/${"a".repeat(2000)}` });
    expect(validateLinkRows([long])[long.id]).toBe(
      "Enter a valid http or https URL",
    );
  });
});
