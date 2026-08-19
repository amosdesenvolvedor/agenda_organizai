import { createHash, randomBytes } from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import { env } from "../../config/env.js";
import { prisma } from "../../config/prisma.js";
import { requireAuth } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { asyncHandler } from "../../utils/async-handler.js";
import rateLimit from "express-rate-limit";
import path from "node:path";
import { unlink } from "node:fs/promises";
import {
  createMediaUpload,
  detectStoredMediaMime,
  validateUploadedMedia,
} from "../../services/media-upload.service.js";
import {
  areConnected,
  connectedUserIds,
  visiblePostWhere,
} from "../../services/social-access.service.js";

export const userRouter = Router();

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

userRouter.get(
  "/invites/:token",
  validate(
    z.object({ params: z.object({ token: z.string().min(32).max(512) }) }),
  ),
  asyncHandler(async (req, res) => {
    const invite = await prisma.networkInvite.findUnique({
      where: { tokenHash: hashToken(req.params.token) },
      include: { inviter: { select: { name: true, avatarUrl: true } } },
    });
    if (!invite || invite.expiresAt <= new Date())
      return res
        .status(404)
        .json({ message: "Este convite não existe ou expirou." });
    res.json({
      invite: {
        inviter: invite.inviter,
        expiresAt: invite.expiresAt,
        accepted: Boolean(invite.acceptedAt),
      },
    });
  }),
);

userRouter.use(requireAuth);

const profileUpload = createMediaUpload("profiles", 6 * 1024 * 1024, "image");
const profileUploadLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
});
const profileBody = z.object({
  name: z.string().trim().min(2).max(120),
  username: z
    .string()
    .trim()
    .regex(/^[a-zA-Z0-9._-]{3,40}$/)
    .nullable()
    .optional(),
  bio: z.string().trim().max(2000).nullable().optional(),
  profession: z.string().trim().max(120).nullable().optional(),
  position: z.string().trim().max(120).nullable().optional(),
  company: z.string().trim().max(120).nullable().optional(),
  city: z.string().trim().max(120).nullable().optional(),
  region: z.string().trim().max(120).nullable().optional(),
  country: z.string().trim().max(120).nullable().optional(),
  website: z.string().trim().url().max(255).nullable().optional(),
  phone: z.string().trim().max(30).nullable().optional(),
  professionalLinks: z
    .array(
      z.object({
        label: z.string().trim().min(1).max(60),
        url: z.string().trim().url().max(500),
      }),
    )
    .max(10)
    .default([]),
  socialLinks: z
    .array(
      z.object({
        network: z.string().trim().min(1).max(40),
        url: z.string().trim().url().max(500),
      }),
    )
    .max(10)
    .default([]),
});

