import { Router } from "express";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import path from "node:path";
import multer from "multer";
import { prisma } from "../../config/prisma.js";
import { requireAuth } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { hashPassword, verifyPassword } from "../../utils/password.js";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../../utils/tokens.js";
import { forgotPasswordSchema, loginSchema, oauthExchangeSchema, refreshSchema, registerSchema, resetPasswordSchema, updateProfileSchema } from "./auth.schemas.js";
import { enqueueEmail } from "../../services/email.service.js";
import { env } from "../../config/env.js";

export const authRouter = Router();

const avatarUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, callback) => { const destination = "uploads/avatars"; mkdirSync(destination, { recursive: true }); callback(null, destination); },
    filename: (req, file, callback) => callback(null, `${req.user!.sub}-${randomUUID()}${path.extname(file.originalname).toLowerCase()}`)
  }),
  limits: { fileSize: 3 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => callback(null, ["image/jpeg", "image/png", "image/webp"].includes(file.mimetype))
});

const googleCallbackUrl = `${env.APP_URL}/api/auth/oauth/google/callback`;
const microsoftCallbackUrl = `${env.APP_URL}/api/auth/oauth/microsoft/callback`;

function oauthFailureUrl(message: string) {
  const url = new URL(env.APP_URL);
  url.searchParams.set("oauthError", message);
  return url.toString();
}

authRouter.get("/oauth/google", (_req, res) => {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    return res.redirect(oauthFailureUrl("Login com Google temporariamente indisponível."));
  }
  const state = randomBytes(32).toString("hex");
  res.cookie("agenda_google_oauth_state", state, {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 10 * 60_000,
    path: "/api/auth/oauth/google"
  });
  const authorizationUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authorizationUrl.search = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: googleCallbackUrl,
    response_type: "code",
    scope: "openid email profile",
    state,
    prompt: "select_account"
  }).toString();
  return res.redirect(authorizationUrl.toString());
});

authRouter.get("/oauth/google/callback", asyncHandler(async (req, res) => {
  const state = typeof req.query.state === "string" ? req.query.state : "";
  const code = typeof req.query.code === "string" ? req.query.code : "";
  const storedState = req.cookies.agenda_google_oauth_state as string | undefined;
  res.clearCookie("agenda_google_oauth_state", { path: "/api/auth/oauth/google" });
  if (!code || !state || !storedState || state !== storedState) {
    return res.redirect(oauthFailureUrl("Não foi possível validar o acesso com Google. Tente novamente."));
  }
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    return res.redirect(oauthFailureUrl("Login com Google temporariamente indisponível."));
  }

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri: googleCallbackUrl,
      grant_type: "authorization_code"
    })
  });
  if (!tokenResponse.ok) return res.redirect(oauthFailureUrl("O Google recusou a autenticação. Tente novamente."));
  const tokenData = await tokenResponse.json() as { access_token?: string };
  if (!tokenData.access_token) return res.redirect(oauthFailureUrl("O Google não retornou uma credencial válida."));

  const profileResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { Authorization: `Bearer ${tokenData.access_token}` }
  });
  if (!profileResponse.ok) return res.redirect(oauthFailureUrl("Não foi possível consultar seu perfil Google."));
  const profile = await profileResponse.json() as { email?: string; email_verified?: boolean; name?: string; picture?: string };
  if (!profile.email || !profile.email_verified) return res.redirect(oauthFailureUrl("Use uma conta Google com e-mail verificado."));

  const email = profile.email.toLowerCase();
  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        name: profile.name?.trim() || email.split("@")[0],
        email,
        emailVerifiedAt: new Date(),
        avatarUrl: profile.picture,
        passwordHash: await hashPassword(randomBytes(48).toString("hex")),
        settings: { create: {} },
        calendars: { create: { name: "Minha agenda", color: "#2563eb", isDefault: true } }
      }
    });
  } else if (!user.isActive) {
    return res.redirect(oauthFailureUrl("Esta conta está desativada. Procure o administrador."));
  } else if (!user.emailVerifiedAt || (!user.avatarUrl && profile.picture)) {
    user = await prisma.user.update({ where: { id: user.id }, data: { emailVerifiedAt: user.emailVerifiedAt ?? new Date(), avatarUrl: user.avatarUrl ?? profile.picture } });
  }

  const rawCode = randomBytes(32).toString("hex");
  await prisma.$transaction([
    prisma.oAuthLoginCode.deleteMany({ where: { OR: [{ expiresAt: { lte: new Date() } }, { userId: user.id, usedAt: null }] } }),
    prisma.oAuthLoginCode.create({ data: { tokenHash: createHash("sha256").update(rawCode).digest("hex"), userId: user.id, expiresAt: new Date(Date.now() + 2 * 60_000) } }),
    prisma.auditLog.create({ data: { actorId: user.id, entity: "User", entityId: user.id, action: "GOOGLE_OAUTH" } })
  ]);
  const successUrl = new URL(env.APP_URL);
  successUrl.searchParams.set("oauthCode", rawCode);
  return res.redirect(successUrl.toString());
}));

