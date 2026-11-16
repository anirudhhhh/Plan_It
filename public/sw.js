// Cache only the public shell; never cache API responses, accounts or trip data.
const CACHE='plan-it-shell-v5';
self.addEventListener('install',e=>{self.skipWaiting();e.waitUntil(caches.open(CACHE).then(c=>c.addAll(['/styles.css','/app.js?v=production-v5','/whatsapp.js','/workflows.js','/captcha.js','/assets/mark.svg','/assets/weekend.webp'])));});
self.addEventListener('activate',e=>e.waitUntil(Promise.all([self.clients.claim(),caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))])));
self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(e.request.method!=='GET'||u.origin!==self.location.origin||!['/styles.css','/app.js','/whatsapp.js','/workflows.js','/captcha.js','/assets/mark.svg','/assets/weekend.webp'].includes(u.pathname))return;e.respondWith(fetch(e.request,{cache:'no-cache'}).catch(()=>caches.match(e.request,{ignoreSearch:true})));});
