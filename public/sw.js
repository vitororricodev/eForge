const CACHE='eforge-shell-v4';
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(['/brand/eforge-mark.svg','/offline.html','/manifest.webmanifest','/icon-192.png','/icon-512.png','/fonts/forega-sport-demo.ttf']))));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('eforge-shell-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('message',e=>{if(e.data==='SKIP_WAITING')self.skipWaiting()});
self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(e.request.method!=='GET'||u.origin!==self.location.origin)return;
// API/auth responses are never cached. Dashboard SSR is a loading shell only.
if((u.pathname.startsWith('/assets/') || u.pathname.startsWith('/fonts/')))e.respondWith(caches.open(CACHE).then(async c=>{const hit=await c.match(e.request);if(hit)return hit;const r=await fetch(e.request);if(r.ok)c.put(e.request,r.clone());return r}));
else if(e.request.mode==='navigate')e.respondWith(fetch(e.request).then(async r=>{if(u.pathname==='/dashboard'&&r.ok){const c=await caches.open(CACHE);await c.put('/app-shell',r.clone())}return r}).catch(async()=>await caches.match('/app-shell')||await caches.match('/offline.html')));
});
