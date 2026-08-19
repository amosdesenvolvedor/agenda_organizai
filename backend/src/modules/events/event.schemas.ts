import { z } from "zod";
import { entityIdSchema } from "../../utils/schemas.js";

const eventBody = z.object({
  calendarId: entityIdSchema,
  teamId: entityIdSchema.nullable().optional(),
  title: z.string().min(1).max(180),
  description: z.string().max(5000).nullable().optional(),
  feedback: z.string().max(5000).nullable().optional(),
  discussionTopics: z.string().max(5000).nullable().optional(),
  location: z.string().max(255).optional(),
  link: z.string().url().refine((value) => /^https?:\/\//i.test(value), "Use um link iniciado por http:// ou https://.").nullable().optional(),
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
  body: eventBody.extend({ attendeeUserIds: z.array(entityIdSchema).max(100).default([]) })
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

export const completeEventSchema = z.object({
  params: z.object({ id: entityIdSchema }),
  body: z.object({
    feedback: z.string().trim().min(1, "Informe como foi o evento.").max(5000),
    discussionTopics: z.string().trim().min(1, "Informe os assuntos tratados.").max(5000)
  })
});
