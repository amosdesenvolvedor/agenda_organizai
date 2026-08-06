import { z } from "zod";
import { entityIdSchema } from "../../utils/schemas.js";

const eventBody = z.object({
  calendarId: entityIdSchema,
  title: z.string().min(1).max(180),
  description: z.string().max(5000).optional(),
  location: z.string().max(255).optional(),
  link: z.string().url().optional(),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date(),
  allDay: z.boolean().default(false),
  color: z.string().max(32).optional(),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).default("NORMAL"),
  status: z.enum(["SCHEDULED", "CONFIRMED", "DONE", "CANCELED"]).default("SCHEDULED"),
  visibility: z.enum(["PRIVATE", "PUBLIC", "SHARED"]).default("PRIVATE"),
  tags: z.array(z.string().max(40)).default([])
});

export const createEventSchema = z.object({
  body: eventBody
});

export const updateEventSchema = z.object({
  params: z.object({ id: entityIdSchema }),
  body: eventBody.partial()
});

export const eventIdSchema = z.object({
  params: z.object({ id: entityIdSchema })
});

export const shareEventSchema = z.object({
  params: z.object({ id: entityIdSchema }),
  body: z.object({ email: z.string().trim().email().max(180) })
});
