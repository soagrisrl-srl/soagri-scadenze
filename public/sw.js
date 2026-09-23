const VERSION="soagri-push-v3";

self.addEventListener("install",()=>{
  self.skipWaiting();
});

self.addEventListener("activate",event=>{
  event.waitUntil(self.clients.claim());
});

async function acknowledge(payload,stage,error){
  if(!payload?.deliveryId||!payload?.deviceId)return;

  try{
    await fetch("/api/push/ack",{
      method:"POST",
      headers:{
        "Content-Type":"application/json"
      },
      body:JSON.stringify({
        deliveryId:payload.deliveryId,
        deviceId:payload.deviceId,
        stage,
        error
      })
    });
  }catch{
    // il push continua anche se l'ACK non riesce
  }
}

self.addEventListener("push",event=>{
  event.waitUntil((async()=>{
    let payload={
      title:"So.Agri Scadenze",
      body:"Hai una nuova notifica.",
      url:"/",
      tag:`soagri-${Date.now()}`
    };

    try{
      if(event.data){
        payload={
          ...payload,
          ...event.data.json()
        };
      }
    }catch{
      if(event.data){
        payload.body=event.data.text();
      }
    }

    await acknowledge(payload,"RECEIVED");

    try{
      await self.registration.showNotification(
        payload.title,
        {
          body:payload.body,
          icon:"/icon.svg",
          tag:payload.tag,
          renotify:true,
          requireInteraction:true,
          silent:false,
          timestamp:Date.now(),
          data:{
            url:payload.url||"/",
            deliveryId:payload.deliveryId,
            deviceId:payload.deviceId,
            version:VERSION
          }
        }
      );

      await acknowledge(payload,"DISPLAYED");
    }catch(error){
      await acknowledge(
        payload,
        "ERROR",
        error instanceof Error
          ? error.message
          : String(error)
      );
    }
  })());
});

self.addEventListener("notificationclick",event=>{
  event.notification.close();

  const target=event.notification.data?.url||"/";

  event.waitUntil((async()=>{
    const clients=await self.clients.matchAll({
      type:"window",
      includeUncontrolled:true
    });

    for(const client of clients){
      try{
        await client.navigate(target);
      }catch{
        // continua
      }

      if("focus" in client){
        return client.focus();
      }
    }

    if(self.clients.openWindow){
      return self.clients.openWindow(target);
    }
  })());
});
