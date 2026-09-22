const CACHE="soagri-shell-v2";

self.addEventListener("install",event=>{
  event.waitUntil(
    caches.open(CACHE).then(cache=>
      cache.addAll(["/manifest.webmanifest","/icon.svg"])
    )
  );
  self.skipWaiting();
});

self.addEventListener("activate",event=>{
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches.keys().then(keys=>
        Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))
      )
    ])
  );
});

self.addEventListener("fetch",event=>{
  if(event.request.method!=="GET"||event.request.url.includes("/api/"))return;

  event.respondWith(
    fetch(event.request).catch(()=>caches.match(event.request))
  );
});

self.addEventListener("push",event=>{
  let payload={
    title:"So.Agri Scadenze",
    body:"Hai una nuova notifica.",
    url:"/"
  };

  try{
    if(event.data)payload={...payload,...event.data.json()};
  }catch{
    if(event.data)payload.body=event.data.text();
  }

  event.waitUntil(
    self.registration.showNotification(payload.title,{
      body:payload.body,
      icon:"/icon.svg",
      badge:"/icon.svg",
      tag:payload.tag||undefined,
      data:{url:payload.url||"/"}
    })
  );
});

self.addEventListener("notificationclick",event=>{
  event.notification.close();
  const target=event.notification.data?.url||"/";

  event.waitUntil(
    self.clients.matchAll({type:"window",includeUncontrolled:true}).then(clients=>{
      for(const client of clients){
        if("navigate" in client)client.navigate(target);
        if("focus" in client)return client.focus();
      }
      return self.clients.openWindow?self.clients.openWindow(target):undefined;
    })
  );
});
