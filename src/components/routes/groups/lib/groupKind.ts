import { ROUTES } from "@/routes/paths";
import type { AuthorGroupType } from "../api/groupsApi";

export type GroupKind = {
  type: AuthorGroupType;
  singular: string;
  plural: string;
  /** One line on how app users relate to it, shown when creating one. */
  description: string;
  listPath: string;
  newPath: string;
};

/**
 * A COMMUNITY group is presented as a practice space and a PAGE group as a
 * page. Each has its own list and create route, so the type is fixed by where
 * you start.
 */
export const GROUP_KINDS: Record<AuthorGroupType, GroupKind> = {
  COMMUNITY: {
    type: "COMMUNITY",
    singular: "Practice space",
    plural: "Practice spaces",
    description: "Users join a practice space as members.",
    listPath: ROUTES.groups,
    newPath: ROUTES.groupNew,
  },
  PAGE: {
    type: "PAGE",
    singular: "Page",
    plural: "Pages",
    description: "Users follow a page to stay updated.",
    listPath: ROUTES.pages,
    newPath: ROUTES.pageNew,
  },
};

/** An untyped group is treated as a page, as the About editor already does. */
export const groupKindOf = (groupType?: AuthorGroupType): GroupKind =>
  GROUP_KINDS[groupType ?? "PAGE"];
