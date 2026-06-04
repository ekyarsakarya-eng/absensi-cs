const CACHE='absensi-v17';
const FILES=['./','./index.html','./app.js','./manifest.json','./icon-192.png','./icon-512.png','./icon-absensi.png','./icon-rekap.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)))});
self.addEventListener('fetch',e=>{e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request)))});
