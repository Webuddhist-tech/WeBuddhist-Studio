import { useEffect, useState, type ReactNode } from "react";
import pechaIcon from "../../../../assets/icon/pecha_icon.png";
import { Link } from "react-router-dom";
import { ModeToggle } from "../mode-toggle/modetoggle";
import {
  IoChevronBack,
  IoChevronForward,
  IoChevronDown,
} from "react-icons/io5";
import { SIDEBAR_EXPANDED, SIDEBAR_OPEN_SECTIONS } from "@/lib/constant";
import { LanguageToggle } from "../language-toggle/languageToggle";
import AuthLogout from "../auth-logout/AuthLogout";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../../atoms/tooltip";
import AuthAvatar from "@/components/ui/molecules/auth-avatar/AuthAvatar";
import { useNavModel, type NavItem } from "./useNavModel";

const tooltipItems = [
  {
    id: "avatar",
    component: <AuthAvatar />,
    label: "View Profile",
    /** The header already shows the avatar on wider screens. */
    rowClassName: "md:hidden",
  },
  {
    id: "theme",
    component: <ModeToggle />,
    label: "Change theme",
  },
  {
    id: "language",
    component: <LanguageToggle />,
    label: "Change language",
  },
  {
    id: "logout",
    component: <AuthLogout />,
    label: "Logout",
  },
];

/** Tailwind's `md`. Narrower than this, a 224px sidebar crowds out the page. */
const WIDE_VIEWPORT_MIN_WIDTH = 768;

/** The sidebar sits beside the page, so only a wide viewport can spare the width. */
const fitsExpandedSidebar = () =>
  typeof window === "undefined" || window.innerWidth >= WIDE_VIEWPORT_MIN_WIDTH;

/**
 * Expanded by default, because the sections only read as groups once labelled —
 * but never on a narrow viewport, where that would leave the page a sliver.
 */
const readStoredExpanded = () => {
  try {
    const stored = localStorage.getItem(SIDEBAR_EXPANDED);
    if (stored !== null) return stored === "true";
  } catch {
    // An unreadable store just means there is no preference to honour yet.
  }
  return fitsExpandedSidebar();
};

const readStoredOpenSections = (): string[] => {
  try {
    const stored = localStorage.getItem(SIDEBAR_OPEN_SECTIONS);
    const parsed = stored ? JSON.parse(stored) : null;
    return Array.isArray(parsed)
      ? parsed.filter((id): id is string => typeof id === "string")
      : [];
  } catch {
    return [];
  }
};

