import { Router } from "express";
import type { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../../config/prisma.js";
import { requireAuth } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { entityIdSchema } from "../../utils/schemas.js";
import rateLimit from "express-rate-limit";
import path from "node:path";
import { createHash, randomBytes } from "node:crypto";
import {
  createMediaUpload,
  removeUploadedFiles,
  validateUploadedMedia,
} from "../../services/media-upload.service.js";
import {
  areConnected,
  canViewPost,
  connectedUserIds,
  visiblePostWhere,
} from "../../services/social-access.service.js";

export const socialRouter = Router();
socialRouter.use(requireAuth);
const socialWriteLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 80,
  standardHeaders: true,
  legacyHeaders: false,
});
const imageUpload = createMediaUpload("feed", 8 * 1024 * 1024, "image", 4);
const videoUpload = createMediaUpload("feed", 30 * 1024 * 1024, "video", 1);
const conversationRequestLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 15,
  standardHeaders: true,
  legacyHeaders: false,
});

async function connectedUsers(userId: string) {
  const invites = await prisma.networkInvite.findMany({
    where: {
      acceptedAt: { not: null },
      OR: [{ inviterId: userId }, { acceptedById: userId }],
    },
    include: {
      inviter: {
        select: { id: true, name: true, email: true, avatarUrl: true },
      },
      acceptedBy: {
        select: { id: true, name: true, email: true, avatarUrl: true },
      },
    },
  });
  return invites
    .map((invite) =>
      invite.inviterId === userId ? invite.acceptedBy : invite.inviter,
    )
    .filter((user) => user !== null);
}

