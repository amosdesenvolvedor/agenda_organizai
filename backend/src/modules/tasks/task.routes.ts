import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../config/prisma.js";
import { requireAuth } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { entityIdSchema } from "../../utils/schemas.js";

export const taskRouter = Router();
taskRouter.use(requireAuth);

taskRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const tasks = await prisma.task.findMany({
      where: req.user!.role === "ADMIN"
        ? undefined
        : { OR: [{ ownerId: req.user!.sub }, { assigneeId: req.user!.sub }] },
      include: {
        subtasks: true,
        recurrence: true,
        owner: { select: { id: true, name: true, email: true } },
        assignee: { select: { id: true, name: true, email: true } },
        category: true
      },
      orderBy: [{ completedAt: "asc" }, { dueAt: "asc" }]
    });
    res.json({ tasks });
  })
);

const taskBody = z.object({
  title: z.string().min(1).max(180),
  summary: z.string().max(300).nullable().optional(),
  description: z.string().max(5000).nullable().optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable().optional(),
  icon: z.string().trim().min(1).max(50).nullable().optional(),
  assigneeId: entityIdSchema.optional(),
  calendarId: entityIdSchema.nullable().optional(),
  categoryId: entityIdSchema.optional(),
  startsAt: z.coerce.date().nullable().optional(),
  dueAt: z.coerce.date().nullable().optional(),
  endsAt: z.coerce.date().nullable().optional(),
  allDay: z.boolean().default(false),
  noTime: z.boolean().default(false),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT", "CRITICAL"]).default("NORMAL"),
  status: z.enum(["NOT_STARTED", "IN_PROGRESS", "WAITING", "PAUSED", "COMPLETED", "CANCELED"]).default("NOT_STARTED"),
  privacy: z.enum(["PUBLIC", "PRIVATE", "PARTICIPANTS", "ADMINS"]).default("PRIVATE"),
  progressMode: z.enum(["MANUAL", "AUTOMATIC"]).default("MANUAL"),
  progress: z.number().int().min(0).max(100).default(0),
  isFavorite: z.boolean().default(false),
  isArchived: z.boolean().default(false),
  isPinned: z.boolean().default(false),
  isDraft: z.boolean().default(false),
  recurrence: z.object({
    frequency: z.enum(["DAILY", "WEEKLY", "MONTHLY", "YEARLY", "CUSTOM"]),
    interval: z.number().int().min(1).max(365).default(1),
    byWeekday: z.string().max(100).nullable().optional(),
    endsAt: z.coerce.date().nullable().optional(),
    count: z.number().int().min(1).max(1000).nullable().optional()
  }).nullable().optional()
});

const taskIdSchema = z.object({
  params: z.object({ id: entityIdSchema })
});

const shareTaskSchema = taskIdSchema.merge(z.object({
  body: z.object({ email: z.string().trim().email().max(180) })
}));

taskRouter.post(
  "/",
  validate(z.object({ body: taskBody })),
  asyncHandler(async (req, res) => {
    if (req.body.calendarId) {
      const calendar = await prisma.calendar.findFirst({ where: { id: req.body.calendarId, ownerId: req.user!.sub } });
      if (!calendar) return res.status(404).json({ message: "Agenda não encontrada ou sem permissão." });
    }
    if (req.body.startsAt && req.body.endsAt && req.body.endsAt <= req.body.startsAt) {
      return res.status(422).json({ message: "O horário de término deve ser posterior ao início." });
    }
    const { tags, recurrence, ...body } = req.body;
    const task = await prisma.task.create({
      data: {
        ...body,
        tags: tags.join(","),
        ownerId: req.user!.sub,
        completedAt: body.status === "COMPLETED" ? new Date() : null,
        recurrence: recurrence ? { create: recurrence } : undefined
      }
    });
    await prisma.auditLog.create({
      data: { actorId: req.user!.sub, entity: "Task", entityId: task.id, action: "CREATE", newValue: JSON.parse(JSON.stringify(task)) }
    });
    res.status(201).json({ task });
  })
);

