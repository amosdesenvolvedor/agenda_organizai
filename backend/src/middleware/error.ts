import { Prisma } from "@prisma/client";
import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    return res.status(422).json({ message: "Dados invalidos.", issues: err.flatten() });
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
    return res.status(409).json({ message: "Registro duplicado.", target: err.meta?.target });
  }

  console.error(err);
  return res.status(500).json({ message: "Erro interno do servidor." });
};
