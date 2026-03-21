const CACHE_NAME = "pedidos-v3";

const archivos = [
  "./",
  "./index.html",
  "./manifest.json",
  "./script.js",
  "./style.css"
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(archivos))
  );
});

// Activación (Borra cachés viejos)
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
});

// Estrategia de red: primero intenta red, si falla, usa caché
self.addEventListener('fetch', (e) => {
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  );
});


/*
self.addEventListener("fetch", (event) => {

  if (event.request.method === "POST") {
    event.respondWith(
      (async () => {

        const formData = await event.request.formData();
        const file = formData.get("archivo");

        const cache = await caches.open("shared-file");
        await cache.put("ultimo-archivo", new Response(file));

        return Response.redirect("./index.html");

      })()
    );

    return;
  }

  event.respondWith(
    caches.match(event.request).then((resp) => {
      return resp || fetch(event.request);
    })
  );
});
/*



/*
const CACHE = "pedidos-v1";

const archivos = ["./", "./index.html", "./manifest.json"];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((cache) => {
      return cache.addAll(archivos);
    }),
  );
});

self.addEventListener("fetch", (e) => {
  e.respondWith(
    caches.match(e.request).then((resp) => {
      return resp || fetch(e.request);
    }),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method === "POST") {
    event.respondWith(
      (async () => {
        const formData = await event.request.formData();
        const file = formData.get("archivo");

        const cache = await caches.open("shared-file");
        await cache.put("ultimo-archivo", new Response(file));

        return Response.redirect("./index.html");
      })(),
    );
  }
});
*/