taskRouter.patch(
  "/:id",
  validate(taskIdSchema.merge(z.object({ body: taskBody.partial().extend({ completed: z.boolean().optional() }) }))),
  asyncHandler(async (req, res) => {
    const existing = await prisma.task.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ message: "Tarefa nao encontrada." });
    if (existing.ownerId !== req.user!.sub && req.user!.role !== "ADMIN") {
      return res.status(403).json({ message: "Somente o criador ou um administrador pode editar esta tarefa." });
    }

    if (req.body.calendarId) {
      const calendar = await prisma.calendar.findFirst({ where: { id: req.body.calendarId, ownerId: existing.ownerId } });
      if (!calendar) return res.status(404).json({ message: "Agenda não encontrada ou sem permissão." });
    }
    if (req.body.startsAt && req.body.endsAt && req.body.endsAt <= req.body.startsAt) {
      return res.status(422).json({ message: "O horário de término deve ser posterior ao início." });
    }
    const { completed, tags, recurrence, ...data } = req.body;
    const shouldComplete = completed ?? data.status === "COMPLETED";
    const task = await prisma.task.update({
      where: { id: existing.id },
      data: {
        ...data,
        tags: tags === undefined ? undefined : tags.join(","),
        progress: data.status === "COMPLETED" ? 100 : data.progress,
        completedAt: completed === undefined && data.status === undefined ? undefined : shouldComplete ? new Date() : null,
        recurrence: recurrence === undefined
          ? undefined
          : recurrence === null
            ? { delete: true }
            : { upsert: { create: recurrence, update: recurrence } }
      }
    });
    await prisma.auditLog.create({
      data: {
        actorId: req.user!.sub,
        entity: "Task",
        entityId: task.id,
        action: "UPDATE",
        oldValue: JSON.parse(JSON.stringify(existing)),
        newValue: JSON.parse(JSON.stringify(task))
      }
    });
    res.json({ task });
  })
);

taskRouter.post(
  "/:id/share",
  validate(shareTaskSchema),
  asyncHandler(async (req, res) => {
    const existing = await prisma.task.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ message: "Tarefa nao encontrada." });
    if (existing.ownerId !== req.user!.sub && req.user!.role !== "ADMIN") {
      return res.status(403).json({ message: "Somente o criador ou um administrador pode compartilhar esta tarefa." });
    }

    const assignee = await prisma.user.findUnique({ where: { email: req.body.email.toLowerCase() } });
    if (!assignee) return res.status(404).json({ message: "Nenhum usuário cadastrado com este e-mail." });

    const task = await prisma.task.update({
      where: { id: existing.id },
      data: { assigneeId: assignee.id },
      include: { assignee: { select: { id: true, name: true, email: true } } }
    });
    await prisma.auditLog.create({
      data: {
        actorId: req.user!.sub,
        entity: "Task",
        entityId: task.id,
        action: "SHARE",
        oldValue: JSON.parse(JSON.stringify(existing)),
        newValue: JSON.parse(JSON.stringify(task))
      }
    });
    res.json({ task });
  })
);

taskRouter.delete(
  "/:id",
  validate(taskIdSchema),
  asyncHandler(async (req, res) => {
    const existing = await prisma.task.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ message: "Tarefa nao encontrada." });
    if (existing.ownerId !== req.user!.sub && req.user!.role !== "ADMIN") {
      return res.status(403).json({ message: "Somente o criador ou um administrador pode excluir esta tarefa." });
    }
    await prisma.task.delete({ where: { id: existing.id } });
    await prisma.auditLog.create({
      data: { actorId: req.user!.sub, entity: "Task", entityId: existing.id, action: "DELETE", oldValue: JSON.parse(JSON.stringify(existing)) }
    });
    res.status(204).send();
  })
);
