self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

/*
 * Handler "fetch" volutamente minimale (pass-through in rete, nessuna
 * cache): non serve funzionalità offline, ma Chrome/Android richiede un
 * service worker con un handler "fetch" NON no-op per considerare il
 * sito installabile e far scattare l'evento "beforeinstallprompt" (senza
 * questo handler la voce di menu "Scarica app" mostrava sempre le
 * istruzioni manuali di fallback, perché il browser non emetteva mai
 * l'evento da intercettare).
 */
self.addEventListener("fetch", (event) => {
  event.respondWith(fetch(event.request));
});

self.addEventListener("push", (event) => {
  let data = {
    title: "Nuova comunicazione",
    body: "Hai ricevuto una nuova comunicazione.",
    url: "/comunicazioni",
  };

  if (event.data) {
    try {
      data = {
        ...data,
        ...event.data.json(),
      };
    } catch {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    data: {
      url: data.url || "/comunicazioni",
    },
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const urlToOpen = event.notification.data?.url || "/comunicazioni";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes(urlToOpen) && "focus" in client) {
          return client.focus();
        }
      }

      if (self.clients.openWindow) {
        return self.clients.openWindow(urlToOpen);
      }
    })
  );
});