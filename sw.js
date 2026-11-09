/* Rativa Games — cache único do portal e dos jogos. */
const CACHE_NAME='rativa-games-shell-v3';
const APP_ASSETS=[
  './',
  './index.html',
  './manifest.webmanifest',
  './pwa/icon-192.svg',
  './pwa/icon-512.svg',
  './RativaSnack/Index.html',
  './RativaSnack/Offline.html',
  './RativaSnack/Online.html',
  './RativaSnack/icon-192.png',
  './RativaSnack/icon-512.png',
  './RativaSnack/icon-maskable-512.png'
];

self.addEventListener('install',event=>{
  event.waitUntil((async()=>{
    const cache=await caches.open(CACHE_NAME);
    const results=await Promise.allSettled(APP_ASSETS.map(asset=>cache.add(asset)));
    const failed=results.map((result,index)=>result.status==='rejected'?APP_ASSETS[index]:null).filter(Boolean);
    if(failed.length)console.warn('[Rativa PWA] Arquivos que não entraram no cache:',failed);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(key=>key.startsWith('rativa-games-shell-')&&key!==CACHE_NAME).map(key=>caches.delete(key)));
    await self.clients.claim();
  })());
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

    // Páginas do jogo abrem pelo cache primeiro; a rede atualiza a cópia para a próxima visita.
    if(cached){
      if(request.mode==='navigate'){
        fetch(request).then(response=>{
          if(response.ok)cache.put(request,response.clone());
        }).catch(()=>{});
      }
      return cached;
    }

    try{
      const response=await fetch(request);
      if(response.ok)await cache.put(request,response.clone());
      return response;
    }catch(error){
      if(request.mode==='navigate'){
        const path=url.pathname.toLowerCase();
        const fallback=path.includes('/rativasnack/')
          ? './RativaSnack/Index.html'
          : './index.html';
        return (await cache.match(fallback))||(await cache.match('./'))||Response.error();
      }
      const fallback=await cache.match(request,{ignoreSearch:true});
      if(fallback)return fallback;
      throw error;
    }
  })());
});
