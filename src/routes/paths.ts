export const ROUTES = {
  home: "/",
  login: "/login",
  signup: "/signup",
  forgotPassword: "/forgot-password",
  resetPassword: "/reset-password",
  verifyEmail: "/verify-email",
  dashboard: "/dashboard",
  /** @deprecated use groupPlanNew */
  planNew: "/plan/new",
  plan: (planId: string) => `/plan/${planId}`,
  planEdit: (planId: string) => `/plan/${planId}/edit`,
  /** @deprecated use groupSeriesNew */
  seriesNew: "/series/new",
  series: (seriesId: string) => `/series/${seriesId}`,
  seriesEdit: (seriesId: string) => `/series/${seriesId}/edit`,
  analytics: "/analytics",
  profile: "/profile",
  tags: "/tags",
  traditions: "/traditions",
  verseOfDay: "/verse-of-day",
  poems: "/poems",
  groups: "/groups",
  groupNew: "/groups/new",
  group: (groupId: string) => `/groups/${groupId}`,
  groupContent: (groupId: string) => `/groups/${groupId}/content`,
  groupTransfers: (groupId: string) => `/groups/${groupId}/transfers`,
  groupMembers: (groupId: string) => `/groups/${groupId}/members`,
  groupJoinRequests: (groupId: string) => `/groups/${groupId}/join-requests`,
  groupCommunity: (groupId: string) => `/groups/${groupId}/community`,
  groupEvents: (groupId: string) => `/groups/${groupId}/events`,
  groupEventNew: (groupId: string) => `/groups/${groupId}/events/new`,
  groupEvent: (groupId: string, eventId: string) =>
    `/groups/${groupId}/events/${eventId}`,
  groupEventEdit: (groupId: string, eventId: string) =>
    `/groups/${groupId}/events/${eventId}/edit`,
  groupChants: (groupId: string) => `/groups/${groupId}/chants`,
  groupChantNew: (groupId: string) => `/groups/${groupId}/chants/new`,
  groupChant: (groupId: string, collectionId: string) =>
    `/groups/${groupId}/chants/${collectionId}`,
  groupChantEdit: (groupId: string, collectionId: string) =>
    `/groups/${groupId}/chants/${collectionId}/edit`,
  groupPosts: (groupId: string) => `/groups/${groupId}/posts`,
  groupPostNew: (groupId: string) => `/groups/${groupId}/posts/new`,
  groupPostEdit: (groupId: string, postId: string) =>
    `/groups/${groupId}/posts/${postId}/edit`,
  groupEdit: (groupId: string) => `/groups/${groupId}/edit`,
  groupPlanNew: (groupId: string) => `/groups/${groupId}/plan/new`,
  groupSeriesNew: (groupId: string) => `/groups/${groupId}/series/new`,
  adminAuthors: "/admin/authors",
  adminChinaRestrictions: "/admin/china-restrictions",
  adminChatReports: "/admin/chat-reports",
  accumulatorPresets: "/accumulator-presets",
  textAudio: "/text-audio",
  ambientSounds: "/ambient-sounds",
} as const;

export const AUTH_ROUTE_PATHS: readonly string[] = [
  ROUTES.login,
  ROUTES.signup,
  ROUTES.forgotPassword,
  ROUTES.resetPassword,
  ROUTES.verifyEmail,
];
