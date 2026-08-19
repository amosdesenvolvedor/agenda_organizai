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

adminRouter.get("/users", asyncHandler(async (req, res) => {
  if (req.user!.role !== "ADMIN") return res.status(403).json({ message: "Acesso negado." });
  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true, role: true, isActive: true, deactivatedAt: true, emailVerifiedAt: true, createdAt: true, updatedAt: true, _count: { select: { tasks: true, createdEvents: true, teams: true, sentNetworkInvites: true } } },
    orderBy: { createdAt: "desc" }
  });
  res.json({ users });
}));

adminRouter.patch(
  "/users/:userId/status",
  validate(z.object({ params: z.object({ userId: z.string().min(1).max(191) }), body: z.object({ active: z.boolean() }) })),
  asyncHandler(async (req, res) => {
    if (req.user!.role !== "ADMIN") return res.status(403).json({ message: "Acesso negado." });
    if (req.params.userId === req.user!.sub && !req.body.active) return res.status(409).json({ message: "Você não pode desativar a própria conta administrativa." });
    const previous = await prisma.user.findUnique({ where: { id: req.params.userId }, select: { id: true, isActive: true } });
    if (!previous) return res.status(404).json({ message: "Usuário não encontrado." });
    const user = await prisma.user.update({ where: { id: previous.id }, data: { isActive: req.body.active, deactivatedAt: req.body.active ? null : new Date(), refreshTokens: req.body.active ? undefined : { deleteMany: {} } }, select: { id: true, name: true, email: true, role: true, isActive: true, deactivatedAt: true } });
    await prisma.auditLog.create({ data: { actorId: req.user!.sub, entity: "User", entityId: user.id, action: req.body.active ? "REACTIVATE" : "DEACTIVATE", oldValue: previous, newValue: user } });
    res.json({ user });
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
