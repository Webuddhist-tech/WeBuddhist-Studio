import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import AmbientSoundFormDialog from "./AmbientSoundFormDialog";
import type { AmbientSound } from "./api/ambientSoundsApi";

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

const existingSound: AmbientSound = {
  id: "sound-1",
  name: "Rain",
  url: "https://s3.example/rain.mp3?sig=1",
  image_url: "https://s3.example/rain.webp?sig=1",
  is_default: false,
  display_order: 0,
};

const fileOfSize = (name: string, type: string, size: number) => {
  const file = new File(["x"], name, { type });
  // jsdom derives size from content; override it so react-dropzone's maxSize
  // check sees the size we are exercising without allocating megabytes.
  Object.defineProperty(file, "size", { value: size });
  return file;
};

const audioFile = () => fileOfSize("rain.mp3", "audio/mpeg", 1024);
const imageFile = () => fileOfSize("cover.png", "image/png", 1024);

/** Dropzones render a hidden file input each, audio first then cover. */
const fileInputs = () =>
  Array.from(document.querySelectorAll<HTMLInputElement>('input[type="file"]'));

const dropOnCover = async (file: File) => {
  const [, coverInput] = fileInputs();
  fireEvent.change(coverInput, { target: { files: [file] } });
  await waitFor(() => expect(coverInput).toBeTruthy());
};

const renderDialog = (sound: AmbientSound | null, onSubmit = vi.fn()) => {
  render(
    <AmbientSoundFormDialog
      open
      onOpenChange={vi.fn()}
      sound={sound}
      isSubmitting={false}
      onSubmit={onSubmit}
    />,
  );
  return onSubmit;
};

describe("AmbientSoundFormDialog — cover image", () => {
  beforeEach(() => {
    vi.mocked(toast.error).mockReset();
  });

  it("submits the picked cover alongside the audio", async () => {
    const onSubmit = renderDialog(null);

    await userEvent.type(
      screen.getByPlaceholderText(/sea waves/i),
      "Rain trial",
    );

    const [audioInput] = fileInputs();
    fireEvent.change(audioInput, { target: { files: [audioFile()] } });

    const cover = imageFile();
    await dropOnCover(cover);

    await userEvent.click(screen.getByRole("button", { name: /add sound/i }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Rain trial", imageFile: cover }),
    );
  });

  it("sends a null cover when editing without replacing it", async () => {
    const onSubmit = renderDialog(existingSound);

    await userEvent.click(
      screen.getByRole("button", { name: /save changes/i }),
    );

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    // Null, not a File: the API layer then omits image_file entirely so the
    // backend leaves the stored cover alone.
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ file: null, imageFile: null }),
    );
  });

  it("rejects an oversized cover with an image-specific message", async () => {
    renderDialog(null);

    await dropOnCover(fileOfSize("huge.png", "image/png", 6 * 1024 * 1024));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "Image is too large — maximum 5 MB.",
      ),
    );
  });

  it("rejects a non-image cover with an image-specific message", async () => {
    renderDialog(null);

    await dropOnCover(fileOfSize("notes.pdf", "application/pdf", 1024));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "Unsupported image type — use PNG, JPG, or WEBP.",
      ),
    );
  });
});

describe("AmbientSoundFormDialog — audio rejection stays audio-specific", () => {
  beforeEach(() => {
    vi.mocked(toast.error).mockReset();
  });

  it("uses the 50 MB audio wording, not the cover's", async () => {
    renderDialog(null);

    const [audioInput] = fileInputs();
    fireEvent.change(audioInput, {
      target: {
        files: [fileOfSize("huge.mp3", "audio/mpeg", 60 * 1024 * 1024)],
      },
    });

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "File is too large — maximum 50 MB.",
      ),
    );
  });
});
