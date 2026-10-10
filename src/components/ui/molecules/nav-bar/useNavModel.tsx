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
  IoDocumentAttachOutline,
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
  canAccessContentCatalogues,
  canManageAmbientSounds,
  canManageTextRequests,
  isContentAdmin,
  isStaffRole,
} from "@/lib/platformAccess";

/** `label` and `tooltip` hold translation keys; translate them where rendered. */
export type NavItem = {
  icon: ReactNode;
  label: string;
  path: string;
  tooltip: string;
};

export type NavSection = {
  id: string;
  /** A translation key. */
  label: string;
  items: NavItem[];
};

/** Everyday destinations, left out of the sections so they stay one click away. */
const pinnedItems: NavItem[] = [
  {
    icon: <MdDashboard className="w-4 h-4" />,
    label: "studio.nav.dashboard",
    path: ROUTES.dashboard,
    tooltip: "studio.nav.dashboard_tooltip",
  },
  {
    icon: <IoAnalytics className="w-4 h-4" />,
    label: "studio.nav.analytics",
    path: ROUTES.analytics,
    tooltip: "studio.nav.analytics_tooltip",
  },
  {
    icon: <MdSelfImprovement className="w-4 h-4" />,
    label: "studio.nav.practice_spaces",
    path: ROUTES.groups,
    tooltip: "studio.nav.practice_spaces_tooltip",
  },
  {
    icon: <IoNewspaperOutline className="w-4 h-4" />,
    label: "studio.nav.pages",
    path: ROUTES.pages,
    tooltip: "studio.nav.pages_tooltip",
  },
];

/** The two group lists, told apart inside a group by its type. */
const GROUP_LIST_PATHS: string[] = [ROUTES.groups, ROUTES.pages];

const contentItems: NavItem[] = [
  {
    icon: <IoBookOutline className="w-4 h-4" />,
    label: "studio.nav.verse_of_day",
    path: ROUTES.verseOfDay,
    tooltip: "studio.nav.verse_of_day",
  },
  {
    icon: <IoDocumentTextOutline className="w-4 h-4" />,
    label: "studio.nav.poems",
    path: ROUTES.poems,
    tooltip: "studio.nav.poems",
  },
  {
    icon: <MdAudioFile className="w-4 h-4" />,
    label: "studio.nav.text_audio",
    path: ROUTES.textAudio,
    tooltip: "studio.nav.text_audio_tooltip",
  },
];

const configurationItems: NavItem[] = [
  {
    icon: <IoPricetags className="w-4 h-4" />,
    label: "studio.nav.tags",
    path: ROUTES.tags,
    tooltip: "studio.nav.tags_tooltip",
  },
  {
    icon: <IoBook className="w-4 h-4" />,
    label: "studio.nav.traditions",
    path: ROUTES.traditions,
    tooltip: "studio.nav.traditions_tooltip",
  },
  {
    icon: <IoPulse className="w-4 h-4" />,
    label: "studio.nav.presets",
    path: ROUTES.accumulatorPresets,
    tooltip: "studio.nav.presets_tooltip",
  },
];

const prayerIntentionsItem: NavItem = {
  icon: <IoHeartOutline className="w-4 h-4" />,
  label: "studio.nav.prayer_intentions",
  path: ROUTES.prayerIntentions,
  tooltip: "studio.nav.prayer_intentions_tooltip",
};

const administrationItems: NavItem[] = [
  {
    icon: <MdAdminPanelSettings className="w-4 h-4" />,
    label: "studio.nav.authors",
    path: ROUTES.adminAuthors,
    tooltip: "studio.nav.authors_tooltip",
  },
  {
    icon: <MdPublicOff className="w-4 h-4" />,
    label: "studio.nav.china",
    path: ROUTES.adminChinaRestrictions,
    tooltip: "studio.nav.china_tooltip",
  },
  {
    icon: <MdOutlineReportProblem className="w-4 h-4" />,
    label: "studio.nav.chat_reports",
    path: ROUTES.adminChatReports,
    tooltip: "studio.nav.chat_reports_tooltip",
  },
  prayerIntentionsItem,
];

