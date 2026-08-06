import { Router } from "express";
import { prisma } from "../../config/prisma.js";
import { requireAuth } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { createEventSchema, eventIdSchema, shareEventSchema, updateEventSchema } from "./event.schemas.js";

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
          { attendees: { some: { OR: [{ userId: req.user!.sub }, { email: req.user!.email }] } } }
        ]
      },
      include: { category: true, reminders: true, attendees: true },
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

    const event = await prisma.event.create({
      data: {
        ...req.body,
        createdById: req.user!.sub,
        tags: req.body.tags.join(",")
      }
    });

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

    return res.status(existing ? 200 : 201).json({ attendee });
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
