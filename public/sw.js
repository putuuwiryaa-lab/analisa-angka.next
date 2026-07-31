self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) => Promise.all(names.map((name) => caches.delete(name))))
      .then(() => self.clients.claim()),
  );
});

// Service worker ini sengaja tidak menangani fetch.
// Semua navigasi dan aset selalu memakai jaringan agar cache aplikasi lama
// dari sebelum migrasi tidak pernah ditampilkan kembali.
