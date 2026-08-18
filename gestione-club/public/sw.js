/*
 * Service worker del gestionale.
 *
 * ATTENZIONE alla versione precedente: il fetch handler era
 *
 *     self.addEventListener("fetch", (event) => {
 *       event.respondWith(fetch(event.request));
 *     });
 *
 * cioe' un pass-through su OGNI richiesta. Su Safari/iOS questo rompe
 * l'app con "FetchEvent.respondWith received an error: TypeError: Load
 * failed": una volta che si chiama respondWith, il browser non puo' piu'
 * gestire la richiesta per conto suo, e qualunque cosa che fetch() non
 * sappia rifare identica (POST delle Server Actions, richieste con
 * header Range dei video, redirect di navigazione, risorse cross-origin,
 * un singolo hiccup di rete) diventa un errore fatale di pagina invece
 * di un normale fallimento gestito dal browser.
 *
 * Qui si intercettano soltanto le NAVIGAZIONI (GET, same-origin): rete
 * prima, e se la rete non c'e' si mostra /offline.html. Tutto il resto
 * non viene toccato: niente respondWith, se ne occupa il browser.
 *
 * Serve comunque un handler "fetch" vero e non un no-op, altrimenti
 * Chrome/Android non considera il sito installabile e non emette
 * "beforeinstallprompt" (era il motivo per cui la voce "Scarica app"
 * mostrava sempre le istruzioni manuali di fallback). Rispondere alle
 * navigazioni offline soddisfa il requisito.
 */

const CACHE_VERSION = "gestione-club-v1";
const OFFLINE_URL = "/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_VERSION);

      // reload: la pagina offline non deve mai arrivare dalla cache HTTP
      // del browser, altrimenti si aggiorna solo a scadenza.
      await cache.add(new Request(OFFLINE_URL, { cache: "reload" }));
    })()
  );

  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Pulizia delle cache delle versioni precedenti.
      const chiavi = await caches.keys();

      await Promise.all(
        chiavi
          .filter((chiave) => chiave !== CACHE_VERSION)
          .map((chiave) => caches.delete(chiave))
      );

      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;

  // Solo navigazioni: tutto il resto (API, Server Actions, immagini,
  // video, font, richieste cross-origin) va lasciato al browser.
  if (request.mode !== "navigate" || request.method !== "GET") {
    return;
  }

  event.respondWith(
    (async () => {
      try {
        return await fetch(request);
      } catch {
        const cache = await caches.open(CACHE_VERSION);
        const offline = await cache.match(OFFLINE_URL);

        // Se anche la pagina offline manca, meglio un errore di rete
        // pulito che una promise rifiutata.
        return (
          offline ??
          new Response("Connessione assente.", {
            status: 503,
            headers: { "Content-Type": "text/plain; charset=utf-8" },
          })
        );
      }
    })()
  );
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
