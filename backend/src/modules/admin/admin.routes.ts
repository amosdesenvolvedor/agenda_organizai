import { Router } from "express";
import { prisma } from "../../config/prisma.js";
import { requireAuth } from "../../middleware/auth.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { enqueueEmail, testEmailTemplate } from "../../services/email.service.js";
import { z } from "zod";
import { validate } from "../../middleware/validate.js";

export const adminRouter = Router();
adminRouter.use(requireAuth);

adminRouter.get(
  "/overview",
  asyncHandler(async (req, res) => {
    if (req.user!.role !== "ADMIN") return res.status(403).json({ message: "Acesso negado." });

    const [users, events, tasks, logs] = await Promise.all([
      prisma.user.count(),
      prisma.event.count(),
      prisma.task.count(),
      prisma.auditLog.count()
    ]);

    res.json({ users, events, tasks, logs });
  })
);

adminRouter.post(
  "/email/test",
  validate(z.object({ body: z.object({ email: z.string().trim().email() }) })),
  asyncHandler(async (req, res) => {
    if (req.user!.role !== "ADMIN") return res.status(403).json({ message: "Acesso negado." });
    const delivery = await enqueueEmail({
      to: req.body.email.toLowerCase(),
      subject: "Teste de e-mail — Agenda OrganizaÍ",
      html: testEmailTemplate()
    });
    res.status(202).json({ delivery: { id: delivery.id, status: delivery.status } });
  })
);
