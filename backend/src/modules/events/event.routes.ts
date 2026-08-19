import { Router } from "express";
import { prisma } from "../../config/prisma.js";
import { requireAuth } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { completeEventSchema, createEventSchema, eventIdSchema, shareEventSchema, updateEventSchema } from "./event.schemas.js";
import { enqueueEmail } from "../../services/email.service.js";
import { env } from "../../config/env.js";

export const eventRouter = Router();
eventRouter.use(requireAuth);

eventRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const events = await prisma.event.findMany({
      where: {
        OR: [
          { createdById: req.user!.sub },
          { calendar: { ownerId: req.user!.sub } },
          { team: { members: { some: { userId: req.user!.sub } } } },
          { attendees: { some: { OR: [{ userId: req.user!.sub }, { email: req.user!.email }] } } }
        ]
      },
      include: { category: true, reminders: true, attendees: true, team: { select: { id: true, name: true } } },
      orderBy: { startsAt: "asc" },
      take: 300
    });
    res.json({ events });
  })
);

eventRouter.post(
  "/",
  validate(createEventSchema),
  asyncHandler(async (req, res) => {
    const calendar = await prisma.calendar.findFirst({
      where: { id: req.body.calendarId, ownerId: req.user!.sub }
    });
    if (!calendar) return res.status(404).json({ message: "Agenda nao encontrada." });
    if (req.body.teamId) {
      const membership = await prisma.teamMember.findUnique({ where: { teamId_userId: { teamId: req.body.teamId, userId: req.user!.sub } } });
      if (!membership) return res.status(403).json({ message: "Você não integra a equipe selecionada." });
    }

    const { tags, attendeeUserIds, ...eventData } = req.body;
    const invitedUsers = attendeeUserIds.length ? await prisma.user.findMany({
      where: {
        id: { in: attendeeUserIds, not: req.user!.sub }, isActive: true,
        OR: [
          { sentNetworkInvites: { some: { acceptedById: req.user!.sub, acceptedAt: { not: null } } } },
          { acceptedNetworkInvites: { some: { inviterId: req.user!.sub, acceptedAt: { not: null } } } }
        ]
      }, select: { id: true, name: true, email: true }
    }) : [];
    if (invitedUsers.length !== new Set(attendeeUserIds.filter((id: string) => id !== req.user!.sub)).size) return res.status(403).json({ message: "Selecione somente usuários da sua rede." });
    const event = await prisma.event.create({
      data: {
        ...eventData,
        createdById: req.user!.sub,
        tags: tags.join(","),
        reminders: {
          create: [1440, 720, 5].map((minutes) => ({ userId: req.user!.sub, minutes, type: "SYSTEM" }))
        },
        attendees: invitedUsers.length ? { create: invitedUsers.map((user) => ({ userId: user.id, email: user.email, name: user.name, role: "READ" })) } : undefined
      }
    });
    if (invitedUsers.length) await prisma.notification.createMany({ data: invitedUsers.map((user) => ({ userId: user.id, type: "SYSTEM", title: "Você foi adicionado a um evento", body: event.title })) });
    if (req.body.teamId) {
      const members = await prisma.teamMember.findMany({ where: { teamId: req.body.teamId, userId: { not: req.user!.sub } }, select: { userId: true } });
      if (members.length) await prisma.notification.createMany({ data: members.map((member) => ({ userId: member.userId, type: "SYSTEM", title: "Novo evento da equipe", body: event.title })) });
    }

    await prisma.auditLog.create({
      data: {
        actorId: req.user!.sub,
        entity: "Event",
        entityId: event.id,
        action: "CREATE",
        newValue: JSON.parse(JSON.stringify(event))
      }
    });

    res.status(201).json({ event });
  })
);

