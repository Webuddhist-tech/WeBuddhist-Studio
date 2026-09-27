import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import GroupEventLivePage from "./GroupEventLivePage";
import type { RecitationDetails } from "./api/recitationLiveApi";

const {
  fetchRecitationDetails,
  fetchCmsEvent,
  fetchChantCollection,
  sendPosition,
} = vi.hoisted(() => ({
  fetchRecitationDetails: vi.fn(),
  fetchCmsEvent: vi.fn(),
  fetchChantCollection: vi.fn(),
  sendPosition: vi.fn(() => true),
}));

vi.mock("./api/recitationLiveApi", async () => {
  const actual = await vi.importActual<typeof import("./api/recitationLiveApi")>(
    "./api/recitationLiveApi",
  );
  return { ...actual, fetchRecitationDetails };
});

vi.mock("./api/eventsApi", async () => {
  const actual = await vi.importActual<typeof import("./api/eventsApi")>(
    "./api/eventsApi",
  );
  return { ...actual, fetchCmsEvent };
});

vi.mock("./api/chantsApi", async () => {
  const actual = await vi.importActual<typeof import("./api/chantsApi")>(
    "./api/chantsApi",
  );
  return { ...actual, fetchChantCollection };
});

vi.mock("./hooks/useRecitationSocket", () => ({
  useRecitationSocket: () => ({
    state: "connected",
    isOperator: true,
    notice: null,
    livePosition: null,
    isOpen: true,
    connect: vi.fn(),
    disconnect: vi.fn(),
    sendPosition,
    endSession: vi.fn(),
  }),
}));

vi.mock("@/hooks/useLanguages", () => ({
  useLanguages: () => ({
    languageOptions: [
      { value: "BO", label: "Tibetan" },
      { value: "EN", label: "English" },
    ],
  }),
}));

vi.mock("react-router-dom", async () => {
  const actual =
    await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    useParams: () => ({ groupId: "g1", eventId: "e1" }),
    useOutletContext: () => ({
      myRole: "OWNER",
      userInfo: null,
      readOnlyPlatform: false,
    }),
  };
});

const details = (
  textId: string,
  language: string,
  content: string,
): RecitationDetails => ({
  text_id: textId,
  title: textId,
  segments: [
    { recitation: { [language]: { id: `${textId}-${language}`, content } } },
  ],
});

const deferred = <T,>() => {
  let resolve: (value: T) => void = () => {};
  let reject: (reason?: unknown) => void = () => {};
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

const renderPage = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <GroupEventLivePage />
    </QueryClientProvider>,
  );
};

