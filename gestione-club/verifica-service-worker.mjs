/*
 * Verifica del service worker senza iPhone.
 *
 *   node verifica-service-worker.mjs            -> WebKit (motore di Safari)
 *   node verifica-service-worker.mjs chromium   -> Chromium
 *   node verifica-service-worker.mjs webkit vecchio
 *
 * Il terzo argomento "vecchio" usa la versione precedente del service
 * worker (pass-through su ogni richiesta) invece di public/sw.js: serve
 * a dimostrare che il test coglie davvero il bug, non a validare il fix.
 *
 * Prerequisiti (una volta sola):
 *   npm i -D playwright
 *   npx playwright install webkit
 *
 * WebKit e' lo stesso motore di Safari su iOS: non e' identico a un
 * iPhone vero (niente "Aggiungi a Home", niente quirk di standalone
 * mode) ma la parte che si era rotta -- l'implementazione dei service
 * worker -- e' la stessa. Un iPhone reale resta la prova finale.
 */

import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { chromium, webkit } from "playwright";

const motore = (process.argv[2] || "webkit").toLowerCase();
const usaVecchio = (process.argv[3] || "").toLowerCase() === "vecchio";

const SW_VECCHIO = `
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", (event) => {
  event.respondWith(fetch(event.request));
});
`;

const PAGINA = `<!doctype html>
<html lang="it"><head><meta charset="utf-8"><title>Harness SW</title></head>
<body>
  <h1 id="titolo">Pagina applicativa</h1>
  <script>
    navigator.serviceWorker.register("/sw.js").then(() => navigator.serviceWorker.ready);
  </script>
</body></html>`;

async function creaServer() {
  const swAttuale = usaVecchio
    ? SW_VECCHIO
    : await readFile(new URL("./public/sw.js", import.meta.url), "utf8");

  const offline = await readFile(
    new URL("./public/offline.html", import.meta.url),
    "utf8"
  );

  const server = createServer(async (req, res) => {
    const url = new URL(req.url, "http://localhost");

    if (url.pathname === "/sw.js") {
      res.writeHead(200, { "Content-Type": "text/javascript" });
      return res.end(swAttuale);
    }

    if (url.pathname === "/offline.html") {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      return res.end(offline);
    }

    // Simula una Server Action: POST con corpo, risposta JSON.
    if (url.pathname === "/api/azione" && req.method === "POST") {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(
        JSON.stringify({ ok: true, ricevuto: Buffer.concat(chunks).length })
      );
    }

    // Risorsa con supporto Range, come i video degli allenamenti.
    if (url.pathname === "/media.bin") {
      const corpo = Buffer.alloc(1024, 7);
      const range = req.headers.range;

      if (range) {
        const [da, a] = range.replace("bytes=", "").split("-");
        const inizio = Number(da) || 0;
        const fine = a ? Number(a) : corpo.length - 1;

        res.writeHead(206, {
          "Content-Range": `bytes ${inizio}-${fine}/${corpo.length}`,
          "Content-Length": fine - inizio + 1,
          "Accept-Ranges": "bytes",
        });

        return res.end(corpo.subarray(inizio, fine + 1));
      }

      res.writeHead(200, { "Content-Length": corpo.length });
      return res.end(corpo);
    }

    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(PAGINA);
  });

  await new Promise((ok) => server.listen(0, "127.0.0.1", ok));

  return { server, porta: server.address().port };
}

const esiti = [];

function verifica(nome, superato, dettaglio = "") {
  esiti.push({ nome, superato, dettaglio });
  const segno = superato ? "OK  " : "FAIL";
  console.log(`${segno} ${nome}${dettaglio ? ` — ${dettaglio}` : ""}`);
}

const { server, porta } = await creaServer();
const base = `http://127.0.0.1:${porta}`;

// CHROMIUM_PATH permette di puntare a un binario gia' presente invece di
// farlo scaricare a Playwright (utile in CI o in ambienti senza rete).
const browser = await (motore === "chromium" ? chromium : webkit).launch(
  motore === "chromium" && process.env.CHROMIUM_PATH
    ? { executablePath: process.env.CHROMIUM_PATH }
    : {}
);
const context = await browser.newContext({ serviceWorkers: "allow" });
const page = await context.newPage();

console.log(
  `\nMotore: ${motore} | service worker: ${usaVecchio ? "VECCHIO (pass-through)" : "public/sw.js"}\n`
);

try {
  await page.goto(base, { waitUntil: "load" });

  // 1. Il service worker prende il controllo della pagina.
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, {
    timeout: 15000,
  });

  verifica("Il service worker controlla la pagina", true);

  // 2. POST con corpo (le Server Actions del gestionale).
  const risultatoPost = await page.evaluate(async (url) => {
    try {
      const risposta = await fetch(url, {
        method: "POST",
        body: JSON.stringify({ campo: "valore" }),
        headers: { "Content-Type": "application/json" },
      });

      return { ok: risposta.ok, dati: await risposta.json() };
    } catch (errore) {
      return { ok: false, errore: String(errore) };
    }
  }, `${base}/api/azione`);

  verifica(
    "POST con corpo (Server Action)",
    risultatoPost.ok === true,
    risultatoPost.errore || ""
  );

  // 3. Richiesta con header Range (video e allegati).
  const risultatoRange = await page.evaluate(async (url) => {
    try {
      const risposta = await fetch(url, { headers: { Range: "bytes=0-99" } });
      return { stato: risposta.status };
    } catch (errore) {
      return { stato: 0, errore: String(errore) };
    }
  }, `${base}/media.bin`);

  verifica(
    "Richiesta con header Range",
    risultatoRange.stato === 206,
    risultatoRange.errore || `stato ${risultatoRange.stato}`
  );

  // 4. Navigazione offline: e' il caso che su iPhone produceva
  //    "FetchEvent.respondWith received an error: TypeError: Load failed".
  await context.setOffline(true);

  let erroreNavigazione = null;

  try {
    await page.reload({ waitUntil: "load", timeout: 15000 });
  } catch (errore) {
    erroreNavigazione = String(errore).split("\n")[0];
  }

  const testoOffline = erroreNavigazione
    ? ""
    : await page.evaluate(() => document.body.innerText);

  verifica(
    "Navigazione offline gestita (nessun errore di pagina)",
    !erroreNavigazione && /offline/i.test(testoOffline),
    erroreNavigazione || testoOffline.slice(0, 60).replace(/\s+/g, " ")
  );

  await context.setOffline(false);
} catch (errore) {
  verifica("Esecuzione del test", false, String(errore).split("\n")[0]);
} finally {
  await browser.close();
  server.close();
}

const falliti = esiti.filter((esito) => !esito.superato);

console.log(
  `\n${esiti.length - falliti.length}/${esiti.length} verifiche superate.\n`
);

process.exit(falliti.length > 0 ? 1 : 0);
