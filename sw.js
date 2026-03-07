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