userRouter.get(
  "/profiles/:userId",
  asyncHandler(async (req, res) => {
    const targetId =
      req.params.userId === "me" ? req.user!.sub : req.params.userId;
    const own = targetId === req.user!.sub;
    const connected = own || (await areConnected(req.user!.sub, targetId));
    const connectedIds = await connectedUserIds(req.user!.sub);
    const user = await prisma.user.findFirst({
      where: { id: targetId, isActive: true },
      select: {
        id: true,
        name: true,
        username: true,
        avatarUrl: true,
        avatarPath: true,
        coverPath: true,
        bio: true,
        profession: true,
        position: true,
        company: true,
        city: true,
        region: true,
        country: true,
        website: true,
        phone: true,
        professionalLinks: true,
        socialLinks: true,
        createdAt: true,
        organizations: {
          where: { status: "ACTIVE" },
          include: {
            organization: {
              select: {
                id: true,
                name: true,
                slug: true,
                logoPath: true,
                isPublic: true,
              },
            },
          },
        },
        _count: {
          select: {
            feedPosts: true,
            sentNetworkInvites: { where: { acceptedAt: { not: null } } },
            acceptedNetworkInvites: { where: { acceptedAt: { not: null } } },
          },
        },
      },
    });
    if (!user)
      return res.status(404).json({ message: "Perfil não encontrado." });
    const posts = await prisma.feedPost.findMany({
      where: {
        authorId: targetId,
        AND: [visiblePostWhere(req.user!.sub, connectedIds)],
      },
      include: {
        media: { select: { id: true, type: true, mimeType: true, size: true } },
        author: { select: { id: true, name: true, avatarUrl: true } },
        likes: { select: { userId: true } },
        comments: {
          include: {
            author: { select: { id: true, name: true, avatarUrl: true } },
          },
          orderBy: { createdAt: "asc" },
          take: 30,
        },
      },
      orderBy: { createdAt: "desc" },
      take: 30,
    });
    const relevant = [
      user.avatarPath,
      user.coverPath,
      user.bio,
      user.profession,
      user.position,
      user.company,
      user.city,
      user.region,
      user.country,
      user.website,
    ];
    const completion = Math.round(
      (relevant.filter(Boolean).length / relevant.length) * 100,
    );
    res.json({
      profile: {
        ...user,
        avatarPath: undefined,
        coverPath: undefined,
        phone: own ? user.phone : undefined,
        socialLinks: own || connected ? user.socialLinks : undefined,
        professionalLinks:
          own || connected ? user.professionalLinks : undefined,
        avatarUrl: user.avatarPath
          ? `/api/users/profiles/${user.id}/media/avatar`
          : user.avatarUrl,
        coverUrl: user.coverPath
          ? `/api/users/profiles/${user.id}/media/cover`
          : null,
        connected,
        own,
        completion,
        connectionCount:
          user._count.sentNetworkInvites + user._count.acceptedNetworkInvites,
        organizations: user.organizations.filter(
          (membership) => own || connected || membership.organization.isPublic,
        ),
        posts: posts.map((post) => ({
          ...post,
          likedByMe: post.likes.some((like) => like.userId === req.user!.sub),
          likeCount: post.likes.length,
          likes: undefined,
          media: post.media.map((media) => ({
            ...media,
            url: `/api/social/feed/media/${media.id}`,
          })),
        })),
      },
    });
  }),
);

userRouter.patch(
  "/profiles/me",
  validate(z.object({ body: profileBody })),
  asyncHandler(async (req, res) => {
    const data = {
      ...req.body,
      username: req.body.username?.toLowerCase() || null,
    };
    const previous = await prisma.user.findUnique({
      where: { id: req.user!.sub },
    });
    const user = await prisma.user.update({
      where: { id: req.user!.sub },
      data,
      select: {
        id: true,
        name: true,
        username: true,
        bio: true,
        profession: true,
        position: true,
        company: true,
        city: true,
        region: true,
        country: true,
        website: true,
        phone: true,
        professionalLinks: true,
        socialLinks: true,
      },
    });
    await prisma.auditLog.create({
      data: {
        actorId: req.user!.sub,
        entity: "UserProfile",
        entityId: user.id,
        action: "UPDATE",
        oldValue: JSON.parse(JSON.stringify(previous)),
        newValue: JSON.parse(JSON.stringify(user)),
      },
    });
    res.json({ user });
  }),
);

userRouter.post(
  "/profiles/me/media/:kind",
  profileUploadLimit,
  profileUpload.single("file"),
  asyncHandler(async (req, res) => {
    if (!req.file || !["avatar", "cover"].includes(req.params.kind))
      return res.status(422).json({ message: "Imagem inválida ou ausente." });
    try {
      await validateUploadedMedia(req.file, "image");
    } catch {
      return res.status(422).json({
        message:
          "O conteúdo do arquivo não corresponde a uma imagem JPEG, PNG ou WebP válida.",
      });
    }
    const field = req.params.kind === "avatar" ? "avatarPath" : "coverPath";
    const previous = await prisma.user.findUnique({
      where: { id: req.user!.sub },
      select: { avatarPath: true, coverPath: true },
    });
    await prisma.user.update({
      where: { id: req.user!.sub },
      data: { [field]: req.file.path },
    });
    const oldPath =
      field === "avatarPath" ? previous?.avatarPath : previous?.coverPath;
    if (oldPath) await unlink(oldPath).catch(() => undefined);
    res.status(201).json({
      url: `/api/users/profiles/${req.user!.sub}/media/${req.params.kind}`,
    });
  }),
);