eventRouter.patch(
  "/:id",
  validate(updateEventSchema),
  asyncHandler(async (req, res) => {
    const previous = await prisma.event.findFirst({ where: { id: req.params.id } });
    if (!previous) return res.status(404).json({ message: "Evento nao encontrado." });
    if (previous.createdById !== req.user!.sub) {
      return res.status(403).json({ message: "Somente o criador pode editar este compromisso." });
    }

    if (req.body.calendarId) {
      const targetCalendar = await prisma.calendar.findFirst({
        where: { id: req.body.calendarId, ownerId: req.user!.sub }
      });
      if (!targetCalendar) return res.status(404).json({ message: "Agenda de destino nao encontrada." });
    }
    if (req.body.teamId) {
      const membership = await prisma.teamMember.findUnique({ where: { teamId_userId: { teamId: req.body.teamId, userId: req.user!.sub } } });
      if (!membership) return res.status(403).json({ message: "Você não integra a equipe selecionada." });
    }

    const event = await prisma.event.update({
      where: { id: req.params.id },
      data: { ...req.body, tags: Array.isArray(req.body.tags) ? req.body.tags.join(",") : req.body.tags }
    });

    await prisma.auditLog.create({
      data: {
        actorId: req.user!.sub,
        entity: "Event",
        entityId: event.id,
        action: "UPDATE",
        oldValue: JSON.parse(JSON.stringify(previous)),
        newValue: JSON.parse(JSON.stringify(event))
      }
    });

    res.json({ event });
  })
);

eventRouter.post(
  "/:id/share",
  validate(shareEventSchema),
  asyncHandler(async (req, res) => {
    const event = await prisma.event.findFirst({ where: { id: req.params.id } });
    if (!event) return res.status(404).json({ message: "Evento nao encontrado." });
    if (event.createdById !== req.user!.sub) {
      return res.status(403).json({ message: "Somente o criador pode compartilhar este compromisso." });
    }

    const email = req.body.email.toLowerCase();
    const invitedUser = await prisma.user.findUnique({ where: { email } });
    const existing = await prisma.eventAttendee.findFirst({
      where: { eventId: event.id, OR: [{ email }, ...(invitedUser ? [{ userId: invitedUser.id }] : [])] }
    });

    const attendee = existing ?? await prisma.eventAttendee.create({
      data: {
        eventId: event.id,
        email,
        userId: invitedUser?.id,
        name: invitedUser?.name,
        role: "READ"
      }
    });

    if (invitedUser) await prisma.notification.create({ data: { userId: invitedUser.id, type: "SYSTEM", title: "Você foi convidado para um evento", body: event.title } });
    await Promise.allSettled([enqueueEmail({
      to: email,
      subject: `Convite: ${event.title}`,
      html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:32px"><h1 style="color:#0f172a">Convite para evento</h1><p>Você recebeu acesso ao evento <strong>${event.title.replace(/[<>&]/g, "")}</strong>.</p><p><a href="${env.APP_URL}" style="display:inline-block;padding:12px 18px;background:#2563eb;color:#fff;text-decoration:none;border-radius:8px">Abrir Agenda OrganizaÍ</a></p><p style="color:#64748b;font-size:13px">Entre usando o e-mail ${email}.</p></div>`
    })]);

    return res.status(existing ? 200 : 201).json({ attendee });
  })
);

eventRouter.post(
  "/:id/complete",
  validate(completeEventSchema),
  asyncHandler(async (req, res) => {
    const previous = await prisma.event.findFirst({ where: { id: req.params.id } });
    if (!previous) return res.status(404).json({ message: "Evento não encontrado." });
    if (previous.createdById !== req.user!.sub) {
      return res.status(403).json({ message: "Somente o criador pode finalizar este evento." });
    }
    if (previous.status === "DONE") return res.status(409).json({ message: "Este evento já foi finalizado." });
    const event = await prisma.event.update({
      where: { id: previous.id },
      data: {
        status: "DONE",
        completedAt: new Date(),
        feedback: req.body.feedback,
        discussionTopics: req.body.discussionTopics
      }
    });
    await prisma.auditLog.create({
      data: { actorId: req.user!.sub, entity: "Event", entityId: event.id, action: "COMPLETE", oldValue: JSON.parse(JSON.stringify(previous)), newValue: JSON.parse(JSON.stringify(event)) }
    });
    res.json({ event });
  })
);

eventRouter.delete(
  "/:id",
  validate(eventIdSchema),
  asyncHandler(async (req, res) => {
    const event = await prisma.event.findFirst({ where: { id: req.params.id } });
    if (!event) return res.status(404).json({ message: "Evento nao encontrado." });
    if (event.createdById !== req.user!.sub) {
      return res.status(403).json({ message: "Somente o criador pode excluir este compromisso." });
    }

    await prisma.event.delete({ where: { id: req.params.id } });
    await prisma.auditLog.create({
      data: {
        actorId: req.user!.sub,
        entity: "Event",
        entityId: event.id,
        action: "DELETE",
        oldValue: JSON.parse(JSON.stringify(event))
      }
    });
    res.status(204).send();
  })
);
