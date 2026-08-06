import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../config/prisma.js";
import { requireAuth } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { asyncHandler } from "../../utils/async-handler.js";

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
