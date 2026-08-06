import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../config/prisma.js";
import { requireAuth } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { entityIdSchema } from "../../utils/schemas.js";

export const calendarRouter = Router();
calendarRouter.use(requireAuth);

calendarRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const calendars = await prisma.calendar.findMany({
      where: { ownerId: req.user!.sub },
      include: { categories: true, shares: true },
      orderBy: [{ isDefault: "desc" }, { name: "asc" }]
    });

    res.json({ calendars });
  })
);

const calendarSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(120),
    description: z.string().max(500).optional(),
    color: z.string().max(32).default("#2563eb")
  })
});

const calendarIdSchema = z.object({
  params: z.object({ id: entityIdSchema })
});

calendarRouter.post(
  "/",
  validate(calendarSchema),
  asyncHandler(async (req, res) => {
    const calendar = await prisma.calendar.create({
      data: {
        ...req.body,
        ownerId: req.user!.sub
      }
    });
    res.status(201).json({ calendar });
  })
);

calendarRouter.patch(
  "/:id",
  validate(calendarIdSchema.merge(z.object({ body: calendarSchema.shape.body.partial() }))),
  asyncHandler(async (req, res) => {
    const existing = await prisma.calendar.findFirst({ where: { id: req.params.id, ownerId: req.user!.sub } });
    if (!existing) return res.status(404).json({ message: "Agenda nao encontrada." });

    const calendar = await prisma.calendar.update({ where: { id: existing.id }, data: req.body });
    res.json({ calendar });
  })
);

calendarRouter.delete(
  "/:id",
  validate(calendarIdSchema),
  asyncHandler(async (req, res) => {
    const existing = await prisma.calendar.findFirst({ where: { id: req.params.id, ownerId: req.user!.sub } });
    if (!existing) return res.status(404).json({ message: "Agenda nao encontrada." });
    if (existing.isDefault) return res.status(409).json({ message: "A agenda padrao nao pode ser removida." });

    await prisma.calendar.delete({ where: { id: existing.id } });
    res.status(204).send();
  })
);
