self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let payload = { title: "Agenda OrganizaÍ", body: "Você tem um novo lembrete.", url: "/", tag: "agenda-organizai" };
  try {
    payload = { ...payload, ...event.data.json() };
  } catch {
    // Mantém o texto padrão quando o provedor não enviar JSON.
  }
  event.waitUntil(self.registration.showNotification(payload.title, {
    body: payload.body,
    icon: "/favicon.svg",
    badge: "/favicon.svg",
    tag: payload.tag,
    renotify: true,
    data: { url: payload.url }
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/";
  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
    const existing = windows.find((client) => client.url.startsWith(self.location.origin));
    if (existing) {
      existing.navigate(targetUrl);
      return existing.focus();
    }
    return self.clients.openWindow(targetUrl);
  }));
});
