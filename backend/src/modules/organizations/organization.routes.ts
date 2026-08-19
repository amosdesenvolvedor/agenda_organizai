import { createHash, randomBytes } from "node:crypto";
import path from "node:path";
import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { env } from "../../config/env.js";
import { prisma } from "../../config/prisma.js";
import { requireAuth } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import {
  createMediaUpload,
  detectStoredMediaMime,
  validateUploadedMedia,
} from "../../services/media-upload.service.js";
import { areConnected } from "../../services/social-access.service.js";
import {
  canInviteOrganizationRole,
  canManageOrganization,
  canViewOrganization,
} from "../../services/organization-access.service.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { entityIdSchema } from "../../utils/schemas.js";

export const organizationRouter = Router();
const hashToken = (token: string) =>
  createHash("sha256").update(token).digest("hex");
const orgUpload = createMediaUpload("organizations", 8 * 1024 * 1024, "image");
const inviteLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 40,
  standardHeaders: true,
  legacyHeaders: false,
});

organizationRouter.get(
  "/invites/:token",
  validate(
    z.object({ params: z.object({ token: z.string().min(32).max(512) }) }),
  ),
  asyncHandler(async (req, res) => {
    const invitation = await prisma.organizationInvitation.findUnique({
      where: { tokenHash: hashToken(req.params.token) },
      include: {
        organization: { select: { id: true, name: true, description: true } },
        createdBy: { select: { name: true } },
      },
    });
    if (
      !invitation ||
      invitation.expiresAt <= new Date() ||
      invitation.status !== "PENDING"
    )
      return res
        .status(404)
        .json({ message: "Convite inexistente, utilizado ou expirado." });
    res.json({
      invitation: {
        organization: invitation.organization,
        invitedBy: invitation.createdBy,
        role: invitation.role,
        expiresAt: invitation.expiresAt,
      },
    });
  }),
);

organizationRouter.use(requireAuth);
const idParams = z.object({ params: z.object({ id: entityIdSchema }) });
const organizationBody = z.object({
  name: z.string().trim().min(2).max(160),
  description: z.string().trim().max(5000).nullable().optional(),
  category: z.string().trim().max(100).nullable().optional(),
  city: z.string().trim().max(120).nullable().optional(),
  region: z.string().trim().max(120).nullable().optional(),
  country: z.string().trim().max(120).nullable().optional(),
  website: z.string().trim().url().max(255).nullable().optional(),
  isPublic: z.boolean().default(false),
});

async function membership(organizationId: string, userId: string) {
  return prisma.organizationMember.findUnique({
    where: { organizationId_userId: { organizationId, userId } },
  });
}
async function manager(organizationId: string, userId: string) {
  const member = await membership(organizationId, userId);
  return member?.status === "ACTIVE" && canManageOrganization(member.role)
    ? member
    : null;
}

organizationRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const organizations = await prisma.organization.findMany({
      where: { members: { some: { userId: req.user!.sub, status: "ACTIVE" } } },
      include: {
        members: {
          where: { userId: req.user!.sub },
          select: { role: true, status: true },
        },
        _count: { select: { members: true, teams: true } },
      },
      orderBy: { name: "asc" },
    });
    res.json({
      organizations: organizations.map((organization) => ({
        ...organization,
        logoPath: undefined,
        coverPath: undefined,
        logoUrl: organization.logoPath
          ? `/api/organizations/${organization.id}/media/logo`
          : null,
        coverUrl: organization.coverPath
          ? `/api/organizations/${organization.id}/media/cover`
          : null,
      })),
    });
  }),
);

organizationRouter.post(
  "/",
  validate(z.object({ body: organizationBody })),
  asyncHandler(async (req, res) => {
    const base =
      req.body.name
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 60) || "organizacao";
    const organization = await prisma.organization.create({
      data: {
        ...req.body,
        slug: `${base}-${randomBytes(4).toString("hex")}`,
        createdById: req.user!.sub,
        members: {
          create: { userId: req.user!.sub, role: "OWNER", status: "ACTIVE" },
        },
      },
      include: { members: true },
    });
    await prisma.auditLog.create({
      data: {
        actorId: req.user!.sub,
        entity: "Organization",
        entityId: organization.id,
        action: "CREATE",
        newValue: JSON.parse(JSON.stringify(organization)),
      },
    });
    res.status(201).json({ organization });
  }),
);