const Navbar = () => {
  const {
    pathname,
    homePath,
    isActive,
    visiblePinnedItems,
    sections,
    activeSectionId,
  } = useNavModel();
  const [expanded, setExpanded] = useState(readStoredExpanded);
  const [openSections, setOpenSections] = useState(readStoredOpenSections);

  /**
   * The section you are working in opens itself, so the current page is never
   * hidden. Keyed on the path as well as the section, because moving between two
   * pages of one section leaves the id unchanged and still has to reopen it.
   */
  useEffect(() => {
    if (!activeSectionId) return;
    setOpenSections((previous) =>
      previous.includes(activeSectionId)
        ? previous
        : [...previous, activeSectionId],
    );
  }, [activeSectionId, pathname]);

  const toggleSection = (id: string) => {
    setOpenSections((previous) => {
      const next = previous.includes(id)
        ? previous.filter((openId) => openId !== id)
        : [...previous, id];
      try {
        localStorage.setItem(SIDEBAR_OPEN_SECTIONS, JSON.stringify(next));
      } catch {
        // A blocked storage quota shouldn't stop a section from opening.
      }
      return next;
    });
  };

  const toggleExpanded = () => {
    setExpanded((previous) => {
      const next = !previous;
      try {
        localStorage.setItem(SIDEBAR_EXPANDED, String(next));
      } catch {
        // A blocked storage quota shouldn't stop the sidebar from moving.
      }
      return next;
    });
  };

  /** Labels carry the meaning once expanded, so tooltips would just repeat them. */
  const withTooltip = (key: string, trigger: ReactNode, label: string) =>
    expanded ? (
      <div key={key}>{trigger}</div>
    ) : (
      <Tooltip key={key}>
        <TooltipTrigger asChild>{trigger}</TooltipTrigger>
        <TooltipContent side="right">{label}</TooltipContent>
      </Tooltip>
    );

  const renderNavLink = (item: NavItem, nested = false) =>
    withTooltip(
      item.path,
      <Link
        to={item.path}
        aria-label={item.tooltip}
        aria-current={isActive(item.path) ? "page" : undefined}
        className={`flex items-center rounded-md border p-2 transition-all duration-300 hover:cursor-pointer hover:text-black dark:hover:text-white ${
          expanded ? "w-full gap-3" : "justify-center"
        } ${expanded && nested ? "ml-2" : ""} ${
          isActive(item.path)
            ? "text-zinc-900 dark:text-zinc-100"
            : "text-zinc-400 dark:text-zinc-600"
        }`}
      >
        {item.icon}
        {expanded && <span className="truncate text-sm">{item.label}</span>}
      </Link>,
      item.tooltip,
    );

  return (
    <TooltipProvider>
      <nav
        aria-label="Main"
        data-expanded={expanded}
        className={`font-dynamic flex shrink-0 flex-col justify-between overflow-hidden border-r border-gray-200 dark:border-[#313132] p-2 transition-[width] duration-300 ${
          expanded ? "w-56" : "w-16"
        }`}
      >
        {/* The links scroll on their own so a tall nav never pushes the controls
            below the fold on a short viewport. */}
        <div className="flex min-h-0 flex-1 flex-col space-y-8">
          <div
            className={`mt-4 flex shrink-0 items-center ${
              expanded ? "justify-between gap-2" : "flex-col gap-3"
            }`}
          >
            <Link
              to={homePath}
              className="group flex items-center gap-2 overflow-hidden"
            >
              <img
                src={pechaIcon}
                alt="Pecha Studio Logo"
                className="h-10 w-10 shrink-0 transition-transform duration-800 group-hover:rotate-180"
              />
              {expanded && (
                <span className="truncate text-sm font-semibold">
                  Pecha Studio
                </span>
              )}
            </Link>
            <button
              type="button"
              onClick={toggleExpanded}
              aria-expanded={expanded}
              aria-label={expanded ? "Collapse sidebar" : "Expand sidebar"}
              className="rounded-md border p-1.5 text-zinc-400 transition-colors hover:text-black dark:text-zinc-500 dark:hover:text-white"
            >
              {expanded ? (
                <IoChevronBack className="h-4 w-4" />
              ) : (
                <IoChevronForward className="h-4 w-4" />
              )}
            </button>
          </div>

          <div
            className={`flex min-h-0 w-full flex-1 flex-col overflow-y-auto ${
              expanded ? "space-y-2" : "items-center space-y-4"
            }`}
          >
            {visiblePinnedItems.map((item) => renderNavLink(item))}

            {sections.map((section) =>
              expanded ? (
                <div key={section.id} className="flex flex-col space-y-2">
                  <button
                    type="button"
                    onClick={() => toggleSection(section.id)}
                    aria-expanded={openSections.includes(section.id)}
                    className="mt-2 flex items-center justify-between rounded-md px-2 py-1 text-xs font-semibold uppercase tracking-wide text-zinc-500 transition-colors hover:text-black dark:text-zinc-400 dark:hover:text-white"
                  >
                    <span className="truncate">{section.label}</span>
                    <IoChevronDown
                      className={`h-3 w-3 shrink-0 transition-transform duration-200 ${
                        openSections.includes(section.id) ? "" : "-rotate-90"
                      }`}
                    />
                  </button>
                  {openSections.includes(section.id) &&
                    section.items.map((item) => renderNavLink(item, true))}
                </div>
              ) : (
                /* Collapsed to icons there is no room for a header, so the
                   sections flatten into one rail and a rule separates them. */
                <div
                  key={section.id}
                  className="flex w-full flex-col items-center space-y-4 border-t border-gray-200 pt-4 dark:border-[#313132]"
                >
                  {section.items.map((item) => renderNavLink(item))}
                </div>
              ),
            )}
          </div>
        </div>

        <div
          className={`flex shrink-0 flex-col space-y-2 pt-2 pb-2 ${
            expanded ? "" : "items-center"
          }`}
        >
          {tooltipItems.map((item) =>
            expanded ? (
              <div
                key={item.id}
                className={`flex items-center gap-3 ${item.rowClassName ?? ""}`}
              >
                {item.component}
                <span className="truncate text-sm text-zinc-500 dark:text-zinc-400">
                  {item.label}
                </span>
              </div>
            ) : (
              withTooltip(
                item.id,
                <div className={item.rowClassName}>{item.component}</div>,
                item.label,
              )
            ),
          )}
        </div>
      </nav>
    </TooltipProvider>
  );
};

export default Navbar;
