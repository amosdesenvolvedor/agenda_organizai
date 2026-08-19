import { Router } from "express";
import { createHash } from "node:crypto";
import { z } from "zod";
import { prisma } from "../../config/prisma.js";
import { requireAuth } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { env } from "../../config/env.js";

export const notificationRouter = Router();
notificationRouter.use(requireAuth);

notificationRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const notifications = await prisma.notification.findMany({
      where: { userId: req.user!.sub },
      orderBy: { createdAt: "desc" },
      take: 100
    });
    res.json({ notifications });
  })
);

notificationRouter.get("/push/public-key", (_req, res) => {
  if (!env.VAPID_PUBLIC_KEY) return res.status(503).json({ message: "Notificações do dispositivo ainda não estão configuradas." });
  res.json({ publicKey: env.VAPID_PUBLIC_KEY });
});

notificationRouter.post(
  "/push/subscriptions",
  validate(z.object({ body: z.object({ endpoint: z.string().url().max(2000), keys: z.object({ p256dh: z.string().min(1).max(1000), auth: z.string().min(1).max(1000) }) }) })),
  asyncHandler(async (req, res) => {
    const endpointHash = createHash("sha256").update(req.body.endpoint).digest("hex");
    const subscription = await prisma.pushSubscription.upsert({
      where: { endpointHash },
      create: { endpointHash, endpoint: req.body.endpoint, p256dh: req.body.keys.p256dh, auth: req.body.keys.auth, userId: req.user!.sub },
      update: { endpoint: req.body.endpoint, p256dh: req.body.keys.p256dh, auth: req.body.keys.auth, userId: req.user!.sub }
    });
    res.status(201).json({ id: subscription.id });
  })
);

notificationRouter.patch(
  "/:id/read",
  validate(z.object({ params: z.object({ id: z.string().cuid() }) })),
  asyncHandler(async (req, res) => {
    const notification = await prisma.notification.updateMany({
      where: { id: req.params.id, userId: req.user!.sub },
      data: { readAt: new Date() }
    });
    if (!notification.count) return res.status(404).json({ message: "Notificacao nao encontrada." });
    res.status(204).send();
  })
);