socialRouter.get(
  "/conversation-requests",
  asyncHandler(async (req, res) => {
    const requests = await prisma.conversationRequest.findMany({
      where: { recipientId: req.user!.sub, status: "PENDING" },
      include: {
        sender: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
        messages: { orderBy: { createdAt: "asc" }, take: 100 },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    res.json({ requests });
  }),
);

socialRouter.post(
  "/conversation-requests",
  conversationRequestLimit,
  validate(
    z.object({
      body: z.object({
        email: z.string().trim().email().max(180),
        message: z.string().trim().min(1).max(2000),
      }),
    }),
  ),
  asyncHandler(async (req, res) => {
    const recipient = await prisma.user.findUnique({
      where: { email: req.body.email.toLowerCase() },
      select: { id: true, name: true, isActive: true },
    });
    if (!recipient?.isActive)
      return res.status(404).json({ message: "Usuário não encontrado." });
    if (recipient.id === req.user!.sub)
      return res
        .status(409)
        .json({ message: "Você não pode enviar uma solicitação para si." });
    if (await areConnected(req.user!.sub, recipient.id))
      return res.status(409).json({
        message: "Este usuário já é seu contato. Abra a conversa existente.",
      });
    const previous = await prisma.conversationRequest.findUnique({
      where: {
        senderId_recipientId: {
          senderId: req.user!.sub,
          recipientId: recipient.id,
        },
      },
    });
    if (previous?.status === "SPAM")
      return res.status(403).json({
        message: "Não é possível enviar novas solicitações para este usuário.",
      });
    if (previous?.status === "PENDING") {
      const message = await prisma.conversationRequestMessage.create({
        data: { requestId: previous.id, body: req.body.message },
      });
      await prisma.notification.create({
        data: {
          userId: recipient.id,
          type: "SYSTEM",
          title: "Nova mensagem em solicitação",
          body: req.body.message.slice(0, 180),
        },
      });
      return res.status(201).json({
        request: { id: previous.id, messageId: message.id, pending: true },
      });
    }
    const request = await prisma.conversationRequest.upsert({
      where: {
        senderId_recipientId: {
          senderId: req.user!.sub,
          recipientId: recipient.id,
        },
      },
      create: {
        senderId: req.user!.sub,
        recipientId: recipient.id,
        firstMessage: req.body.message,
        messages: { create: { body: req.body.message } },
      },
      update: {
        firstMessage: req.body.message,
        status: "PENDING",
        respondedAt: null,
      },
    });
    await prisma.notification.create({
      data: {
        userId: recipient.id,
        type: "SYSTEM",
        title: "Nova solicitação de conversa",
        body: `${req.user!.email} quer iniciar uma conversa com você.`,
      },
    });
    res.status(201).json({ request: { id: request.id } });
  }),
);

socialRouter.post(
  "/conversation-requests/:requestId/respond",
  validate(
    z.object({
      params: z.object({ requestId: entityIdSchema }),
      body: z.object({ action: z.enum(["ACCEPT", "SPAM"]) }),
    }),
  ),
  asyncHandler(async (req, res) => {
    const request = await prisma.conversationRequest.findFirst({
      where: {
        id: req.params.requestId,
        recipientId: req.user!.sub,
        status: "PENDING",
      },
      include: { sender: { select: { name: true } } },
    });
    if (!request)
      return res.status(404).json({ message: "Solicitação não encontrada." });
    const now = new Date();
    if (req.body.action === "SPAM") {
      await prisma.conversationRequest.update({
        where: { id: request.id },
        data: { status: "SPAM", respondedAt: now },
      });
      return res.json({ message: "Solicitação marcada como spam." });
    }
    const tokenHash = createHash("sha256")
      .update(randomBytes(32))
      .digest("hex");
    const pendingMessages = await prisma.conversationRequestMessage.findMany({
      where: { requestId: request.id },
      orderBy: { createdAt: "asc" },
    });
    await prisma.$transaction([
      prisma.conversationRequest.update({
        where: { id: request.id },
        data: { status: "ACCEPTED", respondedAt: now },
      }),
      prisma.networkInvite.create({
        data: {
          tokenHash,
          inviterId: request.senderId,
          acceptedById: req.user!.sub,
          expiresAt: new Date(Date.now() + 30 * 86_400_000),
          acceptedAt: now,
        },
      }),
      ...(pendingMessages.length
        ? pendingMessages.map((message) =>
            prisma.directMessage.create({
              data: {
                senderId: request.senderId,
                recipientId: req.user!.sub,
                body: message.body,
                createdAt: message.createdAt,
              },
            }),
          )
        : [
            prisma.directMessage.create({
              data: {
                senderId: request.senderId,
                recipientId: req.user!.sub,
                body: request.firstMessage,
              },
            }),
          ]),
      prisma.notification.create({
        data: {
          userId: request.senderId,
          type: "SYSTEM",
          title: "Solicitação de conversa aceita",
          body: "Sua solicitação foi aceita. A conversa já está disponível.",
        },
      }),
    ]);
    res.json({ message: "Conversa e contato aceitos." });
  }),
);

socialRouter.get(
  "/conversations",
  asyncHandler(async (req, res) => {
    const users = await connectedUsers(req.user!.sub);
    const messages = users.length
      ? await prisma.directMessage.findMany({
          where: {
            OR: [
              {
                senderId: req.user!.sub,
                recipientId: { in: users.map((user) => user!.id) },
              },
              {
                recipientId: req.user!.sub,
                senderId: { in: users.map((user) => user!.id) },
              },
            ],
          },
          orderBy: { createdAt: "desc" },
        })
      : [];
    res.json({
      conversations: users.map((user) => {
        const related = messages.filter(
          (message) =>
            message.senderId === user!.id || message.recipientId === user!.id,
        );
        return {
          user,
          lastMessage: related[0] ?? null,
          unread: related.filter(
            (message) =>
              message.recipientId === req.user!.sub && !message.readAt,
          ).length,
        };
      }),
    });
  }),
);

const contactParams = z.object({
  params: z.object({ userId: entityIdSchema }),
});
socialRouter.get(
  "/conversations/:userId/messages",
  validate(contactParams),
  asyncHandler(async (req, res) => {
    const users = await connectedUsers(req.user!.sub);
    if (!users.some((user) => user!.id === req.params.userId))
      return res.status(403).json({
        message: "Conversa permitida apenas com usuários da sua rede.",
      });
    const messages = await prisma.directMessage.findMany({
      where: {
        OR: [
          { senderId: req.user!.sub, recipientId: req.params.userId },
          { senderId: req.params.userId, recipientId: req.user!.sub },
        ],
      },
      orderBy: { createdAt: "asc" },
      take: 500,
    });
    await prisma.directMessage.updateMany({
      where: {
        senderId: req.params.userId,
        recipientId: req.user!.sub,
        readAt: null,
      },
      data: { readAt: new Date() },
    });
    res.json({ messages });
  }),
);

socialRouter.post(
  "/conversations/:userId/messages",
  validate(
    contactParams.merge(
      z.object({
        body: z.object({ body: z.string().trim().min(1).max(5000) }),
      }),
    ),
  ),
  asyncHandler(async (req, res) => {
    const users = await connectedUsers(req.user!.sub);
    const contact = users.find((user) => user!.id === req.params.userId);
    if (!contact)
      return res.status(403).json({
        message: "Conversa permitida apenas com usuários da sua rede.",
      });
    const message = await prisma.directMessage.create({
      data: {
        senderId: req.user!.sub,
        recipientId: req.params.userId,
        body: req.body.body,
      },
    });
    await prisma.notification.create({
      data: {
        userId: req.params.userId,
        type: "SYSTEM",
        title: `Nova mensagem de ${req.user!.email}`,
        body: req.body.body.slice(0, 180),
      },
    });
    res.status(201).json({ message });
  }),
);

socialRouter.get(
  "/feed",
  asyncHandler(async (req, res) => {
    const connectedIds = await connectedUserIds(req.user!.sub);
    const cursor =
      typeof req.query.cursor === "string" ? req.query.cursor : undefined;
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 50);
    const posts = await prisma.feedPost.findMany({
      where: visiblePostWhere(req.user!.sub, connectedIds),
      include: {
        media: { select: { id: true, type: true, mimeType: true, size: true } },
        author: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
            avatarPath: true,
            position: true,
          },
        },
        likes: { select: { userId: true } },
        comments: {
          include: {
            author: {
              select: {
                id: true,
                name: true,
                avatarUrl: true,
                avatarPath: true,
              },
            },
          },
          orderBy: { createdAt: "asc" },
          take: 30,
        },
      },
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    const hasMore = posts.length > limit;
    if (hasMore) posts.pop();
    res.json({
      posts: posts.map((post) => ({
        ...post,
        author: {
          ...post.author,
          avatarPath: undefined,
          avatarUrl: post.author.avatarPath
            ? `/api/users/profiles/${post.author.id}/media/avatar`
            : post.author.avatarUrl,
        },
        comments: post.comments.map((comment) => ({
          ...comment,
          author: {
            ...comment.author,
            avatarPath: undefined,
            avatarUrl: comment.author.avatarPath
              ? `/api/users/profiles/${comment.author.id}/media/avatar`
              : comment.author.avatarUrl,
          },
        })),
        media: post.media.map((media) => ({
          ...media,
          url: `/api/social/feed/media/${media.id}`,
        })),
        likedByMe: post.likes.some((like) => like.userId === req.user!.sub),
        likeCount: post.likes.length,
        likes: undefined,
      })),
      nextCursor: hasMore ? posts.at(-1)?.id : null,
    });
  }),
);

socialRouter.post(
  "/feed",
  socialWriteLimit,
  validate(
    z.object({
      body: z.object({
        body: z.string().trim().max(10000),
        visibility: z.enum(["PUBLIC", "NETWORK", "PRIVATE"]).default("PUBLIC"),
      }),
    }),
  ),
  asyncHandler(async (req, res) => {
    const post = await prisma.feedPost.create({
      data: {
        authorId: req.user!.sub,
        body: req.body.body,
        visibility: req.body.visibility,
      },
    });
    res.status(201).json({ post });
  }),
);

async function savePostMedia(
  req: Request,
  res: Response,
  kind: "image" | "video",
) {
  const files = (req.files as Express.Multer.File[] | undefined) ?? [];
  const post = await prisma.feedPost.findUnique({
    where: { id: req.params.postId },
    include: { _count: { select: { media: true } } },
  });
  if (!post || post.authorId !== req.user!.sub) {
    await removeUploadedFiles(files);
    return res.status(404).json({ message: "Publicação não encontrada." });
  }
  if (!files.length || post._count.media + files.length > 5) {
    await removeUploadedFiles(files);
    return res.status(422).json({
      message: "Selecione mídia válida; o limite é 5 arquivos por publicação.",
    });
  }
  try {
    for (const file of files) await validateUploadedMedia(file, kind);
  } catch {
    await removeUploadedFiles(files);
    return res.status(422).json({
      message:
        "A assinatura do arquivo não corresponde ao tipo de mídia permitido.",
    });
  }
  const media = await prisma.feedMedia.createMany({
    data: files.map((file) => ({
      postId: post.id,
      type: kind === "image" ? "IMAGE" : "VIDEO",
      fileName: file.originalname.slice(0, 191),
      mimeType: file.mimetype,
      size: file.size,
      path: file.path,
    })),
  });
  return res.status(201).json({ count: media.count });
}

socialRouter.post(
  "/feed/:postId/media/images",
  socialWriteLimit,
  imageUpload.array("files", 4),
  asyncHandler(async (req, res) => savePostMedia(req, res, "image")),
);
socialRouter.post(
  "/feed/:postId/media/video",
  socialWriteLimit,
  videoUpload.array("files", 1),
  asyncHandler(async (req, res) => savePostMedia(req, res, "video")),
);

socialRouter.get(
  "/feed/media/:mediaId",
  asyncHandler(async (req, res) => {
    const media = await prisma.feedMedia.findUnique({
      where: { id: req.params.mediaId },
      include: { post: { select: { authorId: true, visibility: true } } },
    });
    if (!media)
      return res.status(404).json({ message: "Mídia não encontrada." });
    const connected =
      media.post.visibility === "NETWORK"
        ? await areConnected(req.user!.sub, media.post.authorId)
        : false;
    if (
      !canViewPost({
        viewerId: req.user!.sub,
        authorId: media.post.authorId,
        visibility: media.post.visibility,
        connected,
      })
    )
      return res
        .status(403)
        .json({ message: "Você não pode visualizar esta mídia." });
    res.type(media.mimeType).setHeader("Cache-Control", "private, max-age=300");
    return res.sendFile(path.resolve(media.path));
  }),
);

const postParams = z.object({ params: z.object({ postId: entityIdSchema }) });
socialRouter.post(
  "/feed/:postId/like",
  socialWriteLimit,
  validate(postParams),
  asyncHandler(async (req, res) => {
    const post = await prisma.feedPost.findUnique({
      where: { id: req.params.postId },
      select: { id: true, authorId: true, visibility: true },
    });
    if (!post)
      return res.status(404).json({ message: "Publicação não encontrada." });
    const connected =
      post.visibility === "NETWORK"
        ? await areConnected(req.user!.sub, post.authorId)
        : false;
    if (
      !canViewPost({
        viewerId: req.user!.sub,
        authorId: post.authorId,
        visibility: post.visibility,
        connected,
      })
    )
      return res.status(403).json({ message: "Publicação não encontrada." });
    const existing = await prisma.feedLike.findUnique({
      where: { postId_userId: { postId: post.id, userId: req.user!.sub } },
    });
    if (existing) await prisma.feedLike.delete({ where: { id: existing.id } });
    else
      await prisma.feedLike.create({
        data: { postId: post.id, userId: req.user!.sub },
      });
    if (!existing && post.authorId !== req.user!.sub)
      await prisma.notification.create({
        data: {
          userId: post.authorId,
          type: "SYSTEM",
          title: "Nova curtida",
          body: "Alguém curtiu sua publicação.",
        },
      });
    res.json({ liked: !existing });
  }),
);

socialRouter.post(
  "/feed/:postId/comments",
  socialWriteLimit,
  validate(
    postParams.merge(
      z.object({
        body: z.object({ body: z.string().trim().min(1).max(3000) }),
      }),
    ),
  ),
  asyncHandler(async (req, res) => {
    const post = await prisma.feedPost.findUnique({
      where: { id: req.params.postId },
      select: { id: true, authorId: true, visibility: true },
    });
    if (!post)
      return res.status(404).json({ message: "Publicação não encontrada." });
    const connected =
      post.visibility === "NETWORK"
        ? await areConnected(req.user!.sub, post.authorId)
        : false;
    if (
      !canViewPost({
        viewerId: req.user!.sub,
        authorId: post.authorId,
        visibility: post.visibility,
        connected,
      })
    )
      return res.status(403).json({ message: "Publicação não encontrada." });
    const comment = await prisma.feedComment.create({
      data: { postId: post.id, authorId: req.user!.sub, body: req.body.body },
    });
    if (post.authorId !== req.user!.sub)
      await prisma.notification.create({
        data: {
          userId: post.authorId,
          type: "SYSTEM",
          title: "Novo comentário",
          body: req.body.body.slice(0, 180),
        },
      });
    res.status(201).json({ comment });
  }),
);
