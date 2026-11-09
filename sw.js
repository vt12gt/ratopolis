/* Rativa Games — PWA única do portal e dos jogos. */
const CACHE_NAME='rativa-games-shell-v1';
const APP_ASSETS=[
  './',
  './index.html',
  './manifest.webmanifest',
  './pwa/icon-192.svg',
  './pwa/icon-512.svg',
  './RativaSnack/Index.html',
  './RativaSnack/Offline.html',
  './RativaSnack/Online.html',
  './RativaSnack/manifest.webmanifest',
  './RativaSnack/icon-192.png',
  './RativaSnack/icon-512.png',
  './RativaSnack/icon-maskable-512.png'
];
self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.addAll(APP_ASSETS)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('rativa-games-shell-')&&key!==CACHE_NAME).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET')return;
  const url=new URL(request.url);
  if(url.origin!==self.location.origin)return;
  if(/\/api\//i.test(url.pathname))return;
  event.respondWith((async()=>{
    const cache=await caches.open(CACHE_NAME);
    const cached=await cache.match(request);
    if(cached){
      if(request.mode==='navigate' && !url.pathname.includes('/RativaSnack/Offline.html')){
        fetch(request).then(response=>{if(response.ok)cache.put(request,response.clone())}).catch(()=>{});
      }
      return cached;
    }
    try{
      const response=await fetch(request);
      if(response.ok)cache.put(request,response.clone());
      return response;
    }catch(error){
      if(request.mode==='navigate')return (await cache.match('./index.html'))||Response.error();
      throw error;
    }
  })());
});