describe("GroupEventLivePage", () => {
  beforeEach(() => {
    fetchRecitationDetails.mockReset();
    fetchCmsEvent.mockReset();
    fetchChantCollection.mockReset();
    sendPosition.mockClear();
    Element.prototype.scrollIntoView = vi.fn();
    Element.prototype.hasPointerCapture = () => false;
    Element.prototype.setPointerCapture = () => {};
    Element.prototype.releasePointerCapture = () => {};
    fetchCmsEvent.mockResolvedValue({ metadata: [] });
  });

  it("keeps the newer liturgy when an earlier text request finishes last", async () => {
    const user = userEvent.setup();
    const first = deferred<RecitationDetails>();
    const second = deferred<RecitationDetails>();
    fetchRecitationDetails.mockImplementation((textId: string) =>
      textId === "text-a" ? first.promise : second.promise,
    );
    fetchCmsEvent.mockResolvedValue({
      metadata: [],
      group_recitation_collection_id: "col-1",
    });
    fetchChantCollection.mockResolvedValue({
      items: [
        { id: "1", text_id: "text-a", title: "Liturgy A", display_order: 1 },
        { id: "2", text_id: "text-b", title: "Liturgy B", display_order: 2 },
      ],
    });

    renderPage();

    const liturgy = await screen.findByRole("combobox", { name: "Liturgy" });
    await user.click(liturgy);
    await user.click(await screen.findByRole("option", { name: "Liturgy A" }));
    await waitFor(() =>
      expect(fetchRecitationDetails).toHaveBeenCalledWith("text-a", "bo"),
    );

    await user.click(liturgy);
    await user.click(await screen.findByRole("option", { name: "Liturgy B" }));
    await waitFor(() =>
      expect(fetchRecitationDetails).toHaveBeenCalledWith("text-b", "bo"),
    );

    await act(async () => {
      second.resolve(details("text-b", "bo", "Newer line"));
    });
    expect(await screen.findByText("Newer line")).toBeInTheDocument();

    await act(async () => {
      first.resolve(details("text-a", "bo", "Older line"));
    });
    expect(screen.getByText("Newer line")).toBeInTheDocument();
    expect(screen.queryByText("Older line")).not.toBeInTheDocument();
  });

  it("drops an in-flight load after the operator changes language", async () => {
    const user = userEvent.setup();
    const tibetan = deferred<RecitationDetails>();
    fetchRecitationDetails.mockImplementation((_textId: string, language: string) => {
      if (language === "en") {
        return Promise.resolve(details("text-a", "en", "English line"));
      }
      return tibetan.promise;
    });

    renderPage();

    const textId = await screen.findByLabelText("Text id");
    await user.type(textId, "text-a");
    await user.click(screen.getByRole("button", { name: "Load text" }));
    await waitFor(() =>
      expect(fetchRecitationDetails).toHaveBeenCalledWith("text-a", "bo"),
    );

    await user.click(screen.getByRole("combobox", { name: "Language" }));
    await user.click(await screen.findByRole("option", { name: "English" }));

    expect(await screen.findByText("English line")).toBeInTheDocument();

    await act(async () => {
      tibetan.resolve(details("text-a", "bo", "Tibetan line"));
    });
    expect(screen.getByText("English line")).toBeInTheDocument();
    expect(screen.queryByText("Tibetan line")).not.toBeInTheDocument();
  });

  it("does not publish when Space or arrows are used on a toolbar button", async () => {
    const user = userEvent.setup();
    fetchRecitationDetails.mockResolvedValue(details("text-a", "bo", "Line one"));

    renderPage();
    const textId = await screen.findByLabelText("Text id");
    await user.type(textId, "text-a");
    await user.click(screen.getByRole("button", { name: "Load text" }));
    expect(await screen.findByText("Line one")).toBeInTheDocument();
    sendPosition.mockClear();

    const loadText = screen.getByRole("button", { name: "Load text" });
    loadText.focus();
    expect(loadText).toHaveFocus();
    const spaceAllowed = loadText.dispatchEvent(
      new KeyboardEvent("keydown", { code: "Space", bubbles: true, cancelable: true }),
    );
    expect(spaceAllowed).toBe(true);
    expect(sendPosition).not.toHaveBeenCalled();

    const nextRound = screen.getByRole("button", { name: "Next round" });
    nextRound.focus();
    const arrowAllowed = nextRound.dispatchEvent(
      new KeyboardEvent("keydown", {
        code: "ArrowDown",
        bubbles: true,
        cancelable: true,
      }),
    );
    expect(arrowAllowed).toBe(true);
    expect(sendPosition).not.toHaveBeenCalled();
  });

  it("still advances from the liturgy and from the page itself", async () => {
    const user = userEvent.setup();
    fetchRecitationDetails.mockResolvedValue({
      text_id: "text-a",
      title: "text-a",
      segments: [
        { recitation: { bo: { id: "line-1", content: "Line one" } } },
        { recitation: { bo: { id: "line-2", content: "Line two" } } },
      ],
    });

    renderPage();
    const textId = await screen.findByLabelText("Text id");
    await user.type(textId, "text-a");
    await user.click(screen.getByRole("button", { name: "Load text" }));
    const line = await screen.findByRole("button", { name: /Line one/ });

    let fromLine = true;
    await act(async () => {
      fromLine = line.dispatchEvent(
        new KeyboardEvent("keydown", {
          code: "Space",
          bubbles: true,
          cancelable: true,
        }),
      );
    });
    expect(fromLine).toBe(false);
    expect(sendPosition).toHaveBeenCalledWith(
      expect.objectContaining({ segment_id: "line-1", index: 0 }),
    );

    sendPosition.mockClear();
    let fromPage = true;
    await act(async () => {
      fromPage = document.body.dispatchEvent(
        new KeyboardEvent("keydown", {
          code: "ArrowDown",
          bubbles: true,
          cancelable: true,
        }),
      );
    });
    expect(fromPage).toBe(false);
    expect(sendPosition).toHaveBeenCalledWith(
      expect.objectContaining({ segment_id: "line-2", index: 1 }),
    );
  });
});
