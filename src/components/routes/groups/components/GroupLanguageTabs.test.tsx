import { useState } from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { describe, expect, it, vi } from "vitest";
import { Pecha } from "@/components/ui/shadimport";
import type { LanguageCode } from "@/schema/SeriesSchema";
import { groupCoreSchema, type GroupCoreFormData } from "@/schema/GroupSchema";
import { languageLabelForCode } from "../api/groupsApi";
import GroupLanguageTabs from "./GroupLanguageTabs";

const ALL: LanguageCode[] = ["EN", "BO", "ZH"];
const label = (code: LanguageCode) => languageLabelForCode(code);
const BLANK = { title: "", sub_title: "", description: "", description_long: "" };

type HarnessProps = {
  initial?: LanguageCode[];
  all?: LanguageCode[];
  onSubmit?: (data: GroupCoreFormData) => void;
  defaults?: Partial<Record<LanguageCode, Partial<typeof BLANK>>>;
};

/** Hosts the tabs the way the create and edit pages do: the page owns the
 *  list of added languages and the real group schema validates the form. */
const Harness = ({
  initial = ["EN"],
  all = ALL,
  onSubmit = () => {},
  defaults = {},
}: HarnessProps) => {
  const [languages, setLanguages] = useState<LanguageCode[]>(initial);
  const form = useForm<GroupCoreFormData>({
    resolver: zodResolver(groupCoreSchema),
    defaultValues: {
      slug: "g",
      group_type: "COMMUNITY",
      is_public: true,
      languages: Object.fromEntries(
        initial.map((code) => [code, { ...BLANK, ...defaults[code] }]),
      ),
    },
  });
  const available = all
    .filter((code) => !languages.includes(code))
    .map((code) => ({ value: code, label: label(code) }));

  return (
    <Pecha.Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <GroupLanguageTabs
          form={form}
          languages={languages}
          availableLanguages={available}
          onAddLanguage={(code) => {
            setLanguages((prev) => [...prev, code]);
            form.setValue(`languages.${code}`, BLANK);
          }}
          onRemoveLanguage={(code) => {
            setLanguages((prev) => prev.filter((c) => c !== code));
            form.unregister(`languages.${code}`);
          }}
        />
        <button type="submit">Save</button>
      </form>
    </Pecha.Form>
  );
};

const tabNames = () =>
  screen.getAllByRole("tab").map((tab) => tab.textContent?.trim());

const selectedTab = () =>
  screen
    .getAllByRole("tab")
    .find((tab) => tab.getAttribute("aria-selected") === "true")
    ?.textContent?.trim();

describe("GroupLanguageTabs", () => {
  it("shows a tab for each language with Add language as the last tab", () => {
    render(<Harness initial={["EN", "BO"]} />);
    expect(tabNames()).toEqual([label("EN"), label("BO"), "Add language"]);
  });

  it("opens on the first language", () => {
    render(<Harness initial={["BO", "EN"]} />);
    expect(selectedTab()).toBe(label("BO"));
  });

  it("marks only the title as required", () => {
    render(<Harness />);
    const title = screen.getByText(new RegExp(`${label("EN")} title`));
    expect(title.textContent).toContain("*");
    for (const field of ["sub-title", "description", "long description"]) {
      const text = screen.getByText(new RegExp(`${label("EN")} ${field}`));
      expect(text.textContent).toContain("(optional)");
      expect(text.textContent).not.toContain("*");
    }
  });

  it("accepts a group with only a title", async () => {
    const onSubmit = vi.fn();
    render(<Harness onSubmit={onSubmit} />);
    await userEvent.type(
      screen.getByLabelText(new RegExp(`${label("EN")} title`)),
      "Dharma Circle",
    );
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0].languages.EN).toMatchObject({
      title: "Dharma Circle",
      sub_title: "",
      description: "",
    });
  });

  it("will not save without a title", async () => {
    const onSubmit = vi.fn();
    render(<Harness onSubmit={onSubmit} />);
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Title is required")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("asks for a title in every language", async () => {
    const onSubmit = vi.fn();
    render(
      <Harness
        initial={["EN", "BO"]}
        defaults={{ EN: { title: "Dharma Circle" }, BO: { sub_title: "only this" } }}
        onSubmit={onSubmit}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await screen.findByText("Title is required");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("flags the tab with the problem and jumps to it after a failed save", async () => {
    render(
      <Harness
        initial={["EN", "BO"]}
        defaults={{ EN: { title: "Dharma Circle" } }}
      />,
    );
    expect(selectedTab()).toBe(label("EN"));

    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(selectedTab()).toContain(label("BO")));
    const boTab = screen.getByRole("tab", { name: new RegExp(label("BO")) });
    expect(within(boTab).getByLabelText("has errors")).toBeInTheDocument();
    const enTab = screen.getByRole("tab", { name: new RegExp(label("EN")) });
    expect(within(enTab).queryByLabelText("has errors")).not.toBeInTheDocument();
  });

  it("stays where it is when the open tab is the one with the problem", async () => {
    render(<Harness initial={["EN", "BO"]} defaults={{ BO: { title: "Chos" } }} />);
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await screen.findByText("Title is required");
    expect(selectedTab()).toContain(label("EN"));
  });

  it("keeps what was typed when moving between tabs", async () => {
    render(<Harness initial={["EN", "BO"]} />);
    const enTitle = screen.getByLabelText(new RegExp(`${label("EN")} title`));
    await userEvent.type(enTitle, "Dharma Circle");

    await userEvent.click(screen.getByRole("tab", { name: label("BO") }));
    expect(selectedTab()).toBe(label("BO"));
    await userEvent.click(screen.getByRole("tab", { name: label("EN") }));

    expect(screen.getByLabelText(new RegExp(`${label("EN")} title`))).toHaveValue(
      "Dharma Circle",
    );
  });

  it("adds a language as a new tab before Add language and opens it", async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole("tab", { name: /add language/i }));
    expect(screen.getByText(/only its title is required/i)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: label("BO") }));

    expect(tabNames()).toEqual([label("EN"), label("BO"), "Add language"]);
    expect(selectedTab()).toBe(label("BO"));
    expect(screen.getByLabelText(new RegExp(`${label("BO")} title`))).toBeVisible();
  });

  it("offers only the languages not added yet", async () => {
    render(<Harness initial={["EN", "BO"]} />);
    await userEvent.click(screen.getByRole("tab", { name: /add language/i }));
    expect(screen.getByRole("button", { name: label("ZH") })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: label("BO") })).not.toBeInTheDocument();
  });

  it("drops the Add language tab once every language is added", () => {
    render(<Harness initial={["EN", "BO"]} all={["EN", "BO"]} />);
    expect(tabNames()).toEqual([label("EN"), label("BO")]);
  });

  it("removes a language and falls back to the first tab", async () => {
    render(<Harness initial={["EN", "BO"]} />);
    await userEvent.click(screen.getByRole("tab", { name: label("BO") }));
    fireEvent.click(screen.getByRole("button", { name: `Remove ${label("BO")}` }));

    await waitFor(() =>
      expect(tabNames()).toEqual([label("EN"), "Add language"]),
    );
    expect(selectedTab()).toBe(label("EN"));
  });

  it("cannot remove the only language", () => {
    render(<Harness />);
    expect(screen.queryByRole("button", { name: /^remove /i })).not.toBeInTheDocument();
  });
});