organizationRouter.get(
  "/:id",
  validate(idParams),
  asyncHandler(async (req, res) => {
    const organization = await prisma.organization.findUnique({
      where: { id: req.params.id },
      include: {
        members: {
          where: { status: "ACTIVE" },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                username: true,
                avatarUrl: true,
                avatarPath: true,
                position: true,
              },
            },
          },
          orderBy: { joinedAt: "asc" },
          take: 100,
        },
        teams: {
          include: {
            _count: { select: { members: true, events: true, tasks: true } },
          },
          take: 100,
        },
        _count: { select: { members: true, teams: true } },
      },
    });
    if (!organization)
      return res.status(404).json({ message: "Organização não encontrada." });
    const ownMembership = await membership(organization.id, req.user!.sub);
    if (
      !canViewOrganization({
        isPublic: organization.isPublic,
        activeMember: ownMembership?.status === "ACTIVE",
      })
    )
      return res.status(403).json({ message: "Organização privada." });
    res.json({
      organization: {
        ...organization,
        logoPath: undefined,
        coverPath: undefined,
        logoUrl: organization.logoPath
          ? `/api/organizations/${organization.id}/media/logo`
          : null,
        coverUrl: organization.coverPath
          ? `/api/organizations/${organization.id}/media/cover`
          : null,
        membership: ownMembership,
        members: organization.members.map((item) => ({
          ...item,
          user: {
            ...item.user,
            avatarPath: undefined,
            avatarUrl: item.user.avatarPath
              ? `/api/users/profiles/${item.user.id}/media/avatar`
              : item.user.avatarUrl,
          },
        })),
      },
    });
  }),
);

organizationRouter.patch(
  "/:id",
  validate(idParams.merge(z.object({ body: organizationBody.partial() }))),
  asyncHandler(async (req, res) => {
    if (!(await manager(req.params.id, req.user!.sub)))
      return res
        .status(403)
        .json({ message: "Somente OWNER ou ADMIN pode editar." });
    const organization = await prisma.organization.update({
      where: { id: req.params.id },
      data: req.body,
    });
    res.json({ organization });
  }),
);

organizationRouter.post(
  "/:id/invites",
  inviteLimit,
  validate(
    idParams.merge(
      z.object({
        body: z.object({
          userId: entityIdSchema.nullable().optional(),
          role: z.enum(["ADMIN", "MEMBER"]).default("MEMBER"),
        }),
      }),
    ),
  ),
  asyncHandler(async (req, res) => {
    const acting = await manager(req.params.id, req.user!.sub);
    if (!acting)
      return res
        .status(403)
        .json({ message: "Somente OWNER ou ADMIN pode convidar." });
    if (!canInviteOrganizationRole(acting.role, req.body.role))
      return res
        .status(403)
        .json({ message: "Somente OWNER pode convidar administradores." });
    if (
      req.body.userId &&
      !(await areConnected(req.user!.sub, req.body.userId))
    )
      return res
        .status(403)
        .json({ message: "Selecione uma pessoa da sua rede." });
    if (req.body.userId && (await membership(req.params.id, req.body.userId)))
      return res
        .status(409)
        .json({ message: "Este usuário já pertence à organização." });
    const token = randomBytes(32).toString("base64url");
    const invitation = await prisma.organizationInvitation.create({
      data: {
        tokenHash: hashToken(token),
        organizationId: req.params.id,
        createdById: req.user!.sub,
        invitedUserId: req.body.userId ?? null,
        role: req.body.role,
        expiresAt: new Date(Date.now() + 14 * 86_400_000),
      },
    });
    if (req.body.userId)
      await prisma.notification.create({
        data: {
          userId: req.body.userId,
          type: "SYSTEM",
          title: "Convite para organização",
          body: "Você recebeu um convite para participar de uma organização.",
        },
      });
    res.status(201).json({
      invitation: {
        id: invitation.id,
        url: `${env.APP_URL}/?organizationInvite=${encodeURIComponent(token)}`,
        expiresAt: invitation.expiresAt,
      },
    });
  }),
);

