import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import AmbientSoundsTable from "./AmbientSoundsTable";
import type { AmbientSound } from "./api/ambientSoundsApi";

const sound = (overrides: Partial<AmbientSound> = {}): AmbientSound => ({
  id: "sound-1",
  name: "Rain",
  url: "https://s3.example/rain.mp3?sig=1",
  image_url: "https://s3.example/rain.webp?sig=1",
  is_default: false,
  display_order: 0,
  ...overrides,
});

const renderTable = (sounds: AmbientSound[]) =>
  render(
    <AmbientSoundsTable
      sounds={sounds}
      canManage
      canReorder
      onReorder={vi.fn()}
      onEdit={vi.fn()}
      onDelete={vi.fn()}
    />,
  );

/** The row's cover slot: either the <img> or the placeholder. */
const placeholderFor = (name: string) =>
  screen.queryByLabelText(`${name} has no cover image`);

describe("AmbientSoundsTable — cover image", () => {
  it("renders the thumbnail when the sound has a cover", () => {
    renderTable([sound()]);

    const img = document.querySelector("img");
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute("src", "https://s3.example/rain.webp?sig=1");
    expect(placeholderFor("Rain")).not.toBeInTheDocument();
  });

  it("renders the placeholder when the sound has no cover", () => {
    renderTable([sound({ image_url: null })]);

    expect(document.querySelector("img")).not.toBeInTheDocument();
    expect(placeholderFor("Rain")).toBeInTheDocument();
  });

  it("falls back to the placeholder when the cover fails to load", () => {
    // Covers are presigned and expire after an hour, so a long-open tab will
    // start 403ing. That must degrade to the placeholder, not a broken image.
    renderTable([sound()]);

    const img = document.querySelector("img");
    expect(img).toBeInTheDocument();

    fireEvent.error(img as HTMLImageElement);

    expect(document.querySelector("img")).not.toBeInTheDocument();
    expect(placeholderFor("Rain")).toBeInTheDocument();
  });

  it("keeps one row's cover failure from affecting another row", () => {
    renderTable([
      sound(),
      sound({
        id: "sound-2",
        name: "Sea waves",
        image_url: "https://s3.example/sea.webp?sig=1",
      }),
    ]);

    const [rainImg] = Array.from(document.querySelectorAll("img"));
    fireEvent.error(rainImg);

    expect(placeholderFor("Rain")).toBeInTheDocument();
    expect(placeholderFor("Sea waves")).not.toBeInTheDocument();
    expect(document.querySelectorAll("img")).toHaveLength(1);
  });

  it("retries once a refetch mints a fresh URL", () => {
    const { rerender } = renderTable([sound()]);

    fireEvent.error(document.querySelector("img") as HTMLImageElement);
    expect(placeholderFor("Rain")).toBeInTheDocument();

    // A refetch replaces the expired signature; the new URL is not the one
    // that failed, so it gets its own attempt.
    rerender(
      <AmbientSoundsTable
        sounds={[sound({ image_url: "https://s3.example/rain.webp?sig=2" })]}
        canManage
        canReorder
        onReorder={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(document.querySelector("img")).toHaveAttribute(
      "src",
      "https://s3.example/rain.webp?sig=2",
    );
    expect(placeholderFor("Rain")).not.toBeInTheDocument();
  });
});
