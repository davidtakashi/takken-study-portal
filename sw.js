// data refresh 2026-09-12 LEC exact courses
const CACHE = 'takken-v20260910-resource-clean3';
const STATIC = ['./','./index.html','./manifest.webmanifest','./icons/icon-192.png','./icons/icon-512.png'];
self.addEventListener('install', e => { self.skipWaiting(); e.waitUntil(caches.open(CACHE).then(c=>c.addAll(STATIC))); });
self.addEventListener('activate', e => { e.waitUntil((async()=>{ for (const k of await caches.keys()) if(k!==CACHE) await caches.delete(k); await self.clients.claim(); })()); });
self.addEventListener('fetch', e => {
  if(e.request.method!=='GET') return;
  const u=new URL(e.request.url);
  const isFresh = /\/(app\.js|styles\.css)$/.test(u.pathname) || u.pathname.includes('/data/');
  if(isFresh){
    e.respondWith(fetch(e.request,{cache:'no-store'}).catch(()=>caches.match(e.request)));
    return;
  }
  e.respondWith(fetch(e.request).then(r=>{const copy=r.clone(); caches.open(CACHE).then(c=>c.put(e.request,copy)); return r;}).catch(()=>caches.match(e.request)));
});
