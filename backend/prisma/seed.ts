import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("AgendaOrganizai@123", Number(process.env.BCRYPT_ROUNDS ?? 12));

  const admin = await prisma.user.upsert({
    where: { email: "admin@agendaorganizai.local" },
    update: {
      name: "admin",
      passwordHash,
      role: "ADMIN",
      emailVerifiedAt: new Date()
    },
    create: {
      name: "admin",
      email: "admin@agendaorganizai.local",
      passwordHash,
      role: "ADMIN",
      emailVerifiedAt: new Date(),
      settings: { create: {} },
      colorPresets: {
        createMany: {
          data: [
            { name: "Azul", value: "#2563eb" },
            { name: "Verde", value: "#16a34a" },
            { name: "Rosa", value: "#db2777" },
            { name: "Amarelo", value: "#ca8a04" }
          ]
        }
      }
    }
  });

  const calendar = await prisma.calendar.upsert({
    where: { id: "seed-main-calendar" },
    update: {},
    create: {
      id: "seed-main-calendar",
      name: "Agenda principal",
      color: "#2563eb",
      isDefault: true,
      ownerId: admin.id,
      categories: {
        createMany: {
          data: [
            { name: "Pessoal", color: "#2563eb", ownerId: admin.id },
            { name: "Trabalho", color: "#16a34a", ownerId: admin.id },
            { name: "Financeiro", color: "#ca8a04", ownerId: admin.id },
            { name: "Saude", color: "#dc2626", ownerId: admin.id },
            { name: "Estudos", color: "#7c3aed", ownerId: admin.id }
          ]
        }
      }
    }
  });

  await prisma.event.upsert({
    where: { id: "seed-kickoff-event" },
    update: {},
    create: {
      id: "seed-kickoff-event",
      calendarId: calendar.id,
      createdById: admin.id,
      title: "Reuniao de planejamento",
      description: "Definir prioridades da semana.",
      startsAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      endsAt: new Date(Date.now() + 25 * 60 * 60 * 1000),
      priority: "HIGH",
      status: "CONFIRMED",
      visibility: "SHARED",
      tags: "planejamento,reuniao"
    }
  });

  await prisma.task.upsert({
    where: { id: "seed-task-backup" },
    update: {},
    create: {
      id: "seed-task-backup",
      ownerId: admin.id,
      title: "Configurar backup automatico",
      priority: "HIGH",
      progress: 40,
      dueAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
    }
  });

  const welcomeNotification = await prisma.notification.findFirst({
    where: { userId: admin.id, title: "Bem-vindo ao Agenda OrganizaÍ" }
  });

  if (!welcomeNotification) {
    await prisma.notification.create({
      data: {
      userId: admin.id,
      title: "Bem-vindo ao Agenda OrganizaÍ",
      body: "Sua agenda inicial foi criada com categorias e dados de exemplo."
      }
    });
  }

  console.log("Usuário de teste pronto: admin@agendaorganizai.local");
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
