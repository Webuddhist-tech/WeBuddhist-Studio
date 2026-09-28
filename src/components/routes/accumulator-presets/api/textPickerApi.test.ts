import { beforeEach, describe, expect, it, vi } from "vitest";
import axiosInstance from "@/config/axios-config";
import { fetchTextTitleByEditionId } from "./textPickerApi";

vi.mock("@/config/axios-config", () => ({
  default: { get: vi.fn() },
}));

/** The lookup reads `title` off `/texts/{edition_id}/languages`. These pin
 * that contract: if the endpoint ever drops or renames the field, the table
 * and the edit dialog silently fall back to showing raw edition ids. */
describe("fetchTextTitleByEditionId", () => {
  beforeEach(() => {
    vi.mocked(axiosInstance.get).mockReset();
  });

  it("reads the title off the languages response", async () => {
    vi.mocked(axiosInstance.get).mockResolvedValue({
      data: {
        text_id: "edition-1",
        title: "Heart Sutra",
        available_languages: [
          { language: "Tibetan", language_code: "bo", version_count: 2 },
        ],
      },
    });

    const title = await fetchTextTitleByEditionId("edition-1");

    expect(axiosInstance.get).toHaveBeenCalledWith(
      "/api/v1/texts/edition-1/languages",
    );
    expect(title).toBe("Heart Sutra");
  });

  it("trims surrounding whitespace", async () => {
    vi.mocked(axiosInstance.get).mockResolvedValue({
      data: { text_id: "edition-1", title: "  Heart Sutra  " },
    });

    expect(await fetchTextTitleByEditionId("edition-1")).toBe("Heart Sutra");
  });

  it("returns null when the response carries no title", async () => {
    vi.mocked(axiosInstance.get).mockResolvedValue({
      data: {
        text_id: "edition-1",
        available_languages: [
          { language: "Tibetan", language_code: "bo", version_count: 2 },
        ],
      },
    });

    expect(await fetchTextTitleByEditionId("edition-1")).toBeNull();
  });

  it("returns null for a blank or null title", async () => {
    vi.mocked(axiosInstance.get).mockResolvedValue({
      data: { text_id: "edition-1", title: "   " },
    });
    expect(await fetchTextTitleByEditionId("edition-1")).toBeNull();

    vi.mocked(axiosInstance.get).mockResolvedValue({
      data: { text_id: "edition-1", title: null },
    });
    expect(await fetchTextTitleByEditionId("edition-1")).toBeNull();
  });

  it("returns null when the response body is empty", async () => {
    vi.mocked(axiosInstance.get).mockResolvedValue({ data: null });

    expect(await fetchTextTitleByEditionId("edition-1")).toBeNull();
  });
});
