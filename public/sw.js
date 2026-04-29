/* eslint-disable no-restricted-globals */
/** Service Worker — Web Push להתראות דואר נכנס WhatsApp */
self.addEventListener("push", (event) => {
  let payload = {
    title: "דואר נכנס WhatsApp",
    body: "התקבלה הודעה חדשה",
    url: "/admin/whatsapp-inbox",
  };
  if (event.data) {
    try {
      const j = event.data.json();
      payload = { ...payload, ...j };
    } catch {
      const t = event.data.text();
      if (t) payload.body = t.slice(0, 200);
    }
  }
  const path = typeof payload.url === "string" ? payload.url : "/admin/whatsapp-inbox";
  const openUrl = new URL(path, self.location.origin).href;

  event.waitUntil(
    self.registration.showNotification(payload.title || "דואר נכנס", {
      body: payload.body || "",
      icon: "/icon-192.png",
      image: "/icon-512.png",
      badge: "/notification-badge.png",
      tag: "whatsapp-inbox",
      renotify: true,
      data: { url: openUrl },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const raw = event.notification.data && event.notification.data.url;
  const path =
    typeof raw === "string" && raw.startsWith("http")
      ? raw
      : new URL("/admin/whatsapp-inbox", self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.startsWith(self.location.origin) && "focus" in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(path);
    })
  );
});