authRouter.get("/oauth/microsoft", (_req, res) => {
  if (!env.MICROSOFT_CLIENT_ID || !env.MICROSOFT_CLIENT_SECRET) {
    return res.redirect(oauthFailureUrl("Login com Microsoft temporariamente indisponível."));
  }
  const state = randomBytes(32).toString("hex");
  res.cookie("agenda_microsoft_oauth_state", state, {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 10 * 60_000,
    path: "/api/auth/oauth/microsoft"
  });
  const authorizationUrl = new URL("https://login.microsoftonline.com/common/oauth2/v2.0/authorize");
  authorizationUrl.search = new URLSearchParams({
    client_id: env.MICROSOFT_CLIENT_ID,
    redirect_uri: microsoftCallbackUrl,
    response_type: "code",
    response_mode: "query",
    scope: "openid profile email User.Read",
    state,
    prompt: "select_account"
  }).toString();
  return res.redirect(authorizationUrl.toString());
});

authRouter.get("/oauth/microsoft/callback", asyncHandler(async (req, res) => {
  const state = typeof req.query.state === "string" ? req.query.state : "";
  const code = typeof req.query.code === "string" ? req.query.code : "";
  const storedState = req.cookies.agenda_microsoft_oauth_state as string | undefined;
  res.clearCookie("agenda_microsoft_oauth_state", { path: "/api/auth/oauth/microsoft" });
  if (!code || !state || !storedState || state !== storedState) {
    return res.redirect(oauthFailureUrl("Não foi possível validar o acesso com Microsoft. Tente novamente."));
  }
  if (!env.MICROSOFT_CLIENT_ID || !env.MICROSOFT_CLIENT_SECRET) {
    return res.redirect(oauthFailureUrl("Login com Microsoft temporariamente indisponível."));
  }

  const tokenResponse = await fetch("https://login.microsoftonline.com/common/oauth2/v2.0/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: env.MICROSOFT_CLIENT_ID,
      client_secret: env.MICROSOFT_CLIENT_SECRET,
      redirect_uri: microsoftCallbackUrl,
      grant_type: "authorization_code",
      scope: "openid profile email User.Read"
    })
  });
  if (!tokenResponse.ok) return res.redirect(oauthFailureUrl("A Microsoft recusou a autenticação. Tente novamente."));
  const tokenData = await tokenResponse.json() as { access_token?: string };
  if (!tokenData.access_token) return res.redirect(oauthFailureUrl("A Microsoft não retornou uma credencial válida."));

  const profileResponse = await fetch("https://graph.microsoft.com/v1.0/me?$select=displayName,mail,userPrincipalName", {
    headers: { Authorization: `Bearer ${tokenData.access_token}` }
  });
  if (!profileResponse.ok) return res.redirect(oauthFailureUrl("Não foi possível consultar seu perfil Microsoft."));
  const profile = await profileResponse.json() as { displayName?: string; mail?: string; userPrincipalName?: string };
  const profileEmail = profile.mail || profile.userPrincipalName;
  if (!profileEmail || !profileEmail.includes("@")) return res.redirect(oauthFailureUrl("Sua conta Microsoft não forneceu um e-mail válido."));

  const email = profileEmail.toLowerCase();
  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        name: profile.displayName?.trim() || email.split("@")[0],
        email,
        emailVerifiedAt: new Date(),
        passwordHash: await hashPassword(randomBytes(48).toString("hex")),
        settings: { create: {} },
        calendars: { create: { name: "Minha agenda", color: "#2563eb", isDefault: true } }
      }
    });
  } else if (!user.isActive) {
    return res.redirect(oauthFailureUrl("Esta conta está desativada. Procure o administrador."));
  } else if (!user.emailVerifiedAt) {
    user = await prisma.user.update({ where: { id: user.id }, data: { emailVerifiedAt: new Date() } });
  }

  const rawCode = randomBytes(32).toString("hex");
  await prisma.$transaction([
    prisma.oAuthLoginCode.deleteMany({ where: { OR: [{ expiresAt: { lte: new Date() } }, { userId: user.id, usedAt: null }] } }),
    prisma.oAuthLoginCode.create({ data: { tokenHash: createHash("sha256").update(rawCode).digest("hex"), userId: user.id, expiresAt: new Date(Date.now() + 2 * 60_000) } }),
    prisma.auditLog.create({ data: { actorId: user.id, entity: "User", entityId: user.id, action: "MICROSOFT_OAUTH" } })
  ]);
  const successUrl = new URL(env.APP_URL);
  successUrl.searchParams.set("oauthCode", rawCode);
  return res.redirect(successUrl.toString());
}));

