/**
 * Service Worker de Capataz
 *
 * Estrategias de caché:
 *
 * 1. PRECACHÉ (install): Se almacenan en caché los recursos del shell de la app:
 *    /, /hoy, /offline.html y /manifest.json. Así la app arranca sin red.
 *
 * 2. HTML (navegaciones): Network-first con timeout de 3 segundos.
 *    Si la red responde a tiempo, se sirve y se actualiza el caché.
 *    Si la red tarda o falla, se sirve desde caché.
 *    Último recurso: /offline.html.
 *
 * 3. /api/hoy/* (GET): Stale-while-revalidate.
 *    Se sirve desde caché inmediatamente y en paralelo se actualiza el caché
 *    con la respuesta de red. Así el usuario ve datos rápido aunque algo desactualizados.
 *
 * 4. /api/feedback (POST): Si hay red, se envía normalmente.
 *    Si no hay red, se guarda en la cola IndexedDB "capataz-feedback-queue"
 *    y se responde con 202 Accepted + { "encolado": true }.
 *    La cola se reintenta al recuperar conexión (evento sync).
 *
 * 5. activate: Se eliminan versiones antiguas del caché para liberar espacio.
 */

const CACHE_VERSION = "capataz-v1";
const PRECACHE_URLS = ["/", "/hoy", "/offline.html", "/manifest.json"];
const IDB_DB_NAME = "capataz-pwa";
const IDB_STORE_NAME = "capataz-feedback-queue";
const SYNC_TAG = "capataz-feedback-sync";
const NETWORK_TIMEOUT_MS = 3000;

// ---------------------------------------------------------------------------
// Helpers IndexedDB
// ---------------------------------------------------------------------------

function abrirDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_DB_NAME, 1);
    req.onupgradeneeded = (e) => {
      e.target.result.createObjectStore(IDB_STORE_NAME, {
        autoIncrement: true,
      });
    };
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = (e) => reject(e.target.error);
  });
}

async function encolarEnIDB(item) {
  const db = await abrirDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE_NAME, "readwrite");
    tx.objectStore(IDB_STORE_NAME).add(item);
    tx.oncomplete = () => resolve();
    tx.onerror = (e) => reject(e.target.error);
  });
}

async function leerColaIDB() {
  const db = await abrirDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE_NAME, "readonly");
    const req = tx.objectStore(IDB_STORE_NAME).getAll();
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = (e) => reject(e.target.error);
  });
}

async function vaciarColaIDB() {
  const db = await abrirDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE_NAME, "readwrite");
    tx.objectStore(IDB_STORE_NAME).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = (e) => reject(e.target.error);
  });
}

// ---------------------------------------------------------------------------
// install: precaché del shell
// ---------------------------------------------------------------------------

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

// ---------------------------------------------------------------------------
// activate: limpiar cachés antiguas
// ---------------------------------------------------------------------------

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_VERSION)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

// ---------------------------------------------------------------------------
// fetch
// ---------------------------------------------------------------------------

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // POST /api/feedback → cola offline
  if (
    request.method === "POST" &&
    url.pathname === "/api/feedback"
  ) {
    event.respondWith(handleFeedbackPost(request));
    return;
  }

  // GET /api/hoy/* → stale-while-revalidate
  if (request.method === "GET" && url.pathname.startsWith("/api/hoy/")) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  // Navegaciones HTML → network-first con timeout
  if (request.mode === "navigate") {
    event.respondWith(networkFirstWithTimeout(request));
    return;
  }
});

// ---------------------------------------------------------------------------
// Estrategia: network-first con timeout de 3 s
// ---------------------------------------------------------------------------

async function networkFirstWithTimeout(request) {
  const cache = await caches.open(CACHE_VERSION);

  const networkPromise = fetch(request).then((response) => {
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  });

  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error("timeout")), NETWORK_TIMEOUT_MS)
  );

  try {
    return await Promise.race([networkPromise, timeoutPromise]);
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    const offline = await cache.match("/offline.html");
    return offline || new Response("Sin conexión", { status: 503 });
  }
}

// ---------------------------------------------------------------------------
// Estrategia: stale-while-revalidate
// ---------------------------------------------------------------------------

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_VERSION);
  const cached = await cache.match(request);

  const networkFetch = fetch(request).then((response) => {
    if (response.ok) cache.put(request, response.clone());
    return response;
  });

  return cached || networkFetch;
}

// ---------------------------------------------------------------------------
// POST /api/feedback: intento de red, si falla → encolar
// ---------------------------------------------------------------------------

async function handleFeedbackPost(request) {
  try {
    const response = await fetch(request.clone());
    return response;
  } catch {
    // Sin red: serializar body y guardar en cola
    let body = null;
    try {
      body = await request.json();
    } catch {
      body = await request.text();
    }
    await encolarEnIDB({ url: request.url, body, timestamp: Date.now() });

    // Registrar sync para reintentar cuando vuelva la red
    if (self.registration && self.registration.sync) {
      await self.registration.sync.register(SYNC_TAG).catch(() => {});
    }

    return new Response(JSON.stringify({ encolado: true }), {
      status: 202,
      headers: { "Content-Type": "application/json" },
    });
  }
}

// ---------------------------------------------------------------------------
// sync: reproducir cola de feedback
// ---------------------------------------------------------------------------

self.addEventListener("sync", (event) => {
  if (event.tag === SYNC_TAG) {
    event.waitUntil(reproducirCola());
  }
});

async function reproducirCola() {
  const items = await leerColaIDB();
  if (!items.length) return;

  const resultados = await Promise.allSettled(
    items.map((item) =>
      fetch(item.url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(item.body),
      })
    )
  );

  const todosOk = resultados.every(
    (r) => r.status === "fulfilled" && r.value.ok
  );
  if (todosOk) {
    await vaciarColaIDB();
  }
}
