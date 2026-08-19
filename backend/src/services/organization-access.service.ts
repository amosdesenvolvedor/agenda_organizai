import type { OrganizationRole } from "@prisma/client";

export function canManageOrganization(
  role: OrganizationRole | null | undefined,
) {
  return role === "OWNER" || role === "ADMIN";
}

export function canInviteOrganizationRole(
  actorRole: OrganizationRole | null | undefined,
  targetRole: "ADMIN" | "MEMBER",
) {
  if (actorRole === "OWNER") return true;
  return actorRole === "ADMIN" && targetRole === "MEMBER";
}

export function canViewOrganization(input: {
  isPublic: boolean;
  activeMember: boolean;
}) {
  return input.isPublic || input.activeMember;
}
