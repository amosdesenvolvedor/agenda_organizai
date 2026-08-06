import { z } from "zod";

// O banco usa CUIDs gerados pelo Prisma e IDs estáveis criados pelo seed.
export const entityIdSchema = z.string().trim().min(1).max(191);
