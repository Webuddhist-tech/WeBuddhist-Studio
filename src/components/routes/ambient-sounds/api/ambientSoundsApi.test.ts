import { beforeEach, describe, expect, it, vi } from "vitest";
import axiosInstance from "@/config/axios-config";
import { createAmbientSound, updateAmbientSound } from "./ambientSoundsApi";

vi.mock("@/config/axios-config", () => ({
  default: { post: vi.fn(), put: vi.fn() },
}));

const audio = () => new File(["audio"], "rain.mp3", { type: "audio/mpeg" });
const cover = () => new File(["image"], "rain.png", { type: "image/png" });

/** The multipart body the call was made with. */
const sentBody = (mock: { mock: { calls: unknown[][] } }, index = 1) =>
  mock.mock.calls[0][index] as FormData;

describe("createAmbientSound — cover image", () => {
  beforeEach(() => {
    vi.mocked(axiosInstance.post).mockReset();
    vi.mocked(axiosInstance.post).mockResolvedValue({ data: {} });
    vi.spyOn(Storage.prototype, "getItem").mockReturnValue("token");
  });

  it("sends image_file when a cover is picked", async () => {
    const imageFile = cover();

    await createAmbientSound({
      name: "Rain",
      displayOrder: 0,
      isDefault: false,
      file: audio(),
      imageFile,
    });

    const body = sentBody(vi.mocked(axiosInstance.post));
    expect(body.get("image_file")).toBe(imageFile);
    expect(body.get("name")).toBe("Rain");
  });

  it("omits image_file entirely when no cover is picked", async () => {
    await createAmbientSound({
      name: "Rain",
      displayOrder: 0,
      isDefault: false,
      file: audio(),
    });

    // Absent, not an empty string: the backend treats the field as optional
    // and an empty value would not be a valid upload.
    expect(sentBody(vi.mocked(axiosInstance.post)).has("image_file")).toBe(
      false,
    );
  });
});

describe("updateAmbientSound — cover image", () => {
  beforeEach(() => {
    vi.mocked(axiosInstance.put).mockReset();
    vi.mocked(axiosInstance.put).mockResolvedValue({ data: {} });
    vi.spyOn(Storage.prototype, "getItem").mockReturnValue("token");
  });

  it("sends image_file when the cover is being replaced", async () => {
    const imageFile = cover();

    await updateAmbientSound("sound-1", { name: "Rain", imageFile });

    const body = sentBody(vi.mocked(axiosInstance.put), 1);
    expect(body.get("image_file")).toBe(imageFile);
  });

  it("keeps the current cover when editing without replacing it", async () => {
    await updateAmbientSound("sound-1", { name: "Renamed" });

    // Omitting the field is what tells the backend to leave the stored cover
    // alone — there is no way to clear one through this endpoint.
    const body = sentBody(vi.mocked(axiosInstance.put), 1);
    expect(body.has("image_file")).toBe(false);
    expect(body.get("name")).toBe("Renamed");
  });

  it("does not send the audio file when only the cover changes", async () => {
    await updateAmbientSound("sound-1", { imageFile: cover() });

    const body = sentBody(vi.mocked(axiosInstance.put), 1);
    expect(body.has("file")).toBe(false);
    expect(body.has("image_file")).toBe(true);
  });
});