/** Super Admins and Content Admins answer these, so a Content Admin gets an
 * Administration section holding only this. */
const textRequestsItem: NavItem = {
  icon: <IoDocumentAttachOutline className="w-4 h-4" />,
  label: "studio.nav.text_requests",
  path: ROUTES.adminTextRequests,
  tooltip: "studio.nav.text_requests_tooltip",
};

/** Super Admin only, but it reads as one of the media catalogues. */
const ambientSoundsItem: NavItem = {
  icon: <MdMusicNote className="w-4 h-4" />,
  label: "studio.nav.ambient_sounds",
  path: ROUTES.ambientSounds,
  tooltip: "studio.nav.ambient_sounds_tooltip",
};

/** Section landing pages own every route beneath them, so match on the prefix. */
const SECTION_PATHS: string[] = [
  ROUTES.groups,
  ROUTES.pages,
  ROUTES.adminAuthors,
  ROUTES.adminChinaRestrictions,
  ROUTES.adminChatReports,
  ROUTES.adminTextRequests,
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
  /** Reviewers reach the admin section, but this catalogue is for Super
   * Admins and Content Admins only. */
  const showAmbientSounds = canManageAmbientSounds(userInfo?.platform_role);
  const isContentAdminRole = isContentAdmin(userInfo?.platform_role);
  const showTextRequests = canManageTextRequests(userInfo?.platform_role);
  const visibleAdministrationItems = [
    ...(showAdminAuthors ? administrationItems : []),
    ...(showTextRequests ? [textRequestsItem] : []),
  ];
  /** Everyone but platform staff only gets Practice spaces pinned: no
   * dashboard, analytics or pages, which list every plan and space. */
  const pinsOnlyGroups =
    !isUserInfoLoading && !isStaffRole(userInfo?.platform_role);
  /** A plain CREATOR has nothing else. A Content Admin adds the app-wide
   * catalogues, which are not tied to any space. */
  const isGroupsOnly =
    pinsOnlyGroups && !canAccessContentCatalogues(userInfo?.platform_role);
  const openGroup = useOpenGroupListPath(location.pathname);

  /**
   * Inside a practice space or page the URL alone can't say which list it came
   * from, so neither lights up until the group's type is known.
   */
  const isActive = (itemPath: string) =>
    openGroup.isGroupRoute && GROUP_LIST_PATHS.includes(itemPath)
      ? openGroup.listPath === itemPath
      : isActivePath(itemPath, location.pathname);

  const visiblePinnedItems = pinsOnlyGroups
    ? pinnedItems.filter((item) => item.path === ROUTES.groups)
    : pinnedItems;

  /** A CREATOR sees only Practice spaces, so a header over it would be noise. */
  const sections: NavSection[] = isGroupsOnly
    ? []
    : [
        {
          id: "content",
          label: "studio.nav.section_content",
          items: showAmbientSounds
            ? [...contentItems, ambientSoundsItem]
            : contentItems,
        },
        {
          id: "configuration",
          label: "studio.nav.section_configuration",
          items: isContentAdminRole
            ? [...configurationItems, prayerIntentionsItem]
            : configurationItems,
        },
        ...(visibleAdministrationItems.length > 0
          ? [
              {
                id: "administration",
                label: "studio.nav.section_administration",
                items: visibleAdministrationItems,
              },
            ]
          : []),
      ];

  const activeSectionId = sections.find((section) =>
    section.items.some((item) => isActivePath(item.path, location.pathname)),
  )?.id;

  return {
    pathname: location.pathname,
    homePath: pinsOnlyGroups ? ROUTES.groups : ROUTES.dashboard,
    isActive,
    visiblePinnedItems,
    sections,
    activeSectionId,
  };
}
