import { z } from "zod";

export const registerSchema = z.object({
  body: z.object({
    name: z.string().min(2).max(120),
    email: z.string().email().max(180),
    password: z.string().min(8).max(128)
  })
});

export const loginSchema = z.object({
  body: z.object({
    email: z.string().email(),
    password: z.string().min(1),
    remember: z.boolean().optional()
  })
});

export const refreshSchema = z.object({
  body: z.object({
    refreshToken: z.string().min(1)
  })
});

export const forgotPasswordSchema = z.object({
  body: z.object({ email: z.string().trim().email().max(180) })
});

export const resetPasswordSchema = z.object({
  body: z.object({
    token: z.string().min(32).max(512),
    password: z.string().min(8).max(128)
  })
});

export const oauthExchangeSchema = z.object({
  body: z.object({ code: z.string().min(32).max(512) })
});

export const updateProfileSchema = z.object({
  body: z.object({
    name: z.string().trim().min(2).max(120),
    phone: z.string().trim().max(30).nullable(),
    company: z.string().trim().max(120).nullable(),
    position: z.string().trim().max(120).nullable(),
    language: z.enum(["pt-BR"]),
    timezone: z.enum(["America/Porto_Velho", "America/Sao_Paulo", "America/Manaus", "America/Rio_Branco", "America/Fortaleza", "UTC"]),
    theme: z.enum(["LIGHT", "DARK", "SYSTEM"]),
    settings: z.object({
      dateFormat: z.literal("dd/MM/yyyy"),
      timeFormat: z.literal("HH:mm"),
      firstDayOfWeek: z.number().int().min(0).max(1),
      emailNotifications: z.boolean(),
      popupNotifications: z.boolean(),
      soundNotifications: z.boolean()
    })
  })
});
