import type { ReactNode } from "react";
import { useLocation } from "react-router-dom";
import {
  IoAnalytics,
  IoPricetags,
  IoPulse,
  IoBook,
  IoBookOutline,
  IoDocumentTextOutline,
  IoHeartOutline,
  IoNewspaperOutline,
} from "react-icons/io5";
import {
  MdAudioFile,
  MdDashboard,
  MdAdminPanelSettings,
  MdOutlineReportProblem,
  MdPublicOff,
  MdMusicNote,
  MdSelfImprovement,
} from "react-icons/md";
import { ROUTES } from "@/routes/paths";
import { useUserInfo } from "@/hooks/useUserInfo";
import { useOpenGroupListPath } from "@/hooks/useOpenGroupListPath";
import {
  canAccessAdminAuthors,
  canManageAmbientSounds,
  isStaffRole,
} from "@/lib/platformAccess";

export type NavItem = {
  icon: ReactNode;
  label: string;
  path: string;
  tooltip: string;
};

export type NavSection = {
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
    icon: <MdSelfImprovement className="w-4 h-4" />,
    label: "Practice spaces",
    path: ROUTES.groups,
    tooltip: "Manage practice spaces",
  },
  {
    icon: <IoNewspaperOutline className="w-4 h-4" />,
    label: "Pages",
    path: ROUTES.pages,
    tooltip: "Manage pages",
  },
];

/** The two group lists, told apart inside a group by its type. */
const GROUP_LIST_PATHS: string[] = [ROUTES.groups, ROUTES.pages];

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
  {
    icon: <IoHeartOutline className="w-4 h-4" />,
    label: "Prayer intentions",
    path: ROUTES.prayerIntentions,
    tooltip: "Prayer intentions catalog",
  },
];

/** Super Admin only, but it reads as one of the media catalogues. */
const ambientSoundsItem: NavItem = {
  icon: <MdMusicNote className="w-4 h-4" />,
  label: "Ambient Sounds",
  path: ROUTES.ambientSounds,
  tooltip: "Manage ambient sound catalog",
};

/** Section landing pages own every route beneath them, so match on the prefix. */
const SECTION_PATHS: string[] = [
  ROUTES.groups,
  ROUTES.pages,
  ROUTES.adminAuthors,
  ROUTES.adminChinaRestrictions,
  ROUTES.adminChatReports,
];

export const isActivePath = (itemPath: string, currentPath: string) => {
  if (currentPath === itemPath) return true;
  if (itemPath === ROUTES.dashboard && currentPath === "/") return true;
  return SECTION_PATHS.includes(itemPath) && currentPath.startsWith(itemPath);
};

/**
 * What the Studio's navigation offers this account, shared by the desktop
 * sidebar and the phone's tab bar and menu so the two never drift apart.
 */
export function useNavModel() {
  const location = useLocation();
  const { data: userInfo, isLoading: isUserInfoLoading } = useUserInfo();
  const showAdminAuthors = canAccessAdminAuthors(userInfo?.platform_role);
  /** Reviewers reach the admin section, but this catalogue is Super Admin only. */
  const showAmbientSounds = canManageAmbientSounds(userInfo?.platform_role);
  /** Plain CREATOR accounts only manage their practice spaces — no pages and
   * no other CMS pages. */
  const isGroupsOnly =
    !isUserInfoLoading && !isStaffRole(userInfo?.platform_role);
  const openGroup = useOpenGroupListPath(location.pathname);

  /**
   * Inside a practice space or page the URL alone can't say which list it came
   * from, so neither lights up until the group's type is known.
   */
  const isActive = (itemPath: string) =>
    openGroup.isGroupRoute && GROUP_LIST_PATHS.includes(itemPath)
      ? openGroup.listPath === itemPath
      : isActivePath(itemPath, location.pathname);

  const visiblePinnedItems = isGroupsOnly
    ? pinnedItems.filter((item) => item.path === ROUTES.groups)
    : pinnedItems;

  /** A CREATOR sees only Practice spaces, so a header over it would be noise. */
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

  return {
    pathname: location.pathname,
    homePath: isGroupsOnly ? ROUTES.groups : ROUTES.dashboard,
    isActive,
    visiblePinnedItems,
    sections,
    activeSectionId,
  };
}