organizationRouter.post(
  "/invites/:token/respond",
  validate(
    z.object({
      params: z.object({ token: z.string().min(32).max(512) }),
      body: z.object({ accept: z.boolean() }),
    }),
  ),
  asyncHandler(async (req, res) => {
    const invitation = await prisma.organizationInvitation.findUnique({
      where: { tokenHash: hashToken(req.params.token) },
      include: { organization: true },
    });
    if (
      !invitation ||
      invitation.status !== "PENDING" ||
      invitation.expiresAt <= new Date()
    )
      return res
        .status(404)
        .json({ message: "Convite inexistente, utilizado ou expirado." });
    if (invitation.invitedUserId && invitation.invitedUserId !== req.user!.sub)
      return res
        .status(403)
        .json({ message: "Este convite pertence a outro usuário." });
    const now = new Date();
    if (req.body.accept)
      await prisma.$transaction([
        prisma.organizationMember.upsert({
          where: {
            organizationId_userId: {
              organizationId: invitation.organizationId,
              userId: req.user!.sub,
            },
          },
          create: {
            organizationId: invitation.organizationId,
            userId: req.user!.sub,
            role: invitation.role,
            status: "ACTIVE",
          },
          update: { status: "ACTIVE", role: invitation.role, joinedAt: now },
        }),
        prisma.organizationInvitation.update({
          where: { id: invitation.id },
          data: {
            status: "ACCEPTED",
            invitedUserId: req.user!.sub,
            respondedAt: now,
          },
        }),
        prisma.notification.create({
          data: {
            userId: invitation.createdById,
            type: "SYSTEM",
            title: "Convite aceito",
            body: `Um novo membro entrou em ${invitation.organization.name}.`,
          },
        }),
        prisma.auditLog.create({
          data: {
            actorId: req.user!.sub,
            entity: "OrganizationInvitation",
            entityId: invitation.id,
            action: "ACCEPT",
          },
        }),
      ]);
    else
      await prisma.$transaction([
        prisma.organizationInvitation.update({
          where: { id: invitation.id },
          data: {
            status: "DECLINED",
            invitedUserId: invitation.invitedUserId ?? req.user!.sub,
            respondedAt: now,
          },
        }),
        prisma.auditLog.create({
          data: {
            actorId: req.user!.sub,
            entity: "OrganizationInvitation",
            entityId: invitation.id,
            action: "DECLINE",
          },
        }),
      ]);
    res.json({
      accepted: req.body.accept,
      organizationId: invitation.organizationId,
    });
  }),
);

organizationRouter.post(
  "/:id/media/:kind",
  orgUpload.single("file"),
  asyncHandler(async (req, res) => {
    if (!(await manager(req.params.id, req.user!.sub)))
      return res
        .status(403)
        .json({ message: "Somente OWNER ou ADMIN pode alterar imagens." });
    if (!req.file || !["logo", "cover"].includes(req.params.kind))
      return res.status(422).json({ message: "Imagem inválida." });
    try {
      await validateUploadedMedia(req.file, "image");
    } catch {
      return res.status(422).json({ message: "Arquivo de imagem inválido." });
    }
    await prisma.organization.update({
      where: { id: req.params.id },
      data:
        req.params.kind === "logo"
          ? { logoPath: req.file.path }
          : { coverPath: req.file.path },
    });
    res.status(201).json({
      url: `/api/organizations/${req.params.id}/media/${req.params.kind}`,
    });
  }),
);

organizationRouter.get(
  "/:id/media/:kind",
  asyncHandler(async (req, res) => {
    const organization = await prisma.organization.findUnique({
      where: { id: req.params.id },
      select: { isPublic: true, logoPath: true, coverPath: true },
    });
    if (!organization)
      return res.status(404).json({ message: "Mídia não encontrada." });
    if (
      !organization.isPublic &&
      !(await membership(req.params.id, req.user!.sub))
    )
      return res.status(403).json({ message: "Organização privada." });
    const filePath =
      req.params.kind === "logo"
        ? organization.logoPath
        : req.params.kind === "cover"
          ? organization.coverPath
          : null;
    if (!filePath)
      return res.status(404).json({ message: "Mídia não encontrada." });
    const mime = await detectStoredMediaMime(filePath);
    if (!mime)
      return res.status(415).json({ message: "Formato de mídia inválido." });
    res.type(mime).setHeader("Cache-Control", "private, max-age=300");
    return res.sendFile(path.resolve(filePath));
  }),
);

organizationRouter.post(
  "/:id/teams/:teamId",
  validate(
    z.object({
      params: z.object({ id: entityIdSchema, teamId: entityIdSchema }),
    }),
  ),
  asyncHandler(async (req, res) => {
    if (!(await manager(req.params.id, req.user!.sub)))
      return res.status(403).json({ message: "Sem permissão." });
    const teamMembership = await prisma.teamMember.findUnique({
      where: {
        teamId_userId: { teamId: req.params.teamId, userId: req.user!.sub },
      },
    });
    if (teamMembership?.role !== "ADMIN")
      return res
        .status(403)
        .json({ message: "Você precisa administrar a equipe." });
    const team = await prisma.team.update({
      where: { id: req.params.teamId },
      data: { organizationId: req.params.id },
    });
    res.json({ team });
  }),
);
