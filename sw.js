const VERSION=5;
const CACHE_PREFIX='bikini-bottom-v';
const CACHE=CACHE_PREFIX+VERSION;
const PREVIOUS_CACHE=CACHE_PREFIX+(VERSION-1);
const scope=new URL(self.registration.scope);
const indexPage=new URL('index.html',scope);
const versionedFiles=['style.css','data.js','art.js','audio.js','game.js'];
const sharedFiles=['app.webmanifest','undersea.jpg','icon-192.png','icon-512.png'];
const versionedPath=(file,version)=>file+'?v='+version;
const scopedUrl=path=>new URL(path,scope).href;
const assetUrls=[
  ...versionedFiles.map(file=>scopedUrl(versionedPath(file,VERSION))),
  ...sharedFiles.map(scopedUrl),
];
const currentAssets=new Set(assetUrls);
const previousAssets=new Set(versionedFiles.map(file=>scopedUrl(versionedPath(file,VERSION-1))));
const bundle=[scope.href,...assetUrls];
let pendingCacheWrite;

async function fetchAsset(url,shell=false) {
  const response=await fetch(url,{cache:'reload'});
  if(!response.ok||response.redirected||response.type!=='basic'){
    throw new Error('Unable to cache game asset: '+url);
  }
  if(shell){
    const html=await response.clone().text();
    const matchesVersion=versionedFiles.every(file=>html.includes('"./'+versionedPath(file,VERSION)+'"'));
    if(!matchesVersion)throw new Error('Game page does not match offline version '+VERSION);
  }else if(response.headers.get('content-type')?.includes('text/html')){
    throw new Error('Received an HTML page for game asset: '+url);
  }
  return response;
}

async function fetchShell() {
  try {
    return await fetchAsset(scope.href,true);
  } catch {
    // Some static mirrors expose the file without serving it as a directory index.
    return fetchAsset(indexPage.href,true);
  }
}

function cacheBundle() {
  if(!pendingCacheWrite){
    pendingCacheWrite=(async ()=>{
      const [html,...assets]=await Promise.all([fetchShell(),...assetUrls.map(url=>fetchAsset(url))]);
      const cache=await caches.open(CACHE);
      await Promise.all(assets.map((response,index)=>cache.put(assetUrls[index],response)));
      // The shell always references files that have already been saved.
      await cache.put(scope.href,html);
    })().finally(()=>{pendingCacheWrite=null});
  }
  return pendingCacheWrite;
}

self.addEventListener('install',event=>{
  event.waitUntil(cacheBundle().then(()=>self.skipWaiting()));
});

self.addEventListener('activate',event=>{
  event.waitUntil((async ()=>{
    const names=await caches.keys();
    const obsolete=names.filter(name=>{
      if(!name.startsWith(CACHE_PREFIX))return false;
      const version=Number(name.slice(CACHE_PREFIX.length));
      return Number.isInteger(version)&&version<VERSION-1;
    });
    await Promise.all(obsolete.map(name=>caches.delete(name)));
    // Existing tabs can finish loading their previous versioned files.
    await self.clients.claim();
  })());
});

async function offlineReady() {
  try {
    const responses=await Promise.all(bundle.map(url=>caches.match(url,{cacheName:CACHE})));
    if(responses.every(Boolean))return true;
    if(self.navigator.onLine===false)return false;
    await cacheBundle();
    return true;
  } catch {
    return false;
  }
}

self.addEventListener('message',event=>{
  const port=event.ports[0];
  if(event.data?.type!=='offline-status'||!port)return;
  event.waitUntil(offlineReady().then(ready=>port.postMessage({type:'offline-status',version:VERSION,ready})));
});

async function cachedResponse(cacheName,key,request) {
  try {
    const cached=await caches.match(key,{cacheName});
    if(cached)return cached;
  } catch {
    // Cache access can be disabled or fail on low-storage devices.
  }
  return fetch(request);
}

self.addEventListener('fetch',event=>{
  const {request}=event;
  if(request.method!=='GET')return;
  const url=new URL(request.url);
  if(url.origin!==scope.origin)return;
  if(request.mode==='navigate'&&(url.pathname===scope.pathname||url.pathname===indexPage.pathname)){
    event.respondWith(cachedResponse(CACHE,scope.href,request));
  }else if(currentAssets.has(url.href)||previousAssets.has(url.href)){
    if(request.headers.has('range'))return;
    const cacheName=currentAssets.has(url.href)?CACHE:PREVIOUS_CACHE;
    event.respondWith(cachedResponse(cacheName,request,request));
  }
});
