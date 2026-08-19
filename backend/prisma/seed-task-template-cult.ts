import { PrismaClient } from "@prisma/client";
import {
  cultTaskTemplate,
  cultTaskTemplateEmails,
} from "./task-template-cult-data.js";

const prisma = new PrismaClient();

try {
  const users = await prisma.user.findMany({
    where: { email: { in: [...cultTaskTemplateEmails] }, isActive: true },
    select: { id: true, email: true },
  });
  const missing = cultTaskTemplateEmails.filter(
    (email) => !users.some((user) => user.email === email),
  );
  if (missing.length)
    throw new Error(
      `Usuários não encontrados ou inativos: ${missing.join(", ")}`,
    );

  for (const user of users) {
    await prisma.$transaction(async (transaction) => {
      const template = await transaction.taskTemplate.upsert({
        where: {
          ownerId_name: { ownerId: user.id, name: cultTaskTemplate.name },
        },
        create: {
          ownerId: user.id,
          name: cultTaskTemplate.name,
          title: cultTaskTemplate.title,
          summary: cultTaskTemplate.summary,
          description: cultTaskTemplate.description,
          color: cultTaskTemplate.color,
          icon: cultTaskTemplate.icon,
        },
        update: {
          title: cultTaskTemplate.title,
          summary: cultTaskTemplate.summary,
          description: cultTaskTemplate.description,
          color: cultTaskTemplate.color,
          icon: cultTaskTemplate.icon,
          isActive: true,
        },
      });
      await transaction.taskTemplateItem.deleteMany({
        where: { templateId: template.id },
      });
      await transaction.taskTemplateItem.createMany({
        data: cultTaskTemplate.items.map((title, sortOrder) => ({
          templateId: template.id,
          title,
          sortOrder,
        })),
      });
    });
  }
  console.log(
    `Template aplicado a ${users.length} usuários com ${cultTaskTemplate.items.length} itens.`,
  );
} finally {
  await prisma.$disconnect();
}
