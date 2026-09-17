import type { PlatformRole } from "@/lib/platformAccess";
import { isSuperAdmin } from "@/lib/platformAccess";
import {
  isGroupInviteExpired,
  type AuthorGroupMemberDTO,
  type AuthorGroupMemberRole,
  type GroupInviteDTO,
} from "../api/groupsApi";

export const ALL_MEMBER_ROLES: AuthorGroupMemberRole[] = [
  "OWNER",
  "ADMIN",
  "AUTHOR",
  "VIEWER",
];

/** Roles assignable via invite or role change (never OWNER). */
export const ASSIGNABLE_MEMBER_ROLES: AuthorGroupMemberRole[] = [
  "ADMIN",
  "AUTHOR",
  "VIEWER",
];

const MEMBER_MANAGEMENT_ROLES: AuthorGroupMemberRole[] = ["OWNER", "ADMIN"];

export type GroupActor = {
  id?: string;
  email?: string;
  platform_role?: PlatformRole;
};

/** Legacy DB rows may still surface as ADMIN after EDITOR migration. */
export function normalizeMemberRole(role: string): AuthorGroupMemberRole {
  if (role === "EDITOR") return "ADMIN";
  return role as AuthorGroupMemberRole;
}

function findMemberByEmail(
  members: AuthorGroupMemberDTO[],
  userEmail: string | undefined,
): AuthorGroupMemberDTO | undefined {
  if (!userEmail?.trim()) return undefined;
  const normalized = userEmail.trim().toLowerCase();
  return members.find((m) => m.email.trim().toLowerCase() === normalized);
}

export function getCurrentUserGroupRole(
  members: AuthorGroupMemberDTO[],
  user: GroupActor | string | undefined,
): AuthorGroupMemberRole | undefined {
  if (!user) return undefined;
  if (typeof user === "string") {
    const member = findMemberByEmail(members, user);
    return member ? normalizeMemberRole(member.role) : undefined;
  }
  if (user.id) {
    const byId = members.find((m) => m.author_id === user.id);
    if (byId) return normalizeMemberRole(byId.role);
  }
  const member = findMemberByEmail(members, user.email);
  return member ? normalizeMemberRole(member.role) : undefined;
}

/** SUPER_ADMIN bypass for CMS management actions (not ownership transfer). */
export function getEffectiveGroupRole(
  members: AuthorGroupMemberDTO[],
  user: GroupActor | undefined,
): AuthorGroupMemberRole | undefined {
  if (isSuperAdmin(user?.platform_role)) return "OWNER";
  return getCurrentUserGroupRole(members, user);
}

export function canEditGroupSettings(
  role: AuthorGroupMemberRole | undefined,
): boolean {
  return role === "OWNER" || role === "ADMIN";
}

export function canChangeGroupStatus(
  role: AuthorGroupMemberRole | undefined,
): boolean {
  return role ? MEMBER_MANAGEMENT_ROLES.includes(role) : false;
}

/** Owners and platform SUPER_ADMIN (via getEffectiveGroupRole) can delete a group. */
export function canDeleteGroup(
  role: AuthorGroupMemberRole | undefined,
): boolean {
  return role === "OWNER";
}

export function canManageGroupInvites(
  role: AuthorGroupMemberRole | undefined,
): boolean {
  return role ? MEMBER_MANAGEMENT_ROLES.includes(role) : false;
}

export function canManageJoinRequests(
  role: AuthorGroupMemberRole | undefined,
): boolean {
  return role ? MEMBER_MANAGEMENT_ROLES.includes(role) : false;
}

/** Removing a joined community user (and banning them) is owner/admin only. */
export function canModerateGroupUsers(
  role: AuthorGroupMemberRole | undefined,
): boolean {
  return role ? MEMBER_MANAGEMENT_ROLES.includes(role) : false;
}

export function inviteRoleOptions(
  myRole: AuthorGroupMemberRole | undefined,
): AuthorGroupMemberRole[] {
  if (myRole === "OWNER") return [...ASSIGNABLE_MEMBER_ROLES];
  if (myRole === "ADMIN") return ["AUTHOR", "VIEWER"];
  return [];
}

export function roleChangeOptions(
  myRole: AuthorGroupMemberRole | undefined,
  target: AuthorGroupMemberDTO,
  user: GroupActor | undefined,
): AuthorGroupMemberRole[] | null {
  if (!myRole || !MEMBER_MANAGEMENT_ROLES.includes(myRole)) return null;

  const targetRole = normalizeMemberRole(target.role);
  const isSelf = isCurrentGroupMember(target, user);

  if (targetRole === "OWNER") return null;

  if (myRole === "OWNER") return [...ASSIGNABLE_MEMBER_ROLES];

  if (targetRole === "ADMIN" && !isSelf) return null;
  if (isSelf) return ["ADMIN", "AUTHOR", "VIEWER"];
  return ["AUTHOR", "VIEWER"];
}

/** True only for the actual group OWNER row (platform SUPER_ADMIN bypass does not apply). */
export function canTransferOwnership(
  members: AuthorGroupMemberDTO[],
  user: GroupActor | undefined,
): boolean {
  return getCurrentUserGroupRole(members, user) === "OWNER";
}

export function transferOwnershipCandidates(
  members: AuthorGroupMemberDTO[],
  user: GroupActor | undefined,
): AuthorGroupMemberDTO[] {
  return members.filter(
    (m) =>
      normalizeMemberRole(m.role) !== "OWNER" && !isCurrentGroupMember(m, user),
  );
}

export function canRevokeInvite(
  myRole: AuthorGroupMemberRole | undefined,
  invite: GroupInviteDTO,
): boolean {
  if (invite.status !== "PENDING" || isGroupInviteExpired(invite)) return false;
  if (myRole === "OWNER") return true;
  if (myRole === "ADMIN") {
    return normalizeMemberRole(invite.role) !== "ADMIN";
  }
  return false;
}

export function isCurrentGroupMember(
  member: AuthorGroupMemberDTO,
  user?: GroupActor,
): boolean {
  if (!user) return false;
  if (user.id && member.author_id === user.id) return true;
  if (!user.email?.trim()) return false;
  const normalized = user.email.trim().toLowerCase();
  return member.email.trim().toLowerCase() === normalized;
}

export function isSoleOwner(
  members: AuthorGroupMemberDTO[],
  member: AuthorGroupMemberDTO,
): boolean {
  if (normalizeMemberRole(member.role) !== "OWNER") return false;
  return (
    members.filter((m) => normalizeMemberRole(m.role) === "OWNER").length <= 1
  );
}

export function canRemoveMember(
  myRole: AuthorGroupMemberRole | undefined,
  target: AuthorGroupMemberDTO,
  user: GroupActor | undefined,
): boolean {
  if (isCurrentGroupMember(target, user)) return true;
  if (!myRole) return false;
  const targetRole = normalizeMemberRole(target.role);
  if (myRole === "OWNER") {
    if (targetRole === "OWNER") return false;
    return true;
  }
  if (myRole === "ADMIN") {
    return targetRole === "AUTHOR" || targetRole === "VIEWER";
  }
  return false;
}

/** Show Leave (self) or Remove (other) action button. */
export function canShowMemberRemovalAction(
  members: AuthorGroupMemberDTO[],
  myRole: AuthorGroupMemberRole | undefined,
  target: AuthorGroupMemberDTO,
  user: GroupActor | undefined,
): boolean {
  if (isCurrentGroupMember(target, user)) {
    return !isSoleOwner(members, target);
  }
  return canRemoveMember(myRole, target, user);
}