authRouter.post("/oauth/exchange", validate(oauthExchangeSchema), asyncHandler(async (req, res) => {
  const tokenHash = createHash("sha256").update(req.body.code).digest("hex");
  const loginCode = await prisma.oAuthLoginCode.findUnique({ where: { tokenHash }, include: { user: true } });
  if (!loginCode || loginCode.usedAt || loginCode.expiresAt <= new Date()) {
    return res.status(400).json({ message: "Acesso com Google inválido ou expirado. Tente novamente." });
  }
  if (!loginCode.user.isActive) return res.status(401).json({ message: "Conta desativada. Procure o administrador." });
  const payload = { sub: loginCode.user.id, email: loginCode.user.email, role: loginCode.user.role };
  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);
  await prisma.$transaction([
    prisma.oAuthLoginCode.update({ where: { id: loginCode.id }, data: { usedAt: new Date() } }),
    prisma.refreshToken.create({ data: { token: refreshToken, userId: loginCode.user.id, expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) } })
  ]);
  res.json({ accessToken, refreshToken, user: { id: loginCode.user.id, name: loginCode.user.name, email: loginCode.user.email, role: loginCode.user.role, avatarUrl: loginCode.user.avatarUrl } });
}));

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
    if (!user || !user.isActive || !(await verifyPassword(req.body.password, user.passwordHash))) {
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
    if (!storedToken.user.isActive) return res.status(401).json({ message: "Conta desativada. Procure o administrador." });

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
    if (user?.isActive) {
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
      select: { id: true, name: true, email: true, role: true, avatarUrl: true, phone: true, company: true, position: true, language: true, timezone: true, theme: true, createdAt: true, settings: true }
    });
    res.json({ user });
  })
);

authRouter.patch(
  "/me",
  requireAuth,
  validate(updateProfileSchema),
  asyncHandler(async (req, res) => {
    const previous = await prisma.user.findUnique({ where: { id: req.user!.sub }, include: { settings: true } });
    if (!previous) return res.status(404).json({ message: "Usuário não encontrado." });
    const { settings, ...profile } = req.body;
    const user = await prisma.user.update({
      where: { id: previous.id },
      data: {
        ...profile,
        settings: { upsert: { create: settings, update: settings } }
      },
      select: { id: true, name: true, email: true, role: true, avatarUrl: true, phone: true, company: true, position: true, language: true, timezone: true, theme: true, createdAt: true, settings: true }
    });
    await prisma.auditLog.create({ data: { actorId: user.id, entity: "User", entityId: user.id, action: "PROFILE_UPDATE", oldValue: JSON.parse(JSON.stringify(previous)), newValue: JSON.parse(JSON.stringify(user)) } });
    res.json({ user });
  })
);

authRouter.post("/me/avatar", requireAuth, avatarUpload.single("avatar"), asyncHandler(async (req, res) => {
  if (!req.file) return res.status(422).json({ message: "Selecione uma imagem JPEG, PNG ou WebP de até 3 MB." });
  const avatarUrl = `/api/auth/avatar/${req.user!.sub}`;
  const user = await prisma.user.update({ where: { id: req.user!.sub }, data: { avatarUrl }, select: { id: true, name: true, email: true, role: true, avatarUrl: true } });
  await prisma.auditLog.create({ data: { actorId: user.id, entity: "User", entityId: user.id, action: "AVATAR_UPDATE" } });
  res.json({ user });
}));

authRouter.get("/avatar/:userId", asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.params.userId }, select: { avatarUrl: true } });
  if (!user?.avatarUrl?.startsWith("/api/auth/avatar/")) return res.status(404).json({ message: "Foto de perfil não encontrada." });
  const avatarsDirectory = path.resolve("uploads/avatars");
  const files = await import("node:fs/promises").then(({ readdir }) => readdir(avatarsDirectory).catch(() => []));
  const userFiles = files.filter((file) => file.startsWith(`${req.params.userId}-`));
  const newest = await Promise.all(userFiles.map(async (file) => ({ file, stat: await import("node:fs/promises").then(({ stat }) => stat(path.join(avatarsDirectory, file))) })))
    .then((items) => items.sort((left, right) => right.stat.mtimeMs - left.stat.mtimeMs)[0]);
  if (!newest) return res.status(404).json({ message: "Foto de perfil não encontrada." });
  res.set("Cache-Control", "no-store");
  res.sendFile(path.join(avatarsDirectory, newest.file));
}));
