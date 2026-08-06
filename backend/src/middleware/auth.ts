import type { NextFunction, Request, Response } from "express";
import { verifyAccessToken, type TokenPayload } from "../utils/tokens.js";

declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;

  if (!token) {
    return res.status(401).json({ message: "Autenticacao obrigatoria." });
  }

  try {
    req.user = verifyAccessToken(token);
    return next();
  } catch {
    return res.status(401).json({ message: "Token invalido ou expirado." });
  }
}
