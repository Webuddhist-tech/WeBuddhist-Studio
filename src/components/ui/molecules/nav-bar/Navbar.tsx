import { useState, type ReactNode } from "react";
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
import { SIDEBAR_EXPANDED } from "@/lib/constant";
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
  canManageTimerAudios,
  isStaffRole,
} from "@/lib/platformAccess";

const navItems = [
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
  {
    icon: <IoPeople className="w-4 h-4" />,
    label: "Groups",
    path: ROUTES.groups,
    tooltip: "Manage author groups",
  },
  {
    icon: <MdAudioFile className="w-4 h-4" />,
    label: "Text audio",
    path: ROUTES.textAudio,
    tooltip: "Manage text audio",
  },
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
];

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

const readStoredExpanded = () => {
  try {
    return localStorage.getItem(SIDEBAR_EXPANDED) === "true";
  } catch {
    return false;
  }
};

const Navbar = () => {
  const location = useLocation();
  const { data: userInfo, isLoading: isUserInfoLoading } = useUserInfo();
  const [expanded, setExpanded] = useState(readStoredExpanded);
  const showAdminAuthors = canAccessAdminAuthors(userInfo?.platform_role);
  /** Reviewers reach the admin section, but this catalogue is Super Admin only. */
  const showTimerAudios = canManageTimerAudios(userInfo?.platform_role);
  /** Plain CREATOR accounts only manage their author groups — no other CMS pages. */
  const isGroupsOnly =
    !isUserInfoLoading && !isStaffRole(userInfo?.platform_role);

  const visibleNavItems = isGroupsOnly
    ? navItems.filter((item) => item.path === ROUTES.groups)
    : navItems;

  const allNavItems = [
    ...visibleNavItems,
    ...(showAdminAuthors
      ? [
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
          {
            icon: <MdMusicNote className="w-4 h-4" />,
            label: "Ambient Sounds",
            path: ROUTES.ambientSounds,
            tooltip: "Manage ambient sound catalog",
          },
          ...(showTimerAudios
            ? [
                {
                  icon: <MdMusicNote className="w-4 h-4" />,
                  label: "Timer Audios",
                  path: ROUTES.timerAudios,
                  tooltip: "Manage timer audio presets",
                },
              ]
            : []),
        ]
      : []),
  ];

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
            className={`flex w-full flex-col space-y-4 ${
              expanded ? "" : "items-center"
            }`}
          >
            {allNavItems.map((item) =>
              withTooltip(
                item.path,
                <Link
                  to={item.path}
                  aria-label={item.tooltip}
                  className={`flex items-center rounded-md border p-2 transition-all duration-300 hover:cursor-pointer hover:text-black dark:hover:text-white ${
                    expanded ? "w-full gap-3" : "justify-center"
                  } ${
                    isActivePath(item.path, location.pathname)
                      ? "text-zinc-900 dark:text-zinc-100"
                      : "text-zinc-400 dark:text-zinc-600"
                  }`}
                >
                  {item.icon}
                  {expanded && (
                    <span className="truncate text-sm">{item.label}</span>
                  )}
                </Link>,
                item.tooltip,
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
