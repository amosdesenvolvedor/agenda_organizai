import type { PostVisibility, Prisma } from "@prisma/client";
import { prisma } from "../config/prisma.js";

export function canViewPost(input: {
  viewerId: string;
  authorId: string;
  visibility: PostVisibility;
  connected: boolean;
}) {
  if (input.viewerId === input.authorId) return true;
  if (input.visibility === "PUBLIC") return true;
  if (input.visibility === "NETWORK") return input.connected;
  return false;
}

export async function areConnected(firstUserId: string, secondUserId: string) {
  if (firstUserId === secondUserId) return true;
  return Boolean(
    await prisma.networkInvite.findFirst({
      where: {
        acceptedAt: { not: null },
        OR: [
          { inviterId: firstUserId, acceptedById: secondUserId },
          { inviterId: secondUserId, acceptedById: firstUserId },
        ],
      },
      select: { id: true },
    }),
  );
}

export function visiblePostWhere(
  viewerId: string,
  connectedAuthorIds: string[],
): Prisma.FeedPostWhereInput {
  return {
    OR: [
      { authorId: viewerId },
      { visibility: "PUBLIC" },
      { visibility: "NETWORK", authorId: { in: connectedAuthorIds } },
    ],
  };
}

export async function connectedUserIds(userId: string) {
  const invitations = await prisma.networkInvite.findMany({
    where: {
      acceptedAt: { not: null },
      OR: [{ inviterId: userId }, { acceptedById: userId }],
    },
    select: { inviterId: true, acceptedById: true },
  });
  return invitations
    .map((invitation) =>
      invitation.inviterId === userId
        ? invitation.acceptedById
        : invitation.inviterId,
    )
    .filter((id): id is string => Boolean(id));
}
