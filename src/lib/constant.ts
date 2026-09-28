export const SITE_NAME = "Plan Studio";
export const ACCESS_TOKEN = "accessToken";
export const RESET_PASSWORD = "resetPassword";
export const RESET_PASSWORD_TOKEN = "resetPasswordToken";
export const REFRESH_TOKEN = "refreshToken";
export const USERBACK_ID = "A-JldUwSRlsuKf8Te85bql54w7U";
export const NO_PROFILE_IMAGE =
  "https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png";
export const LANGUAGE = "language";
/** The recitation emit secret, kept per browser by the live control page. */
export const RECITATION_EMIT_TOKEN = "recitation_emit_token";
export const SIDEBAR_EXPANDED = "sidebarExpanded";
export const DIFFICULTY = [
  { label: "Beginner", value: "BEGINNER" },
  { label: "Intermediate", value: "INTERMEDIATE" },
  { label: "Advanced", value: "ADVANCED" },
];
export const SOCIAL_PLATFORMS = [
  { value: "facebook", label: "Facebook", icon: "Facebook" },
  { value: "SignIn", label: "SignIn", icon: "SignIn" },
  { value: "x.com", label: "X (Twitter)", icon: "Twitter" },
  { value: "linkedin", label: "LinkedIn", icon: "Linkedin" },
  { value: "youtube", label: "YouTube", icon: "Youtube" },
  { value: "email", label: "Email", icon: "Mail" },
  { value: "instagram", label: "Instagram", icon: "Instagram" },
  { value: "tiktok", label: "TikTok", icon: "TikTok" },
];
export const PLATFORM_PATTERNS: Record<string, RegExp> = {
  facebook: /facebook\.com/i,
  "x.com": /(x\.com|twitter\.com)/i,
  linkedin: /linkedin\.com/i,
  youtube: /(youtube\.com|youtu\.be)/i,
  instagram: /instagram\.com/i,
  tiktok: /tiktok\.com/i,
};
export const RANGE_REGEX = /^(\d+)\s*-\s*(\d+)$/;
export const SINGLE_REGEX = /^(\d+)$/;

export const TIBETAN_LETTERS = [
  "ཀ",
  "ཁ",
  "ག",
  "ང",
  "ཅ",
  "ཆ",
  "ཇ",
  "ཉ",
  "ཏ",
  "ཐ",
  "ད",
  "ན",
  "པ",
  "ཕ",
  "བ",
  "མ",
  "ཙ",
  "ཚ",
  "ཛ",
  "ཝ",
  "ཞ",
  "ཟ",
  "འ",
  "ཡ",
  "ར",
  "ལ",
  "ཤ",
  "ས",
  "ཧ",
  "ཨ",
  "།",
  "༄",
];

export const STATUS_TRANSITIONS = [
  { label: "Draft", value: "DRAFT" },
  { label: "Publish", value: "PUBLISHED" },
  { label: "Unpublish", value: "UNPUBLISHED" },
  { label: "Archive", value: "ARCHIVED" },
];

export const ALLOWED_TRANSITIONS = {
  DRAFT: ["PUBLISHED", "ARCHIVED"],
  PUBLISHED: ["UNPUBLISHED"],
  UNPUBLISHED: ["PUBLISHED", "DRAFT", "ARCHIVED"],
  ARCHIVED: ["DRAFT"],
};