userRouter.get(
  "/profiles/:userId/media/:kind",
  asyncHandler(async (req, res) => {
    if (!["avatar", "cover"].includes(req.params.kind))
      return res.status(404).json({ message: "Mídia não encontrada." });
    const user = await prisma.user.findFirst({
      where: { id: req.params.userId, isActive: true },
      select: { avatarPath: true, coverPath: true },
    });
    const filePath =
      req.params.kind === "avatar" ? user?.avatarPath : user?.coverPath;
    if (!filePath)
      return res.status(404).json({ message: "Mídia não encontrada." });
    const mime = await detectStoredMediaMime(filePath);
    if (!mime)
      return res.status(415).json({ message: "Formato de mídia inválido." });
    res.type(mime).setHeader("Cache-Control", "private, max-age=300");
    res.sendFile(path.resolve(filePath));
  }),
);

userRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const invites = await prisma.networkInvite.findMany({
      where: {
        acceptedAt: { not: null },
        OR: [{ inviterId: req.user!.sub }, { acceptedById: req.user!.sub }],
      },
      include: {
        inviter: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
            company: true,
            position: true,
          },
        },
        acceptedBy: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
            company: true,
            position: true,
          },
        },
      },
      orderBy: { acceptedAt: "desc" },
    });
    const users = invites
      .map((invite) =>
        invite.inviterId === req.user!.sub ? invite.acceptedBy : invite.inviter,
      )
      .filter((user) => user !== null);
    const uniqueUsers = [
      ...new Map(users.map((user) => [user!.id, user])).values(),
    ];
    res.json({ users: uniqueUsers });
  }),
);

userRouter.post(
  "/invites",
  asyncHandler(async (req, res) => {
    const token = randomBytes(32).toString("base64url");
    const invite = await prisma.networkInvite.create({
      data: {
        tokenHash: hashToken(token),
        inviterId: req.user!.sub,
        expiresAt: new Date(Date.now() + 30 * 86_400_000),
      },
    });
    res.status(201).json({
      invite: {
        id: invite.id,
        url: `${env.APP_URL}/?invite=${encodeURIComponent(token)}`,
        expiresAt: invite.expiresAt,
      },
    });
  }),
);

userRouter.post(
  "/invites/:token/accept",
  validate(
    z.object({ params: z.object({ token: z.string().min(32).max(512) }) }),
  ),
  asyncHandler(async (req, res) => {
    const invite = await prisma.networkInvite.findUnique({
      where: { tokenHash: hashToken(req.params.token) },
      include: { inviter: { select: { name: true } } },
    });
    if (!invite || invite.expiresAt <= new Date())
      return res
        .status(404)
        .json({ message: "Este convite não existe ou expirou." });
    if (invite.inviterId === req.user!.sub)
      return res
        .status(409)
        .json({ message: "Este convite foi criado por você." });
    if (invite.acceptedById && invite.acceptedById !== req.user!.sub)
      return res
        .status(409)
        .json({ message: "Este convite já foi utilizado." });
    if (!invite.acceptedAt) {
      await prisma.$transaction([
        prisma.networkInvite.update({
          where: { id: invite.id },
          data: { acceptedById: req.user!.sub, acceptedAt: new Date() },
        }),
        prisma.notification.create({
          data: {
            userId: invite.inviterId,
            type: "SYSTEM",
            title: "Novo usuário na sua rede",
            body: "Seu convite foi aceito.",
          },
        }),
      ]);
    }
    res.json({
      message: `Você agora faz parte da rede de ${invite.inviter.name}.`,
    });
  }),
);
