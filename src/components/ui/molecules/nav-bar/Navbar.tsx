import { useEffect, useState, type ReactNode } from "react";
import pechaIcon from "../../../../assets/icon/pecha_icon.png";
import { Link, useLocation } from "react-router-dom";
import { ModeToggle } from "../mode-toggle/modetoggle";
import {
  IoAnalytics,
  IoPricetags,
  IoPeople,
  IoPulse,
  IoBook,
  IoBookOutline,
  IoDocumentTextOutline,
  IoChevronBack,
  IoChevronForward,
  IoChevronDown,
} from "react-icons/io5";
import {
  MdAudioFile,
  MdDashboard,
  MdAdminPanelSettings,
  MdOutlineReportProblem,
  MdPublicOff,
  MdMusicNote,
} from "react-icons/md";
import { ROUTES } from "@/routes/paths";
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
import { useUserInfo } from "@/hooks/useUserInfo";
import {
  canAccessAdminAuthors,
  canManageAmbientSounds,
  isStaffRole,
} from "@/lib/platformAccess";

type NavItem = {
  icon: ReactNode;
  label: string;
  path: string;
  tooltip: string;
};

type NavSection = {
  id: string;
  label: string;
  items: NavItem[];
};

/** Everyday destinations, left out of the sections so they stay one click away. */
const pinnedItems: NavItem[] = [
  {
    icon: <MdDashboard className="w-4 h-4" />,
    label: "Dashboard",
    path: ROUTES.dashboard,
    tooltip: "Go to dashboard",
  },
  {
    icon: <IoAnalytics className="w-4 h-4" />,
    label: "Analytics",
    path: ROUTES.analytics,
    tooltip: "View analytics",
  },
  {
    icon: <IoPeople className="w-4 h-4" />,
    label: "Groups",
    path: ROUTES.groups,
    tooltip: "Manage author groups",
  },
];

const contentItems: NavItem[] = [
  {
    icon: <IoBookOutline className="w-4 h-4" />,
    label: "Verse of Day",
    path: ROUTES.verseOfDay,
    tooltip: "Verse of Day",
  },
  {
    icon: <IoDocumentTextOutline className="w-4 h-4" />,
    label: "Poems",
    path: ROUTES.poems,
    tooltip: "Poems",
  },
  {
    icon: <MdAudioFile className="w-4 h-4" />,
    label: "Text audio",
    path: ROUTES.textAudio,
    tooltip: "Manage text audio",
  },
];

const configurationItems: NavItem[] = [
  {
    icon: <IoPricetags className="w-4 h-4" />,
    label: "Tags",
    path: ROUTES.tags,
    tooltip: "Manage tags",
  },
  {
    icon: <IoBook className="w-4 h-4" />,
    label: "Traditions",
    path: ROUTES.traditions,
    tooltip: "Manage traditions",
  },
  {
    icon: <IoPulse className="w-4 h-4" />,
    label: "Presets",
    path: ROUTES.accumulatorPresets,
    tooltip: "Manage accumulator presets",
  },
];

const administrationItems: NavItem[] = [
  {
    icon: <MdAdminPanelSettings className="w-4 h-4" />,
    label: "Authors",
    path: ROUTES.adminAuthors,
    tooltip: "Author administration",
  },
  {
    icon: <MdPublicOff className="w-4 h-4" />,
    label: "China",
    path: ROUTES.adminChinaRestrictions,
    tooltip: "China content restrictions",
  },
  {
    icon: <MdOutlineReportProblem className="w-4 h-4" />,
    label: "Chat Reports",
    path: ROUTES.adminChatReports,
    tooltip: "Chat moderation reports",
  },
];

/** Super Admin only, but it reads as one of the media catalogues. */
const ambientSoundsItem: NavItem = {
  icon: <MdMusicNote className="w-4 h-4" />,
  label: "Ambient Sounds",
  path: ROUTES.ambientSounds,
  tooltip: "Manage ambient sound catalog",
};

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

/** Section landing pages own every route beneath them, so match on the prefix. */
const SECTION_PATHS: string[] = [
  ROUTES.groups,
  ROUTES.adminAuthors,
  ROUTES.adminChinaRestrictions,
  ROUTES.adminChatReports,
];

const isActivePath = (itemPath: string, currentPath: string) => {
  if (currentPath === itemPath) return true;
  if (itemPath === ROUTES.dashboard && currentPath === "/") return true;
  return SECTION_PATHS.includes(itemPath) && currentPath.startsWith(itemPath);
};

/** Expanded is the default: the grouped sections only read as groups with labels. */
const readStoredExpanded = () => {
  try {
    const stored = localStorage.getItem(SIDEBAR_EXPANDED);
    return stored === null ? true : stored === "true";
  } catch {
    return true;
  }
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
  const location = useLocation();
  const { data: userInfo, isLoading: isUserInfoLoading } = useUserInfo();
  const [expanded, setExpanded] = useState(readStoredExpanded);
  const [openSections, setOpenSections] = useState(readStoredOpenSections);
  const showAdminAuthors = canAccessAdminAuthors(userInfo?.platform_role);
  /** Reviewers reach the admin section, but this catalogue is Super Admin only. */
  const showAmbientSounds = canManageAmbientSounds(userInfo?.platform_role);
  /** Plain CREATOR accounts only manage their author groups — no other CMS pages. */
  const isGroupsOnly =
    !isUserInfoLoading && !isStaffRole(userInfo?.platform_role);

  const visiblePinnedItems = isGroupsOnly
    ? pinnedItems.filter((item) => item.path === ROUTES.groups)
    : pinnedItems;

  /** A CREATOR sees a single link, so grouping it under a header would be noise. */
  const sections: NavSection[] = isGroupsOnly
    ? []
    : [
        {
          id: "content",
          label: "Content",
          items: showAmbientSounds
            ? [...contentItems, ambientSoundsItem]
            : contentItems,
        },
        {
          id: "configuration",
          label: "Configuration",
          items: configurationItems,
        },
        ...(showAdminAuthors
          ? [
              {
                id: "administration",
                label: "Administration",
                items: administrationItems,
              },
            ]
          : []),
      ];

  const activeSectionId = sections.find((section) =>
    section.items.some((item) => isActivePath(item.path, location.pathname)),
  )?.id;

  /** The section you are working in opens itself, so the current page is never hidden. */
  useEffect(() => {
    if (!activeSectionId) return;
    setOpenSections((previous) =>
      previous.includes(activeSectionId)
        ? previous
        : [...previous, activeSectionId],
    );
  }, [activeSectionId]);

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
        className={`flex items-center rounded-md border p-2 transition-all duration-300 hover:cursor-pointer hover:text-black dark:hover:text-white ${
          expanded ? "w-full gap-3" : "justify-center"
        } ${expanded && nested ? "ml-2" : ""} ${
          isActivePath(item.path, location.pathname)
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
        className={`font-dynamic flex flex-col justify-between border-r border-gray-200 dark:border-[#313132] p-2 transition-[width] duration-300 ${
          expanded ? "w-56" : "w-16"
        }`}
      >
        <div className="flex flex-col space-y-8">
          <div
            className={`mt-4 flex items-center ${
              expanded ? "justify-between gap-2" : "flex-col gap-3"
            }`}
          >
            <Link
              to={isGroupsOnly ? ROUTES.groups : ROUTES.dashboard}
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
            className={`flex w-full flex-col ${
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
          className={`flex flex-col space-y-2 pb-2 ${
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
