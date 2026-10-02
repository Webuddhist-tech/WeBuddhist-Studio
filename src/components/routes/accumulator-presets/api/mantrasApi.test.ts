import { beforeEach, describe, expect, it, vi } from "vitest";
import axiosInstance from "@/config/axios-config";
import { updateMantra, uploadMantraDeityImage } from "./mantrasApi";

vi.mock("@/config/axios-config", () => ({
  default: { post: vi.fn(), patch: vi.fn() },
}));

describe("updateMantra", () => {
  beforeEach(() => {
    vi.mocked(axiosInstance.patch).mockReset();
    vi.mocked(axiosInstance.patch).mockResolvedValue({
      data: { id: "mantra-1", metadata: [] },
    });
    vi.spyOn(Storage.prototype, "getItem").mockReturnValue("token");
  });

  it("PATCHes the mantra with the new deity_image_key", async () => {
    await updateMantra("mantra-1", {
      deity_image_key: "images/mantra_images/mantra-1/original/x.webp",
    });

    expect(axiosInstance.patch).toHaveBeenCalledWith(
      "/api/v1/cms/mantras/mantra-1",
      { deity_image_key: "images/mantra_images/mantra-1/original/x.webp" },
      { headers: { Authorization: "Bearer token" } },
    );
  });

  it("sends an explicit null to clear the key", async () => {
    await updateMantra("mantra-1", { deity_image_key: null });

    expect(axiosInstance.patch).toHaveBeenCalledWith(
      "/api/v1/cms/mantras/mantra-1",
      { deity_image_key: null },
      expect.anything(),
    );
  });
});

describe("uploadMantraDeityImage", () => {
  beforeEach(() => {
    vi.mocked(axiosInstance.post).mockReset();
    vi.mocked(axiosInstance.post).mockResolvedValue({
      data: {
        image: { thumbnail: "t", medium: "m", original: "o" },
        key: "images/mantra_images/mantra-1/original/x.webp",
        path: "images/mantra_images/mantra-1/some-uuid",
        message: "Image uploaded successfully",
      },
    });
    vi.spyOn(Storage.prototype, "getItem").mockReturnValue("token");
  });

  it("uploads the file with mantra_id as a query param, not in the body", async () => {
    const file = new File(["image"], "deity.webp", { type: "image/webp" });

    const result = await uploadMantraDeityImage(file, "mantra-1");

    expect(axiosInstance.post).toHaveBeenCalledWith(
      "/api/v1/cms/mantras/image",
      expect.any(FormData),
      {
        headers: { Authorization: "Bearer token" },
        params: { mantra_id: "mantra-1" },
      },
    );
    const body = vi.mocked(axiosInstance.post).mock.calls[0][1] as FormData;
    expect(body.get("file")).toBe(file);
    expect(result.key).toBe("images/mantra_images/mantra-1/original/x.webp");
    expect(result.image.original).toBe("o");
  });
});
