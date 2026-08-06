import { Router } from "express";
import { createHash, randomBytes } from "node:crypto";
import { prisma } from "../../config/prisma.js";
import { requireAuth } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { hashPassword, verifyPassword } from "../../utils/password.js";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../../utils/tokens.js";
import { forgotPasswordSchema, loginSchema, refreshSchema, registerSchema, resetPasswordSchema } from "./auth.schemas.js";
import { enqueueEmail } from "../../services/email.service.js";
import { env } from "../../config/env.js";

export const authRouter = Router();

authRouter.post(
  "/register",
  validate(registerSchema),
  asyncHandler(async (req, res) => {
    const passwordHash = await hashPassword(req.body.password);
    const user = await prisma.user.create({
      data: {
        name: req.body.name,
        email: req.body.email.toLowerCase(),
        passwordHash,
        settings: { create: {} },
        calendars: {
          create: {
            name: "Minha agenda",
            color: "#2563eb",
            isDefault: true
          }
        }
      },
      select: { id: true, name: true, email: true, role: true }
    });

    res.status(201).json({ user });
  })
);

authRouter.post(
  "/login",
  validate(loginSchema),
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({ where: { email: req.body.email.toLowerCase() } });
    if (!user || !(await verifyPassword(req.body.password, user.passwordHash))) {
      return res.status(401).json({ message: "Email ou senha invalidos." });
    }

    const payload = { sub: user.id, email: user.email, role: user.role };
    const accessToken = signAccessToken(payload);
    const refreshToken = signRefreshToken(payload);

    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt: new Date(Date.now() + (req.body.remember ? 30 : 7) * 24 * 60 * 60 * 1000)
      }
    });

    res.json({
      accessToken,
      refreshToken,
      user: { id: user.id, name: user.name, email: user.email, role: user.role, avatarUrl: user.avatarUrl }
    });
  })
);

authRouter.post(
  "/refresh",
  validate(refreshSchema),
  asyncHandler(async (req, res) => {
    let payload;
    try {
      payload = verifyRefreshToken(req.body.refreshToken);
    } catch {
      return res.status(401).json({ message: "Sessao expirada. Entre novamente." });
    }

    const storedToken = await prisma.refreshToken.findFirst({
      where: {
        token: req.body.refreshToken,
        userId: payload.sub,
        expiresAt: { gt: new Date() }
      },
      include: { user: true }
    });

    if (!storedToken) {
      return res.status(401).json({ message: "Sessao expirada. Entre novamente." });
    }

    const accessToken = signAccessToken({
      sub: storedToken.user.id,
      email: storedToken.user.email,
      role: storedToken.user.role
    });

    return res.json({ accessToken });
  })
);

authRouter.post(
  "/forgot-password",
  validate(forgotPasswordSchema),
  asyncHandler(async (req, res) => {
    const email = req.body.email.toLowerCase();
    const user = await prisma.user.findUnique({ where: { email } });
    if (user) {
      const token = randomBytes(32).toString("hex");
      const tokenHash = createHash("sha256").update(token).digest("hex");
      await prisma.passwordResetToken.updateMany({
        where: { userId: user.id, usedAt: null },
        data: { usedAt: new Date() }
      });
      await prisma.passwordResetToken.create({
        data: { tokenHash, userId: user.id, expiresAt: new Date(Date.now() + 30 * 60_000) }
      });
      const resetUrl = `${env.APP_URL}/?resetToken=${encodeURIComponent(token)}`;
      await enqueueEmail({
        to: user.email,
        subject: "Redefinição de senha — Agenda OrganizaÍ",
        html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:32px;border:1px solid #e2e8f0;border-radius:12px"><h1 style="color:#0f172a">Redefinir sua senha</h1><p style="color:#334155;line-height:1.6">Recebemos uma solicitação para alterar a senha da sua conta.</p><p style="margin:28px 0"><a href="${resetUrl}" style="background:#2563eb;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:700">Criar nova senha</a></p><p style="color:#64748b;font-size:13px">Este link expira em 30 minutos e pode ser utilizado uma única vez. Se você não solicitou a alteração, ignore este e-mail.</p></div>`
      });
      await prisma.auditLog.create({ data: { actorId: user.id, entity: "User", entityId: user.id, action: "PASSWORD_RESET_REQUEST" } });
    }
    res.json({ message: "Se o e-mail estiver cadastrado, enviaremos as instruções de recuperação." });
  })
);

authRouter.post(
  "/reset-password",
  validate(resetPasswordSchema),
  asyncHandler(async (req, res) => {
    const tokenHash = createHash("sha256").update(req.body.token).digest("hex");
    const resetToken = await prisma.passwordResetToken.findUnique({ where: { tokenHash } });
    if (!resetToken || resetToken.usedAt || resetToken.expiresAt <= new Date()) {
      return res.status(400).json({ message: "Link de recuperação inválido ou expirado." });
    }
    const passwordHash = await hashPassword(req.body.password);
    await prisma.$transaction([
      prisma.user.update({ where: { id: resetToken.userId }, data: { passwordHash } }),
      prisma.passwordResetToken.update({ where: { id: resetToken.id }, data: { usedAt: new Date() } }),
      prisma.refreshToken.deleteMany({ where: { userId: resetToken.userId } }),
      prisma.auditLog.create({ data: { actorId: resetToken.userId, entity: "User", entityId: resetToken.userId, action: "PASSWORD_RESET_COMPLETE" } })
    ]);
    res.json({ message: "Senha redefinida com sucesso. Entre novamente." });
  })
);

authRouter.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.sub },
      select: { id: true, name: true, email: true, role: true, avatarUrl: true, timezone: true, theme: true }
    });
    res.json({ user });
  })
);
