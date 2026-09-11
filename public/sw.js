// Service worker ของ ISSA Apparel Inventory
// เจตนาออกแบบ: แคชเฉพาะไฟล์ static ของ Next.js (JS/CSS ที่มี hash ไม่เปลี่ยนแปลง) เพื่อให้เปิดแอปได้เร็วขึ้น
// ห้ามแคชหน้าเว็บ/ข้อมูลจาก Supabase หรือ API ใด ๆ เด็ดขาด เพราะเป็นระบบสต็อกสินค้าที่ต้องเห็นข้อมูลล่าสุดเสมอ
// (ถ้าแคชข้อมูลสต็อก/ยอดขายค้างไว้ อาจเห็นตัวเลขผิดจนขายเกินสต็อกจริงได้)
const STATIC_CACHE = "issa-static-v1";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== STATIC_CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (!url.pathname.startsWith("/_next/static/")) return;

  event.respondWith(
    caches.open(STATIC_CACHE).then(async (cache) => {
      const cached = await cache.match(request);
      if (cached) return cached;
      const response = await fetch(request);
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
  );
});
