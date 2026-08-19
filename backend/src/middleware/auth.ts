import type { NextFunction, Request, Response } from "express";
import { verifyAccessToken, type TokenPayload } from "../utils/tokens.js";
import { prisma } from "../config/prisma.js";

declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload;
    }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;

  if (!token) {
    return res.status(401).json({ message: "Autenticacao obrigatoria." });
  }

  try {
    const payload = verifyAccessToken(token);
    const user = await prisma.user.findUnique({ where: { id: payload.sub }, select: { id: true, email: true, role: true, isActive: true } });
    if (!user?.isActive) return res.status(401).json({ message: "Conta desativada. Procure o administrador." });
    req.user = { ...payload, email: user.email, role: user.role };
    return next();
  } catch {
    return res.status(401).json({ message: "Token invalido ou expirado." });
  }
}
