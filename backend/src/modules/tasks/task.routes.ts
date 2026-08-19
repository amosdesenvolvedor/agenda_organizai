import { Router } from "express";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import multer from "multer";
import { prisma } from "../../config/prisma.js";
import { env } from "../../config/env.js";
import { requireAuth } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { entityIdSchema } from "../../utils/schemas.js";
import { enqueueEmail } from "../../services/email.service.js";

export const taskRouter = Router();

const taskImageUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, callback) => { const destination = "uploads/task-messages"; mkdirSync(destination, { recursive: true }); callback(null, destination); },
    filename: (_req, file, callback) => callback(null, `${randomUUID()}${path.extname(file.originalname).toLowerCase()}`)
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => callback(null, ["image/jpeg", "image/png", "image/webp"].includes(file.mimetype))
});

taskRouter.get("/public/:token", asyncHandler(async (req, res) => {
  const tokenHash = createHash("sha256").update(req.params.token).digest("hex");
  const share = await prisma.taskExternalShare.findUnique({
    where: { tokenHash },
    include: { task: { include: { owner: { select: { name: true } }, team: { select: { name: true } } } } }
  });
  if (!share || share.revokedAt || share.expiresAt <= new Date()) return res.status(404).json({ message: "Este compartilhamento não existe ou expirou." });
  const { id, title, summary, description, priority, status, progress, startsAt, dueAt, endsAt, completedAt, team, owner } = share.task;
  res.json({ task: { id, title, summary, description, priority, status, progress, startsAt, dueAt, endsAt, completedAt, team, owner }, expiresAt: share.expiresAt });
}));

taskRouter.use(requireAuth);

async function accessibleTask(taskId: string, userId: string, isAdmin: boolean) {
  return prisma.task.findFirst({
    where: isAdmin ? { id: taskId } : { id: taskId, OR: [{ ownerId: userId }, { assigneeId: userId }, { observers: { some: { userId } } }, { team: { members: { some: { userId } } } }] }
  });
}

async function canDiscussTask(taskId: string, userId: string, isAdmin: boolean) {
  return prisma.task.findFirst({ where: isAdmin ? { id: taskId } : { id: taskId, OR: [{ ownerId: userId }, { assigneeId: userId }, { team: { members: { some: { userId } } } }] } });
}

taskRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const tasks = await prisma.task.findMany({
      where: req.user!.role === "ADMIN"
        ? undefined
        : { OR: [{ ownerId: req.user!.sub }, { assigneeId: req.user!.sub }, { observers: { some: { userId: req.user!.sub } } }, { team: { members: { some: { userId: req.user!.sub } } } }] },
      include: {
        subtasks: true,
        recurrence: true,
        owner: { select: { id: true, name: true, email: true } },
        assignee: { select: { id: true, name: true, email: true } },
        observers: { include: { user: { select: { id: true, name: true, email: true } } }, orderBy: { createdAt: "asc" } },
        personas: { orderBy: { createdAt: "asc" } },
        category: true,
        team: { select: { id: true, name: true } }
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
  teamId: entityIdSchema.nullable().optional(),
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

const taskCreateSchema = z.object({ body: taskBody.extend({
  assigneeEmail: z.string().trim().email().max(180).nullable().optional(),
  observerEmails: z.array(z.string().trim().email().max(180)).max(30).default([]),
  checklist: z.array(z.string().trim().min(1).max(300)).max(100).default([]),
  personas: z.array(z.object({ name: z.string().trim().min(1).max(180), role: z.string().trim().min(1).max(180) })).max(30).default([])
}) });

const shareTaskSchema = taskIdSchema.merge(z.object({
  body: z.object({ email: z.string().trim().email().max(180) })
}));

taskRouter.post(
  "/",
  validate(taskCreateSchema),
  asyncHandler(async (req, res) => {
    if (req.body.calendarId) {
      const calendar = await prisma.calendar.findFirst({ where: { id: req.body.calendarId, ownerId: req.user!.sub } });
      if (!calendar) return res.status(404).json({ message: "Agenda não encontrada ou sem permissão." });
    }
    if (req.body.teamId) {
      const membership = await prisma.teamMember.findUnique({ where: { teamId_userId: { teamId: req.body.teamId, userId: req.user!.sub } } });
      if (!membership) return res.status(403).json({ message: "Você não integra a equipe selecionada." });
    }
    if (req.body.startsAt && req.body.endsAt && req.body.endsAt <= req.body.startsAt) {
      return res.status(422).json({ message: "O horário de término deve ser posterior ao início." });
    }
    const { tags, recurrence, assigneeEmail, observerEmails, checklist, personas, ...body } = req.body;
    const assignee = assigneeEmail ? await prisma.user.findUnique({ where: { email: assigneeEmail.toLowerCase() } }) : null;
    if (assigneeEmail && !assignee) return res.status(404).json({ message: "Nenhum usuário cadastrado com o e-mail do responsável." });
    const observerUsers = observerEmails.length ? await prisma.user.findMany({ where: { email: { in: observerEmails.map((email: string) => email.toLowerCase()) } }, select: { id: true, email: true } }) : [];
    const missingObservers = observerEmails.filter((email: string) => !observerUsers.some((user) => user.email === email.toLowerCase()));
    if (missingObservers.length) return res.status(404).json({ message: `Observador não cadastrado: ${missingObservers[0]}` });
    const task = await prisma.task.create({
      data: {
        ...body,
        assigneeId: assignee?.id,
        tags: tags.join(","),
        ownerId: req.user!.sub,
        completedAt: body.status === "COMPLETED" ? new Date() : null,
        recurrence: recurrence ? { create: recurrence } : undefined,
        subtasks: checklist.length ? { create: checklist.map((title: string, sortOrder: number) => ({ title, sortOrder })) } : undefined,
        observers: observerUsers.length ? { create: observerUsers.filter((observer) => observer.id !== assignee?.id && observer.id !== req.user!.sub).map((observer) => ({ userId: observer.id })) } : undefined,
        personas: personas.length ? { create: personas } : undefined
      },
      include: { subtasks: true, assignee: { select: { id: true, name: true, email: true } }, observers: { include: { user: { select: { id: true, name: true, email: true } } } }, personas: true }
    });
    if (req.body.teamId) {
      const members = await prisma.teamMember.findMany({ where: { teamId: req.body.teamId, userId: { not: req.user!.sub } }, select: { userId: true } });
      if (members.length) await prisma.notification.createMany({ data: members.map((member) => ({ userId: member.userId, type: "SYSTEM", title: "Nova tarefa da equipe", body: task.title })) });
    }
    const notifiedUsers = new Set([...(assignee ? [assignee.id] : []), ...observerUsers.map((observer) => observer.id)]);
    notifiedUsers.delete(req.user!.sub);
    if (notifiedUsers.size) await prisma.notification.createMany({ data: [...notifiedUsers].map((userId) => ({ userId, type: "SYSTEM", title: assignee?.id === userId ? "Tarefa atribuída a você" : "Você foi adicionado como observador", body: task.title })) });
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
    if (req.body.teamId) {
      const membership = await prisma.teamMember.findUnique({ where: { teamId_userId: { teamId: req.body.teamId, userId: req.user!.sub } } });
      if (!membership) return res.status(403).json({ message: "Você não integra a equipe selecionada." });
    }
    if (req.body.startsAt && req.body.endsAt && req.body.endsAt <= req.body.startsAt) {
      return res.status(422).json({ message: "O horário de término deve ser posterior ao início." });
    }
    const { completed, tags, recurrence, ...data } = req.body;
    if (completed || data.status === "COMPLETED" || data.progress === 100) {
      return res.status(422).json({ message: "Use o botão Finalizar e informe o relatório da tarefa." });
    }
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
  "/:id/external-shares",
  validate(taskIdSchema.merge(z.object({ body: z.object({ expiresInDays: z.number().int().min(1).max(90).default(30) }) }))),
  asyncHandler(async (req, res) => {
    const task = await prisma.task.findUnique({ where: { id: req.params.id } });
    if (!task) return res.status(404).json({ message: "Tarefa não encontrada." });
    if (task.ownerId !== req.user!.sub && req.user!.role !== "ADMIN") return res.status(403).json({ message: "Somente o criador pode gerar compartilhamento externo." });
    const expiresAt = new Date(Date.now() + req.body.expiresInDays * 86_400_000);
    await prisma.taskExternalShare.updateMany({ where: { taskId: task.id, revokedAt: null }, data: { revokedAt: new Date() } });
    const token = randomBytes(32).toString("base64url");
    const share = await prisma.taskExternalShare.create({ data: { taskId: task.id, tokenHash: createHash("sha256").update(token).digest("hex"), expiresAt } });
    const url = `${env.APP_URL}/?taskShare=${encodeURIComponent(token)}`;
    res.status(201).json({ share: { id: share.id, url, expiresAt } });
  })
);

taskRouter.delete("/:id/external-shares", validate(taskIdSchema), asyncHandler(async (req, res) => {
  const task = await prisma.task.findUnique({ where: { id: req.params.id } });
  if (!task) return res.status(404).json({ message: "Tarefa não encontrada." });
  if (task.ownerId !== req.user!.sub && req.user!.role !== "ADMIN") return res.status(403).json({ message: "Somente o criador pode revogar compartilhamentos." });
  await prisma.taskExternalShare.updateMany({ where: { taskId: task.id, revokedAt: null }, data: { revokedAt: new Date() } });
  res.status(204).send();
}));

taskRouter.post("/:id/assume", validate(taskIdSchema), asyncHandler(async (req, res) => {
  const task = await accessibleTask(req.params.id, req.user!.sub, req.user!.role === "ADMIN");
  if (!task) return res.status(404).json({ message: "Tarefa não encontrada ou sem acesso." });
  if (task.completedAt) return res.status(409).json({ message: "Esta tarefa já foi finalizada." });
  if (task.assigneeId && task.assigneeId !== req.user!.sub && req.user!.role !== "ADMIN") return res.status(409).json({ message: "Esta tarefa já foi assumida por outra pessoa." });
  const updated = await prisma.task.update({ where: { id: task.id }, data: { assigneeId: req.user!.sub }, include: { assignee: { select: { id: true, name: true, email: true } }, team: { select: { id: true, name: true } } } });
  res.json({ task: updated });
}));

taskRouter.post("/:id/execute", validate(taskIdSchema), asyncHandler(async (req, res) => {
  const task = await accessibleTask(req.params.id, req.user!.sub, req.user!.role === "ADMIN");
  if (!task) return res.status(404).json({ message: "Tarefa não encontrada ou sem acesso." });
  if (task.assigneeId !== req.user!.sub && req.user!.role !== "ADMIN") return res.status(403).json({ message: "Assuma a tarefa antes de iniciar a execução." });
  if (task.completedAt) return res.status(409).json({ message: "Esta tarefa já foi finalizada." });
  const updated = await prisma.task.update({ where: { id: task.id }, data: { status: "IN_PROGRESS", startedAt: task.startedAt ?? new Date() } });
  res.json({ task: updated });
}));

taskRouter.post("/:id/finish", validate(taskIdSchema.merge(z.object({ body: z.object({ report: z.string().trim().min(10, "Informe um relatório com pelo menos 10 caracteres.").max(10000) }) }))), asyncHandler(async (req, res) => {
  const task = await accessibleTask(req.params.id, req.user!.sub, req.user!.role === "ADMIN");
  if (!task) return res.status(404).json({ message: "Tarefa não encontrada ou sem acesso." });
  if (task.assigneeId !== req.user!.sub && task.ownerId !== req.user!.sub && req.user!.role !== "ADMIN") return res.status(403).json({ message: "Somente o executor, criador ou administrador pode finalizar." });
  const canManageTask = task.ownerId === req.user!.sub || req.user!.role === "ADMIN";
  if (!task.startedAt && !canManageTask) return res.status(409).json({ message: "Inicie a execução antes de finalizar." });
  const updated = await prisma.task.update({ where: { id: task.id }, data: { status: "COMPLETED", progress: 100, completedAt: new Date(), executionReport: req.body.report } });
  res.json({ task: updated });
}));

taskRouter.post("/:id/checklist", validate(taskIdSchema.merge(z.object({ body: z.object({ title: z.string().trim().min(1).max(300) }) }))), asyncHandler(async (req, res) => {
  const task = await prisma.task.findUnique({ where: { id: req.params.id }, select: { id: true, ownerId: true, _count: { select: { subtasks: true } } } });
  if (!task) return res.status(404).json({ message: "Tarefa não encontrada." });
  if (task.ownerId !== req.user!.sub && req.user!.role !== "ADMIN") return res.status(403).json({ message: "Somente o criador pode montar o checklist." });
  const item = await prisma.subtask.create({ data: { taskId: task.id, title: req.body.title, sortOrder: task._count.subtasks } });
  res.status(201).json({ item });
}));

taskRouter.patch("/:id/checklist/:itemId", validate(z.object({ params: z.object({ id: entityIdSchema, itemId: entityIdSchema }), body: z.object({ completed: z.boolean() }) })), asyncHandler(async (req, res) => {
  const task = await accessibleTask(req.params.id, req.user!.sub, req.user!.role === "ADMIN");
  if (!task) return res.status(404).json({ message: "Tarefa não encontrada ou sem acesso." });
  const existing = await prisma.subtask.findFirst({ where: { id: req.params.itemId, taskId: task.id } });
  if (!existing) return res.status(404).json({ message: "Item do checklist não encontrado." });
  const item = await prisma.subtask.update({ where: { id: existing.id }, data: { completedAt: req.body.completed ? new Date() : null } });
  res.json({ item });
}));

taskRouter.delete("/:id/checklist/:itemId", validate(z.object({ params: z.object({ id: entityIdSchema, itemId: entityIdSchema }) })), asyncHandler(async (req, res) => {
  const task = await prisma.task.findUnique({ where: { id: req.params.id }, select: { ownerId: true } });
  if (!task) return res.status(404).json({ message: "Tarefa não encontrada." });
  if (task.ownerId !== req.user!.sub && req.user!.role !== "ADMIN") return res.status(403).json({ message: "Somente o criador pode excluir itens do checklist." });
  const removed = await prisma.subtask.deleteMany({ where: { id: req.params.itemId, taskId: req.params.id } });
  if (!removed.count) return res.status(404).json({ message: "Item do checklist não encontrado." });
  res.status(204).send();
}));

const personaBodySchema = z.object({ name: z.string().trim().min(1).max(180), role: z.string().trim().min(1).max(180) });

taskRouter.post("/:id/personas", validate(taskIdSchema.merge(z.object({ body: personaBodySchema }))), asyncHandler(async (req, res) => {
  const task = await prisma.task.findUnique({ where: { id: req.params.id }, select: { id: true, ownerId: true } });
  if (!task) return res.status(404).json({ message: "Tarefa não encontrada." });
  if (task.ownerId !== req.user!.sub && req.user!.role !== "ADMIN") return res.status(403).json({ message: "Somente o criador pode adicionar personas." });
  const persona = await prisma.taskPersona.create({ data: { taskId: task.id, name: req.body.name, role: req.body.role } });
  res.status(201).json({ persona });
}));

taskRouter.patch("/:id/personas/:personaId", validate(z.object({ params: z.object({ id: entityIdSchema, personaId: entityIdSchema }), body: personaBodySchema })), asyncHandler(async (req, res) => {
  const task = await prisma.task.findUnique({ where: { id: req.params.id }, select: { ownerId: true } });
  if (!task) return res.status(404).json({ message: "Tarefa não encontrada." });
  if (task.ownerId !== req.user!.sub && req.user!.role !== "ADMIN") return res.status(403).json({ message: "Somente o criador pode editar personas." });
  const existing = await prisma.taskPersona.findFirst({ where: { id: req.params.personaId, taskId: req.params.id } });
  if (!existing) return res.status(404).json({ message: "Persona não encontrada." });
  const persona = await prisma.taskPersona.update({ where: { id: existing.id }, data: req.body });
  res.json({ persona });
}));

taskRouter.delete("/:id/personas/:personaId", validate(z.object({ params: z.object({ id: entityIdSchema, personaId: entityIdSchema }) })), asyncHandler(async (req, res) => {
  const task = await prisma.task.findUnique({ where: { id: req.params.id }, select: { ownerId: true } });
  if (!task) return res.status(404).json({ message: "Tarefa não encontrada." });
  if (task.ownerId !== req.user!.sub && req.user!.role !== "ADMIN") return res.status(403).json({ message: "Somente o criador pode remover personas." });
  const removed = await prisma.taskPersona.deleteMany({ where: { id: req.params.personaId, taskId: req.params.id } });
  if (!removed.count) return res.status(404).json({ message: "Persona não encontrada." });
  res.status(204).send();
}));

taskRouter.post("/:id/observers", validate(taskIdSchema.merge(z.object({ body: z.object({ email: z.string().trim().email().max(180) }) }))), asyncHandler(async (req, res) => {
  const task = await prisma.task.findUnique({ where: { id: req.params.id }, select: { id: true, title: true, ownerId: true, assigneeId: true } });
  if (!task) return res.status(404).json({ message: "Tarefa não encontrada." });
  if (task.ownerId !== req.user!.sub && req.user!.role !== "ADMIN") return res.status(403).json({ message: "Somente o criador pode adicionar observadores." });
  const observer = await prisma.user.findUnique({ where: { email: req.body.email.toLowerCase() }, select: { id: true, name: true, email: true } });
  if (!observer) return res.status(404).json({ message: "Nenhum usuário cadastrado com este e-mail." });
  if (observer.id === task.ownerId || observer.id === task.assigneeId) return res.status(409).json({ message: "Este usuário já possui acesso como criador ou responsável." });
  await prisma.taskObserver.upsert({ where: { taskId_userId: { taskId: task.id, userId: observer.id } }, create: { taskId: task.id, userId: observer.id }, update: {} });
  await prisma.notification.create({ data: { userId: observer.id, type: "SYSTEM", title: "Você foi adicionado como observador", body: task.title } });
  res.status(201).json({ observer });
}));

taskRouter.delete("/:id/observers/:userId", validate(z.object({ params: z.object({ id: entityIdSchema, userId: entityIdSchema }) })), asyncHandler(async (req, res) => {
  const task = await prisma.task.findUnique({ where: { id: req.params.id }, select: { ownerId: true } });
  if (!task) return res.status(404).json({ message: "Tarefa não encontrada." });
  if (task.ownerId !== req.user!.sub && req.user!.role !== "ADMIN") return res.status(403).json({ message: "Somente o criador pode remover observadores." });
  await prisma.taskObserver.deleteMany({ where: { taskId: req.params.id, userId: req.params.userId } });
  res.status(204).send();
}));

taskRouter.get("/:id/messages", validate(taskIdSchema), asyncHandler(async (req, res) => {
  const task = await canDiscussTask(req.params.id, req.user!.sub, req.user!.role === "ADMIN");
  if (!task) return res.status(404).json({ message: "Tarefa não encontrada ou sem acesso." });
  const messages = await prisma.taskMessage.findMany({ where: { taskId: task.id }, include: { author: { select: { id: true, name: true } } }, orderBy: { createdAt: "asc" }, take: 200 });
  res.json({ messages: messages.map((message) => ({ ...message, imagePath: undefined, imageUrl: message.imagePath ? `/api/tasks/${task.id}/messages/${message.id}/image` : null })) });
}));

taskRouter.post("/:id/messages", taskImageUpload.single("image"), asyncHandler(async (req, res) => {
  const task = await canDiscussTask(req.params.id, req.user!.sub, req.user!.role === "ADMIN");
  if (!task) return res.status(404).json({ message: "Tarefa não encontrada ou sem acesso." });
  const body = typeof req.body.body === "string" ? req.body.body.trim().slice(0, 5000) : "";
  if (!body && !req.file) return res.status(422).json({ message: "Escreva uma mensagem ou selecione uma foto." });
  const message = await prisma.taskMessage.create({ data: { taskId: task.id, authorId: req.user!.sub, body: body || null, imagePath: req.file?.path, imageName: req.file?.originalname, imageMime: req.file?.mimetype } });
  res.status(201).json({ message });
}));

taskRouter.get("/:id/messages/:messageId/image", asyncHandler(async (req, res) => {
  const task = await canDiscussTask(req.params.id, req.user!.sub, req.user!.role === "ADMIN");
  if (!task) return res.status(404).json({ message: "Tarefa não encontrada ou sem acesso." });
  const message = await prisma.taskMessage.findFirst({ where: { id: req.params.messageId, taskId: task.id } });
  if (!message?.imagePath) return res.status(404).json({ message: "Foto não encontrada." });
  res.type(message.imageMime ?? "application/octet-stream").sendFile(path.resolve(message.imagePath));
}));

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
    await Promise.allSettled([
      prisma.notification.create({ data: { userId: assignee.id, type: "SYSTEM", title: "Tarefa atribuída a você", body: task.title } }),
      enqueueEmail({ to: assignee.email, subject: `Tarefa atribuída: ${task.title}`, html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:32px"><h1 style="color:#0f172a">Nova tarefa atribuída</h1><p>Você recebeu acesso à tarefa <strong>${task.title.replace(/[<>&]/g, "")}</strong>.</p><p><a href="${env.APP_URL}" style="display:inline-block;padding:12px 18px;background:#2563eb;color:#fff;text-decoration:none;border-radius:8px">Abrir tarefa</a></p></div>` })
    ]);
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
