import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import VisibleNewlineTextarea, { NEWLINE_MARKER } from "./VisibleNewlineTextarea";

const Harness = ({ initial = "" }: { initial?: string }) => {
  const [value, setValue] = useState(initial);
  return (
    <VisibleNewlineTextarea
      aria-label="verse"
      value={value}
      onValueChange={setValue}
    />
  );
};

const markerCount = () =>
  (screen.getByTestId("newline-markers").textContent ?? "").split(
    NEWLINE_MARKER,
  ).length - 1;

describe("VisibleNewlineTextarea", () => {
  it("shows no marker when the text has no line break", () => {
    render(<Harness initial="one long wrapped line" />);

    expect(markerCount()).toBe(0);
  });

  it("shows one marker per line break, including blank lines", () => {
    render(<Harness initial={"a\nb\n\nc"} />);

    expect(markerCount()).toBe(3);
  });

  it("adds a marker as soon as Enter is typed", async () => {
    render(<Harness />);

    await userEvent.type(screen.getByLabelText("verse"), "a{Enter}b");

    expect(markerCount()).toBe(1);
    expect(screen.getByLabelText("verse")).toHaveValue("a\nb");
  });

  it("keeps the markers out of the textarea value and the accessibility tree", () => {
    render(<Harness initial={"a\nb"} />);

    expect(screen.getByLabelText("verse")).toHaveValue("a\nb");
    expect(screen.getByTestId("newline-markers")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
  });
});
