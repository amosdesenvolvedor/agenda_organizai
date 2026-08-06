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
