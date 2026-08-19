import webpush from "web-push";
import { prisma } from "../config/prisma.js";
import { env } from "../config/env.js";

let running = false;

function reminderLabel(minutes: number) {
  if (minutes === 1440) return "amanhã";
  if (minutes === 720) return "em 12 horas";
  if (minutes === 5) return "em 5 minutos";
  return `em ${minutes} minutos`;
}

async function processReminders() {
  if (running) return;
  running = true;
  try {
    const now = new Date();
    const upcomingEvents = await prisma.event.findMany({
      where: { startsAt: { gt: now }, status: { notIn: ["DONE", "CANCELED"] } },
      select: { id: true, createdById: true, reminders: { select: { minutes: true, userId: true } } },
      take: 300
    });
    for (const event of upcomingEvents) {
      const existing = new Set(event.reminders.filter((item) => item.userId === event.createdById).map((item) => item.minutes));
      for (const minutes of [1440, 720, 5]) {
        if (!existing.has(minutes)) await prisma.reminder.create({ data: { eventId: event.id, userId: event.createdById, minutes, type: "SYSTEM" } });
      }
    }
    const reminders = await prisma.reminder.findMany({
      where: {
        sentAt: null,
        event: { is: { status: { notIn: ["DONE", "CANCELED"] }, startsAt: { gt: now, lte: new Date(now.getTime() + 24 * 60 * 60_000 + 60_000) } } }
      },
      include: { event: true },
      take: 100
    });
    for (const reminder of reminders) {
      if (!reminder.event) continue;
      const sendAt = reminder.event.startsAt.getTime() - reminder.minutes * 60_000;
      if (sendAt > Date.now()) continue;
      const title = `Evento ${reminderLabel(reminder.minutes)}`;
      const body = `${reminder.event.title} — ${reminder.event.startsAt.toLocaleString("pt-BR", { timeZone: "America/Porto_Velho", dateStyle: "short", timeStyle: "short" })}`;
      await prisma.notification.create({ data: { userId: reminder.userId, type: "SYSTEM", title, body } });
      if (env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY) {
        const subscriptions = await prisma.pushSubscription.findMany({ where: { userId: reminder.userId } });
        for (const subscription of subscriptions) {
          try {
            await webpush.sendNotification({ endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } }, JSON.stringify({ title, body, url: env.APP_URL, tag: `event-${reminder.event.id}-${reminder.minutes}` }));
          } catch (error) {
            const statusCode = typeof error === "object" && error && "statusCode" in error ? Number(error.statusCode) : 0;
            if (statusCode === 404 || statusCode === 410) await prisma.pushSubscription.delete({ where: { id: subscription.id } });
            else console.error("Falha ao enviar Web Push:", error);
          }
        }
      }
      await prisma.reminder.update({ where: { id: reminder.id }, data: { sentAt: new Date() } });
    }
  } catch (error) {
    console.error("Falha ao processar lembretes:", error);
  } finally {
    running = false;
  }
}

export function startReminderWorker() {
  if (env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY) webpush.setVapidDetails(env.VAPID_SUBJECT, env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY);
  void processReminders();
  return setInterval(() => void processReminders(), 60_000);
}
