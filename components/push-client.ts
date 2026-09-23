export type PushRegistrationResult={
  registered:boolean;
  deviceId?:string;
  needsInstall?:boolean;
  reason?:string;
};

export function isIOS(){
  return /iPhone|iPad|iPod/i.test(navigator.userAgent);
}

export function isStandalone(){
  return window.matchMedia("(display-mode: standalone)").matches ||
    Boolean((navigator as Navigator & {standalone?:boolean}).standalone);
}

export function pushSupported(){
  return "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window;
}

function decodeKey(base64:string){
  const padding="=".repeat((4-base64.length%4)%4);
  const normalized=(base64+padding)
    .replace(/-/g,"+")
    .replace(/_/g,"/");

  const raw=atob(normalized);

  return Uint8Array.from(
    [...raw].map(char=>char.charCodeAt(0))
  );
}

function applicationKeyMatches(
  subscription:PushSubscription,
  expected:Uint8Array
){
  const key=subscription.options.applicationServerKey;
  if(!key)return false;

  const actual=new Uint8Array(key);

  if(actual.length!==expected.length)return false;

  return actual.every((value,index)=>value===expected[index]);
}

export function deviceInfo(){
  const ua=navigator.userAgent;

  let platform="Computer";
  if(/iPhone/i.test(ua))platform="iPhone";
  else if(/iPad/i.test(ua))platform="iPad";
  else if(/Android/i.test(ua))platform="Android";
  else if(/Macintosh|Mac OS X/i.test(ua))platform="Mac";
  else if(/Windows/i.test(ua))platform="Windows";
  else if(/Linux/i.test(ua))platform="Linux";

  let browser="Browser";
  if(/CriOS/i.test(ua))browser="Chrome";
  else if(/FxiOS/i.test(ua))browser="Firefox";
  else if(/EdgiOS/i.test(ua))browser="Edge";
  else if(/Edg\//i.test(ua))browser="Edge";
  else if(/Chrome\//i.test(ua))browser="Chrome";
  else if(/Firefox\//i.test(ua))browser="Firefox";
  else if(/Safari\//i.test(ua))browser="Safari";

  return {
    deviceName:`${platform} · ${browser}`,
    platform,
    browser,
    userAgent:ua.slice(0,500)
  };
}

async function saveSubscription(subscription:PushSubscription){
  const response=await fetch("/api/push/subscription",{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({
      ...subscription.toJSON(),
      ...deviceInfo()
    })
  });

  const result=await response.json();

  if(!response.ok){
    throw new Error(
      result.error||"Registrazione dispositivo non riuscita"
    );
  }

  return result as {
    ok:boolean;
    deviceId:string;
    devices:number;
  };
}

async function worker(){
  const registration=await navigator.serviceWorker.register(
    "/sw.js",
    {updateViaCache:"none"}
  );

  try{
    await registration.update();
  }catch{
    // non blocca la configurazione
  }

  return navigator.serviceWorker.ready;
}

export async function inspectCurrentDevice():Promise<PushRegistrationResult>{
  if(!pushSupported()){
    return {
      registered:false,
      reason:"Questo dispositivo/browser non supporta Web Push."
    };
  }

  if(isIOS()&&!isStandalone()){
    return {
      registered:false,
      needsInstall:true,
      reason:"Su iPhone/iPad So.Agri deve essere aggiunta alla schermata Home."
    };
  }

  if(Notification.permission==="denied"){
    return {
      registered:false,
      reason:"Le notifiche sono bloccate nelle impostazioni del dispositivo."
    };
  }

  const registration=await worker();
  const subscription=await registration.pushManager.getSubscription();

  if(!subscription){
    return {registered:false};
  }

  const publicKey=process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY||"";

  if(publicKey){
    const expected=decodeKey(publicKey);

    if(!applicationKeyMatches(subscription,expected)){
      await subscription.unsubscribe();
      return {
        registered:false,
        reason:"La vecchia registrazione è stata aggiornata. Configura nuovamente il dispositivo."
      };
    }
  }

  const saved=await saveSubscription(subscription);

  return {
    registered:true,
    deviceId:saved.deviceId
  };
}

export async function configureCurrentDevice():Promise<PushRegistrationResult>{
  if(!pushSupported()){
    throw new Error(
      "Questo dispositivo/browser non supporta Web Push."
    );
  }

  if(isIOS()&&!isStandalone()){
    return {
      registered:false,
      needsInstall:true,
      reason:"INSTALL_IOS"
    };
  }

  let permission=Notification.permission;

  if(permission==="default"){
    permission=await Notification.requestPermission();
  }

  if(permission!=="granted"){
    throw new Error(
      "Permesso notifiche non concesso."
    );
  }

  const publicKey=process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY||"";

  if(!publicKey){
    throw new Error(
      "Chiave pubblica notifiche non configurata."
    );
  }

  const expected=decodeKey(publicKey);
  const registration=await worker();

  let subscription=await registration.pushManager.getSubscription();

  if(
    subscription &&
    !applicationKeyMatches(subscription,expected)
  ){
    await subscription.unsubscribe();
    subscription=null;
  }

  if(!subscription){
    subscription=await registration.pushManager.subscribe({
      userVisibleOnly:true,
      applicationServerKey:expected
    });
  }

  const saved=await saveSubscription(subscription);

  return {
    registered:true,
    deviceId:saved.deviceId
  };
}
