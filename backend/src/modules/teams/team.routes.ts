import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../config/prisma.js";
import { requireAuth } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { entityIdSchema } from "../../utils/schemas.js";

export const teamRouter = Router();
teamRouter.use(requireAuth);

const teamBody = z.object({
  name: z.string().trim().min(1, "Informe o nome da equipe.").max(120),
  description: z.string().trim().max(500).nullable().optional()
});
const teamIdSchema = z.object({ params: z.object({ id: entityIdSchema }) });

const teamInclude = {
  members: {
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: "asc" as const }
  }
};

async function getMembership(teamId: string, userId: string) {
  return prisma.teamMember.findUnique({ where: { teamId_userId: { teamId, userId } } });
}

teamRouter.get("/", asyncHandler(async (req, res) => {
  const teams = await prisma.team.findMany({
    where: { members: { some: { userId: req.user!.sub } } },
    include: teamInclude,
    orderBy: { name: "asc" }
  });
  res.json({ teams });
}));

teamRouter.post("/", validate(z.object({ body: teamBody })), asyncHandler(async (req, res) => {
  const team = await prisma.team.create({
    data: {
      name: req.body.name,
      description: req.body.description || null,
      members: { create: { userId: req.user!.sub, role: "ADMIN" } }
    },
    include: teamInclude
  });
  await prisma.auditLog.create({ data: { actorId: req.user!.sub, entity: "Team", entityId: team.id, action: "CREATE", newValue: JSON.parse(JSON.stringify(team)) } });
  res.status(201).json({ team });
}));

teamRouter.patch("/:id", validate(teamIdSchema.merge(z.object({ body: teamBody.partial() }))), asyncHandler(async (req, res) => {
  const membership = await getMembership(req.params.id, req.user!.sub);
  if (!membership) return res.status(404).json({ message: "Equipe não encontrada." });
  if (membership.role !== "ADMIN") return res.status(403).json({ message: "Somente administradores podem editar a equipe." });
  const previous = await prisma.team.findUnique({ where: { id: req.params.id } });
  const team = await prisma.team.update({ where: { id: req.params.id }, data: req.body, include: teamInclude });
  await prisma.auditLog.create({ data: { actorId: req.user!.sub, entity: "Team", entityId: team.id, action: "UPDATE", oldValue: JSON.parse(JSON.stringify(previous)), newValue: JSON.parse(JSON.stringify(team)) } });
  res.json({ team });
}));

teamRouter.post("/:id/members", validate(teamIdSchema.merge(z.object({ body: z.object({ email: z.string().trim().email().max(180) }) }))), asyncHandler(async (req, res) => {
  const membership = await getMembership(req.params.id, req.user!.sub);
  if (!membership) return res.status(404).json({ message: "Equipe não encontrada." });
  if (membership.role !== "ADMIN") return res.status(403).json({ message: "Somente administradores podem adicionar integrantes." });
  const user = await prisma.user.findUnique({ where: { email: req.body.email.toLowerCase() } });
  if (!user) return res.status(404).json({ message: "Nenhum usuário cadastrado com este e-mail." });
  const existing = await getMembership(req.params.id, user.id);
  if (existing) return res.status(409).json({ message: "Este usuário já integra a equipe." });
  await prisma.teamMember.create({ data: { teamId: req.params.id, userId: user.id, role: "USER" } });
  const team = await prisma.team.findUniqueOrThrow({ where: { id: req.params.id }, include: teamInclude });
  res.status(201).json({ team });
}));

teamRouter.delete("/:id/members/:userId", validate(z.object({ params: z.object({ id: entityIdSchema, userId: entityIdSchema }) })), asyncHandler(async (req, res) => {
  const membership = await getMembership(req.params.id, req.user!.sub);
  if (!membership) return res.status(404).json({ message: "Equipe não encontrada." });
  if (membership.role !== "ADMIN") return res.status(403).json({ message: "Somente administradores podem remover integrantes." });
  if (req.params.userId === req.user!.sub) return res.status(422).json({ message: "Para remover sua própria equipe, use Desfazer equipe." });
  const removed = await prisma.teamMember.deleteMany({ where: { teamId: req.params.id, userId: req.params.userId } });
  if (!removed.count) return res.status(404).json({ message: "Integrante não encontrado." });
  res.status(204).send();
}));

teamRouter.delete("/:id", validate(teamIdSchema), asyncHandler(async (req, res) => {
  const membership = await getMembership(req.params.id, req.user!.sub);
  if (!membership) return res.status(404).json({ message: "Equipe não encontrada." });
  if (membership.role === "ADMIN") {
    const team = await prisma.team.delete({ where: { id: req.params.id } });
    await prisma.auditLog.create({ data: { actorId: req.user!.sub, entity: "Team", entityId: team.id, action: "DELETE", oldValue: JSON.parse(JSON.stringify(team)) } });
  } else {
    await prisma.teamMember.delete({ where: { teamId_userId: { teamId: req.params.id, userId: req.user!.sub } } });
  }
  res.status(204).send();
}));
