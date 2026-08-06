import { Resend } from "resend";
import { env } from "../config/env.js";
import { prisma } from "../config/prisma.js";

type EmailInput = { to: string; subject: string; html: string };

function client() {
  if (env.EMAIL_PROVIDER !== "resend" || !env.RESEND_API_KEY) {
    throw new Error("O provedor Resend não está configurado.");
  }
  return new Resend(env.RESEND_API_KEY);
}

export async function enqueueEmail(input: EmailInput) {
  if (!env.MAIL_FROM) throw new Error("MAIL_FROM não está configurado.");
  const delivery = await prisma.emailDelivery.create({
    data: { ...input, from: env.MAIL_FROM }
  });
  void processEmailDelivery(delivery.id);
  return delivery;
}

export async function processEmailDelivery(id: string) {
  const delivery = await prisma.emailDelivery.findUnique({ where: { id } });
  if (!delivery || delivery.status === "SENT" || delivery.attempts >= delivery.maxAttempts) return;

  await prisma.emailDelivery.update({ where: { id }, data: { status: "PROCESSING", attempts: { increment: 1 } } });
  try {
    const result = await client().emails.send({
      from: delivery.from,
      to: delivery.to,
      subject: delivery.subject,
      html: delivery.html
    });
    if (result.error) throw new Error(result.error.message);
    await prisma.emailDelivery.update({
      where: { id },
      data: { status: "SENT", providerMessageId: result.data?.id, sentAt: new Date(), lastError: null }
    });
  } catch (error) {
    const attempts = delivery.attempts + 1;
    const failed = attempts >= delivery.maxAttempts;
    await prisma.emailDelivery.update({
      where: { id },
      data: {
        status: "FAILED",
        lastError: error instanceof Error ? error.message.slice(0, 4000) : "Falha desconhecida",
        nextAttemptAt: new Date(Date.now() + Math.min(30, 2 ** attempts) * 60_000)
      }
    });
    if (!failed) return;
  }
}

export function startEmailWorker() {
  const run = async () => {
    const pending = await prisma.emailDelivery.findMany({
      where: { status: { in: ["PENDING", "FAILED"] }, nextAttemptAt: { lte: new Date() }, attempts: { lt: 3 } },
      take: 20,
      orderBy: { createdAt: "asc" }
    });
    await Promise.allSettled(pending.map((item) => processEmailDelivery(item.id)));
  };
  void run();
  const timer = setInterval(() => void run(), 60_000);
  timer.unref();
}

export function testEmailTemplate() {
  return `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:32px;border:1px solid #e2e8f0;border-radius:12px"><h1 style="color:#0f172a">Agenda OrganizaÍ</h1><p style="color:#334155;line-height:1.6">A integração com o Resend está funcionando corretamente.</p><p style="color:#64748b;font-size:13px">Este é um envio transacional de validação.</p></div>`;
}
